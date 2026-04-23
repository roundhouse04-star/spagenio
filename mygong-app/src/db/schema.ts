/**
 * 내공연관리 — SQLite 스키마
 *
 * 앱 설치 시 자동 생성되는 테이블들.
 * 모든 데이터는 on-device (서버 없음).
 *
 * v2:
 *   - events: is_wishlisted, ticket_open_at 추가
 *   - tickets: ratings_json, price 추가
 *   - badges 테이블 신규
 */

export const SCHEMA_VERSION = 2;
export const DB_NAME = 'mygong.db';

export const CREATE_TABLES_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS artists (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id     TEXT UNIQUE,
  name            TEXT NOT NULL,
  name_en         TEXT,
  role            TEXT,
  tag             TEXT,
  emoji           TEXT,
  avatar_url      TEXT,
  thumb_color     TEXT,
  bio             TEXT,
  followers       TEXT,
  is_following    INTEGER DEFAULT 1,
  notify_enabled  INTEGER DEFAULT 1,
  last_synced_at  TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_artists_external ON artists(external_id);
CREATE INDEX IF NOT EXISTS idx_artists_following ON artists(is_following);

CREATE TABLE IF NOT EXISTS events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  artist_id       INTEGER,
  external_id     TEXT,
  title           TEXT NOT NULL,
  category        TEXT DEFAULT '콘서트',
  cat_icon        TEXT,
  date            TEXT,
  weekday         TEXT,
  time            TEXT,
  venue           TEXT,
  city            TEXT,
  price           TEXT,
  ticket_url      TEXT,
  poster_url      TEXT,
  notify_enabled  INTEGER DEFAULT 1,
  is_wishlisted   INTEGER DEFAULT 0,
  ticket_open_at  TEXT,
  notes           TEXT,
  source          TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_events_artist ON events(artist_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE UNIQUE INDEX IF NOT EXISTS uq_events_ext_artist ON events(external_id, artist_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS tickets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  artist_id       INTEGER,
  event_id        INTEGER,
  title           TEXT NOT NULL,
  category        TEXT DEFAULT '콘서트',
  cat_icon        TEXT,
  date            TEXT NOT NULL,
  month           TEXT,
  venue           TEXT,
  seat            TEXT,
  photo_uri       TEXT,
  rating          INTEGER DEFAULT 0,
  ratings_json    TEXT,
  price           INTEGER,
  notes           TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL,
  FOREIGN KEY (event_id)  REFERENCES events(id)  ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_tickets_artist ON tickets(artist_id);
CREATE INDEX IF NOT EXISTS idx_tickets_date ON tickets(date);
CREATE INDEX IF NOT EXISTS idx_tickets_month ON tickets(month);

CREATE TABLE IF NOT EXISTS notifications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  kind            TEXT NOT NULL,
  title           TEXT NOT NULL,
  subtitle        TEXT,
  icon            TEXT,
  artist_id       INTEGER,
  event_id        INTEGER,
  ticket_id       INTEGER,
  created_at      TEXT NOT NULL,
  is_new          INTEGER DEFAULT 1,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id)  REFERENCES events(id)  ON DELETE CASCADE,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_new ON notifications(is_new);

/** 아티스트별 최근 페치 상태 — 앱 시작 시 동기화 결정에 사용 */
CREATE TABLE IF NOT EXISTS artist_sync_state (
  artist_id           INTEGER PRIMARY KEY,
  last_fetched_at     TEXT,
  last_fetch_status   TEXT,
  last_fetch_error    TEXT,
  events_found        INTEGER DEFAULT 0,
  updated_at          TEXT NOT NULL,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_meta (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

/** v2: 획득한 뱃지만 저장 */
CREATE TABLE IF NOT EXISTS badges (
  badge_id      TEXT PRIMARY KEY,
  unlocked_at   TEXT NOT NULL
);
`;

export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 2,
    sql: `
      ALTER TABLE events ADD COLUMN is_wishlisted INTEGER DEFAULT 0;
      ALTER TABLE events ADD COLUMN ticket_open_at TEXT;
      ALTER TABLE tickets ADD COLUMN ratings_json TEXT;
      ALTER TABLE tickets ADD COLUMN price INTEGER;
      CREATE INDEX IF NOT EXISTS idx_events_wishlist ON events(is_wishlisted);
      CREATE INDEX IF NOT EXISTS idx_badges_unlocked ON badges(unlocked_at DESC);
      CREATE TABLE IF NOT EXISTS badges (
        badge_id      TEXT PRIMARY KEY,
        unlocked_at   TEXT NOT NULL
      );
    `,
  },
];

/**
 * 앱에서 사용하는 카테고리 목록.
 *
 * 티켓 컬렉션은 "실제로 다녀온 공연/관람 기록"이므로
 * 티켓 구매가 이루어지는 6개 카테고리만 유지.
 *
 * 이전 버전에서 쓰던 방송/드라마/영화/뮤직비디오/광고/앨범/수상/야구/축구/농구 는 제거 —
 * 티켓 개념과 맞지 않음.
 */
export const CATEGORIES = [
  { value: '콘서트',   icon: '🎤', color: 'catConcert'  },
  { value: '뮤지컬',   icon: '🎭', color: 'catMusical'  },
  { value: '연극',     icon: '🎪', color: 'catPlay'     },
  { value: '팬미팅',   icon: '💖', color: 'catFan'      },
  { value: '페스티벌', icon: '🎉', color: 'catFestival' },
  { value: '전시',     icon: '🖼️', color: 'catExhibit'  },
] as const;

export type CategoryValue = typeof CATEGORIES[number]['value'];

export function iconForCategory(cat?: string): string {
  if (!cat) return '🎤';
  const found = CATEGORIES.find(c => c.value === cat);
  return found?.icon || '🎤';
}

/** 제거된 카테고리나 이상한 값이 들어와도 유효한 6개 중 하나로 변환 */
export function normalizeCategory(cat?: string): CategoryValue {
  if (!cat) return '콘서트';
  const match = CATEGORIES.find(c => c.value === cat);
  if (match) return match.value;
  // legacy 값 매핑
  if (/(무용|서커스|복합|대중무용)/.test(cat)) return '페스티벌';
  if (/(공연)/.test(cat)) return '콘서트';
  return '콘서트';
}

/**
 * v2: 카테고리별 세부 별점 항목 정의.
 * 4개 항목, 1~5점 별점.
 */
export const RATING_ITEMS: Record<CategoryValue, { key: string; label: string }[]> = {
  '콘서트': [
    { key: 'sound',       label: '음향' },
    { key: 'stage',       label: '무대 연출' },
    { key: 'seat',        label: '좌석' },
    { key: 'setlist',     label: '세트리스트' },
  ],
  '뮤지컬': [
    { key: 'story',       label: '스토리' },
    { key: 'casting',     label: '캐스팅' },
    { key: 'music',       label: '음악' },
    { key: 'directing',   label: '연출' },
  ],
  '연극': [
    { key: 'story',       label: '스토리' },
    { key: 'acting',      label: '연기' },
    { key: 'directing',   label: '연출' },
    { key: 'stage',       label: '무대' },
  ],
  '팬미팅': [
    { key: 'program',     label: '진행' },
    { key: 'interaction', label: '소통' },
    { key: 'goods',       label: '굿즈' },
    { key: 'seat',        label: '좌석' },
  ],
  '페스티벌': [
    { key: 'lineup',      label: '라인업' },
    { key: 'sound',       label: '음향' },
    { key: 'location',    label: '장소/환경' },
    { key: 'operation',   label: '운영' },
  ],
  '전시': [
    { key: 'content',     label: '전시 내용' },
    { key: 'space',       label: '공간 구성' },
    { key: 'experience',  label: '체험' },
    { key: 'explanation', label: '해설' },
  ],
};

export function getRatingItems(category?: string) {
  if (!category) return RATING_ITEMS['콘서트'];
  const cat = normalizeCategory(category);
  return RATING_ITEMS[cat];
}
