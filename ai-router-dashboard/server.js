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

// ── NaN/Infinity 공통 처리 (모든 res.json에 자동 적용) ──
app.use((req, res, next) => {
  const _json = res.json.bind(res);
  res.json = function(obj) {
    try {
      const cleaned = JSON.parse(JSON.stringify(obj, (_, v) =>
        typeof v === 'number' && !isFinite(v) ? null : v
      ));
      return _json(cleaned);
    } catch(e) {
      return _json(obj);
    }
  };
  next();
});


const port = Number(process.env.PORT || 3000);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ============================================================
// DB 초기화
// ============================================================
const dbPath = path.join(__dirname, 'news.db');
const db = new Database(dbPath);

db.exec(`

`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, email TEXT, created_type INTEGER DEFAULT 2, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_login DATETIME);
  -- created_type: 1=관리자생성(일반로그인 불가), 2=일반가입
  CREATE TABLE IF NOT EXISTS admin_roles (id INTEGER PRIMARY KEY AUTOINCREMENT, role_name TEXT UNIQUE NOT NULL, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, email TEXT, role_id INTEGER, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_login DATETIME, FOREIGN KEY (role_id) REFERENCES admin_roles(id));
  CREATE TABLE IF NOT EXISTS user_broker_keys (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, account_name TEXT NOT NULL DEFAULT '기본 계좌', alpaca_api_key TEXT, alpaca_secret_key TEXT, alpaca_paper INTEGER DEFAULT 1, is_active INTEGER DEFAULT 0, account_type INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id));
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
  CREATE TABLE IF NOT EXISTS lotto_schedule_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, days TEXT, hour INTEGER, game_count INTEGER, drw_no INTEGER, action TEXT DEFAULT 'update', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS lotto_schedule (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE, enabled INTEGER DEFAULT 0, days TEXT DEFAULT '1,2,3,4,5,6', hour INTEGER DEFAULT 9, game_count INTEGER DEFAULT 5, last_sent_at DATETIME, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS lotto_algorithm_weights (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE, weights TEXT NOT NULL DEFAULT '{}', updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS auto_trade_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE, enabled INTEGER DEFAULT 0, symbols TEXT DEFAULT 'QQQ,SPY,AAPL', candidate_symbols TEXT DEFAULT 'QQQ,SPY,AAPL,NVDA,MSFT,GOOGL,AMZN,TSLA,META,AMD', max_positions INTEGER DEFAULT 3, balance_ratio REAL DEFAULT 0.1, take_profit REAL DEFAULT 0.05, stop_loss REAL DEFAULT 0.05, signal_mode TEXT DEFAULT 'combined', updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS schedulers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, key TEXT UNIQUE NOT NULL, enabled INTEGER DEFAULT 1, interval_sec INTEGER DEFAULT 60, description TEXT, last_run DATETIME, run_count INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS menus (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT DEFAULT '', parent_id INTEGER DEFAULT NULL, sort_order INTEGER DEFAULT 0, tab_key TEXT, sub_key TEXT, enabled INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS simple_auto_trade (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE, enabled INTEGER DEFAULT 0, symbol TEXT, qty REAL, buy_price REAL, order_id TEXT, status TEXT DEFAULT 'idle', balance_ratio REAL DEFAULT 0.3, take_profit REAL DEFAULT 0.05, stop_loss REAL DEFAULT 0.05, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id));
`);

// [레거시 제거] auto_trade_log ALTER 제거됨

// ── trade_log 통합 테이블 ──
try {
  db.exec(`CREATE TABLE IF NOT EXISTS trade_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    trade_type INTEGER NOT NULL DEFAULT 1,
    symbol TEXT NOT NULL,
    action TEXT NOT NULL,
    qty REAL,
    price REAL,
    reason TEXT,
    order_id TEXT,
    profit_pct REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
} catch(e) {}

// ── 기존 데이터 마이그레이션 ──
try {
  if (db.prepare("SELECT COUNT(*) as c FROM trade_log WHERE trade_type=4").get().c === 0) {
    const rows = (function(){ try { return db.prepare("SELECT * FROM auto_trade_log").all(); } catch(e) { return []; } })();
    const ins = db.prepare("INSERT OR IGNORE INTO trade_log (id,user_id,trade_type,symbol,action,qty,price,reason,order_id,profit_pct,status,created_at) VALUES (?,?,4,?,?,?,?,?,?,?,?,?)");
    rows.forEach(r => ins.run(r.id, r.user_id, r.symbol, r.action, r.qty, r.price, r.reason, r.order_id, r.profit_pct||0, r.status||'active', r.created_at));
    console.log('[trade_log] 일반자동 마이그레이션:', rows.length, '건');
  }
} catch(e) {}
try {
  if (db.prepare("SELECT COUNT(*) as c FROM trade_log WHERE trade_type=2").get().c === 0) {
    const rows = (function(){ try { return db.prepare("SELECT * FROM simple_auto_trade_log").all(); } catch(e) { return []; } })();
    const ins = db.prepare("INSERT OR IGNORE INTO trade_log (user_id,trade_type,symbol,action,qty,price,profit_pct,reason,status,created_at) VALUES (?,2,?,?,?,?,?,?,?,?)");
    rows.forEach(r => ins.run(r.user_id, r.symbol, r.action, r.qty, r.price, r.profit_pct||0, r.reason, r.action==='BUY'?'active':'closed', r.created_at));
    console.log('[trade_log] 단순자동 마이그레이션:', rows.length, '건');
  }
  // ── 레거시 테이블 DROP (마이그레이션 완료 후 제거) ──
  // try { db.exec('DROP TABLE IF EXISTS auto_trade_log'); console.log('[trade_log] auto_trade_log 테이블 삭제 완료'); } catch(e) {}
  // try { db.exec('DROP TABLE IF EXISTS simple_auto_trade_log'); console.log('[trade_log] simple_auto_trade_log 테이블 삭제 완료'); } catch(e) {}
} catch(e) {}

// ── trade_log 백업 테이블 4개 (타입별 별도 관리) ──
try {
  const backupCols = `(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_log_id INTEGER,
    user_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    action TEXT NOT NULL,
    qty REAL,
    price REAL,
    reason TEXT,
    order_id TEXT,
    profit_pct REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`;
  db.exec('CREATE TABLE IF NOT EXISTS trade_log_manual'  + backupCols); // type=1 수동
  db.exec('CREATE TABLE IF NOT EXISTS trade_log_simple'  + backupCols); // type=2 단순자동
  db.exec('CREATE TABLE IF NOT EXISTS trade_log_full'    + backupCols); // type=3 완전자동
  db.exec('CREATE TABLE IF NOT EXISTS trade_log_general' + backupCols); // type=4 일반자동
} catch(e) {}

// ── saveTradeLog 헬퍼: trade_log + 타입별 백업 테이블 동시 INSERT ──
function saveTradeLog({ user_id, trade_type, symbol, action, qty, price, reason, order_id, profit_pct, status }) {
  order_id   = order_id   || '';
  profit_pct = profit_pct || 0;
  reason     = reason     || '';
  status     = status     || 'active';

  // 1. 통합 trade_log INSERT
  const result = db.prepare(
    'INSERT INTO trade_log (user_id,trade_type,symbol,action,qty,price,reason,order_id,profit_pct,status) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(user_id, trade_type, symbol, action, qty, price, reason, order_id, profit_pct, status);

  const trade_log_id = result.lastInsertRowid;

  // 2. 타입별 백업 테이블 INSERT
  const backupTableMap = { 1: 'trade_log_manual', 2: 'trade_log_simple', 3: 'trade_log_full', 4: 'trade_log_general' };
  const backupTable = backupTableMap[trade_type];
  if (backupTable) {
    try {
      db.prepare(
        `INSERT INTO ${backupTable} (trade_log_id,user_id,symbol,action,qty,price,reason,order_id,profit_pct,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`
      ).run(trade_log_id, user_id, symbol, action, qty, price, reason, order_id, profit_pct, status);
    } catch(e) { console.error('[saveTradeLog] 백업 실패:', backupTable, e.message); }
  }

  return trade_log_id;

}
// ── updateTradeLogStatus 헬퍼: trade_log + 백업 테이블 status 동시 UPDATE ──
function updateTradeLogStatus(user_id, symbol, trade_type) {
  const backupTableMap = { 1: 'trade_log_manual', 2: 'trade_log_simple', 3: 'trade_log_full', 4: 'trade_log_general' };

  // 1. trade_log UPDATE
  db.prepare(
    "UPDATE trade_log SET status='closed' WHERE user_id=? AND symbol=? AND trade_type=? AND action='BUY' AND status='active'"
  ).run(user_id, symbol, trade_type);

  // 2. 백업 테이블도 동시 UPDATE
  const backupTable = backupTableMap[trade_type];
  if (backupTable) {
    try {
      // 백업 테이블은 trade_log_id 기준으로 연결 — symbol + user_id로 매칭
      db.prepare(
        `UPDATE ${backupTable} SET status='closed' WHERE user_id=? AND symbol=? AND action='BUY' AND status='active'`
      ).run(user_id, symbol);
    } catch(e) { console.error('[updateTradeLogStatus] 백업 업데이트 실패:', backupTable, e.message); }
  }
}


try { db.exec("ALTER TABLE user_broker_keys ADD COLUMN account_type INTEGER DEFAULT 0"); } catch(e) {}
// account_type: 0=미설정, 1=수동전용, 2=자동전용
try { db.exec("ALTER TABLE portfolio_performance ADD COLUMN account_type INTEGER DEFAULT 0"); } catch(e) {}
try { db.exec("ALTER TABLE auto_trade_settings ADD COLUMN factor_strategy TEXT DEFAULT 'value_quality'"); } catch (e) { }
try { db.exec("ALTER TABLE auto_trade_settings ADD COLUMN factor_market TEXT DEFAULT 'nasdaq'"); } catch (e) { }

// 투자 성향 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS investor_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    -- 설문 응답 (각 1~3점)
    q_period INTEGER DEFAULT 2,        -- 투자 기간 (1:단기 2:중기 3:장기)
    q_loss INTEGER DEFAULT 2,          -- 손실 허용 (1:-5% 2:-10% 3:-20%)
    q_return INTEGER DEFAULT 2,        -- 수익 목표 (1:10% 2:20% 3:30%+)
    q_style INTEGER DEFAULT 2,         -- 선호 스타일 (1:대형우량 2:혼합 3:성장주)
    q_experience INTEGER DEFAULT 2,    -- 투자 경험 (1:초보 2:1~3년 3:3년+)
    -- 성향 결과
    profile_type TEXT DEFAULT 'balanced', -- aggressive/balanced/conservative/beginner
    profile_score INTEGER DEFAULT 10,     -- 총점 (5~15)
    -- 성향별 팩터 가중치 (합계 = 1.0)
    w_momentum REAL DEFAULT 0.35,
    w_value REAL DEFAULT 0.30,
    w_quality REAL DEFAULT 0.25,
    w_news REAL DEFAULT 0.10,
    -- 리스크 파라미터
    risk_take_profit REAL DEFAULT 0.10,
    risk_stop_loss REAL DEFAULT 0.05,
    risk_max_positions INTEGER DEFAULT 5,
    risk_balance_ratio REAL DEFAULT 0.20,
    completed INTEGER DEFAULT 0,      -- 설문 완료 여부
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// 완전자동매매 전략 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS auto_strategy_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    enabled INTEGER DEFAULT 0,
    market TEXT DEFAULT 'nasdaq',
    roe_min REAL DEFAULT 15,
    debt_max REAL DEFAULT 100,
    revenue_min REAL DEFAULT 10,
    momentum_top REAL DEFAULT 30,
    sma200_filter INTEGER DEFAULT 1,
    use_macd INTEGER DEFAULT 1,
    use_rsi INTEGER DEFAULT 1,
    rsi_threshold REAL DEFAULT 40,
    use_bb INTEGER DEFAULT 1,
    balance_ratio REAL DEFAULT 0.2,
    max_positions INTEGER DEFAULT 5,
    take_profit1 REAL DEFAULT 0.1,
    take_profit2 REAL DEFAULT 0.2,
    stop_loss REAL DEFAULT 0.05,
    factor_exit INTEGER DEFAULT 1,
    sma200_exit INTEGER DEFAULT 1,
    last_rebalanced_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS auto_strategy_pool (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    factor_score REAL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, symbol)
  );
`);

// ===== 신규 기능 테이블 =====
db.exec(`
  -- 1. 성과 대시보드: 매매 성과 스냅샷
  CREATE TABLE IF NOT EXISTS portfolio_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    snapshot_date TEXT NOT NULL,           -- YYYY-MM-DD
    account_type INTEGER DEFAULT 0,        -- 0=전체, 1=수동전용, 2=자동전용
    total_equity REAL,                     -- 총 평가금액
    cash REAL,                             -- 현금
    portfolio_value REAL,                  -- 주식 평가액
    daily_pnl REAL,                        -- 일일 손익
    daily_pnl_pct REAL,                    -- 일일 수익률 %
    total_pnl REAL,                        -- 누적 손익
    total_pnl_pct REAL,                    -- 누적 수익률 %
    win_count INTEGER DEFAULT 0,           -- 익절 횟수
    loss_count INTEGER DEFAULT 0,          -- 손절 횟수
    max_drawdown REAL DEFAULT 0,           -- 최대 낙폭 (MDD)
    peak_equity REAL,                      -- 최고 자산
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, snapshot_date, account_type),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- 2. 백테스트 결과 저장
  CREATE TABLE IF NOT EXISTS backtest_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT,                             -- 결과 이름 (직접 지정)
    symbol TEXT NOT NULL,
    strategy TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    initial_capital REAL,
    final_capital REAL,
    total_return REAL,                     -- 총 수익률 %
    annual_return REAL,                    -- 연환산 수익률 %
    max_drawdown REAL,                     -- MDD %
    sharpe_ratio REAL,                     -- 샤프 비율
    win_rate REAL,                         -- 승률 %
    total_trades INTEGER,
    win_trades INTEGER,
    loss_trades INTEGER,
    take_profit REAL,
    stop_loss REAL,
    result_json TEXT,                      -- 전체 결과 JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- 3. 텔레그램 알림 로그
  CREATE TABLE IF NOT EXISTS telegram_alert_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    alert_type TEXT NOT NULL,              -- TRADE/RISK/SIGNAL/MARKET
    message TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// 퀀트 분석 이력 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS quant_analysis_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    strategy TEXT NOT NULL,
    signal TEXT,
    price REAL,
    value REAL,
    score REAL,
    reason TEXT,
    indicators TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_quant_log_user ON quant_analysis_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_quant_log_symbol ON quant_analysis_log(symbol);
