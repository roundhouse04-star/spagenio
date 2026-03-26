import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3000);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ✅ SQLite DB 초기화
const dbPath = path.join(__dirname, 'news.db');
const db = new Database(dbPath);

// 테이블 생성
db.exec(`
  CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    saved_at TEXT NOT NULL,
    use_claude INTEGER DEFAULT 0,
    source TEXT DEFAULT 'rss',
    content TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_news_date ON news(date);
  CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);
  CREATE INDEX IF NOT EXISTS idx_news_use_claude ON news(use_claude);
  CREATE INDEX IF NOT EXISTS idx_news_source ON news(source);
`);

// users & invite_codes & email_verifications 테이블 추가
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );
  CREATE TABLE IF NOT EXISTS user_broker_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    account_name TEXT NOT NULL DEFAULT '기본 계좌',
    alpaca_api_key TEXT,
    alpaca_secret_key TEXT,
    alpaca_paper INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS terms_agreements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    agree_terms INTEGER DEFAULT 0,
    agree_privacy INTEGER DEFAULT 0,
    agree_investment INTEGER DEFAULT 0,
    agree_marketing INTEGER DEFAULT 0,
    ip TEXT,
    agreed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS email_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    verified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
  );
  CREATE TABLE IF NOT EXISTS invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    created_by INTEGER,
    used_by INTEGER,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
  );
`);

// 기본 관리자 계정 생성 (최초 1회)
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const defaultPassword = process.env.ADMIN_PASSWORD || 'admin1234!';
  const hash = bcrypt.hashSync(defaultPassword, 12);
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', hash);
  console.log('✅ 기본 관리자 계정 생성됨 (admin / admin1234!)');
  console.log('⚠️  보안을 위해 .env에 ADMIN_PASSWORD를 설정하세요!');
}

console.log('✅ SQLite DB 초기화 완료:', dbPath);

const JWT_SECRET = process.env.JWT_SECRET || 'ai-router-secret-key-change-this';

// ✅ 이메일 AES-256 암호화/복호화
const ENCRYPT_KEY = process.env.ENCRYPT_KEY || 'ai-router-encrypt-key-32chars!!';
const ENCRYPT_KEY_BUF = Buffer.from(ENCRYPT_KEY.slice(0, 32).padEnd(32, '0'));

function encryptEmail(email) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPT_KEY_BUF, iv);
  const encrypted = Buffer.concat([cipher.update(email, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptEmail(encrypted) {
  try {
    const [ivHex, dataHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPT_KEY_BUF, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (e) {
    return null;
  }
}

// 인증 코드 저장 (메모리)
const verifyCodeStore = new Map();

// ✅ Winston 로거 설정 (파일 + 콘솔)
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// ===== 컬러 터미널 로그 포맷 =====
const COLORS = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  blue: '\x1b[34m', cyan: '\x1b[36m', magenta: '\x1b[35m',
  gray: '\x1b[90m', white: '\x1b[37m', bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m', bgYellow: '\x1b[43m'
};
const C = COLORS;

const consoleFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const time = timestamp ? timestamp.slice(11, 19) : new Date().toTimeString().slice(0, 8);

  // 레벨별 색상
  const levelColors = {
    error: `${C.bright}${C.red}`,
    warn: `${C.bright}${C.yellow}`,
    info: `${C.cyan}`,
    debug: `${C.gray}`
  };
  const lc = levelColors[level] || C.white;
  const levelStr = `${lc}${level.toUpperCase().padEnd(5)}${C.reset}`;

  // 이벤트 타입별 아이콘
  const eventType = meta.event || meta.eventType || '';
  const iconMap = {
    'LOGIN_SUCCESS': `${C.green}✅ 로그인 성공${C.reset}`,
    'LOGIN_FAILED': `${C.red}❌ 로그인 실패${C.reset}`,
    'SUSPICIOUS_REQUEST': `${C.bgRed}${C.white} ⚠️  의심 접근 ${C.reset}`,
    'RATE_LIMIT_EXCEEDED': `${C.yellow}🚫 요청 초과${C.reset}`,
    'USER_DELETED': `${C.magenta}🗑️  유저 삭제${C.reset}`,
    'ACCESS': `${C.gray}→${C.reset}`,
  };

  // 메타 정보 파싱
  let details = '';
  if (meta.ip) details += ` ${C.gray}IP:${C.reset}${C.white}${meta.ip}${C.reset}`;
  if (meta.username) details += ` ${C.blue}👤${meta.username}${C.reset}`;
  if (meta.method && meta.path) details += ` ${C.cyan}${meta.method} ${meta.path}${C.reset}`;
  if (meta.statusCode) {
    const sc = meta.statusCode;
    const scColor = sc >= 500 ? C.red : sc >= 400 ? C.yellow : C.green;
    details += ` ${scColor}[${sc}]${C.reset}`;
  }
  if (meta.responseTime) details += ` ${C.gray}${meta.responseTime}ms${C.reset}`;
  if (meta.userAgent) details += ` ${C.gray}${String(meta.userAgent).slice(0, 40)}${C.reset}`;

  const icon = iconMap[message] || iconMap[eventType] || '';
  const msg = icon ? icon : `${C.white}${message}${C.reset}`;

  return `${C.gray}[${time}]${C.reset} ${levelStr} ${msg}${details}`;
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'access.log'), maxsize: 5242880, maxFiles: 10 }),
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error', maxsize: 5242880, maxFiles: 10 }),
    new winston.transports.File({ filename: path.join(logDir, 'security.log'), level: 'warn', maxsize: 5242880, maxFiles: 10 }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat
      )
    })
  ]
});

// 서버 시작 배너
function printBanner() {
  console.log('');
  console.log(`${C.bright}${C.magenta}  ╔══════════════════════════════════╗${C.reset}`);
  console.log(`${C.bright}${C.magenta}  ║   🚀  spagenio  Dashboard        ║${C.reset}`);
  console.log(`${C.bright}${C.magenta}  ╚══════════════════════════════════╝${C.reset}`);
  console.log(`  ${C.cyan}포트${C.reset}     : ${C.white}${process.env.PORT || 3000}${C.reset}`);
  console.log(`  ${C.cyan}환경${C.reset}     : ${C.white}${process.env.NODE_ENV || 'development'}${C.reset}`);
  console.log(`  ${C.cyan}시작 시각${C.reset}: ${C.white}${new Date().toLocaleString('ko-KR')}${C.reset}`);
  console.log('');
  console.log(`  ${C.gray}로그 레벨: ${C.green}✅성공  ${C.yellow}⚠️경고  ${C.red}❌오류  ${C.gray}→일반${C.reset}`);
  console.log('');
}

// ✅ 접속 로그 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip TEXT,
    method TEXT,
    path TEXT,
    status_code INTEGER,
    user_id INTEGER,
    username TEXT,
    user_agent TEXT,
    referer TEXT,
    response_time INTEGER,
    event_type TEXT DEFAULT 'request'
  );
  CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON access_logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_logs_ip ON access_logs(ip);
  CREATE INDEX IF NOT EXISTS idx_logs_event ON access_logs(event_type);
`);

