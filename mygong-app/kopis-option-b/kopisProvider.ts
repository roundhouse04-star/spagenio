/**
 * KOPIS 공연예술통합전산망 Open API 프로바이더.
 *
 * v4.5 — 6개 카테고리 체계 적용
 *   • genreNameToCategory 에 prfnm 전달 → 팬미팅/페스티벌 자동 분류
 *
 * v4.4 — 3가지 동기화 모드
 *   • 'full'        → 2010년 ~ 미래 1년 (처음 팔로우 시, ~40초)
 *   • 'incremental' → 1개월 전 ~ 미래 1년 (아티스트 상세 당겨서, ~6초)
 *   • 'future-only' → 오늘 ~ 미래 1년 (홈 당겨서 / 앱 시작 자동, ~3초)
 *
 * v4.1 — Cloudflare Worker 프록시 경유로 변경.
 *   • KOPIS 키는 Worker Secret 에만 존재
 *
 * Worker 엔드포인트:
 *   공연목록:  GET /performances?stdate=&eddate=&shcate=&shprfnm=&openrun=&rows=&cpage=
 *   공연상세:  GET /performance/{mt20id}
 *
 * KOPIS 스펙상 제약:
 *   - stdate/eddate 는 최대 31일 → 긴 기간은 청크 분할
 *   - rows 는 최대 100
 *   - 응답은 XML
 */

import type { Event } from '@/types';
import { iconForCategory } from '@/db/schema';
import {
  genreNameToCategory,
  splitByMonth, toIsoDate, fmtYmd,
} from './kopisCodes';
import {
  MYGONG_API_KOPIS_LIST, MYGONG_API_KOPIS_DETAIL, API_TIMEOUT_MS,
} from '@/config/api';

// Full sync 시작일: 2010년 고정
const HISTORY_START_DATE = new Date('2010-01-01');

// Incremental sync: 1개월 전부터
const INCREMENTAL_MONTHS_BACK = 1;

// 미래는 공통으로 1년치
const YEARS_AHEAD = 1;

// 동시 실행 제한
const MAX_CONCURRENCY = 4;

// 출연진 정밀 매칭
const ENABLE_CAST_MATCHING = false; // Cast Matching 끄기: 추가 발견 못하고 오히려 손실

// ─── Raw Types ────────────────────────────────────────────────────
export type KopisRawEvent = {
  mt20id: string;
  prfnm: string;
  prfpdfrom: string;
  prfpdto: string;
  fcltynm: string;
  area: string;
  genrenm: string;
  poster?: string;
  prfstate: string;
  openrun?: string;
};

export type KopisRawDetail = KopisRawEvent & {
  prfcast?: string;
  prfcrew?: string;
  entrpsnmP?: string;
  pcseguidance?: string;
  dtguidance?: string;
  sty?: string;
};

/** @deprecated Worker 경유라 항상 true */
export async function hasKopisKey(): Promise<boolean> {
  return true;
}

// ─── 메인 검색 ────────────────────────────────────────────────────

export type SyncMode = 'full' | 'incremental' | 'future-only';

