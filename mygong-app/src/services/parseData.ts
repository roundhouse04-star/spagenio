// ============================================================
// parseData.ts - 한방 조회 + 완전한 데이터 파싱 + 이미지 다운로드
// ============================================================

import { 
  fetchAllRawXML, 
  parseXMLChunksLocally, 
  fetchDetailsInBatch 
} from './providers/kopisProvider';
import { downloadPostersInBatch } from './posterDownload';
import type { Event, SearchHit, ArtistFetchBundle } from '@/types';

export interface FetchOptions {
  afterdate?: string;
}

export type SyncMode = 'full' | 'incremental' | 'future-only';

/**
 * 🆕 한방에 아티스트 데이터 가져오기
 * 원본 Event 구조로 변환 + 이미지 다운로드
 */
export async function fetchEventsForArtistBulk(
  artistName: string,
  artistId: number,
  options: FetchOptions = {}
): Promise<Partial<Event>[]> {
  const { afterdate } = options;
  
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  
  // 날짜 범위 설정
  let stdate: string;
  
  if (afterdate) {
    stdate = afterdate;
    console.log(`[FETCH] ${artistName}: 증분 검색 (${afterdate} ~ ${today})`);
  } else {
    stdate = '20100101';
    console.log(`[FETCH] ${artistName}: 전체 검색 (2010 ~ ${today})`);
  }
  
  // ──────────────────────────────────────────────────────
  // STEP 1: 공연명으로 한방에 XML 수집
  // ──────────────────────────────────────────────────────
  console.log(`[FETCH] STEP 1: 공연명 검색 시작`);
  
  const xmlChunks = await fetchAllRawXML({
    artistName,
    stdate,
    eddate: today,
    afterdate
  });
  
  // ──────────────────────────────────────────────────────
  // STEP 2: 로컬에서 XML 파싱
  // ──────────────────────────────────────────────────────
  console.log(`[FETCH] STEP 2: 로컬 파싱 시작`);
  
  const nameEvents = parseXMLChunksLocally(xmlChunks);
  
  console.log(`[FETCH] STEP 1 완료: ${nameEvents.length}개 발견`);
  
  // ──────────────────────────────────────────────────────
  // STEP 3: 장르 검색 스킵 (공연명만 사용)
  // ──────────────────────────────────────────────────────
  const allEvents = new Map<string, any>();
  
  for (const event of nameEvents) {
    allEvents.set(event.mt20id, event);
  }
  
  console.log(`[FETCH] STEP 2: 스킵 (공연명 검색 결과만 사용: ${allEvents.size}개)`);
  
  // ──────────────────────────────────────────────────────
  // STEP 4: 출연진 검증 (병렬 상세 조회)
  // ──────────────────────────────────────────────────────
  console.log(`[FETCH] STEP 3: 출연진 검증 시작 (${allEvents.size}개)`);
  
  const eventIds = Array.from(allEvents.keys());
  
  // 한방에 상세 정보 가져오기
  const details = await fetchDetailsInBatch(eventIds, 20, artistName);
  
  // 출연진 검증 스킵 (출연진 정보가 없는 공연도 많음)
  const verified = details;
  
  console.log(`[FETCH] 출연진 검증 스킵: ${verified.length}개 모두 사용`);
  
  console.log(`[FETCH] STEP 3 완료: ${verified.length}개 검증 완료`);
  
  // ──────────────────────────────────────────────────────
  // STEP 5: KOPIS 데이터 → Event 타입 변환
  // ──────────────────────────────────────────────────────
  const events: Partial<Event>[] = verified
    .map((kopis, index) => {
      const event = convertKopisToEvent(kopis, artistId);
      
      // 🔍 externalId 없는 데이터 상세 로그
      if (!event.externalId) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`[DEBUG] externalId 없는 데이터 발견! (${index + 1}/${verified.length})`);
        console.log(`  원본 mt20id: "${kopis.mt20id}"`);
        console.log(`  title: "${kopis.prfnm}"`);
        console.log(`  date: "${kopis.prfpdfrom}"`);
        console.log(`  venue: "${kopis.fcltynm}"`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
      
      return event;
    })
    .filter(event => {
      // externalId 없으면 제외 (필수 필드)
      if (!event.externalId) {
        console.log(`[FETCH] ⚠️ externalId 없음, 스킵`);
        return false;
      }
      return true;
    });
  
  console.log(`[FETCH] STEP 4: 최종 변환 완료: ${events.length}개 (검증: ${verified.length}개)`);
  
  // ──────────────────────────────────────────────────────
  // STEP 6: 포스터 이미지 다운로드 🆕
  // ──────────────────────────────────────────────────────
  console.log(`[FETCH] STEP 5: 포스터 다운로드 시작 (${events.length}개)`);
  
  const postersToDownload = events
    .filter(e => e.posterUrl && e.externalId)
    .map(e => ({
      eventId: e.externalId!,
      posterUrl: e.posterUrl!
    }));
  
  if (postersToDownload.length > 0) {
    const downloadResults = await downloadPostersInBatch(postersToDownload, 5);
    
    // 파일명만 저장 (iOS는 앱 재시작 시 documentDirectory 경로 변경됨)
    const localPathMap = new Map(
      downloadResults.map(r => [r.eventId, r.localPath])
    );
    
    for (const event of events) {
      if (event.externalId) {
        const localPath = localPathMap.get(event.externalId);
        if (localPath) {
          // 파일명만 추출: file:///.../posters/PF123.jpg → PF123.jpg
          const filename = `${event.externalId}.jpg`;
          event.posterUrl = filename; // 파일명만 저장
        }
      }
    }
    
    const successCount = downloadResults.filter(r => r.localPath !== null).length;
    console.log(`[FETCH] STEP 5 완료: ${successCount}/${postersToDownload.length}개 다운로드 성공`);
  }
  
  return events;
}

