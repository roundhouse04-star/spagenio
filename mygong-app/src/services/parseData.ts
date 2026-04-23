/**
 * 페치한 raw 데이터를 → 앱 엔티티(Artist/Event/Notification) 로 분리하는 파서.
 *
 * 역할:
 *   1. Wikipedia 검색 hit → Artist 1건 생성 (parseSearchHitToBundle)
 *      - 아티스트 정보(이름, 역할, 소개, 대표사진)만 가져옴
 *   2. 팔로잉 중인 아티스트 → 공연 이력 수집 (fetchEventsForArtist)
 *      - KOPIS 공연정보 (Worker 경유) → 공식 공연 DB 만 사용
 *      - mode: 'full' / 'incremental' / 'future-only'
 */

import type { ArtistFetchBundle, SearchHit } from '@/types';
import { searchKopisEvents, kopisToEventInput, type SyncMode } from './providers/kopisProvider';

/** Wikipedia hit 한 건을 번들로 변환 */
export function parseSearchHitToBundle(hit: SearchHit): ArtistFetchBundle {
  const tag = inferTag(hit.role);
  return {
    artist: {
      externalId: hit.externalId,
      name: hit.name,
      nameEn: hit.nameEn,
      role: hit.role,
      tag,
      emoji: emojiForTag(tag),
      avatarUrl: hit.avatarUrl,
      thumbColor: pickThumbColor(hit.name),
      bio: hit.bio,
      lastSyncedAt: new Date().toISOString(),
    },
    events: [],
    tickets: [],
    notifications: [
      {
        kind: 'new_info',
        title: `"${hit.name}"님을 등록했어요`,
        subtitle: hit.role ? `${hit.role} · 프로필 가져오기 완료` : '프로필 가져오기 완료',
        icon: '✨',
        eventId: undefined,
        ticketId: undefined,
        dateGroup: undefined,
      },
    ],
  };
}

/** 한 명의 아티스트를 "리프레시"할 때 새 이벤트를 파생시키는 함수.
 *  KOPIS 공연정보만 사용 (공식 공연 DB).
 *
 *  @param artistExternalId - "wiki:1234" 형식 (현재 미사용)
 *  @param artistName       - 아티스트 이름 (KOPIS 검색 키워드)
 *  @param artistTag        - 앱 내부 tag
 *  @param mode             - 'full' / 'incremental' / 'future-only'
 */
export async function fetchEventsForArtist(
  artistExternalId: string,
  artistName: string,
  artistTag?: string,
  mode: SyncMode = 'future-only',
  artistNameEn?: string,
): Promise<ArtistFetchBundle['events']> {
  console.log(`[fetchEvents] start ${artistName} mode=${mode} tag=${artistTag ?? '-'}${artistNameEn ? ` en=${artistNameEn}` : ''}`);

  try {
    const aliases = artistNameEn && artistNameEn !== artistName ? [artistNameEn] : [];
    const kopisRaw = await searchKopisEvents(artistName, artistTag, mode, aliases);
    const events = kopisRaw.map(e => kopisToEventInput(e));
    console.log(`[fetchEvents] ${artistName}: kopis=${events.length} (mode=${mode})`);
    return events;
  } catch (e: any) {
    console.warn('[fetchEvents] kopis failed:', e?.message ?? e);
    return [];
  }
}

// ---------- 보조 함수들 ----------

function inferTag(role?: string): string {
  if (!role) return '기타';
  if (role.includes('야구')) return '야구';
  if (role.includes('축구')) return '축구';
  if (role.includes('농구')) return '농구';
  if (role.includes('가수') || role.includes('아이돌') || role.includes('래퍼') || role.includes('싱어')) return '가수';
  if (role.includes('배우') || role.includes('뮤지컬')) return '배우';
  if (role.includes('성우')) return '성우';
  return '기타';
}

function emojiForTag(tag: string): string {
  switch (tag) {
    case '가수': return '🎤';
    case '배우': return '🎭';
    case '야구': return '⚾';
    case '축구': return '⚽';
    case '농구': return '🏀';
    default:    return '⭐';
  }
}

const THUMB_COLORS = ['#ffd9d4', '#fff2a6', '#e8e3fd', '#dbf5e8', '#ffe9d6', '#cfe2ff'];
function pickThumbColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return THUMB_COLORS[h % THUMB_COLORS.length];
}
