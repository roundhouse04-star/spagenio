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
  if (!tag) return Object.values(KOPIS_GENRE);
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

// ─── 장르/공연명 → 앱 내부 카테고리 매핑 (6개) ──────────────────
//
// 앱 카테고리: 콘서트, 뮤지컬, 연극, 팬미팅, 페스티벌, 전시
// (전시는 KOPIS 에 없음 — 사용자 수동 입력 전용)
//
// 무용/서커스/복합 등 애매한 장르는 가장 가까운 '페스티벌' 로 귀속.
const GENRE_NAME_TO_CATEGORY: Record<string, string> = {
  '연극':              '연극',
  '뮤지컬':            '뮤지컬',
  '대중음악':          '콘서트',
  '서양음악(클래식)':  '콘서트',
  '한국음악(국악)':    '콘서트',
  '무용(서양/한국무용)':'페스티벌',
  '대중무용':          '페스티벌',
  '서커스/마술':       '페스티벌',
  '복합':              '페스티벌',
};

/**
 * 공연 카테고리 결정.
 *
 * @param genrenm KOPIS 장르명 (예: '대중음악')
 * @param prfnm   공연명 (팬미팅 여부 판단용, optional)
 */
export function genreNameToCategory(genrenm: string, prfnm?: string): string {
  // 공연명에 '팬미팅/팬콘/쇼케이스' 들어있으면 팬미팅으로 우선 분류
  if (prfnm && /(팬미팅|팬콘|쇼케이스|FANMEETING|FAN\s*MEETING|SHOWCASE)/i.test(prfnm)) {
    return '팬미팅';
  }
  // 공연명에 '페스티벌/페스/축제/FESTIVAL' 들어있으면 페스티벌
  if (prfnm && /(페스티벌|페스\b|축제|FESTIVAL)/i.test(prfnm)) {
    return '페스티벌';
  }
  return GENRE_NAME_TO_CATEGORY[genrenm] || '콘서트';
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