`);

// ============================================================
// DB 메타 코멘트 테이블
// ============================================================
// ✅ RSS 소스 관리 테이블
db.exec(`
  CREATE TABLE IF NOT EXISTS rss_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'global',
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 기본 RSS 소스 삽입 (없을 때만)
const insertRss = db.prepare(`INSERT OR IGNORE INTO rss_sources (name, url, category) VALUES (?, ?, ?)`);
[
  ['BBC News',     'https://feeds.bbci.co.uk/news/rss.xml',       'global'],
  ['BBC World',    'https://feeds.bbci.co.uk/news/world/rss.xml', 'global'],
  ['Al Jazeera',   'https://www.aljazeera.com/xml/rss/all.xml',   'global'],
  ['NPR News',     'https://feeds.npr.org/1001/rss.xml',          'global'],
  ['NPR World',    'https://feeds.npr.org/1004/rss.xml',          'global'],
  ['The Guardian', 'https://www.theguardian.com/world/rss',       'global'],
].forEach(([name, url, category]) => insertRss.run(name, url, category));

// 차단된 rsshub.app 소스 정리
db.prepare("DELETE FROM rss_sources WHERE url LIKE '%rsshub.app%'").run();

db.exec(`
  CREATE TABLE IF NOT EXISTS db_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    column_name TEXT NOT NULL,
    comment TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(table_name, column_name)
  );
`);

// 코멘트 데이터 삽입 (upsert)
const upsertComment = db.prepare(`
  INSERT INTO db_comments (table_name, column_name, comment)
  VALUES (?, ?, ?)
  ON CONFLICT(table_name, column_name) DO UPDATE SET comment=excluded.comment, updated_at=CURRENT_TIMESTAMP
`);
const comments = [
  // news
  // users
  ['users', 'id', '자동 증가 PK'],
  ['users', 'username', '로그인 아이디 (3~10자, 영문/숫자/언더바)'],
  ['users', 'password_hash', 'bcrypt 12라운드 해시'],
  ['users', 'email', 'AES-256-CBC 암호화 저장'],
  ['users', 'created_at', '가입 시각'],
  ['users', 'last_login', '마지막 로그인 시각'],
  // user_broker_keys
  ['user_broker_keys', 'id', '자동 증가 PK'],
  ['user_broker_keys', 'user_id', 'users.id 참조'],
  ['user_broker_keys', 'account_name', '계좌 별칭'],
  ['user_broker_keys', 'alpaca_api_key', 'Alpaca API Key (AES-256 암호화)'],
  ['user_broker_keys', 'alpaca_secret_key', 'Alpaca Secret Key (AES-256 암호화)'],
  ['user_broker_keys', 'alpaca_paper', '페이퍼 트레이딩 여부 (1=페이퍼, 0=실거래)'],
  ['user_broker_keys', 'is_active', '현재 활성 계좌 여부 (1=활성)'],
  ['user_broker_keys', 'created_at', '등록 시각'],
  ['user_broker_keys', 'updated_at', '최종 수정 시각'],
  // terms_agreements
  ['terms_agreements', 'id', '자동 증가 PK'],
  ['terms_agreements', 'user_id', 'users.id 참조'],
  ['terms_agreements', 'agree_terms', '이용약관 동의 (0/1)'],
  ['terms_agreements', 'agree_privacy', '개인정보처리방침 동의 (0/1)'],
  ['terms_agreements', 'agree_investment', '투자위험고지 동의 (0/1)'],
  ['terms_agreements', 'agree_marketing', '마케팅 수신 동의 (0/1)'],
  ['terms_agreements', 'ip', '동의 시 IP 주소'],
  ['terms_agreements', 'agreed_at', '동의 시각'],
  // email_verifications
  ['email_verifications', 'id', '자동 증가 PK'],
  ['email_verifications', 'email', '인증 대상 이메일'],
  ['email_verifications', 'code', '6자리 인증코드'],
  ['email_verifications', 'verified', '인증 완료 여부 (0/1)'],
  ['email_verifications', 'created_at', '코드 발급 시각'],
  ['email_verifications', 'expires_at', '코드 만료 시각 (발급 후 60초)'],
  // invite_codes
  ['invite_codes', 'id', '자동 증가 PK'],
  ['invite_codes', 'code', '초대 코드 문자열 (UNIQUE)'],
  ['invite_codes', 'created_by', '코드 생성 관리자 user_id'],
  ['invite_codes', 'used_by', '코드 사용 유저 user_id'],
  ['invite_codes', 'used_at', '코드 사용 시각'],
  ['invite_codes', 'created_at', '코드 생성 시각'],
  ['invite_codes', 'expires_at', '코드 만료 시각'],
  // access_logs
  ['access_logs', 'id', '자동 증가 PK'],
  ['access_logs', 'timestamp', '요청 시각'],
  ['access_logs', 'ip', '클라이언트 IP'],
  ['access_logs', 'method', 'HTTP 메서드 (GET/POST 등)'],
  ['access_logs', 'path', '요청 경로'],
  ['access_logs', 'status_code', 'HTTP 응답 코드'],
  ['access_logs', 'user_id', '요청 유저 ID (비로그인 시 NULL)'],
  ['access_logs', 'username', '요청 유저명 (비로그인 시 NULL)'],
  ['access_logs', 'user_agent', '브라우저/클라이언트 정보'],
  ['access_logs', 'referer', '이전 페이지 URL'],
  ['access_logs', 'response_time', '응답 시간 (ms)'],
  ['access_logs', 'event_type', '이벤트 유형 (request/LOGIN_SUCCESS/LOGIN_FAILED 등)'],
  // user_telegram
  ['user_telegram', 'id', '자동 증가 PK'],
  ['user_telegram', 'user_id', 'users.id 참조 (UNIQUE — 1유저 1계정)'],
  ['user_telegram', 'chat_id', '텔레그램 Chat ID'],
  ['user_telegram', 'bot_token', '텔레그램 Bot Token (미입력 시 env TG_BOT_TOKEN 사용)'],
  ['user_telegram', 'created_at', '등록 시각'],
  ['user_telegram', 'updated_at', '최종 수정 시각'],
  // lotto_picks
  ['lotto_picks', 'id', '자동 증가 PK'],
  ['lotto_picks', 'user_id', 'users.id 참조'],
  ['lotto_picks', 'pick_date', '번호 생성 날짜 (YYYY-MM-DD)'],
  ['lotto_picks', 'game_index', '게임 순서 (0부터 시작)'],
  ['lotto_picks', 'numbers', '추천 번호 JSON 배열 (예: [1,7,23,33,40,42])'],
  ['lotto_picks', 'algorithms', '적용 알고리즘 정보'],
  ['lotto_picks', 'drw_no', '대응 당첨 회차 번호'],
  ['lotto_picks', 'rank', '당첨 등수 (NULL=미확인, 0=낙첨)'],
  ['lotto_picks', 'matched_count', '일치 번호 개수'],
  ['lotto_picks', 'bonus_match', '보너스 번호 일치 여부 (0/1)'],
  ['lotto_picks', 'created_at', '생성 시각'],
  // lotto_history
  ['lotto_history', 'drw_no', '회차 번호 (PK)'],
  ['lotto_history', 'numbers', '당첨 번호 JSON 배열'],
  ['lotto_history', 'bonus', '보너스 번호'],
  ['lotto_history', 'drw_date', '추첨 날짜'],
  ['lotto_history', 'created_at', '저장 시각'],
  // lotto_schedule
  ['lotto_schedule', 'id', '자동 증가 PK'],
  ['lotto_schedule', 'user_id', 'users.id 참조 (UNIQUE — 1유저 1스케줄)'],
  ['lotto_schedule', 'enabled', '스케줄 활성 여부 (0/1)'],
  ['lotto_schedule', 'days', '발송 요일 (0=일~6=토, 쉼표 구분)'],
  ['lotto_schedule', 'hour', '발송 시각 (0~23)'],
  ['lotto_schedule', 'game_count', '1회 발송 게임 수'],
  ['lotto_schedule', 'last_sent_at', '마지막 발송 시각'],
  ['lotto_schedule', 'updated_at', '최종 수정 시각'],
  // lotto_schedule_log
  ['lotto_schedule_log', 'id', '자동 증가 PK'],
  ['lotto_schedule_log', 'user_id', 'users.id 참조'],
  ['lotto_schedule_log', 'days', '발송된 요일'],
  ['lotto_schedule_log', 'hour', '발송된 시각'],
  ['lotto_schedule_log', 'game_count', '발송된 게임 수'],
  ['lotto_schedule_log', 'action', '액션 유형 (update/send)'],
  ['lotto_schedule_log', 'created_at', '로그 생성 시각'],
  // lotto_algorithm_weights
  ['lotto_algorithm_weights', 'id', '자동 증가 PK'],
  ['lotto_algorithm_weights', 'user_id', 'users.id 참조 (UNIQUE)'],
  ['lotto_algorithm_weights', 'weights', '알고리즘별 가중치 JSON (freq/hot/cold/balance/zone/ac/prime/delta)'],
  ['lotto_algorithm_weights', 'updated_at', '최종 수정 시각'],
  // auto_trade_settings
  ['auto_trade_settings', 'id', '자동 증가 PK'],
  ['auto_trade_settings', 'user_id', 'users.id 참조 (UNIQUE)'],
  ['auto_trade_settings', 'enabled', '자동매매 활성 여부 (0/1)'],
  ['auto_trade_settings', 'symbols', '매매 대상 종목 (쉼표 구분)'],
  ['auto_trade_settings', 'candidate_symbols', '매수 후보 종목 풀 (쉼표 구분)'],
  ['auto_trade_settings', 'max_positions', '최대 동시 보유 종목 수'],
  ['auto_trade_settings', 'balance_ratio', '계좌 잔고 대비 매수 비율 (0.1=10%)'],
  ['auto_trade_settings', 'take_profit', '익절 기준 수익률 (0.05=5%)'],
  ['auto_trade_settings', 'stop_loss', '손절 기준 손실률 (0.05=5%)'],
  ['auto_trade_settings', 'signal_mode', '매수 신호 방식 (macd/combined)'],
  ['auto_trade_settings', 'updated_at', '최종 수정 시각'],
  // quant_analysis_log
  ['quant_analysis_log', 'id', '자동 증가 PK'],
  ['quant_analysis_log', 'user_id', 'users.id 참조'],
  ['quant_analysis_log', 'symbol', '분석 종목 심볼'],
  ['quant_analysis_log', 'strategy', '분석 전략 (combined/rsi/bb/sma/macd)'],
  ['quant_analysis_log', 'signal', '매매 신호 (buy/weak_buy/hold/weak_sell/sell)'],
  ['quant_analysis_log', 'price', '분석 시점 현재가 ($)'],
  ['quant_analysis_log', 'value', '지표값 (전략별 상이)'],
  ['quant_analysis_log', 'score', '복합 점수'],
  ['quant_analysis_log', 'reason', '분석 요약 텍스트'],
  ['quant_analysis_log', 'indicators', '세부 지표 JSON'],
  ['quant_analysis_log', 'created_at', '분석 시각'],
  // db_comments
  ['db_comments', 'id', '자동 증가 PK'],
  ['db_comments', 'table_name', '테이블명'],
  ['db_comments', 'column_name', '컬럼명'],
  ['db_comments', 'comment', '컬럼 설명'],
  ['db_comments', 'updated_at', '최종 수정 시각'],
];
const insertComments = db.transaction(() => {
  comments.forEach(([table, column, comment]) => upsertComment.run(table, column, comment));
});
insertComments();
console.log('✅ DB 코멘트 초기화 완료');

