/**
 * DB 연결 관리 및 초기화.
 * 앱 루트 레이아웃에서 initializeDatabase() 한 번 호출.
 *
 * v3:
 *   - 초기화 후 자동 백업 체크 (24시간 지났으면 백업)
 *   - 초기화 후 깨진 사진 참조 정리 (앱 UUID 변경 대응)
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

  const meta = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = 'schema_version'`
  );
  const currentVersion = meta ? parseInt(meta.value, 10) : 0;

  for (const m of MIGRATIONS) {
    if (m.version > currentVersion) {
      console.log(`[DB] Migrating to v${m.version}...`);
      // ALTER TABLE ADD COLUMN 이 이미 있으면 "duplicate column" 에러 → 안전 처리
      const statements = m.sql.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        try {
          await db.execAsync(stmt);
        } catch (err: any) {
          const msg = String(err?.message ?? err);
          if (!msg.includes('duplicate column')) {
            console.warn(`[DB] Migration v${m.version} stmt failed:`, msg);
          }
        }
      }
    }
  }

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)`,
    ['schema_version', String(SCHEMA_VERSION), now]
  );

  // ---------------------------------------------------------------------
  // 일회성 데이터 정리 #1 — Wikipedia 이벤트 제거
  // ---------------------------------------------------------------------
  try {
    const delResult = await db.runAsync(
      `DELETE FROM events WHERE external_id LIKE 'wiki:%'`
    );
    if ((delResult.changes ?? 0) > 0) {
      console.log(`[DB] Cleaned ${delResult.changes} wikipedia-sourced events`);
      const resetResult = await db.runAsync(
        `UPDATE artist_sync_state SET last_fetched_at = NULL`
      );
      console.log(`[DB] Reset sync state for ${resetResult.changes ?? 0} artists → next sync will be full`);
    }
  } catch (err) {
    console.warn('[DB] Wikipedia cleanup failed:', String(err));
  }

  // ---------------------------------------------------------------------
  // 일회성 데이터 정리 #2 — 지원되지 않는 카테고리 정리
  // ---------------------------------------------------------------------
  try {
    await db.runAsync(
      `UPDATE events SET category = '콘서트', cat_icon = '🎤' WHERE category = '공연'`
    );
    const festResult = await db.runAsync(
      `UPDATE events SET category = '페스티벌', cat_icon = '🎉'
       WHERE category IN ('무용', '대중무용', '서커스', '서커스/마술', '복합', '발레')`
    );
    if ((festResult.changes ?? 0) > 0) {
      console.log(`[DB] Reclassified ${festResult.changes} events → 페스티벌`);
    }
    const removeResult = await db.runAsync(
      `DELETE FROM events
       WHERE category NOT IN ('콘서트','뮤지컬','연극','팬미팅','페스티벌','전시')`
    );
    if ((removeResult.changes ?? 0) > 0) {
      console.log(`[DB] Removed ${removeResult.changes} events with unsupported categories`);
    }
    await db.runAsync(
      `UPDATE tickets SET category = '콘서트', cat_icon = '🎤' WHERE category = '공연'`
    );
    await db.runAsync(
      `UPDATE tickets SET category = '페스티벌', cat_icon = '🎉'
       WHERE category IN ('무용', '대중무용', '서커스', '서커스/마술', '복합', '발레')`
    );
    const ticketRecat = await db.runAsync(
      `UPDATE tickets SET category = '콘서트', cat_icon = '🎤'
       WHERE category NOT IN ('콘서트','뮤지컬','연극','팬미팅','페스티벌','전시')`
    );
    if ((ticketRecat.changes ?? 0) > 0) {
      console.log(`[DB] Reclassified ${ticketRecat.changes} tickets → 콘서트 (user-entered, preserving)`);
    }
  } catch (err) {
    console.warn('[DB] Category cleanup failed:', String(err));
  }

  console.log(`[DB] Initialized (schema v${SCHEMA_VERSION})`);

  // ---------------------------------------------------------------------
  // 백그라운드 작업: 깨진 사진 참조 정리 + 자동 백업 체크
  //   - prebuild 후 앱 UUID 변경으로 옛 절대 경로 못 찾는 사진 청소
  //   - 24시간 지났으면 자동 백업
  //   - 비동기 (앱 시작 안 막음)
  // ---------------------------------------------------------------------
  setTimeout(async () => {
    // 1. 깨진 사진 참조 정리
    try {
      const photoModule = await import('@/services/ticketPhoto');
      const cleaned = await photoModule.cleanupBrokenPhotoRefs();
      if (cleaned > 0) {
        console.log(`[DB] Cleaned ${cleaned} broken photo references`);
      }
    } catch (e: any) {
      console.warn('[DB] photo cleanup failed:', e?.message ?? e);
    }

    // 2. 자동 백업 체크
    try {
      const backupModule = await import('@/services/backup');
      await backupModule.checkAndRunStartupBackup();
    } catch (e: any) {
      console.warn('[DB] startup backup failed:', e?.message ?? e);
    }

    // 3. v2: 뱃지 체크 (기존 데이터 소급 적용)
    try {
      const badgeModule = await import('@/services/badgeChecker');
      const newly = await badgeModule.checkAndUnlockBadges();
      if (newly.length > 0) console.log(`[DB] Unlocked ${newly.length} badges on startup`);
    } catch (e: any) {
      console.warn('[DB] badge check failed:', e?.message ?? e);
    }

    // 4. v2: D-day & 티켓 오픈 알림 스케줄링
    try {
      const notifModule = await import('@/services/eventNotifications');
      await notifModule.scheduleUpcomingEventNotifications();
    } catch (e: any) {
      console.warn('[DB] notification scheduling failed:', e?.message ?? e);
    }
  }, 3000);
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
    DROP TABLE IF EXISTS badges;
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
