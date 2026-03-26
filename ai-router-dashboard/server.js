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

import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import frontRoutes from './routes/front.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3000);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ============================================================
// DB 초기화
// ============================================================
const dbPath = path.join(__dirname, 'news.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS news (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, date TEXT NOT NULL, saved_at TEXT NOT NULL, use_claude INTEGER DEFAULT 0, source TEXT DEFAULT 'rss', content TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE INDEX IF NOT EXISTS idx_news_date ON news(date);
  CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);
  CREATE INDEX IF NOT EXISTS idx_news_use_claude ON news(use_claude);
  CREATE INDEX IF NOT EXISTS idx_news_source ON news(source);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, email TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_login DATETIME);
  CREATE TABLE IF NOT EXISTS user_broker_keys (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, account_name TEXT NOT NULL DEFAULT '기본 계좌', alpaca_api_key TEXT, alpaca_secret_key TEXT, alpaca_paper INTEGER DEFAULT 1, is_active INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS terms_agreements (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, agree_terms INTEGER DEFAULT 0, agree_privacy INTEGER DEFAULT 0, agree_investment INTEGER DEFAULT 0, agree_marketing INTEGER DEFAULT 0, ip TEXT, agreed_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS email_verifications (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, code TEXT NOT NULL, verified INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME NOT NULL);
  CREATE TABLE IF NOT EXISTS invite_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, created_by INTEGER, used_by INTEGER, used_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS access_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, ip TEXT, method TEXT, path TEXT, status_code INTEGER, user_id INTEGER, username TEXT, user_agent TEXT, referer TEXT, response_time INTEGER, event_type TEXT DEFAULT 'request');
  CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON access_logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_logs_ip ON access_logs(ip);
  CREATE INDEX IF NOT EXISTS idx_logs_event ON access_logs(event_type);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS user_telegram (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE, chat_id TEXT NOT NULL, bot_token TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS lotto_picks (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, pick_date TEXT NOT NULL, game_index INTEGER NOT NULL, numbers TEXT NOT NULL, algorithms TEXT, drw_no INTEGER, rank INTEGER, matched_count INTEGER, bonus_match INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS lotto_history (drw_no INTEGER PRIMARY KEY, numbers TEXT NOT NULL, bonus INTEGER, drw_date TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS lotto_schedule_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, days TEXT, hour INTEGER, game_count INTEGER, action TEXT DEFAULT 'update', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS lotto_schedule (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE, enabled INTEGER DEFAULT 0, days TEXT DEFAULT '1,2,3,4,5,6', hour INTEGER DEFAULT 9, game_count INTEGER DEFAULT 5, last_sent_at DATETIME, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS lotto_algorithm_weights (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE, weights TEXT NOT NULL DEFAULT '{}', updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS auto_trade_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE, enabled INTEGER DEFAULT 0, symbols TEXT DEFAULT 'QQQ,SPY,AAPL', candidate_symbols TEXT DEFAULT 'QQQ,SPY,AAPL,NVDA,MSFT,GOOGL,AMZN,TSLA,META,AMD', max_positions INTEGER DEFAULT 3, balance_ratio REAL DEFAULT 0.1, take_profit REAL DEFAULT 0.05, stop_loss REAL DEFAULT 0.05, signal_mode TEXT DEFAULT 'combined', updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS auto_trade_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, symbol TEXT NOT NULL, action TEXT NOT NULL, qty REAL, price REAL, reason TEXT, order_id TEXT, profit_pct REAL, status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id));
`);

try { db.exec("ALTER TABLE auto_trade_log ADD COLUMN status TEXT DEFAULT 'active'"); } catch (e) {}

const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin1234!', 12));
  console.log('✅ 기본 관리자 계정 생성됨');
}
console.log('✅ SQLite DB 초기화 완료:', dbPath);

// ============================================================
// 공통 설정
// ============================================================
const JWT_SECRET = process.env.JWT_SECRET || 'ai-router-secret-key-change-this';
const JWT_EXPIRES = '24h';
const ENCRYPT_KEY_BUF = Buffer.from((process.env.ENCRYPT_KEY || 'ai-router-encrypt-key-32chars!!').slice(0, 32).padEnd(32, '0'));

function encryptEmail(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPT_KEY_BUF, iv);
  return iv.toString('hex') + ':' + Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('hex');
}

function decryptEmail(encrypted) {
  try {
    const [ivHex, dataHex] = encrypted.split(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPT_KEY_BUF, Buffer.from(ivHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  } catch (e) { return null; }
}

const verifyCodeStore = new Map();
const loginAttempts = new Map();

// ============================================================
// 에러 로그
// ============================================================
const errorLogDir = path.join(__dirname, 'logs', 'errors');
if (!fs.existsSync(errorLogDir)) fs.mkdirSync(errorLogDir, { recursive: true });

function saveErrorLog({ event_type, error_message, stack_trace = '', meta = {} }) {
  try {
    fs.appendFileSync(path.join(errorLogDir, `${new Date().toISOString().slice(0,10)}.jsonl`),
      JSON.stringify({ timestamp: new Date().toISOString(), event_type, error_message, stack_trace, meta: typeof meta === 'string' ? meta : JSON.stringify(meta) }) + '\n', 'utf8');
  } catch (e) { console.error('saveErrorLog 실패:', e.message); }
}

// ============================================================
// 로거
// ============================================================
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const C = { reset:'\x1b[0m',bright:'\x1b[1m',green:'\x1b[32m',yellow:'\x1b[33m',red:'\x1b[31m',blue:'\x1b[34m',cyan:'\x1b[36m',magenta:'\x1b[35m',gray:'\x1b[90m',white:'\x1b[37m',bgRed:'\x1b[41m' };

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'access.log'), maxsize: 5242880, maxFiles: 10 }),
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error', maxsize: 5242880, maxFiles: 10 }),
    new winston.transports.Console({
      format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const lc = { error:`${C.bright}${C.red}`, warn:`${C.bright}${C.yellow}`, info:C.cyan, debug:C.gray }[level] || C.white;
        let details = '';
        if (meta.ip) details += ` ${C.gray}IP:${C.white}${meta.ip}${C.reset}`;
        if (meta.username) details += ` ${C.blue}👤${meta.username}${C.reset}`;
        if (meta.method && meta.path) details += ` ${C.cyan}${meta.method} ${meta.path}${C.reset}`;
        if (meta.statusCode) { const sc = meta.statusCode; details += ` ${sc>=500?C.red:sc>=400?C.yellow:C.green}[${sc}]${C.reset}`; }
        const iconMap = { 'LOGIN_SUCCESS':`${C.green}✅ 로그인 성공${C.reset}`,'LOGIN_FAILED':`${C.red}❌ 로그인 실패${C.reset}`,'SUSPICIOUS_REQUEST':`${C.bgRed}${C.white} ⚠️ 의심 접근 ${C.reset}`,'USER_DELETED':`${C.magenta}🗑️ 유저 삭제${C.reset}`,'ACCESS':`${C.gray}→${C.reset}` };
        const icon = iconMap[message] || '';
        return `${C.gray}[${timestamp.slice(11,19)}]${C.reset} ${lc}${level.toUpperCase().padEnd(5)}${C.reset} ${icon||`${C.white}${message}${C.reset}`}${details}`;
      }))
    })
  ]
});

const logClients = new Set();

function saveAccessLog({ ip, method, path, statusCode, userId, username, userAgent, referer, responseTime, eventType = 'request' }) {
  try {
    db.prepare('INSERT INTO access_logs (ip,method,path,status_code,user_id,username,user_agent,referer,response_time,event_type) VALUES (?,?,?,?,?,?,?,?,?,?)').run(ip, method, path, statusCode, userId||null, username||null, userAgent, referer, responseTime, eventType);
    if (logClients.size > 0) {
      const levelMap = { suspicious:'warn', login_failed:'error', login_success:'success', rate_limit:'warn', request:'info' };
      const data = `data: ${JSON.stringify({ level: levelMap[eventType]||'info', message:`${method} ${path}`, time:new Date().toISOString().slice(11,19), ip, username:username||'-', status:statusCode, eventType, responseTime:responseTime+'ms' })}\n\n`;
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
  catch (e) { saveErrorLog({ event_type:'MAIL_ERROR', error_message:e.message, stack_trace:e.stack, meta:{to,subject} }); return false; }
}

// ============================================================
// AI 설정
// ============================================================
const startedAt = Date.now();
const requestStats = { total:0, preview:0, run:0, errors:0, lastError:null };

const PRESETS = {
  market_brief: { label:'시장 브리핑', userRequest:'오늘 미국 기술주와 반도체 관련 핵심 뉴스만 요약해서 핵심 포인트와 리스크를 정리해줘.', taskType:'news', taskComplexity:'medium', preferredEngine:'hybrid', preferredModel:'gemini', optimizationMode:'balanced', autoMode:true, priorityMode:'speed' },
  daily_ops: { label:'반복 업무 자동화', userRequest:'매일 아침 받은 이메일을 요약하고 일정이 있으면 캘린더 후보를 만들어줘.', taskType:'repeat', taskComplexity:'medium', preferredEngine:'n8n', preferredModel:'gemini', optimizationMode:'cost', autoMode:true, priorityMode:'balanced' },
  executive_report: { label:'중요 보고서', userRequest:'긴 문서와 메모를 합쳐 임원 보고용 1페이지 요약과 실행 항목을 작성해줘.', taskType:'research', taskComplexity:'high', preferredEngine:'hybrid', preferredModel:'claude', optimizationMode:'document', autoMode:true, priorityMode:'quality' },
  desktop_agent: { label:'비서형 에이전트', userRequest:'복합 작업을 단계별로 계획하고 필요한 도구를 골라 실행 전략을 작성해줘.', taskType:'desktop', taskComplexity:'high', preferredEngine:'openclaw', preferredModel:'gpt', optimizationMode:'balanced', autoMode:true, priorityMode:'quality' }
};

const CONFIG = {
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL || '',
  openclawWebhookUrl: process.env.OPENCLAW_WEBHOOK_URL || '',
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 20000),
  perfProfile: process.env.PERF_PROFILE || 'turbo-local',
  hasKeys: { openai:Boolean(process.env.OPENAI_API_KEY), gemini:Boolean(process.env.GEMINI_API_KEY), anthropic:Boolean(process.env.ANTHROPIC_API_KEY) },
  defaults: { engine:process.env.DEFAULT_ENGINE||'hybrid', model:process.env.DEFAULT_MODEL||'gemini', priorityMode:process.env.DEFAULT_PRIORITY_MODE||'balanced' }
};

function summarizeProviders() {
  return { n8n:CONFIG.n8nWebhookUrl?'connected':'simulation', openclaw:CONFIG.openclawWebhookUrl?'connected':'simulation', gpt:CONFIG.hasKeys.openai?'ready':'missing-key', gemini:CONFIG.hasKeys.gemini?'ready':'missing-key', claude:CONFIG.hasKeys.anthropic?'ready':'missing-key' };
}

function chooseEngine({ taskType, preferredEngine, autoMode, priorityMode }) {
  if (!autoMode && preferredEngine !== 'hybrid') return { engine:preferredEngine, reason:'사용자가 직접 선택' };
  if (priorityMode === 'speed' && taskType !== 'desktop') return { engine:'n8n', reason:'속도 우선' };
  if (preferredEngine === 'hybrid' || autoMode) {
    if (new Set(['repeat','notify','email','news','sheet']).has(taskType)) return { engine:'n8n', reason:'반복형 업무' };
    if (new Set(['agent','research','multistep','desktop']).has(taskType)) return { engine:'openclaw', reason:'복합 판단형' };
  }
  return { engine:preferredEngine==='hybrid'?'n8n':preferredEngine, reason:'기본 라우팅' };
}

function chooseModel({ taskComplexity, preferredModel, optimizationMode, priorityMode }) {
  if (optimizationMode === 'manual') return { model:preferredModel, reason:'사용자가 직접 선택' };
  if (optimizationMode === 'cost') return { model:'gemini', reason:'비용 우선' };
  if (optimizationMode === 'document') return { model:'claude', reason:'문서형 작업' };
  if (priorityMode === 'speed' && taskComplexity !== 'high') return { model:'gemini', reason:'속도 우선' };
  if (taskComplexity === 'high' && priorityMode === 'quality') return { model:preferredModel==='claude'?'claude':'gpt', reason:'고난도+품질 우선' };
  if (taskComplexity === 'high') return { model:'gpt', reason:'복잡한 추론' };
  return { model:preferredModel, reason:'기본 모델' };
}

function buildPayload(body) {
  const normalized = { userRequest:String(body.userRequest||'').trim(), taskType:body.taskType||'news', taskComplexity:body.taskComplexity||'medium', preferredEngine:body.preferredEngine||CONFIG.defaults.engine, preferredModel:body.preferredModel||CONFIG.defaults.model, optimizationMode:body.optimizationMode||'balanced', autoMode:Boolean(body.autoMode), priorityMode:body.priorityMode||CONFIG.defaults.priorityMode };
  return { ...normalized, engineDecision:chooseEngine(normalized), modelDecision:chooseModel(normalized), providers:summarizeProviders(), requestedAt:new Date().toISOString() };
}

async function forwardToTarget(url, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), signal:controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0,300)}`);
    const ct = response.headers.get('content-type')||'';
    return { durationMs:Date.now()-started, body:ct.includes('application/json')?await response.json():{raw:await response.text()} };
  } finally { clearTimeout(timeout); }
}

async function callClaude(userRequest, taskType, taskComplexity) {
  const started = Date.now();
  const response = await anthropic.messages.create({ model:'claude-sonnet-4-20250514', max_tokens:1024, system:`당신은 유능한 AI 어시스턴트입니다.\n작업 유형: ${taskType}\n작업 복잡도: ${taskComplexity}\n한국어로 명확하고 구조적으로 답변해주세요.`, messages:[{role:'user',content:userRequest}] });
  return { durationMs:Date.now()-started, body:{answer:response.content[0]?.text||'', model:response.model, usage:response.usage} };
}

function getUserAlpacaKeys(userId, accountId) {
  let row;
  if (accountId) { row = db.prepare('SELECT alpaca_api_key,alpaca_secret_key,alpaca_paper FROM user_broker_keys WHERE id=? AND user_id=?').get(accountId,userId); }
  else {
    row = db.prepare('SELECT alpaca_api_key,alpaca_secret_key,alpaca_paper FROM user_broker_keys WHERE user_id=? AND is_active=1').get(userId);
    if (!row) row = db.prepare('SELECT alpaca_api_key,alpaca_secret_key,alpaca_paper FROM user_broker_keys WHERE user_id=? LIMIT 1').get(userId);
  }
  if (!row) return null;
  try { return { api_key:decryptEmail(row.alpaca_api_key), secret_key:decryptEmail(row.alpaca_secret_key), paper:row.alpaca_paper===1 }; } catch(e) { return null; }
}

// ============================================================
// 미들웨어
// ============================================================
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy:false, crossOriginEmbedderPolicy:false }));

