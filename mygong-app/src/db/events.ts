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

export async function createEvent(data: Partial<Event>): Promise<number> {
  const db = await getDB();
  const now = new Date().toISOString();
  const weekday = data.weekday ?? weekdayFor(data.date);
  const result = await db.runAsync(
    `INSERT INTO events
      (artist_id, external_id, title, category, cat_icon, date, weekday, time, venue, city,
       price, ticket_url, poster_url, notify_enabled, notes, source, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
  };
  for (const [k, col] of Object.entries(map)) {
    if (k in data) { fields.push(`${col} = ?`); values.push((data as any)[k] ?? null); }
  }
  if ('notifyEnabled' in data) { fields.push('notify_enabled = ?'); values.push(data.notifyEnabled ? 1 : 0); }
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

function weekdayFor(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return ['일','월','화','수','목','금','토'][d.getDay()];
}
