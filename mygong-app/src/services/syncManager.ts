/**
 * 앱 시작·수동 동기화 매니저.
 *
 * 동기화 모드 설계:
 *   - 처음 팔로우:         'full'         (2010년~, ~40초)  — syncOneArtist 내부에서 자동 판단
 *   - 아티스트 상세 당겨서:  'incremental'  (1개월 전~, ~6초)  — syncOneArtist 기본값
 *   - 홈 당겨서:           'future-only'  (오늘~, ~3초/명)    — syncAllArtists 기본값
 *   - 앱 시작 자동 sync:    'future-only'  (오늘~, ~3초/명)    — syncStaleArtists 기본값
 *
 * 첫 sync(아직 한 번도 동기화 안 된 아티스트) 인 경우:
 *   어느 함수로 호출되든 자동으로 'full' 로 승격 → 과거 이력 확보.
 *
 * 흐름:
 *   1. 각 아티스트에 대해 fetchEventsForArtist(mode) 호출
 *   2. 결과를 events 테이블에 upsert
 *      - full: 기존 데이터 전체 삭제 후 재수집
 *      - incremental/future-only: upsert 만 (기존 데이터 유지)
 *   3. 새로 추가된 이벤트에 대해 알림 생성 (D-30 이내만)
 *   4. artist_sync_state 업데이트
 */

import { getAllArtists, updateArtist } from '@/db/artists';
import { upsertEventByExternalId, deleteEventsForArtistFromSource, getEventById } from '@/db/events';
import { createNotification } from '@/db/notifications';
import { setSyncState, getStaleArtistIds, getSyncState } from '@/db/sync-state';
import { fetchEventsForArtist } from './parseData';
import type { SyncMode } from './providers/kopisProvider';

export type SyncResult = {
  artistCount: number;
  newEventCount: number;
  errors: { artistId: number; error: string }[];
};

/**
 * 오래된 아티스트만 갱신 — 앱 시작 시 호출.
 * 기본 mode: 'future-only' (앞으로의 공연 체크만)
 */
export async function syncStaleArtists(
  maxAgeHours = 12,
  mode: SyncMode = 'future-only',
): Promise<SyncResult> {
  const ids = await getStaleArtistIds(maxAgeHours);
  return syncArtistIds(ids, mode);
}

/**
 * 전체 팔로잉 아티스트 강제 갱신 — 홈 "당겨서 새로고침"에서 호출.
 * 기본 mode: 'future-only' (앞으로의 공연 체크만, 빠름)
 */
export async function syncAllArtists(
  mode: SyncMode = 'future-only',
): Promise<SyncResult> {
  const artists = await getAllArtists('following');
  return syncArtistIds(artists.map(a => a.id), mode);
}

/**
 * 단일 아티스트 갱신 — 아티스트 상세 페이지에서 호출.
 * 기본 mode: 'incremental' (1개월 전부터, 과거 데이터 보강)
 *
 * 아직 한 번도 sync 안 된 아티스트면 자동으로 'full' 로 승격.
 */
export async function syncOneArtist(
  artistId: number,
  mode: SyncMode = 'incremental',
): Promise<SyncResult> {
  return syncArtistIds([artistId], mode);
}

/**
 * @param ids         - 동기화할 아티스트 ID 목록
 * @param requestedMode - 호출자가 원한 mode. 단, 첫 sync 면 'full' 로 승격됨.
 */
async function syncArtistIds(
  ids: number[],
  requestedMode: SyncMode,
): Promise<SyncResult> {
  const result: SyncResult = { artistCount: ids.length, newEventCount: 0, errors: [] };
  if (ids.length === 0) return result;

  const all = await getAllArtists('all');
  const map = new Map(all.map(a => [a.id, a]));

  for (const id of ids) {
    const artist = map.get(id);
    if (!artist || !artist.externalId) continue;

    try {
      // 첫 sync 여부 판단 — 아직 한 번도 sync 안 됐으면 full 로 승격
      const prevState = await getSyncState(id);
      const isFirstSync = !prevState?.lastFetchedAt;
      const mode: SyncMode = isFirstSync ? 'full' : requestedMode;
      console.log(`[sync] artist=${artist.name} requested=${requestedMode} actual=${mode} firstSync=${isFirstSync}`);

      const events = await fetchEventsForArtist(artist.externalId, artist.name, artist.tag, mode, artist.nameEn);
      const source = 'sync-auto';

      // Full sync 때만 기존 데이터 전체 삭제 후 재수집.
      // Incremental/future-only 는 upsert 만 → 기존 과거 데이터 유지.
      if (mode === 'full' && events.length > 0) {
        await deleteEventsForArtistFromSource(id, source);
      }

      for (const ev of events) {
        const extId = ev.externalId ?? `${artist.externalId}-${ev.title}-${ev.date}`;
        const eventId = await upsertEventByExternalId(extId, id, {
          ...ev,
          artistId: id,
          source,
        });
        const isNew = !(await getEventById(eventId));
        if (isNew) result.newEventCount += 1;

        // D-30 이내 공연이면 알림 생성
        const ddays = daysUntil(ev.date);
        if (ddays >= 0 && ddays <= 30) {
          await createNotification({
            kind: 'new_event',
            title: `🎉 새 공연: ${ev.title}`,
            subtitle: `${artist.name} · ${ev.date}`,
            icon: ev.catIcon ?? '🎫',
            artistId: id,
            eventId,
          });
        }
      }

      await updateArtist(id, { lastSyncedAt: new Date().toISOString() });
      await setSyncState({
        artistId: id,
        lastFetchedAt: new Date().toISOString(),
        lastFetchStatus: 'ok',
        eventsFound: events.length,
      });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      result.errors.push({ artistId: id, error: msg });
      await setSyncState({
        artistId: id,
        lastFetchedAt: new Date().toISOString(),
        lastFetchStatus: 'error',
        lastFetchError: msg,
        eventsFound: 0,
      });
    }
  }

  return result;
}

function daysUntil(dateStr?: string): number {
  if (!dateStr) return -9999;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return -9999;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}