const globalLimit = rateLimit({ windowMs:15*60*1000, max:300, message:{error:'너무 많은 요청입니다.'}, handler:(req,res,next,options)=>{ const ip=req.ip; logger.warn('RATE_LIMIT_EXCEEDED',{ip,path:req.path}); saveAccessLog({ip,method:req.method,path:req.path,statusCode:429,userAgent:req.headers['user-agent']||'',referer:req.headers['referer']||'',responseTime:0,eventType:'rate_limit'}); res.status(429).json(options.message); } });
const authLimit = rateLimit({ windowMs:15*60*1000, max:20, message:{error:'로그인 시도가 너무 많습니다.'} });

app.use(globalLimit);
app.use('/api/auth/login', authLimit);
app.use('/api/auth/register', authLimit);
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit:'1mb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  const startTime = Date.now();
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    logger.info('ACCESS', { ip, method:req.method, path:req.path, statusCode:res.statusCode, userId:req.user?.id, username:req.user?.username, userAgent:req.headers['user-agent'], referer:req.headers['referer'], responseTime });
    if (!req.path.match(/\.(js|css|ico|png|jpg|svg|woff)$/)) saveAccessLog({ ip, method:req.method, path:req.path, statusCode:res.statusCode, userId:req.user?.id, username:req.user?.username, userAgent:req.headers['user-agent']||'', referer:req.headers['referer']||'', responseTime });
    const suspiciousPatterns = ['/etc/passwd','../','eval(','<script','UNION SELECT','DROP TABLE','/admin.php','/wp-admin'];
    if (suspiciousPatterns.some(p => req.path.toLowerCase().includes(p.toLowerCase()))) { logger.warn('SUSPICIOUS_REQUEST',{ip,method:req.method,path:req.path}); saveAccessLog({ip,method:req.method,path:req.path,statusCode:res.statusCode,userAgent:req.headers['user-agent']||'',referer:req.headers['referer']||'',responseTime,eventType:'suspicious'}); }
  });
  next();
});

