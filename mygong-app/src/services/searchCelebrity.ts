/**
 * 연예인 검색 서비스.
 *
 * 프로바이더(공급자) 패턴:
 *   1. Wikipedia 한국어 API — 프로필/이름/설명 (실제 동작)
 *   2. (추후) 티켓링크/인터파크/멜론 — 공연 일정 스크래핑
 *   3. (추후) KBO/WKBL — 스포츠 경기 일정
 *
 * 지금은 Wikipedia 만 실제로 붙어 있고, 공연 데이터는 같은 검색 결과를
 * parseData.ts 에서 "sample event" 로 파생시켜 즉시 테스트 가능한 상태로 만듭니다.
 * 실제 스크래핑이 필요하면 아래 providers/ 각 파일만 구현하면 됨.
 */

import type { SearchHit } from '@/types';

const WIKIPEDIA_KO_API = 'https://ko.wikipedia.org/w/api.php';

/** 메인 검색 진입점 — 여러 프로바이더에서 병렬 검색 후 중복 제거 */
export async function searchCelebrity(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const results = await Promise.allSettled([
    searchWikipedia(q),
    // 여기에 다른 프로바이더 추가 가능:
    // searchNaverPerson(q),
    // searchTicketlinkArtists(q),
  ]);

  const hits: SearchHit[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') hits.push(...r.value);
    else console.warn('[search] provider failed:', r.reason);
  }

  // externalId 로 중복 제거
  const seen = new Set<string>();
  return hits.filter(h => {
    const key = `${h.source}:${h.externalId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Wikipedia 한국어 프로바이더 — 실제 API 호출 (CORS 허용, 공개, 무인증)
// ---------------------------------------------------------------------------

async function searchWikipedia(q: string): Promise<SearchHit[]> {
  // 1) opensearch 로 후보 페이지 제목 가져오기
  const openUrl = `${WIKIPEDIA_KO_API}?action=opensearch&search=${encodeURIComponent(q)}&limit=8&namespace=0&format=json&origin=*`;
  const openRes = await fetch(openUrl);
  if (!openRes.ok) throw new Error(`wikipedia opensearch ${openRes.status}`);
  const openJson = await openRes.json();
  // [query, [titles], [descriptions], [urls]]
  const titles: string[]       = openJson[1] ?? [];
  const descriptions: string[] = openJson[2] ?? [];

  if (titles.length === 0) return [];

  // 2) 대표 이미지·요약 가져오기 (query?prop=pageimages|extracts)
  const titlesParam = titles.slice(0, 8).join('|');
  const detailUrl = `${WIKIPEDIA_KO_API}?action=query&titles=${encodeURIComponent(titlesParam)}&prop=pageimages|extracts|pageprops&piprop=thumbnail&pithumbsize=200&exintro=1&explaintext=1&format=json&origin=*`;
  const detailRes = await fetch(detailUrl);
  if (!detailRes.ok) throw new Error(`wikipedia query ${detailRes.status}`);
  const detailJson = await detailRes.json();
  const pages = detailJson?.query?.pages ?? {};

  const hits: SearchHit[] = [];
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    const desc = descriptions[i];
    // pages 는 pageid 키 객체 — title 매칭 해야 함
    const page: any = Object.values(pages).find((p: any) => p.title === title);
    if (!page) continue;

    const extract = (page.extract ?? '').slice(0, 400);
    // 사람(person)이 아닐 가능성 필터링은 단순하게: 설명이나 요약에 직업 키워드가 있는지 체크
    const looksLikePerson = matchesPersonKeywords(desc + ' ' + extract);

    // 직업 추정 (간단)
    const role = inferRole(desc, extract);

    hits.push({
      externalId: `wiki:${page.pageid}`,
      name: title,
      nameEn: page.pageprops?.['wikibase-shortdesc-en'] ?? undefined,
      role,
      bio: extract || desc,
      avatarUrl: page.thumbnail?.source,
      source: 'wikipedia',
    });

    // 사람 같은 결과를 우선 — 아닌 건 뒤로 밀기 (현재는 정렬만)
    if (!looksLikePerson) hits[hits.length - 1]._rank = -1 as any;
  }

  hits.sort((a: any, b: any) => (b._rank ?? 0) - (a._rank ?? 0));
  return hits;
}

function matchesPersonKeywords(s: string): boolean {
  if (!s) return false;
  return /(가수|배우|뮤지컬|아이돌|그룹|선수|감독|프로듀서|래퍼|성우|코미디언|방송인|모델|투수|타자|작곡가|싱어송라이터)/.test(s);
}

function inferRole(desc: string, extract: string): string | undefined {
  const s = `${desc} ${extract}`;
  const roles: string[] = [];
  if (/(가수|싱어송라이터)/.test(s))   roles.push('가수');
  if (/(배우|연기자)/.test(s))          roles.push('배우');
  if (/(뮤지컬)/.test(s))                roles.push('뮤지컬 배우');
  if (/(아이돌|보이그룹|걸그룹)/.test(s)) roles.push('아이돌');
  if (/(래퍼|힙합)/.test(s))             roles.push('래퍼');
  if (/(프로듀서)/.test(s))              roles.push('프로듀서');
  if (/(야구|투수|타자|KBO)/.test(s))    roles.push('야구 선수');
  if (/(축구|프리미어리그|K리그)/.test(s)) roles.push('축구 선수');
  if (/(농구|KBL|NBA)/.test(s))          roles.push('농구 선수');
  return roles.length ? roles.slice(0, 2).join(' · ') : undefined;
}
