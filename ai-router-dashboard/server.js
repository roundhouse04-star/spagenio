import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './lib/db-schema.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import fs from 'fs';

import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import frontRoutes from './routes/front.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// ── NaN/Infinity 공통 처리 (모든 res.json에 자동 적용) ──
app.use((req, res, next) => {
  const _json = res.json.bind(res);
  res.json = function (obj) {
    try {
      const cleaned = JSON.parse(JSON.stringify(obj, (_, v) =>
        typeof v === 'number' && !isFinite(v) ? null : v
      ));
      return _json(cleaned);
    } catch (e) {
      return _json(obj);
    }
  };
  next();
});


const port = Number(process.env.PORT || 3000);


// ============================================================
// DB 초기화 (스키마는 lib/db-schema.js 로 분리)
// ============================================================
const dbPath = path.join(__dirname, 'stock.db');
const db = initDatabase(dbPath);
console.log('✅ SQLite DB 초기화 완료:', dbPath);

// ============================================================
// 공통 설정 — secrets는 반드시 env 에서 로드. fallback 금지.
// ============================================================
const _BANNED_DEFAULTS = new Set([
  'ai-router-secret-key-change-this',
  'ai-router-admin-secret-key-change-this',
  'ai-router-encrypt-key-32chars!!',
  'change-me', 'changeme', 'secret', 'password',
]);

function _requireSecret(name, { minLen = 32 } = {}) {
  const v = process.env[name];
  if (!v || v.length < minLen || _BANNED_DEFAULTS.has(v)) {
    console.error(`\n❌ ${name} 환경변수가 누락되었거나 너무 짧습니다 (최소 ${minLen}자, 알려진 기본값 금지).`);
    console.error(`   생성: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`);
    console.error(`   .env 에 ${name}=<생성한 값> 추가 후 재시작하세요.\n`);
    process.exit(1);
  }
  return v;
}

const JWT_SECRET = _requireSecret('JWT_SECRET');
const ADMIN_JWT_SECRET = _requireSecret('ADMIN_JWT_SECRET');
if (JWT_SECRET === ADMIN_JWT_SECRET) {
  console.error('\n❌ JWT_SECRET 와 ADMIN_JWT_SECRET 는 서로 달라야 합니다.\n');
  process.exit(1);
}
const JWT_EXPIRES = '24h';

// AES-256 키 도출:
// - 64-char hex 면 32바이트로 decode (권장: crypto.randomBytes(32).toString('hex'))
// - 그 외엔 UTF-8 첫 32바이트 (부족하면 '0' padEnd) — 구버전 호환용
function _deriveAesKey(raw) {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return Buffer.from(raw.slice(0, 32).padEnd(32, '0'));
}

const _ENCRYPT_KEY_RAW = _requireSecret('ENCRYPT_KEY');
const ENCRYPT_KEY_BUF = _deriveAesKey(_ENCRYPT_KEY_RAW);

// 선택: 구버전에서 암호화한 데이터 복호화용. 신규 암호화에는 사용 안 함.
// 마이그레이션 후 삭제 권장.
const _LEGACY_RAW = process.env.ENCRYPT_KEY_LEGACY;
const ENCRYPT_KEY_LEGACY_BUF = _LEGACY_RAW ? _deriveAesKey(_LEGACY_RAW) : null;
if (ENCRYPT_KEY_LEGACY_BUF) {
  console.log('ℹ️  ENCRYPT_KEY_LEGACY 활성: 기존 데이터는 legacy 키로 폴백 복호화');
}

function encryptEmail(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPT_KEY_BUF, iv);
  return iv.toString('hex') + ':' + Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('hex');
}

function decryptEmail(encrypted) {
  if (!encrypted || typeof encrypted !== 'string') return null;
  const [ivHex, dataHex] = encrypted.split(':');
  if (!ivHex || !dataHex) return null;
  let iv, data;
  try { iv = Buffer.from(ivHex, 'hex'); data = Buffer.from(dataHex, 'hex'); } catch { return null; }
  // 1차: 새 키
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPT_KEY_BUF, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (e) {
    // 2차: legacy 키 (있을 때만)
    if (!ENCRYPT_KEY_LEGACY_BUF) return null;
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPT_KEY_LEGACY_BUF, iv);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch (e2) { return null; }
  }
}

const verifyCodeStore = new Map();

// ============================================================
// 에러 로그
// ============================================================
const errorLogDir = path.join(__dirname, 'logs', 'errors');
if (!fs.existsSync(errorLogDir)) fs.mkdirSync(errorLogDir, { recursive: true });

function saveErrorLog({ event_type, error_message, stack_trace = '', meta = {} }) {
  try {
    fs.appendFileSync(path.join(errorLogDir, `${new Date().toISOString().slice(0, 10)}.jsonl`),
      JSON.stringify({ timestamp: new Date().toISOString(), event_type, error_message, stack_trace, meta: typeof meta === 'string' ? meta : JSON.stringify(meta) }) + '\n', 'utf8');
  } catch (e) { console.error('saveErrorLog 실패:', e.message); }
}

// ============================================================
// 로거
// ============================================================
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const C = { reset: '\x1b[0m', bright: '\x1b[1m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', blue: '\x1b[34m', cyan: '\x1b[36m', magenta: '\x1b[35m', gray: '\x1b[90m', white: '\x1b[37m', bgRed: '\x1b[41m' };

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error', maxsize: 2097152, maxFiles: 3 }),
    new winston.transports.Console({
      format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const lc = { error: `${C.bright}${C.red}`, warn: `${C.bright}${C.yellow}`, info: C.cyan, debug: C.gray }[level] || C.white;
        let details = '';
        if (meta.ip) details += ` ${C.gray}IP:${C.white}${meta.ip}${C.reset}`;
        if (meta.username) details += ` ${C.blue}👤${meta.username}${C.reset}`;
        if (meta.method && meta.path) details += ` ${C.cyan}${meta.method} ${meta.path}${C.reset}`;
        if (meta.statusCode) { const sc = meta.statusCode; details += ` ${sc >= 500 ? C.red : sc >= 400 ? C.yellow : C.green}[${sc}]${C.reset}`; }
        const iconMap = { 'LOGIN_SUCCESS': `${C.green}✅ 로그인 성공${C.reset}`, 'LOGIN_FAILED': `${C.red}❌ 로그인 실패${C.reset}`, 'SUSPICIOUS_REQUEST': `${C.bgRed}${C.white} ⚠️ 의심 접근 ${C.reset}`, 'USER_DELETED': `${C.magenta}🗑️ 유저 삭제${C.reset}`, 'ACCESS': `${C.gray}→${C.reset}` };
        const icon = iconMap[message] || '';
        return `${C.gray}[${timestamp.slice(11, 19)}]${C.reset} ${lc}${level.toUpperCase().padEnd(5)}${C.reset} ${icon || `${C.white}${message}${C.reset}`}${details}`;
      }))
    })
  ]
});

const logClients = new Set();

function saveAccessLog({ ip, method, path, statusCode, userId, username, userAgent, referer, responseTime, eventType = 'request' }) {
  try {
    db.prepare('INSERT INTO access_logs (ip,method,path,status_code,user_id,username,user_agent,referer,response_time,event_type) VALUES (?,?,?,?,?,?,?,?,?,?)').run(ip, method, path, statusCode, userId || null, username || null, userAgent, referer, responseTime, eventType);
    if (logClients.size > 0) {
      const levelMap = { suspicious: 'warn', login_failed: 'error', login_success: 'success', rate_limit: 'warn', request: 'info' };
      const data = `data: ${JSON.stringify({ level: levelMap[eventType] || 'info', message: `${method} ${path}`, time: new Date().toISOString().slice(11, 19), ip, username: username || '-', status: statusCode, eventType, responseTime: responseTime + 'ms' })}\n\n`;
      logClients.forEach(client => { try { client.write(data); } catch (e) { logClients.delete(client); } });
    }
  } catch (e) { logger.error('로그 저장 오류:', e.message); }
}

// ============================================================
// 메일
// ============================================================
const mailTransporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });

async function sendMail({ to, subject, html }) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) { console.log('⚠️ Gmail 설정 없음'); return false; }
  try { await mailTransporter.sendMail({ from: `spagenio <${process.env.GMAIL_USER}>`, to, subject, html }); return true; }
  catch (e) { saveErrorLog({ event_type: 'MAIL_ERROR', error_message: e.message, stack_trace: e.stack, meta: { to, subject } }); return false; }
}

const startedAt = Date.now();
const requestStats = { total: 0, errors: 0, lastError: null };

function getUserAlpacaKeys(userId, accountId, accountType = null) {
  let row;
  if (accountId) {
    row = db.prepare('SELECT id,alpaca_api_key,alpaca_secret_key,alpaca_paper FROM user_broker_keys WHERE id=? AND user_id=?').get(accountId, userId);
  } else if (accountType) {
    row = db.prepare('SELECT id,alpaca_api_key,alpaca_secret_key,alpaca_paper FROM user_broker_keys WHERE user_id=? AND account_type=?').get(userId, accountType);
    if (!row) {
      row = db.prepare('SELECT id,alpaca_api_key,alpaca_secret_key,alpaca_paper FROM user_broker_keys WHERE user_id=? AND is_active=1').get(userId);
    }
  } else {
    row = db.prepare('SELECT id,alpaca_api_key,alpaca_secret_key,alpaca_paper FROM user_broker_keys WHERE user_id=? AND is_active=1').get(userId);
    if (!row) row = db.prepare('SELECT id,alpaca_api_key,alpaca_secret_key,alpaca_paper FROM user_broker_keys WHERE user_id=? LIMIT 1').get(userId);
  }
  if (!row) return null;
  try { return { id: row.id, api_key: decryptEmail(row.alpaca_api_key), secret_key: decryptEmail(row.alpaca_secret_key), paper: row.alpaca_paper === 1 }; } catch (e) { return null; }
}

// ============================================================
// 미들웨어
// ============================================================
app.disable('x-powered-by');
// trust proxy 는 rate-limit 보다 먼저 등록해야 req.ip 가 X-Forwarded-For 를 반영함
// (그래야 프록시 뒤에서 클라이언트별로 정확히 throttle 됨)
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

const globalLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, message: { error: '너무 많은 요청입니다.' }, handler: (req, res, next, options) => { const ip = req.ip; logger.warn('RATE_LIMIT_EXCEEDED', { ip, path: req.path }); saveAccessLog({ ip, method: req.method, path: req.path, statusCode: 429, userAgent: req.headers['user-agent'] || '', referer: req.headers['referer'] || '', responseTime: 0, eventType: 'rate_limit' }); res.status(429).json(options.message); } });
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: '로그인 시도가 너무 많습니다.' } });
const passwordResetLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { error: '잠시 후 다시 시도해주세요.' } });

app.use(globalLimit);
app.use('/api/auth/login', authLimit);
app.use('/api/auth/register', authLimit);
app.use('/api/auth/forgot-password', passwordResetLimit);
app.use('/api/auth/send-email-code', passwordResetLimit);

// m.spagenio.com → 모바일 페이지
app.use((req, res, next) => {
  const host = req.headers['x-forwarded-host'] || req.headers['host'] || '';
  if (host.startsWith('m.') && !req.path.startsWith('/api') && !req.path.startsWith('/proxy')) {
    return res.sendFile(path.join(__dirname, 'public', 'm.html'));
  }
  next();
});
// CORS: env 화이트리스트가 있으면 그것만 허용. 없으면 기존 동작(전체 허용) 유지 — 운영에선 .env 에 CORS_ORIGIN 설정 권장.
// same-origin 트래픽(spagenio.com → spagenio.com)은 CORS 검사 자체가 안 도므로 영향 없음.
const _corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors(_corsOrigins.length > 0
  ? { origin: _corsOrigins, credentials: true }
  : {}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  const startTime = Date.now();
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    // ACCESS 파일 로그 제거 — DB(access_logs)에만 저장
    if (!req.path.match(/\.(js|css|ico|png|jpg|svg|woff)$/)) saveAccessLog({ ip, method: req.method, path: req.path, statusCode: res.statusCode, userId: req.user?.id, username: req.user?.username, userAgent: req.headers['user-agent'] || '', referer: req.headers['referer'] || '', responseTime });
    const suspiciousPatterns = ['/etc/passwd', '../', 'eval(', '<script', 'UNION SELECT', 'DROP TABLE', '/admin.php', '/wp-admin'];
    // %2E%2E%2F 같은 URL 인코딩 우회 차단 — decode 후 검사. 잘못된 시퀀스는 raw path 로 fallback.
    let pathForCheck;
    try { pathForCheck = decodeURIComponent(req.path).toLowerCase(); }
    catch { pathForCheck = req.path.toLowerCase(); }
    if (suspiciousPatterns.some(p => pathForCheck.includes(p.toLowerCase()))) { logger.warn('SUSPICIOUS_REQUEST', { ip, method: req.method, path: req.path }); saveAccessLog({ ip, method: req.method, path: req.path, statusCode: res.statusCode, userAgent: req.headers['user-agent'] || '', referer: req.headers['referer'] || '', responseTime, eventType: 'suspicious' }); }
  });
  next();
});

function authMiddleware(req, res, next) {
  const publicApis = ['/api/auth/login', '/api/auth/admin-login', '/api/auth/verify', '/api/auth/register', '/api/auth/forgot-password', '/api/auth/send-email-code', '/api/auth/verify-email-code', '/api/auth/check-username', '/api/auth/check-email'];
  if (!req.path.startsWith('/api/')) return next();
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.auth_token;
  if (token) {
    try {
      // admin 토큰 먼저 시도 (ADMIN_JWT_SECRET)
      let decoded = null;
      let isAdminToken = false;
      try {
        decoded = jwt.verify(token, ADMIN_JWT_SECRET);
        isAdminToken = true;
      } catch (e) {
        // admin 토큰 아님 → 일반 토큰 시도
        decoded = jwt.verify(token, JWT_SECRET);
      }

      if (isAdminToken) {
        // admins 테이블 조회
        const admin = db.prepare('SELECT a.id, a.username, a.email, r.role_name, 1 as is_admin FROM admins a LEFT JOIN admin_roles r ON a.role_id=r.id WHERE a.id=? AND a.is_active=1').get(decoded.id);
        if (admin) {
          // users 테이블에도 같은 username이 있으면 그 id를 user_id로 사용 (FK 호환)
          const userRow = db.prepare('SELECT id FROM users WHERE username=?').get(admin.username);
          req.user = { ...decoded, ...admin, user_id: userRow?.id || null };
        }
      } else {
        // users 테이블 조회 (일반 유저만)
        const user = db.prepare('SELECT id, username, email, 0 as is_admin FROM users WHERE id = ?').get(decoded.id);
        if (user) req.user = { ...decoded, ...user };
      }
    } catch (e) { }
  }
  if (publicApis.some(p => req.path.startsWith(p))) return next();
  if (!req.user) return res.status(401).json({ error: '인증이 필요합니다.' });
  next();
}

app.use(authMiddleware);
app.use((req, res, next) => { if (req.path.startsWith('/api/')) return next(); express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 })(req, res, next); });
app.use((req, res, next) => { requestStats.total += 1; res.setHeader('Cache-Control', 'no-store'); next(); });

// ============================================================
// 라우트 연결
// ============================================================
const deps = { db, bcrypt, jwt, JWT_SECRET, ADMIN_JWT_SECRET, JWT_EXPIRES, sendMail, encryptEmail, decryptEmail, verifyCodeStore, logger, saveAccessLog, saveErrorLog, errorLogDir, fs, logClients, __dirname };
const frontDeps = { ...deps, requestStats, startedAt, getUserAlpacaKeys, runAutoTradeForUser, getNasdaqTop3, saveTradeLog, updateTradeLogStatus };

app.use('/api/auth', authRoutes(deps));
app.use('/', adminRoutes(deps));
app.use('/', frontRoutes(frontDeps));

app.get("/mobile", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "m.html"));
});