export async function searchKopisEvents(
  artistName: string,
  artistTag?: string,
  mode: SyncMode = 'future-only',
  aliases: string[] = [],
): Promise<KopisRawEvent[]> {
  const builtInAliases = KPOP_ALIAS_MAP[artistName.toLowerCase()] ?? [];
  const allNames = [artistName, ...aliases, ...builtInAliases].filter(Boolean);
  const uniqueNames = Array.from(new Set(allNames));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setFullYear(end.getFullYear() + YEARS_AHEAD);

  let start: Date;
  switch (mode) {
    case 'full':
      start = HISTORY_START_DATE;
      break;
    case 'incremental':
      start = new Date(today);
      start.setMonth(start.getMonth() - INCREMENTAL_MONTHS_BACK);
      break;
    case 'future-only':
    default:
      start = new Date(today);
      break;
  }

  const chunks = splitByMonth(start, end);
  console.log(`[kopis] ${artistName} mode=${mode} range=${fmtYmd(start)}~${fmtYmd(end)} chunks=${chunks.length} aliases=[${uniqueNames.slice(1).join(',')}]`);

  const tasks: Array<() => Promise<KopisRawEvent[]>> = [];
  
  // ✅ 전략 1: 공연명 검색
  for (const name of uniqueNames) {
    for (const [stdate, eddate] of chunks) {
      tasks.push(() => fetchList({
        stdate, eddate, shprfnm: name,
      }));
    }
    tasks.push(() => fetchList({
      stdate: fmtYmd(today), eddate: fmtYmd(end),
      shprfnm: name, openrun: 'Y',
    }));
  }
  
  // ✅ 전략 2: 장르별 전수 조회 (full 모드일 때만)
  if (mode === 'full') {
    const genres = getGenresForTag(artistTag);
    console.log(`[kopis] genre search enabled for tag="${artistTag}" genres=[${genres.join(',')}]`);
    
    for (const genre of genres) {
      for (const [stdate, eddate] of chunks) {
        tasks.push(() => fetchList({
          stdate, eddate, shcate: genre,
        }));
      }
    }
  }

  const all = await runThrottled(tasks, MAX_CONCURRENCY);

  const rawCount = all.flat().length;
  const seen = new Set<string>();
  const dedup = all.flat().filter(e => {
    if (seen.has(e.mt20id)) return false;
    seen.add(e.mt20id);
    return true;
  });

  console.log(`[kopis] fetched ${rawCount} raw → ${dedup.length} after dedup (removed ${rawCount - dedup.length} duplicates)`);

  // ✅ 전략 3: 출연진 필터링
  if (mode === 'full' && dedup.length > 0) {
    const verified = await verifyCastMatchingEnhanced(dedup, uniqueNames, artistName);
    console.log(`[kopis] ${dedup.length} → ${verified.length} after cast verification`);
    return verified;
  }

  return dedup;
}


// ─── 공연목록 조회 (Worker 경유) ──────────────────────────────────

type ListParams = {
  stdate: string;
  eddate: string;
  shcate?: string;
  shprfnm?: string;
  openrun?: string;
};

async function fetchList(params: ListParams): Promise<KopisRawEvent[]> {
  const q = new URLSearchParams({
    stdate: params.stdate,
    eddate: params.eddate,
    cpage: '1',
    rows: '100',
  });
  if (params.shcate)  q.set('shcate',  params.shcate);
  if (params.shprfnm) q.set('shprfnm', params.shprfnm);
  if (params.openrun) q.set('openrun', params.openrun);

  const url = `${MYGONG_API_KOPIS_LIST}?${q.toString()}`;
  const xml = await fetchXml(url, 'kopis-list');
  return parseListXml(xml);
}

async function fetchDetail(mt20id: string): Promise<KopisRawDetail | null> {
  const url = `${MYGONG_API_KOPIS_DETAIL}/${encodeURIComponent(mt20id)}`;
  try {
    const xml = await fetchXml(url, 'kopis-detail');
    return parseDetailXml(xml);
  } catch (e: any) {
    console.warn(`[kopis-detail] ${mt20id} failed:`, e?.message ?? e);
    return null;
  }
}

