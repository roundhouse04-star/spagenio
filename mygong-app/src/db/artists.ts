/**
 * Artist DB 헬퍼.
 * 외부에서 가져온 아티스트는 external_id 로 upsert.
 */
import { getDB } from './database';
import type { Artist } from '@/types';

function rowToArtist(r: any): Artist {
  return {
    id: r.id,
    externalId: r.external_id ?? undefined,
    name: r.name,
    nameEn: r.name_en ?? undefined,
    role: r.role ?? undefined,
    tag: r.tag ?? undefined,
    emoji: r.emoji ?? undefined,
    avatarUrl: r.avatar_url ?? undefined,
    thumbColor: r.thumb_color ?? undefined,
    bio: r.bio ?? undefined,
    followers: r.followers ?? undefined,
    isFollowing: !!r.is_following,
    notifyEnabled: !!r.notify_enabled,
    lastSyncedAt: r.last_synced_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getAllArtists(filter?: 'following' | 'all'): Promise<Artist[]> {
  const db = await getDB();
  const sql = filter === 'following'
    ? `SELECT * FROM artists WHERE is_following = 1 ORDER BY updated_at DESC`
    : `SELECT * FROM artists ORDER BY updated_at DESC`;
  const rows = await db.getAllAsync<any>(sql);
  return rows.map(rowToArtist);
}

export async function getArtistById(id: number): Promise<Artist | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>('SELECT * FROM artists WHERE id = ?', [id]);
  return row ? rowToArtist(row) : null;
}

export async function getArtistByExternalId(externalId: string): Promise<Artist | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>('SELECT * FROM artists WHERE external_id = ?', [externalId]);
  return row ? rowToArtist(row) : null;
}

export async function searchArtistsLocal(q: string): Promise<Artist[]> {
  if (!q.trim()) return [];
  const db = await getDB();
  const term = `%${q.trim()}%`;
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM artists WHERE name LIKE ? OR name_en LIKE ? OR role LIKE ? LIMIT 20`,
    [term, term, term]
  );
  return rows.map(rowToArtist);
}

export async function createArtist(data: Partial<Artist>): Promise<number> {
  const db = await getDB();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO artists
      (external_id, name, name_en, role, tag, emoji, avatar_url, thumb_color, bio, followers,
       is_following, notify_enabled, last_synced_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.externalId ?? null,
      data.name ?? '',
      data.nameEn ?? null,
      data.role ?? null,
      data.tag ?? null,
      data.emoji ?? null,
      data.avatarUrl ?? null,
      data.thumbColor ?? null,
      data.bio ?? null,
      data.followers ?? null,
      data.isFollowing === false ? 0 : 1,
      data.notifyEnabled === false ? 0 : 1,
      data.lastSyncedAt ?? null,
      now, now,
    ]
  );
  return result.lastInsertRowId;
}

/** 외부에서 페치한 데이터 저장/갱신. 이미 있으면 update, 없으면 insert. */
export async function upsertArtistByExternalId(
  externalId: string,
  data: Partial<Artist>,
): Promise<number> {
  const existing = await getArtistByExternalId(externalId);
  if (existing) {
    await updateArtist(existing.id, data);
    return existing.id;
  }
  return createArtist({ ...data, externalId });
}

export async function updateArtist(id: number, data: Partial<Artist>): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  const map: Record<string, string> = {
    externalId: 'external_id', name: 'name', nameEn: 'name_en', role: 'role',
    tag: 'tag', emoji: 'emoji', avatarUrl: 'avatar_url', thumbColor: 'thumb_color',
    bio: 'bio', followers: 'followers', lastSyncedAt: 'last_synced_at',
  };
  for (const [k, col] of Object.entries(map)) {
    if (k in data) {
      fields.push(`${col} = ?`);
      values.push((data as any)[k] ?? null);
    }
  }
  if ('isFollowing'   in data) { fields.push('is_following = ?');   values.push(data.isFollowing ? 1 : 0); }
  if ('notifyEnabled' in data) { fields.push('notify_enabled = ?'); values.push(data.notifyEnabled ? 1 : 0); }
  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(now, id);
  await db.runAsync(`UPDATE artists SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteArtist(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM artists WHERE id = ?', [id]);
}

export async function toggleFollowing(id: number): Promise<boolean> {
  const a = await getArtistById(id);
  if (!a) return false;
  await updateArtist(id, { isFollowing: !a.isFollowing });
  return !a.isFollowing;
}