app.get("*", (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  // m.spagenio.com 접속 시 모바일 페이지로
  const host = req.headers['x-forwarded-host'] || req.hostname || '';
  if (host.startsWith('m.') && !req.path.startsWith('/api') && !req.path.startsWith('/proxy')) {
    return res.sendFile(path.join(__dirname, 'public', 'm.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// 에러 핸들러
// ============================================================
app.use((err, req, res, next) => {
  logger.error('SERVER_ERROR', { error: err.message, path: req.path });
  saveErrorLog({ event_type: 'SERVER_ERROR', error_message: err.message, stack_trace: err.stack, meta: { path: req.path, method: req.method } });
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  logger.error('UNHANDLED_REJECTION', { error: msg });
  saveErrorLog({ event_type: 'UNHANDLED_REJECTION', error_message: msg, stack_trace: reason instanceof Error ? reason.stack : '' });
});

process.on('uncaughtException', (err) => {
  // EPIPE는 클라이언트 연결 끊김 — 무시
  if (err.code === 'EPIPE' || err.message === 'write EPIPE') return;
  logger.error('UNCAUGHT_EXCEPTION', { error: err.message });
  saveErrorLog({ event_type: 'UNCAUGHT_EXCEPTION', error_message: err.message, stack_trace: err.stack });
});

// ✅ 에러 로그 자동 정리 (매일 자정 — 30일 이상 된 .jsonl 삭제)
// uncaughtException 안에 있던 코드를 밖으로 빼냄. 이전엔 크래시 후에만 실행됐음.
function cleanOldErrorLogs() {
  try {
    if (!fs.existsSync(errorLogDir)) return;
    const files = fs.readdirSync(errorLogDir).filter(f => f.endsWith('.jsonl'));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    files.forEach(f => {
      const dateStr = f.replace('.jsonl', '');
      const fileDate = new Date(dateStr);
      if (!isNaN(fileDate) && fileDate < cutoff) {
        fs.unlinkSync(path.join(errorLogDir, f));
        logger.info('ERROR_LOG_CLEANED', { file: f });
      }
    });
  } catch (e) {
    logger.error('ERROR_LOG_CLEAN_FAIL', { error: e.message });
  }
}

// 서버 시작 시 1회 + 매일 자정 실행
cleanOldErrorLogs();
{
  const now = new Date();
  const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
  setTimeout(() => {
    cleanOldErrorLogs();
    setInterval(cleanOldErrorLogs, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
}

// ============================================================
// 서버 TZ 와 무관하게 한국 표준시 (Asia/Seoul) 기준의 시각/요일/날짜 추출
function getKstClock(d = new Date()) {
  const tz = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const yyyy = tz.getFullYear();
  const mm = String(tz.getMonth() + 1).padStart(2, '0');
  const dd = String(tz.getDate()).padStart(2, '0');
  return { hour: tz.getHours(), minute: tz.getMinutes(), day: tz.getDay(), date: `${yyyy}-${mm}-${dd}` };
}

// ============================================================
// 나스닥100 TOP3 분석
// ============================================================
const NASDAQ100 = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'TSLA', 'AVGO', 'COST', 'NFLX',
  'AMD', 'ADBE', 'QCOM', 'PEP', 'TMUS', 'AMAT', 'TXN', 'INTU', 'MU', 'LRCX',
  'ISRG', 'BKNG', 'KLAC', 'REGN', 'PANW', 'SNPS', 'CDNS', 'CRWD', 'CSX', 'MELI',
  'ORLY', 'ABNB', 'CTAS', 'FTNT', 'MDLZ', 'ROP', 'MNST', 'PCAR', 'ADP', 'CPRT',
  'ROST', 'PAYX', 'KDP', 'ODFL', 'MCHP', 'IDXX', 'EA', 'DXCM', 'TEAM', 'FAST'
];

const DOW30 = [
  'AAPL', 'AMGN', 'AXP', 'BA', 'CAT', 'CRM', 'CSCO', 'CVX', 'DIS', 'DOW',
  'GS', 'HD', 'HON', 'IBM', 'JNJ', 'JPM', 'KO', 'MCD', 'MMM', 'MRK',
  'MSFT', 'NKE', 'PG', 'TRV', 'UNH', 'V', 'VZ', 'WBA', 'WMT', 'INTC'
];

// 참고: detectVolumeSurge / detectNewsCatalyst / calcRiskPosition 은
// routes/front.js 에 동일/개선 구현이 존재하여 중복본을 제거함.

async function getNasdaqTop3(signalMode = 'combined', alpacaKeys = null, market = 'nasdaq') {
  const results = [];
  const headers = alpacaKeys
    ? { 'APCA-API-KEY-ID': alpacaKeys.api_key, 'APCA-API-SECRET-KEY': alpacaKeys.secret_key }
    : {};
  const end = new Date().toISOString().split('T')[0];
  const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const targets = market === 'dow' ? DOW30 : NASDAQ100.slice(0, 30);

  await Promise.allSettled(targets.map(async (symbol) => {
    try {
      const url = `https://data.alpaca.markets/v2/stocks/${symbol}/bars?timeframe=1Day&start=${start}&end=${end}&limit=60`;
      const resp = await fetch(url, { headers });
      const json = await resp.json();
      const bars = json.bars || [];
      if (bars.length < 35) return;
      const closes = bars.map(b => b.c);
      const currentPrice = closes[closes.length - 1];
      let score = 0;
      const signals = [];

      if (signalMode === 'macd' || signalMode === 'combined') {
        const m = calcMACD(closes);
        if (m?.goldenCross) { score += 2; signals.push('MACD 골든크로스'); }
        else if (m?.macd > 0) { score += 1; signals.push('MACD 양수'); }
      }
      if (signalMode === 'rsi' || signalMode === 'combined') {
        const rsi = calcRSI(closes);
        if (rsi && rsi < 30) { score += 2; signals.push(`RSI ${rsi.toFixed(1)} 강한매수`); }
        else if (rsi && rsi < 40) { score += 1; signals.push(`RSI ${rsi.toFixed(1)} 과매도`); }
      }
      if (score > 0) results.push({ symbol, score, price: currentPrice, signals });
    } catch (e) { }
  }));

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 3);
}

// ============================================================
// 단순 자동매매 (1종목 / 30% / 당일청산)
// ============================================================
async function runSimpleAutoTrade(userId, brokerKeyId = null) {
  const state = brokerKeyId
    ? db.prepare('SELECT * FROM trade_setting_type2 WHERE user_id=? AND broker_key_id=? AND enabled=1').get(userId, brokerKeyId)
    : db.prepare('SELECT * FROM trade_setting_type2 WHERE user_id=? AND enabled=1 ORDER BY broker_key_id DESC LIMIT 1').get(userId);
  if (!state) return;

  const keys = getUserAlpacaKeys(userId, state.broker_key_id || null);
  if (!keys) return;

  const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
  const headers = { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key, 'Content-Type': 'application/json' };

  // 미국 동부 시간 기준
  const now = new Date();
  const estHour = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }).format(now));
  const estMin = parseInt(new Intl.DateTimeFormat('en-US', { minute: 'numeric', timeZone: 'America/New_York' }).format(now));
  const estTime = estHour * 60 + estMin;
  const marketOpen = 9 * 60 + 30;   // 9:30
  const marketClose = 16 * 60;       // 16:00
  const forceCloseTime = 15 * 60 + 55; // 15:55 (마감 5분 전)

  // 장 시간 외에는 실행 안 함
  if (estTime < marketOpen || estTime >= marketClose) return;

  try {
    const account = await (await fetch(`${baseUrl}/v2/account`, { headers })).json();
    const equity = parseFloat(account.equity) || 0;

    // === 보유 중인 경우: 익절/손절/강제청산 체크 ===
    if (state.status === 'holding' && state.symbol && state.buy_price) {
      const posRes = await fetch(`${baseUrl}/v2/positions/${state.symbol}`, { headers });
      if (posRes.ok) {
        const pos = await posRes.json();
        const currentPrice = parseFloat(pos.current_price) || 0;
        const plPct = (currentPrice - state.buy_price) / state.buy_price;
        const qty = state.qty;

        let shouldSell = false;
        let reason = '';

        if (plPct >= (state.take_profit || 0.05)) {
          shouldSell = true;
          reason = `익절 +${(plPct * 100).toFixed(2)}%`;
        } else if (plPct <= -(state.stop_loss || 0.05)) {
          shouldSell = true;
          reason = `손절 ${(plPct * 100).toFixed(2)}%`;
        } else if (estTime >= forceCloseTime) {
          shouldSell = true;
          reason = `당일마감 강제청산 ${(plPct * 100).toFixed(2)}%`;
        }

        if (shouldSell) {
          // 매도
          const order = await (await fetch(`${baseUrl}/v2/orders`, {
            method: 'POST', headers,
            body: JSON.stringify({ symbol: state.symbol, qty: String(qty), side: 'sell', type: 'market', time_in_force: 'day' })
          })).json();

          // [레거시 제거] trade_setting_type2_log SELL → trade_log(type=2)만 사용
          saveTradeLog({ user_id: userId, trade_type: 2, symbol: state.symbol, action: 'SELL', qty, price: currentPrice, profit_pct: plPct * 100, reason, status: 'closed', broker_key_id: keys.id });
          updateTradeLogStatus(userId, state.symbol, 2);

          // 강제청산이면 당일 재매수 완전 차단 (closed_today 상태로 16:00까지 유지)
          if (estTime >= forceCloseTime) {
            db.prepare('UPDATE trade_setting_type2 SET status=?,symbol=NULL,qty=NULL,buy_price=NULL,order_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND broker_key_id IS ?')
              .run('closed_today', userId, state.broker_key_id || null);
          } else {
            // 매도 후 재분석 → 재매수 (장 마감 충분히 전일 때만)
            db.prepare('UPDATE trade_setting_type2 SET status=?,symbol=NULL,qty=NULL,buy_price=NULL,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND broker_key_id IS ?')
              .run('analyzing', userId, state.broker_key_id || null);
            setTimeout(() => runSimpleAutoTrade(userId, state.broker_key_id || null), 3000);
          }

          return;
        }
      } else {
        // 포지션 없으면 idle로 리셋
        db.prepare('UPDATE trade_setting_type2 SET status=?,symbol=NULL,qty=NULL,buy_price=NULL,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND broker_key_id IS ?')
          .run('idle', userId, state.broker_key_id || null);
      }
    }

    // === idle/analyzing 상태: 재분석 후 매수 ===
    // closed_today는 매수 시도 안 함 (강제청산 당일 재매수 방지)
    if ((state.status === 'idle' || state.status === 'analyzing') && estTime < forceCloseTime) {
      // TOP1 종목 분석
      const settingsRow = db.prepare('SELECT candidate_symbols FROM trade_setting_type4 WHERE user_id=?').get(userId);
      let symbols = settingsRow?.candidate_symbols
        ? settingsRow.candidate_symbols.split(',').map(s => s.trim()).filter(Boolean)
        : ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'AMD', 'QQQ', 'SPY'];

      // ✅ 수동 보유 종목(trade_type=1)은 단순자동매매 후보에서 제외
      const manualHeldST = new Set(
        db.prepare("SELECT DISTINCT symbol FROM trade_log WHERE user_id=? AND trade_type=1 AND action='BUY' AND status='active'").all(userId).map(r => r.symbol)
      );
      if (manualHeldST.size > 0) {
        symbols = symbols.filter(s => !manualHeldST.has(s));
        console.log(`[단순매매] 수동보유 종목 제외: ${[...manualHeldST].join(',')} → 후보 ${symbols.length}개`);
      }

      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      function calcEMA(prices, period) { const k = 2 / (period + 1); let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period; for (let i = period; i < prices.length; i++)ema = prices[i] * k + ema * (1 - k); return ema; }
      function calcMACD(closes) { if (closes.length < 35) return null; const ml = []; for (let i = 26; i <= closes.length; i++)ml.push(calcEMA(closes.slice(0, i), 12) - calcEMA(closes.slice(0, i), 26)); if (ml.length < 9) return null; const m = ml[ml.length - 1], s = calcEMA(ml, 9), pm = ml[ml.length - 2], ps = calcEMA(ml.slice(0, -1), 9); return { macd: m, signal: s, goldenCross: pm < ps && m > s }; }
      function calcRSI(closes, period = 14) { if (closes.length < period + 1) return null; const ch = closes.slice(1).map((c, i) => c - closes[i]); const ag = ch.slice(-period).filter(c => c > 0).reduce((a, b) => a + b, 0) / period; const al = ch.slice(-period).filter(c => c < 0).reduce((a, b) => a - b, 0) / period; return al === 0 ? 100 : 100 - (100 / (1 + ag / al)); }

      const scored = [];
      await Promise.allSettled(symbols.map(async (symbol) => {
        try {
          const resp = await fetch(`https://data.alpaca.markets/v2/stocks/${symbol}/bars?timeframe=1Day&start=${start}&end=${end}&limit=250`, { headers: { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key } });
          const json = await resp.json();
          const bars = json.bars || [];
          if (bars.length < 35) return;
          const closes = bars.map(b => b.c);
          const volumes = bars.map(b => b.v);
          const currentPrice = closes[closes.length - 1];
          let score = 0;
          const avgVol = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / (volumes.length - 1);
          if (volumes[volumes.length - 1] > avgVol * 2) score += 3;
          else if (volumes[volumes.length - 1] > avgVol * 1.5) score += 1;
          const m = calcMACD(closes);
          if (m?.goldenCross) score += 3;
          else if (m?.macd > 0) score += 1;
          const rsi = calcRSI(closes);
          if (rsi && rsi < 30) score += 3;
          else if (rsi && rsi < 40) score += 2;
          else if (rsi && rsi < 50) score += 1;
          if (score > 0) scored.push({ symbol, score, price: currentPrice });
        } catch (e) { }
      }));

      scored.sort((a, b) => b.score - a.score);
      const top = scored[0];
      if (!top) { db.prepare('UPDATE trade_setting_type2 SET status=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND broker_key_id IS ?').run('idle', userId, state.broker_key_id || null); return; }

      // 매수 금액 계산 (계좌 잔고 비율)
      const buyingPowerSimple = parseFloat(account.buying_power) || 0;
      const buyAmount = equity * (state.balance_ratio || 0.3);
      const qty = Math.floor(buyAmount / top.price);

      // ✅ 1주 미만 체크
      if (qty < 1) {
        console.log(`[단순매매] ${top.symbol} 매수 스킵: 1주 미만 (buyAmount=$${buyAmount.toFixed(0)}, price=$${top.price})`);
        db.prepare('UPDATE trade_setting_type2 SET status=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND broker_key_id IS ?').run('idle', userId, state.broker_key_id || null);
        return;
      }
      // ✅ 잔고 부족 체크
      if (qty * top.price > buyingPowerSimple) {
        const maxQty = Math.floor(buyingPowerSimple / top.price);
        if (maxQty < 1) {
          console.log(`[단순매매] ${top.symbol} 매수 스킵: 잔고 부족 (buying_power=$${buyingPowerSimple.toFixed(0)})`);
          db.prepare('UPDATE trade_setting_type2 SET status=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND broker_key_id IS ?').run('idle', userId, state.broker_key_id || null);
          return;
        }
        // 최대 매수 가능 수량으로 조정
        console.log(`[단순매매] ${top.symbol} 수량 조정: ${qty}주 → ${maxQty}주 (잔고 부족)`);
      }
      const alreadyHeld2 = db.prepare("SELECT id FROM trade_log WHERE user_id=? AND symbol=? AND broker_key_id=? AND action='BUY' AND status='active'").get(userId, top.symbol, keys.id);
      if (alreadyHeld2) { db.prepare("UPDATE trade_setting_type2 SET status=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND broker_key_id IS ?").run("idle", userId, state.broker_key_id || null); return; }
      const finalQty = Math.min(qty, Math.floor(buyingPowerSimple / top.price));

      const order = await (await fetch(`${baseUrl}/v2/orders`, {
        method: 'POST', headers,
        body: JSON.stringify({ symbol: top.symbol, qty: String(finalQty), side: 'buy', type: 'market', time_in_force: 'day' })
      })).json();

      if (order.id) {
        // [레거시 제거] trade_setting_type2_log BUY → trade_log(type=2)만 사용
        saveTradeLog({ user_id: userId, trade_type: 2, symbol: top.symbol, action: 'BUY', qty: finalQty, price: top.price, profit_pct: 0, reason: `점수 ${top.score}점 TOP1 매수`, status: 'active', broker_key_id: keys.id });
        db.prepare('UPDATE trade_setting_type2 SET status=?,symbol=?,qty=?,buy_price=?,order_id=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND broker_key_id IS ?')
          .run('holding', top.symbol, finalQty, top.price, order.id, userId, state.broker_key_id || null);

      }
    }
  } catch (e) {
    saveErrorLog({ event_type: 'SIMPLE_AUTO_TRADE_ERROR', error_message: e.message, stack_trace: e.stack, meta: { userId } });
  }
}

// ============================================================
// 스케줄러 관리 헬퍼
// ============================================================
function isSchedulerEnabled(key) {
  try {
    const row = db.prepare('SELECT enabled FROM schedulers WHERE key=?').get(key);
    return row ? row.enabled === 1 : true; // DB에 없으면 기본 활성
  } catch (e) { return true; }
}

function updateSchedulerRun(key) {
  try {
    db.prepare('UPDATE schedulers SET last_run=CURRENT_TIMESTAMP, run_count=run_count+1 WHERE key=?').run(key);
  } catch (e) { }
}

function getSchedulerInterval(key, defaultSec = 60) {
  try {
    const row = db.prepare('SELECT interval_sec FROM schedulers WHERE key=?').get(key);
    return (row?.interval_sec || defaultSec) * 1000;
  } catch (e) { return defaultSec * 1000; }
}

// ============================================================
// 자동매매 스케줄러
// ============================================================
function calcEMA(prices, period) { const k = 2 / (period + 1); let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period; for (let i = period; i < prices.length; i++)ema = prices[i] * k + ema * (1 - k); return ema; }
function calcMACD(closes) { if (closes.length < 35) return null; const macdLine = []; for (let i = 26; i <= closes.length; i++)macdLine.push(calcEMA(closes.slice(0, i), 12) - calcEMA(closes.slice(0, i), 26)); if (macdLine.length < 9) return null; const macd = macdLine[macdLine.length - 1], signal = calcEMA(macdLine, 9), prevMacd = macdLine[macdLine.length - 2], prevSignal = calcEMA(macdLine.slice(0, -1), 9); return { macd, signal, goldenCross: prevMacd < prevSignal && macd > signal, deadCross: prevMacd > prevSignal && macd < signal }; }
function calcRSI(closes, period = 14) { if (closes.length < period + 1) return null; const changes = closes.slice(1).map((c, i) => c - closes[i]); const avgGain = changes.slice(-period).filter(c => c > 0).reduce((a, b) => a + b, 0) / period; const avgLoss = changes.slice(-period).filter(c => c < 0).reduce((a, b) => a - b, 0) / period; return avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)); }

