/**
 * Trip Items (일정) DB 쿼리 헬퍼
 */
import { getDB } from './database';
import { TripItem, TripItemCategory } from '@/types';

function rowToItem(r: any): TripItem {
  return {
    id: r.id,
    tripId: r.trip_id,
    day: r.day,
    startTime: r.start_time,
    endTime: r.end_time,
    title: r.title,
    location: r.location,
    latitude: r.latitude,
    longitude: r.longitude,
    memo: r.memo,
    cost: r.cost,
    currency: r.currency,
    category: r.category as TripItemCategory,
    isDone: !!r.is_done,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  };
}

export async function getTripItems(tripId: number): Promise<TripItem[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM trip_items WHERE trip_id = ?
     ORDER BY day ASC, start_time ASC, sort_order ASC, id ASC`,
    [tripId]
  );
  return rows.map(rowToItem);
}

export async function getItemsByDay(tripId: number, day: number): Promise<TripItem[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM trip_items WHERE trip_id = ? AND day = ?
     ORDER BY start_time ASC, sort_order ASC, id ASC`,
    [tripId, day]
  );
  return rows.map(rowToItem);
}

export async function createTripItem(data: Partial<TripItem>): Promise<number> {
  const db = await getDB();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO trip_items
      (trip_id, day, start_time, end_time, title, location, latitude, longitude,
       memo, cost, currency, category, is_done, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.tripId!,
      data.day ?? 1,
      data.startTime ?? null,
      data.endTime ?? null,
      data.title ?? '',
      data.location ?? null,
      data.latitude ?? null,
      data.longitude ?? null,
      data.memo ?? null,
      data.cost ?? 0,
      data.currency ?? null,
      data.category ?? 'sightseeing',
      data.isDone ? 1 : 0,
      data.sortOrder ?? 0,
      now,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateTripItem(id: number, data: Partial<TripItem>): Promise<void> {
  const db = await getDB();
  const fields: string[] = [];
  const values: any[] = [];

  const map: Record<string, string> = {
    day: 'day',
    startTime: 'start_time',
    endTime: 'end_time',
    title: 'title',
    location: 'location',
    latitude: 'latitude',
    longitude: 'longitude',
    memo: 'memo',
    cost: 'cost',
    currency: 'currency',
    category: 'category',
    sortOrder: 'sort_order',
  };

  for (const [key, col] of Object.entries(map)) {
    if (key in data) {
      fields.push(`${col} = ?`);
      values.push(data[key as keyof TripItem]);
    }
  }
  if ('isDone' in data) {
    fields.push('is_done = ?');
    values.push(data.isDone ? 1 : 0);
  }
  if (fields.length === 0) return;

  values.push(id);
  await db.runAsync(`UPDATE trip_items SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function toggleItemDone(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('UPDATE trip_items SET is_done = NOT is_done WHERE id = ?', [id]);
}

export async function deleteTripItem(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM trip_items WHERE id = ?', [id]);
}

/**
 * 여행 기간 동안 며칠짜리인지 계산 (1일차 ~ N일차)
 */
export function calculateTripDays(startDate?: string | null, endDate?: string | null): number {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}
