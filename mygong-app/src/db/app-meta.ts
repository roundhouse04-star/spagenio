/**
 * app_meta — 키-값 설정 저장소.
 * KOPIS API 키 같은 사용자별 설정을 SQLite 에 저장.
 */
import { getDB } from './database';

export const META_KEYS = {
  KOPIS_API_KEY: 'kopis_api_key',
  ONBOARDING_DONE: 'onboarding_done',
} as const;

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?', [key]
  );
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, now]
  );
}

export async function deleteMeta(key: string): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM app_meta WHERE key = ?', [key]);
}