// DB에 로그 저장 함수
function saveAccessLog({ ip, method, path, statusCode, userId, username, userAgent, referer, responseTime, eventType = 'request' }) {
  try {
    db.prepare(`INSERT INTO access_logs 
      (ip, method, path, status_code, user_id, username, user_agent, referer, response_time, event_type) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(ip, method, path, statusCode, userId || null, username || null, userAgent, referer, responseTime, eventType);

    // SSE 실시간 브로드캐스트
    if (typeof logClients !== 'undefined' && logClients.size > 0) {
      const levelMap = { suspicious: 'warn', login_failed: 'error', login_success: 'success', rate_limit: 'warn', request: 'info' };
      const entry = {
        level: levelMap[eventType] || 'info',
        message: `${method} ${path}`,
        time: new Date().toISOString().slice(11, 19),
        ip, username: username || '-', status: statusCode,
        eventType, responseTime: responseTime + 'ms'
      };
      const data = `data: ${JSON.stringify(entry)}

`;
      logClients.forEach(client => {
        try { client.write(data); } catch (e) { logClients.delete(client); }
      });
    }
  } catch (e) {
    logger.error('로그 저장 오류:', e.message);
  }
}

// ✅ Gmail SMTP 설정
const mailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

async function sendMail({ to, subject, html }) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log('⚠️ Gmail 설정 없음 - 메일 발송 스킵');
    return false;
  }
  try {
    await mailTransporter.sendMail({
      from: `AI Router Dashboard <${process.env.GMAIL_USER}>`,
      to, subject, html
    });
    return true;
  } catch (e) {
    console.error('메일 발송 오류:', e.message);
    saveErrorLog({ event_type: 'MAIL_ERROR', error_message: e.message, stack_trace: e.stack, meta: { to, subject } });
    return false;
  }
}
const JWT_EXPIRES = '24h';

// 로그인 시도 횟수 제한 (메모리)
const loginAttempts = new Map();

// ✅ JWT 인증 미들웨어
function authMiddleware(req, res, next) {
  const publicApis = ['/api/auth/login', '/api/auth/verify', '/api/auth/register',
    '/api/auth/forgot-password', '/api/auth/send-email-code', '/api/auth/verify-email-code',
    '/api/auth/check-username', '/api/auth/check-email', '/api/news/save'];

  if (!req.path.startsWith('/api/')) return next();

  // ✅ 토큰 파싱 항상 먼저 (공개 API도 req.user 세팅 필요)
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.auth_token;
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch (e) {}
  }

  if (publicApis.some(p => req.path.startsWith(p))) return next();

  if (!req.user) return res.status(401).json({ error: '인증이 필요합니다.' });
  next();
}

const startedAt = Date.now();
const requestStats = {
  total: 0,
  preview: 0,
  run: 0,
  errors: 0,
  lastError: null
};

const PRESETS = {
  market_brief: {
    label: '시장 브리핑',
    userRequest: '오늘 미국 기술주와 반도체 관련 핵심 뉴스만 요약해서 핵심 포인트와 리스크를 정리해줘.',
    taskType: 'news',
    taskComplexity: 'medium',
    preferredEngine: 'hybrid',
    preferredModel: 'gemini',
    optimizationMode: 'balanced',
    autoMode: true,
    priorityMode: 'speed'
  },
  daily_ops: {
    label: '반복 업무 자동화',
    userRequest: '매일 아침 받은 이메일을 요약하고 일정이 있으면 캘린더 후보를 만들어줘.',
    taskType: 'repeat',
    taskComplexity: 'medium',
    preferredEngine: 'n8n',
    preferredModel: 'gemini',
    optimizationMode: 'cost',
    autoMode: true,
    priorityMode: 'balanced'
  },
  executive_report: {
    label: '중요 보고서',
    userRequest: '긴 문서와 메모를 합쳐 임원 보고용 1페이지 요약과 실행 항목을 작성해줘.',
    taskType: 'research',
    taskComplexity: 'high',
    preferredEngine: 'hybrid',
    preferredModel: 'claude',
    optimizationMode: 'document',
    autoMode: true,
    priorityMode: 'quality'
  },
  desktop_agent: {
    label: '비서형 에이전트',
    userRequest: '복합 작업을 단계별로 계획하고 필요한 도구를 골라 실행 전략을 작성해줘.',
    taskType: 'desktop',
    taskComplexity: 'high',
    preferredEngine: 'openclaw',
    preferredModel: 'gpt',
    optimizationMode: 'balanced',
    autoMode: true,
    priorityMode: 'quality'
  }
};

const CONFIG = {
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL || '',
  openclawWebhookUrl: process.env.OPENCLAW_WEBHOOK_URL || '',
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 20000),
  perfProfile: process.env.PERF_PROFILE || 'turbo-local',
  hasKeys: {
    openai: Boolean(process.env.OPENAI_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY)
  },
  defaults: {
    engine: process.env.DEFAULT_ENGINE || 'hybrid',
    model: process.env.DEFAULT_MODEL || 'gemini',
    priorityMode: process.env.DEFAULT_PRIORITY_MODE || 'balanced'
  }
};

app.disable('x-powered-by');

// ✅ Helmet 보안 헤더
app.use(helmet({
  contentSecurityPolicy: false, // 대시보드 인라인 스크립트 허용
  crossOriginEmbedderPolicy: false
}));

// ✅ Rate Limiting
const globalLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 300,
  message: { error: '너무 많은 요청입니다. 잠시 후 다시 시도하세요.' },
  handler: (req, res, next, options) => {
    const ip = req.ip || req.connection.remoteAddress;
    logger.warn('RATE_LIMIT_EXCEEDED', { ip, path: req.path, userAgent: req.headers['user-agent'] });
    saveAccessLog({ ip, method: req.method, path: req.path, statusCode: 429, userAgent: req.headers['user-agent'] || '', referer: req.headers['referer'] || '', responseTime: 0, eventType: 'rate_limit' });
    res.status(429).json(options.message);
  }
});

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 로그인 시도 15분에 20회
  message: { error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도하세요.' }
});

app.use(globalLimit);
app.use('/api/auth/login', authLimit);
app.use('/api/auth/register', authLimit);

// Cloudflare Tunnel 프록시 신뢰 설정
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ✅ 접속 로그 미들웨어
app.use((req, res, next) => {
  const startTime = Date.now();
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || '';
  const referer = req.headers['referer'] || '';

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const userId = req.user?.id || null;
    const username = req.user?.username || null;

    // 파일 로그
    logger.info('ACCESS', {
      ip, method: req.method, path: req.path,
      statusCode: res.statusCode, userId, username,
      userAgent, referer, responseTime
    });

    // DB 로그 (정적 파일 제외)
    if (!req.path.match(/\.(js|css|ico|png|jpg|svg|woff)$/)) {
      saveAccessLog({ ip, method: req.method, path: req.path, statusCode: res.statusCode, userId, username, userAgent, referer, responseTime });
    }

    // 의심 접근 감지
    const suspiciousPatterns = ['/etc/passwd', '../', 'eval(', '<script', 'UNION SELECT', 'DROP TABLE', '/admin.php', '/wp-admin', '/shell'];
    if (suspiciousPatterns.some(p => req.path.toLowerCase().includes(p.toLowerCase()) || JSON.stringify(req.body).toLowerCase().includes(p.toLowerCase()))) {
      logger.warn('SUSPICIOUS_REQUEST', { ip, method: req.method, path: req.path, body: req.body, userAgent });
      saveAccessLog({ ip, method: req.method, path: req.path, statusCode: res.statusCode, userAgent, referer, responseTime, eventType: 'suspicious' });
    }
  });

  next();
});

// 인증 미들웨어 적용
app.use(authMiddleware);

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 })(req, res, next);
});

app.use((req, res, next) => {
  requestStats.total += 1;
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// ✅ 인증 관련 페이지 라우트
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/register-complete.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register-complete.html')));
app.get('/change-password', (req, res) => res.sendFile(path.join(__dirname, 'public', 'change-password.html')));
app.get('/withdraw', (req, res) => res.sendFile(path.join(__dirname, 'public', 'withdraw.html')));
app.get('/forgot-password', (req, res) => res.sendFile(path.join(__dirname, 'public', 'forgot-password.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'public', 'terms.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ✅ 로그인 API
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip;
  const key = `${ip}_${username}`;
  const now = Date.now();

  // 브루트포스 방지
  const attempts = loginAttempts.get(key) || { count: 0, lockUntil: 0 };
  if (attempts.lockUntil > now) {
    const remaining = Math.ceil((attempts.lockUntil - now) / 1000);
    return res.status(429).json({ error: `너무 많은 시도. ${remaining}초 후 다시 시도하세요.` });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    attempts.count++;
    if (attempts.count >= 5) {
      attempts.lockUntil = now + 30 * 1000; // 30초 잠금
      attempts.count = 0;
    }
    loginAttempts.set(key, attempts);

    // 로그인 실패 로그
    const failIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.warn('LOGIN_FAILED', { ip: failIp, username, attempts: attempts.count, userAgent: req.headers['user-agent'] });
    saveAccessLog({ ip: failIp, method: 'POST', path: '/api/auth/login', statusCode: 401, userAgent: req.headers['user-agent'] || '', referer: req.headers['referer'] || '', responseTime: 0, eventType: 'login_failed' });

    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }

  // 성공 - 시도 횟수 초기화
  loginAttempts.delete(key);

  // 마지막 로그인 업데이트
  db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), user.id);

  // 로그인 성공 로그
  const loginIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  logger.info('LOGIN_SUCCESS', { ip: loginIp, username: user.username, userAgent: req.headers['user-agent'] });
  saveAccessLog({ ip: loginIp, method: 'POST', path: '/api/auth/login', statusCode: 200, userId: user.id, username: user.username, userAgent: req.headers['user-agent'] || '', referer: req.headers['referer'] || '', responseTime: 0, eventType: 'login_success' });

  const token = jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  // 쿠키에도 저장
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24시간
  });

  return res.json({ status: 'ok', token, username: user.username });
});

// ✅ 토큰 검증 API
app.get('/api/auth/verify', (req, res) => {
  return res.json({ status: 'ok', user: req.user });
});

// ✅ 로그아웃 API
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  return res.json({ status: 'ok' });
});

// ✅ 비밀번호 찾기 요청 API - 이메일로 임시 비밀번호 발송
app.post('/api/auth/forgot-password', async (req, res) => {
  const { username } = req.body;
  const user = db.prepare('SELECT id, username, email FROM users WHERE username = ?').get(username);

  // 보안상 존재 여부 노출 안 함
  if (!user || !user.email) {
    return res.json({ status: 'ok', message: '등록된 이메일로 임시 비밀번호를 발송했습니다.' });
  }

  // 이메일 복호화
  const decryptedEmail = decryptEmail(user.email);
  if (!decryptedEmail) {
    return res.json({ status: 'ok', message: '등록된 이메일로 임시 비밀번호를 발송했습니다.' });
  }
  user.email = decryptedEmail;

  // 임시 비밀번호 생성
  const tempPassword = Math.random().toString(36).substring(2, 8).toUpperCase() +
    Math.random().toString(36).substring(2, 5) + '!1';
  const hash = bcrypt.hashSync(tempPassword, 12);

  // DB 업데이트
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);

  // 메일 발송
  const mailSent = await sendMail({
    to: user.email,
    subject: '[AI Router Dashboard] 임시 비밀번호 안내',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:30px;background:#09111f;color:#eef2ff;border-radius:16px;">
        <h2 style="color:#76a5ff;margin-bottom:16px;">🔑 임시 비밀번호 안내</h2>
        <p style="color:#9ea8c9;margin-bottom:20px;">안녕하세요, <strong style="color:#eef2ff;">${user.username}</strong>님!</p>
        <p style="color:#9ea8c9;margin-bottom:20px;">요청하신 임시 비밀번호를 발급했습니다.</p>
        <div style="background:#0d1526;border:1px solid #24314f;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
          <p style="color:#9ea8c9;font-size:0.85rem;margin-bottom:8px;">임시 비밀번호</p>
          <p style="color:#7ef0bf;font-size:1.6rem;font-weight:800;letter-spacing:4px;font-family:monospace;">${tempPassword}</p>
        </div>
        <p style="color:#ff8f8f;font-size:0.85rem;">로그인 후 반드시 비밀번호를 변경해주세요!</p>
        <p style="color:#9ea8c9;font-size:0.8rem;margin-top:20px;">본인이 요청하지 않은 경우 이 메일을 무시하세요.</p>
      </div>
    `
  });

  return res.json({
    status: 'ok',
    message: mailSent
      ? '등록된 이메일로 임시 비밀번호를 발송했습니다.'
      : '메일 발송에 실패했습니다. 관리자에게 문의해주세요.'
  });
});