async function verifyCastMatching(
  events: KopisRawEvent[], artistName: string,
): Promise<KopisRawEvent[]> {
  const tasks = events.map(ev => async () => {
    const detail = await fetchDetail(ev.mt20id);
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

// ─── XML 파서 ────────────────────────────────────────────────────

function parseListXml(xml: string): KopisRawEvent[] {
  if (/<OpenAPI_ServiceResponse>/.test(xml) || /SERVICE[_ ]KEY/i.test(xml)) {
    const reason = pick(xml, 'returnReasonCode') || pick(xml, 'returnAuthMsg') || 'UNKNOWN';
    throw new Error(`KOPIS API 오류: ${reason}`);
  }
  const trimmed = xml.trim();
  if (trimmed.startsWith('{')) {
    try {
      const err = JSON.parse(trimmed);
      if (err && err.error) throw new Error(`mygong-api 오류: ${err.error}`);
    } catch (parseErr: any) {
      if (parseErr?.message?.startsWith('mygong-api')) throw parseErr;
    }
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
  return m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim();
}

// ─── HTTP 유틸 ────────────────────────────────────────────────────

async function fetchXml(url: string, tag: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/xml,text/xml,*/*' },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error(`mygong-api 인증 실패 (HTTP ${res.status})`);
      }
      if (res.status === 404) {
        throw new Error(`mygong-api 경로 오류 (HTTP 404)`);
      }
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error(`${tag} 타임아웃 (${API_TIMEOUT_MS/1000}초)`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

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

function includesName(haystack: string, name: string): boolean {
  if (!haystack || !name) return false;
  const h = haystack.replace(/\s+/g, '').toLowerCase();
  const n = name.replace(/\s+/g, '').toLowerCase();
  return h.includes(n);
}

// 영문으로만 저장된 아티스트를 위한 한글 alias (KOPIS는 한글 공연명이 많음)
// 키는 반드시 소문자
const KPOP_ALIAS_MAP: Record<string, string[]> = {
  'aespa': ['에스파'],
  'bts': ['방탄소년단', '비티에스'],
  'blackpink': ['블랙핑크'],
  'twice': ['트와이스'],
  'newjeans': ['뉴진스'],
  'ive': ['아이브'],
  'itzy': ['있지'],
  'le sserafim': ['르세라핌'],
  'nmixx': ['엔믹스'],
  'stray kids': ['스트레이키즈'],
  'seventeen': ['세븐틴'],
  'nct': ['엔시티'],
  'nct dream': ['엔시티 드림', '엔시티드림'],
  'nct 127': ['엔시티127', '엔시티 127'],
  'exo': ['엑소'],
  'red velvet': ['레드벨벳'],
  'mamamoo': ['마마무'],
  'tomorrow x together': ['투모로우바이투게더', '투바투'],
  'txt': ['투모로우바이투게더', '투바투'],
  'ateez': ['에이티즈'],
  'enhypen': ['엔하이픈'],
  'iu': ['아이유'],
  'bigbang': ['빅뱅'],
  '2ne1': ['투애니원'],
  'shinee': ['샤이니'],
  'super junior': ['슈퍼주니어'],
  'girls generation': ['소녀시대'],
  'snsd': ['소녀시대'],
  'day6': ['데이식스'],
  'got7': ['갓세븐'],
  'monsta x': ['몬스타엑스'],
  'iz*one': ['아이즈원'],
  'izone': ['아이즈원'],
  'gfriend': ['여자친구'],
  'oh my girl': ['오마이걸'],
  'apink': ['에이핑크'],
  '(g)i-dle': ['여자아이들', '지아이들'],
  'gidle': ['여자아이들'],
  'kiss of life': ['키스오브라이프'],
  'riize': ['라이즈'],
  'zerobaseone': ['제로베이스원', '제베원'],
  'zb1': ['제로베이스원'],
  'illit': ['아일릿'],
  'babymonster': ['베이비몬스터'],
  'kep1er': ['케플러'],
  'fromis_9': ['프로미스나인'],
  'loona': ['이달의 소녀'],
  'dreamcatcher': ['드림캐쳐'],
};

// ─── Raw → 앱 Event 변환 ───────────────────────────────────────────

export function kopisToEventInput(
  k: KopisRawEvent,
): Omit<Event, 'id' | 'artistId' | 'createdAt' | 'updatedAt' | 'notifyEnabled'> {
  // 공연명도 넘겨서 팬미팅/페스티벌 자동 분류
  const cat = genreNameToCategory(k.genrenm, k.prfnm);
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

// ─── 장르별 검색 헬퍼 함수들 ────────────────────────────────────

function getGenresForTag(tag?: string): string[] {
  switch (tag) {
    case '가수':
      return ['CCCA'];
    case '뮤지컬 배우':
      return ['GGGA'];
    case '연극 배우':
      return ['AAAA'];
    default:
      return ['CCCA'];
  }
}

async function verifyCastMatchingEnhanced(
  events: KopisRawEvent[], 
  names: string[],
  primaryName: string
): Promise<KopisRawEvent[]> {
  const tasks = events.map(ev => async () => {
    // 공연명에 이미 포함되어 있으면 바로 통과
    for (const name of names) {
      if (includesName(ev.prfnm, name)) {
        return ev;
      }
    }
    
    // 출연진 확인
    const detail = await fetchDetail(ev.mt20id);
    if (!detail || !detail.prfcast) return null;
    
    const cast = detail.prfcast;
    for (const name of names) {
      if (includesName(cast, name)) {
        return ev;
      }
    }
    
    return null;
  });
  
  const out = await runThrottled(tasks, MAX_CONCURRENCY);
  return out.filter((x): x is KopisRawEvent => x !== null);
}
