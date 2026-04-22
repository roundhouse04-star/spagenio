/**
 * KOPIS Open API 공통 코드 (v3.7 문서 기준).
 * https://www.kopis.or.kr/por/cs/openapi/openApiInfo.do
 */

// ─── 장르 코드 (shcate) ──────────────────────────────────────────
export const KOPIS_GENRE = {
  PLAY:        'AAAA',  // 연극
  DANCE:       'BBBC',  // 무용(서양/한국무용)
  POP_DANCE:   'BBBE',  // 대중무용
  CLASSIC:     'CCCA',  // 서양음악(클래식)
  KOREAN_MUSIC:'CCCC',  // 한국음악(국악)
  POP_MUSIC:   'CCCD',  // 대중음악
  MIXED:       'EEEA',  // 복합
  CIRCUS:      'EEEB',  // 서커스/마술
  MUSICAL:     'GGGA',  // 뮤지컬
} as const;

export type KopisGenreCode = typeof KOPIS_GENRE[keyof typeof KOPIS_GENRE];

/** 아티스트 tag 에 따라 우선 조회할 장르 코드들 */
export function genreCodesForTag(tag?: string): KopisGenreCode[] {
  if (!tag) return Object.values(KOPIS_GENRE); // 전부
  switch (tag) {
    case '가수':
    case '아이돌':
      return [KOPIS_GENRE.POP_MUSIC];
    case '배우':
      return [KOPIS_GENRE.MUSICAL, KOPIS_GENRE.PLAY];
    case '뮤지컬':
      return [KOPIS_GENRE.MUSICAL];
    case '연극':
      return [KOPIS_GENRE.PLAY];
    case '무용':
    case '발레':
      return [KOPIS_GENRE.DANCE, KOPIS_GENRE.POP_DANCE];
    case '국악':
      return [KOPIS_GENRE.KOREAN_MUSIC];
    case '클래식':
      return [KOPIS_GENRE.CLASSIC];
    default:
      return Object.values(KOPIS_GENRE);
  }
}

// ─── 공연상태 코드 (prfstate) ────────────────────────────────────
export const KOPIS_PRFSTATE = {
  UPCOMING: '01',  // 공연예정
  ONGOING:  '02',  // 공연중
  FINISHED: '03',  // 공연완료
} as const;

// ─── 장르 → 앱 내부 카테고리 매핑 ────────────────────────────────
const GENRE_NAME_TO_CATEGORY: Record<string, string> = {
  '연극': '연극',
  '뮤지컬': '뮤지컬',
  '대중음악': '콘서트',
  '서양음악(클래식)': '콘서트',
  '한국음악(국악)': '콘서트',
  '무용(서양/한국무용)': '공연',
  '대중무용': '공연',
  '서커스/마술': '공연',
  '복합': '공연',
};

export function genreNameToCategory(genrenm: string): string {
  return GENRE_NAME_TO_CATEGORY[genrenm] || '공연';
}

// ─── 기간 유틸 ────────────────────────────────────────────────────
/** KOPIS 는 stdate/eddate 최대 31일 제약. 주어진 범위를 31일 청크로 분할 */
export function splitByMonth(startDate: Date, endDate: Date): Array<[string, string]> {
  const chunks: Array<[string, string]> = [];
  let cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= endDate) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + 30); // 31일치 (포함)
    if (chunkEnd > endDate) chunkEnd.setTime(endDate.getTime());
    chunks.push([fmtYmd(cursor), fmtYmd(chunkEnd)]);
    cursor = new Date(chunkEnd);
    cursor.setDate(cursor.getDate() + 1);
  }
  return chunks;
}

export function fmtYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${dd}`;
}

export function toIsoDate(kopisDate: string): string {
  // "2025.06.15" → "2025-06-15"
  return kopisDate.replace(/\./g, '-');
}
