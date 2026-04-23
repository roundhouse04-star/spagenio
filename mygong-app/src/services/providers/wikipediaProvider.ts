/**
 * Wikipedia 본문 파싱 프로바이더 — 아티스트 페이지 wikitext 에서
 * "콘서트 / 투어 / 공연 / 음악회 / 라이브" 섹션을 찾아 Event 로 변환.
 *
 * 위키피디아 한국어판은 보통 이런 구조로 되어있음:
 *
 *   == 음악 활동 ==
 *   === 콘서트 ===
 *   * 2023년 4월 15일 — '아이유 LILAC' (서울 올림픽공원)
 *   * 2024년 8월 10일 — '아이유 H.E.R.' 월드투어 (도쿄)
 *
 *   {| class="wikitable"
 *   ! 연도 !! 공연명 !! 장소
 *   |-
 *   | 2023 || 콘서트 A || 서울
 *   |}
 *
 * 표(wikitable) 와 글머리(*) 둘 다 파싱.
 */

import type { Event } from '@/types';

const WIKIPEDIA_KO_API = 'https://ko.wikipedia.org/w/api.php';
const USER_AGENT = 'MygongApp/1.0 (personal-use; https://github.com/roundhouse04-star/spagenio)';
const TIMEOUT_MS = 10000;

// 공연·출연 섹션 분류. 위에서 아래로 매칭, 먼저 걸리는 카테고리가 적용됨.
// 구체적인 것부터 → 일반적인 것 순서로 배치.
const SECTION_CATEGORY_MAP: Array<[RegExp, string]> = [
  [/(뮤직비디오|뮤비|\bMV\b)/i,                           '뮤직비디오'],
  [/(뮤지컬)/,                                             '뮤지컬'],
  [/(연극)/,                                               '연극'],
  [/(드라마|연속극|시리즈물)/,                             '드라마'],
  [/(영화|필모그래피|출연.*영화)/,                         '영화'],
  [/(예능|버라이어티|방송|TV.?쇼|텔레비전|라디오|MC|진행|출연\s*작품|^출연$)/, '방송'],
  [/(광고|CF|브랜드.*모델)/i,                              '광고'],
  [/(앨범|음반|디스코그래피|정규|미니.?앨범|싱글)/,        '앨범'],
  [/(수상|시상|상\s*목록|수훈|영예)/,                      '수상'],
  [/(팬미팅|팬콘|쇼케이스)/,                               '팬미팅'],
  [/(페스티벌)/,                                           '페스티벌'],
  [/(콘서트|투어|라이브|음악회|리사이틀|뮤직|공연|월드투어)/,'콘서트'],
];

/** 섹션 제목으로 카테고리 결정. 매칭 안 되면 null (섹션 무시) */
function categoryForHeading(heading: string): string | null {
  for (const [re, cat] of SECTION_CATEGORY_MAP) {
    if (re.test(heading)) return cat;
  }
  return null;
}

type RawEventRow = {
  date?: string;     // YYYY-MM-DD
  year?: string;     // YYYY (날짜 못 찾을 때)
  title: string;
  venue?: string;
  city?: string;
  category?: string;
};

export type WikiPageEvents = {
  pageId: number;
  title: string;
  events: RawEventRow[];
};

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

