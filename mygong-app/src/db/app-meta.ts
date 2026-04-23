/**
 * app_meta — 키-값 설정 저장소.
 * 온보딩 완료 여부, 사용자 프리퍼런스 등 가벼운 설정을 SQLite 에 저장.
 *
 * v4.1 부터 KOPIS API 키는 더 이상 여기에 저장하지 않음
 * (Cloudflare Worker 환경변수로 이관).
 */
import { getDB } from './database';

export const META_KEYS = {
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
