/**
 * DB 연결 관리 및 초기화
 */
import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL, SCHEMA_VERSION } from './schema';

const DB_NAME = 'my_trip_log.db';

let _db: SQLite.SQLiteDatabase | null = null;

/**
 * DB 인스턴스 획득 (싱글톤)
 */
export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  return _db;
}

/**
 * 앱 시작 시 한 번 호출 - 스키마 생성 + 마이그레이션
 */
export async function initializeDatabase(): Promise<void> {
  const db = await getDB();

  // foreign key 활성화
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // 스키마 생성 (IF NOT EXISTS로 멱등성 보장)
  await db.execAsync(CREATE_TABLES_SQL);

  // 스키마 버전 기록
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)`,
    ['schema_version', String(SCHEMA_VERSION), now]
  );

  console.log(`[DB] Initialized (schema v${SCHEMA_VERSION})`);
}

/**
 * 사용자 가입 여부 확인
 */
export async function isUserRegistered(): Promise<boolean> {
  const db = await getDB();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM user'
  );
  return (result?.count ?? 0) > 0;
}

/**
 * DB 완전 초기화 (개발용 / 리셋 기능)
 */
export async function resetDatabase(): Promise<void> {
  const db = await getDB();
  await db.execAsync(`
    DROP TABLE IF EXISTS user;
    DROP TABLE IF EXISTS trips;
    DROP TABLE IF EXISTS trip_items;
    DROP TABLE IF EXISTS trip_logs;
    DROP TABLE IF EXISTS expenses;
    DROP TABLE IF EXISTS checklists;
    DROP TABLE IF EXISTS exchange_rates_cache;
    DROP TABLE IF EXISTS bookmarks;
    DROP TABLE IF EXISTS app_meta;
  `);
  await initializeDatabase();
  console.log('[DB] Reset complete');
}
