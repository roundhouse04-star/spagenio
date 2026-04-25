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
  wishlisted?: boolean;
};

// ─────────────────────────────────────────────────────────────
// 📖 READ 함수들
// ─────────────────────────────────────────────────────────────

/**
 * 모든 이벤트 조회 (필터 옵션)
 */
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

/**
 * ID로 이벤트 단건 조회
 */
export async function getEventById(id: number): Promise<Event | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>('SELECT * FROM events WHERE id = ?', [id]);
  return row ? rowToEvent(row) : null;
}

/**
 * external_id로 이벤트 조회
 */
export async function getEventByExternalId(externalId: string): Promise<Event | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM events WHERE external_id = ?',
    [externalId]
  );
  return row ? rowToEvent(row) : null;
}

/**
 * 위시리스트 이벤트 조회
 * @param limit 최대 개수 (기본 제한 없음)
 */
export async function getWishlistedEvents(limit?: number): Promise<Event[]> {
  const db = await getDB();
  const sql = `SELECT * FROM events 
               WHERE is_wishlisted = 1 
               ORDER BY date ASC${limit ? ` LIMIT ${limit}` : ''}`;
  const rows = await db.getAllAsync<any>(sql);
  return rows.map(rowToEvent);
}

/**
 * 아티스트의 다가오는 공연 조회
 */
export async function getUpcomingEventsForArtist(artistId: number): Promise<Event[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM events 
     WHERE artist_id = ? AND date >= date('now')
     ORDER BY date ASC`,
    [artistId]
  );
  return rows.map(rowToEvent);
}

/**
 * 아티스트의 지난 공연 조회
 */
export async function getPastEventsForArtist(artistId: number): Promise<Event[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM events 
     WHERE artist_id = ? AND date < date('now')
     ORDER BY date DESC`,
    [artistId]
  );
  return rows.map(rowToEvent);
}

// ─────────────────────────────────────────────────────────────
// ✏️ WRITE 함수들
// ─────────────────────────────────────────────────────────────

/**
 * 이벤트 생성
 */
export async function createEvent(event: Partial<Event>): Promise<number> {
  const db = await getDB();
  const result = await db.runAsync(
    `INSERT INTO events (
      artist_id, external_id, title, category, cat_icon,
      date, weekday, time, venue, city, price,
      ticket_url, poster_url, notify_enabled, is_wishlisted,
      ticket_open_at, notes, source, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      event.artistId ?? null,
      event.externalId ?? null,
      event.title ?? '',
      event.category ?? '',
      event.catIcon ?? null,
      event.date ?? '',
      event.weekday ?? null,
      event.time ?? null,
      event.venue ?? null,
      event.city ?? null,
      event.price ?? null,
      event.ticketUrl ?? null,
      event.posterUrl ?? null,
      event.notifyEnabled ? 1 : 0,
      event.isWishlisted ? 1 : 0,
      event.ticketOpenAt ?? null,
      event.notes ?? null,
      event.source ?? null,
    ]
  );
  return result.lastInsertRowId;
}

/**
 * 이벤트 수정
 */
export async function updateEvent(id: number, updates: Partial<Event>): Promise<void> {
  const db = await getDB();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
  if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category); }
  if (updates.catIcon !== undefined) { fields.push('cat_icon = ?'); values.push(updates.catIcon); }
  if (updates.date !== undefined) { fields.push('date = ?'); values.push(updates.date); }
  if (updates.weekday !== undefined) { fields.push('weekday = ?'); values.push(updates.weekday); }
  if (updates.time !== undefined) { fields.push('time = ?'); values.push(updates.time); }
  if (updates.venue !== undefined) { fields.push('venue = ?'); values.push(updates.venue); }
  if (updates.city !== undefined) { fields.push('city = ?'); values.push(updates.city); }
  if (updates.price !== undefined) { fields.push('price = ?'); values.push(updates.price); }
  if (updates.ticketUrl !== undefined) { fields.push('ticket_url = ?'); values.push(updates.ticketUrl); }
  if (updates.posterUrl !== undefined) { fields.push('poster_url = ?'); values.push(updates.posterUrl); }
  if (updates.notifyEnabled !== undefined) { fields.push('notify_enabled = ?'); values.push(updates.notifyEnabled ? 1 : 0); }
  if (updates.isWishlisted !== undefined) { fields.push('is_wishlisted = ?'); values.push(updates.isWishlisted ? 1 : 0); }
  if (updates.ticketOpenAt !== undefined) { fields.push('ticket_open_at = ?'); values.push(updates.ticketOpenAt); }
  if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes); }

  if (fields.length === 0) return;

  fields.push('updated_at = datetime("now")');
  values.push(id);

  await db.runAsync(
    `UPDATE events SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

/**
 * 이벤트 삭제
 */
export async function deleteEvent(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM events WHERE id = ?', [id]);
}

/**
 * 특정 아티스트 + 소스의 이벤트 전체 삭제
 * (동기화 시 오래된 데이터 정리용)
 */
export async function deleteEventsForArtistFromSource(
  artistId: number,
  source: string
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    'DELETE FROM events WHERE artist_id = ? AND source = ?',
    [artistId, source]
  );
}

/**
 * 위시리스트 토글
 */
export async function toggleWishlist(id: number): Promise<boolean> {
  const db = await getDB();
  const event = await getEventById(id);
  if (!event) return false;

  const newValue = !event.isWishlisted;
  await db.runAsync(
    'UPDATE events SET is_wishlisted = ?, updated_at = datetime("now") WHERE id = ?',
    [newValue ? 1 : 0, id]
  );
  return newValue;
}

/**
 * external_id 기준 upsert
 * (KOPIS 같은 외부 API 데이터 동기화 시 사용)
 */
export async function upsertEventByExternalId(event: Partial<Event>): Promise<number> {
  if (!event.externalId) {
    throw new Error('externalId is required for upsert');
  }

  const db = await getDB();
  const existing = await getEventByExternalId(event.externalId);

  if (existing) {
    // 업데이트
    await updateEvent(existing.id!, event);
    return existing.id!;
  } else {
    // 생성
    return await createEvent(event);
  }
}
