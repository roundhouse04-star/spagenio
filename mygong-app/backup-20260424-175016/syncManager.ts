/**
 * 앱 시작·수동 동기화 매니저.
 *
 * v5.1 — 병렬 처리 + DB 뮤텍스
 *   - 최대 8개 아티스트 동시 동기화
 *   - DB 쓰기는 순차 처리 (뮤텍스)
 *   - SQLite 충돌 방지
 *
 * 동기화 모드 설계:
 *   - 처음 팔로우:         'full'         (2010년~, ~40초)
 *   - 아티스트 상세 당겨서:  'incremental'  (1개월 전~, ~6초)
 *   - 홈 당겨서:           'future-only'  (오늘~, ~3초/명)
 *   - 앱 시작 자동 sync:    'future-only'  (오늘~, ~3초/명)
 */

import { Mutex } from 'async-mutex'; // ✨ 추가
import { getAllArtists, updateArtist } from '@/db/artists';
import { upsertEventByExternalId, deleteEventsForArtistFromSource, getEventById } from '@/db/events';
import { createNotification } from '@/db/notifications';
import { setSyncState, getStaleArtistIds, getSyncState } from '@/db/sync-state';
import { fetchEventsForArtist } from './parseData';
import type { SyncMode } from './providers/kopisProvider';

// 병렬 처리 배치 크기
const PARALLEL_BATCH_SIZE = 8;

// ✨ DB 쓰기 뮤텍스 (SQLite 동시성 보호)
const dbMutex = new Mutex();

export type SyncResult = {
  artistCount: number;
  newEventCount: number;
  errors: { artistId: number; error: string }[];
};

export type SyncProgress = {
  total: number;
  completed: number;
  current: string[];
  failed: number;
};

export type SyncProgressCallback = (progress: SyncProgress) => void;

/**
 * 오래된 아티스트만 갱신 — 앱 시작 시 호출.
 */
export async function syncStaleArtists(
  maxAgeHours = 12,
  mode: SyncMode = 'future-only',
  onProgress?: SyncProgressCallback,
): Promise<SyncResult> {
  const ids = await getStaleArtistIds(maxAgeHours);
  return syncArtistIds(ids, mode, onProgress);
}

/**
 * 전체 팔로잉 아티스트 강제 갱신 — 홈 \"당겨서 새로고침\"에서 호출.
 */
export async function syncAllArtists(
  mode: SyncMode = 'future-only',
  onProgress?: SyncProgressCallback,
): Promise<SyncResult> {
  const artists = await getAllArtists('following');
  return syncArtistIds(artists.map(a => a.id), mode, onProgress);
}

/**
 * 단일 아티스트 갱신 — 아티스트 상세 페이지에서 호출.
 */
export async function syncOneArtist(
  artistId: number,
  mode: SyncMode = 'incremental',
  onProgress?: SyncProgressCallback,
): Promise<SyncResult> {
  return syncArtistIds([artistId], mode, onProgress);
}

/**
 * @param ids         - 동기화할 아티스트 ID 목록
 * @param requestedMode - 호출자가 원한 mode
 * @param onProgress  - 진행 상황 콜백
 */
async function syncArtistIds(
  ids: number[],
  requestedMode: SyncMode,
  onProgress?: SyncProgressCallback,
): Promise<SyncResult> {
  const result: SyncResult = { artistCount: ids.length, newEventCount: 0, errors: [] };
  if (ids.length === 0) return result;

  const all = await getAllArtists('all');
  const map = new Map(all.map(a => [a.id, a]));

  // 8개씩 배치로 나누기
  const batches: number[][] = [];
  for (let i = 0; i < ids.length; i += PARALLEL_BATCH_SIZE) {
    batches.push(ids.slice(i, i + PARALLEL_BATCH_SIZE));
  }

  console.log('[sync] Total artists:', ids.length, 'Batches:', batches.length);

  let completed = 0;
  let failed = 0;

  // 배치별로 순차 처리, 배치 내에서는 병렬 처리
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchArtists = batch.map(id => map.get(id)?.name || `ID:${id}`);
    
    console.log(`[sync] Batch ${batchIndex + 1}/${batches.length}: [${batchArtists.join(', ')}]`);
    
    // 진행 상황 업데이트
    if (onProgress) {
      onProgress({
        total: ids.length,
        completed,
        current: batchArtists,
        failed,
      });
    }

    // 배치 내 병렬 실행
    const batchPromises = batch.map(id => syncSingleArtist(id, map, requestedMode, result));
    const batchResults = await Promise.allSettled(batchPromises);

    // 결과 집계
    for (const res of batchResults) {
      completed++;
      if (res.status === 'rejected') {
        failed++;
      }
    }
  }

  // 최종 진행 상황
  if (onProgress) {
    onProgress({
      total: ids.length,
      completed,
      current: [],
      failed,
    });
  }

  return result;
}

/**
 * 단일 아티스트 동기화 (병렬 처리용)
 */
async function syncSingleArtist(
  id: number,
  artistMap: Map<number, any>,
  requestedMode: SyncMode,
  result: SyncResult,
): Promise<void> {
  const artist = artistMap.get(id);
  if (!artist || !artist.externalId) return;

  try {
    // 첫 sync 여부 판단
    const prevState = await getSyncState(id);
    const isFirstSync = !prevState?.lastFetchedAt;
    const mode: SyncMode = isFirstSync ? 'full' : requestedMode;
    
    console.log(`[sync] ${artist.name} mode=${mode} firstSync=${isFirstSync}`);

    // ✨ 데이터 페치는 병렬로 (API 호출)
    const events = await fetchEventsForArtist(
      artist.externalId, 
      artist.name, 
      artist.tag, 
      mode, 
      artist.nameEn
    );
    
    const source = 'sync-auto';

    // ✨ DB 작업은 뮤텍스로 보호 (순차 처리)
    await dbMutex.runExclusive(async () => {
      // Full sync 때만 기존 데이터 삭제
      if (mode === 'full') {
        await deleteEventsForArtistFromSource(id, source);
      }

      // 이벤트 upsert
      for (const ev of events) {
        const eventId = await upsertEventByExternalId(ev.externalId, {
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
    });
    
    console.log(`[sync] ✅ ${artist.name} completed (${events.length} events)`);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    result.errors.push({ artistId: id, error: msg });
    
    // ✨ 에러 상태 저장도 뮤텍스로 보호
    await dbMutex.runExclusive(async () => {
      await setSyncState({
        artistId: id,
        lastFetchedAt: new Date().toISOString(),
        lastFetchStatus: 'error',
        lastFetchError: msg,
        eventsFound: 0,
      });
    });
    
    console.error(`[sync] ❌ ${artist.name} failed:`, msg);
  }
}

function daysUntil(dateStr?: string): number {
  if (!dateStr) return -9999;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return -9999;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}