function authMiddleware(req, res, next) {
  const publicApis = ['/api/auth/login','/api/auth/verify','/api/auth/register','/api/auth/forgot-password','/api/auth/send-email-code','/api/auth/verify-email-code','/api/auth/check-username','/api/auth/check-email','/api/news/save'];
  if (!req.path.startsWith('/api/')) return next();
  const token = req.headers.authorization?.replace('Bearer ','') || req.cookies?.auth_token;
  if (token) { try { req.user = jwt.verify(token, JWT_SECRET); } catch(e) {} }
  if (publicApis.some(p => req.path.startsWith(p))) return next();
  if (!req.user) return res.status(401).json({ error:'인증이 필요합니다.' });
  next();
}

app.use(authMiddleware);
app.use((req, res, next) => { if (req.path.startsWith('/api/')) return next(); express.static(path.join(__dirname,'public'),{etag:false,maxAge:0})(req,res,next); });
app.use((req, res, next) => { requestStats.total+=1; res.setHeader('Cache-Control','no-store'); next(); });

// ============================================================
// 라우트 연결
// ============================================================
const deps = { db, bcrypt, jwt, JWT_SECRET, JWT_EXPIRES, sendMail, encryptEmail, decryptEmail, verifyCodeStore, loginAttempts, logger, saveAccessLog, saveErrorLog, errorLogDir, fs, logClients, __dirname };
const frontDeps = { ...deps, anthropic, CONFIG, PRESETS, requestStats, startedAt, getUserAlpacaKeys, buildPayload, forwardToTarget, callClaude, summarizeProviders };