// 기본 관리자 롤 생성
const superAdminRole = db.prepare("SELECT id FROM admin_roles WHERE role_name='superadmin'").get();
if (!superAdminRole) {
  db.prepare("INSERT INTO admin_roles (role_name, description) VALUES ('superadmin','슈퍼 관리자 - 모든 권한')").run();
  db.prepare("INSERT INTO admin_roles (role_name, description) VALUES ('manager','매니저 - 일반 관리 권한')").run();
}
// admins 테이블에 기본 admin 계정 생성
// created_by 컬럼 없으면 추가 (기존 DB 마이그레이션)
try { db.prepare("ALTER TABLE users ADD COLUMN created_type INTEGER DEFAULT 2").run(); } catch (e) { }
try { db.prepare("ALTER TABLE lotto_schedule_log ADD COLUMN drw_no INTEGER").run(); } catch (e) { }
try { db.prepare("ALTER TABLE auto_trade_settings ADD COLUMN candidate_symbols TEXT DEFAULT 'QQQ,SPY,AAPL,NVDA,MSFT,GOOGL,AMZN,TSLA,META,AMD'").run(); } catch (e) { }
try { db.exec("CREATE TABLE IF NOT EXISTS schedulers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, key TEXT UNIQUE NOT NULL, enabled INTEGER DEFAULT 1, interval_sec INTEGER DEFAULT 60, description TEXT, last_run DATETIME, run_count INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"); } catch (e) { }

// 기본 스케줄러 데이터 삽입
const schCount = db.prepare("SELECT COUNT(*) as cnt FROM schedulers").get();
if (schCount.cnt === 0) {
  const ins = db.prepare("INSERT OR IGNORE INTO schedulers (name, key, enabled, interval_sec, description) VALUES (?,?,?,?,?)");
  ins.run('로또 자동발송', 'lotto_send', 1, 3600, '유저 설정 기반 로또 번호 자동 텔레그램 발송 (매시 정각)');
  ins.run('미국 자동매매', 'auto_trade', 1, 60, 'MACD/RSI 기반 미국 주식 자동매매 (장시간 09:30~16:00 EST)');
  ins.run('단순 자동매매', 'simple_trade', 1, 60, 'TOP1 종목 당일 자동매매 (장시간, 15:55 강제청산)');
  ins.run('완전 자동매매', 'auto_strategy', 1, 60, '팩터 스크리닝 기반 완전자동매매 (장시간)');
  ins.run('로또 당첨번호 수집', 'lotto_history', 1, 60, '토요일 KST 21:00 당첨번호 자동 수집');
}

try { db.exec("CREATE TABLE IF NOT EXISTS menus (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT DEFAULT '', parent_id INTEGER DEFAULT NULL, sort_order INTEGER DEFAULT 0, tab_key TEXT, sub_key TEXT, enabled INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"); } catch (e) { }

// 기본 메뉴 데이터 삽입
const menuCount = db.prepare("SELECT COUNT(*) as cnt FROM menus").get();
if (menuCount.cnt === 0) {
  const insertMenu = db.prepare("INSERT INTO menus (name, icon, parent_id, sort_order, tab_key, sub_key, enabled) VALUES (?,?,?,?,?,?,?)");
  // 최상위 메뉴
  const news = insertMenu.run('뉴스', '📰', null, 1, 'ai', null, 1);
  const stock = insertMenu.run('주식', '📈', null, 2, 'stock', null, 1);
  const datacollect = insertMenu.run('데이터 수집', '📊', null, 3, 'datacollect', null, 1);
  const quant = insertMenu.run('자동매매', '🤖', null, 4, 'quant', null, 1);
  const backtest = insertMenu.run('백테스팅', '🔬', null, 5, 'backtest', null, 1);
  const perf = insertMenu.run('성과 대시보드', '💹', null, 6, 'performance', null, 1);
  // 자동매매 서브메뉴
  insertMenu.run('미국 자동매매', '🇺🇸', quant.lastInsertRowid, 1, 'quant', 'us', 1);
  insertMenu.run('한국 종목 분석', '🇰🇷', quant.lastInsertRowid, 2, 'quant', 'kr', 1);
  insertMenu.run('완전자동매매', '🤖', quant.lastInsertRowid, 3, 'quant', 'auto', 1);
  insertMenu.run('일반 자동매매', '⚡', quant.lastInsertRowid, 4, 'quant', 'day', 1);
  // 데이터 수집 서브메뉴
  insertMenu.run('종목 분석', '🔍', datacollect.lastInsertRowid, 1, 'datacollect', 'stock', 1);
  insertMenu.run('한국 시장 TOP 10', '🇰🇷', datacollect.lastInsertRowid, 2, 'datacollect', 'korea', 1);
}

// 데이터 수집 서브메뉴 마이그레이션 (기존 DB에 없으면 추가)
try {
  const dcMenu = db.prepare("SELECT id FROM menus WHERE tab_key='datacollect' AND parent_id IS NULL").get();
  if (dcMenu) {
    const dcStockExists = db.prepare("SELECT id FROM menus WHERE tab_key='datacollect' AND sub_key='stock'").get();
    const dcKoreaExists = db.prepare("SELECT id FROM menus WHERE tab_key='datacollect' AND sub_key='korea'").get();
    if (!dcStockExists) db.prepare("INSERT INTO menus (name, icon, parent_id, sort_order, tab_key, sub_key, enabled) VALUES (?,?,?,?,?,?,?)").run('종목 분석', '🔍', dcMenu.id, 1, 'datacollect', 'stock', 1);
    if (!dcKoreaExists) db.prepare("INSERT INTO menus (name, icon, parent_id, sort_order, tab_key, sub_key, enabled) VALUES (?,?,?,?,?,?,?)").run('한국 시장 TOP 10', '🇰🇷', dcMenu.id, 2, 'datacollect', 'korea', 1);
  }
} catch (e) { console.error('데이터수집 서브메뉴 마이그레이션 오류:', e.message); }

try { db.exec("CREATE TABLE IF NOT EXISTS simple_auto_trade (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE, enabled INTEGER DEFAULT 0, symbol TEXT, qty REAL, buy_price REAL, order_id TEXT, status TEXT DEFAULT 'idle', balance_ratio REAL DEFAULT 0.3, take_profit REAL DEFAULT 0.05, stop_loss REAL DEFAULT 0.05, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))"); } catch (e) { }
// [레거시 제거] simple_auto_trade_log 생성 제거됨

const adminExists = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
if (!adminExists) {
  const roleId = db.prepare("SELECT id FROM admin_roles WHERE role_name='superadmin'").get()?.id || 1;
  db.prepare('INSERT INTO admins (username, password_hash, role_id) VALUES (?, ?, ?)').run('admin', bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin1234!', 12), roleId);
  console.log('✅ 기본 관리자 계정 생성됨');
}
console.log('✅ SQLite DB 초기화 완료:', dbPath);

// ============================================================
// 공통 설정
// ============================================================
const JWT_SECRET = process.env.JWT_SECRET || 'ai-router-secret-key-change-this';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'ai-router-admin-secret-key-change-this';
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

// ============================================================
// AI 설정
// ============================================================
const startedAt = Date.now();
const requestStats = { total: 0, preview: 0, run: 0, errors: 0, lastError: null };

const PRESETS = {
  market_brief: { label: '시장 브리핑', userRequest: '오늘 미국 기술주와 반도체 관련 핵심 뉴스만 요약해서 핵심 포인트와 리스크를 정리해줘.', taskType: 'news', taskComplexity: 'medium', preferredEngine: 'hybrid', preferredModel: 'gemini', optimizationMode: 'balanced', autoMode: true, priorityMode: 'speed' },
  daily_ops: { label: '반복 업무 자동화', userRequest: '매일 아침 받은 이메일을 요약하고 일정이 있으면 캘린더 후보를 만들어줘.', taskType: 'repeat', taskComplexity: 'medium', preferredEngine: 'n8n', preferredModel: 'gemini', optimizationMode: 'cost', autoMode: true, priorityMode: 'balanced' },
  executive_report: { label: '중요 보고서', userRequest: '긴 문서와 메모를 합쳐 임원 보고용 1페이지 요약과 실행 항목을 작성해줘.', taskType: 'research', taskComplexity: 'high', preferredEngine: 'hybrid', preferredModel: 'claude', optimizationMode: 'document', autoMode: true, priorityMode: 'quality' },
  desktop_agent: { label: '비서형 에이전트', userRequest: '복합 작업을 단계별로 계획하고 필요한 도구를 골라 실행 전략을 작성해줘.', taskType: 'desktop', taskComplexity: 'high', preferredEngine: 'openclaw', preferredModel: 'gpt', optimizationMode: 'balanced', autoMode: true, priorityMode: 'quality' }
};

const CONFIG = {
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL || '',
  openclawWebhookUrl: process.env.OPENCLAW_WEBHOOK_URL || '',
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 20000),
  perfProfile: process.env.PERF_PROFILE || 'turbo-local',
  hasKeys: { openai: Boolean(process.env.OPENAI_API_KEY), gemini: Boolean(process.env.GEMINI_API_KEY), anthropic: Boolean(process.env.ANTHROPIC_API_KEY) },
  defaults: { engine: process.env.DEFAULT_ENGINE || 'hybrid', model: process.env.DEFAULT_MODEL || 'gemini', priorityMode: process.env.DEFAULT_PRIORITY_MODE || 'balanced' }
};

