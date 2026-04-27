/**
 * DB 연결 관리 및 초기화
 *
 * iCloud / Google Drive 백업:
 * - expo-sqlite v16+ 는 기본적으로 iOS Documents/SQLite/, Android files/SQLite/ 에 저장
 * - 두 위치 모두 OS의 자동 백업 대상 (사용자가 끄지 않는 한 자동으로 클라우드 동기화됨)
 * - app.json의 ios.infoPlist.ITSAppUsesNonExemptEncryption + android.allowBackup=true 와 함께 동작
 */
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { CREATE_TABLES_SQL, SCHEMA_VERSION, MIGRATIONS } from './schema';

const DB_NAME = 'my_trip_log.db';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  return _db;
}

/**
 * DB 파일의 실제 경로 반환 (디버깅/백업 검증용)
 */
export async function getDBPath(): Promise<string> {
  // expo-sqlite v16+: documentDirectory/SQLite/<DB_NAME>
  const dir = FileSystem.documentDirectory ?? '';
  return `${dir}SQLite/${DB_NAME}`;
}

/**
 * 앱 시작 시 한 번 호출 - 스키마 생성 + 마이그레이션
 */
export async function initializeDatabase(): Promise<void> {
  const db = await getDB();

  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(CREATE_TABLES_SQL);

  // 현재 스키마 버전 확인
  const meta = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = 'schema_version'`
  );
  const currentVersion = meta ? parseInt(meta.value, 10) : 0;

  // 마이그레이션 실행
  for (const m of MIGRATIONS) {
    if (m.version > currentVersion) {
      console.log(`[DB] Migrating to v${m.version}...`);
      try {
        await db.execAsync(m.sql);
      } catch (err) {
        // 컬럼이 이미 있는 경우 등은 무시
        console.warn(`[DB] Migration v${m.version} partially failed:`, String(err));
      }
    }
  }

  // 스키마 버전 기록
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)`,
    ['schema_version', String(SCHEMA_VERSION), now]
  );

  console.log(`[DB] Initialized (schema v${SCHEMA_VERSION})`);

  // iCloud/Google Drive 백업 대상 위치 로그 (디버깅용)
  try {
    const path = await getDBPath();
    console.log(`[DB] Path: ${path}`);
  } catch (err) {
    console.warn('[DB] getDBPath failed (debug log only):', err);
  }
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
 * DB 완전 초기화
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

/**
 * 익명 ID 생성 (간단한 UUID v4)
 */
export function generateAnonId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
