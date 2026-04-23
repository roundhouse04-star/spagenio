/**
 * Event DB 헬퍼.
 * 외부 페치 결과는 (external_id, artist_id) 쌍으로 upsert.
 */
import { getDB } from './database';
import type { Event } from '@/types';

function rowToEvent(r: any): Event {
  return {
    id: r.id,
    artistId: r.artist_id ?? undefined,
    externalId: r.external_id ?? undefined,
    title: r.title,
    category: r.category,
    catIcon: r.cat_icon ?? undefined,
    date: r.date,
    weekday: r.weekday ?? undefined,
    time: r.time ?? undefined,
    venue: r.venue ?? undefined,
    city: r.city ?? undefined,
    price: r.price ?? undefined,
    ticketUrl: r.ticket_url ?? undefined,
    posterUrl: r.poster_url ?? undefined,
    notifyEnabled: !!r.notify_enabled,
    isWishlisted: !!r.is_wishlisted,
    ticketOpenAt: r.ticket_open_at ?? undefined,
    notes: r.notes ?? undefined,
    source: r.source ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export type EventFilter = {
  artistId?: number;
  category?: string;
  upcoming?: boolean;
  from?: string;   // YYYY-MM-DD
  to?: string;
  wishlisted?: boolean;   // v2
};

export async function getAllEvents(filter: EventFilter = {}): Promise<Event[]> {
  const db = await getDB();
  const where: string[] = [];
  const params: any[] = [];

  if (filter.artistId != null) { where.push('artist_id = ?');  params.push(filter.artistId); }
  if (filter.category)          { where.push('category = ?');   params.push(filter.category); }
  if (filter.upcoming)          { where.push('date >= date("now")'); }
  if (filter.from)              { where.push('date >= ?'); params.push(filter.from); }
  if (filter.to)                { where.push('date <= ?'); params.push(filter.to); }
  if (filter.wishlisted)        { where.push('is_wishlisted = 1'); }

  const sql = `SELECT * FROM events
               ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY date ASC, time ASC`;
  const rows = await db.getAllAsync<any>(sql, params);
  return rows.map(rowToEvent);
}

export async function getEventById(id: number): Promise<Event | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>('SELECT * FROM events WHERE id = ?', [id]);
  return row ? rowToEvent(row) : null;
}

export async function getUpcomingEventsForArtist(artistId: number, limit = 5): Promise<Event[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM events WHERE artist_id = ? AND date >= date("now") ORDER BY date ASC LIMIT ?`,
    [artistId, limit]
  );
  return rows.map(rowToEvent);
}

/**
 * 특정 아티스트의 "지난 공연" 목록 (오늘 이전).
 * Wikipedia/KOPIS에서 수집한 과거 공연 이력 및 앨범 발매 기록 등.
 * 최신순(DESC)으로 정렬.
 */
export async function getPastEventsForArtist(artistId: number, limit = 50): Promise<Event[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM events WHERE artist_id = ? AND date < date("now") ORDER BY date DESC LIMIT ?`,
    [artistId, limit]
  );
  return rows.map(rowToEvent);
}

export async function createEvent(data: Partial<Event>): Promise<number> {
  const db = await getDB();
  const now = new Date().toISOString();
  const weekday = data.weekday ?? weekdayFor(data.date);
  const result = await db.runAsync(
    `INSERT INTO events
      (artist_id, external_id, title, category, cat_icon, date, weekday, time, venue, city,
       price, ticket_url, poster_url, notify_enabled, is_wishlisted, ticket_open_at, notes, source, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.artistId ?? null,
      data.externalId ?? null,
      data.title ?? '',
      data.category ?? '콘서트',
      data.catIcon ?? null,
      data.date ?? null,
      weekday,
      data.time ?? null,
      data.venue ?? null,
      data.city ?? null,
      data.price ?? null,
      data.ticketUrl ?? null,
      data.posterUrl ?? null,
      data.notifyEnabled === false ? 0 : 1,
      data.isWishlisted ? 1 : 0,
      data.ticketOpenAt ?? null,
      data.notes ?? null,
      data.source ?? 'manual',
      now, now,
    ]
  );
  return result.lastInsertRowId;
}

export async function upsertEventByExternalId(
  externalId: string, artistId: number | null, data: Partial<Event>
): Promise<number> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>(
    `SELECT id FROM events WHERE external_id = ? AND (artist_id IS ? OR artist_id = ?)`,
    [externalId, artistId, artistId]
  );
  if (row) {
    await updateEvent(row.id, data);
    return row.id;
  }
  return createEvent({ ...data, externalId, artistId: artistId ?? undefined });
}

export async function updateEvent(id: number, data: Partial<Event>): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];
  const map: Record<string, string> = {
    artistId: 'artist_id', externalId: 'external_id', title: 'title',
    category: 'category', catIcon: 'cat_icon', date: 'date', weekday: 'weekday',
    time: 'time', venue: 'venue', city: 'city', price: 'price',
    ticketUrl: 'ticket_url', posterUrl: 'poster_url', notes: 'notes', source: 'source',
    ticketOpenAt: 'ticket_open_at',
  };
  for (const [k, col] of Object.entries(map)) {
    if (k in data) { fields.push(`${col} = ?`); values.push((data as any)[k] ?? null); }
  }
  if ('notifyEnabled' in data) { fields.push('notify_enabled = ?'); values.push(data.notifyEnabled ? 1 : 0); }
  if ('isWishlisted' in data)  { fields.push('is_wishlisted = ?');  values.push(data.isWishlisted  ? 1 : 0); }
  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  values.push(now, id);
  await db.runAsync(`UPDATE events SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteEvent(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM events WHERE id = ?', [id]);
}

export async function deleteEventsForArtistFromSource(
  artistId: number, source: string
): Promise<number> {
  const db = await getDB();
  const result = await db.runAsync(
    `DELETE FROM events WHERE artist_id = ? AND source = ?`, [artistId, source]
  );
  return result.changes ?? 0;
}

// ────────── v2: 위시리스트 & 티켓오픈 ──────────

/** 위시리스트 이벤트 조회 (다가오는 것 우선) */
export async function getWishlistedEvents(limit = 20): Promise<Event[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM events
     WHERE is_wishlisted = 1
     ORDER BY
       CASE WHEN date >= date("now") THEN 0 ELSE 1 END,
       date ASC
     LIMIT ?`,
    [limit]
  );
  return rows.map(rowToEvent);
}

/** 위시리스트 토글. 바뀐 값(true/false) 리턴 */
export async function toggleWishlist(id: number): Promise<boolean> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ is_wishlisted: number }>(
    `SELECT is_wishlisted FROM events WHERE id = ?`, [id]
  );
  const next = row?.is_wishlisted ? 0 : 1;
  await db.runAsync(
    `UPDATE events SET is_wishlisted = ?, updated_at = ? WHERE id = ?`,
    [next, new Date().toISOString(), id]
  );
  return !!next;
}

/** 다가오는 티켓 오픈 이벤트 (알림 스케줄링용) */
export async function getUpcomingTicketOpens(): Promise<Event[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM events
     WHERE ticket_open_at IS NOT NULL
       AND ticket_open_at >= datetime("now")
     ORDER BY ticket_open_at ASC`
  );
  return rows.map(rowToEvent);
}

function weekdayFor(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return ['일','월','화','수','목','금','토'][d.getDay()];
}
