/**
 * Trip 관련 DB 쿼리 헬퍼
 */
import { getDB } from './database';
import { Trip, TripStatus } from '@/types';

function rowToTrip(r: any): Trip {
  return {
    id: r.id,
    title: r.title,
    country: r.country,
    countryCode: r.country_code,
    city: r.city,
    startDate: r.start_date,
    endDate: r.end_date,
    budget: r.budget,
    currency: r.currency,
    status: r.status,
    coverImage: r.cover_image,
    memo: r.memo,
    isFavorite: !!r.is_favorite,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getAllTrips(filter?: TripStatus | 'all'): Promise<Trip[]> {
  const db = await getDB();
  const sql = filter && filter !== 'all'
    ? `SELECT * FROM trips WHERE status = ? ORDER BY start_date DESC, created_at DESC`
    : `SELECT * FROM trips ORDER BY start_date DESC, created_at DESC`;
  const params = filter && filter !== 'all' ? [filter] : [];
  const rows = await db.getAllAsync<any>(sql, params);
  return rows.map(rowToTrip);
}

export async function getTripById(id: number): Promise<Trip | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>('SELECT * FROM trips WHERE id = ?', [id]);
  return row ? rowToTrip(row) : null;
}

export async function createTrip(data: Partial<Trip>): Promise<number> {
  const db = await getDB();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO trips
      (title, country, country_code, city, start_date, end_date,
       budget, currency, status, cover_image, memo, is_favorite, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.title ?? '',
      data.country ?? null,
      data.countryCode ?? null,
      data.city ?? null,
      data.startDate ?? null,
      data.endDate ?? null,
      data.budget ?? 0,
      data.currency ?? 'KRW',
      data.status ?? 'planning',
      data.coverImage ?? null,
      data.memo ?? null,
      data.isFavorite ? 1 : 0,
      now,
      now,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateTrip(id: number, data: Partial<Trip>): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  const map: Record<string, string> = {
    title: 'title',
    country: 'country',
    countryCode: 'country_code',
    city: 'city',
    startDate: 'start_date',
    endDate: 'end_date',
    budget: 'budget',
    currency: 'currency',
    status: 'status',
    coverImage: 'cover_image',
    memo: 'memo',
  };

  for (const [key, col] of Object.entries(map)) {
    if (key in data) {
      fields.push(`${col} = ?`);
      values.push(data[key as keyof Trip]);
    }
  }
  if ('isFavorite' in data) {
    fields.push('is_favorite = ?');
    values.push(data.isFavorite ? 1 : 0);
  }
  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.runAsync(
    `UPDATE trips SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteTrip(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM trips WHERE id = ?', [id]);
}

export async function getTripStats() {
  const db = await getDB();
  const total = await db.getFirstAsync<any>('SELECT COUNT(*) as c FROM trips');
  const planning = await db.getFirstAsync<any>(
    `SELECT COUNT(*) as c FROM trips WHERE status = 'planning'`
  );
  const ongoing = await db.getFirstAsync<any>(
    `SELECT COUNT(*) as c FROM trips WHERE status = 'ongoing'`
  );
  const completed = await db.getFirstAsync<any>(
    `SELECT COUNT(*) as c FROM trips WHERE status = 'completed'`
  );
  const countries = await db.getFirstAsync<any>(
    `SELECT COUNT(DISTINCT country) as c FROM trips WHERE country IS NOT NULL AND country != ''`
  );
  return {
    total: total?.c ?? 0,
    planning: planning?.c ?? 0,
    ongoing: ongoing?.c ?? 0,
    completed: completed?.c ?? 0,
    countries: countries?.c ?? 0,
  };
}
