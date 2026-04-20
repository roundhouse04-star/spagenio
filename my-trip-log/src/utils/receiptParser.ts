/**
 * 영수증 OCR 파서
 *
 * ML Kit로 추출한 텍스트 → 구조화된 데이터
 * - 가게명
 * - 날짜
 * - 총금액
 * - 카테고리 (키워드 기반 자동 분류)
 * - 원본 텍스트
 */

export interface ParsedReceipt {
  storeName?: string;
  date?: string;           // YYYY-MM-DD
  totalAmount?: number;
  currency?: string;
  category?: ExpenseCategory;
  confidence: number;      // 0~1, 파싱 성공률
  rawText: string;
}

export type ExpenseCategory =
  | 'food'        // 식음료
  | 'transport'   // 교통
  | 'accommodation' // 숙박
  | 'shopping'    // 쇼핑
  | 'sightseeing' // 관광/입장권
  | 'entertainment' // 놀이/엔터
  | 'other';      // 기타

// ============ 카테고리 키워드 매핑 ============
const CATEGORY_KEYWORDS: Record<ExpenseCategory, string[]> = {
  food: [
    // 한국
    '스타벅스', 'starbucks', '이디야', 'ediya', '투썸', 'twosome',
    '파리바게트', '뚜레쥬르', '맥도날드', 'mcdonald', '버거킹', 'burger king',
    '롯데리아', '서브웨이', 'subway', '피자헛', 'pizza', 'kfc',
    '카페', 'cafe', 'coffee', '커피', '음식점', '식당', '레스토랑', 'restaurant',
    '치킨', '분식', '김밥', '한식', '중식', '일식', '양식',
    '맛집', 'diner', 'bistro', 'bar', 'pub', '펍', '술집',
    '삼겹살', '곱창', '횟집', '돼지', '치킨', '국밥', '라멘', 'ramen',
    '편의점', 'cu', 'gs25', '세븐일레븐', '7-eleven', 'seven eleven',
    // 일본
    '居酒屋', 'ラーメン', '寿司', 'すし', 'sushi', 'izakaya',
    'ファミマ', 'セブン', 'ローソン',
    // 태국/동남아
    '7-11', 'family mart',
    // 기타
    'food', 'eat', 'meal', 'lunch', 'dinner', 'breakfast',
  ],
  transport: [
    '택시', 'taxi', '지하철', 'subway', 'metro', '버스', 'bus',
    'uber', '우버', 'grab', '그랩', 'lyft',
    '공항철도', 'airport', 'airlines', '항공', '티켓', 'ticket',
    '기차', 'train', 'railway', 'jr', 'shinkansen', '신칸센',
    'gas', '주유', 'shell', 'esso', 'bp', 'exxon',
    '교통', '렌트카', 'rent', 'car',
    'toll', '톨게이트', '고속도로',
  ],
  accommodation: [
    '호텔', 'hotel', '게스트하우스', 'guest house', 'guesthouse',
    'airbnb', '에어비앤비', 'hostel', '호스텔',
    'motel', '모텔', 'inn', '여관', 'resort', '리조트',
    'ryokan', '旅館', '민박', 'pension', '펜션',
    '숙박', 'booking', 'agoda', 'hotels.com',
  ],
  shopping: [
    '마트', 'mart', '이마트', '홈플러스', '롯데마트', 'costco', '코스트코',
    'olive young', '올리브영', '다이소', 'daiso', 'muji', '무인양품',
    'uniqlo', '유니클로', 'zara', 'h&m', 'nike', 'adidas',
    '백화점', 'department', '신세계', '현대', '갤러리아',
    '돈키호테', 'donki', 'don quijote', '드럭스토어',
    'apple', '애플', 'samsung', 'electronics',
    'shop', '상점', '쇼핑', '매장', 'store', 'boutique',
    '면세점', 'duty free',
  ],
  sightseeing: [
    '박물관', 'museum', '미술관', 'gallery', '갤러리',
    '공원', 'park', '유원지', 'amusement',
    '입장권', 'admission', 'ticket', 'entrance', 'entry',
    '궁전', 'palace', '성', 'castle', '사원', 'temple', '신사', '教堂',
    '투어', 'tour', 'guide', '가이드',
    '전망대', 'observatory', '타워', 'tower',
    '수족관', 'aquarium', '동물원', 'zoo',
  ],
  entertainment: [
    'cgv', '메가박스', 'megabox', 'lotte cinema', '영화관', 'cinema', 'movie',
    '노래방', 'karaoke', 'ktv',
    '놀이공원', 'disney', '디즈니', 'universal', 'usj', '유니버설',
    'escape room', '방탈출',
    '볼링', 'bowling', 'pc방', 'pc bang',
    'massage', '마사지', '스파', 'spa',
    'show', '공연', '콘서트', 'concert',
  ],
  other: [],
};