app.use('/api/auth', authRoutes(deps));
app.use('/', adminRoutes(deps));
app.use('/', frontRoutes(frontDeps));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error:'Not found' });
  res.sendFile(path.join(__dirname,'public','index.html'));
});

// ============================================================
// 에러 핸들러
// ============================================================
app.use((err, req, res, next) => {
  logger.error('SERVER_ERROR',{error:err.message,path:req.path});
  saveErrorLog({event_type:'SERVER_ERROR',error_message:err.message,stack_trace:err.stack,meta:{path:req.path,method:req.method}});
  res.status(500).json({ error:'서버 오류가 발생했습니다.' });
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  logger.error('UNHANDLED_REJECTION',{error:msg});
  saveErrorLog({event_type:'UNHANDLED_REJECTION',error_message:msg,stack_trace:reason instanceof Error?reason.stack:''});
});

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT_EXCEPTION',{error:err.message});
  saveErrorLog({event_type:'UNCAUGHT_EXCEPTION',error_message:err.message,stack_trace:err.stack});
});

// ============================================================
// 로또 자동 발송 스케줄러
// ============================================================
setInterval(async () => {
  try {
    const now = new Date();
    if (now.getMinutes() !== 0) return;
    const currentHour = now.getHours(), currentDay = now.getDay(), today = now.toISOString().split('T')[0];
    if (currentDay === 6 && currentHour >= 20) return;
    const schedules = db.prepare('SELECT ls.*, ut.chat_id, ut.bot_token FROM lotto_schedule ls JOIN user_telegram ut ON ls.user_id=ut.user_id WHERE ls.enabled=1 AND ls.hour=?').all(currentHour);
    for (const sch of schedules) {
      const days = sch.days.split(',').map(Number);
      if (!days.includes(currentDay) || sch.last_sent_at?.startsWith(today)) continue;
      const DEFAULT_WEIGHTS = {freq:20,hot:20,cold:10,balance:15,zone:10,ac:10,prime:5,delta:10};
      const wRow = db.prepare('SELECT weights FROM lotto_algorithm_weights WHERE user_id=?').get(sch.user_id);
      let algos = {...DEFAULT_WEIGHTS};
      if (wRow) { try { algos = {...DEFAULT_WEIGHTS,...JSON.parse(wRow.weights)}; } catch {} }
      const HOT_SET = new Set([3,7,14,18,23,27,34,40,42]), COLD_SET = new Set([1,5,9,12,20,28,33,38,44]), PRIME_SET = new Set([2,3,5,7,11,13,17,19,23,29,31,37,41,43]);
      function getScore(n) { let s=1; if(algos.freq>0)s+=algos.freq*(n%9+1)*0.01; if(algos.hot>0&&HOT_SET.has(n))s+=algos.hot*0.08; if(algos.cold>0&&COLD_SET.has(n))s+=algos.cold*0.07; if(algos.balance>0&&n%2===0)s+=algos.balance*0.02; if(algos.zone>0)s+=algos.zone*0.015; if(algos.ac>0)s+=algos.ac*((n*7)%11)*0.005; if(algos.prime>0&&PRIME_SET.has(n))s+=algos.prime*0.04; if(algos.delta>0)s+=algos.delta*((46-n)%6)*0.005; return s; }
      function generateAlgoGame() { const picked=new Set(); while(picked.size<6){const pool=[];for(let n=1;n<=45;n++){if(!picked.has(n))pool.push({n,w:getScore(n)});}const total=pool.reduce((s,x)=>s+x.w,0);let r=Math.random()*total;for(const item of pool){r-=item.w;if(r<=0){picked.add(item.n);break;}}if(picked.size<6&&pool.length>0)picked.add(pool[pool.length-1].n);}return[...picked].sort((a,b)=>a-b); }
      const games = Array.from({length:sch.game_count},()=>generateAlgoGame());
      db.prepare('DELETE FROM lotto_picks WHERE user_id=? AND pick_date=?').run(sch.user_id,today);
      const stmt = db.prepare('INSERT INTO lotto_picks (user_id,pick_date,game_index,numbers,algorithms) VALUES (?,?,?,?,?)');
      games.forEach((nums,i)=>stmt.run(sch.user_id,today,i,JSON.stringify(nums),'자동발송'));
      const token = sch.bot_token||process.env.TG_BOT_TOKEN;
      if (token&&sch.chat_id) {
        const dayNames=['일','월','화','수','목','금','토'];
        const lines = games.map((g,i)=>`${String.fromCharCode(65+i)}게임: ${g.map(n=>`*${n}*`).join(' ')}`).join('\n');
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:sch.chat_id,text:`🍀 *로또 자동 추천* (${today})\n\n${lines}\n\n📅 ${dayNames[currentDay]}요일 ${currentHour}시 자동발송`,parse_mode:'Markdown'})}).catch(()=>{});
      }
      db.prepare('UPDATE lotto_schedule SET last_sent_at=CURRENT_TIMESTAMP WHERE user_id=?').run(sch.user_id);
      db.prepare('INSERT INTO lotto_schedule_log (user_id,day,hour,game_count) VALUES (?,?,?,?)').run(sch.user_id,currentDay,currentHour,sch.game_count);
    }
  } catch(e) { saveErrorLog({event_type:'LOTTO_SCHEDULE_SAVE_ERROR',error_message:e.message,stack_trace:e.stack}); }
}, 60*1000);