// ✅ 비밀번호 초기화 요청 목록 (관리자)
app.get('/api/admin/reset-requests', (req, res) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: '권한 없음' });
  db.exec(`CREATE TABLE IF NOT EXISTS password_reset_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    temp_password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);
  const rows = db.prepare("SELECT * FROM password_reset_requests WHERE status = 'pending' ORDER BY created_at DESC").all();
  return res.json({ requests: rows });
});

// ✅ 임시 비밀번호 발급 (관리자)
app.post('/api/admin/reset-password', (req, res) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: '권한 없음' });
  const { request_id } = req.body;

  const request = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(request_id);
  if (!request) return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });

  // 임시 비밀번호 생성
  const tempPassword = Math.random().toString(36).substring(2, 10) + '!A1';
  const hash = bcrypt.hashSync(tempPassword, 12);

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, request.user_id);
  db.prepare("UPDATE password_reset_requests SET status = 'done', temp_password = ? WHERE id = ?").run(tempPassword, request_id);

  return res.json({ status: 'ok', username: request.username, temp_password: tempPassword });
});

// ✅ 아이디 중복 확인 API
app.post('/api/auth/check-username', (req, res) => {
  const { username } = req.body;
  if (!username || username.length < 3) return res.status(400).json({ error: '아이디는 3자 이상이어야 합니다.' });
  if (username.length > 10) return res.status(400).json({ error: '아이디는 10자 이하여야 합니다.' });
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: '영문, 숫자, 언더바(_)만 사용 가능합니다.' });
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
  return res.json({ status: 'ok', message: '사용 가능한 아이디입니다.' });
});

// ✅ 이메일 중복 확인 API
app.post('/api/auth/check-email', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: '이메일을 입력해주세요.' });
    const allUsers = db.prepare('SELECT email FROM users WHERE email IS NOT NULL').all();
    const used = allUsers.some(u => {
      try { return decryptEmail(u.email) === email; } catch (e) { return false; }
    });
    if (used) return res.status(409).json({ error: '이미 가입된 이메일입니다.' });
    return res.json({ status: 'ok', message: '사용 가능한 이메일입니다.' });
  } catch (error) {
    console.error('check-email 오류:', error);
    saveErrorLog({ event_type: 'CHECK_EMAIL_ERROR', error_message: error.message, stack_trace: error.stack });
    return res.status(500).json({ error: error.message });
  }
});

// ✅ 이메일 인증코드 발송 API (가입용)
app.post('/api/auth/send-email-code', async (req, res) => {
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다.' });
  }

  // 이미 가입된 이메일 확인 (복호화해서 비교)
  const allUsers = db.prepare('SELECT email FROM users WHERE email IS NOT NULL').all();
  const alreadyUsed = allUsers.some(u => {
    try { return decryptEmail(u.email) === email; } catch (e) { return false; }
  });
  if (alreadyUsed) {
    return res.status(400).json({ error: '이미 가입된 이메일입니다.' });
  }

  // 60초 이내 중복 발송 방지
  const recent = db.prepare(
    "SELECT id FROM email_verifications WHERE email = ? AND created_at > datetime('now', '-60 seconds') AND verified = 0"
  ).get(email);
  if (recent) {
    return res.status(429).json({ error: '60초 후 다시 시도해주세요.' });
  }

  // 기존 미인증 코드 삭제 (만료 포함 전체 정리)
  db.prepare("DELETE FROM email_verifications WHERE email = ?").run(email);

  // 6자리 코드 생성
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 60 * 1000).toISOString(); // 60초

  db.prepare('INSERT INTO email_verifications (email, code, expires_at) VALUES (?, ?, ?)').run(email, code, expiresAt);

  // 메일 발송
  const mailSent = await sendMail({
    to: email,
    subject: '[AI Router Dashboard] 이메일 인증코드',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:30px;background:#09111f;color:#eef2ff;border-radius:16px;">
        <h2 style="color:#76a5ff;margin-bottom:16px;">📧 이메일 인증</h2>
        <p style="color:#9ea8c9;margin-bottom:20px;">아래 인증코드를 60초 이내에 입력해주세요.</p>
        <div style="background:#0d1526;border:1px solid #24314f;border-radius:12px;padding:24px;text-align:center;margin-bottom:20px;">
          <p style="color:#9ea8c9;font-size:0.85rem;margin-bottom:8px;">인증코드 (60초 유효)</p>
          <p style="color:#76a5ff;font-size:2.4rem;font-weight:800;letter-spacing:10px;font-family:monospace;">${code}</p>
        </div>
        <p style="color:#ff8f8f;font-size:0.85rem;">본인이 요청하지 않은 경우 이 메일을 무시하세요.</p>
      </div>
    `
  });

  if (!mailSent) {
    db.prepare("DELETE FROM email_verifications WHERE email = ? AND verified = 0").run(email);
    return res.status(500).json({ error: '메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }

  return res.json({ status: 'ok', message: '인증코드를 발송했습니다.' });
});

// ✅ 이메일 인증코드 확인 API (가입용)
app.post('/api/auth/verify-email-code', (req, res) => {
  const { email, code } = req.body;

  const record = db.prepare(
    "SELECT * FROM email_verifications WHERE email = ? AND code = ? AND verified = 0 AND expires_at > datetime('now')"
  ).get(email, code);

  if (!record) {
    return res.status(400).json({ error: '인증코드가 올바르지 않거나 만료됐습니다.' });
  }

  // 인증 완료 처리
  db.prepare('UPDATE email_verifications SET verified = 1 WHERE id = ?').run(record.id);

  return res.json({ status: 'ok', message: '이메일 인증이 완료됐습니다.' });
});

// ✅ 회원가입 API (초대 코드 방식)
app.post('/api/auth/register', (req, res) => {
  const { username, password, email, invite_code } = req.body;

  if (!username || !password || !email) {
    return res.status(400).json({ error: '모든 항목을 입력해주세요.' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: '아이디는 3자 이상이어야 합니다.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다.' });
  }

  // 이메일 인증 확인
  const encEmailForCheck = email;
  const verified = db.prepare(
    "SELECT id FROM email_verifications WHERE email = ? AND verified = 1"
  ).get(encEmailForCheck);
  if (!verified) {
    return res.status(400).json({ error: '이메일 인증을 먼저 완료해주세요.' });
  }

  // 아이디 중복 확인
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
  }

  // 이메일 중복 확인 (복호화 비교)
  const allUsers = db.prepare('SELECT email FROM users WHERE email IS NOT NULL').all();
  const emailUsed = allUsers.some(u => { try { return decryptEmail(u.email) === email; } catch (e) { return false; } });
  if (emailUsed) {
    return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });
  }

  // 사용자 생성
  const hash = bcrypt.hashSync(password, 12);
  const encryptedEmail = encryptEmail(email);
  const result = db.prepare('INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)').run(username, hash, encryptedEmail);

  // 이메일 인증 레코드 정리 (사용 완료)
  db.prepare('DELETE FROM email_verifications WHERE email = ?').run(email);

  // 약관 동의 저장
  const { agree_terms, agree_privacy, agree_investment, agree_marketing } = req.body;
  db.prepare('INSERT INTO terms_agreements (user_id, agree_terms, agree_privacy, agree_investment, agree_marketing, ip) VALUES (?,?,?,?,?,?)')
    .run(result.lastInsertRowid,
      agree_terms ? 1 : 0,
      agree_privacy ? 1 : 0,
      agree_investment ? 1 : 0,
      agree_marketing ? 1 : 0,
      req.ip || ''
    );

  return res.json({ status: 'ok', message: '가입이 완료됐습니다.' });
});

// ✅ 초대 코드 생성 API (관리자만)
app.post('/api/auth/invite', (req, res) => {
  if (req.user.username !== 'admin') {
    return res.status(403).json({ error: '관리자만 초대 코드를 생성할 수 있습니다.' });
  }

  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7일

  db.prepare('INSERT INTO invite_codes (code, created_by, expires_at) VALUES (?, ?, ?)')
    .run(code, req.user.id, expiresAt);

  return res.json({ status: 'ok', code, expires_at: expiresAt });
});

// ✅ 접속 로그 조회 API (관리자)
app.get('/api/admin/logs', (req, res) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: '권한 없음' });

  const { type, limit = 100, page = 1 } = req.query;
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM access_logs WHERE 1=1';
  const params = [];

  if (type && type !== 'all') { query += ' AND event_type = ?'; params.push(type); }

  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const logs = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as cnt FROM access_logs' + (type && type !== 'all' ? ' WHERE event_type = ?' : '')).get(...(type && type !== 'all' ? [type] : []));

  return res.json({ logs, total: total.cnt, page: Number(page), limit: Number(limit) });
});

// ✅ 실시간 로그 SSE 스트리밍 (관리자)
const logClients = new Set();


app.get('/api/admin/logs/stream', (req, res) => {
  // SSE는 헤더 인증이 안되므로 쿼리 파라미터로 토큰 받기
  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).end();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.username !== 'admin') return res.status(403).end();
  } catch (e) { return res.status(401).end(); }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // 연결 확인 메시지
  res.write(`data: ${JSON.stringify({ level: 'info', message: '🔌 실시간 로그 연결됨', time: new Date().toISOString().slice(11, 19) })}

`);

  // 최근 로그 20개 먼저 전송
  try {
    const recent = db.prepare('SELECT * FROM access_logs ORDER BY timestamp DESC LIMIT 20').all();
    recent.reverse().forEach(log => {
      const entry = {
        level: log.event_type === 'suspicious' ? 'warn' : log.event_type === 'login_failed' ? 'error' : 'info',
        message: `[${log.event_type}] ${log.method} ${log.path}`,
        time: log.timestamp?.slice(11, 19) || '',
        ip: log.ip, username: log.username, status: log.status_code,
        isHistory: true
      };
      res.write(`data: ${JSON.stringify(entry)}

`);
    });
  } catch (e) { }

  logClients.add(res);

  // 연결 종료 시 제거
  req.on('close', () => { logClients.delete(res); });
});

// ✅ Alpaca 키 유효성 검증
app.post('/api/alpaca-test', async (req, res) => {
  const { api_key, secret_key, paper } = req.body;
  if (!api_key || !secret_key) return res.status(400).json({ error: 'API Key와 Secret Key를 입력해주세요.' });
  try {
    const baseUrl = paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
    const response = await fetch(`${baseUrl}/v2/account`, {
      headers: {
        'APCA-API-KEY-ID': api_key,
        'APCA-API-SECRET-KEY': secret_key
      }
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(400).json({ error: data.message || '유효하지 않은 API 키입니다.' });
    }
    return res.json({ ok: true, status: data.status });
  } catch (e) {
    return res.status(500).json({ error: 'Alpaca 서버 연결 실패: ' + e.message });
  }
});

// ✅ 계좌 목록 조회
app.get('/api/user/broker-keys', (req, res) => {
  const rows = db.prepare('SELECT id, account_name, alpaca_paper, is_active, updated_at FROM user_broker_keys WHERE user_id = ? ORDER BY created_at ASC').all(req.user.id);
  if (!rows.length) return res.json({ registered: false, accounts: [] });
  return res.json({
    registered: true,
    accounts: rows.map(r => ({
      id: r.id,
      account_name: r.account_name,
      alpaca_paper: r.alpaca_paper === 1,
      is_active: r.is_active === 1,
      updated_at: r.updated_at
    }))
  });
});

// ✅ 계좌 추가
app.post('/api/user/broker-keys', (req, res) => {
  const { account_name, alpaca_api_key, alpaca_secret_key, alpaca_paper } = req.body;
  if (!alpaca_api_key || !alpaca_secret_key) {
    return res.status(400).json({ error: 'API 키와 Secret 키를 입력해주세요.' });
  }
  try {
    const encKey = encryptEmail(alpaca_api_key);
    const encSecret = encryptEmail(alpaca_secret_key);
    const paper = alpaca_paper ? 1 : 0;
    const name = account_name || (paper ? '페이퍼 트레이딩' : '실거래 계좌');
    // 첫 계좌면 활성으로 설정
    const count = db.prepare('SELECT COUNT(*) as cnt FROM user_broker_keys WHERE user_id = ?').get(req.user.id).cnt;
    const isActive = count === 0 ? 1 : 0;
    db.prepare('INSERT INTO user_broker_keys (user_id, account_name, alpaca_api_key, alpaca_secret_key, alpaca_paper, is_active) VALUES (?,?,?,?,?,?)')
      .run(req.user.id, name, encKey, encSecret, paper, isActive);
    return res.json({ status: 'ok', message: `'${name}' 계좌가 등록됐습니다.` });
  } catch (e) {
    saveErrorLog({ event_type: 'BROKER_KEY_ERROR', error_message: e.message, stack_trace: e.stack, meta: { userId: req.user?.id } });
    return res.status(500).json({ error: e.message });
  }
});

// ✅ 계좌 삭제
app.delete('/api/user/broker-keys/:id', (req, res) => {
  const row = db.prepare('SELECT id, is_active FROM user_broker_keys WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: '계좌를 찾을 수 없습니다.' });
  db.prepare('DELETE FROM user_broker_keys WHERE id = ?').run(req.params.id);
  // 삭제된 계좌가 활성이었으면 다른 계좌를 활성으로
  if (row.is_active) {
    const next = db.prepare('SELECT id FROM user_broker_keys WHERE user_id = ? LIMIT 1').get(req.user.id);
    if (next) db.prepare('UPDATE user_broker_keys SET is_active = 1 WHERE id = ?').run(next.id);
  }
  return res.json({ status: 'ok', message: '계좌가 삭제됐습니다.' });
});

// ✅ 활성 계좌 전환
app.post('/api/user/broker-keys/:id/activate', (req, res) => {
  const row = db.prepare('SELECT id FROM user_broker_keys WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: '계좌를 찾을 수 없습니다.' });
  db.prepare('UPDATE user_broker_keys SET is_active = 0 WHERE user_id = ?').run(req.user.id);
  db.prepare('UPDATE user_broker_keys SET is_active = 1 WHERE id = ?').run(req.params.id);
  return res.json({ status: 'ok', message: '활성 계좌가 변경됐습니다.' });
});

// ✅ 활성 계좌 키 복호화 (내부용)
function getUserAlpacaKeys(userId, accountId) {
  let row;
  if (accountId) {
    row = db.prepare('SELECT alpaca_api_key, alpaca_secret_key, alpaca_paper FROM user_broker_keys WHERE id = ? AND user_id = ?').get(accountId, userId);
  } else {
    row = db.prepare('SELECT alpaca_api_key, alpaca_secret_key, alpaca_paper FROM user_broker_keys WHERE user_id = ? AND is_active = 1').get(userId);
    if (!row) row = db.prepare('SELECT alpaca_api_key, alpaca_secret_key, alpaca_paper FROM user_broker_keys WHERE user_id = ? LIMIT 1').get(userId);
  }
  if (!row) return null;
  try {
    return {
      api_key: decryptEmail(row.alpaca_api_key),
      secret_key: decryptEmail(row.alpaca_secret_key),
      paper: row.alpaca_paper === 1
    };
  } catch (e) { return null; }
}

// ✅ Alpaca 프록시 (선택된 계좌 ID로 호출)
app.all('/api/alpaca-user/*', async (req, res) => {
  const accountId = req.headers['x-account-id'] || req.query.accountId;
  const keys = getUserAlpacaKeys(req.user.id, accountId);
  if (!keys) {
    return res.status(400).json({ error: 'Alpaca 키가 등록되지 않았습니다. 설정에서 키를 등록해주세요.' });
  }
  try {
    const alpacaPath = req.path.replace('/api/alpaca-user', '');
    const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
    const query = Object.keys(req.query).filter(k => k !== 'accountId').length
      ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(req.query).filter(([k]) => k !== 'accountId'))).toString()
      : '';
    const url = `${baseUrl}${alpacaPath}${query}`;
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'APCA-API-KEY-ID': keys.api_key,
        'APCA-API-SECRET-KEY': keys.secret_key,
        'Content-Type': 'application/json'
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ✅ 가입자 목록 조회 (관리자)
app.get('/api/admin/users', (req, res) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: '권한 없음' });
  const { search } = req.query;
  let query = 'SELECT id, username, email, created_at, last_login FROM users WHERE 1=1';
  const params = [];
  if (search) { query += ' AND username LIKE ?'; params.push('%' + search + '%'); }
  query += ' ORDER BY created_at DESC';
  const users = db.prepare(query).all(...params);
  // 이메일 복호화
  const result = users.map(u => ({
    ...u,
    email: u.email ? (decryptEmail(u.email) || '(복호화 실패)') : '-'
  }));
  return res.json({ users: result });
});

// ✅ 가입자 삭제 (관리자)
app.delete('/api/admin/users/:id', (req, res) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: '권한 없음' });
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '사용자 없음' });
  if (user.username === 'admin') return res.status(400).json({ error: '관리자는 삭제할 수 없습니다.' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  logger.warn('USER_DELETED', { adminId: req.user.id, deletedUsername: user.username });
  return res.json({ status: 'ok' });
});

