/**
 * OCR 결과 텍스트에서 티켓 정보 추출.
 *
 * 추출 항목:
 *   - date (YYYY-MM-DD)
 *   - time (HH:MM)
 *   - venue (공연장)
 *   - title (제목 후보)
 *   - seat (좌석)
 *   - category (카테고리 추정)
 */

export type ParsedTicket = {
  date?: string;
  time?: string;
  venue?: string;
  title?: string;
  seat?: string;
  category?: string;
};

// ─── 공연장 키워드 (KOPIS 주요 공연장 기반) ───────────────────────
const VENUE_KEYWORDS = [
  '예술의전당', '세종문화회관', '국립극장', '국립극단', '엘지아트센터', 'LG아트센터',
  '블루스퀘어', '샤롯데씨어터', '디큐브아트센터', '충무아트센터',
  '고척스카이돔', '고척돔', '올림픽공원', '올림픽홀', 'KSPO DOME', '잠실종합운동장',
  '잠실', '장충체육관', '코엑스', 'COEX', '벡스코', 'BEXCO', '킨텍스',
  '수원월드컵', '인천문학', '창원NC', '대구삼성라이온즈', '광주-KIA',
  '롯데콘서트홀', '금호아트홀', 'KBS홀', '올림픽체조경기장',
  'D-CUBE', '대학로', '드림씨어터', '유니버설아트센터', '성남아트센터',
  '경기아트센터', '의정부예술의전당', '안산문화예술의전당',
];

const CATEGORY_KEYWORDS: Record<string, string> = {
  '연극': '연극', 'PLAY': '연극',
  '뮤지컬': '뮤지컬', 'MUSICAL': '뮤지컬',
  '콘서트': '콘서트', 'CONCERT': '콘서트', '공연': '콘서트',
  '야구': '야구', 'BASEBALL': '야구',
  '축구': '축구', 'SOCCER': '축구', 'FOOTBALL': '축구',
  '농구': '농구', 'BASKETBALL': '농구',
  '페스티벌': '페스티벌', 'FESTIVAL': '페스티벌',
  '전시': '전시', 'EXHIBITION': '전시',
};

export function parseTicketText(raw: string): ParsedTicket {
  if (!raw) return {};
  const text = raw.replace(/\r/g, '');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const flat = lines.join(' ');

  const out: ParsedTicket = {};

  // ─── 날짜 ─────────────────────────────────────────────────────
  // 2025-06-15 / 2025.06.15 / 2025/06/15 / 2025년 6월 15일
  const dateMatchers: RegExp[] = [
    /(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/,
    /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/,
  ];
  for (const re of dateMatchers) {
    const m = flat.match(re);
    if (m) {
      const y = m[1], mo = String(m[2]).padStart(2, '0'), d = String(m[3]).padStart(2, '0');
      out.date = `${y}-${mo}-${d}`;
      break;
    }
  }

  // ─── 시간 ─────────────────────────────────────────────────────
  // 19:30 / 오후 7시 30분 / 오후 7:30 / PM 7:30
  const timeMatch = flat.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (timeMatch) {
    const h = String(timeMatch[1]).padStart(2, '0');
    out.time = `${h}:${timeMatch[2]}`;
  } else {
    const km = flat.match(/(오전|오후|AM|PM)\s*(\d{1,2})\s*시\s*(\d{1,2})?\s*분?/i);
    if (km) {
      let h = parseInt(km[2], 10);
      const isPm = /오후|PM/i.test(km[1]);
      if (isPm && h < 12) h += 12;
      if (!isPm && h === 12) h = 0;
      const mm = km[3] ? String(km[3]).padStart(2, '0') : '00';
      out.time = `${String(h).padStart(2, '0')}:${mm}`;
    }
  }

  // ─── 공연장 ──────────────────────────────────────────────────
  for (const kw of VENUE_KEYWORDS) {
    const idx = flat.indexOf(kw);
    if (idx >= 0) {
      // 주변 컨텍스트 추출 (공연장 키워드 앞뒤로 10자 정도)
      const start = Math.max(0, idx - 0);
      const end = Math.min(flat.length, idx + kw.length + 10);
      out.venue = flat.slice(start, end).replace(/[\s·,]+$/, '').trim();
      break;
    }
  }

  // ─── 좌석 ────────────────────────────────────────────────────
  // 1층 B구역 24열 12번 / B블록 12석 / 3루 124블록 12번
  const seatPatterns = [
    /(?:\d+층\s*)?[A-Z가-힣]+\s*(?:구역|블록)\s*\d+\s*(?:열|석)?\s*\d*\s*번?/,
    /\d+루\s*\d+\s*(?:블록|구역)?\s*\d+\s*열?\s*\d*\s*번?/,
    /[A-Z]\d+\s*열\s*\d+\s*번/,
    /\d+\s*층\s*\d+\s*열\s*\d+\s*번/,
  ];
  for (const re of seatPatterns) {
    const m = flat.match(re);
    if (m) { out.seat = m[0].trim(); break; }
  }

  // ─── 카테고리 ────────────────────────────────────────────────
  const upper = flat.toUpperCase();
  for (const kw of Object.keys(CATEGORY_KEYWORDS)) {
    if (upper.includes(kw.toUpperCase())) {
      out.category = CATEGORY_KEYWORDS[kw];
      break;
    }
  }

  // ─── 제목 (휴리스틱) ─────────────────────────────────────────
  // 공연 제목은 대체로 상단에 가장 크게 나옴. OCR 텍스트의 첫 2~3줄 중에서
  // 날짜·시간·공연장 키워드가 없는 가장 긴 라인을 후보로.
  const candidates = lines.slice(0, Math.min(5, lines.length))
    .filter(l => l.length >= 3 && l.length <= 60)
    .filter(l => !/^\d+$/.test(l))
    .filter(l => !dateMatchers.some(re => re.test(l)))
    .filter(l => !/^(\d{1,2}\s*:\s*\d{2})/.test(l))
    .filter(l => !VENUE_KEYWORDS.some(v => l.includes(v)));
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.length - a.length);
    out.title = candidates[0];
  }

  return out;
}