// ============================================================
// 자동매매 스케줄러
// ============================================================
function calcEMA(prices,period){const k=2/(period+1);let ema=prices.slice(0,period).reduce((a,b)=>a+b,0)/period;for(let i=period;i<prices.length;i++)ema=prices[i]*k+ema*(1-k);return ema;}
function calcMACD(closes){if(closes.length<35)return null;const macdLine=[];for(let i=26;i<=closes.length;i++)macdLine.push(calcEMA(closes.slice(0,i),12)-calcEMA(closes.slice(0,i),26));if(macdLine.length<9)return null;const macd=macdLine[macdLine.length-1],signal=calcEMA(macdLine,9),prevMacd=macdLine[macdLine.length-2],prevSignal=calcEMA(macdLine.slice(0,-1),9);return{macd,signal,goldenCross:prevMacd<prevSignal&&macd>signal,deadCross:prevMacd>prevSignal&&macd<signal};}
function calcRSI(closes,period=14){if(closes.length<period+1)return null;const changes=closes.slice(1).map((c,i)=>c-closes[i]);const avgGain=changes.slice(-period).filter(c=>c>0).reduce((a,b)=>a+b,0)/period;const avgLoss=changes.slice(-period).filter(c=>c<0).reduce((a,b)=>a-b,0)/period;return avgLoss===0?100:100-(100/(1+avgGain/avgLoss));}