// ============ 날짜 패턴 ============
const DATE_PATTERNS = [
  // YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  /\b(20\d{2})[-./](\d{1,2})[-./](\d{1,2})\b/,
  // YY-MM-DD, YY/MM/DD
  /\b(\d{2})[-./](\d{1,2})[-./](\d{1,2})\b/,
  // MM/DD/YYYY
  /\b(\d{1,2})[-./](\d{1,2})[-./](20\d{2})\b/,
  // 한국어: 2025년 4월 19일
  /(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/,
  // 일본어: 2025年4月19日
  /(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
];

// ============ 금액 패턴 ============
const AMOUNT_PATTERNS = [
  // "합계", "total", "금액" 등과 함께 나오는 숫자 (우선순위 높음)
  /(?:합계|총\s*액|총\s*금액|total|grand\s*total|amount|sum|결제\s*금액|총\s*결제)\s*[:\s]*₩?\s*([\d,]+)(?:원)?/i,
  // "지불액" 패턴
  /(?:지불|지급|받은\s*금액|payment)\s*[:\s]*₩?\s*([\d,]+)(?:원)?/i,
  // 단독 금액 (₩100,000 / 100,000원 / $50.00 / ¥1,000)
  /₩\s*([\d,]+)(?:\s*원)?/,
  /\$\s*([\d,]+\.?\d*)/,
  /¥\s*([\d,]+)/,
  /€\s*([\d,]+\.?\d*)/,
  /([\d,]+)\s*원/,
  /([\d,]+)\s*엔/,
  /([\d,]+)\s*円/,
];

// 통화 감지
const CURRENCY_MARKERS: Record<string, string> = {
  '₩': 'KRW', '원': 'KRW',
  '$': 'USD',
  '¥': 'JPY', '円': 'JPY', '엔': 'JPY',
  '€': 'EUR',
  '£': 'GBP',
  '฿': 'THB',
  'SGD': 'SGD', 'HKD': 'HKD',
};

/** OCR 텍스트에서 구조화된 영수증 데이터 추출 */
export function parseReceipt(rawText: string, defaultCurrency = 'KRW'): ParsedReceipt {
  if (!rawText?.trim()) {
    return { confidence: 0, rawText: '' };
  }

  const text = rawText.trim();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let confidence = 0;
  const result: ParsedReceipt = { confidence: 0, rawText: text };

  // 1. 가게명 추출 (보통 맨 위 1~3줄)
  result.storeName = extractStoreName(lines);
  if (result.storeName) confidence += 0.2;

  // 2. 날짜 추출
  result.date = extractDate(text);
  if (result.date) confidence += 0.2;

  // 3. 통화 감지
  result.currency = detectCurrency(text) || defaultCurrency;

  // 4. 총금액 추출
  result.totalAmount = extractAmount(text);
  if (result.totalAmount) confidence += 0.4;

  // 5. 카테고리 분류
  result.category = categorize(text);
  if (result.category !== 'other') confidence += 0.2;

  result.confidence = Math.min(confidence, 1);
  return result;
}

function extractStoreName(lines: string[]): string | undefined {
  if (lines.length === 0) return undefined;

  // 맨 위부터 탐색: 한글 또는 영문 이름이 있는 첫 줄
  const SKIP_KEYWORDS = ['영수증', '거래명세서', 'receipt', '주문서', 'order', 'invoice'];

  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    // 너무 짧거나 숫자만 있거나 skip 키워드면 통과
    if (line.length < 2 || line.length > 40) continue;
    if (/^\d+$/.test(line)) continue;
    if (SKIP_KEYWORDS.some(k => line.toLowerCase().includes(k))) continue;
    // 날짜 패턴은 통과
    if (DATE_PATTERNS.some(p => p.test(line))) continue;
    // 한글/영문/한자가 포함되어 있으면 가게명 후보
    if (/[가-힣a-zA-Z一-龥ぁ-んァ-ン]/.test(line)) {
      return line.slice(0, 40);
    }
  }
  return undefined;
}

function extractDate(text: string): string | undefined {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      let year = parseInt(match[1]);
      let month = parseInt(match[2]);
      let day = parseInt(match[3]);

      // YY → YYYY 보정
      if (year < 100) year += 2000;

      // MM/DD/YYYY 패턴 (미국식)
      if (year < 2000 && day > 2000) {
        [year, month, day] = [day, year, month];
      }

      if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }
  return undefined;
}

