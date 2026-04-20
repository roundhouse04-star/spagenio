/**
 * 아티스트별 마지막 페치 상태 기록.
 * 앱 시작 시 이걸 보고 "너무 오래된 데이터는 다시 갱신" 판단.
 */
import { getDB } from './database';
import type { ArtistSyncState } from '@/types';

function rowTo(r: any): ArtistSyncState {
  return {
    artistId: r.artist_id,
    lastFetchedAt: r.last_fetched_at ?? undefined,
    lastFetchStatus: r.last_fetch_status ?? undefined,
    lastFetchError: r.last_fetch_error ?? undefined,
    eventsFound: r.events_found ?? 0,
    updatedAt: r.updated_at,
  };
}

export async function getSyncState(artistId: number): Promise<ArtistSyncState | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM artist_sync_state WHERE artist_id = ?', [artistId]
  );
  return row ? rowTo(row) : null;
}

export async function setSyncState(state: Omit<ArtistSyncState, 'updatedAt'>): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO artist_sync_state
       (artist_id, last_fetched_at, last_fetch_status, last_fetch_error, events_found, updated_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(artist_id) DO UPDATE SET
       last_fetched_at = excluded.last_fetched_at,
       last_fetch_status = excluded.last_fetch_status,
       last_fetch_error = excluded.last_fetch_error,
       events_found = excluded.events_found,
       updated_at = excluded.updated_at`,
    [
      state.artistId,
      state.lastFetchedAt ?? null,
      state.lastFetchStatus ?? null,
      state.lastFetchError ?? null,
      state.eventsFound ?? 0,
      now,
    ]
  );
}

export async function getStaleArtistIds(maxAgeHours = 12): Promise<number[]> {
  const db = await getDB();
  const threshold = new Date(Date.now() - maxAgeHours * 3600 * 1000).toISOString();
  const rows = await db.getAllAsync<any>(
    `SELECT a.id AS id FROM artists a
     LEFT JOIN artist_sync_state s ON s.artist_id = a.id
     WHERE a.is_following = 1
       AND (s.last_fetched_at IS NULL OR s.last_fetched_at < ?)`,
    [threshold]
  );
  return rows.map(r => r.id);
}