async function runAutoTradeForUser(userId) {
  const settings = db.prepare('SELECT * FROM auto_trade_settings WHERE user_id=? AND enabled=1').get(userId);
  if (!settings) return {ok:false,message:'자동매매 비활성화 상태'};
  const keys = getUserAlpacaKeys(userId,null);
  if (!keys) return {ok:false,message:'Alpaca 키 없음'};
  const baseUrl = keys.paper?'https://paper-api.alpaca.markets':'https://api.alpaca.markets';
  const headers = {'APCA-API-KEY-ID':keys.api_key,'APCA-API-SECRET-KEY':keys.secret_key,'Content-Type':'application/json'};
  const results=[];
  try {
    const buyingPower = parseFloat((await(await fetch(`${baseUrl}/v2/account`,{headers})).json()).buying_power)||0;
    const posData = await(await fetch(`${baseUrl}/v2/positions`,{headers})).json();
    const positions = Array.isArray(posData)?posData:(posData.positions||[]);
    for(const pos of positions){
      const plPct=parseFloat(pos.unrealized_plpc)||0;
      if(plPct>=(settings.take_profit||0.05)){try{const order=await(await fetch(`${baseUrl}/v2/orders`,{method:'POST',headers,body:JSON.stringify({symbol:pos.symbol,qty:pos.qty,side:'sell',type:'market',time_in_force:'day'})})).json();db.prepare('INSERT INTO auto_trade_log (user_id,symbol,action,qty,price,reason,order_id,profit_pct,status) VALUES (?,?,?,?,?,?,?,?,?)').run(userId,pos.symbol,'SELL_PROFIT',pos.qty,pos.current_price,`익절 +${(plPct*100).toFixed(2)}%`,order.id||'',plPct*100,'closed');db.prepare("UPDATE auto_trade_log SET status='closed' WHERE user_id=? AND symbol=? AND action='BUY' AND status='active'").run(userId,pos.symbol);results.push({symbol:pos.symbol,action:'익절 매도'});}catch(e){}}
      else if(plPct<=-(settings.stop_loss||0.05)){try{const order=await(await fetch(`${baseUrl}/v2/orders`,{method:'POST',headers,body:JSON.stringify({symbol:pos.symbol,qty:pos.qty,side:'sell',type:'market',time_in_force:'day'})})).json();db.prepare('INSERT INTO auto_trade_log (user_id,symbol,action,qty,price,reason,order_id,profit_pct,status) VALUES (?,?,?,?,?,?,?,?,?)').run(userId,pos.symbol,'SELL_LOSS',pos.qty,pos.current_price,`손절 ${(plPct*100).toFixed(2)}%`,order.id||'',plPct*100,'closed');db.prepare("UPDATE auto_trade_log SET status='closed' WHERE user_id=? AND symbol=? AND action='BUY' AND status='active'").run(userId,pos.symbol);results.push({symbol:pos.symbol,action:'손절 매도'});}catch(e){}}
    }
    const heldSymbols=new Set(positions.map(p=>p.symbol));
    const autoHeld=db.prepare("SELECT DISTINCT symbol FROM auto_trade_log WHERE user_id=? AND action='BUY' AND status='active'").all(userId).map(r=>r.symbol);
    const needMore=(settings.max_positions||3)-autoHeld.filter(s=>heldSymbols.has(s)).length;
    const candidatePool=[...new Set([...(settings.symbols||'QQQ,SPY,AAPL').split(','),...(settings.candidate_symbols||'QQQ,SPY,AAPL,NVDA,MSFT,GOOGL,AMZN,TSLA,META,AMD').split(',')].map(s=>s.trim()).filter(Boolean))];
    const buyAmount=buyingPower*(settings.balance_ratio||0.1);let boughtCount=0;
    for(const symbol of candidatePool){
      if(boughtCount>=needMore||heldSymbols.has(symbol)||buyAmount<10)continue;
      try{
        const end=new Date().toISOString().split('T')[0],start=new Date(Date.now()-90*24*60*60*1000).toISOString().split('T')[0];
        const bars=(await(await fetch(`https://data.alpaca.markets/v2/stocks/${symbol}/bars?timeframe=1Day&start=${start}&end=${end}&limit=60`,{headers})).json()).bars||[];
        if(bars.length<35)continue;
        const closes=bars.map(b=>b.c),currentPrice=closes[closes.length-1];
        let buySignal=false,reason='';
        const mode=settings.signal_mode||'combined';
        if(mode==='macd'||mode==='combined'){const m=calcMACD(closes);if(m?.goldenCross){buySignal=true;reason='MACD 골든크로스';}}
        if(mode==='combined'&&!buySignal){const rsi=calcRSI(closes);if(rsi&&rsi<40){buySignal=true;reason=`RSI 과매도 (${rsi.toFixed(1)})`;}}
        if(buySignal&&currentPrice>0){const qty=Math.floor(buyAmount/currentPrice);if(qty<1)continue;const order=await(await fetch(`${baseUrl}/v2/orders`,{method:'POST',headers,body:JSON.stringify({symbol,qty:String(qty),side:'buy',type:'market',time_in_force:'day'})})).json();if(order.id){db.prepare('INSERT INTO auto_trade_log (user_id,symbol,action,qty,price,reason,order_id,profit_pct,status) VALUES (?,?,?,?,?,?,?,?,?)').run(userId,symbol,'BUY',qty,currentPrice,reason,order.id,0,'active');results.push({symbol,action:'매수',qty,reason});boughtCount++;}}
      }catch(e){saveErrorLog({event_type:'AUTO_TRADE_ERROR',error_message:e.message,stack_trace:e.stack,meta:{symbol,userId}});}
    }
  }catch(e){return{ok:false,message:e.message};}
  return{ok:true,results,message:results.length?`${results.length}건 실행`:'신호 없음'};
}