// trade_log 저장 헬퍼 — frontDeps 로 export 되어 routes/front.js 에서도 사용
function saveTradeLog({ user_id, trade_type, symbol, action, qty, price, reason, order_id, profit_pct, status, broker_key_id }) {
  order_id = order_id || '';
  profit_pct = profit_pct || 0;
  reason = reason || '';
  status = status || 'active';
  broker_key_id = broker_key_id || null;
  const result = db.prepare(
    'INSERT INTO trade_log (user_id,trade_type,symbol,action,qty,price,reason,order_id,profit_pct,status,broker_key_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).run(user_id, trade_type, symbol, action, qty, price, reason, order_id, profit_pct, status, broker_key_id);
  return result.lastInsertRowid;
}

// trade_log + 백업 테이블 status 동시 UPDATE (BUY 포지션 청산 시 active → closed)
function updateTradeLogStatus(user_id, symbol, trade_type) {
  const backupTableMap = { 1: 'trade_log_manual', 2: 'trade_log_simple', 3: 'trade_log_full', 4: 'trade_log_general' };
  db.prepare(
    "UPDATE trade_log SET status='closed' WHERE user_id=? AND symbol=? AND trade_type=? AND action='BUY' AND status='active'"
  ).run(user_id, symbol, trade_type);
  const backupTable = backupTableMap[trade_type];
  if (backupTable) {
    try {
      db.prepare(
        `UPDATE ${backupTable} SET status='closed' WHERE user_id=? AND symbol=? AND action='BUY' AND status='active'`
      ).run(user_id, symbol);
    } catch (e) { console.error('[updateTradeLogStatus] 백업 업데이트 실패:', backupTable, e.message); }
  }
}

async function runAutoTradeForUser(userId, brokerKeyId = null) {
  const settings = brokerKeyId
    ? db.prepare('SELECT * FROM trade_setting_type4 WHERE user_id=? AND broker_key_id=? AND enabled=1').get(userId, brokerKeyId)
    : db.prepare('SELECT * FROM trade_setting_type4 WHERE user_id=? AND enabled=1 ORDER BY broker_key_id DESC LIMIT 1').get(userId);
  if (!settings) return { ok: false, message: '자동매매 비활성화 상태' };
  const keys = getUserAlpacaKeys(userId, settings.broker_key_id || null);
  if (!keys) return { ok: false, message: 'Alpaca 키 없음 (자동매매 전용 계좌를 등록해주세요)' };
  const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
  const headers = { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key, 'Content-Type': 'application/json' };
  const results = [];
  try {
    const buyingPower = parseFloat((await (await fetch(`${baseUrl}/v2/account`, { headers })).json()).buying_power) || 0;
    const posData = await (await fetch(`${baseUrl}/v2/positions`, { headers })).json();
    const positions = Array.isArray(posData) ? posData : (posData.positions || []);
    // ✅ trade_type=4로 매수한 종목만 익절/손절 대상 (수동/다른 자동매매 포지션 보호)
    const type4Symbols = new Set(db.prepare("SELECT DISTINCT symbol FROM trade_log WHERE user_id=? AND trade_type=4 AND broker_key_id=? AND action='BUY' AND status='active'").all(userId, keys.id).map(r => r.symbol));
    for (const pos of positions.filter(p => type4Symbols.has(p.symbol))) {
      const plPct = parseFloat(pos.unrealized_plpc) || 0;
      // 매수 기준으로 중복 매도 방지
      const buyLog = db.prepare("SELECT created_at FROM trade_log WHERE user_id=? AND symbol=? AND trade_type=4 AND action='BUY' AND status='active' ORDER BY created_at DESC LIMIT 1").get(userId, pos.symbol);
      const buyTime = buyLog?.created_at || '1970-01-01';
      if (plPct >= (settings.take_profit || 0.05)) {
        const existing = db.prepare("SELECT id FROM trade_log WHERE user_id=? AND symbol=? AND trade_type=4 AND action='SELL_PROFIT' AND created_at>?").get(userId, pos.symbol, buyTime);
        if (!existing) {
          try {
            const order = await (await fetch(`${baseUrl}/v2/orders`, { method: 'POST', headers, body: JSON.stringify({ symbol: pos.symbol, qty: pos.qty, side: 'sell', type: 'market', time_in_force: 'day' }) })).json();
            // [레거시 제거] auto_trade_log SELL_PROFIT 제거
            saveTradeLog({ user_id: userId, trade_type: 4, symbol: pos.symbol, action: 'SELL_PROFIT', qty: pos.qty, price: pos.current_price, reason: `익절 +${(plPct * 100).toFixed(2)}%`, order_id: order.id || '', profit_pct: plPct * 100, status: 'closed', broker_key_id: keys.id });
            updateTradeLogStatus(userId, pos.symbol, 4);
            results.push({ symbol: pos.symbol, action: '익절 매도' });
          } catch (e) { }
        }
      } else if (plPct <= -(settings.stop_loss || 0.05)) {
        const existing = db.prepare("SELECT id FROM trade_log WHERE user_id=? AND symbol=? AND trade_type=4 AND action='SELL_LOSS' AND created_at>?").get(userId, pos.symbol, buyTime);
        if (!existing) {
          try {
            const order = await (await fetch(`${baseUrl}/v2/orders`, { method: 'POST', headers, body: JSON.stringify({ symbol: pos.symbol, qty: pos.qty, side: 'sell', type: 'market', time_in_force: 'day' }) })).json();
            // [레거시 제거] auto_trade_log SELL_LOSS 제거
            saveTradeLog({ user_id: userId, trade_type: 4, symbol: pos.symbol, action: 'SELL_LOSS', qty: pos.qty, price: pos.current_price, reason: `손절 ${(plPct * 100).toFixed(2)}%`, order_id: order.id || '', profit_pct: plPct * 100, status: 'closed', broker_key_id: keys.id });
            updateTradeLogStatus(userId, pos.symbol, 4);
            results.push({ symbol: pos.symbol, action: '손절 매도' });
          } catch (e) { }
        }
      }
    }
    const heldSymbols = new Set(positions.map(p => p.symbol));
    // ✅ 수동 보유 종목(trade_type=1)은 자동매매 대상에서 제외
    const manualHeld = db.prepare("SELECT DISTINCT symbol FROM trade_log WHERE user_id=? AND trade_type=1 AND action='BUY' AND status='active'").all(userId).map(r => r.symbol);
    manualHeld.forEach(s => heldSymbols.add(s));
    const autoHeld = db.prepare("SELECT DISTINCT symbol FROM trade_log WHERE user_id=? AND trade_type=4 AND broker_key_id=? AND action='BUY' AND status='active'").all(userId, keys.id).map(r => r.symbol);
    const needMore = (settings.max_positions || 3) - autoHeld.filter(s => heldSymbols.has(s)).length;

    // ── 1단계: 팩터 스크리닝으로 candidatePool 동적 생성 ──────────
    let candidatePool = [];
    try {
      const factorStrategy = settings.factor_strategy || 'value_quality';
      const factorMarket = settings.factor_market || 'nasdaq';
      const screenRes = await fetch('http://localhost:5002/api/quant/integrated-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: factorStrategy, market: factorMarket, top_n: 10, final_n: 10 })
      });
      if (screenRes.ok) {
        const screenData = await screenRes.json();
        // BUY 신호 종목 우선, WATCH 포함
        const factorSymbols = (screenData.results || [])
          .filter(r => r.timing === 'BUY' || r.timing === 'WATCH')
          .map(r => r.symbol);
        if (factorSymbols.length > 0) candidatePool = factorSymbols;
      }
    } catch (e) {
      saveErrorLog({ event_type: 'FACTOR_SCREEN_ERROR', error_message: e.message, stack_trace: e.stack, meta: { userId } });
    }
    // 팩터 스크리닝 실패 시 기존 방식 폴백
    if (candidatePool.length === 0) {
      candidatePool = [...new Set([
        ...(settings.symbols || 'QQQ,SPY,AAPL').split(','),
        ...(settings.candidate_symbols || 'QQQ,SPY,AAPL,NVDA,MSFT,GOOGL,AMZN,TSLA,META,AMD').split(',')
      ].map(s => s.trim()).filter(Boolean))];
    }

    // ── 2단계: MACD/RSI 타이밍 체크 후 매수 ─────────────────────
    // needMore: 실제 포지션 기준으로 재계산 (DB status 불일치 방지)
    const currentHeldCount = positions.filter(p => heldSymbols.has(p.symbol)).length;
    const needMoreFixed = Math.max(0, (settings.max_positions || 3) - currentHeldCount);
    let remainingBuyPower = buyingPower; // 매수마다 차감
    let boughtCount = 0;
    for (const symbol of candidatePool) {
      const buyAmount = remainingBuyPower * (settings.balance_ratio || 0.1);
      if (boughtCount >= needMoreFixed || heldSymbols.has(symbol) || buyAmount < 10) continue;
      try {
        const end = new Date().toISOString().split('T')[0], start = new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const bars = (await (await fetch(`https://data.alpaca.markets/v2/stocks/${symbol}/bars?timeframe=1Day&start=${start}&end=${end}&limit=250`, { headers })).json()).bars || [];
        if (bars.length < 35) continue;
        const closes = bars.map(b => b.c), currentPrice = closes[closes.length - 1];
        let buySignal = false, reason = '';
        // MACD 골든크로스 체크
        const m = calcMACD(closes);
        if (m?.goldenCross) { buySignal = true; reason = '팩터+MACD 골든크로스'; }
        // RSI 과매도 체크 (MACD 미충족 시)
        if (!buySignal) { const rsi = calcRSI(closes); if (rsi && rsi < 40) { buySignal = true; reason = `팩터+RSI 과매도 (${rsi.toFixed(1)})`; } }
        if (buySignal && currentPrice > 0) {
          const qty = Math.floor(buyAmount / currentPrice);
          if (qty < 1) { console.log(`[자동매매] ${symbol} 매수 스킵: 1주 미만 (buyAmount=$${buyAmount.toFixed(0)}, price=$${currentPrice})`); continue; }
          // ✅ 잔고 재확인 (동시 다발 매수 시 잔고 초과 방지)
          if (qty * currentPrice > remainingBuyPower) { console.log(`[자동매매] ${symbol} 매수 스킵: 잔고 부족`); continue; }
          // ✅ 이미 보유 중 재확인 (포지션 조회와 DB 불일치 방지)
          const alreadyHeld = db.prepare("SELECT id FROM trade_log WHERE user_id=? AND symbol=? AND broker_key_id=? AND action='BUY' AND status='active'").get(userId, symbol, keys.id);
          if (alreadyHeld) { heldSymbols.add(symbol); continue; }
          const order = await (await fetch(`${baseUrl}/v2/orders`, { method: 'POST', headers, body: JSON.stringify({ symbol, qty: String(qty), side: 'buy', type: 'market', time_in_force: 'day' }) })).json();
          if (order.id) {
            saveTradeLog({ user_id: userId, trade_type: 4, symbol, action: 'BUY', qty, price: currentPrice, reason, order_id: order.id, profit_pct: 0, status: 'active', broker_key_id: keys.id });
            results.push({ symbol, action: '매수', qty, reason });
            boughtCount++;
            remainingBuyPower -= qty * currentPrice;
            heldSymbols.add(symbol);
          } else {
            // 주문 실패 시 로그
            saveErrorLog({ event_type: 'AUTO_TRADE_ORDER_FAIL', error_message: order.message || JSON.stringify(order), meta: { symbol, qty, userId } });
          }
        }
      } catch (e) { saveErrorLog({ event_type: 'AUTO_TRADE_ERROR', error_message: e.message, stack_trace: e.stack, meta: { symbol, userId } }); }
    }
  } catch (e) { return { ok: false, message: e.message }; }

  // 체결 내역 있을 때만 메일 발송
  if (results.length > 0) {
    try {
      const userRow = db.prepare('SELECT email FROM users WHERE id=?').get(userId);
      if (userRow?.email) {
        const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        const rowsHtml = results.map(r => {
          const isBuy = r.action === '매수';
          const isTakeProfit = r.action === '익절 매도';
          const color = isBuy ? '#10b981' : isTakeProfit ? '#6366f1' : '#ef4444';
          const icon = isBuy ? '🟢' : isTakeProfit ? '✅' : '🔴';
          return `<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:10px 14px;font-weight:700;color:${color};">${icon} ${r.action}</td><td style="padding:10px 14px;font-weight:700;">${r.symbol}</td><td style="padding:10px 14px;color:#6b7280;">${r.qty ? r.qty + '주' : '-'}</td><td style="padding:10px 14px;color:#6b7280;font-size:0.85rem;">${r.reason || '-'}</td></tr>`;
        }).join('');
        await sendMail({
          to: userRow.email,
          subject: `📈 자동매매 체결 알림 — ${results.length}건 (${now})`,
          html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;"><div style="background:#1e293b;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;"><h2 style="margin:0;font-size:1.15rem;">📈 자동매매 체결 알림</h2><p style="margin:6px 0 0;opacity:0.7;font-size:0.85rem;">${now}</p></div><div style="background:#fff;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;overflow:hidden;"><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb;"><th style="padding:10px 14px;text-align:left;font-size:0.82rem;color:#6b7280;">구분</th><th style="padding:10px 14px;text-align:left;font-size:0.82rem;color:#6b7280;">종목</th><th style="padding:10px 14px;text-align:left;font-size:0.82rem;color:#6b7280;">수량</th><th style="padding:10px 14px;text-align:left;font-size:0.82rem;color:#6b7280;">사유</th></tr></thead><tbody>${rowsHtml}</tbody></table></div><p style="color:#9ca3af;font-size:0.78rem;text-align:center;margin-top:12px;">이 메일은 자동매매 체결 시 자동 발송됩니다.</p></div>`
        });
      }
    } catch (e) { saveErrorLog({ event_type: 'AUTO_TRADE_MAIL_ERROR', error_message: e.message, stack_trace: e.stack, meta: { userId } }); }
  }

  return { ok: true, results, message: results.length ? `${results.length}건 실행` : '신호 없음' };
}

