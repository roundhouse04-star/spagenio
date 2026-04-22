/**
 * KOPIS 공연예술통합전산망 Open API 프로바이더 (v4.0 공식 스펙 기준).
 *
 * 공식 문서에서 발견한 중요 제약:
 *   - stdate/eddate 는 최대 31일 → 긴 기간은 청크 분할 필수
 *   - rows 는 최대 100
 *   - 응답은 XML (JSON 아님)
 *   - 엔드포인트:
 *       공연목록:  GET /openApi/restful/pblprfr
 *       공연상세:  GET /openApi/restful/pblprfr/{mt20id}
 *   - HTTPS 아님(http://) → iOS 에서 NSAppTransportSecurity 예외 필요
 *
 * 매칭 전략 (2단계):
 *   1차 - shprfnm (공연명 키워드) 로 기간 내 공연 가져오기
 *   2차 - (옵션) 각 공연 상세조회로 prfcast 에 아티스트 이름 포함되는지 확인
 *
 * 키 없으면 조용히 스킵, 캐싱은 상위 syncManager 에서 12시간 단위.
 */

import type { Event } from '@/types';
import { iconForCategory } from '@/db/schema';
import { getMeta, META_KEYS } from '@/db/app-meta';
import {
  KopisGenreCode, genreCodesForTag, genreNameToCategory,
  splitByMonth, toIsoDate, fmtYmd,
} from './kopisCodes';

const KOPIS_LIST_URL   = 'http://www.kopis.or.kr/openApi/restful/pblprfr';
const KOPIS_DETAIL_URL = 'http://www.kopis.or.kr/openApi/restful/pblprfr';  // + /{mt20id}
const TIMEOUT_MS = 12000;

// 조회 기간: 과거 3년 + 미래 1년 (너무 넓으면 요청 수 폭발)
const YEARS_BACK = 3;
const YEARS_AHEAD = 1;

// 동시 실행 제한 (KOPIS 서버 배려)
const MAX_CONCURRENCY = 4;

// 출연진 정밀 매칭 활성화 여부 (느려짐. 필요 시 true)
const ENABLE_CAST_MATCHING = false;

// ─── Raw Types ────────────────────────────────────────────────────
export type KopisRawEvent = {
  mt20id: string;
  prfnm: string;
  prfpdfrom: string;      // YYYY.MM.DD
  prfpdto: string;        // YYYY.MM.DD
  fcltynm: string;        // 공연시설명
  area: string;           // 공연지역 (시도명)
  genrenm: string;        // 장르명
  poster?: string;
  prfstate: string;       // 공연예정/공연중/공연완료
  openrun?: string;       // Y/N
};

export type KopisRawDetail = KopisRawEvent & {
  prfcast?: string;       // 출연진
  prfcrew?: string;       // 제작진
  entrpsnmP?: string;     // 제작사
  pcseguidance?: string;  // 티켓가격
  dtguidance?: string;    // 공연시간
  sty?: string;           // 줄거리
};

// ─── 키 체크 ──────────────────────────────────────────────────────
export async function hasKopisKey(): Promise<boolean> {
  const k = await getMeta(META_KEYS.KOPIS_API_KEY);
  return !!(k && k.trim().length > 10);
}

// ─── 메인 검색 ────────────────────────────────────────────────────

/**
 * 아티스트 이름으로 KOPIS 공연 조회.
 * @param artistName - 아티스트 이름 (예: "아이유")
 * @param artistTag  - 앱 내부 tag (예: "가수", "배우")
 */
