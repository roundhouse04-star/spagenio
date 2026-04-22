/**
 * 앱 시작·수동 동기화 매니저.
 *
 * 흐름:
 *   1. "팔로잉 중"이면서 12시간 이상 지난 아티스트 목록 조회
 *   2. 각 아티스트에 대해 fetchEventsForArtist() 호출
 *   3. 결과를 events 테이블에 upsert (기존 source 데이터는 삭제 후 다시)
 *   4. 새로 추가된 이벤트에 대해 알림 생성 (D-30 이내만)
 *   5. artist_sync_state 업데이트
 *
 * 실제 스크래퍼가 아직 없어서 지금은 "상태만 갱신"하는 수준이지만,
 * 구조는 완성 — 스크래퍼 함수 하나만 parseData.fetchEventsForArtist 에 붙이면 자동 동작.
 */

import { getAllArtists, updateArtist } from '@/db/artists';
import { upsertEventByExternalId, deleteEventsForArtistFromSource, getEventById } from '@/db/events';
import { createNotification } from '@/db/notifications';
import { setSyncState, getStaleArtistIds } from '@/db/sync-state';
import { fetchEventsForArtist } from './parseData';

export type SyncResult = {
  artistCount: number;
  newEventCount: number;
  errors: { artistId: number; error: string }[];
};

/** 오래된 아티스트만 갱신 — 앱 시작 시 호출 */
export async function syncStaleArtists(maxAgeHours = 12): Promise<SyncResult> {
  const ids = await getStaleArtistIds(maxAgeHours);
  return syncArtistIds(ids);
}

/** 전체 팔로잉 아티스트 강제 갱신 — "새로고침" 버튼에서 호출 */
export async function syncAllArtists(): Promise<SyncResult> {
  const artists = await getAllArtists('following');
  return syncArtistIds(artists.map(a => a.id));
}

/** 단일 아티스트 — 상세 페이지 새로고침에서 호출 */
export async function syncOneArtist(artistId: number): Promise<SyncResult> {
  return syncArtistIds([artistId]);
}

async function syncArtistIds(ids: number[]): Promise<SyncResult> {
  const result: SyncResult = { artistCount: ids.length, newEventCount: 0, errors: [] };
  if (ids.length === 0) return result;

  const all = await getAllArtists('all');
  const map = new Map(all.map(a => [a.id, a]));

  for (const id of ids) {
    const artist = map.get(id);
    if (!artist || !artist.externalId) continue;

    try {
      const events = await fetchEventsForArtist(artist.externalId, artist.name, artist.tag);
      // 기존 자동 동기화 출처 이벤트들 청소 (수동 입력은 보존)
      const SYNC_SOURCES = ['wikipedia', 'kopis', 'sync-auto'];
      if (events.length > 0) {
        for (const src of SYNC_SOURCES) {
          await deleteEventsForArtistFromSource(id, src);
        }
      }

      for (const ev of events) {
        const extId = ev.externalId ?? `${artist.externalId}-${ev.title}-${ev.date}`;
        const eventId = await upsertEventByExternalId(extId, id, {
          ...ev,
          artistId: id,
          // ev.source 가 있으면 보존, 없으면 sync-auto
          source: ev.source ?? 'sync-auto',
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
