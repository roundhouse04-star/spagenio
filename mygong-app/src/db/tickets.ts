/**
 * Ticket (다녀온 공연) DB 헬퍼.
 *
 * v2: 데이터 변경 시 자동 백업 트리거 (디바운스 5초)
 */
import { getDB } from './database';
import { triggerAutoBackup } from '@/services/backup';
import type { Ticket, DetailedRatings } from '@/types';

function rowToTicket(r: any): Ticket {
  let detailed: DetailedRatings | undefined;
  if (r.ratings_json) {
    try { detailed = JSON.parse(r.ratings_json); } catch { detailed = undefined; }
  }
  return {
    id: r.id,
    artistId: r.artist_id ?? undefined,
    eventId: r.event_id ?? undefined,
    title: r.title,
    category: r.category,
    catIcon: r.cat_icon ?? undefined,
    date: r.date,
    month: r.month ?? (r.date?.slice(0, 7) ?? ''),
    venue: r.venue ?? undefined,
    seat: r.seat ?? undefined,
    photoUri: r.photo_uri ?? undefined,
    rating: r.rating ?? 0,
    detailedRatings: detailed,          // v2
    price: r.price ?? undefined,        // v2
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export type TicketFilter = { artistId?: number; category?: string };

export async function getAllTickets(filter: TicketFilter = {}): Promise<Ticket[]> {
  const db = await getDB();
  const where: string[] = [];
  const params: any[] = [];
  if (filter.artistId != null) { where.push('artist_id = ?'); params.push(filter.artistId); }
  if (filter.category)          { where.push('category = ?'); params.push(filter.category); }
  const sql = `SELECT * FROM tickets
               ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY date DESC`;
  const rows = await db.getAllAsync<any>(sql, params);
  return rows.map(rowToTicket);
}

export async function getTicketById(id: number): Promise<Ticket | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>('SELECT * FROM tickets WHERE id = ?', [id]);
  return row ? rowToTicket(row) : null;
}

export async function getTicketsByArtist(artistId: number): Promise<Ticket[]> {
  return getAllTickets({ artistId });
}

export async function createTicket(data: Partial<Ticket>): Promise<number> {
  const db = await getDB();
  const now = new Date().toISOString();
  const month = data.month ?? (data.date ? data.date.slice(0, 7) : null);
  const ratingsJson = data.detailedRatings ? JSON.stringify(data.detailedRatings) : null;
  const result = await db.runAsync(
    `INSERT INTO tickets
      (artist_id, event_id, title, category, cat_icon, date, month, venue, seat,
       photo_uri, rating, ratings_json, price, notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.artistId ?? null,
      data.eventId ?? null,
      data.title ?? '',
      data.category ?? '콘서트',
      data.catIcon ?? null,
      data.date ?? '',
      month,
      data.venue ?? null,
      data.seat ?? null,
      data.photoUri ?? null,
      data.rating ?? 0,
      ratingsJson,
      data.price ?? null,
      data.notes ?? null,
      now, now,
    ]
  );
  triggerAutoBackup('data-change');  // ← 자동 백업
  // v2: 뱃지 체크 (비동기, 실패해도 티켓 생성 영향 X)
  setTimeout(async () => {
    try {
      const { checkAndUnlockBadges } = await import('@/services/badgeChecker');
      await checkAndUnlockBadges();
    } catch {}
  }, 500);
  return result.lastInsertRowId;
}

export async function updateTicket(id: number, data: Partial<Ticket>): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];
  const map: Record<string, string> = {
    artistId: 'artist_id', eventId: 'event_id', title: 'title', category: 'category',
    catIcon: 'cat_icon', date: 'date', month: 'month', venue: 'venue', seat: 'seat',
    photoUri: 'photo_uri', rating: 'rating', notes: 'notes', price: 'price',
  };
  for (const [k, col] of Object.entries(map)) {
    if (k in data) { fields.push(`${col} = ?`); values.push((data as any)[k] ?? null); }
  }
  // v2: detailedRatings 는 JSON 으로 변환
  if ('detailedRatings' in data) {
    fields.push('ratings_json = ?');
    values.push(data.detailedRatings ? JSON.stringify(data.detailedRatings) : null);
  }
  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  values.push(now, id);
  await db.runAsync(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`, values);
  triggerAutoBackup('data-change');  // ← 자동 백업
  // v2: 뱃지 체크
  setTimeout(async () => {
    try {
      const { checkAndUnlockBadges } = await import('@/services/badgeChecker');
      await checkAndUnlockBadges();
    } catch {}
  }, 500);
}

export async function deleteTicket(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM tickets WHERE id = ?', [id]);
  triggerAutoBackup('data-change');  // ← 자동 백업
}

export async function getTicketStats() {
  const db = await getDB();
  const total = await db.getFirstAsync<any>('SELECT COUNT(*) AS c FROM tickets');
  const avg   = await db.getFirstAsync<any>('SELECT AVG(rating) AS a FROM tickets WHERE rating > 0');
  const thisYear = await db.getFirstAsync<any>(
    `SELECT COUNT(*) AS c FROM tickets WHERE substr(date, 1, 4) = strftime('%Y', 'now')`
  );
  return {
    total: total?.c ?? 0,
    avgRating: avg?.a ?? 0,
    thisYear: thisYear?.c ?? 0,
  };
}
