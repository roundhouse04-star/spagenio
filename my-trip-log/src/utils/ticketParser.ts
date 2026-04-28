/**
 * 티켓 OCR 텍스트에서 자동 추출 (보조 입력용)
 *
 * 사용자가 사진 첨부 후 "정보 자동 채우기" 누르면 OCR.space로 텍스트 뽑고
 * 카테고리에 따라 패턴 매칭. 추출 못한 필드는 그대로 두고, 추출한 건 후보값으로 채움.
 * 사용자가 항상 수정 가능.
 */
import { TicketCategory } from '@/types';

export interface TicketExtraction {
  origin?: string;       // IATA 코드 또는 역명
  destination?: string;
  useDate?: string;      // ISO date (YYYY-MM-DD)
  seat?: string;
  amount?: number;
  currency?: string;
}

/**
 * IATA 3-letter 공항 코드 패턴 — "ICN", "KIX", "NRT" 등
 * 영어 대문자 3자가 보딩패스에서 자주 나타남.
 * 흔한 영어 단어와 충돌 방지용 화이트리스트는 일부만 (운영 후 확장 가능).
 */
const COMMON_IATA = new Set([
  // 한국
  'ICN', 'GMP', 'PUS', 'CJU', 'TAE',
  // 일본
  'NRT', 'HND', 'KIX', 'ITM', 'NGO', 'FUK', 'OKA', 'SDJ',
  // 중국
  'PEK', 'PKX', 'PVG', 'SHA', 'CAN', 'SZX', 'HGH',
  // 동남아
  'BKK', 'DMK', 'SIN', 'KUL', 'CGK', 'DPS', 'MNL', 'CEB', 'HAN', 'SGN',
  // 미국
  'LAX', 'SFO', 'JFK', 'EWR', 'LGA', 'ORD', 'SEA', 'BOS', 'DFW', 'ATL', 'IAD',
  // 유럽
  'LHR', 'LGW', 'CDG', 'ORY', 'FRA', 'MUC', 'AMS', 'FCO', 'MAD', 'BCN', 'IST',
  // 기타
  'YYZ', 'YVR', 'SYD', 'MEL', 'AKL', 'DXB', 'DOH', 'HKG', 'TPE',
]);

const IATA_PATTERN = /\b([A-Z]{3})\b/g;
const ROUTE_ARROW_PATTERN = /\b([A-Z]{3})\s*[-→>/]+\s*([A-Z]{3})\b/;

const DATE_PATTERNS: { re: RegExp; build: (m: RegExpMatchArray) => string | null }[] = [
  // 2026-04-15 / 2026/04/15 / 2026.04.15
  {
    re: /\b(20\d{2})[-./](\d{1,2})[-./](\d{1,2})\b/,
    build: (m) => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`,
  },
  // 15APR2026 / 15-APR-26
  {
    re: /\b(\d{1,2})[-\s]?(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[-\s]?(\d{2,4})\b/i,
    build: (m) => {
      const months: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      };
      const month = months[m[2].toLowerCase()];
      const day = m[1].padStart(2, '0');
      let year = m[3];
      if (year.length === 2) year = `20${year}`;
      return month ? `${year}-${month}-${day}` : null;
    },
  },
  // 2026년 4월 15일
  {
    re: /(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/,
    build: (m) => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`,
  },
];

const SEAT_PATTERN_FLIGHT = /\b(?:SEAT|좌석)\s*[:\s]*([0-9]{1,3}[A-K])\b/i;
const SEAT_PATTERN_GENERIC = /\b([0-9]{1,3}[A-K]|[A-Z]\d{1,3})\b/;

const AMOUNT_PATTERNS = [
  { re: /₩\s*([\d,]+)\s*원?/, currency: 'KRW' },
  { re: /([\d,]+)\s*원/, currency: 'KRW' },
  { re: /¥\s*([\d,]+)/, currency: 'JPY' },
  { re: /([\d,]+)\s*円/, currency: 'JPY' },
  { re: /([\d,]+)\s*엔/, currency: 'JPY' },
  { re: /\$\s*([\d,]+\.?\d*)/, currency: 'USD' },
  { re: /€\s*([\d,]+\.?\d*)/, currency: 'EUR' },
];

function extractRoute(text: string): { origin?: string; destination?: string } {
  // 1) 화살표/대시로 명확하게 연결된 경우 우선
  const arrow = ROUTE_ARROW_PATTERN.exec(text);
  if (arrow) {
    return { origin: arrow[1], destination: arrow[2] };
  }
  // 2) IATA 코드 후보 중 화이트리스트 매치되는 것 2개 추출
  const candidates = new Set<string>();
  let m: RegExpExecArray | null;
  IATA_PATTERN.lastIndex = 0;
  while ((m = IATA_PATTERN.exec(text)) !== null) {
    if (COMMON_IATA.has(m[1])) candidates.add(m[1]);
    if (candidates.size >= 2) break;
  }
  const arr = Array.from(candidates);
  if (arr.length >= 2) return { origin: arr[0], destination: arr[1] };
  if (arr.length === 1) return { origin: arr[0] };
  return {};
}

function extractDate(text: string): string | undefined {
  for (const p of DATE_PATTERNS) {
    const m = text.match(p.re);
    if (m) {
      const built = p.build(m);
      if (built) return built;
    }
  }
  return undefined;
}

function extractSeat(text: string, category: TicketCategory): string | undefined {
  const re = category === 'flight' ? SEAT_PATTERN_FLIGHT : SEAT_PATTERN_GENERIC;
  const m = text.match(re);
  return m ? m[1].toUpperCase() : undefined;
}

function extractAmount(text: string): { amount?: number; currency?: string } {
  for (const p of AMOUNT_PATTERNS) {
    const m = text.match(p.re);
    if (m) {
      const num = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(num) && num > 0) {
        return { amount: num, currency: p.currency };
      }
    }
  }
  return {};
}

/**
 * OCR 텍스트와 카테고리를 받아 가능한 필드를 추출.
 * 모든 필드는 옵셔널 — 추출 못한 건 undefined.
 */
export function parseTicketText(text: string, category: TicketCategory): TicketExtraction {
  const result: TicketExtraction = {};

  // 경로 (비행/기차/버스만)
  if (category === 'flight' || category === 'train' || category === 'bus') {
    const route = extractRoute(text);
    if (route.origin) result.origin = route.origin;
    if (route.destination) result.destination = route.destination;
  }

  const date = extractDate(text);
  if (date) result.useDate = date;

  const seat = extractSeat(text, category);
  if (seat) result.seat = seat;

  const { amount, currency } = extractAmount(text);
  if (amount !== undefined) result.amount = amount;
  if (currency) result.currency = currency;

  return result;
}
