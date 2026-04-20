/**
 * DB 연결 관리 및 초기화.
 * 앱 루트 레이아웃에서 initializeDatabase() 한 번 호출.
 */
import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL, SCHEMA_VERSION, MIGRATIONS, DB_NAME } from './schema';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  return _db;
}

export async function initializeDatabase(): Promise<void> {
  const db = await getDB();
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(CREATE_TABLES_SQL);

  // 현재 스키마 버전 확인
  const meta = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = 'schema_version'`
  );
  const currentVersion = meta ? parseInt(meta.value, 10) : 0;

  // 마이그레이션
  for (const m of MIGRATIONS) {
    if (m.version > currentVersion) {
      console.log(`[DB] Migrating to v${m.version}...`);
      try {
        await db.execAsync(m.sql);
      } catch (err) {
        console.warn(`[DB] Migration v${m.version} partially failed:`, String(err));
      }
    }
  }

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)`,
    ['schema_version', String(SCHEMA_VERSION), now]
  );
  console.log(`[DB] Initialized (schema v${SCHEMA_VERSION})`);
}

export async function resetDatabase(): Promise<void> {
  const db = await getDB();
  await db.execAsync(`
    DROP TABLE IF EXISTS notifications;
    DROP TABLE IF EXISTS tickets;
    DROP TABLE IF EXISTS events;
    DROP TABLE IF EXISTS artist_sync_state;
    DROP TABLE IF EXISTS artists;
    DROP TABLE IF EXISTS app_meta;
  `);
  await initializeDatabase();
  console.log('[DB] Reset complete');
}

export async function getAppMeta(key: string): Promise<string | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = ?`,
    [key]
  );
  return row?.value ?? null;
}

export async function setAppMeta(key: string, value: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)`,
    [key, value, new Date().toISOString()]
  );
}
