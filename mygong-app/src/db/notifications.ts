/**
 * 알림 인박스 DB 헬퍼.
 * dateGroup("오늘" / "어제" / "이번주" / "이전")은 조회 시점에 동적으로 붙여줌.
 */
import { getDB } from './database';
import type { Notification } from '@/types';

function rowToNotif(r: any): Notification {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    subtitle: r.subtitle ?? undefined,
    icon: r.icon ?? undefined,
    artistId: r.artist_id ?? undefined,
    eventId: r.event_id ?? undefined,
    ticketId: r.ticket_id ?? undefined,
    createdAt: r.created_at,
    isNew: !!r.is_new,
    dateGroup: computeGroup(r.created_at),
  };
}

function computeGroup(iso: string): string {
  const now = new Date();
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (now.toDateString() === d.toDateString()) return '오늘';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (y.toDateString() === d.toDateString()) return '어제';
  if (diffDays < 7)  return '이번주';
  if (diffDays < 30) return '이전';
  return '오래전';
}

export async function getAllNotifications(): Promise<Notification[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200`
  );
  return rows.map(rowToNotif);
}

export async function getUnreadCount(): Promise<number> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>(`SELECT COUNT(*) AS c FROM notifications WHERE is_new = 1`);
  return row?.c ?? 0;
}

export async function createNotification(data: Partial<Notification>): Promise<number> {
  const db = await getDB();
  const now = data.createdAt ?? new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO notifications
      (kind, title, subtitle, icon, artist_id, event_id, ticket_id, created_at, is_new)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      data.kind ?? 'manual',
      data.title ?? '',
      data.subtitle ?? null,
      data.icon ?? null,
      data.artistId ?? null,
      data.eventId ?? null,
      data.ticketId ?? null,
      now,
      data.isNew === false ? 0 : 1,
    ]
  );
  return result.lastInsertRowId;
}

export async function markAsRead(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('UPDATE notifications SET is_new = 0 WHERE id = ?', [id]);
}

export async function markAllRead(): Promise<void> {
  const db = await getDB();
  await db.runAsync('UPDATE notifications SET is_new = 0 WHERE is_new = 1');
}

export async function clearAll(): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM notifications');
}

export async function deleteNotification(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM notifications WHERE id = ?', [id]);
}