function summarizeProviders() {
  return { n8n: CONFIG.n8nWebhookUrl ? 'connected' : 'simulation', openclaw: CONFIG.openclawWebhookUrl ? 'connected' : 'simulation', gpt: CONFIG.hasKeys.openai ? 'ready' : 'missing-key', gemini: CONFIG.hasKeys.gemini ? 'ready' : 'missing-key', claude: CONFIG.hasKeys.anthropic ? 'ready' : 'missing-key' };
}

function chooseEngine({ taskType, preferredEngine, autoMode, priorityMode }) {
  if (!autoMode && preferredEngine !== 'hybrid') return { engine: preferredEngine, reason: '사용자가 직접 선택' };
  if (priorityMode === 'speed' && taskType !== 'desktop') return { engine: 'n8n', reason: '속도 우선' };
  if (preferredEngine === 'hybrid' || autoMode) {
    if (new Set(['repeat', 'notify', 'email', 'news', 'sheet']).has(taskType)) return { engine: 'n8n', reason: '반복형 업무' };
    if (new Set(['agent', 'research', 'multistep', 'desktop']).has(taskType)) return { engine: 'openclaw', reason: '복합 판단형' };
  }
  return { engine: preferredEngine === 'hybrid' ? 'n8n' : preferredEngine, reason: '기본 라우팅' };
}

function chooseModel({ taskComplexity, preferredModel, optimizationMode, priorityMode }) {
  if (optimizationMode === 'manual') return { model: preferredModel, reason: '사용자가 직접 선택' };
  if (optimizationMode === 'cost') return { model: 'gemini', reason: '비용 우선' };
  if (optimizationMode === 'document') return { model: 'claude', reason: '문서형 작업' };
  if (priorityMode === 'speed' && taskComplexity !== 'high') return { model: 'gemini', reason: '속도 우선' };
  if (taskComplexity === 'high' && priorityMode === 'quality') return { model: preferredModel === 'claude' ? 'claude' : 'gpt', reason: '고난도+품질 우선' };
  if (taskComplexity === 'high') return { model: 'gpt', reason: '복잡한 추론' };
  return { model: preferredModel, reason: '기본 모델' };
}

function buildPayload(body) {
  const normalized = { userRequest: String(body.userRequest || '').trim(), taskType: body.taskType || 'news', taskComplexity: body.taskComplexity || 'medium', preferredEngine: body.preferredEngine || CONFIG.defaults.engine, preferredModel: body.preferredModel || CONFIG.defaults.model, optimizationMode: body.optimizationMode || 'balanced', autoMode: Boolean(body.autoMode), priorityMode: body.priorityMode || CONFIG.defaults.priorityMode };
  return { ...normalized, engineDecision: chooseEngine(normalized), modelDecision: chooseModel(normalized), providers: summarizeProviders(), requestedAt: new Date().toISOString() };
}

async function forwardToTarget(url, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const ct = response.headers.get('content-type') || '';
    return { durationMs: Date.now() - started, body: ct.includes('application/json') ? await response.json() : { raw: await response.text() } };
  } finally { clearTimeout(timeout); }
}

async function callClaude(userRequest, taskType, taskComplexity) {
  const started = Date.now();
  const response = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 1024, system: `당신은 유능한 AI 어시스턴트입니다.\n작업 유형: ${taskType}\n작업 복잡도: ${taskComplexity}\n한국어로 명확하고 구조적으로 답변해주세요.`, messages: [{ role: 'user', content: userRequest }] });
  return { durationMs: Date.now() - started, body: { answer: response.content[0]?.text || '', model: response.model, usage: response.usage } };
}

function getUserAlpacaKeys(userId, accountId, accountType = null) {
  let row;
  if (accountId) {
    row = db.prepare('SELECT alpaca_api_key,alpaca_secret_key,alpaca_paper FROM user_broker_keys WHERE id=? AND user_id=?').get(accountId, userId);
  } else if (accountType) {
    // accountType: 1=수동전용, 2=자동전용
    row = db.prepare('SELECT alpaca_api_key,alpaca_secret_key,alpaca_paper FROM user_broker_keys WHERE user_id=? AND account_type=?').get(userId, accountType);
    if (!row) {
      // 전용 계좌 없으면 is_active 계좌 폴백
      row = db.prepare('SELECT alpaca_api_key,alpaca_secret_key,alpaca_paper FROM user_broker_keys WHERE user_id=? AND is_active=1').get(userId);
    }
  } else {
    row = db.prepare('SELECT alpaca_api_key,alpaca_secret_key,alpaca_paper FROM user_broker_keys WHERE user_id=? AND is_active=1').get(userId);
    if (!row) row = db.prepare('SELECT alpaca_api_key,alpaca_secret_key,alpaca_paper FROM user_broker_keys WHERE user_id=? LIMIT 1').get(userId);
  }
  if (!row) return null;
  try { return { api_key: decryptEmail(row.alpaca_api_key), secret_key: decryptEmail(row.alpaca_secret_key), paper: row.alpaca_paper === 1 }; } catch (e) { return null; }
}

// ============================================================
// 미들웨어
// ============================================================
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

const globalLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, message: { error: '너무 많은 요청입니다.' }, handler: (req, res, next, options) => { const ip = req.ip; logger.warn('RATE_LIMIT_EXCEEDED', { ip, path: req.path }); saveAccessLog({ ip, method: req.method, path: req.path, statusCode: 429, userAgent: req.headers['user-agent'] || '', referer: req.headers['referer'] || '', responseTime: 0, eventType: 'rate_limit' }); res.status(429).json(options.message); } });
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: '로그인 시도가 너무 많습니다.' } });

app.use(globalLimit);
app.use('/api/auth/login', authLimit);
app.use('/api/auth/register', authLimit);
app.set('trust proxy', 1);

// m.spagenio.com → 모바일 페이지
app.use((req, res, next) => {
  const host = req.headers['x-forwarded-host'] || req.headers['host'] || '';
  if (host.startsWith('m.') && !req.path.startsWith('/api') && !req.path.startsWith('/proxy')) {
    return res.sendFile(path.join(__dirname, 'public', 'm.html'));
  }
  next();
});
app.use(cors());
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
    if (suspiciousPatterns.some(p => req.path.toLowerCase().includes(p.toLowerCase()))) { logger.warn('SUSPICIOUS_REQUEST', { ip, method: req.method, path: req.path }); saveAccessLog({ ip, method: req.method, path: req.path, statusCode: res.statusCode, userAgent: req.headers['user-agent'] || '', referer: req.headers['referer'] || '', responseTime, eventType: 'suspicious' }); }
  });
  next();
});

function authMiddleware(req, res, next) {
  const publicApis = ['/api/auth/login', '/api/auth/admin-login', '/api/auth/verify', '/api/auth/register', '/api/auth/forgot-password', '/api/auth/send-email-code', '/api/auth/verify-email-code', '/api/auth/check-username', '/api/auth/check-email', '/api/lotto/history-full', '/api/lotto/prediction/history', '/api/lotto/weights'];
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
          // users 테이블에도 같은 username이 있으면 그 id를 user_id로 사용 (lotto_picks 등 FK 호환)
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
const deps = { db, bcrypt, jwt, JWT_SECRET, ADMIN_JWT_SECRET, JWT_EXPIRES, sendMail, encryptEmail, decryptEmail, verifyCodeStore, loginAttempts, logger, saveAccessLog, saveErrorLog, errorLogDir, fs, logClients, __dirname };
const frontDeps = { ...deps, anthropic, CONFIG, PRESETS, requestStats, startedAt, getUserAlpacaKeys, buildPayload, forwardToTarget, callClaude, summarizeProviders, runAutoTradeForUser, getNasdaqTop3, saveTradeLog, updateTradeLogStatus };

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

// ✅ 에러 로그 자동 정리 (매일 자정 — 30일 이상 된 .jsonl 삭제)
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
const now = new Date();
const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
setTimeout(() => {
  cleanOldErrorLogs();
  setInterval(cleanOldErrorLogs, 24 * 60 * 60 * 1000);
}, msUntilMidnight);
});