// ✅ 접속 통계 API (관리자)
app.get('/api/admin/stats', (req, res) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: '권한 없음' });

  const dailyStats = db.prepare(`
    SELECT 
      DATE(timestamp) as date,
      COUNT(*) as total_requests,
      COUNT(DISTINCT ip) as unique_ips,
      COUNT(DISTINCT username) as unique_users,
      SUM(CASE WHEN event_type = 'login_success' THEN 1 ELSE 0 END) as logins,
      SUM(CASE WHEN event_type = 'login_failed' THEN 1 ELSE 0 END) as failed_logins,
      SUM(CASE WHEN event_type = 'suspicious' THEN 1 ELSE 0 END) as suspicious
    FROM access_logs
    WHERE timestamp >= datetime('now', '-30 days')
    GROUP BY DATE(timestamp)
    ORDER BY date DESC
  `).all();

  const userStats = db.prepare(`
    SELECT 
      username,
      COUNT(*) as total_requests,
      COUNT(DISTINCT DATE(timestamp)) as active_days,
      MAX(timestamp) as last_seen,
      MIN(timestamp) as first_seen
    FROM access_logs
    WHERE username IS NOT NULL
    GROUP BY username
    ORDER BY total_requests DESC
    LIMIT 20
  `).all();

  const hourlyStats = db.prepare(`
    SELECT 
      strftime('%H', timestamp) as hour,
      COUNT(*) as cnt
    FROM access_logs
    WHERE timestamp >= datetime('now', '-7 days')
    GROUP BY hour
    ORDER BY hour
  `).all();

  return res.json({ dailyStats, userStats, hourlyStats });
});

// ✅ 보안 통계 API (관리자)
app.get('/api/admin/security-stats', (req, res) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: '권한 없음' });

  const stats = {
    total_requests: db.prepare("SELECT COUNT(*) as cnt FROM access_logs").get().cnt,
    login_success: db.prepare("SELECT COUNT(*) as cnt FROM access_logs WHERE event_type = 'login_success'").get().cnt,
    login_failed: db.prepare("SELECT COUNT(*) as cnt FROM access_logs WHERE event_type = 'login_failed'").get().cnt,
    suspicious: db.prepare("SELECT COUNT(*) as cnt FROM access_logs WHERE event_type = 'suspicious'").get().cnt,
    rate_limited: db.prepare("SELECT COUNT(*) as cnt FROM access_logs WHERE event_type = 'rate_limit'").get().cnt,
    unique_ips: db.prepare("SELECT COUNT(DISTINCT ip) as cnt FROM access_logs").get().cnt,
    top_ips: db.prepare("SELECT ip, COUNT(*) as cnt FROM access_logs GROUP BY ip ORDER BY cnt DESC LIMIT 10").all(),
    recent_suspicious: db.prepare("SELECT * FROM access_logs WHERE event_type = 'suspicious' ORDER BY timestamp DESC LIMIT 5").all(),
    recent_failed: db.prepare("SELECT * FROM access_logs WHERE event_type = 'login_failed' ORDER BY timestamp DESC LIMIT 5").all()
  };

  return res.json(stats);
});

// ✅ 회원 탈퇴 API
app.post('/api/auth/withdraw', (req, res) => {
  const { password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
  }

  if (user.username === 'admin') {
    return res.status(400).json({ error: '관리자 계정은 탈퇴할 수 없습니다.' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  res.clearCookie('auth_token');
  return res.json({ status: 'ok', message: '탈퇴가 완료됐습니다.' });
});

// ✅ 비밀번호 변경 인증코드 발송 API
app.post('/api/auth/change-password/send-code', async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user.email) return res.status(400).json({ error: '등록된 이메일이 없습니다.' });

  const decryptedEmail = decryptEmail(user.email);
  if (!decryptedEmail) return res.status(400).json({ error: '이메일 정보를 불러올 수 없습니다.' });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  verifyCodeStore.set(`pw_change_${user.id}`, { code, expires: Date.now() + 5 * 60 * 1000 });

  const mailSent = await sendMail({
    to: decryptedEmail,
    subject: '[AI Router Dashboard] 비밀번호 변경 인증코드',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:30px;background:#09111f;color:#eef2ff;border-radius:16px;">
        <h2 style="color:#76a5ff;margin-bottom:16px;">🔐 비밀번호 변경 인증</h2>
        <p style="color:#9ea8c9;margin-bottom:20px;">아래 인증코드를 입력해주세요.</p>
        <div style="background:#0d1526;border:1px solid #24314f;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
          <p style="color:#9ea8c9;font-size:0.85rem;margin-bottom:8px;">인증코드 (5분 유효)</p>
          <p style="color:#76a5ff;font-size:2rem;font-weight:800;letter-spacing:8px;font-family:monospace;">${code}</p>
        </div>
        <p style="color:#ff8f8f;font-size:0.85rem;">본인이 요청하지 않은 경우 이 메일을 무시하세요.</p>
      </div>
    `
  });

  return res.json({ status: mailSent ? 'ok' : 'error', message: mailSent ? '인증코드를 이메일로 발송했습니다.' : '메일 발송 실패' });
});

// ✅ 비밀번호 변경 API (인증코드 + 새 비밀번호)
app.post('/api/auth/change-password', (req, res) => {
  const { verifyCode, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  // 인증코드 확인
  const stored = verifyCodeStore.get(`pw_change_${user.id}`);
  if (!stored || stored.code !== verifyCode || Date.now() > stored.expires) {
    return res.status(401).json({ error: '인증코드가 올바르지 않거나 만료됐습니다.' });
  }

  // 비밀번호 복잡도 검증
  const pwCheck = validatePassword(newPassword);
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.message });

  // 이전 비밀번호와 동일 여부 확인
  if (bcrypt.compareSync(newPassword, user.password_hash)) {
    return res.status(400).json({ error: '이전 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);
  verifyCodeStore.delete(`pw_change_${user.id}`);
  res.clearCookie('auth_token');
  return res.json({ status: 'ok', message: '비밀번호가 변경됐습니다. 다시 로그인해주세요.' });
});

// ✅ 비밀번호 복잡도 검증 함수
function validatePassword(password) {
  if (password.length < 8) return { valid: false, message: '비밀번호는 8자 이상이어야 합니다.' };
  if (!/[A-Z]/.test(password)) return { valid: false, message: '대문자를 1자 이상 포함해야 합니다.' };
  if (!/[a-z]/.test(password)) return { valid: false, message: '소문자를 1자 이상 포함해야 합니다.' };
  if (!/[0-9]/.test(password)) return { valid: false, message: '숫자를 1자 이상 포함해야 합니다.' };
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) return { valid: false, message: '특수문자를 1자 이상 포함해야 합니다.' };
  return { valid: true };
}

function summarizeProviders() {
  return {
    n8n: CONFIG.n8nWebhookUrl ? 'connected' : 'simulation',
    openclaw: CONFIG.openclawWebhookUrl ? 'connected' : 'simulation',
    gpt: CONFIG.hasKeys.openai ? 'ready' : 'missing-key',
    gemini: CONFIG.hasKeys.gemini ? 'ready' : 'missing-key',
    claude: CONFIG.hasKeys.anthropic ? 'ready' : 'missing-key'
  };
}

function chooseEngine({ taskType, preferredEngine, autoMode, priorityMode }) {
  if (!autoMode && preferredEngine !== 'hybrid') {
    return { engine: preferredEngine, reason: '사용자가 직접 엔진을 선택했습니다.' };
  }

  const n8nTasks = new Set(['repeat', 'notify', 'email', 'news', 'sheet']);
  const openclawTasks = new Set(['agent', 'research', 'multistep', 'desktop']);

  if (priorityMode === 'speed' && taskType !== 'desktop') {
    return { engine: 'n8n', reason: '속도 우선 모드라 지연이 적고 안정적인 n8n을 우선 추천합니다.' };
  }

  if (preferredEngine === 'hybrid' || autoMode) {
    if (n8nTasks.has(taskType)) {
      return { engine: 'n8n', reason: '반복형/연동형 업무라 n8n이 더 안정적입니다.' };
    }
    if (openclawTasks.has(taskType)) {
      return { engine: 'openclaw', reason: '복합 판단형 작업이라 OpenClaw가 더 적합합니다.' };
    }
  }

  return {
    engine: preferredEngine === 'hybrid' ? 'n8n' : preferredEngine,
    reason: '기본 라우팅 규칙을 적용했습니다.'
  };
}

function chooseModel({ taskComplexity, preferredModel, optimizationMode, priorityMode }) {
  if (optimizationMode === 'manual') {
    return { model: preferredModel, reason: '사용자가 직접 모델을 선택했습니다.' };
  }

  if (optimizationMode === 'cost') {
    return { model: 'gemini', reason: '비용 우선 모드라 Gemini를 추천합니다.' };
  }

  if (optimizationMode === 'document') {
    return { model: 'claude', reason: '문서/정리형 작업이라 Claude를 추천합니다.' };
  }

  if (priorityMode === 'speed' && taskComplexity !== 'high') {
    return { model: 'gemini', reason: '속도 우선 모드라 빠른 응답과 비용 효율이 좋은 Gemini를 추천합니다.' };
  }

  if (taskComplexity === 'high' && priorityMode === 'quality') {
    return { model: preferredModel === 'claude' ? 'claude' : 'gpt', reason: '고난도 + 품질 우선 작업이라 상위 추론 모델을 추천합니다.' };
  }

  if (taskComplexity === 'high') {
    return { model: 'gpt', reason: '복잡한 추론 비중이 높아 GPT를 추천합니다.' };
  }

  return { model: preferredModel, reason: '기본 모델 선택을 유지했습니다.' };
}

function estimateCostBand({ modelDecision, engineDecision, taskComplexity, priorityMode }) {
  const modelBase = {
    gemini: 1,
    gpt: 3,
    claude: 3
  }[modelDecision.model] || 2;

  const engineWeight = engineDecision.engine === 'openclaw' ? 2 : 1;
  const complexityWeight = taskComplexity === 'high' ? 2 : taskComplexity === 'medium' ? 1.3 : 1;
  const priorityWeight = priorityMode === 'quality' ? 1.4 : priorityMode === 'speed' ? 0.9 : 1;

  const score = modelBase * engineWeight * complexityWeight * priorityWeight;
  if (score <= 2) return '낮음';
  if (score <= 5) return '중간';
  return '높음';
}

function buildPayload(body) {
  const normalized = {
    userRequest: String(body.userRequest || '').trim(),
    taskType: body.taskType || 'news',
    taskComplexity: body.taskComplexity || 'medium',
    preferredEngine: body.preferredEngine || CONFIG.defaults.engine,
    preferredModel: body.preferredModel || CONFIG.defaults.model,
    optimizationMode: body.optimizationMode || 'balanced',
    autoMode: Boolean(body.autoMode),
    priorityMode: body.priorityMode || CONFIG.defaults.priorityMode
  };

  const engineDecision = chooseEngine(normalized);
  const modelDecision = chooseModel(normalized);

  return {
    ...normalized,
    engineDecision,
    modelDecision,
    providers: summarizeProviders(),
    estimatedCostBand: estimateCostBand({
      modelDecision,
      engineDecision,
      taskComplexity: normalized.taskComplexity,
      priorityMode: normalized.priorityMode
    }),
    requestedAt: new Date().toISOString()
  };
}

async function forwardToTarget(url, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);
  const started = Date.now();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const contentType = response.headers.get('content-type') || '';
    const durationMs = Date.now() - started;
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
    }

    if (contentType.includes('application/json')) {
      const json = await response.json();
      return { durationMs, body: json };
    }

    return { durationMs, body: { raw: await response.text() } };
  } finally {
    clearTimeout(timeout);
  }
}

// ✅ Claude API 직접 호출 함수
async function callClaude(userRequest, taskType, taskComplexity) {
  const started = Date.now();

  const systemPrompt = `당신은 유능한 AI 어시스턴트입니다. 
작업 유형: ${taskType}
작업 복잡도: ${taskComplexity}
한국어로 명확하고 구조적으로 답변해주세요.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userRequest }
    ]
  });

  const durationMs = Date.now() - started;
  const text = response.content[0]?.text || '';

  return {
    durationMs,
    body: {
      answer: text,
      model: response.model,
      usage: response.usage
    }
  };
}

