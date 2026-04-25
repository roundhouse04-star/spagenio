/**
 * 연예인 검색 서비스 (v3 — 아티스트 필터링 강화).
 *
 * v2 → v3:
 *   - 사람/아티스트가 아닌 결과 (영화, 앨범, 회사, 게임 등) 완전 제외
 *   - description + extract 텍스트 기반 EXCLUDE 키워드 우선
 *   - inferRole 결과가 있으면 우선 통과
 *   - 검색어 자동 보강 (결과 0건이면 "이름 가수" 로 재시도)
 */

import type { SearchHit } from '@/types';

const WIKIPEDIA_KO_API = 'https://ko.wikipedia.org/w/api.php';
const USER_AGENT = 'MygongApp/1.0 (personal-use; https://github.com/roundhouse04-star/spagenio)';
const TIMEOUT_MS = 10000;

// ─── fetch 래퍼 ─────────────────────────────────────────
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
    let hits = await searchWikipedia(q);
    console.log('[search] hits after filter:', hits.length);

    // 결과가 0개면 "이름 가수" 로 재시도 (자동 보강)
    if (hits.length === 0 && !q.includes(' ')) {
      console.log('[search] retry with role hint');
      hits = await searchWikipedia(`${q} 가수 OR 배우 OR 선수 OR 아이돌`);
      console.log('[search] retry hits:', hits.length);
    }

    return hits;
  } catch (e: any) {
    console.warn('[search] provider failed:', e?.message ?? e);
    throw e;
  }
}

// ─── Wikipedia 한국어 검색 ───────────────────────────────
type WikiHit = SearchHit & { _rank?: number };

async function searchWikipedia(q: string): Promise<SearchHit[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: q,
    gsrlimit: '15',                // 필터링 후 줄어드므로 더 넉넉하게
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

  pages.sort((a, b) => (a.index ?? 999) - (b.index ?? 999));

  // 1) 매핑 + 분류
  const mapped: { hit: WikiHit; rank: number; reason: string }[] = pages.map((p) => {
    const extract = String(p.extract ?? '').slice(0, 400);
    const desc    = String(p.description ?? '');
    const role    = inferRole(desc, extract);
    const text    = `${p.title} ${desc} ${extract}`;

    // 분류 로직 (3단계)
    let rank: number;
    let reason: string;

    if (isExplicitlyNotArtist(text)) {
      rank = -1; reason = `EXCLUDE (${desc.slice(0, 40)})`;
    } else if (role) {
      rank = 2; reason = `ARTIST (role=${role})`;
    } else if (matchesPersonKeywords(text)) {
      rank = 1; reason = `MAYBE PERSON (${desc.slice(0, 40)})`;
    } else {
      rank = 0; reason = `UNKNOWN (${desc.slice(0, 40)})`;
    }

    return {
      hit: {
        externalId: `wiki:${p.pageid}`,
        name: p.title,
        role,
        bio: extract || desc || undefined,
        avatarUrl: p.thumbnail?.source,
        source: 'wikipedia',
        _rank: rank,
      },
      rank,
      reason,
    };
  });

  // 2) 디버깅 로그
  for (const m of mapped) {
    console.log(`[wiki] ${m.hit.name}: ${m.reason}`);
  }

  // 3) 필터링: rank >= 0 만 통과 (명확히 아티스트 아닌 것만 제외)
  //    UNKNOWN (rank 0) 도 포함 — 더 많은 검색 결과
  const filtered = mapped.filter(m => m.rank >= 0);

  // 4) rank 내림차순 정렬 (배우/가수가 위로)
  filtered.sort((a, b) => b.rank - a.rank);

  console.log(`[wiki] kept ${filtered.length}/${mapped.length}`);
  return filtered.map(({ hit }) => {
    const { _rank, ...rest } = hit;
    return rest;
  });
}

// ─── 키워드 매칭 ─────────────────────────────────────────

/**
 * 명시적으로 아티스트가 아닌 항목 (음반, 영화, 회사 등).
 * 매칭되면 무조건 제외.
 */
function isExplicitlyNotArtist(text: string): boolean {
  // 우선순위 높은 제외 패턴
  const EXCLUDE_PATTERNS = [
    // 음반/곡 (단, "가수의 음반 목록" 같은 건 통과시키기 위해 단독 description 만)
    /(^|\s|·)(음반|앨범|싱글|미니앨범|정규앨범|EP음반|OST|사운드트랙|컴필레이션)(\s|$|이다|입니다|\.)/,
    // 영상물
    /(^|\s|·)(영화|드라마|예능|시트콤|시즌|시리즈|TV 프로그램|텔레비전 프로그램)(\s|$|이다|입니다|\.)/,
    // 출판물
    /(^|\s|·)(소설|만화|웹툰|책|도서|잡지|에세이|시집)(\s|$|이다|입니다|\.)/,
    // 회사/조직
    /(^|\s|·)(회사|기업|주식회사|레이블|에이전시|소속사|협회|단체|재단)(\s|$|이다|입니다|\.)/,
    // IT/서비스
    /(^|\s|·)(웹사이트|사이트|앱|게임|소프트웨어|플랫폼|서비스|애플리케이션)(\s|$|이다|입니다|\.)/,
    // 지역
    /(^|\s|·)(도시|지역|마을|시 |구 |동 |군 |강|산|섬)(\s|$|이다|입니다|\.)/,
    // 학교/공공
    /(^|\s|·)(학교|대학교|초등학교|중학교|고등학교|학원|병원)(\s|$|이다|입니다|\.)/,
    // 영어
    /\b(album|single|soundtrack|compilation|film|movie|tv series|drama series|novel|comic|manga|webtoon|book|company|corporation|label|website|application|video game|software)\b/i,
  ];

  for (const re of EXCLUDE_PATTERNS) {
    if (re.test(text)) return true;
  }
  return false;
}

function matchesPersonKeywords(s: string): boolean {
  if (!s) return false;
  return /(가수|배우|뮤지컬|아이돌|그룹|선수|감독|프로듀서|래퍼|성우|코미디언|방송인|모델|투수|타자|작곡가|싱어송라이터|아나운서|MC|연기자|예술가|음악가|개그맨|개그우먼|진행자|댄서)/.test(s);
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
  if (/(코미디언|개그맨|개그우먼)/.test(s))  roles.push('코미디언');
  if (/(모델)/.test(s))                      roles.push('모델');
  return roles.length ? roles.slice(0, 2).join(' · ') : undefined;
}