// ============================================================
// 로또 자동 발송 스케줄러
// ============================================================
setInterval(async () => {
  try {
    if (!isSchedulerEnabled('lotto_send')) return;
    const now = new Date();
    if (now.getMinutes() !== 0) return;
    updateSchedulerRun('lotto_send');
    const currentHour = now.getHours(), currentDay = now.getDay(), today = now.toISOString().split('T')[0];
    if (currentDay === 6 && currentHour >= 20) return;
    const schedules = db.prepare('SELECT ls.*, ut.chat_id, ut.bot_token FROM lotto_schedule ls JOIN user_telegram ut ON ls.user_id=ut.user_id WHERE ls.enabled=1 AND ls.hour=?').all(currentHour);
    for (const sch of schedules) {
      const days = sch.days.split(',').map(Number);
      if (!days.includes(currentDay) || sch.last_sent_at?.startsWith(today)) continue;
      const DEFAULT_WEIGHTS = { freq: 20, hot: 20, cold: 10, balance: 15, zone: 10, ac: 10, prime: 5, delta: 10 };
      const wRow = db.prepare('SELECT weights FROM lotto_algorithm_weights WHERE user_id=?').get(sch.user_id);
      let algos = { ...DEFAULT_WEIGHTS };
      if (wRow) { try { algos = { ...DEFAULT_WEIGHTS, ...JSON.parse(wRow.weights) }; } catch { } }
      const HOT_SET = new Set([3, 7, 14, 18, 23, 27, 34, 40, 42]), COLD_SET = new Set([1, 5, 9, 12, 20, 28, 33, 38, 44]), PRIME_SET = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43]);
      function getScore(n) { let s = 1; if (algos.freq > 0) s += algos.freq * (n % 9 + 1) * 0.01; if (algos.hot > 0 && HOT_SET.has(n)) s += algos.hot * 0.08; if (algos.cold > 0 && COLD_SET.has(n)) s += algos.cold * 0.07; if (algos.balance > 0 && n % 2 === 0) s += algos.balance * 0.02; if (algos.zone > 0) s += algos.zone * 0.015; if (algos.ac > 0) s += algos.ac * ((n * 7) % 11) * 0.005; if (algos.prime > 0 && PRIME_SET.has(n)) s += algos.prime * 0.04; if (algos.delta > 0) s += algos.delta * ((46 - n) % 6) * 0.005; return s; }
      function generateAlgoGame() { const picked = new Set(); while (picked.size < 6) { const pool = []; for (let n = 1; n <= 45; n++) { if (!picked.has(n)) pool.push({ n, w: getScore(n) }); } const total = pool.reduce((s, x) => s + x.w, 0); let r = Math.random() * total; for (const item of pool) { r -= item.w; if (r <= 0) { picked.add(item.n); break; } } if (picked.size < 6 && pool.length > 0) picked.add(pool[pool.length - 1].n); } return [...picked].sort((a, b) => a - b); }
      const games = Array.from({ length: sch.game_count }, () => generateAlgoGame());
      db.prepare('DELETE FROM lotto_picks WHERE user_id=? AND pick_date=?').run(sch.user_id, today);
      const stmt = db.prepare('INSERT INTO lotto_picks (user_id,pick_date,game_index,numbers,algorithms) VALUES (?,?,?,?,?)');
      games.forEach((nums, i) => stmt.run(sch.user_id, today, i, JSON.stringify(nums), '자동발송'));
      const token = sch.bot_token || process.env.TG_BOT_TOKEN;
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const lines = games.map((g, i) => `${String.fromCharCode(65 + i)}게임: ${g.map(n => `*${n}*`).join(' ')}`).join('\n');

      // 텔레그램 발송
      if (token && sch.chat_id) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: sch.chat_id, text: `🍀 *로또 자동 추천* (${today})\n\n${lines}\n\n📅 ${dayNames[currentDay]}요일 ${currentHour}시 자동발송`, parse_mode: 'Markdown' }) }).catch(() => { });
      }

      // 메일 발송
      try {
        const userRow = db.prepare('SELECT email FROM users WHERE id=?').get(sch.user_id);
        if (userRow?.email) {
          const htmlLines = games.map((g, i) => `
            <tr>
              <td style="padding:8px 14px;font-weight:700;color:#6366f1;font-size:0.95rem;">${String.fromCharCode(65 + i)}게임</td>
              <td style="padding:8px 14px;">
                ${g.map(n => `<span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:50%;background:#6366f1;color:#fff;font-weight:700;margin:2px;font-size:0.85rem;">${n}</span>`).join('')}
              </td>
            </tr>`).join('');
          await sendMail({
            to: userRow.email,
            subject: `🍀 로또 자동 추천번호 (${today})`,
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
                <div style="background:#6366f1;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
                  <h2 style="margin:0;font-size:1.2rem;">🍀 로또 자동 추천번호</h2>
                  <p style="margin:6px 0 0;opacity:0.85;font-size:0.88rem;">${today} · ${dayNames[currentDay]}요일 ${currentHour}시 자동발송</p>
                </div>
                <div style="background:#fff;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;overflow:hidden;">
                  <table style="width:100%;border-collapse:collapse;">${htmlLines}</table>
                </div>
                <p style="color:#9ca3af;font-size:0.78rem;text-align:center;margin-top:12px;">이 메일은 로또 스케줄에 의해 자동 발송됩니다.</p>
              </div>`
          });
        }
      } catch (e) { saveErrorLog({ event_type: 'LOTTO_MAIL_ERROR', error_message: e.message, stack_trace: e.stack, meta: { userId: sch.user_id } }); }
      db.prepare('UPDATE lotto_schedule SET last_sent_at=CURRENT_TIMESTAMP WHERE user_id=?').run(sch.user_id);
      db.prepare('INSERT INTO lotto_schedule_log (user_id,day,hour,game_count) VALUES (?,?,?,?)').run(sch.user_id, currentDay, currentHour, sch.game_count);
    }
  } catch (e) { saveErrorLog({ event_type: 'LOTTO_SCHEDULE_SAVE_ERROR', error_message: e.message, stack_trace: e.stack }); }
}, 60 * 1000);

// ============================================================
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

// ============================================================
// 거래량 급등 감지 (평소 대비 2배 이상)
// ============================================================
async function detectVolumeSurge(symbols, alpacaKeys = null) {
  const headers = alpacaKeys
    ? { 'APCA-API-KEY-ID': alpacaKeys.api_key, 'APCA-API-SECRET-KEY': alpacaKeys.secret_key }
    : {};
  const results = [];
  const end = new Date().toISOString().split('T')[0];
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  await Promise.allSettled(symbols.map(async (symbol) => {
    try {
      const resp = await fetch(`https://data.alpaca.markets/v2/stocks/${symbol}/bars?timeframe=1Day&start=${start}&end=${end}&limit=30`, { headers });
      const json = await resp.json();
      const bars = json.bars || [];
      if (bars.length < 10) return;
      const volumes = bars.map(b => b.v);
      const avgVolume = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / (volumes.length - 1);
      const todayVolume = volumes[volumes.length - 1];
      const ratio = todayVolume / avgVolume;
      const closes = bars.map(b => b.c);
      const change_pct = ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100;
      if (ratio >= 1.5) {
        results.push({
          symbol,
          today_volume: todayVolume,
          avg_volume: Math.round(avgVolume),
          volume_ratio: parseFloat(ratio.toFixed(2)),
          price: closes[closes.length - 1],
          change_pct: parseFloat(change_pct.toFixed(2)),
          surge_level: ratio >= 3 ? 'extreme' : ratio >= 2 ? 'high' : 'moderate'
        });
      }
    } catch (e) { }
  }));

  return results.sort((a, b) => b.volume_ratio - a.volume_ratio);
}

// ============================================================
// 뉴스 촉매 탐지 (RSS 기반)
// ============================================================
async function detectNewsCatalyst(symbols) {
  const catalysts = [];
  try {
    const rssRows = db.prepare("SELECT url FROM rss_sources WHERE enabled=1 LIMIT 5").all();
    const newsItems = [];

    await Promise.allSettled(rssRows.map(async (row) => {
      try {
        const resp = await fetch(row.url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000)
        });
        const text = await resp.text();
        const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
        items.slice(0, 10).forEach(m => {
          const title = (m[1].match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) || m[1].match(/<title>(.*?)<\/title>/i) || [])[1] || '';
          const pub = (m[1].match(/<pubDate>(.*?)<\/pubDate>/i) || [])[1] || '';
          const link = (m[1].match(/<link>(.*?)<\/link>/i) || [])[1] || '';
          if (title) newsItems.push({ title, pub, link });
        });
      } catch (e) { }
    }));

    // 종목명이 뉴스 제목에 포함된 것만 필터
    symbols.forEach(symbol => {
      const matched = newsItems.filter(n =>
        n.title.toUpperCase().includes(symbol.toUpperCase()) ||
        n.title.includes(symbol)
      );
      if (matched.length > 0) {
        catalysts.push({
          symbol,
          news_count: matched.length,
          latest_title: matched[0].title,
          latest_time: matched[0].pub,
          link: matched[0].link
        });
      }
    });
  } catch (e) { }
  return catalysts;
}

// ============================================================
// 리스크 계산 (계좌 잔고의 1~2% 룰)
// ============================================================
function calcRiskPosition(accountBalance, price, stopLossPct = 0.05, riskRatio = 0.02) {
  const riskAmount = accountBalance * riskRatio; // 계좌의 2%
  const stopLossAmount = price * stopLossPct;    // 주당 손실금액
  const qty = Math.floor(riskAmount / stopLossAmount);
  const totalCost = qty * price;
  const actualRiskPct = (qty * stopLossAmount / accountBalance) * 100;
  return {
    qty: Math.max(qty, 0),
    total_cost: parseFloat(totalCost.toFixed(2)),
    risk_amount: parseFloat((qty * stopLossAmount).toFixed(2)),
    risk_pct: parseFloat(actualRiskPct.toFixed(2)),
    stop_price: parseFloat((price * (1 - stopLossPct)).toFixed(2)),
    take_profit_price: parseFloat((price * (1 + stopLossPct * 2)).toFixed(2)) // 2:1 RR
  };
}

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
async function runSimpleAutoTrade(userId) {
  const state = db.prepare('SELECT * FROM simple_auto_trade WHERE user_id=? AND enabled=1').get(userId);
  if (!state) return;

  const keys = getUserAlpacaKeys(userId, null);
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

          // [레거시 제거] simple_auto_trade_log SELL → trade_log(type=2)만 사용
          saveTradeLog({ user_id:userId, trade_type:2, symbol:state.symbol, action:'SELL', qty, price:currentPrice, profit_pct:plPct*100, reason, status:'closed' });
          updateTradeLogStatus(userId, state.symbol, 2);

          // 강제청산이면 당일 재매수 완전 차단 (closed_today 상태로 16:00까지 유지)
          if (estTime >= forceCloseTime) {
            db.prepare('UPDATE simple_auto_trade SET status=?,symbol=NULL,qty=NULL,buy_price=NULL,order_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE user_id=?')
              .run('closed_today', userId);
          } else {
            // 매도 후 재분석 → 재매수 (장 마감 충분히 전일 때만)
            db.prepare('UPDATE simple_auto_trade SET status=?,symbol=NULL,qty=NULL,buy_price=NULL,updated_at=CURRENT_TIMESTAMP WHERE user_id=?')
              .run('analyzing', userId);
            setTimeout(() => runSimpleAutoTrade(userId), 3000);
          }

          // 텔레그램 알림
          try {
            const tg = db.prepare('SELECT chat_id, bot_token FROM user_telegram WHERE user_id=?').get(userId);
            if (tg?.chat_id && tg?.bot_token) {
              const token = tg.bot_token.startsWith('bot') ? tg.bot_token.slice(3) : tg.bot_token;
              const icon = plPct >= 0 ? '✅' : '🔴';
              await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: tg.chat_id, text: `${icon} <b>[단순매매] ${state.symbol} 매도</b>
사유: ${reason}
수익률: ${(plPct * 100).toFixed(2)}%
수량: ${qty}주 @ $${currentPrice.toFixed(2)}`, parse_mode: 'HTML'
                })
              });
            }
          } catch (e) { }
          return;
        }
      } else {
        // 포지션 없으면 idle로 리셋
        db.prepare('UPDATE simple_auto_trade SET status=?,symbol=NULL,qty=NULL,buy_price=NULL,updated_at=CURRENT_TIMESTAMP WHERE user_id=?')
          .run('idle', userId);
      }
    }

    // === idle/analyzing 상태: 재분석 후 매수 ===
    // closed_today는 매수 시도 안 함 (강제청산 당일 재매수 방지)
    if ((state.status === 'idle' || state.status === 'analyzing') && estTime < forceCloseTime) {
      // TOP1 종목 분석
      const settingsRow = db.prepare('SELECT candidate_symbols FROM auto_trade_settings WHERE user_id=?').get(userId);
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
      if (!top) { db.prepare('UPDATE simple_auto_trade SET status=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?').run('idle', userId); return; }

      // 매수 금액 계산 (계좌 잔고 비율)
      const buyingPowerSimple = parseFloat(account.buying_power) || 0;
      const buyAmount = equity * (state.balance_ratio || 0.3);
      const qty = Math.floor(buyAmount / top.price);

      // ✅ 1주 미만 체크
      if (qty < 1) {
        console.log(`[단순매매] ${top.symbol} 매수 스킵: 1주 미만 (buyAmount=$${buyAmount.toFixed(0)}, price=$${top.price})`);
        db.prepare('UPDATE simple_auto_trade SET status=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?').run('idle', userId);
        return;
      }
      // ✅ 잔고 부족 체크
      if (qty * top.price > buyingPowerSimple) {
        const maxQty = Math.floor(buyingPowerSimple / top.price);
        if (maxQty < 1) {
          console.log(`[단순매매] ${top.symbol} 매수 스킵: 잔고 부족 (buying_power=$${buyingPowerSimple.toFixed(0)})`);
          db.prepare('UPDATE simple_auto_trade SET status=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?').run('idle', userId);
          return;
        }
        // 최대 매수 가능 수량으로 조정
        console.log(`[단순매매] ${top.symbol} 수량 조정: ${qty}주 → ${maxQty}주 (잔고 부족)`);
      }
      const finalQty = Math.min(qty, Math.floor(buyingPowerSimple / top.price));

      const order = await (await fetch(`${baseUrl}/v2/orders`, {
        method: 'POST', headers,
        body: JSON.stringify({ symbol: top.symbol, qty: String(finalQty), side: 'buy', type: 'market', time_in_force: 'day' })
      })).json();

      if (order.id) {
        // [레거시 제거] simple_auto_trade_log BUY → trade_log(type=2)만 사용
        saveTradeLog({ user_id:userId, trade_type:2, symbol:top.symbol, action:'BUY', qty:finalQty, price:top.price, profit_pct:0, reason:`점수 ${top.score}점 TOP1 매수`, status:'active' });
        db.prepare('UPDATE simple_auto_trade SET status=?,symbol=?,qty=?,buy_price=?,order_id=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?')
          .run('holding', top.symbol, finalQty, top.price, order.id, userId);

        // 텔레그램 알림
        try {
          const tg = db.prepare('SELECT chat_id, bot_token FROM user_telegram WHERE user_id=?').get(userId);
          if (tg?.chat_id && tg?.bot_token) {
            const token = tg.bot_token.startsWith('bot') ? tg.bot_token.slice(3) : tg.bot_token;
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: tg.chat_id, text: `🟢 <b>[단순매매] ${top.symbol} 매수</b>
수량: ${qty}주 @ $${top.price.toFixed(2)}
투자금: $${(qty * top.price).toFixed(0)}
점수: ${top.score}점`, parse_mode: 'HTML'
              })
            });
          }
        } catch (e) { }
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