/**
 * syncManager 호환 wrapper 함수
 */
export async function fetchEventsForArtist(
  artistId: number,
  externalId: string,
  artistName: string,
  tag: string | null,
  mode: SyncMode,
  nameEn?: string
): Promise<Partial<Event>[]> {
  
  let afterdate: string | undefined;
  
  if (mode === 'incremental') {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    afterdate = oneMonthAgo.toISOString().split('T')[0].replace(/-/g, '');
  } else if (mode === 'future-only') {
    const today = new Date();
    afterdate = today.toISOString().split('T')[0].replace(/-/g, '');
  }
  
  return fetchEventsForArtistBulk(artistName, artistId, { afterdate });
}

/**
 * KOPIS 데이터를 Event 타입으로 변환 (완전판)
 */
function convertKopisToEvent(kopis: any, artistId: number): Partial<Event> {
  // 날짜 변환: "2026.04.24" → "2026-04-24"
  const startDate = kopis.prfpdfrom?.replace(/\./g, '-') || null;
  const endDate = kopis.prfpdto?.replace(/\./g, '-') || null;
  
  // 요일 계산
  const weekday = startDate ? getWeekday(startDate) : null;
  
  // 카테고리 매핑
  const category = getCategoryFromGenre(kopis.genrenm, kopis.prfnm);
  
  // 카테고리 아이콘
  const catIcon = getCategoryIcon(category);
  
  // 공연 시간 파싱
  const time = parsePerformanceTime(kopis.dtguidance);
  
  // 티켓 URL 추출 (relates 필드에서)
  const ticketUrl = extractTicketUrl(kopis.relates);
  
  // 장소 정보
  const venue = kopis.fcltynm || null;
  const city = kopis.area || null;
  
  return {
    artistId,
    externalId: kopis.mt20id,
    title: kopis.prfnm,
    category,
    catIcon,
    date: startDate,
    weekday,
    time,
    venue,
    city,
    price: kopis.pcseguidance || null,
    ticketUrl,
    posterUrl: kopis.poster || null,
    notifyEnabled: true,
    isWishlisted: false,
    ticketOpenAt: null, // KOPIS API에는 없음
    notes: kopis.sty || null, // 줄거리를 노트로 저장
    source: 'kopis',
  };
}

/**
 * 날짜 → 요일 변환
 */
function getWeekday(dateStr: string): string {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const date = new Date(dateStr);
  return weekdays[date.getDay()];
}

/**
 * 장르명 → 카테고리 변환
 */
function getCategoryFromGenre(genrenm: string, prfnm?: string): string {
  // 공연명 기반 우선 분류
  if (prfnm) {
    if (/(팬미팅|팬콘|쇼케이스|FANMEETING|FAN\s*MEETING|SHOWCASE)/i.test(prfnm)) {
      return '팬미팅';
    }
    if (/(페스티벌|페스\b|축제|FESTIVAL)/i.test(prfnm)) {
      return '페스티벌';
    }
  }
  
  // 장르명 기반 분류
  const categoryMap: Record<string, string> = {
    '연극': '연극',
    '뮤지컬': '뮤지컬',
    '음악': '콘서트',
    '무용': '페스티벌',
    '서양음악(클래식)': '콘서트',
    '한국음악(국악)': '콘서트',
    '대중음악': '콘서트',
    '무용(서양/한국무용)': '페스티벌',
    '대중무용': '페스티벌',
    '복합': '페스티벌',
    '서커스/마술': '페스티벌',
    '기타': '콘서트'
  };
  
  return categoryMap[genrenm] || '콘서트';
}

/**
 * 카테고리 → 아이콘
 */
function getCategoryIcon(category: string): string {
  const iconMap: Record<string, string> = {
    '콘서트': '🎤',
    '뮤지컬': '🎭',
    '연극': '🎬',
    '팬미팅': '💕',
    '페스티벌': '🎪',
    '전시': '🖼️'
  };
  
  return iconMap[category] || '🎫';
}

/**
 * 공연 시간 파싱
 * 예: "화~금 20:00, 토 15:00,19:00" → "20:00"
 */
function parsePerformanceTime(dtguidance: string | null): string | null {
  if (!dtguidance) return null;
  
  // 시간 패턴 추출 (HH:MM 형식)
  const timeMatch = dtguidance.match(/(\d{2}):(\d{2})/);
  if (timeMatch) {
    return `${timeMatch[1]}:${timeMatch[2]}`;
  }
  
  return null;
}

/**
 * 관련 링크에서 티켓 URL 추출
 * relates 필드: "인터파크:http://...,예스24:http://..."
 */
function extractTicketUrl(relates: string | null): string | null {
  if (!relates) return null;
  
  // 첫 번째 URL 추출
  const urlMatch = relates.match(/https?:\/\/[^\s,]+/);
  if (urlMatch) {
    return urlMatch[0];
  }
  
  return null;
}

// ============================================================
// parseSearchHitToBundle - Wikipedia 검색 결과 → Artist 변환
// ============================================================

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

function inferTag(role?: string): string {
  if (!role) return '가수';
  if (/(가수|싱어|보컬|아티스트)/i.test(role)) return '가수';
  if (/(배우|연기)/i.test(role)) return '배우';
  if (/(아이돌|걸그룹|보이그룹)/i.test(role)) return '아이돌';
  return '가수';
}

function emojiForTag(tag: string): string {
  const map: Record<string, string> = {
    '가수': '🎤',
    '배우': '🎬',
    '아이돌': '⭐',
  };
  return map[tag] || '🎤';
}

function pickThumbColor(name: string): string {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}