export async function searchKopisEvents(
  artistName: string, artistTag?: string,
): Promise<KopisRawEvent[]> {
  const key = await getMeta(META_KEYS.KOPIS_API_KEY);
  if (!key || key.trim().length < 10) {
    console.log('[kopis] no API key configured, skipping');
    return [];
  }
  console.log('[kopis] searching:', artistName, 'tag:', artistTag ?? '(any)');

  const genres = genreCodesForTag(artistTag);
  const today = new Date();
  const start = new Date(today); start.setFullYear(start.getFullYear() - YEARS_BACK);
  const end   = new Date(today); end.setFullYear(end.getFullYear() + YEARS_AHEAD);
  const chunks = splitByMonth(start, end);
  console.log(`[kopis] ${chunks.length} date chunks × ${genres.length} genres = ${chunks.length * genres.length} requests (throttled to ${MAX_CONCURRENCY} concurrent)`);

  // 모든 (청크 × 장르) 조합 호출
  const tasks: Array<() => Promise<KopisRawEvent[]>> = [];
  for (const [stdate, eddate] of chunks) {
    for (const genre of genres) {
      tasks.push(() => fetchList(key, {
        stdate, eddate, shcate: genre, shprfnm: artistName,
      }));
    }
  }
  // 오픈런도 추가로 (최근만)
  tasks.push(() => fetchList(key, {
    stdate: fmtYmd(today), eddate: fmtYmd(end),
    shprfnm: artistName, openrun: 'Y',
  }));

  const all = await runThrottled(tasks, MAX_CONCURRENCY);

  // mt20id 기준 중복 제거
  const seen = new Set<string>();
  const dedup = all.flat().filter(e => {
    if (seen.has(e.mt20id)) return false;
    seen.add(e.mt20id);
    return true;
  });

  // 공연명에 아티스트 이름 포함되는 것만 (1차 필터)
  // shprfnm 이 부분일치라 무관한 것도 올 수 있음
  const cleaned = dedup.filter(e => includesName(e.prfnm, artistName));
  console.log(`[kopis] fetched ${dedup.length} → ${cleaned.length} after name filter`);

  // 2차 — 출연진 정밀 매칭 (옵션)
  if (ENABLE_CAST_MATCHING && cleaned.length > 0) {
    const verified = await verifyCastMatching(key, cleaned, artistName);
    console.log(`[kopis] ${cleaned.length} → ${verified.length} after cast verification`);
    return verified;
  }

  return cleaned;
}

// ─── 공연목록 조회 ────────────────────────────────────────────────

type ListParams = {
  stdate: string;
  eddate: string;
  shcate?: string;
  shprfnm?: string;
  openrun?: string;
};

async function fetchList(apiKey: string, params: ListParams): Promise<KopisRawEvent[]> {
  const q = new URLSearchParams({
    service: apiKey,
    stdate: params.stdate,
    eddate: params.eddate,
    cpage: '1',
    rows: '100',
  });
  if (params.shcate)  q.set('shcate',  params.shcate);
  if (params.shprfnm) q.set('shprfnm', params.shprfnm);
  if (params.openrun) q.set('openrun', params.openrun);

  const url = `${KOPIS_LIST_URL}?${q.toString()}`;
  const xml = await fetchXml(url, 'kopis-list');
  return parseListXml(xml);
}

// ─── 공연상세 조회 (prfcast 매칭용) ───────────────────────────────

async function fetchDetail(apiKey: string, mt20id: string): Promise<KopisRawDetail | null> {
  const url = `${KOPIS_DETAIL_URL}/${encodeURIComponent(mt20id)}?service=${encodeURIComponent(apiKey)}`;
  try {
    const xml = await fetchXml(url, 'kopis-detail');
    return parseDetailXml(xml);
  } catch (e: any) {
    console.warn(`[kopis-detail] ${mt20id} failed:`, e?.message ?? e);
    return null;
  }
}

async function verifyCastMatching(
  apiKey: string, events: KopisRawEvent[], artistName: string,
): Promise<KopisRawEvent[]> {
  // 상세조회 병렬 (MAX_CONCURRENCY 준수)
  const tasks = events.map(ev => async () => {
    const detail = await fetchDetail(apiKey, ev.mt20id);
    // prfcast 에 이름 포함되거나, prfnm 이 이미 이름 포함이면 통과
    if (!detail) return null;
    const cast = detail.prfcast ?? '';
    if (includesName(cast, artistName) || includesName(ev.prfnm, artistName)) {
      return ev;
    }
    return null;
  });
  const out = await runThrottled(tasks, MAX_CONCURRENCY);
  return out.filter((x): x is KopisRawEvent => x !== null);
}

// ─── XML 파서 (정규식 기반 — 라이브러리 의존성 없이) ────────────