setInterval(async () => {
  try {
    if (!isSchedulerEnabled('auto_trade')) return;
    const now = new Date(), utcHour = now.getUTCHours(), utcMin = now.getUTCMinutes();
    const isMarketHours = (utcHour === 14 && utcMin >= 30) || (utcHour > 14 && utcHour < 21);
    if (!isMarketHours) return;
    updateSchedulerRun('auto_trade');
    const users = db.prepare('SELECT ts.user_id, ts.broker_key_id, ubk.account_type FROM trade_setting_type4 ts LEFT JOIN user_broker_keys ubk ON ts.broker_key_id=ubk.id WHERE ts.enabled=1').all();
    for (const u of users) await runAutoTradeForUser(u.user_id, u.broker_key_id);
  } catch (e) { saveErrorLog({ event_type: 'AUTO_TRADE_SCHEDULER_ERROR', error_message: e.message, stack_trace: e.stack }); }
}, 60 * 1000);

// 단순 자동매매 스케줄러 (1분마다)
setInterval(async () => {
  try {
    if (!isSchedulerEnabled('simple_trade')) return;
    const now = new Date();
    const utcHour = now.getUTCHours(), utcMin = now.getUTCMinutes();
    const isMarketHours = (utcHour === 14 && utcMin >= 30) || (utcHour > 14 && utcHour < 21);
    // 장 종료 후 closed_today → idle 자동 리셋 (KST 다음날 오전 6시 = UTC 21:00)
    if (utcHour === 21 && utcMin === 0) {
      db.prepare("UPDATE trade_setting_type2 SET status='idle' WHERE status='closed_today'").run();
    }
    if (!isMarketHours) return;
    updateSchedulerRun('simple_trade');
    const users = db.prepare('SELECT ts.user_id, ts.broker_key_id, ubk.account_type FROM trade_setting_type2 ts LEFT JOIN user_broker_keys ubk ON ts.broker_key_id=ubk.id WHERE ts.enabled=1').all();
    for (const u of users) await runSimpleAutoTrade(u.user_id, u.broker_key_id);
  } catch (e) { saveErrorLog({ event_type: 'SIMPLE_AUTO_TRADE_SCHEDULER_ERROR', error_message: e.message, stack_trace: e.stack }); }
}, 60 * 1000);

