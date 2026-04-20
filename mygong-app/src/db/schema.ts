/**
 * 내공연관리 — SQLite 스키마
 *
 * 앱 설치 시 자동 생성되는 테이블들.
 * 모든 데이터는 on-device (서버 없음).
 */

export const SCHEMA_VERSION = 1;
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
`;

export const MIGRATIONS: { version: number; sql: string }[] = [
  // v2, v3 등 스키마 변경 시 여기 추가
];

export const CATEGORIES = [
  { value: '콘서트',   icon: '🎤', color: 'catConcert'  },
  { value: '뮤지컬',   icon: '🎭', color: 'catMusical'  },
  { value: '연극',     icon: '🎪', color: 'catPlay'     },
  { value: '야구',     icon: '⚾', color: 'catSports'   },
  { value: '축구',     icon: '⚽', color: 'catSports'   },
  { value: '농구',     icon: '🏀', color: 'catSports'   },
  { value: '페스티벌', icon: '🎉', color: 'catFestival' },
  { value: '전시',     icon: '🖼️', color: 'catExhibit'  },
] as const;

export function iconForCategory(cat?: string): string {
  if (!cat) return '🎵';
  const found = CATEGORIES.find(c => c.value === cat);
  return found?.icon || '🎵';
}
