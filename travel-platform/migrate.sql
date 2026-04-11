-- ============================================================
-- Travellog DB 마이그레이션
-- 실행: sqlite3 data/travellog.db < migrate.sql
-- 이미 있는 컬럼/테이블은 무시됩니다 (에러 무시)
-- ============================================================

-- plans 테이블: share 컬럼 추가
-- (이미 있으면 에러가 나지만 무시해도 됩니다)
ALTER TABLE plans ADD COLUMN share_type TEXT DEFAULT 'private';
ALTER TABLE plans ADD COLUMN share_schedule INTEGER DEFAULT 0;
ALTER TABLE plans ADD COLUMN share_places INTEGER DEFAULT 0;

-- plan_items 테이블: transport 관련 컬럼 확인
-- (대부분 이미 있지만 없는 경우를 위해)
ALTER TABLE plan_items ADD COLUMN how_to_get TEXT;
ALTER TABLE plan_items ADD COLUMN tip TEXT;
ALTER TABLE plan_items ADD COLUMN category TEXT;
ALTER TABLE plan_items ADD COLUMN from_post_id TEXT;
ALTER TABLE plan_items ADD COLUMN from_post_title TEXT;
ALTER TABLE plan_items ADD COLUMN from_user_nickname TEXT;
ALTER TABLE plan_items ADD COLUMN date TEXT;
ALTER TABLE plan_items ADD COLUMN memo TEXT;

-- plan_members 테이블 생성
CREATE TABLE IF NOT EXISTS plan_members (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    user_id TEXT,
    user_nickname TEXT,
    user_profile_image TEXT,
    role TEXT DEFAULT 'member',
    joined_at TEXT,
    FOREIGN KEY (plan_id) REFERENCES plans(id)
);

-- plan_messages 테이블 생성
CREATE TABLE IF NOT EXISTS plan_messages (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    user_id TEXT,
    user_nickname TEXT,
    user_profile_image TEXT,
    content TEXT,
    type TEXT DEFAULT 'text',
    created_at TEXT,
    FOREIGN KEY (plan_id) REFERENCES plans(id)
);

-- 기존 plans의 share_type이 NULL인 경우 기본값 설정
UPDATE plans SET share_type = 'private' WHERE share_type IS NULL;
UPDATE plans SET share_schedule = 0 WHERE share_schedule IS NULL;
UPDATE plans SET share_places = 0 WHERE share_places IS NULL;

SELECT 'Migration complete!' as status;
SELECT 'plans columns: ' || group_concat(name, ', ') FROM pragma_table_info('plans');
SELECT 'plan_items columns: ' || group_concat(name, ', ') FROM pragma_table_info('plan_items');
SELECT 'plan_members exists: ' || count(*) FROM sqlite_master WHERE type='table' AND name='plan_members';
SELECT 'plan_messages exists: ' || count(*) FROM sqlite_master WHERE type='table' AND name='plan_messages';
