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
 * SQL 문자열을 statement 단위로 분리.
 * `--` 한 줄 주석은 제거. 작은따옴표 문자열 내부의 ;는 보존하지 않음
 * (마이그레이션 SQL은 DDL 위주라 문자열 리터럴 거의 없음 — 단순 split으로 충분).
 */
function splitStatements(sql: string): string[] {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 멱등성 에러 (이미 적용된 마이그레이션) 판정.
 * SQLite의 ALTER TABLE ADD COLUMN은 IF NOT EXISTS가 없어 재실행 시 에러를 던지므로,
 * 이 에러만 선별 무시. 그 외 에러는 진짜 문제 → 트랜잭션 롤백.
 */
function isAlreadyAppliedError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return (
    msg.includes('duplicate column name') ||
    msg.includes('already exists')
  );
}

/**
 * 단일 마이그레이션을 트랜잭션으로 적용.
 * statement 단위로 실행하면서 멱등성 에러만 무시하고, 다른 에러는 throw → 자동 ROLLBACK.
 * 성공 시 같은 트랜잭션 내에서 schema_version도 갱신 → 부분 적용 상태 발생 방지.
 */
async function applyMigration(
  db: SQLite.SQLiteDatabase,
  m: { version: number; sql: string },
): Promise<void> {
  const statements = splitStatements(m.sql);
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const stmt of statements) {
      try {
        await txn.execAsync(stmt + ';');
      } catch (err) {
        if (isAlreadyAppliedError(err)) {
          console.log(`[DB] v${m.version}: skip (already applied) — ${stmt.slice(0, 80)}`);
          continue;
        }
        throw new Error(
          `[DB] migration v${m.version} aborted at: "${stmt.slice(0, 200)}" → ${String(err)}`,
        );
      }
    }
    const now = new Date().toISOString();
    await txn.runAsync(
      `INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)`,
      ['schema_version', String(m.version), now],
    );
  });
}

/**
 * 앱 시작 시 한 번 호출 - 스키마 생성 + 마이그레이션
 *
 * 마이그레이션 실패 시 throw — 호출자 (_layout.tsx) 가 사용자에게 안내해야 함.
 * 데이터 무결성을 위해 부분 적용 상태로 진행하지 않음.
 */
export async function initializeDatabase(): Promise<void> {
  const db = await getDB();

  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(CREATE_TABLES_SQL);

  // 현재 스키마 버전 확인
  const meta = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = 'schema_version'`,
  );
  const currentVersion = meta ? parseInt(meta.value, 10) : 0;

  // 신규 설치는 CREATE_TABLES_SQL 로 최신 스키마 생성됨 → 버전만 기록하고 마이그레이션 skip
  if (currentVersion === 0) {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)`,
      ['schema_version', String(SCHEMA_VERSION), now],
    );
    console.log(`[DB] Fresh install — schema v${SCHEMA_VERSION}`);
  } else {
    // 기존 사용자 → pending 마이그레이션 트랜잭션 단위로 적용
    for (const m of MIGRATIONS) {
      if (m.version > currentVersion) {
        console.log(`[DB] Migrating v${currentVersion} → v${m.version}...`);
        await applyMigration(db, m);
        console.log(`[DB] ✓ v${m.version} committed`);
      }
    }
  }

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
 * 사용자 가입 여부 확인 (user 레코드 존재만 체크)
 */
export async function isUserRegistered(): Promise<boolean> {
  const db = await getDB();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM user'
  );
  return (result?.count ?? 0) > 0;
}

/**
 * 약관/개인정보/면책 모두 동의했는지 확인.
 * 닉네임만 입력하고 약관 단계에서 종료한 사용자가 다음 부팅 시
 * 메인 화면으로 곧장 진입하는 것을 막기 위한 게이트.
 */
export async function hasFullConsent(): Promise<boolean> {
  const db = await getDB();
  const row = await db.getFirstAsync<{
    agree_terms: number;
    agree_privacy: number;
    agree_disclaimer: number;
  }>(
    `SELECT agree_terms, agree_privacy, agree_disclaimer
     FROM user
     ORDER BY id ASC
     LIMIT 1`,
  );
  if (!row) return false;
  return row.agree_terms === 1 && row.agree_privacy === 1 && row.agree_disclaimer === 1;
}

/**
 * DB 완전 초기화 — 모든 DROP을 트랜잭션으로 묶어 부분 삭제 상태 방지.
 * 실패 시 ROLLBACK되어 기존 테이블 그대로 유지됨.
 */
export async function resetDatabase(): Promise<void> {
  const db = await getDB();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync(`
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
  });
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