function extractAmount(text: string): number | undefined {
  // 1. 라인 단위 탐색 - 키워드 있는 라인 우선
  const lines = text.split('\n');
  type Candidate = { value: number; priority: number };
  const candidates: Candidate[] = [];

  // 높은 우선순위 = 합계/신용카드 키워드 + 같은 라인의 금액
  // 영수증은 오른쪽 정렬이라 라인 끝의 숫자가 금액
  const HIGH_PRIORITY_KEYWORDS = [
    /(?:합\s*계|총\s*액|총\s*금액|total|grand\s*total|결제\s*금액|총\s*결제)/i,
    /(?:신\s*용\s*카\s*드|credit\s*card|카\s*드\s*결\s*제)/i,
  ];
  const MID_PRIORITY_KEYWORDS = [
    /(?:지불|지급|받은\s*금액|payment|amount|sum)/i,
    /(?:사\s*용\s*금\s*액|금\s*액)/i,
  ];

  // 공백·쉼표 포함된 숫자 매칭 (2,300 / 2 300 / 2,300원)
  // OCR이 종종 콤마를 공백으로 오인식함
  const numberFromLine = (line: string, maxPosition?: number): number[] => {
    const scanText = maxPosition !== undefined ? line.slice(maxPosition) : line;
    const pattern = /(\d{1,3}(?:[,\s]\s*\d{3})+|\d{3,})/g;
    const nums: number[] = [];
    let m;
    while ((m = pattern.exec(scanText)) !== null) {
      const cleaned = m[1].replace(/[\s,]/g, '');
      const n = parseFloat(cleaned);
      if (!isNaN(n) && n >= 100 && n < 100_000_000) {
        nums.push(n);
      }
    }
    return nums;
  };

  for (const line of lines) {
    // 고우선순위 키워드
    for (const kw of HIGH_PRIORITY_KEYWORDS) {
      const m = line.match(kw);
      if (m) {
        const nums = numberFromLine(line, m.index! + m[0].length);
        if (nums.length > 0) {
          candidates.push({ value: Math.max(...nums), priority: 3 });
        }
      }
    }
    // 중우선순위 키워드
    for (const kw of MID_PRIORITY_KEYWORDS) {
      const m = line.match(kw);
      if (m) {
        const nums = numberFromLine(line, m.index! + m[0].length);
        if (nums.length > 0) {
          candidates.push({ value: Math.max(...nums), priority: 2 });
        }
      }
    }
  }

  // 키워드 매칭이 있으면 우선순위 → 값 내림차순 정렬 후 첫번째
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.priority - a.priority || b.value - a.value);
    return candidates[0].value;
  }

  // 2. 폴백: 모든 숫자 후보 중 합리적 범위 최대값
  const pattern = /(\d{1,3}(?:[,\s]\s*\d{3})+|\d{3,})/g;
  const allNumbers: number[] = [];
  let m;
  while ((m = pattern.exec(text)) !== null) {
    const cleaned = m[1].replace(/[\s,]/g, '');
    const n = parseFloat(cleaned);
    // 영수증 금액 합리적 범위: 100 ~ 1000만 (카드번호·승인번호 같은 큰 수 제외)
    if (!isNaN(n) && n >= 100 && n < 10_000_000) {
      allNumbers.push(n);
    }
  }

  if (allNumbers.length === 0) return undefined;

  // 영수증은 항목 수 × 단가 = 합계가 제일 크므로 최대값
  return Math.max(...allNumbers);
}

function detectCurrency(text: string): string | undefined {
  for (const [marker, code] of Object.entries(CURRENCY_MARKERS)) {
    if (text.includes(marker)) return code;
  }
  return undefined;
}

function categorize(text: string): ExpenseCategory {
  const lower = text.toLowerCase();

  // 가장 많이 매칭된 카테고리 선택
  let bestCategory: ExpenseCategory = 'other';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [ExpenseCategory, string[]][]) {
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        // 긴 키워드일수록 가점 (더 구체적)
        score += keyword.length >= 4 ? 2 : 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

// ============ 카테고리 메타데이터 ============
export const CATEGORY_INFO: Record<ExpenseCategory, { label: string; icon: string; color: string }> = {
  food:          { label: '식음료',  icon: '🍽️', color: '#FF6B6B' },
  transport:     { label: '교통',    icon: '🚇', color: '#4ECDC4' },
  accommodation: { label: '숙박',    icon: '🏨', color: '#A78BFA' },
  shopping:      { label: '쇼핑',    icon: '🛍️', color: '#F59E0B' },
  sightseeing:   { label: '관광',    icon: '🎭', color: '#10B981' },
  entertainment: { label: '놀이',    icon: '🎢', color: '#EC4899' },
  other:         { label: '기타',    icon: '📦', color: '#9CA3AF' },
};

// 테스트용 샘플
export const SAMPLE_RECEIPT_TEXTS = [
  `스타벅스 강남2호점
2026-04-19
아메리카노     4,500
라떼            5,800
총 합계       10,300원`,

  `セブンイレブン 渋谷店
2026/04/15
おにぎり    150
お茶        130
合計        280円`,

  `Hotel Tokyo Bay
April 18, 2026
Room 305
Total: ¥25,000`,
];
