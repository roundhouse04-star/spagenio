/**
 * 연예인 검색 서비스 (v2 — 안정성 + 디버깅 강화).
 *
 * 기존 v1 의 문제:
 *   - opensearch → query 2회 fetch 체인이 Expo Go 에서 불안정
 *   - title 매칭으로 page 찾는 로직이 리다이렉트/정규화 시 실패
 *   - User-Agent 미설정 → 위키미디어가 간헐적으로 429/빈응답
 *   - 타임아웃 없음 → 느린 네트워크에서 무한대기
 *   - 실패해도 로그가 안 찍혀서 디버깅 불가
 *
 * v2 개선:
 *   1. generator=search 로 "검색 + 상세" 단일 요청
 *   2. User-Agent / 10초 타임아웃 / 단계별 console.log
 *   3. 에러 시 어디서 터졌는지 명확히 보이게
 */

import type { SearchHit } from '@/types';

const WIKIPEDIA_KO_API = 'https://ko.wikipedia.org/w/api.php';
const USER_AGENT = 'MygongApp/1.0 (personal-use; https://github.com/roundhouse04-star/spagenio)';
const TIMEOUT_MS = 10000;

// ---------------------------------------------------------------------------
// fetch 래퍼 — 타임아웃 + UA + 로깅
// ---------------------------------------------------------------------------
async function fetchJson(url: string, tag: string): Promise<any> {
  console.log(`[${tag}] GET`, url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Api-User-Agent': USER_AGENT,
      },
      signal: ctrl.signal,
    });
    console.log(`[${tag}] status=${res.status} ok=${res.ok}`);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} · ${body.slice(0, 120)}`);
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn(`[${tag}] JSON parse failed. First 200 chars:`, text.slice(0, 200));
      throw new Error('응답이 JSON 이 아님 (네트워크 차단/프록시 의심)');
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error(`타임아웃 (${TIMEOUT_MS / 1000}초 초과)`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** 메인 검색 진입점 */
export async function searchCelebrity(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  console.log('[search] start:', q);

  try {
    const hits = await searchWikipedia(q);
    console.log('[search] total hits:', hits.length);
    return hits;
  } catch (e: any) {
    console.warn('[search] provider failed:', e?.message ?? e);
    throw e; // UI 에서 보이도록 re-throw
  }
}

// ---------------------------------------------------------------------------
// Wikipedia 한국어 — generator=search 로 단일 요청
// ---------------------------------------------------------------------------

type WikiHit = SearchHit & { _rank?: number };

async function searchWikipedia(q: string): Promise<SearchHit[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: q,
    gsrlimit: '10',
    gsrnamespace: '0',
    prop: 'pageimages|extracts|description',
    piprop: 'thumbnail',
    pithumbsize: '200',
    exintro: '1',
    explaintext: '1',
    exlimit: 'max',
    format: 'json',
    formatversion: '2',
    origin: '*',
  });
  const url = `${WIKIPEDIA_KO_API}?${params.toString()}`;
  const json = await fetchJson(url, 'wiki');

  const pages: any[] = json?.query?.pages ?? [];
  console.log('[wiki] pages count:', pages.length);

  if (pages.length === 0) return [];

  // generator=search 는 index 순서로 오지 않을 수 있어 정렬
  pages.sort((a, b) => (a.index ?? 999) - (b.index ?? 999));

  const hits: WikiHit[] = pages.map((p) => {
    const extract = String(p.extract ?? '').slice(0, 400);
    const desc    = String(p.description ?? '');
    const role    = inferRole(desc, extract);
    const person  = matchesPersonKeywords(`${desc} ${extract}`);
    return {
      externalId: `wiki:${p.pageid}`,
      name: p.title,
      role,
      bio: extract || desc || undefined,
      avatarUrl: p.thumbnail?.source,
      source: 'wikipedia',
      _rank: person ? 1 : 0,
    };
  });

  // 사람 같은 결과를 앞으로
  hits.sort((a, b) => (b._rank ?? 0) - (a._rank ?? 0));
  console.log('[wiki] final:', hits.map(h => `${h.name}(${h.role ?? '?'})`).join(', '));

  return hits.map(({ _rank, ...h }) => h);
}

function matchesPersonKeywords(s: string): boolean {
  if (!s) return false;
  return /(가수|배우|뮤지컬|아이돌|그룹|선수|감독|프로듀서|래퍼|성우|코미디언|방송인|모델|투수|타자|작곡가|싱어송라이터|아나운서|MC)/.test(s);
}

function inferRole(desc: string, extract: string): string | undefined {
  const s = `${desc} ${extract}`;
  const roles: string[] = [];
  if (/(가수|싱어송라이터)/.test(s))      roles.push('가수');
  if (/(배우|연기자)/.test(s))             roles.push('배우');
  if (/(뮤지컬)/.test(s))                   roles.push('뮤지컬 배우');
  if (/(아이돌|보이그룹|걸그룹)/.test(s))   roles.push('아이돌');
  if (/(래퍼|힙합)/.test(s))                roles.push('래퍼');
  if (/(프로듀서)/.test(s))                 roles.push('프로듀서');
  if (/(야구|투수|타자|KBO|메이저리그)/.test(s))     roles.push('야구 선수');
  if (/(축구|프리미어리그|K리그|분데스리가)/.test(s)) roles.push('축구 선수');
  if (/(농구|KBL|NBA|WKBL)/.test(s))         roles.push('농구 선수');
  if (/(아나운서|방송인|MC)/.test(s))        roles.push('방송인');
  return roles.length ? roles.slice(0, 2).join(' · ') : undefined;
}