async function runAutoTradeForUser(userId) {
  const settings = db.prepare('SELECT * FROM auto_trade_settings WHERE user_id=? AND enabled=1').get(userId);
  if (!settings) return { ok: false, message: '자동매매 비활성화 상태' };
  const keys = getUserAlpacaKeys(userId, null, 2);
  if (!keys) return { ok: false, message: 'Alpaca 키 없음 (자동매매 전용 계좌를 등록해주세요)' };
  const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
  const headers = { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key, 'Content-Type': 'application/json' };
  const results = [];
  try {
    const buyingPower = parseFloat((await (await fetch(`${baseUrl}/v2/account`, { headers })).json()).buying_power) || 0;
    const posData = await (await fetch(`${baseUrl}/v2/positions`, { headers })).json();
    const positions = Array.isArray(posData) ? posData : (posData.positions || []);
    for (const pos of positions) {
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
            saveTradeLog({ user_id:userId, trade_type:4, symbol:pos.symbol, action:'SELL_PROFIT', qty:pos.qty, price:pos.current_price, reason:`익절 +${(plPct*100).toFixed(2)}%`, order_id:order.id||'', profit_pct:plPct*100, status:'closed' });
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
            saveTradeLog({ user_id:userId, trade_type:4, symbol:pos.symbol, action:'SELL_LOSS', qty:pos.qty, price:pos.current_price, reason:`손절 ${(plPct*100).toFixed(2)}%`, order_id:order.id||'', profit_pct:plPct*100, status:'closed' });
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
    const autoHeld = db.prepare("SELECT DISTINCT symbol FROM trade_log WHERE user_id=? AND trade_type=4 AND action='BUY' AND status='active'").all(userId).map(r => r.symbol);
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
          const alreadyHeld = db.prepare("SELECT id FROM trade_log WHERE user_id=? AND symbol=? AND trade_type=4 AND action='BUY' AND status='active'").get(userId, symbol);
          if (alreadyHeld) { heldSymbols.add(symbol); continue; }
          const order = await (await fetch(`${baseUrl}/v2/orders`, { method: 'POST', headers, body: JSON.stringify({ symbol, qty: String(qty), side: 'buy', type: 'market', time_in_force: 'day' }) })).json();
          if (order.id) {
            saveTradeLog({ user_id:userId, trade_type:4, symbol, action:'BUY', qty, price:currentPrice, reason, order_id:order.id, profit_pct:0, status:'active' });
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

    // 텔레그램 알림 발송
    try {
      const tg = db.prepare('SELECT chat_id, bot_token FROM user_telegram WHERE user_id=?').get(userId);
      if (tg?.chat_id && tg?.bot_token) {
        const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        const lines = results.map(r => {
          const icon = r.action === '매수' ? '🟢 매수' : r.action === '익절 매도' ? '✅ 익절' : '🔴 손절';
          return `${icon} <b>${r.symbol}</b> ${r.qty ? r.qty + '주' : ''} ${r.profit ? r.profit : ''}`;
        }).join('\n');
        const msg = `🤖 <b>자동매매 체결 알림</b>\n📅 ${now}\n\n${lines}\n\n총 ${results.length}건 체결`;
        const token = tg.bot_token.startsWith('bot') ? tg.bot_token.slice(3) : tg.bot_token;
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: tg.chat_id, text: msg, parse_mode: 'HTML' })
        });
        db.prepare('INSERT INTO telegram_alert_log (user_id, alert_type, message) VALUES (?,?,?)').run(userId, 'TRADE', msg);
      }
    } catch (e) { saveErrorLog({ event_type: 'TELEGRAM_ALERT_ERROR', error_message: e.message, stack_trace: e.stack, meta: { userId } }); }
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
    const users = db.prepare('SELECT user_id FROM auto_trade_settings WHERE enabled=1').all();
    for (const u of users) await runAutoTradeForUser(u.user_id);
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
      db.prepare("UPDATE simple_auto_trade SET status='idle' WHERE status='closed_today'").run();
    }
    if (!isMarketHours) return;
    updateSchedulerRun('simple_trade');
    const users = db.prepare('SELECT user_id FROM simple_auto_trade WHERE enabled=1').all();
    for (const u of users) await runSimpleAutoTrade(u.user_id);
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