// ============================================================
// 백테스팅 API
// ============================================================

// 주가 히스토리 조회 (stock_server.py 프록시)
app.get('/api/backtest/history', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  try {
    const { symbol, start, end } = req.query;
    const params = new URLSearchParams({ symbol, ...(start && { start }), ...(end && { end }) });
    const r = await fetch(`http://localhost:5001/api/stock/history?${params}`);
    const data = await r.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: '주가 데이터 조회 실패: ' + e.message }); }
});

// 워치리스트 조회/추가/삭제
app.get('/api/backtest/watchlist', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  try {
    const r = await fetch('http://localhost:5001/api/stock/watchlist');
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/backtest/watchlist', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  try {
    const r = await fetch('http://localhost:5001/api/stock/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) });
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/backtest/watchlist/:symbol', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  try {
    const r = await fetch(`http://localhost:5001/api/stock/watchlist/${req.params.symbol}`, { method: 'DELETE' });
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 초기 데이터 수집
app.post('/api/backtest/init', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  try {
    const r = await fetch('http://localhost:5001/api/stock/init-history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) });
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 백테스팅 실행 API
app.post('/api/backtest/run', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  try {
    const { symbol, start, end, strategy = 'combined', initialCash = 10000, takeProfit = 0.05, stopLoss = 0.05 } = req.body;

    // 주가 데이터 가져오기
    const params = new URLSearchParams({ symbol, ...(start && { start }), ...(end && { end }) });
    const r = await fetch(`http://localhost:5001/api/stock/history?${params}`);
    const stockData = await r.json();
    if (!stockData.data || stockData.data.length < 35) return res.status(400).json({ error: '데이터 부족 (최소 35일 필요)' });

    const closes = stockData.data.map(d => d.close);
    const dates = stockData.data.map(d => d.date);

    // ── 지표 계산 함수 ─────────────────────────────────
    function calcEMA(prices, period) {
      const k = 2 / (period + 1);
      let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const result = new Array(period - 1).fill(null);
      result.push(ema);
      for (let i = period; i < prices.length; i++) { ema = prices[i] * k + ema * (1 - k); result.push(ema); }
      return result;
    }

    function calcMACD(closes) {
      const ema12 = calcEMA(closes, 12);
      const ema26 = calcEMA(closes, 26);
      const macdLine = closes.map((_, i) => ema12[i] !== null && ema26[i] !== null ? ema12[i] - ema26[i] : null);
      const validMacd = macdLine.filter(v => v !== null);
      const signalRaw = calcEMA(validMacd, 9);
      const signal = new Array(macdLine.length).fill(null);
      let si = 0;
      for (let i = 0; i < macdLine.length; i++) { if (macdLine[i] !== null) { signal[i] = signalRaw[si++]; } }
      return { macdLine, signal };
    }

    function calcRSI(closes, period = 14) {
      const result = new Array(period).fill(null);
      for (let i = period; i < closes.length; i++) {
        const slice = closes.slice(i - period, i + 1);
        const changes = slice.slice(1).map((c, j) => c - slice[j]);
        const gains = changes.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
        const losses = changes.filter(c => c < 0).reduce((a, b) => a - b, 0) / period;
        result.push(losses === 0 ? 100 : 100 - (100 / (1 + gains / losses)));
      }
      return result;
    }

    // ── 백테스팅 시뮬레이션 ────────────────────────────
    const { macdLine, signal } = calcMACD(closes);
    const rsi = calcRSI(closes);

    let cash = initialCash;
    let shares = 0;
    let entryPrice = 0;
    const trades = [];
    const equity = [];

    for (let i = 1; i < closes.length; i++) {
      const price = closes[i];
      const currentEquity = cash + shares * price;
      equity.push({ date: dates[i], value: Math.round(currentEquity * 100) / 100 });

      // 매수 신호
      if (shares === 0) {
        let buySignal = false;
        if ((strategy === 'macd' || strategy === 'combined') && macdLine[i] !== null && signal[i] !== null && macdLine[i - 1] !== null && signal[i - 1] !== null) {
          if (macdLine[i - 1] < signal[i - 1] && macdLine[i] > signal[i]) buySignal = true;
        }
        if ((strategy === 'rsi' || strategy === 'combined') && rsi[i] !== null && rsi[i] < 35) buySignal = true;

        if (buySignal && cash > price) {
          shares = Math.floor(cash / price);
          entryPrice = price;
          cash -= shares * price;
          trades.push({ date: dates[i], type: 'BUY', price, shares, reason: macdLine[i] > signal[i] ? 'MACD 골든크로스' : 'RSI 과매도' });
        }
      }

      // 매도 신호 (익절/손절)
      if (shares > 0) {
        const plPct = (price - entryPrice) / entryPrice;
        let sellReason = null;
        if (plPct >= takeProfit) sellReason = `익절 +${(plPct * 100).toFixed(1)}%`;
        else if (plPct <= -stopLoss) sellReason = `손절 ${(plPct * 100).toFixed(1)}%`;

        // MACD 데드크로스
        if (!sellReason && (strategy === 'macd' || strategy === 'combined') && macdLine[i] !== null && signal[i] !== null && macdLine[i - 1] !== null && signal[i - 1] !== null) {
          if (macdLine[i - 1] > signal[i - 1] && macdLine[i] < signal[i]) sellReason = 'MACD 데드크로스';
        }

        if (sellReason) {
          const profit = (price - entryPrice) * shares;
          cash += shares * price;
          trades.push({ date: dates[i], type: 'SELL', price, shares, profit: Math.round(profit * 100) / 100, profitPct: Math.round((price - entryPrice) / entryPrice * 10000) / 100, reason: sellReason });
          shares = 0; entryPrice = 0;
        }
      }
    }

    // 마지막 보유 청산
    if (shares > 0) {
      const lastPrice = closes[closes.length - 1];
      const profit = (lastPrice - entryPrice) * shares;
      cash += shares * lastPrice;
      trades.push({ date: dates[dates.length - 1], type: 'SELL', price: lastPrice, shares, profit: Math.round(profit * 100) / 100, profitPct: Math.round((lastPrice - entryPrice) / entryPrice * 10000) / 100, reason: '기간 종료' });
    }

    // ── 성과 분석 ──────────────────────────────────────
    const finalValue = cash;
    const totalReturn = (finalValue - initialCash) / initialCash * 100;

    // MDD 계산
    let peak = initialCash, mdd = 0;
    equity.forEach(e => {
      if (e.value > peak) peak = e.value;
      const dd = (peak - e.value) / peak * 100;
      if (dd > mdd) mdd = dd;
    });

    // 샤프 비율
    const returns = equity.slice(1).map((e, i) => (e.value - equity[i].value) / equity[i].value);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdReturn = Math.sqrt(returns.map(r => Math.pow(r - avgReturn, 2)).reduce((a, b) => a + b, 0) / returns.length);
    const sharpeRatio = stdReturn > 0 ? Math.round((avgReturn / stdReturn) * Math.sqrt(252) * 100) / 100 : 0;

    // 승률
    const sellTrades = trades.filter(t => t.type === 'SELL' && t.profit !== undefined);
    const winRate = sellTrades.length > 0 ? Math.round(sellTrades.filter(t => t.profit > 0).length / sellTrades.length * 100) : 0;

    // Buy & Hold 수익률 비교
    const buyHoldReturn = (closes[closes.length - 1] - closes[0]) / closes[0] * 100;

    res.json({
      symbol, strategy, start: dates[0], end: dates[dates.length - 1],
      performance: {
        initialCash, finalValue: Math.round(finalValue * 100) / 100,
        totalReturn: Math.round(totalReturn * 100) / 100,
        mdd: Math.round(mdd * 100) / 100,
        sharpeRatio,
        winRate,
        totalTrades: sellTrades.length,
        buyHoldReturn: Math.round(buyHoldReturn * 100) / 100
      },
      trades,
      equity
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// 메일 발송 API
// ============================================================

// 퀀트 분석 결과 메일 발송
app.post('/api/mail/quant-result', async (req, res) => {
  try {
    const { symbol, signal, price, value, reason, strategy, indicators } = req.body;
    const userRow = db.prepare('SELECT email FROM users WHERE id=?').get(req.user.id);
    if (!userRow?.email) return res.status(400).json({ error: '이메일이 등록되지 않은 계정입니다.' });
    const signalLabels = { buy: '🟢 매수', weak_buy: '🔵 약매수', hold: '⚪ 중립', weak_sell: '🟡 약매도', sell: '🔴 매도' };
    const signalColors = { buy: '#10b981', weak_buy: '#6366f1', hold: '#9ca3af', weak_sell: '#f59e0b', sell: '#ef4444' };
    const label = signalLabels[signal] || signal;
    const color = signalColors[signal] || '#6b7280';
    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const indHtml = indicators ? Object.entries(indicators).map(([k, v]) =>
      `<tr><td style="padding:6px 12px;color:#6b7280;font-size:0.85rem;">${k}</td><td style="padding:6px 12px;font-weight:600;">${typeof v === 'number' ? v.toFixed(3) : v}</td></tr>`
    ).join('') : '';
    await sendMail({
      to: userRow.email,
      subject: `📊 퀀트 분석 결과 — ${symbol} ${label}`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;"><div style="background:#1e293b;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;"><h2 style="margin:0;font-size:1.15rem;">📊 퀀트 분석 결과</h2><p style="margin:6px 0 0;opacity:0.7;font-size:0.85rem;">${now}</p></div><div style="background:#fff;border:1px solid #e5e7eb;padding:20px 24px;border-radius:0 0 12px 12px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><span style="font-size:1.4rem;font-weight:800;color:#6366f1;">${symbol}</span><span style="font-size:1.1rem;font-weight:700;color:${color};">${label}</span></div><table style="width:100%;border-collapse:collapse;margin-bottom:12px;"><tr><td style="padding:6px 0;color:#6b7280;font-size:0.85rem;">전략</td><td style="padding:6px 0;font-weight:600;">${(strategy || '').toUpperCase()}</td></tr><tr><td style="padding:6px 0;color:#6b7280;font-size:0.85rem;">현재가</td><td style="padding:6px 0;font-weight:600;">$${price?.toFixed(2) || '-'}</td></tr><tr><td style="padding:6px 0;color:#6b7280;font-size:0.85rem;">지표값</td><td style="padding:6px 0;font-weight:600;">${value?.toFixed(2) || '-'}</td></tr><tr><td style="padding:6px 0;color:#6b7280;font-size:0.85rem;">분석 요약</td><td style="padding:6px 0;">${reason || '-'}</td></tr></table>${indHtml ? `<hr style="border:none;border-top:1px solid #f3f4f6;margin:12px 0;"/><p style="font-size:0.82rem;color:#9ca3af;margin:0 0 8px;">세부 지표</p><table style="width:100%;border-collapse:collapse;">${indHtml}</table>` : ''}</div><p style="color:#9ca3af;font-size:0.78rem;text-align:center;margin-top:12px;">이 메일은 퀀트 분석 결과 공유 시 발송됩니다.</p></div>`
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// 완전자동매매 스케줄러 (1분마다 + 월 1회 리밸런싱)
// ============================================================
async function runAutoStrategy(userId, brokerKeyId = null) {
  const s = brokerKeyId
    ? db.prepare('SELECT * FROM trade_setting_type3 WHERE user_id=? AND broker_key_id=? AND enabled=1').get(userId, brokerKeyId)
    : db.prepare('SELECT * FROM trade_setting_type3 WHERE user_id=? AND enabled=1 ORDER BY broker_key_id DESC LIMIT 1').get(userId);
  if (!s) return;
  const keys = getUserAlpacaKeys(userId, s.broker_key_id || null);
  if (!keys) return;
  const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
  const headers = { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key, 'Content-Type': 'application/json' };

  try {
    // ── 월 1회 리밸런싱 체크 ──────────────────────────────
    const now = new Date();
    const lastRebal = s.last_rebalanced_at ? new Date(s.last_rebalanced_at) : null;
    const needRebal = !lastRebal || (now.getMonth() !== lastRebal.getMonth() || now.getFullYear() !== lastRebal.getFullYear());

    if (needRebal) {
      // 팩터 스크리닝으로 풀 갱신
      try {
        const screenRes = await fetch('http://localhost:5002/api/quant/factor-screen', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strategy: 'momentum_ma', market: s.market || 'nasdaq', top_n: 10 })
        });
        if (screenRes.ok) {
          const screenData = await screenRes.json();
          const pool = (screenData.top || []).filter(item => {
            if (item.roe && item.roe < s.roe_min) return false;
            if (item.debt_to_equity && item.debt_to_equity > s.debt_max) return false;
            if (item.revenue_growth && item.revenue_growth < s.revenue_min) return false;
            if (s.sma200_filter && item.above_sma200 === 0) return false;
            return true;
          });
          // 풀 업데이트
          db.prepare('DELETE FROM trade_pool_type3 WHERE user_id=?').run(userId);
          pool.forEach(item => {
            db.prepare('INSERT OR REPLACE INTO trade_pool_type3 (user_id, symbol, factor_score) VALUES (?,?,?)').run(userId, item.symbol, item.factor_score);
          });
          // 팩터 이탈 종목 매도
          if (s.factor_exit) {
            const poolSymbols = new Set(pool.map(i => i.symbol));
            const positions = await (await fetch(`${baseUrl}/v2/positions`, { headers })).json();
            // ✅ trade_type=3로 매수한 종목만 팩터이탈 매도 대상 (수동/다른 자동매매 포지션 보호)
            const type3ActiveSymbols = new Set(db.prepare("SELECT DISTINCT symbol FROM trade_log WHERE user_id=? AND trade_type=3 AND broker_key_id=? AND action='BUY' AND status='active'").all(userId, keys.id).map(r => r.symbol));
            for (const pos of (Array.isArray(positions) ? positions : []).filter(p => type3ActiveSymbols.has(p.symbol))) {
              if (!poolSymbols.has(pos.symbol)) {
                await fetch(`${baseUrl}/v2/orders`, { method: 'POST', headers, body: JSON.stringify({ symbol: pos.symbol, qty: pos.qty, side: 'sell', type: 'market', time_in_force: 'day' }) });
                saveTradeLog({ user_id: userId, trade_type: 3, symbol: pos.symbol, action: 'SELL_FACTOR', qty: pos.qty, price: pos.current_price, reason: '퀀트전략:팩터 이탈 매도', status: 'closed', broker_key_id: keys.id });
              }
            }
          }
          // 풀에 종목이 있을 때만 리밸런싱 완료 처리 (스크리닝 실패 시 재시도 보장)
          if (pool.length > 0) {
            db.prepare('UPDATE trade_setting_type3 SET last_rebalanced_at=? WHERE user_id=? AND broker_key_id IS ?').run(now.toISOString(), userId, s.broker_key_id || null);
          } else {
            console.log(`[완전자동] userId=${userId} 팩터 스크리닝 결과 없음 — 다음 실행 시 재시도`);
          }
        }
      } catch (e) { saveErrorLog({ event_type: 'AUTO_STRATEGY_REBAL_ERROR', error_message: e.message, stack_trace: e.stack, meta: { userId } }); }
    }

    // ── 매수/매도 체크 ────────────────────────────────────
    const account = await (await fetch(`${baseUrl}/v2/account`, { headers })).json();
    const buyingPower = parseFloat(account.buying_power) || 0;
    const positions = await (await fetch(`${baseUrl}/v2/positions`, { headers })).json();
    const posList = Array.isArray(positions) ? positions : [];

    // 익절/손절 체크 (else if로 중복 실행 방지)
    const type3Symbols = new Set(db.prepare("SELECT DISTINCT symbol FROM trade_log WHERE user_id=? AND trade_type=3 AND broker_key_id=? AND action='BUY' AND status='active'").all(userId, keys.id).map(r => r.symbol));
    for (const pos of posList.filter(p => type3Symbols.has(p.symbol))) {
      const plPct = parseFloat(pos.unrealized_plpc) || 0;
      const currentPrice = parseFloat(pos.current_price);
      const qty = parseFloat(pos.qty);

      // 매수 기준으로 1차/2차 익절 중복 방지 (BUY 로그의 created_at 이후)
      const buyLog = db.prepare("SELECT created_at FROM trade_log WHERE user_id=? AND symbol=? AND trade_type=4 AND action='BUY' AND status='active' ORDER BY created_at DESC LIMIT 1").get(userId, pos.symbol);
      const buyTime = buyLog?.created_at || '1970-01-01';

      // 2차 익절 (전량 매도) — 1차보다 먼저 체크해서 else if로 1차 건너뜀
      if (plPct >= s.take_profit2) {
        const existing2 = db.prepare("SELECT id FROM trade_log WHERE user_id=? AND symbol=? AND trade_type=3 AND action='SELL_PROFIT2' AND created_at>?").get(userId, pos.symbol, buyTime);
        if (!existing2) {
          await fetch(`${baseUrl}/v2/orders`, { method: 'POST', headers, body: JSON.stringify({ symbol: pos.symbol, qty: pos.qty, side: 'sell', type: 'market', time_in_force: 'day' }) });
          // [레거시 제거] auto_trade_log SELL_PROFIT2 제거
          saveTradeLog({ user_id: userId, trade_type: 3, symbol: pos.symbol, action: 'SELL_PROFIT2', qty, price: currentPrice, reason: `퀀트전략:2차 익절 +${(plPct * 100).toFixed(2)}%`, profit_pct: plPct * 100, status: 'closed', broker_key_id: keys.id });
          updateTradeLogStatus(userId, pos.symbol, 3);
        }
        // 1차 익절 (절반 매도) — 2차 미달 시만 실행
      } else if (plPct >= s.take_profit1) {
        const halfQty = Math.floor(qty / 2);
        if (halfQty >= 1) {
          const existing1 = db.prepare("SELECT id FROM trade_log WHERE user_id=? AND symbol=? AND trade_type=3 AND action='SELL_PROFIT1' AND created_at>?").get(userId, pos.symbol, buyTime);
          if (!existing1) {
            await fetch(`${baseUrl}/v2/orders`, { method: 'POST', headers, body: JSON.stringify({ symbol: pos.symbol, qty: String(halfQty), side: 'sell', type: 'market', time_in_force: 'day' }) });
            // [레거시 제거] auto_trade_log SELL_PROFIT1 제거
            saveTradeLog({ user_id: userId, trade_type: 3, symbol: pos.symbol, action: 'SELL_PROFIT1', qty: halfQty, price: currentPrice, reason: `퀀트전략:1차 익절 +${(plPct * 100).toFixed(2)}%`, profit_pct: plPct * 100, status: 'closed', broker_key_id: keys.id });
          }
        }
        // 손절 — 익절 조건 미달 시만 실행
      } else if (plPct <= -s.stop_loss) {
        const existingStop = db.prepare("SELECT id FROM trade_log WHERE user_id=? AND symbol=? AND trade_type=3 AND action='SELL_STOP' AND created_at>?").get(userId, pos.symbol, buyTime);
        if (!existingStop) {
          await fetch(`${baseUrl}/v2/orders`, { method: 'POST', headers, body: JSON.stringify({ symbol: pos.symbol, qty: pos.qty, side: 'sell', type: 'market', time_in_force: 'day' }) });
          // [레거시 제거] auto_trade_log SELL_STOP 제거
          saveTradeLog({ user_id: userId, trade_type: 3, symbol: pos.symbol, action: 'SELL_STOP', qty, price: currentPrice, reason: `퀀트전략:손절 ${(plPct * 100).toFixed(2)}%`, profit_pct: plPct * 100, status: 'closed', broker_key_id: keys.id });
          updateTradeLogStatus(userId, pos.symbol, 3);
        }
      }
    }

    // 매수 체크 (풀에서 타이밍 조건 확인)
    const heldSymbols = new Set(posList.map(p => p.symbol));
    // ✅ 수동 보유 종목(trade_type=1)은 자동매매 대상에서 제외
    const manualHeldAS = db.prepare("SELECT DISTINCT symbol FROM trade_log WHERE user_id=? AND trade_type=1 AND action='BUY' AND status='active'").all(userId).map(r => r.symbol);
    manualHeldAS.forEach(s => heldSymbols.add(s));
    const pool = db.prepare('SELECT symbol FROM trade_pool_type3 WHERE user_id=? ORDER BY factor_score DESC').all(userId);
    const maxPos = s.max_positions || 5;
    let remainingBuyingPower = buyingPower; // 매수마다 차감하여 잔고 초과 방지

    for (const row of pool) {
      const buyAmount = remainingBuyingPower * s.balance_ratio;
      if (heldSymbols.size >= maxPos || heldSymbols.has(row.symbol) || buyAmount < 10) continue;
      try {
        const end = new Date().toISOString().split('T')[0];
        const start = new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 300일 (200일선 계산용)
        const bars = (await (await fetch(`https://data.alpaca.markets/v2/stocks/${row.symbol}/bars?timeframe=1Day&start=${start}&end=${end}&limit=250`, { headers })).json()).bars || [];
        if (bars.length < 35) continue;
        const closes = bars.map(b => b.c);
        const currentPrice = closes[closes.length - 1];

        // 타이밍 조건 체크
        let signals = 0;
        let reasons = [];
        if (s.use_macd) { const m = calcMACD(closes); if (m?.goldenCross) { signals++; reasons.push('MACD골든크로스'); } }
        if (s.use_rsi) { const rsi = calcRSI(closes); if (rsi && rsi < s.rsi_threshold) { signals++; reasons.push(`RSI${rsi.toFixed(0)}`); } }
        if (s.use_bb) {
          const mean = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
          const std = Math.sqrt(closes.slice(-20).map(c => (c - mean) ** 2).reduce((a, b) => a + b, 0) / 20);
          const lower = mean - 2 * std;
          if (currentPrice <= lower) { signals++; reasons.push('BB하단'); }
        }
        // 200일선 이탈 체크
        if (s.sma200_exit && closes.length >= 200) {
          const sma200 = closes.slice(-200).reduce((a, b) => a + b, 0) / 200;
          if (currentPrice < sma200) continue; // 200일선 아래면 매수 스킵
        }

        if (signals >= 2) {
          const qty = Math.floor(buyAmount / currentPrice);
          if (qty < 1) { console.log(`[완전자동] ${row.symbol} 매수 스킵: 1주 미만`); continue; }
          // ✅ 잔고 재확인
          if (qty * currentPrice > remainingBuyingPower) { console.log(`[완전자동] ${row.symbol} 매수 스킵: 잔고 부족`); continue; }
          // ✅ DB 이중 매수 방지
          const alreadyHeld = db.prepare("SELECT id FROM trade_log WHERE user_id=? AND symbol=? AND broker_key_id=? AND action='BUY' AND status='active'").get(userId, row.symbol, keys.id);
          if (alreadyHeld) { heldSymbols.add(row.symbol); continue; }
          const order = await (await fetch(`${baseUrl}/v2/orders`, { method: 'POST', headers, body: JSON.stringify({ symbol: row.symbol, qty: String(qty), side: 'buy', type: 'market', time_in_force: 'day' }) })).json();
          if (order.id) {
            saveTradeLog({ user_id: userId, trade_type: 3, symbol: row.symbol, action: 'BUY', qty, price: currentPrice, reason: `퀀트전략:3단계(${reasons.join('+')})`, order_id: order.id, status: 'active', broker_key_id: keys.id });
            heldSymbols.add(row.symbol);
            remainingBuyingPower -= qty * currentPrice;
          } else {
            saveErrorLog({ event_type: 'AUTO_STRATEGY_ORDER_FAIL', error_message: order.message || JSON.stringify(order), meta: { symbol: row.symbol, qty, userId } });
          }
        }
      } catch (e) { saveErrorLog({ event_type: 'AUTO_STRATEGY_BUY_ERROR', error_message: e.message, meta: { symbol: row.symbol, userId } }); }
    }
  } catch (e) { saveErrorLog({ event_type: 'AUTO_STRATEGY_ERROR', error_message: e.message, stack_trace: e.stack, meta: { userId } }); }
}

// 1분마다 완전자동매매 실행
setInterval(async () => {
  try {
    if (!isSchedulerEnabled('auto_strategy')) return;
    const now = new Date(); const utcHour = now.getUTCHours(); const utcMin = now.getUTCMinutes();
    const isMarketHours = (utcHour === 14 && utcMin >= 30) || (utcHour > 14 && utcHour < 21);
    if (!isMarketHours) return;
    updateSchedulerRun('auto_strategy');
    const users = db.prepare('SELECT ts.user_id, ts.broker_key_id, ubk.account_type FROM trade_setting_type3 ts LEFT JOIN user_broker_keys ubk ON ts.broker_key_id=ubk.id WHERE ts.enabled=1').all();
    for (const u of users) await runAutoStrategy(u.user_id, u.broker_key_id);
  } catch (e) { saveErrorLog({ event_type: 'AUTO_STRATEGY_SCHEDULER_ERROR', error_message: e.message, stack_trace: e.stack }); }
}, 60 * 1000);

// ============================================================
// 스케줄러 관리 시스템 (DB 기반, key로 관리)
// ============================================================
const schedulerTimers = {}; // { id: timer }

function startScheduler(id, intervalSec, fn) {
  if (schedulerTimers[id]) clearInterval(schedulerTimers[id]);
  schedulerTimers[id] = setInterval(async () => {
    try {
      await fn();
      db.prepare('UPDATE schedulers SET last_run=CURRENT_TIMESTAMP, run_count=run_count+1 WHERE id=?').run(id);
    } catch (e) {
      saveErrorLog({ event_type: 'SCHEDULER_ERROR', error_message: e.message, stack_trace: e.stack, meta: { schedulerId: id } });
    }
  }, intervalSec * 1000);
}

function stopScheduler(id) {
  if (schedulerTimers[id]) {
    clearInterval(schedulerTimers[id]);
    delete schedulerTimers[id];
  }
}

function initSchedulers() {
  const schedulers = db.prepare('SELECT * FROM schedulers').all();
  schedulers.forEach(s => {
    if (s.enabled) startScheduler(s.id, s.interval_sec, getSchedulerFn(s.id));
  });
}

function getSchedulerFn(id) {
  const fns = {
    2: autoTradeFn,
    3: simpleAutoTradeFn,
    4: autoStrategyFn,
  };
  return fns[id] || (() => { });
}

// 각 스케줄러 함수 정의
async function autoTradeFn() {
  const now = new Date();
  const utcHour = now.getUTCHours(), utcMin = now.getUTCMinutes();
  const isMarketHours = (utcHour === 14 && utcMin >= 30) || (utcHour > 14 && utcHour < 21);
  if (!isMarketHours) return;
  const users = db.prepare('SELECT ts.user_id, ts.broker_key_id, ubk.account_type FROM trade_setting_type4 ts LEFT JOIN user_broker_keys ubk ON ts.broker_key_id=ubk.id WHERE ts.enabled=1').all();
  for (const u of users) await runAutoTradeForUser(u.user_id, u.broker_key_id);
}

async function simpleAutoTradeFn() {
  const now = new Date();
  const utcHour = now.getUTCHours(), utcMin = now.getUTCMinutes();
  const isMarketHours = (utcHour === 14 && utcMin >= 30) || (utcHour > 14 && utcHour < 21);
  if (!isMarketHours) return;
  const users = db.prepare('SELECT ts.user_id, ts.broker_key_id, ubk.account_type FROM trade_setting_type2 ts LEFT JOIN user_broker_keys ubk ON ts.broker_key_id=ubk.id WHERE ts.enabled=1').all();
  for (const u of users) await runSimpleAutoTrade(u.user_id, u.broker_key_id);
}

async function autoStrategyFn() {
  const now = new Date();
  const utcHour = now.getUTCHours(), utcMin = now.getUTCMinutes();
  const isMarketHours = (utcHour === 14 && utcMin >= 30) || (utcHour > 14 && utcHour < 21);
  if (!isMarketHours) return;
  const users = db.prepare('SELECT ts.user_id, ts.broker_key_id, ubk.account_type FROM trade_setting_type3 ts LEFT JOIN user_broker_keys ubk ON ts.broker_key_id=ubk.id WHERE ts.enabled=1').all();
  for (const u of users) await runAutoStrategy(u.user_id, u.broker_key_id);
}

// ============================================================
// 서버 시작
// ============================================================
// 스케줄러 초기화
initSchedulers();

app.listen(port, '0.0.0.0', () => {
  console.log('');
  console.log(`${C.bright}${C.magenta}  ╔══════════════════════════════════╗${C.reset}`);
  console.log(`${C.bright}${C.magenta}  ║   🚀  spagenio  Dashboard        ║${C.reset}`);
  console.log(`${C.bright}${C.magenta}  ╚══════════════════════════════════╝${C.reset}`);
  console.log(`  ${C.cyan}포트${C.reset}     : ${C.white}${port}${C.reset}`);
  console.log('');
});