function parseListXml(xml: string): KopisRawEvent[] {
  // 에러 응답 체크
  if (/<OpenAPI_ServiceResponse>/.test(xml) || /SERVICE[_ ]KEY/i.test(xml)) {
    const reason = pick(xml, 'returnReasonCode') || pick(xml, 'returnAuthMsg') || 'UNKNOWN';
    throw new Error(`KOPIS API 오류: ${reason}`);
  }
  const events: KopisRawEvent[] = [];
  const blocks = xml.match(/<db>[\s\S]*?<\/db>/g) ?? [];
  for (const block of blocks) {
    events.push({
      mt20id:    pick(block, 'mt20id'),
      prfnm:     pick(block, 'prfnm'),
      prfpdfrom: pick(block, 'prfpdfrom'),
      prfpdto:   pick(block, 'prfpdto'),
      fcltynm:   pick(block, 'fcltynm'),
      area:      pick(block, 'area'),
      genrenm:   pick(block, 'genrenm'),
      poster:    pick(block, 'poster') || undefined,
      prfstate:  pick(block, 'prfstate'),
      openrun:   pick(block, 'openrun') || undefined,
    });
  }
  return events;
}

function parseDetailXml(xml: string): KopisRawDetail | null {
  const block = xml.match(/<db>[\s\S]*?<\/db>/)?.[0];
  if (!block) return null;
  return {
    mt20id:      pick(block, 'mt20id'),
    prfnm:       pick(block, 'prfnm'),
    prfpdfrom:   pick(block, 'prfpdfrom'),
    prfpdto:     pick(block, 'prfpdto'),
    fcltynm:     pick(block, 'fcltynm'),
    area:        pick(block, 'area') || '',
    genrenm:     pick(block, 'genrenm'),
    poster:      pick(block, 'poster') || undefined,
    prfstate:    pick(block, 'prfstate'),
    prfcast:     pick(block, 'prfcast') || undefined,
    prfcrew:     pick(block, 'prfcrew') || undefined,
    entrpsnmP:   pick(block, 'entrpsnmP') || undefined,
    pcseguidance: pick(block, 'pcseguidance') || undefined,
    dtguidance:  pick(block, 'dtguidance') || undefined,
    sty:         pick(block, 'sty') || undefined,
  };
}

function pick(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!m) return '';
  // CDATA 언래핑 + trim
  return m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim();
}

// ─── HTTP 유틸 ────────────────────────────────────────────────────

async function fetchXml(url: string, tag: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/xml,text/xml,*/*' },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error(`KOPIS 키 인증 실패 (HTTP ${res.status})`);
      }
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error(`${tag} 타임아웃 (${TIMEOUT_MS/1000}초)`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// 동시 실행 제한 (서버 배려)
async function runThrottled<T>(
  tasks: Array<() => Promise<T>>, limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= tasks.length) return;
      try { results[i] = await tasks[i](); }
      catch (e) { console.warn('[kopis] task failed:', (e as any)?.message ?? e); results[i] = undefined as any; }
    }
  }
  const workers = Array(Math.min(limit, tasks.length)).fill(0).map(() => worker());
  await Promise.all(workers);
  return results;
}

// 한국어 이름 포함 체크 (공백·괄호 영향 덜 받도록)
function includesName(haystack: string, name: string): boolean {
  if (!haystack || !name) return false;
  const h = haystack.replace(/\s+/g, '');
  const n = name.replace(/\s+/g, '');
  return h.includes(n);
}

// ─── Raw → 앱 Event 변환 ───────────────────────────────────────────

export function kopisToEventInput(
  k: KopisRawEvent,
): Omit<Event, 'id' | 'artistId' | 'createdAt' | 'updatedAt' | 'notifyEnabled'> {
  const cat = genreNameToCategory(k.genrenm);
  const date = toIsoDate(k.prfpdfrom);
  return {
    externalId: `kopis:${k.mt20id}`,
    title: k.prfnm,
    category: cat,
    catIcon: iconForCategory(cat),
    date,
    venue: k.fcltynm,
    city: k.area,
    posterUrl: k.poster,
    ticketUrl: `http://www.kopis.or.kr/por/db/pblprfr/pblprfrView.do?menuId=MNU_00020&mt20Id=${k.mt20id}`,
    source: 'kopis',
  };
}