// 로또 번호 수동 메일 발송
app.post('/api/mail/lotto', async (req, res) => {
  try {
    const { games, date } = req.body;
    const userRow = db.prepare('SELECT email FROM users WHERE id=?').get(req.user.id);
    if (!userRow?.email) return res.status(400).json({ error: '이메일이 등록되지 않은 계정입니다.' });
    const today = date || new Date().toISOString().split('T')[0];
    const htmlLines = games.map((g, i) => `<tr><td style="padding:8px 14px;font-weight:700;color:#6366f1;">${String.fromCharCode(65 + i)}게임</td><td style="padding:8px 14px;">${g.map(n => `<span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:50%;background:#6366f1;color:#fff;font-weight:700;margin:2px;font-size:0.85rem;">${n}</span>`).join('')}</td></tr>`).join('');
    await sendMail({
      to: userRow.email,
      subject: `🍀 로또 추천번호 (${today})`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;"><div style="background:#6366f1;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;"><h2 style="margin:0;font-size:1.2rem;">🍀 로또 추천번호</h2><p style="margin:6px 0 0;opacity:0.85;font-size:0.88rem;">${today}</p></div><div style="background:#fff;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;overflow:hidden;"><table style="width:100%;border-collapse:collapse;">${htmlLines}</table></div><p style="color:#9ca3af;font-size:0.78rem;text-align:center;margin-top:12px;">이 메일은 수동 발송됩니다.</p></div>`
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// 완전자동매매 스케줄러 (1분마다 + 월 1회 리밸런싱)
// ============================================================
async function runAutoStrategy(userId) {
  const s = db.prepare('SELECT * FROM auto_strategy_settings WHERE user_id=? AND enabled=1').get(userId);
  if (!s) return;
  const keys = getUserAlpacaKeys(userId, null, 2);
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
          db.prepare('DELETE FROM auto_strategy_pool WHERE user_id=?').run(userId);
          pool.forEach(item => {
            db.prepare('INSERT OR REPLACE INTO auto_strategy_pool (user_id, symbol, factor_score) VALUES (?,?,?)').run(userId, item.symbol, item.factor_score);
          });
          // 팩터 이탈 종목 매도
          if (s.factor_exit) {
            const poolSymbols = new Set(pool.map(i => i.symbol));
            const positions = await (await fetch(`${baseUrl}/v2/positions`, { headers })).json();
            for (const pos of (Array.isArray(positions) ? positions : [])) {
              if (!poolSymbols.has(pos.symbol)) {
                await fetch(`${baseUrl}/v2/orders`, { method: 'POST', headers, body: JSON.stringify({ symbol: pos.symbol, qty: pos.qty, side: 'sell', type: 'market', time_in_force: 'day' }) });
                saveTradeLog({ user_id:userId, trade_type:3, symbol:pos.symbol, action:'SELL_FACTOR', qty:pos.qty, price:pos.current_price, reason:'퀀트전략:팩터 이탈 매도', status:'closed' });
              }
            }
          }
          // 풀에 종목이 있을 때만 리밸런싱 완료 처리 (스크리닝 실패 시 재시도 보장)
          if (pool.length > 0) {
            db.prepare('UPDATE auto_strategy_settings SET last_rebalanced_at=? WHERE user_id=?').run(now.toISOString(), userId);
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
    for (const pos of posList) {
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
          saveTradeLog({ user_id:userId, trade_type:3, symbol:pos.symbol, action:'SELL_PROFIT2', qty, price:currentPrice, reason:`퀀트전략:2차 익절 +${(plPct*100).toFixed(2)}%`, profit_pct:plPct*100, status:'closed' });
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
            saveTradeLog({ user_id:userId, trade_type:3, symbol:pos.symbol, action:'SELL_PROFIT1', qty:halfQty, price:currentPrice, reason:`퀀트전략:1차 익절 +${(plPct*100).toFixed(2)}%`, profit_pct:plPct*100, status:'closed' });
          }
        }
      // 손절 — 익절 조건 미달 시만 실행
      } else if (plPct <= -s.stop_loss) {
        const existingStop = db.prepare("SELECT id FROM trade_log WHERE user_id=? AND symbol=? AND trade_type=3 AND action='SELL_STOP' AND created_at>?").get(userId, pos.symbol, buyTime);
        if (!existingStop) {
          await fetch(`${baseUrl}/v2/orders`, { method: 'POST', headers, body: JSON.stringify({ symbol: pos.symbol, qty: pos.qty, side: 'sell', type: 'market', time_in_force: 'day' }) });
          // [레거시 제거] auto_trade_log SELL_STOP 제거
          saveTradeLog({ user_id:userId, trade_type:3, symbol:pos.symbol, action:'SELL_STOP', qty, price:currentPrice, reason:`퀀트전략:손절 ${(plPct*100).toFixed(2)}%`, profit_pct:plPct*100, status:'closed' });
          updateTradeLogStatus(userId, pos.symbol, 3);
        }
      }
    }

    // 매수 체크 (풀에서 타이밍 조건 확인)
    const heldSymbols = new Set(posList.map(p => p.symbol));
    // ✅ 수동 보유 종목(trade_type=1)은 자동매매 대상에서 제외
    const manualHeldAS = db.prepare("SELECT DISTINCT symbol FROM trade_log WHERE user_id=? AND trade_type=1 AND action='BUY' AND status='active'").all(userId).map(r => r.symbol);
    manualHeldAS.forEach(s => heldSymbols.add(s));
    const pool = db.prepare('SELECT symbol FROM auto_strategy_pool WHERE user_id=? ORDER BY factor_score DESC').all(userId);
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
          const alreadyHeld = db.prepare("SELECT id FROM trade_log WHERE user_id=? AND symbol=? AND trade_type=3 AND action='BUY' AND status='active'").get(userId, row.symbol);
          if (alreadyHeld) { heldSymbols.add(row.symbol); continue; }
          const order = await (await fetch(`${baseUrl}/v2/orders`, { method: 'POST', headers, body: JSON.stringify({ symbol: row.symbol, qty: String(qty), side: 'buy', type: 'market', time_in_force: 'day' }) })).json();
          if (order.id) {
            saveTradeLog({ user_id:userId, trade_type:3, symbol:row.symbol, action:'BUY', qty, price:currentPrice, reason:`퀀트전략:3단계(${reasons.join('+')})`, order_id:order.id, status:'active' });
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
    const users = db.prepare('SELECT user_id FROM auto_strategy_settings WHERE enabled=1').all();
    for (const u of users) await runAutoStrategy(u.user_id);
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
    1: lottoAutoSendFn,
    2: autoTradeFn,
    3: simpleAutoTradeFn,
    4: autoStrategyFn,
    5: lottoHistoryFn,
  };
  return fns[id] || (() => { });
}

// 각 스케줄러 함수 정의
async function lottoAutoSendFn() {
  const now = new Date();
  if (now.getMinutes() !== 0) return;
  const currentHour = now.getUTCHours() + 9; // KST
  const kstHour = currentHour >= 24 ? currentHour - 24 : currentHour;
  const schedules = db.prepare('SELECT ls.*, ut.chat_id, ut.bot_token FROM lotto_schedule ls JOIN user_telegram ut ON ls.user_id=ut.user_id WHERE ls.enabled=1 AND ls.hour=?').all(kstHour);
  // 기존 로또 발송 로직은 아래 setInterval에서 처리
}

async function autoTradeFn() {
  const now = new Date();
  const utcHour = now.getUTCHours(), utcMin = now.getUTCMinutes();
  const isMarketHours = (utcHour === 14 && utcMin >= 30) || (utcHour > 14 && utcHour < 21);
  if (!isMarketHours) return;
  const users = db.prepare('SELECT user_id FROM auto_trade_settings WHERE enabled=1').all();
  for (const u of users) await runAutoTradeForUser(u.user_id);
}

async function simpleAutoTradeFn() {
  const now = new Date();
  const utcHour = now.getUTCHours(), utcMin = now.getUTCMinutes();
  const isMarketHours = (utcHour === 14 && utcMin >= 30) || (utcHour > 14 && utcHour < 21);
  if (!isMarketHours) return;
  const users = db.prepare('SELECT user_id FROM simple_auto_trade WHERE enabled=1').all();
  for (const u of users) await runSimpleAutoTrade(u.user_id);
}

async function autoStrategyFn() {
  const now = new Date();
  const utcHour = now.getUTCHours(), utcMin = now.getUTCMinutes();
  const isMarketHours = (utcHour === 14 && utcMin >= 30) || (utcHour > 14 && utcHour < 21);
  if (!isMarketHours) return;
  const users = db.prepare('SELECT user_id FROM auto_strategy_settings WHERE enabled=1').all();
  for (const u of users) await runAutoStrategy(u.user_id);
}

async function lottoHistoryFn() {
  const now = new Date();
  const utcHour = now.getUTCHours(), utcMin = now.getUTCMinutes();
  const utcDay = now.getUTCDay();
  if (utcDay !== 6 || utcHour !== 12 || utcMin > 5) return;
  const today = now.toISOString().split('T')[0];
  const drw_no = Math.floor((new Date(today) - new Date('2002-12-07')) / (7 * 24 * 60 * 60 * 1000)) + 1;
  const existing = db.prepare('SELECT id FROM lotto_history WHERE drw_no=?').get(drw_no);
  if (existing) return;
  const res = await fetch(`https://lotto.oot.kr/api/lotto/${drw_no}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) return;
  const data = await res.json();
  if (!data.drwtNo1) return;
  const winning = [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6];
  db.prepare('INSERT OR IGNORE INTO lotto_history (drw_no, numbers, bonus, drw_date) VALUES (?,?,?,?)').run(drw_no, JSON.stringify(winning), data.bnusNo, data.drwNoDate || today);
  const picks = db.prepare('SELECT * FROM lotto_picks WHERE pick_date=? AND rank IS NULL').all(today);
  picks.forEach(pick => {
    const nums = JSON.parse(pick.numbers);
    const matched = nums.filter(n => winning.includes(n)).length;
    const hasBonus = nums.includes(data.bnusNo);
    let rank = null;
    if (matched === 6) rank = 1; else if (matched === 5 && hasBonus) rank = 2;
    else if (matched === 5) rank = 3; else if (matched === 4) rank = 4; else if (matched === 3) rank = 5;
    db.prepare('UPDATE lotto_picks SET drw_no=?, rank=?, matched_count=?, bonus_match=? WHERE id=?').run(drw_no, rank, matched, hasBonus ? 1 : 0, pick.id);
  });
  console.log(`[로또] ${drw_no}회 당첨번호 자동 수집 완료`);
}

// ============================================================
// 로또 당첨번호 자동 수집 스케줄러 (토요일 KST 21:00 = UTC 12:00)
// ============================================================
setInterval(async () => {
  try {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();
    const utcDay = now.getUTCDay(); // 0=일, 6=토

    if (!isSchedulerEnabled('lotto_history')) return;
    // 토요일 UTC 12:00 (KST 21:00)에만 실행
    if (utcDay !== 6 || utcHour !== 12 || utcMin > 5) return;
    updateSchedulerRun('lotto_history');

    // 이번 주 회차 계산
    const today = now.toISOString().split('T')[0];
    const drw_no = Math.floor((new Date(today) - new Date('2002-12-07')) / (7 * 24 * 60 * 60 * 1000)) + 1;

    // 이미 저장된 회차면 스킵
    const existing = db.prepare('SELECT id FROM lotto_history WHERE drw_no=?').get(drw_no);
    if (existing) return;

    // lotto.oot.kr에서 당첨번호 조회
    const res = await fetch(`https://lotto.oot.kr/api/lotto/${drw_no}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.drwtNo1) return;

    const winning = [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6];
    db.prepare('INSERT OR IGNORE INTO lotto_history (drw_no, numbers, bonus, drw_date) VALUES (?,?,?,?)')
      .run(drw_no, JSON.stringify(winning), data.bnusNo, data.drwNoDate || today);

    // 미확인 픽 일괄 당첨확인
    const picks = db.prepare('SELECT * FROM lotto_picks WHERE pick_date=? AND rank IS NULL').all(today);
    picks.forEach(pick => {
      const nums = JSON.parse(pick.numbers);
      const matched = nums.filter(n => winning.includes(n)).length;
      const hasBonus = nums.includes(data.bnusNo);
      let rank = null;
      if (matched === 6) rank = 1;
      else if (matched === 5 && hasBonus) rank = 2;
      else if (matched === 5) rank = 3;
      else if (matched === 4) rank = 4;
      else if (matched === 3) rank = 5;
      db.prepare('UPDATE lotto_picks SET drw_no=?, rank=?, matched_count=?, bonus_match=? WHERE id=?')
        .run(drw_no, rank, matched, hasBonus ? 1 : 0, pick.id);
    });

    console.log(`[로또] ${drw_no}회 당첨번호 자동 수집 완료: ${winning.join(', ')} + ${data.bnusNo}`);

    // ── 당첨번호 수집 후 lotto_weights 자동 업데이트 ──────────
    // 전체 이력 기반 반복출현 확률 + 연속 반복 패턴 재계산
    try {
      const allRows = db.prepare('SELECT numbers FROM lotto_history ORDER BY drw_no ASC').all();
      const allHist = allRows.map(r => JSON.parse(r.numbers));

      // 1. 반복출현 확률 계산
      const repeatCount = {}, appearCount = {};
      for (let n = 1; n <= 45; n++) { repeatCount[n] = 0; appearCount[n] = 0; }
      for (let i = 1; i < allHist.length; i++) {
        const prev = allHist[i-1], curSet = new Set(allHist[i]);
        prev.forEach(n => { appearCount[n]++; if (curSet.has(n)) repeatCount[n]++; });
      }
      const pcts = {};
      for (let n = 1; n <= 45; n++) pcts[n] = appearCount[n] > 0 ? repeatCount[n] / appearCount[n] : 0;
      const avgPct = Object.values(pcts).reduce((a,b)=>a+b,0) / 45;

      // 2. 반복출현 확률 → weight 변환 (0.5 ~ 3.0)
      const newWeights = {};
      for (let n = 1; n <= 45; n++) {
        const ratio = avgPct > 0 ? pcts[n] / avgPct : 1.0;
        newWeights[n] = Math.round(Math.min(3.0, Math.max(0.5, ratio)) * 10000) / 10000;
      }

      // 3. 최근 3회차 부스트
      const recent3 = allHist.slice(-3);
      recent3.forEach((nums, i) => {
        const boost = 0.5 * (i + 1);
        nums.forEach(n => { newWeights[n] = Math.round(Math.min(5.0, newWeights[n] + boost) * 10000) / 10000; });
      });

      // 4. DB 업데이트
      for (let n = 1; n <= 45; n++) {
        db.prepare('UPDATE lotto_weights SET weight=?, appear_count=?, hit_count=? WHERE num=?')
          .run(newWeights[n], appearCount[n], repeatCount[n], n);
      }
      console.log(`[로또] lotto_weights 자동 업데이트 완료 (${allHist.length}회 이력 기반)`);
    } catch(e) {
      console.log('[로또] lotto_weights 업데이트 오류:', e.message);
    }

  } catch (e) {
    saveErrorLog({ event_type: 'LOTTO_HISTORY_SCHEDULER_ERROR', error_message: e.message, stack_trace: e.stack });
  }
}, 60 * 1000); // 1분마다 체크

// ============================================================
// 로또 예측 자동 발송 (서버 시작 시)
// ============================================================
async function sendLottoPredictionOnStartup() {
  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNo = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    const weekKey = `${now.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;

    const alreadySent = db.prepare('SELECT id FROM lotto_auto_send_log WHERE week_key=?').get(weekKey);
    if (alreadySent) { console.log(`  🍀 로또 예측: 이번 주(${weekKey}) 이미 발송됨 — 스킵`); return; }

    const latest = db.prepare('SELECT drw_no, numbers FROM lotto_history ORDER BY drw_no DESC LIMIT 1').get();
    if (!latest) { console.log('  🍀 로또 예측: 당첨번호 없음'); return; }
    const latestNums = JSON.parse(latest.numbers);

    const allHistory = db.prepare('SELECT numbers FROM lotto_history ORDER BY drw_no ASC').all().map(r => JSON.parse(r.numbers));
    const numCarry = {};
    for (let n = 1; n <= 45; n++) numCarry[n] = { appear: 0, carry: 0 };
    for (let i = 1; i < allHistory.length; i++) {
      const prev = allHistory[i-1], cur = new Set(allHistory[i]);
      prev.forEach(n => { numCarry[n].appear++; if (cur.has(n)) numCarry[n].carry++; });
    }
    const carryPct = {};
    for (let n = 1; n <= 45; n++) carryPct[n] = numCarry[n].appear > 0 ? numCarry[n].carry / numCarry[n].appear : 0;

    const getDec = n => n<=9?0:n<=19?1:n<=29?2:n<=39?3:4;
    const decCarry = Array(5).fill(null).map(()=>({appear:0,carry:0}));
    for (let i = 1; i < allHistory.length; i++) {
      const prev = allHistory[i-1], curDecs = new Set(allHistory[i].map(getDec));
      prev.forEach(n => { const d = getDec(n); decCarry[d].appear++; if (curDecs.has(d)) decCarry[d].carry++; });
    }
    const decPct = decCarry.map(d => d.appear > 0 ? d.carry / d.appear : 0);

    const recent20 = db.prepare('SELECT numbers FROM lotto_history ORDER BY drw_no DESC LIMIT 20').all().map(r => JSON.parse(r.numbers));
    const recentBonus = {};
    for (let n = 1; n <= 45; n++) recentBonus[n] = 0;
    recent20.forEach((nums, idx) => { const w = (20 - idx) / 20; nums.forEach(n => { recentBonus[n] += w * 0.5; }); });

    const dbWeights = {};
    try { db.prepare('SELECT num, weight FROM lotto_weights').all().forEach(r => { dbWeights[r.num] = r.weight; }); } catch(e) {}

    // ── 연속 반복 패턴 분석 ──────────────────────────────────
    // 각 번호별 현재 연속 반복 횟수 + 최대 연속 횟수 계산
    const maxStreak = {};   // 번호별 역대 최대 연속 횟수
    const curStreak = {};   // 번호별 현재 연속 횟수 (마지막 회차 기준)
    for (let n = 1; n <= 45; n++) { maxStreak[n] = 0; curStreak[n] = 0; }
    for (let i = 1; i < allHistory.length; i++) {
      const prev = new Set(allHistory[i-1]);
      const cur  = new Set(allHistory[i]);
      for (let n = 1; n <= 45; n++) {
        if (prev.has(n) && cur.has(n)) {
          curStreak[n]++;
          if (curStreak[n] > maxStreak[n]) maxStreak[n] = curStreak[n];
        } else {
          curStreak[n] = 0;
        }
      }
    }

    // 연속 반복 패턴 기반 가중치 조정
    // - 현재 연속 중이고 최대에 근접 → DOWN (곧 끊길 가능성)
    // - 현재 연속 중이지만 최대까지 여유 → UP (계속될 가능성)
    // - 연속 없음 → 중립
    const streakMultiplier = {};
    for (let n = 1; n <= 45; n++) {
      const cur = curStreak[n];
      const max = maxStreak[n];
      if (cur === 0) {
        // 연속 없음 → 중립 (1.0)
        streakMultiplier[n] = 1.0;
      } else if (max > 0 && cur >= max) {
        // 최대 연속 도달 → 강하게 DOWN (끊길 확률 매우 높음)
        streakMultiplier[n] = 0.3;
      } else if (max > 0 && cur >= max * 0.7) {
        // 최대의 70% 이상 → 약하게 DOWN
        streakMultiplier[n] = 0.6;
      } else {
        // 연속 중이지만 최대까지 여유 → UP
        streakMultiplier[n] = 1.0 + (cur * 0.3);
      }
    }

    const scores = {};
    for (let n = 1; n <= 45; n++) {
      let s = carryPct[n] * 100 + decPct[getDec(n)] * 30 + recentBonus[n] * 20;
      if (latestNums.includes(n)) s += carryPct[n] * 50;
      // DB 가중치 × 연속 반복 패턴 멀티플라이어 동시 적용
      scores[n] = s * (dbWeights[n] || 1.0) * streakMultiplier[n];
    }

    // ── bias_map DB에서 로드 ──
    let carryBiasMap = {
      '0':[0.18,0.25,0.22,0.20,0.15],'1':[0.19,0.18,0.23,0.26,0.14],
      '2':[0.19,0.24,0.20,0.25,0.12],'3':[0.21,0.23,0.23,0.21,0.12],
      '4':[0.23,0.22,0.22,0.22,0.12],'0+0':[0.18,0.25,0.21,0.25,0.11],
      '0+1':[0.17,0.24,0.25,0.18,0.15],'0+2':[0.19,0.22,0.23,0.22,0.15],
      '0+3':[0.22,0.23,0.14,0.19,0.22],'0+4':[0.17,0.31,0.19,0.25,0.08],
      '1+1':[0.18,0.20,0.23,0.25,0.14],'1+2':[0.20,0.25,0.19,0.19,0.17],
      '1+3':[0.25,0.18,0.26,0.18,0.12],'1+4':[0.23,0.23,0.18,0.25,0.11],
      '2+2':[0.20,0.10,0.20,0.35,0.15],'2+3':[0.17,0.23,0.20,0.23,0.17],
      '2+4':[0.19,0.31,0.22,0.22,0.06],'3+3':[0.21,0.29,0.18,0.18,0.14],
      '3+4':[0.14,0.38,0.27,0.08,0.14],
    };
    try {
      const bmRow = db.prepare('SELECT data FROM lotto_algorithm_config WHERE key=?').get('bias_map');
      if (bmRow) carryBiasMap = JSON.parse(bmRow.data);
    } catch(e) {}

    const baseZoneSpecs = [
      {range:[1,9],   dist:[0.16,0.53,0.25,0.06,0.00]},
      {range:[10,19], dist:[0.18,0.49,0.22,0.11,0.00]},
      {range:[20,29], dist:[0.13,0.49,0.29,0.08,0.01]},
      {range:[30,39], dist:[0.21,0.40,0.27,0.11,0.01]},
      {range:[40,45], dist:[0.41,0.40,0.18,0.01,0.00]},
    ];

    function getZoneIdx(n) { if(n<=9)return 0;if(n<=19)return 1;if(n<=29)return 2;if(n<=39)return 3;return 4; }

    function sampleCount(baseDist, zoneIdx, biasWeights) {
      let dist = [...baseDist];
      if (biasWeights) {
        const bt = Math.round(biasWeights[zoneIdx] * 6);
        const bl = dist.map((v,i) => v*0.6 + (i===bt?0.4:0));
        const total = bl.reduce((a,b)=>a+b,0);
        dist = bl.map(v=>v/total);
      }
      let r = Math.random(), c = 0;
      for (let i=0; i<dist.length; i++) { c+=dist[i]; if(r<c) return i; }
      return 1;
    }

    function weightedSample(items, weights) {
      const total = weights.reduce((a,b)=>a+b,0);
      let r = Math.random()*total, c = 0;
      for (let i=0; i<items.length; i++) { c+=weights[i]; if(c>=r) return items[i]; }
      return items[items.length-1];
    }

    function predictOne() {
      // 이월 선택 (1217회 통계: 60.2% 확률로 최소 1개)
      const sortedByCarry = [...latestNums].sort((a,b)=>carryPct[b]-carryPct[a]);
      const carryPicks = [];
      const cw = sortedByCarry.map(n=>Math.max(carryPct[n],0.01));
      if (Math.random() < 0.602) {
        carryPicks.push(weightedSample(sortedByCarry, cw));
        if (Math.random() < 0.282) {
          const rem2 = sortedByCarry.filter(n=>!carryPicks.includes(n));
          const w2 = rem2.map(n=>Math.max(carryPct[n],0.01));
          if (rem2.length) carryPicks.push(weightedSample(rem2, w2));
        }
      }
      const picks = new Set(carryPicks);

      // bias_map 결정
      let biasWeights = null;
      if (carryPicks.length===1) biasWeights = carryBiasMap[String(getZoneIdx(carryPicks[0]))] || null;
      else if (carryPicks.length===2) {
        const [z1,z2] = [getZoneIdx(carryPicks[0]),getZoneIdx(carryPicks[1])].sort((a,b)=>a-b);
        biasWeights = carryBiasMap[`${z1}+${z2}`] || null;
      }

      // 구간별 선택
      for (let zi=0; zi<baseZoneSpecs.length; zi++) {
        if (picks.size>=6) break;
        const {range:[lo,hi], dist} = baseZoneSpecs[zi];
        const already = [...picks].filter(n=>n>=lo&&n<=hi).length;
        const need = Math.max(0, sampleCount(dist, zi, biasWeights) - already);
        const candidates = Array.from({length:hi-lo+1},(_,i)=>lo+i)
          .filter(n=>!picks.has(n)).sort((a,b)=>scores[b]-scores[a]);
        for (let k=0; k<need&&k<candidates.length&&picks.size<6; k++) picks.add(candidates[k]);
      }

      // 상위 15위 랜덤으로 채우기
      const rem = Array.from({length:45},(_,i)=>i+1).filter(n=>!picks.has(n)).sort((a,b)=>scores[b]-scores[a]);
      const top15 = rem.slice(0,15);
      while (picks.size<6 && top15.length) {
        const idx = Math.floor(Math.random()*top15.length);
        picks.add(top15.splice(idx,1)[0]);
      }
      return [...picks].sort((a,b)=>a-b);
    }

    const games = [];
    for (let g=0; g<10; g++) games.push(predictOne());

    // lotto_auto_send=1 인 유저만 발송
    const tgUsers = db.prepare('SELECT ut.* FROM user_telegram ut JOIN users u ON ut.user_id=u.id WHERE u.lotto_auto_send=1').all();
    for (const tg of tgUsers) {
      const token = tg.bot_token || process.env.TG_BOT_TOKEN;
      if (!token || !tg.chat_id) continue;
      const lines = games.map((g, i) => `${String.fromCharCode(65+i)}게임: ${g.map(n=>`*${n}*`).join(' ')}`).join('\n');
      const msg = `🎯 *이월 패턴 예측 번호* (${latest.drw_no}회 기반)\n\n${lines}\n\n📊 이월확률 + 구간균형 + DB가중치 종합`;
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tg.chat_id, text: msg, parse_mode: 'Markdown' })
      }).catch(e => console.log('  텔레그램 오류:', e.message));
    }

    db.prepare('INSERT OR IGNORE INTO lotto_auto_send_log (week_key, round_no, picks) VALUES (?,?,?)').run(weekKey, latest.drw_no, JSON.stringify(games));
    games.forEach(picks => {
      try { db.prepare('INSERT INTO lotto_predictions (based_on_round, predicted_for_round, picks) VALUES (?,?,?)').run(latest.drw_no, latest.drw_no + 1, JSON.stringify(picks)); } catch(e) {}
    });
    console.log(`  🍀 로또 예측 발송 완료: ${latest.drw_no}회 기반 10게임 → ${tgUsers.length}명 발송`);
  } catch(e) { console.log('  🍀 로또 예측 오류:', e.message); }
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
  console.log(`  ${C.cyan}Claude${C.reset}   : ${CONFIG.hasKeys.anthropic ? C.green + '✅ 연결됨' : C.red + '❌ API 키 없음'}${C.reset}`);
  console.log('');
  // 서버 시작 시 로또 예측 자동 발송 (이번 주 미발송 시에만)
  setTimeout(() => sendLottoPredictionOnStartup(), 3000);
});
