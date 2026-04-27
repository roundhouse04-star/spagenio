/**
 * Trip Logs (여행 일기) DB 쿼리 헬퍼
 */
import { getDB } from './database';
import { TripLog } from '@/types';

function rowToLog(r: any): TripLog {
  let images: string[] = [];
  try {
    images = r.images ? JSON.parse(r.images) : [];
  } catch {
    images = [];
  }
  return {
    id: r.id,
    tripId: r.trip_id,
    logDate: r.log_date,
    title: r.title,
    content: r.content,
    images,
    location: r.location,
    latitude: r.latitude,
    longitude: r.longitude,
    weather: r.weather,
    mood: r.mood,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getTripLogs(tripId: number): Promise<TripLog[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM trip_logs WHERE trip_id = ? ORDER BY log_date DESC, created_at DESC`,
    [tripId]
  );
  return rows.map(rowToLog);
}

export async function getTripLog(id: number): Promise<TripLog | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>('SELECT * FROM trip_logs WHERE id = ?', [id]);
  return row ? rowToLog(row) : null;
}

export async function createTripLog(data: Partial<TripLog>): Promise<number> {
  const db = await getDB();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO trip_logs
      (trip_id, log_date, title, content, images, location, latitude, longitude,
       weather, mood, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.tripId!,
      data.logDate ?? new Date().toISOString().slice(0, 10),
      data.title ?? null,
      data.content ?? null,
      JSON.stringify(data.images ?? []),
      data.location ?? null,
      data.latitude ?? null,
      data.longitude ?? null,
      data.weather ?? null,
      data.mood ?? null,
      now,
      now,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateTripLog(id: number, data: Partial<TripLog>): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  const map: Record<string, string> = {
    logDate: 'log_date',
    title: 'title',
    content: 'content',
    location: 'location',
    latitude: 'latitude',
    longitude: 'longitude',
    weather: 'weather',
    mood: 'mood',
  };

  for (const [key, col] of Object.entries(map)) {
    if (key in data) {
      fields.push(`${col} = ?`);
      values.push(data[key as keyof TripLog]);
    }
  }
  if ('images' in data) {
    fields.push('images = ?');
    values.push(JSON.stringify(data.images ?? []));
  }
  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.runAsync(`UPDATE trip_logs SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteTripLog(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM trip_logs WHERE id = ?', [id]);
}