setInterval(async()=>{
  try{
    const now=new Date(),utcHour=now.getUTCHours(),utcMin=now.getUTCMinutes();
    const isMarketHours=(utcHour===14&&utcMin>=30)||(utcHour>14&&utcHour<21);
    if(!isMarketHours)return;
    const users=db.prepare('SELECT user_id FROM auto_trade_settings WHERE enabled=1').all();
    for(const u of users)await runAutoTradeForUser(u.user_id);
  }catch(e){saveErrorLog({event_type:'AUTO_TRADE_SCHEDULER_ERROR',error_message:e.message,stack_trace:e.stack});}
},60*1000);

// ============================================================
// 서버 시작
// ============================================================
app.listen(port, '0.0.0.0', () => {
  console.log('');
  console.log(`${C.bright}${C.magenta}  ╔══════════════════════════════════╗${C.reset}`);
  console.log(`${C.bright}${C.magenta}  ║   🚀  spagenio  Dashboard        ║${C.reset}`);
  console.log(`${C.bright}${C.magenta}  ╚══════════════════════════════════╝${C.reset}`);
  console.log(`  ${C.cyan}포트${C.reset}     : ${C.white}${port}${C.reset}`);
  console.log(`  ${C.cyan}Claude${C.reset}   : ${CONFIG.hasKeys.anthropic?C.green+'✅ 연결됨':C.red+'❌ API 키 없음'}${C.reset}`);
  console.log('');
});
