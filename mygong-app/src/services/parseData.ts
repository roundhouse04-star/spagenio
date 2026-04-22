/**
 * 페치한 raw 데이터를 → 앱 엔티티(Artist/Event/Notification) 로 분리하는 파서.
 *
 * v2:
 *   1. 검색 결과 → Artist + 등록 알림 (기존)
 *   2. fetchEventsForArtist() — Wikipedia 본문 + KOPIS API 동시 조회 → Event[]
 *
 * 프로바이더는 Promise.allSettled 로 병렬 호출, 한쪽 실패해도 나머지는 살림.
 * 중복 이벤트는 (date|title) 정규화 키로 dedupe.
 */

import type { ArtistFetchBundle, Event, SearchHit } from '@/types';
import { fetchWikipediaEvents } from './providers/wikipediaProvider';
import { searchKopisEvents, kopisToEventInput, hasKopisKey } from './providers/kopisProvider';
import { iconForCategory } from '@/db/schema';

/** Wikipedia 검색 hit 한 건 → 아티스트 등록 번들 */
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

/**
 * 한 명의 아티스트에 대한 공연 이력을 여러 프로바이더에서 가져옴.
 *
 * artistExternalId: "wiki:12345" 형태 (parseData 가 알 필요는 없지만 호환 유지)
 * artistName: 검색·매칭에 쓰는 이름
 */
export async function fetchEventsForArtist(
  artistExternalId: string,
  artistName: string,
  artistTag?: string,
): Promise<Omit<Event, 'id' | 'artistId' | 'createdAt' | 'updatedAt' | 'notifyEnabled'>[]> {
  console.log('[fetchEvents] start', artistName, artistExternalId, 'tag:', artistTag);

  // pageId 추출 (wikipedia 출처일 때만)
  const wikiPageId = extractWikiPageId(artistExternalId);

  // 프로바이더 병렬 호출
  const [wikiRes, kopisRes] = await Promise.allSettled([
    wikiPageId ? fetchWikipediaEvents(wikiPageId, artistName) : Promise.resolve([]),
    searchKopisEvents(artistName, artistTag),
  ]);

  const events: Omit<Event, 'id' | 'artistId' | 'createdAt' | 'updatedAt' | 'notifyEnabled'>[] = [];

  // Wikipedia 결과 변환
  if (wikiRes.status === 'fulfilled') {
    for (const w of wikiRes.value) {
      const cat = inferCategoryFromTitle(w.title) || '콘서트';
      events.push({
        externalId: `wiki-evt:${w.title}-${w.date ?? w.year ?? '?'}`,
        title: w.title,
        category: cat,
        catIcon: iconForCategory(cat),
        date: w.date ?? (w.year ? `${w.year}-01-01` : ''),
        venue: w.venue,
        city: w.city,
        source: 'wikipedia',
      });
    }
  } else {
    console.warn('[fetchEvents] wiki failed:', wikiRes.reason);
  }

  // KOPIS 결과 변환 — 출연진 매칭은 우선 제목 기준 (키워드 포함이면 신뢰)
  if (kopisRes.status === 'fulfilled') {
    for (const k of kopisRes.value) {
      // KOPIS shprfnm 가 부분일치라 너무 광범위할 수 있음 → 한 번 더 거름
      if (!k.prfnm.includes(artistName)) continue;
      events.push(kopisToEventInput(k));
    }
  } else {
    console.warn('[fetchEvents] kopis failed:', kopisRes.reason);
  }

  // 중복 제거 (date|normalized title)
  const seen = new Set<string>();
  const dedup = events.filter(e => {
    const key = `${e.date}|${e.title.replace(/\s+/g, '').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 최신순 정렬
  dedup.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  console.log('[fetchEvents] total:', dedup.length, '(wiki+kopis combined)');
  return dedup;
}

// ---------------------------------------------------------------------------
// 보조 함수들
// ---------------------------------------------------------------------------

function extractWikiPageId(externalId?: string): number | null {
  if (!externalId) return null;
  const m = externalId.match(/^wiki:(\d+)$/);
  return m ? Number(m[1]) : null;
}

function inferCategoryFromTitle(title: string): string | undefined {
  if (/(콘서트|투어|라이브|TOUR|LIVE|콘써트)/i.test(title)) return '콘서트';
  if (/(뮤지컬|MUSICAL)/i.test(title)) return '뮤지컬';
  if (/(연극|PLAY)/i.test(title)) return '연극';
  if (/(페스티벌|FESTIVAL|FEST)/i.test(title)) return '페스티벌';
  if (/(팬미팅|팬콘|FAN ?MEETING)/i.test(title)) return '콘서트';
  return undefined;
}

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

// 프로바이더 상태 (설정 화면에서 표시용)
export async function getProviderStatus() {
  return {
    wikipedia: true,                    // 항상 동작
    kopis: await hasKopisKey(),         // 키 있을 때만
  };
}
