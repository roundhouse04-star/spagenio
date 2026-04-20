/**
 * 페치한 raw 데이터를 → 앱 엔티티(Artist/Event/Notification) 로 분리하는 파서.
 *
 * "내역 분리" 로직의 중심. 지금은:
 *   1. Wikipedia hit → Artist 1건 생성
 *   2. 역할 기반으로 카테고리 태그 추정 ("가수"→콘서트, "야구선수"→야구…)
 *   3. (추후 실제 공연 데이터 붙으면) events[] 도 여기서 같이 만듦
 *
 * 공연 일정 실제 소스가 붙기 전까지는 events 를 빈 배열로 반환.
 * 앱은 이걸 받아서 "아티스트만 등록하고, 공연은 사용자가 수동 추가 / 나중에 sync 에서 채움" 흐름.
 */

import type { ArtistFetchBundle, SearchHit } from '@/types';

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
    events: [],       // 공연 실제 소스 붙으면 여기 채움
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
 *  지금은 공연 데이터 실제 소스가 없어서 빈 배열 반환. 
 *  스크래퍼가 붙으면 여기서 title/date/venue 를 채우게 된다.
 */
export async function fetchEventsForArtist(artistExternalId: string, artistName: string): Promise<ArtistFetchBundle['events']> {
  // TODO: 티켓링크/인터파크/멜론 스크래퍼 붙이기
  // 예:
  //   const hits = await scrapeTicketlink(artistName);
  //   return hits.map(h => ({ title: h.title, date: h.date, venue: h.venue, ... }));
  return [];
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
