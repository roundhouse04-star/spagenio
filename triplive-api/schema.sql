-- Triplive 안전 백엔드 D1 스키마
-- 적용: npm run d1:schema  (remote)
--      npm run d1:schema:local  (local dev)
--
-- 설계 원칙:
--  - 디바이스 식별: Expo Push Token 자체를 PK 로 사용 (UPSERT 패턴)
--  - 개인정보 최소: 사용자 이메일/이름 보관 안 함, 트립 국가 목록만
--  - 외교부 데이터 캐싱: 15분 주기 Cron 결과를 advisories 에 저장

-- 디바이스 토큰 + 사용자 관심 국가
CREATE TABLE IF NOT EXISTS devices (
  expo_token TEXT PRIMARY KEY,
  platform TEXT NOT NULL,             -- 'ios' | 'android'
  app_version TEXT,
  locale TEXT DEFAULT 'ko',           -- 알림 언어
  push_enabled INTEGER DEFAULT 1,     -- 사용자 옵트아웃 시 0
  created_at INTEGER NOT NULL,        -- unix ms
  updated_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_devices_push_enabled ON devices(push_enabled);

-- 디바이스 - 트립 국가 매핑 (1 디바이스 : N 국가)
-- 사용자가 진행중/계획중 트립의 국가코드 (ISO 2자리) 만 보냄
CREATE TABLE IF NOT EXISTS device_countries (
  expo_token TEXT NOT NULL,
  country_code TEXT NOT NULL,         -- 'JP', 'TH'
  trip_status TEXT NOT NULL,          -- 'planning' | 'ongoing'
  added_at INTEGER NOT NULL,
  PRIMARY KEY (expo_token, country_code),
  FOREIGN KEY (expo_token) REFERENCES devices(expo_token) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_device_countries_country ON device_countries(country_code);

-- 외교부 여행경보 캐시 (Cron 15분마다 갱신)
CREATE TABLE IF NOT EXISTS advisories (
  country_code TEXT PRIMARY KEY,
  country_name TEXT NOT NULL,
  level INTEGER NOT NULL,             -- 0=안전, 1=유의, 2=자제, 3=출국권고, 4=금지
  level_str TEXT,                     -- 외교부 원본 라벨
  message TEXT,
  updated_at INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_advisories_level ON advisories(level);

-- 외교부 실시간 안전공지 캐시 (시위·자연재해·테러 등)
CREATE TABLE IF NOT EXISTS safety_alerts (
  id TEXT PRIMARY KEY,                -- 외교부 공지 ID
  country_code TEXT,
  title TEXT NOT NULL,
  body TEXT,
  category TEXT,                      -- '시위', '자연재해', '테러', '치안' 등
  severity TEXT,                      -- 'info' | 'warning' | 'critical'
  published_at INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL,
  notified INTEGER DEFAULT 0          -- 푸시 전송 완료 여부
);
CREATE INDEX IF NOT EXISTS idx_alerts_country_published ON safety_alerts(country_code, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_notified ON safety_alerts(notified);

-- 푸시 전송 이력 (중복 전송 방지 + 디버깅)
CREATE TABLE IF NOT EXISTS push_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expo_token TEXT NOT NULL,
  alert_id TEXT,                       -- safety_alerts.id 참조
  advisory_country TEXT,               -- advisories 변동 알림 시
  status TEXT NOT NULL,                -- 'sent' | 'error' | 'invalid_token'
  error_message TEXT,
  sent_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_log_token ON push_log(expo_token);
CREATE INDEX IF NOT EXISTS idx_push_log_alert ON push_log(alert_id);

-- Cron 실행 로그 (디버깅용, 최근 100개만 보관)
CREATE TABLE IF NOT EXISTS cron_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job TEXT NOT NULL,                   -- 'mofa_poll' 등
  status TEXT NOT NULL,                -- 'ok' | 'error'
  details TEXT,                        -- JSON 요약 (fetched, matched, pushed)
  started_at INTEGER NOT NULL,
  finished_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cron_log_started ON cron_log(started_at DESC);
