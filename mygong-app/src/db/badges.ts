/**
 * Badge DB 헬퍼.
 *
 * 뱃지 정의는 BADGE_DEFINITIONS에 정적으로 고정.
 * DB에는 "획득한 뱃지"만 저장 (badge_id + unlocked_at).
 */
import { getDB } from './database';

export async function getUnlockedBadgeIds(): Promise<Set<string>> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ badge_id: string }>(
    `SELECT badge_id FROM badges`
  );
  return new Set(rows.map(r => r.badge_id));
}

export async function getUnlockedBadges(): Promise<{ id: string; unlockedAt: string }[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ badge_id: string; unlocked_at: string }>(
    `SELECT badge_id, unlocked_at FROM badges ORDER BY unlocked_at DESC`
  );
  return rows.map(r => ({ id: r.badge_id, unlockedAt: r.unlocked_at }));
}

export async function unlockBadge(badgeId: string): Promise<boolean> {
  const db = await getDB();
  const exists = await db.getFirstAsync<{ badge_id: string }>(
    `SELECT badge_id FROM badges WHERE badge_id = ?`, [badgeId]
  );
  if (exists) return false;
  await db.runAsync(
    `INSERT INTO badges (badge_id, unlocked_at) VALUES (?, ?)`,
    [badgeId, new Date().toISOString()]
  );
  return true;
}

export async function clearAllBadges(): Promise<void> {
  const db = await getDB();
  await db.runAsync(`DELETE FROM badges`);
}
