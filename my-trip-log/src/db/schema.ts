/**
 * My Trip Log - SQLite Database Schema
 *
 * 앱 설치 시 자동 생성되는 테이블들
 */

export const SCHEMA_VERSION = 1;

export const CREATE_TABLES_SQL = `
-- 사용자 정보 (1명만)
CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  email TEXT,
  nationality TEXT,
  profile_image TEXT,
  home_currency TEXT DEFAULT 'KRW',
  agree_terms INTEGER DEFAULT 0,
  agree_privacy INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 여행
CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  country TEXT,
  country_code TEXT,
  city TEXT,
  start_date TEXT,
  end_date TEXT,
  budget REAL DEFAULT 0,
  currency TEXT DEFAULT 'KRW',
  status TEXT DEFAULT 'planning',
  cover_image TEXT,
  memo TEXT,
  is_favorite INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_start_date ON trips(start_date);

-- 일정 항목
CREATE TABLE IF NOT EXISTS trip_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  day INTEGER NOT NULL,
  start_time TEXT,
  end_time TEXT,
  title TEXT NOT NULL,
  location TEXT,
  latitude REAL,
  longitude REAL,
  memo TEXT,
  cost REAL DEFAULT 0,
  currency TEXT,
  category TEXT DEFAULT 'sightseeing',
  is_done INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trip_items_trip ON trip_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_items_day ON trip_items(trip_id, day);

-- 여행 기록 (일기)
CREATE TABLE IF NOT EXISTS trip_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  log_date TEXT NOT NULL,
  title TEXT,
  content TEXT,
  images TEXT,
  location TEXT,
  latitude REAL,
  longitude REAL,
  weather TEXT,
  mood TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trip_logs_trip ON trip_logs(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_logs_date ON trip_logs(log_date);

-- 비용/가계부
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  expense_date TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  amount_in_home_currency REAL,
  exchange_rate REAL,
  payment_method TEXT,
  memo TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_expenses_trip ON expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- 체크리스트
CREATE TABLE IF NOT EXISTS checklists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  is_checked INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_checklists_trip ON checklists(trip_id);

-- 환율 캐시
CREATE TABLE IF NOT EXISTS exchange_rates_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base_currency TEXT NOT NULL,
  target_currency TEXT NOT NULL,
  rate REAL NOT NULL,
  source TEXT DEFAULT 'api',
  updated_at TEXT NOT NULL,
  UNIQUE(base_currency, target_currency)
);

-- 북마크 장소 (내가 저장한 곳)
CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  country TEXT,
  city TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  category TEXT,
  image TEXT,
  url TEXT,
  created_at TEXT NOT NULL
);

-- 앱 메타 정보 (스키마 버전 등)
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

// 카테고리 상수
export const EXPENSE_CATEGORIES = [
  { key: 'food', label: '식비', icon: '🍽️' },
  { key: 'transport', label: '교통', icon: '🚇' },
  { key: 'accommodation', label: '숙소', icon: '🏨' },
  { key: 'activity', label: '액티비티', icon: '🎢' },
  { key: 'shopping', label: '쇼핑', icon: '🛍️' },
  { key: 'sightseeing', label: '관광', icon: '🗺️' },
  { key: 'other', label: '기타', icon: '💰' },
] as const;

export const TRIP_ITEM_CATEGORIES = [
  { key: 'sightseeing', label: '관광', icon: '🗺️' },
  { key: 'food', label: '식사', icon: '🍽️' },
  { key: 'activity', label: '액티비티', icon: '🎢' },
  { key: 'accommodation', label: '숙소', icon: '🏨' },
  { key: 'transport', label: '이동', icon: '🚇' },
  { key: 'shopping', label: '쇼핑', icon: '🛍️' },
  { key: 'other', label: '기타', icon: '📌' },
] as const;

export const CHECKLIST_CATEGORIES = [
  { key: 'document', label: '서류', icon: '📄' },
  { key: 'clothing', label: '의류', icon: '👕' },
  { key: 'electronics', label: '전자기기', icon: '📱' },
  { key: 'toiletries', label: '세면용품', icon: '🧴' },
  { key: 'medicine', label: '약품', icon: '💊' },
  { key: 'general', label: '기타', icon: '📦' },
] as const;

export const TRIP_STATUS = {
  PLANNING: 'planning',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
} as const;