app.get('/api/config', (req, res) => {
  res.json({
    ...CONFIG,
    providers: summarizeProviders(),
    presets: PRESETS
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    perfProfile: CONFIG.perfProfile,
    stats: requestStats,
    providers: summarizeProviders()
  });
});

app.get('/api/presets', (req, res) => {
  res.json(PRESETS);
});

app.post('/api/route-decision', (req, res) => {
  requestStats.preview += 1;
  const payload = buildPayload(req.body);
  res.json(payload);
});

app.post('/api/run', async (req, res) => {
  requestStats.run += 1;
  const payload = buildPayload(req.body);
  const engine = payload.engineDecision.engine;
  const model = payload.modelDecision.model;

  try {
    // ✅ Claude 모델 선택 시 Claude API 직접 호출
    if (model === 'claude' && CONFIG.hasKeys.anthropic) {
      const result = await callClaude(
        payload.userRequest,
        payload.taskType,
        payload.taskComplexity
      );
      return res.json({
        mode: 'live',
        target: 'claude',
        latencyMs: result.durationMs,
        payload,
        result: result.body
      });
    }

    // n8n으로 포워딩
    if (engine === 'n8n' && CONFIG.n8nWebhookUrl) {
      const result = await forwardToTarget(CONFIG.n8nWebhookUrl, payload);
      return res.json({
        mode: 'live',
        target: 'n8n',
        latencyMs: result.durationMs,
        payload,
        result: result.body
      });
    }

    // openclaw으로 포워딩
    if (engine === 'openclaw' && CONFIG.openclawWebhookUrl) {
      const result = await forwardToTarget(CONFIG.openclawWebhookUrl, payload);
      return res.json({
        mode: 'live',
        target: 'openclaw',
        latencyMs: result.durationMs,
        payload,
        result: result.body
      });
    }

    // 시뮬레이션 모드
    return res.json({
      mode: 'simulation',
      target: engine,
      latencyMs: 0,
      payload,
      result: {
        summary: `현재 ${engine} 실서버 URL이 비어 있어 시뮬레이션으로 응답했습니다.`,
        nextAction: engine === 'n8n'
          ? 'n8n webhook URL을 .env에 넣으면 실제 워크플로로 연결됩니다.'
          : 'OpenClaw webhook URL을 .env에 넣으면 실제 에이전트로 연결됩니다.',
        performanceTip: payload.priorityMode === 'speed'
          ? '속도 우선 모드이므로 Gemini + n8n 조합이 기본 추천입니다.'
          : payload.priorityMode === 'quality'
            ? '품질 우선 모드이므로 GPT/Claude + Hybrid/OpenClaw 조합을 권장합니다.'
            : '균형형 모드이므로 하이브리드 분기 기준을 사용합니다.',
        exampleWebhookPayload: payload
      }
    });
  } catch (error) {
    requestStats.errors += 1;
    requestStats.lastError = {
      message: error.message,
      at: new Date().toISOString()
    };
    return res.status(500).json({
      error: '실행 중 오류가 발생했습니다.',
      detail: error.message,
      payload
    });
  }
});

// ✅ Claude 직접 채팅 API 추가
app.post('/api/chat', async (req, res) => {
  const { message, taskType = 'general', taskComplexity = 'medium' } = req.body;

  if (!message) {
    return res.status(400).json({ error: '메시지가 필요합니다.' });
  }

  if (!CONFIG.hasKeys.anthropic) {
    return res.status(400).json({ error: 'Anthropic API 키가 설정되지 않았습니다.' });
  }

  try {
    const result = await callClaude(message, taskType, taskComplexity);
    return res.json({
      mode: 'live',
      target: 'claude',
      latencyMs: result.durationMs,
      result: result.body
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Claude API 호출 중 오류가 발생했습니다.',
      detail: error.message
    });
  }
});

// ✅ 퀀트 서버 프록시 (포트 5002)
app.all('/proxy/quant/*', async (req, res) => {
  try {
    const quantPath = req.path.replace('/proxy/quant', '');
    const query = Object.keys(req.query).length ? '?' + new URLSearchParams(req.query).toString() : '';
    const url = `http://localhost:5002${quantPath}${query}`;
    const response = await fetch(url, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: '퀀트 서버 연결 실패', detail: error.message });
  }
});

// ✅ 주식 서버 프록시 (외부에서 5001 포트 접근 가능하게 중계)
app.all('/proxy/stock/*', async (req, res) => {
  try {
    const stockPath = req.path.replace('/proxy/stock', '');
    const query = Object.keys(req.query).length ? '?' + new URLSearchParams(req.query).toString() : '';
    const url = `http://localhost:5001${stockPath}${query}`;

    const response = await fetch(url, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: '주식 서버 연결 실패', detail: error.message });
  }
});