export async function fetchWikipediaEvents(pageId: number, artistName: string): Promise<RawEventRow[]> {
  console.log('[wiki-events] fetching for pageId', pageId, 'name', artistName);
  try {
    const wikitext = await fetchWikitext(pageId);
    if (!wikitext) {
      console.log('[wiki-events] no wikitext returned');
      return [];
    }
    console.log('[wiki-events] wikitext length:', wikitext.length);

    const sections = extractPerformanceSections(wikitext);
    console.log('[wiki-events] sections matched:', sections.map(s => `${s.heading}→${s.category}`).join(', ') || '(none)');

    const events: RawEventRow[] = [];
    for (const sec of sections) {
      events.push(...parseSection(sec.body, artistName, sec.category));
    }
    console.log('[wiki-events] parsed events:', events.length);
    return dedupe(events);
  } catch (e: any) {
    console.warn('[wiki-events] failed:', e?.message ?? e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Wikitext 가져오기 (action=parse)
// ---------------------------------------------------------------------------

async function fetchWikitext(pageId: number): Promise<string | null> {
  const params = new URLSearchParams({
    action: 'parse',
    pageid: String(pageId),
    prop: 'wikitext',
    format: 'json',
    formatversion: '2',
    origin: '*',
  });
  const url = `${WIKIPEDIA_KO_API}?${params.toString()}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT, 'Accept': 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json?.parse?.wikitext ?? null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// 섹션 추출
// ---------------------------------------------------------------------------

type SectionWithCategory = { body: string; category: string; heading: string };

function extractPerformanceSections(wikitext: string): SectionWithCategory[] {
  // == 헤딩 == 또는 === 서브헤딩 === 단위로 자르기
  const lines = wikitext.split(/\r?\n/);
  const sections: SectionWithCategory[] = [];
  let current: { heading: string; body: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const cat = categoryForHeading(current.heading);
    if (cat) {
      sections.push({ body: current.body.join('\n'), category: cat, heading: current.heading });
    }
  };

  for (const line of lines) {
    const headMatch = line.match(/^\s*={2,4}\s*(.+?)\s*={2,4}\s*$/);
    if (headMatch) {
      flush();
      current = { heading: headMatch[1], body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  flush();
  return sections;
}

// ---------------------------------------------------------------------------
// 섹션 본문 파싱 — wikitable + 글머리 항목
// ---------------------------------------------------------------------------

function parseSection(body: string, artistName: string, category: string): RawEventRow[] {
  const events: RawEventRow[] = [];

  // 1) wikitable 파싱
  const tableRe = /\{\|[^]*?\|\}/g;
  const tables = body.match(tableRe) ?? [];
  for (const t of tables) {
    events.push(...parseWikitable(t));
  }

  // 2) 글머리 항목 파싱 (* 로 시작)
  const bulletLines = body
    .replace(tableRe, '') // 테이블 제거 후
    .split(/\r?\n/)
    .filter(l => /^\s*\*+\s/.test(l));
  for (const line of bulletLines) {
    const ev = parseBullet(line);
    if (ev) events.push(ev);
  }

  // 모든 이벤트에 섹션 카테고리 스탬프
  return events.map(e => ({ ...e, category }));
}

/** wikitable 한 개를 행 단위로 파싱. 첫 행은 보통 헤더(!) */
function parseWikitable(table: string): RawEventRow[] {
  const events: RawEventRow[] = [];
  // |- 단위로 행 분할
  const rows = table.split(/\n\s*\|-+/).map(r => r.trim()).filter(Boolean);
  if (rows.length < 2) return events;

  // 헤더 — ! 로 시작하는 셀들
  const headerLine = rows[0];
  const headers = headerLine
    .split(/\n/)
    .filter(l => l.startsWith('!'))
    .flatMap(l => l.replace(/^!+/, '').split(/!!|\|\|/))
    .map(h => stripWiki(h).trim());

  if (headers.length === 0) return events;

  // 어느 컬럼이 무엇인지 추정
  const colIdx = {
    date:   headers.findIndex(h => /(연도|날짜|일자|기간|시기)/.test(h)),
    title:  headers.findIndex(h => /(공연|이름|타이틀|제목|투어|콘서트)/.test(h)),
    venue:  headers.findIndex(h => /(장소|공연장|공연지|회장|venue)/.test(h)),
    city:   headers.findIndex(h => /(도시|지역|국가|개최지)/.test(h)),
  };

  // 데이터 행
  for (let i = 1; i < rows.length; i++) {
    const cells = parseRowCells(rows[i]);
    if (cells.length === 0) continue;

    const titleCell = colIdx.title >= 0 ? cells[colIdx.title] : cells[0];
    const dateCell  = colIdx.date  >= 0 ? cells[colIdx.date]  : '';
    const venueCell = colIdx.venue >= 0 ? cells[colIdx.venue] : '';
    const cityCell  = colIdx.city  >= 0 ? cells[colIdx.city]  : '';

    if (!titleCell || titleCell.length < 2) continue;
    const dateInfo = parseDate(dateCell);

    events.push({
      title: titleCell.trim(),
      date: dateInfo.date,
      year: dateInfo.year,
      venue: venueCell || undefined,
      city: cityCell || undefined,
    });
  }
  return events;
}

function parseRowCells(rowText: string): string[] {
  // 데이터 행은 | cell || cell 형식
  return rowText
    .split(/\n/)
    .filter(l => l.startsWith('|') && !l.startsWith('|-') && !l.startsWith('|+') && !l.startsWith('|}'))
    .flatMap(l => l.replace(/^\|+/, '').split(/\|\|/))
    .map(c => stripWiki(c).trim());
}

/** "* 2023년 4월 15일 — '아이유 LILAC' (서울 올림픽공원)" 같은 줄 파싱 */
function parseBullet(line: string): RawEventRow | null {
  const text = stripWiki(line.replace(/^\s*\*+\s*/, '')).trim();
  if (text.length < 5) return null;

  const dateInfo = parseDate(text);
  // 제목은 보통 따옴표/괄호로 감싸짐 또는 — 뒤
  let title = text;
  let venue: string | undefined;
  let city: string | undefined;

  // 괄호 안에 장소
  const parenMatch = text.match(/[\(（](.+?)[\)）]/);
  if (parenMatch) {
    venue = parenMatch[1].trim();
    title = text.replace(parenMatch[0], '').trim();
  }

  // 날짜 부분 제거
  title = title
    .replace(/\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g, '')
    .replace(/\d{4}\.\d{1,2}\.\d{1,2}/g, '')
    .replace(/\d{4}년/g, '')
    .replace(/[—–-]/g, ' ')
    .replace(/^['"`「『]|['"`」』]$/g, '')
    .trim();

  if (title.length < 2) return null;
  return {
    title,
    date: dateInfo.date,
    year: dateInfo.year,
    venue,
    city,
  };
}

// ---------------------------------------------------------------------------
// 날짜 파싱
// ---------------------------------------------------------------------------

function parseDate(s: string): { date?: string; year?: string } {
  if (!s) return {};
  const cleaned = stripWiki(s);

  // YYYY년 M월 D일
  let m = cleaned.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (m) {
    const yyyy = m[1];
    const mm = String(m[2]).padStart(2, '0');
    const dd = String(m[3]).padStart(2, '0');
    return { date: `${yyyy}-${mm}-${dd}`, year: yyyy };
  }
  // YYYY.MM.DD or YYYY-MM-DD
  m = cleaned.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) {
    return { date: `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`, year: m[1] };
  }
  // YYYY년 (연도만)
  m = cleaned.match(/(\d{4})년?/);
  if (m && Number(m[1]) > 1950 && Number(m[1]) < 2100) {
    return { year: m[1] };
  }
  return {};
}

// ---------------------------------------------------------------------------
// wikitext 마크업 제거
// ---------------------------------------------------------------------------

function stripWiki(s: string): string {
  return s
    .replace(/<ref[^>]*>[^]*?<\/ref>/g, '')
    .replace(/<ref[^/]*\/>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1')  // [[link|text]] → text
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1')   // [url text] → text
    .replace(/'''/g, '').replace(/''/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .trim();
}

// ---------------------------------------------------------------------------
// 중복 제거
// ---------------------------------------------------------------------------

function dedupe(events: RawEventRow[]): RawEventRow[] {
  const seen = new Set<string>();
  const out: RawEventRow[] = [];
  for (const e of events) {
    const key = `${e.date ?? e.year ?? ''}|${normalizeTitle(e.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function normalizeTitle(t: string): string {
  return t.replace(/\s+/g, '').toLowerCase();
}
