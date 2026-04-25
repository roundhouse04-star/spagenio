/**
 * photos.ts — 아티스트별 공연 사진첩 DB 관리
 */
import { getDB } from './database';

export interface Photo {
  id: number;
  artistId: number;
  photoUri: string;
  caption?: string;
  takenAt?: string;
  createdAt: string;
}

export type PhotoInsert = Omit<Photo, 'id' | 'createdAt'>;

/** 아티스트의 모든 사진 가져오기 (최신순) */
export async function getPhotosByArtist(artistId: number): Promise<Photo[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Photo>(
    `SELECT id, artist_id as artistId, photo_uri as photoUri, caption, taken_at as takenAt, created_at as createdAt
     FROM photos
     WHERE artist_id = ?
     ORDER BY created_at DESC`,
    [artistId]
  );
  return rows;
}

/** 사진 1개 가져오기 */
export async function getPhotoById(photoId: number): Promise<Photo | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<Photo>(
    `SELECT id, artist_id as artistId, photo_uri as photoUri, caption, taken_at as takenAt, created_at as createdAt
     FROM photos
     WHERE id = ?`,
    [photoId]
  );
  return row || null;
}

/** 사진 추가 */
export async function createPhoto(data: PhotoInsert): Promise<number> {
  const db = await getDB();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO photos (artist_id, photo_uri, caption, taken_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [data.artistId, data.photoUri, data.caption || null, data.takenAt || null, now]
  );
  return result.lastInsertRowId;
}

/** 사진 수정 (캡션, 촬영일) */
export async function updatePhoto(
  photoId: number,
  data: Partial<Pick<Photo, 'caption' | 'takenAt'>>
): Promise<void> {
  const db = await getDB();
  const updates: string[] = [];
  const values: any[] = [];

  if (data.caption !== undefined) {
    updates.push('caption = ?');
    values.push(data.caption);
  }
  if (data.takenAt !== undefined) {
    updates.push('taken_at = ?');
    values.push(data.takenAt);
  }

  if (updates.length === 0) return;

  values.push(photoId);
  await db.runAsync(
    `UPDATE photos SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
}

/** 사진 삭제 */
export async function deletePhoto(photoId: number): Promise<void> {
  const db = await getDB();
  await db.runAsync(`DELETE FROM photos WHERE id = ?`, [photoId]);
}

/** 아티스트의 모든 사진 삭제 */
export async function deletePhotosByArtist(artistId: number): Promise<void> {
  const db = await getDB();
  await db.runAsync(`DELETE FROM photos WHERE artist_id = ?`, [artistId]);
}

/** 사진 개수 */
export async function getPhotoCount(artistId: number): Promise<number> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM photos WHERE artist_id = ?`,
    [artistId]
  );
  return row?.count ?? 0;
}