// ✅ 뉴스 수집 트리거 (대시보드에서 호출 → n8n 웹훅으로 전달)
app.post('/api/news/trigger', async (req, res) => {
  try {
    const source = req.body.source || 'rss'; // rss | claude | gpt
    const use_claude = source === 'claude';
    const use_gpt = source === 'gpt';
    const n8nWebhookUrl = process.env.NEWS_WEBHOOK_URL || 'http://127.0.0.1:5678/webhook/news-collect';

    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ use_claude, use_gpt, source })
    });

    if (response.ok) {
      return res.json({ status: 'ok', source });
    } else {
      return res.status(500).json({ error: 'n8n webhook call failed' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ✅ 뉴스 저장 API (내용 중복 방지 로직 추가)
app.post('/api/news/save', (req, res) => {
  try {
    const { category, content, use_claude, source } = req.body;
    const date = new Date().toISOString().slice(0, 10);
    const savedAt = new Date().toISOString();

    // source 및 use_claude 설정
    const src = (source && ['rss', 'claude', 'gpt'].includes(source)) ? source : (use_claude ? 'claude' : 'rss');
    const useClaude = (src === 'claude') ? 1 : 0;

    // 내용 정제
    const cleanContent = (content || '').trim();

    // 유효성 검사 (내용이 없으면 저장 안 함)
    if (!cleanContent || cleanContent === '제목없음' || cleanContent === '-' || cleanContent === 'undefined') {
      return res.json({ status: 'ignored', reason: 'content is empty or invalid' });
    }

    // ⭐ 핵심: 같은 날짜, 카테고리, 그리고 '내용(content)'이 완전히 같은 데이터가 있는지 조회
    const existing = db.prepare(
      'SELECT id FROM news WHERE category = ? AND date = ? AND content = ?'
    ).get(category, date, cleanContent);

    if (existing) {
      // 내용이 같으면 중복으로 판단하여 저장하지 않음 (기존 데이터 유지)
      return res.json({
        status: 'exists',
        message: '이미 동일한 내용의 뉴스가 저장되어 있습니다.',
        id: existing.id
      });
    } else {
      // 내용이 다르면 새로운 뉴스로 판단하여 INSERT
      db.prepare(
        'INSERT INTO news (category, date, saved_at, use_claude, source, content) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(category, date, savedAt, useClaude, src, cleanContent);

      return res.json({
        status: 'ok',
        category,
        date,
        content_length: cleanContent.length,
        message: '신규 뉴스 저장 완료'
      });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ✅ 뉴스 목록 조회 - SQLite DB
app.get('/api/news/list', (req, res) => {
  try {
    const { date, category, type, limit = 100 } = req.query;

    let query = 'SELECT * FROM news WHERE 1=1';
    const params = [];

    if (date && date !== 'all') { query += ' AND date = ?'; params.push(date); }
    if (category && category !== 'all') { query += ' AND category = ?'; params.push(category); }
    if (type === 'claude') { query += " AND (source = 'claude' OR (source IS NULL AND use_claude = 1))"; }
    if (type === 'raw' || type === 'rss') { query += " AND (source = 'rss' OR (source IS NULL AND use_claude = 0))"; }
    if (type === 'gpt') { query += " AND source = 'gpt'"; }

    query += ' ORDER BY saved_at DESC LIMIT ?';
    params.push(Number(limit));

    const rows = db.prepare(query).all(...params);
    const news = rows.map(r => ({
      id: r.id,
      category: r.category,
      date: r.date,
      savedAt: r.saved_at,
      use_claude: !!r.use_claude,
      source: r.source || (r.use_claude ? 'claude' : 'rss') || 'rss',
      content: r.content
    }));

    return res.json({ news });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ✅ 뉴스 날짜 목록 조회
app.get('/api/news/dates', (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT DISTINCT date FROM news ORDER BY date DESC'
    ).all();
    return res.json({ dates: rows.map(r => r.date) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ✅ 뉴스 삭제
app.delete('/api/news/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM news WHERE id = ?').run(req.params.id);
    return res.json({ status: 'ok' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});



// ============================================================
//  server.js 에 추가할 로또 전체 API
//  기존 /api/lotto 관련 코드 전부 교체
// ============================================================

// ── 로또 DB 초기화 ─────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS user_telegram (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    chat_id TEXT NOT NULL,
    bot_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS lotto_picks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    pick_date TEXT NOT NULL,
    game_index INTEGER NOT NULL,
    numbers TEXT NOT NULL,
    algorithms TEXT,
    drw_no INTEGER,
    rank INTEGER,
    matched_count INTEGER,
    bonus_match INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS lotto_history (
    drw_no INTEGER PRIMARY KEY,
    numbers TEXT NOT NULL,
    bonus INTEGER,
    drw_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS lotto_schedule_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    days TEXT,
    hour INTEGER,
    game_count INTEGER,
    action TEXT DEFAULT 'update',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS lotto_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    enabled INTEGER DEFAULT 0,
    days TEXT DEFAULT '1,2,3,4,5,6',
    hour INTEGER DEFAULT 9,
    game_count INTEGER DEFAULT 5,
    last_sent_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS lotto_algorithm_weights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    weights TEXT NOT NULL DEFAULT '{}',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// ── 텔레그램 설정 조회 ────────────────────────────────────
app.get('/api/lotto/telegram/config', (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  const row = db.prepare('SELECT chat_id, bot_token FROM user_telegram WHERE user_id = ?').get(req.user.id);
  res.json({ chat_id: row?.chat_id || '', has_token: !!row?.bot_token });
});

// ── 텔레그램 설정 저장 ────────────────────────────────────
app.post('/api/lotto/telegram/config', (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  const { chat_id } = req.body;
  let { bot_token } = req.body;
  if (!chat_id) return res.status(400).json({ error: 'chat_id 필요' });
  // bot prefix 자동 제거
  if (bot_token && bot_token.startsWith('bot')) bot_token = bot_token.slice(3);
  const existing = db.prepare('SELECT id FROM user_telegram WHERE user_id = ?').get(req.user.id);
  if (existing) {
    db.prepare(`UPDATE user_telegram SET chat_id=?, bot_token=COALESCE(NULLIF(?,''),bot_token), updated_at=CURRENT_TIMESTAMP WHERE user_id=?`)
      .run(chat_id, bot_token || '', req.user.id);
  } else {
    db.prepare('INSERT INTO user_telegram (user_id, chat_id, bot_token) VALUES (?,?,?)').run(req.user.id, chat_id, bot_token || '');
  }
  res.json({ ok: true });
});

// ── 텔레그램 메시지 전송 ──────────────────────────────────
app.post('/api/lotto/telegram', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  let { token, chatid, text } = req.body;
  if (!chatid) {
    const tg = db.prepare('SELECT chat_id, bot_token FROM user_telegram WHERE user_id = ?').get(req.user.id);
    if (!tg) return res.status(400).json({ ok: false, error: '텔레그램 Chat ID를 먼저 등록하세요.' });
    chatid = tg.chat_id;
    token = token || tg.bot_token || process.env.TG_BOT_TOKEN;
  }
  if (!token) return res.status(400).json({ ok: false, error: 'Bot Token 없음' });
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatid, text, parse_mode: 'Markdown' })
    });
    const data = await r.json();
    res.json(data.ok ? { ok: true } : { ok: false, error: data.description });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── 추천 번호 저장 ─────────────────────────────────────────
app.post('/api/lotto/picks', (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  const { pick_date, games, algorithms } = req.body;
  if (!games?.length) return res.status(400).json({ error: '번호 없음' });
  db.prepare('DELETE FROM lotto_picks WHERE user_id=? AND pick_date=?').run(req.user.id, pick_date);
  const stmt = db.prepare('INSERT INTO lotto_picks (user_id, pick_date, game_index, numbers, algorithms) VALUES (?,?,?,?,?)');
  games.forEach((nums, i) => stmt.run(req.user.id, pick_date, i, JSON.stringify(nums), algorithms || ''));
  res.json({ ok: true, saved: games.length });
});

// ── 추천 번호 목록 (날짜별 요약) ─────────────────────────
app.get('/api/lotto/picks', (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  const { date, limit = 50 } = req.query;
  if (date) {
    const rows = db.prepare('SELECT * FROM lotto_picks WHERE user_id=? AND pick_date=? ORDER BY game_index').all(req.user.id, date);
    return res.json({ picks: rows.map(r => ({ ...r, numbers: JSON.parse(r.numbers) })) });
  }
  const rows = db.prepare(`
    SELECT pick_date,
           COUNT(*) as game_count,
           MAX(drw_no) as drw_no,
           MIN(CASE WHEN rank > 0 THEN rank END) as best_rank,
           MAX(matched_count) as max_match,
           SUM(CASE WHEN rank > 0 THEN 1 ELSE 0 END) as checked_count
    FROM lotto_picks WHERE user_id=?
    GROUP BY pick_date ORDER BY pick_date DESC LIMIT ?
  `).all(req.user.id, parseInt(limit));
  res.json({ picks: rows });
});

// ── 당첨 결과 확인 ────────────────────────────────────────
app.post('/api/lotto/picks/check', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  const { pick_date, drw_no } = req.body;
  try {
    const apiRes = await fetch(`https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drw_no}`);
    const data = await apiRes.json();
    if (data.returnValue !== 'success') return res.status(400).json({ error: '회차 정보 없음' });
    const winning = [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6];
    const bonus = data.bnusNo;
    const picks = db.prepare('SELECT * FROM lotto_picks WHERE user_id=? AND pick_date=?').all(req.user.id, pick_date);
    if (!picks.length) return res.status(404).json({ error: '픽 없음' });
    const results = picks.map(pick => {
      const nums = JSON.parse(pick.numbers);
      const matched = nums.filter(n => winning.includes(n)).length;
      const hasBonus = nums.includes(bonus);
      let rank = null;
      if (matched === 6) rank = 1;
      else if (matched === 5 && hasBonus) rank = 2;
      else if (matched === 5) rank = 3;
      else if (matched === 4) rank = 4;
      else if (matched === 3) rank = 5;
      db.prepare('UPDATE lotto_picks SET drw_no=?, rank=?, matched_count=?, bonus_match=? WHERE id=?')
        .run(drw_no, rank, matched, hasBonus ? 1 : 0, pick.id);
      return { game_index: pick.game_index, numbers: nums, matched, rank, has_bonus: hasBonus };
    });
    res.json({ ok: true, winning, bonus, results, drw_no });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 스케줄 조회/저장 ──────────────────────────────────────
app.get('/api/lotto/schedule', (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  const row = db.prepare('SELECT * FROM lotto_schedule WHERE user_id=?').get(req.user.id);
  res.json(row || null);
});

app.post('/api/lotto/schedule', (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  const { enabled, days, hour, game_count } = req.body;
  const existing = db.prepare('SELECT id, updated_at FROM lotto_schedule WHERE user_id=?').get(req.user.id);

  // 일주일 수정 제한 체크 (최초 저장은 제한 없음)
  if (existing && existing.updated_at) {
    const lastUpdate = new Date(existing.updated_at);
    const diffDays = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < 7) {
      const remainDays = Math.ceil(7 - diffDays);
      return res.json({ ok: false, remain_days: remainDays });
    }
  }

  if (existing) {
    db.prepare('UPDATE lotto_schedule SET enabled=?,days=?,hour=?,game_count=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?')
      .run(enabled ? 1 : 0, days, hour, game_count, req.user.id);
  } else {
    db.prepare('INSERT INTO lotto_schedule (user_id,enabled,days,hour,game_count) VALUES (?,?,?,?,?)').run(req.user.id, enabled ? 1 : 0, days, hour, game_count);
  }
  res.json({ ok: true });
});

// ── 스케줄 초기화 ─────────────────────────────────────────
app.delete('/api/lotto/schedule', (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  db.prepare('DELETE FROM lotto_schedule WHERE user_id=?').run(req.user.id);
  res.json({ ok: true });
});

// ── 스케줄러 (1분마다) ────────────────────────────────────
setInterval(async () => {
  try {
    const now = new Date();
    if (now.getMinutes() !== 0) return;
    const currentHour = now.getHours();
    const currentDay = now.getDay();
    const today = now.toISOString().split('T')[0];

    // 토요일 20시 이후는 판매 마감 → 발송 안 함
    if (currentDay === 6 && currentHour >= 20) return;

    const schedules = db.prepare(`
      SELECT ls.*, ut.chat_id, ut.bot_token
      FROM lotto_schedule ls
      JOIN user_telegram ut ON ls.user_id = ut.user_id
      WHERE ls.enabled=1 AND ls.hour=?
    `).all(currentHour);

    for (const sch of schedules) {
      const days = sch.days.split(',').map(Number);
      if (!days.includes(currentDay)) continue;
      if (sch.last_sent_at?.startsWith(today)) continue;

      // 유저 알고리즘 비중 로드
      const DEFAULT_WEIGHTS = { freq: 20, hot: 20, cold: 10, balance: 15, zone: 10, ac: 10, prime: 5, delta: 10 };
      const wRow = db.prepare('SELECT weights FROM lotto_algorithm_weights WHERE user_id=?').get(sch.user_id);
      let algos = { ...DEFAULT_WEIGHTS };
      if (wRow) { try { algos = { ...DEFAULT_WEIGHTS, ...JSON.parse(wRow.weights) }; } catch {} }

      // 알고리즘 기반 번호 생성 함수
      const HOT_SET = new Set([3, 7, 14, 18, 23, 27, 34, 40, 42]);
      const COLD_SET = new Set([1, 5, 9, 12, 20, 28, 33, 38, 44]);
      const PRIME_SET = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43]);

      function getScore(n) {
        let score = 1;
        if (algos.freq  > 0) score += algos.freq  * (n % 9 + 1) * 0.01;
        if (algos.hot   > 0 && HOT_SET.has(n))   score += algos.hot   * 0.08;
        if (algos.cold  > 0 && COLD_SET.has(n))  score += algos.cold  * 0.07;
        if (algos.balance > 0 && n % 2 === 0)    score += algos.balance * 0.02;
        if (algos.zone  > 0) score += algos.zone  * 0.015;
        if (algos.ac    > 0) score += algos.ac    * ((n * 7) % 11) * 0.005;
        if (algos.prime > 0 && PRIME_SET.has(n)) score += algos.prime * 0.04;
        if (algos.delta > 0) score += algos.delta * ((46 - n) % 6) * 0.005;
        return score;
      }

      function generateAlgoGame() {
        const picked = new Set();
        while (picked.size < 6) {
          const pool = [];
          for (let n = 1; n <= 45; n++) {
            if (!picked.has(n)) pool.push({ n, w: getScore(n) });
          }
          const total = pool.reduce((s, x) => s + x.w, 0);
          let r = Math.random() * total;
          for (const item of pool) { r -= item.w; if (r <= 0) { picked.add(item.n); break; } }
          if (picked.size < 6 && pool.length > 0) picked.add(pool[pool.length - 1].n);
        }
        return [...picked].sort((a, b) => a - b);
      }

      // 게임 생성
      const games = Array.from({ length: sch.game_count }, () => generateAlgoGame());

      // DB 저장
      db.prepare('DELETE FROM lotto_picks WHERE user_id=? AND pick_date=?').run(sch.user_id, today);
      const stmt = db.prepare('INSERT INTO lotto_picks (user_id,pick_date,game_index,numbers,algorithms) VALUES (?,?,?,?,?)');
      games.forEach((nums, i) => stmt.run(sch.user_id, today, i, JSON.stringify(nums), '자동발송'));

      // 텔레그램 전송
      const token = sch.bot_token || process.env.TG_BOT_TOKEN;
      if (token && sch.chat_id) {
        const lines = games.map((g, i) => `${String.fromCharCode(65 + i)}게임: ${g.map(n => `*${n}*`).join(' ')}`).join('\n');
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const msg = `🍀 *로또 자동 추천* (${today})\n\n${lines}\n\n📅 ${dayNames[currentDay]}요일 ${currentHour}시 자동발송`;
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: sch.chat_id, text: msg, parse_mode: 'Markdown' })
        }).catch(() => { });
      }
      db.prepare('UPDATE lotto_schedule SET last_sent_at=CURRENT_TIMESTAMP WHERE user_id=?').run(sch.user_id);
      db.prepare('INSERT INTO lotto_schedule_log (user_id, day, hour, game_count) VALUES (?,?,?,?)').run(sch.user_id, currentDay, currentHour, sch.game_count);
    }
  } catch (e) {
    console.error('스케줄 오류:', e.message);
    saveErrorLog({ event_type: 'LOTTO_SCHEDULE_SAVE_ERROR', error_message: e.message, stack_trace: e.stack });
  }
}, 60 * 1000);

// ── 동행복권 이력 ─────────────────────────────────────────
app.get('/api/lotto/history', async (req, res) => {
  try {
    const rows = db.prepare('SELECT drw_no, numbers, bonus, drw_date FROM lotto_history ORDER BY drw_no DESC LIMIT 100').all();
    const history = rows.map(r => JSON.parse(r.numbers));
    const latest = rows[0]?.drw_no || 0;
    res.json({ history, latest_round: latest, count: history.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/lotto', (req, res) => res.sendFile(path.join(__dirname, 'public', 'lotto.html')));


// ============================================================
//  server.js 에 추가할 로또 전체 API
//  기존 /api/lotto 관련 코드 전부 교체
// ============================================================


app.get('/api/lotto/schedule/log', (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  const rows = db.prepare('SELECT * FROM lotto_schedule_log WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
  res.json({ logs: rows });
});

// ── 알고리즘 비중 조회 ────────────────────────────────────
app.get('/api/lotto/algorithm-weights', (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  const DEFAULT_WEIGHTS = { freq: 20, hot: 20, cold: 10, balance: 15, zone: 10, ac: 10, prime: 5, delta: 10 };
  const row = db.prepare('SELECT weights FROM lotto_algorithm_weights WHERE user_id=?').get(req.user.id);
  if (!row) return res.json(DEFAULT_WEIGHTS);
  try { res.json({ ...DEFAULT_WEIGHTS, ...JSON.parse(row.weights) }); } catch { res.json(DEFAULT_WEIGHTS); }
});

// ── 알고리즘 비중 저장 ────────────────────────────────────
app.post('/api/lotto/algorithm-weights', (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  try {
    const weights = JSON.stringify(req.body);
    const existing = db.prepare('SELECT id FROM lotto_algorithm_weights WHERE user_id=?').get(req.user.id);
    if (existing) {
      db.prepare('UPDATE lotto_algorithm_weights SET weights=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?').run(weights, req.user.id);
    } else {
      db.prepare('INSERT INTO lotto_algorithm_weights (user_id, weights) VALUES (?,?)').run(req.user.id, weights);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
// 자동매매 현황 (현재 보유 중인 자동매매 종목)
// 자동매매 현황 (현재 보유 중인 자동매매 종목)
app.get('/api/auto-trade/positions', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  const keys = getUserAlpacaKeys(req.user.id, null);
  if (!keys) return res.json({ positions: [] });
  try {
    const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
    const headers = { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key };
    const posRes = await fetch(`${baseUrl}/v2/positions`, { headers });
    const posData = await posRes.json();
    const positions = Array.isArray(posData) ? posData : (posData.positions || []);
    // 자동매매로 매수한 종목만 필터
    const autoSymbols = new Set(
      db.prepare("SELECT DISTINCT symbol FROM auto_trade_log WHERE user_id=? AND action='BUY' AND status='active'").all(req.user.id).map(r => r.symbol)
    );
    const autoPositions = positions.filter(p => autoSymbols.has(p.symbol));
    res.json({ positions: autoPositions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 개별 종목 자동매매 취소 (포지션 청산)
app.post('/api/auto-trade/cancel/:symbol', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  const { symbol } = req.params;
  const keys = getUserAlpacaKeys(req.user.id, null);
  if (!keys) return res.status(400).json({ error: 'Alpaca 키 없음' });
  try {
    const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
    const headers = { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key, 'Content-Type': 'application/json' };
    // 포지션 조회
    const posRes = await fetch(`${baseUrl}/v2/positions/${symbol}`, { headers });
    const pos = await posRes.json();
    if (!pos.qty) return res.status(404).json({ error: '포지션 없음' });
    // 시장가 매도
    const orderRes = await fetch(`${baseUrl}/v2/orders`, {
      method: 'POST', headers,
      body: JSON.stringify({ symbol, qty: pos.qty, side: 'sell', type: 'market', time_in_force: 'day' })
    });
    const order = await orderRes.json();
    // 로그 업데이트
    const plPct = parseFloat(pos.unrealized_plpc) || 0;
    db.prepare('INSERT INTO auto_trade_log (user_id,symbol,action,qty,price,reason,order_id,profit_pct,status) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(req.user.id, symbol, 'SELL_MANUAL', pos.qty, pos.current_price, '수동 취소', order.id || '', plPct * 100, 'closed');
    db.prepare("UPDATE auto_trade_log SET status='closed' WHERE user_id=? AND symbol=? AND action='BUY' AND status='active'")
      .run(req.user.id, symbol);
    res.json({ ok: true, order });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 전체 자동매매 종료 (모든 포지션 청산 + 비활성화)
app.post('/api/auto-trade/stop-all', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  const keys = getUserAlpacaKeys(req.user.id, null);
  if (!keys) return res.status(400).json({ error: 'Alpaca 키 없음' });
  try {
    const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
    const headers = { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key, 'Content-Type': 'application/json' };
    // 자동매매 비활성화
    db.prepare('UPDATE auto_trade_settings SET enabled=0 WHERE user_id=?').run(req.user.id);
    // 자동매매 종목 포지션만 청산
    const autoSymbols = db.prepare("SELECT DISTINCT symbol FROM auto_trade_log WHERE user_id=? AND action='BUY' AND status='active'").all(req.user.id);
    const results = [];
    for (const { symbol } of autoSymbols) {
      try {
        const posRes = await fetch(`${baseUrl}/v2/positions/${symbol}`, { headers });
        const pos = await posRes.json();
        if (!pos.qty) continue;
        const orderRes = await fetch(`${baseUrl}/v2/orders`, {
          method: 'POST', headers,
          body: JSON.stringify({ symbol, qty: pos.qty, side: 'sell', type: 'market', time_in_force: 'day' })
        });
        const order = await orderRes.json();
        const plPct = parseFloat(pos.unrealized_plpc) || 0;
        db.prepare('INSERT INTO auto_trade_log (user_id,symbol,action,qty,price,reason,order_id,profit_pct,status) VALUES (?,?,?,?,?,?,?,?,?)')
          .run(req.user.id, symbol, 'SELL_STOP_ALL', pos.qty, pos.current_price, '전체 종료', order.id || '', plPct * 100, 'closed');
        db.prepare("UPDATE auto_trade_log SET status='closed' WHERE user_id=? AND symbol=? AND action='BUY' AND status='active'")
          .run(req.user.id, symbol);
        results.push(symbol);
      } catch (e) { }
    }
    res.json({ ok: true, closed: results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── MACD 계산 함수 ────────────────────────────────────────
function calcEMA(prices, period) {
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
  return ema;
}

function calcMACD(closes) {
  if (closes.length < 35) return null;
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macd = ema12 - ema26;
  // 시그널: 최근 9일 MACD의 EMA
  const macdLine = [];
  for (let i = 26; i <= closes.length; i++) {
    const e12 = calcEMA(closes.slice(0, i), 12);
    const e26 = calcEMA(closes.slice(0, i), 26);
    macdLine.push(e12 - e26);
  }
  if (macdLine.length < 9) return null;
  const signal = calcEMA(macdLine, 9);
  const prevMacd = macdLine[macdLine.length - 2];
  const prevSignal = calcEMA(macdLine.slice(0, -1), 9);
  const goldenCross = prevMacd < prevSignal && macd > signal;
  const deadCross = prevMacd > prevSignal && macd < signal;
  return { macd, signal, goldenCross, deadCross };
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

// ── 자동매매 핵심 로직 ────────────────────────────────────
async function runAutoTradeForUser(userId) {
  const settings = db.prepare('SELECT * FROM auto_trade_settings WHERE user_id=? AND enabled=1').get(userId);
  if (!settings) return { ok: false, message: '자동매매 비활성화 상태' };

  const keys = getUserAlpacaKeys(userId, null);
  if (!keys) return { ok: false, message: 'Alpaca 키 없음' };

  const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
  const headers = { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key, 'Content-Type': 'application/json' };

  const results = [];

  try {
    // 1. 계좌 잔고 조회
    const accountRes = await fetch(`${baseUrl}/v2/account`, { headers });
    const account = await accountRes.json();
    const buyingPower = parseFloat(account.buying_power) || 0;

    // 2. 현재 보유 포지션 조회
    const posRes = await fetch(`${baseUrl}/v2/positions`, { headers });
    const posData = await posRes.json();
    const positions = Array.isArray(posData) ? posData : (posData.positions || []);

    // 3. 보유 포지션 익절/손절 체크
    for (const pos of positions) {
      const plPct = parseFloat(pos.unrealized_plpc) || 0;
      const takeProfit = settings.take_profit || 0.05;
      const stopLoss = settings.stop_loss || 0.05;

      if (plPct >= takeProfit) {
        // 익절
        try {
          const orderRes = await fetch(`${baseUrl}/v2/orders`, {
            method: 'POST', headers,
            body: JSON.stringify({ symbol: pos.symbol, qty: pos.qty, side: 'sell', type: 'market', time_in_force: 'day' })
          });
          const order = await orderRes.json();
          db.prepare('INSERT INTO auto_trade_log (user_id,symbol,action,qty,price,reason,order_id,profit_pct,status) VALUES (?,?,?,?,?,?,?,?,?)')
            .run(userId, pos.symbol, 'SELL_PROFIT', pos.qty, pos.current_price, `익절 +${(plPct * 100).toFixed(2)}%`, order.id || '', plPct * 100, 'closed');
          db.prepare("UPDATE auto_trade_log SET status='closed' WHERE user_id=? AND symbol=? AND action='BUY' AND status='active'").run(userId, pos.symbol);
          results.push({ symbol: pos.symbol, action: '익절 매도', profit: `+${(plPct * 100).toFixed(2)}%` });
        } catch (e) { }
      } else if (plPct <= -stopLoss) {
        // 손절
        try {
          const orderRes = await fetch(`${baseUrl}/v2/orders`, {
            method: 'POST', headers,
            body: JSON.stringify({ symbol: pos.symbol, qty: pos.qty, side: 'sell', type: 'market', time_in_force: 'day' })
          });
          const order = await orderRes.json();
          db.prepare('INSERT INTO auto_trade_log (user_id,symbol,action,qty,price,reason,order_id,profit_pct,status) VALUES (?,?,?,?,?,?,?,?,?)')
            .run(userId, pos.symbol, 'SELL_LOSS', pos.qty, pos.current_price, `손절 ${(plPct * 100).toFixed(2)}%`, order.id || '', plPct * 100, 'closed');
          db.prepare("UPDATE auto_trade_log SET status='closed' WHERE user_id=? AND symbol=? AND action='BUY' AND status='active'").run(userId, pos.symbol);
          results.push({ symbol: pos.symbol, action: '손절 매도', profit: `${(plPct * 100).toFixed(2)}%` });
        } catch (e) { }
      }
    }

    // 4. 매수 신호 체크 (3종목 유지)
    const heldSymbols = new Set(positions.map(p => p.symbol));
    const maxPositions = settings.max_positions || 3;
    // 자동매매로 보유 중인 종목 수
    const autoHeld = db.prepare("SELECT DISTINCT symbol FROM auto_trade_log WHERE user_id=? AND action='BUY' AND status='active'").all(userId).map(r => r.symbol);
    const autoHeldSet = new Set(autoHeld);
    const currentAutoCount = autoHeld.filter(s => heldSymbols.has(s)).length;
    const needMore = maxPositions - currentAutoCount;

    // 후보 종목 풀 (설정된 종목 + 후보 종목)
    const candidatePool = [
      ...(settings.symbols || 'QQQ,SPY,AAPL').split(',').map(s => s.trim()),
      ...(settings.candidate_symbols || 'QQQ,SPY,AAPL,NVDA,MSFT,GOOGL,AMZN,TSLA,META,AMD').split(',').map(s => s.trim())
    ].filter((s, i, arr) => s && arr.indexOf(s) === i); // 중복 제거

    const buyAmount = buyingPower * (settings.balance_ratio || 0.1);
    let boughtCount = 0;

    for (const symbol of candidatePool) {
      if (boughtCount >= needMore) break;
      if (heldSymbols.has(symbol)) continue; // 이미 보유
      if (buyAmount < 10) continue;

      try {
        // 최근 60일 종가 데이터
        const end = new Date().toISOString().split('T')[0];
        const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const barRes = await fetch(
          `https://data.alpaca.markets/v2/stocks/${symbol}/bars?timeframe=1Day&start=${start}&end=${end}&limit=60`,
          { headers }
        );
        const barData = await barRes.json();
        const bars = barData.bars || [];
        if (bars.length < 35) continue;

        const closes = bars.map(b => b.c);
        const currentPrice = closes[closes.length - 1];
        let buySignal = false;
        let reason = '';

        const mode = settings.signal_mode || 'combined';

        if (mode === 'macd' || mode === 'combined') {
          const macdResult = calcMACD(closes);
          if (macdResult?.goldenCross) {
            buySignal = true;
            reason = 'MACD 골든크로스';
          }
        }

        if (mode === 'combined' && !buySignal) {
          const rsi = calcRSI(closes);
          if (rsi && rsi < 40) {
            buySignal = true;
            reason = `RSI 과매도 (${rsi.toFixed(1)})`;
          }
        }

        if (buySignal && currentPrice > 0) {
          const qty = Math.floor(buyAmount / currentPrice);
          if (qty < 1) continue;

          const orderRes = await fetch(`${baseUrl}/v2/orders`, {
            method: 'POST', headers,
            body: JSON.stringify({ symbol, qty: String(qty), side: 'buy', type: 'market', time_in_force: 'day' })
          });
          const order = await orderRes.json();
          if (order.id) {
            db.prepare('INSERT INTO auto_trade_log (user_id,symbol,action,qty,price,reason,order_id,profit_pct,status) VALUES (?,?,?,?,?,?,?,?,?)')
              .run(userId, symbol, 'BUY', qty, currentPrice, reason, order.id, 0, 'active');
            results.push({ symbol, action: '매수', qty, reason });
            boughtCount++;
          }
        }
      } catch (e) {
        console.error('자동매매 오류:', symbol, e.message);
        saveErrorLog({ event_type: 'AUTO_TRADE_ERROR', error_message: e.message, stack_trace: e.stack, meta: { symbol, userId } });
      }
    }
  } catch (e) {
    return { ok: false, message: e.message };
  }

  return { ok: true, results, message: results.length ? `${results.length}건 실행` : '신호 없음' };
}

app.get('/api/auto-trade/settings', (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  const row = db.prepare('SELECT * FROM auto_trade_settings WHERE user_id=?').get(req.user.id);
  res.json(row || { enabled: 0, symbols: 'QQQ,SPY,AAPL', balance_ratio: 0.1, take_profit: 0.05, stop_loss: 0.05, signal_mode: 'combined' });
});

// 자동매매 설정 저장
app.post('/api/auto-trade/settings', (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  const { enabled, symbols, balance_ratio, take_profit, stop_loss, signal_mode } = req.body;
  const existing = db.prepare('SELECT id FROM auto_trade_settings WHERE user_id=?').get(req.user.id);
  if (existing) {
    db.prepare('UPDATE auto_trade_settings SET enabled=?,symbols=?,balance_ratio=?,take_profit=?,stop_loss=?,signal_mode=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?')
      .run(enabled ? 1 : 0, symbols, balance_ratio, take_profit, stop_loss, signal_mode, req.user.id);
  } else {
    db.prepare('INSERT INTO auto_trade_settings (user_id,enabled,symbols,balance_ratio,take_profit,stop_loss,signal_mode) VALUES (?,?,?,?,?,?,?)')
      .run(req.user.id, enabled ? 1 : 0, symbols, balance_ratio, take_profit, stop_loss, signal_mode);
  }
  res.json({ ok: true });
});

// 자동매매 로그 조회
app.get('/api/auto-trade/log', (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  const rows = db.prepare('SELECT * FROM auto_trade_log WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id);
  res.json({ logs: rows });
});

// 수동 자동매매 실행 트리거
app.post('/api/auto-trade/run', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인 필요' });
  const result = await runAutoTradeForUser(req.user.id);
  res.json(result);
});

// ── 자동매매 스케줄러 (1분마다) ──────────────────────────
setInterval(async () => {
  try {
    const now = new Date();
    // 미국 주식 시장 시간 (EST 9:30~16:00 = UTC 14:30~21:00)
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();
    const isMarketHours = (utcHour === 14 && utcMin >= 30) || (utcHour > 14 && utcHour < 21);
    if (!isMarketHours) return;

    const users = db.prepare('SELECT user_id FROM auto_trade_settings WHERE enabled=1').all();
    for (const u of users) {
      await runAutoTradeForUser(u.user_id);
    }
  } catch (e) {
    console.error('[자동매매 스케줄러]', e.message);
    saveErrorLog({ event_type: 'AUTO_TRADE_SCHEDULER_ERROR', error_message: e.message, stack_trace: e.stack });
  }
}, 60 * 1000);





// ===== 에러 로그 시스템 =====
const errorLogDir = path.join(__dirname, 'logs', 'errors');
if (!fs.existsSync(errorLogDir)) fs.mkdirSync(errorLogDir, { recursive: true });

function saveErrorLog({ event_type, error_message, stack_trace = '', meta = {} }) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const filePath = path.join(errorLogDir, `${today}.jsonl`);
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      event_type,
      error_message,
      stack_trace,
      meta: typeof meta === 'string' ? meta : JSON.stringify(meta),
    });
    fs.appendFileSync(filePath, entry + '\n', 'utf8');
  } catch (e) {
    logger.error('saveErrorLog 실패:', e.message);
  }
}

// 클라이언트(front/admin) 에러 수신 API
app.post('/api/client-error', (req, res) => {
  try {
    const { event_type, error_message, stack_trace, meta } = req.body;
    if (!event_type || !error_message) return res.json({ ok: false });
    saveErrorLog({ event_type, error_message, stack_trace, meta });
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});

// 에러 로그 날짜 목록 조회
app.get('/api/admin/error-logs/dates', (req, res) => {
  try {
    if (!req.user || req.user.username !== 'admin') return res.status(403).json({ error: '권한 없음' });
    const { type } = req.query;
    const files = fs.existsSync(errorLogDir)
      ? fs.readdirSync(errorLogDir).filter(f => f.endsWith('.jsonl')).sort().reverse()
      : [];
    const dates = files.map(f => f.replace('.jsonl', '')).filter(date => {
      if (!type || type === 'ALL') return true;
      try {
        const content = fs.readFileSync(path.join(errorLogDir, `${date}.jsonl`), 'utf8');
        return content.split('\n').filter(Boolean).some(line => {
          try { return JSON.parse(line).event_type?.startsWith(type); } catch { return false; }
        });
      } catch { return false; }
    });
    res.json({ ok: true, dates });
  } catch (e) {
    logger.error('ERROR_LOG_DATES', { error: e.message });
    res.status(500).json({ error: '서버 오류' });
  }
});

// 에러 로그 상세 조회
app.get('/api/admin/error-logs', (req, res) => {
  try {
    if (!req.user || req.user.username !== 'admin') return res.status(403).json({ error: '권한 없음' });
    const { date, type } = req.query;
    if (!date) return res.json({ ok: true, logs: [] });
    const filePath = path.join(errorLogDir, `${date}.jsonl`);
    if (!fs.existsSync(filePath)) return res.json({ ok: true, logs: [] });
    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
    let logs = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    if (type && type !== 'ALL') logs = logs.filter(l => l.event_type?.startsWith(type));
    logs.reverse();
    res.json({ ok: true, logs });
  } catch (e) {
    logger.error('ERROR_LOG_FETCH', { error: e.message });
    res.status(500).json({ error: '서버 오류' });
  }
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// ============================================================
//  자동매매 엔진 (MACD + Combined, +5% 익절 / -5% 손절)
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS auto_trade_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    enabled INTEGER DEFAULT 0,
    symbols TEXT DEFAULT 'QQQ,SPY,AAPL',
    candidate_symbols TEXT DEFAULT 'QQQ,SPY,AAPL,NVDA,MSFT,GOOGL,AMZN,TSLA,META,AMD',
    max_positions INTEGER DEFAULT 3,
    balance_ratio REAL DEFAULT 0.1,
    take_profit REAL DEFAULT 0.05,
    stop_loss REAL DEFAULT 0.05,
    signal_mode TEXT DEFAULT 'combined',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS auto_trade_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    action TEXT NOT NULL,
    qty REAL,
    price REAL,
    reason TEXT,
    order_id TEXT,
    profit_pct REAL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);
try { db.exec("ALTER TABLE auto_trade_log ADD COLUMN status TEXT DEFAULT 'active'"); } catch (e) { }

// 자동매매 설정 조회




// ===== 에러 로그 시스템 =====
// 글로벌 에러 핸들러
app.use((err, req, res, next) => {
  logger.error('SERVER_ERROR', { error: err.message, stack: err.stack, path: req.path });
  saveErrorLog({ event_type: 'SERVER_ERROR', error_message: err.message, stack_trace: err.stack, meta: { path: req.path, method: req.method } });
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : '';
  logger.error('UNHANDLED_REJECTION', { error: msg });
  saveErrorLog({ event_type: 'UNHANDLED_REJECTION', error_message: msg, stack_trace: stack });
});

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT_EXCEPTION', { error: err.message, stack: err.stack });
  saveErrorLog({ event_type: 'UNCAUGHT_EXCEPTION', error_message: err.message, stack_trace: err.stack });
});

app.listen(port, '0.0.0.0', () => {
  printBanner();
  const C2 = COLORS;
  console.log(`  ${C2.cyan}주소${C2.reset}     : ${C2.bright}${C2.white}http://localhost:${port}${C2.reset}`);
  console.log(`  ${C2.cyan}Claude${C2.reset}   : ${CONFIG.hasKeys.anthropic ? C2.green + '✅ 연결됨' : C2.red + '❌ API 키 없음'}${C2.reset}`);
  console.log(`  ${C2.cyan}Alpaca${C2.reset}   : ${CONFIG.hasKeys.alpaca ? C2.green + '✅ 연결됨' : C2.yellow + '⚠️  키 없음'}${C2.reset}`);
  console.log('');
  console.log(`${C2.gray}  ─────────────────────────────────────${C2.reset}`);
  console.log(`${C2.gray}  요청 로그가 아래에 실시간 표시됩니다.${C2.reset}`);
  console.log(`${C2.gray}  ─────────────────────────────────────${C2.reset}`);
  console.log('');
});
// ============================================================
//  server.js 에 추가할 로또 API
//  server.js 파일 맨 아래 app.listen() 바로 위에 붙여넣기
// ============================================================

