// ============================================================
// DB 스키마 초기화 + 시드 데이터
// server.js 에서 분리 (모놀리식 정리)
// ============================================================
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

export function initDatabase(dbPath) {
  const db = new Database(dbPath);

  // 동시 read/write 안전성 + 멈춤 방지.
  // WAL 은 DB 파일에 영구 저장되므로 한 번 켜두면 Python 서비스도 자동 적용.
  // ⚠️ 백업 시 stock.db 외에 stock.db-wal, stock.db-shm 도 함께 복사 필요.
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, email TEXT, created_type INTEGER DEFAULT 2, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_login DATETIME);
    -- created_type: 1=관리자생성(일반로그인 불가), 2=일반가입
    CREATE TABLE IF NOT EXISTS admin_roles (id INTEGER PRIMARY KEY AUTOINCREMENT, role_name TEXT UNIQUE NOT NULL, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, email TEXT, role_id INTEGER, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_login DATETIME, FOREIGN KEY (role_id) REFERENCES admin_roles(id));
    CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, count INTEGER DEFAULT 0, lock_until INTEGER DEFAULT 0, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
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
    CREATE TABLE IF NOT EXISTS trade_setting_type4 (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, broker_key_id INTEGER DEFAULT NULL, enabled INTEGER DEFAULT 0, symbols TEXT DEFAULT 'QQQ,SPY,AAPL', candidate_symbols TEXT DEFAULT 'QQQ,SPY,AAPL,NVDA,MSFT,GOOGL,AMZN,TSLA,META,AMD', max_positions INTEGER DEFAULT 3, balance_ratio REAL DEFAULT 0.1, take_profit REAL DEFAULT 0.05, stop_loss REAL DEFAULT 0.05, signal_mode TEXT DEFAULT 'combined', updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, broker_key_id), FOREIGN KEY (user_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS schedulers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, key TEXT UNIQUE NOT NULL, enabled INTEGER DEFAULT 1, interval_sec INTEGER DEFAULT 60, description TEXT, last_run DATETIME, run_count INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS menus (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT DEFAULT '', parent_id INTEGER DEFAULT NULL, sort_order INTEGER DEFAULT 0, tab_key TEXT, sub_key TEXT, enabled INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS trade_setting_type2 (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, broker_key_id INTEGER DEFAULT NULL, enabled INTEGER DEFAULT 0, symbol TEXT, qty REAL, buy_price REAL, order_id TEXT, status TEXT DEFAULT 'idle', balance_ratio REAL DEFAULT 0.3, take_profit REAL DEFAULT 0.05, stop_loss REAL DEFAULT 0.05, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, broker_key_id), FOREIGN KEY (user_id) REFERENCES users(id));
  `);

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

  // ── saveTradeLog 헬퍼 ──
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
      } catch (e) { console.error('[updateTradeLogStatus] 백업 업데이트 실패:', backupTable, e.message); }
    }
  }
  
  
  try { db.exec("ALTER TABLE user_broker_keys ADD COLUMN account_type INTEGER DEFAULT 0"); } catch (e) { }
  // account_type: 0=미설정, 1=수동전용, 2=자동전용
  try { db.exec("ALTER TABLE portfolio_performance ADD COLUMN account_type INTEGER DEFAULT 0"); } catch (e) { }
  try { db.exec("ALTER TABLE trade_setting_type4 ADD COLUMN factor_strategy TEXT DEFAULT 'value_quality'"); } catch (e) { }
  try { db.exec("ALTER TABLE trade_setting_type4 ADD COLUMN factor_market TEXT DEFAULT 'nasdaq'"); } catch (e) { }
  
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
    CREATE TABLE IF NOT EXISTS trade_setting_type3 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      broker_key_id INTEGER DEFAULT NULL,
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
      UNIQUE(user_id, broker_key_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS trade_pool_type3 (
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
    ['BBC News', 'https://feeds.bbci.co.uk/news/rss.xml', 'global'],
    ['BBC World', 'https://feeds.bbci.co.uk/news/world/rss.xml', 'global'],
    ['Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml', 'global'],
    ['NPR News', 'https://feeds.npr.org/1001/rss.xml', 'global'],
    ['NPR World', 'https://feeds.npr.org/1004/rss.xml', 'global'],
    ['The Guardian', 'https://www.theguardian.com/world/rss', 'global'],
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
    // trade_setting_type4
    ['trade_setting_type4', 'id', '자동 증가 PK'],
    ['trade_setting_type4', 'user_id', 'users.id 참조 (UNIQUE)'],
    ['trade_setting_type4', 'enabled', '자동매매 활성 여부 (0/1)'],
    ['trade_setting_type4', 'symbols', '매매 대상 종목 (쉼표 구분)'],
    ['trade_setting_type4', 'candidate_symbols', '매수 후보 종목 풀 (쉼표 구분)'],
    ['trade_setting_type4', 'max_positions', '최대 동시 보유 종목 수'],
    ['trade_setting_type4', 'balance_ratio', '계좌 잔고 대비 매수 비율 (0.1=10%)'],
    ['trade_setting_type4', 'take_profit', '익절 기준 수익률 (0.05=5%)'],
    ['trade_setting_type4', 'stop_loss', '손절 기준 손실률 (0.05=5%)'],
    ['trade_setting_type4', 'signal_mode', '매수 신호 방식 (macd/combined)'],
    ['trade_setting_type4', 'updated_at', '최종 수정 시각'],
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
  
  try { db.prepare("ALTER TABLE trade_setting_type4 ADD COLUMN candidate_symbols TEXT DEFAULT 'QQQ,SPY,AAPL,NVDA,MSFT,GOOGL,AMZN,TSLA,META,AMD'").run(); } catch (e) { }
  // ── broker_key_id 마이그레이션 ──
  try { db.exec('ALTER TABLE trade_setting_type2 ADD COLUMN broker_key_id INTEGER DEFAULT NULL'); } catch (e) { }
  try { db.exec('ALTER TABLE trade_setting_type3 ADD COLUMN broker_key_id INTEGER DEFAULT NULL'); } catch (e) { }
  try { db.exec('ALTER TABLE trade_setting_type4 ADD COLUMN broker_key_id INTEGER DEFAULT NULL'); } catch (e) { }
  try { db.exec("CREATE TABLE IF NOT EXISTS schedulers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, key TEXT UNIQUE NOT NULL, enabled INTEGER DEFAULT 1, interval_sec INTEGER DEFAULT 60, description TEXT, last_run DATETIME, run_count INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"); } catch (e) { }
  
  // 기본 스케줄러 데이터 삽입
  const schCount = db.prepare("SELECT COUNT(*) as cnt FROM schedulers").get();
  if (schCount.cnt === 0) {
    const ins = db.prepare("INSERT OR IGNORE INTO schedulers (name, key, enabled, interval_sec, description) VALUES (?,?,?,?,?)");
    ins.run('미국 자동매매', 'auto_trade', 1, 60, 'MACD/RSI 기반 미국 주식 자동매매 (장시간 09:30~16:00 EST)');
    ins.run('단순 자동매매', 'simple_trade', 1, 60, 'TOP1 종목 당일 자동매매 (장시간, 15:55 강제청산)');
    ins.run('완전 자동매매', 'auto_strategy', 1, 60, '팩터 스크리닝 기반 완전자동매매 (장시간)');
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
  
  // trade_setting_type2 레거시 CREATE 제거됨 (메인 스키마로 통합)
  // [레거시 제거] trade_setting_type2_log 생성 제거됨
  
  const adminExists = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
  if (!adminExists) {
    const roleId = db.prepare("SELECT id FROM admin_roles WHERE role_name='superadmin'").get()?.id || 1;
    db.prepare('INSERT INTO admins (username, password_hash, role_id) VALUES (?, ?, ?)').run('admin', bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin1234!', 12), roleId);
    console.log('✅ 기본 관리자 계정 생성됨');
  }
  return db;
}
