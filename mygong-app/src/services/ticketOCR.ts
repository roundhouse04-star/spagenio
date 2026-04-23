/**
 * 티켓 이미지 OCR 서비스 v3.
 *
 * v3 핵심: TextRecognitionScript.KOREAN 사용 → 한국어 정확도 대폭 향상!
 *
 * v2 개선사항 유지:
 *   • 한국 티켓 라벨 패턴 우선 매칭 (일시:, 장소:, 좌석:)
 *   • OCR 오인식 보정 (일→9, 토→E, 시→I 등)
 *   • 공백 분리된 한글 결합 ("일 시" → "일시")
 *   • 등급+좌석 조합 패턴 (R석 FLOOR층 A구역)
 *   • 더 똑똑한 제목 추출
 */

import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';

export type ExtractedTicketInfo = {
  rawText: string;
  title?: string;
  date?: string;
  time?: string;
  venue?: string;
  seat?: string;
  category?: string;
};

export async function extractTicketInfo(imageUri: string): Promise<ExtractedTicketInfo> {
  console.log('[ocr] start:', imageUri);

  // 한국어 모델로 OCR 실행 (라틴 모델보다 한글 정확도 훨씬 높음)
  const result = await TextRecognition.recognize(imageUri, TextRecognitionScript.KOREAN);
  const rawText = result.text || '';

  console.log('[ocr] ─── 원문 시작 ───');
  console.log(rawText);
  console.log('[ocr] ─── 원문 끝 ───');

  if (!rawText.trim()) {
    return { rawText };
  }

  // 1) OCR 오인식 보정 (한국어 모델이라도 가끔 오인식)
  const corrected = applyOcrCorrections(rawText);

  // 2) 공백으로 분리된 한글 키워드 결합
  const normalized = normalizeKoreanKeywords(corrected);

  console.log('[ocr] normalized:');
  console.log(normalized);

  const lines = normalized
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const info: ExtractedTicketInfo = {
    rawText,
    title:    parseTitle(lines, normalized),
    date:     parseDate(normalized),
    time:     parseTime(normalized),
    venue:    parseVenue(lines, normalized),
    seat:     parseSeat(normalized),
    category: parseCategory(normalized),
  };

  console.log('[ocr] parsed:', info);
  return info;
}

// ─── OCR 오인식 보정 ──────────────────────────────────────────
function applyOcrCorrections(text: string): string {
  let t = text;
  // "9시" → "일시" (라벨 컨텍스트일 때만)
  t = t.replace(/^9\s*시\s*[:：]/gm, '일시:');
  t = t.replace(/(^|\n)\s*9\s*시?\s*[:：]/g, '$1일시:');
  // 요일 오인식: (E) → (토), (g) → (일) 등
  t = t.replace(/(\d{1,2}일?)\s*\(\s*[Ee]\s*\)/g, '$1(토)');
  t = t.replace(/(\d{1,2}일?)\s*\(\s*[gq]\s*\)/g, '$1(일)');
  // 오후 시간 오인식: "2 6.00" → "오후 6:00"
  t = t.replace(/오후\s*\d?\s+(\d{1,2})[\.:](\d{2})/g, '오후 $1:$2');
  // 점을 콜론으로 (시간만): "6.00" → "6:00"
  t = t.replace(/\b(\d{1,2})\.(\d{2})\b/g, (_, h, m) => {
    const hi = parseInt(h, 10);
    if (hi >= 0 && hi < 24 && parseInt(m, 10) < 60) return `${h}:${m}`;
    return _;
  });
  return t;
}

// ─── 공백 분리 한글 키워드 결합 ──────────────────────────────
function normalizeKoreanKeywords(text: string): string {
  let t = text;
  t = t.replace(/일\s+시\s*[:：]/g, '일시:');
  t = t.replace(/장\s+소\s*[:：]/g, '장소:');
  t = t.replace(/좌\s+석\s*[:：]/g, '좌석:');
  t = t.replace(/공\s*연\s*명\s*[:：]/g, '공연명:');
  t = t.replace(/예\s*매\s*자\s*[:：]/g, '예매자:');
  return t;
}

// ─── 날짜 파싱 ─────────────────────────────────────────────────
function parseDate(text: string): string | undefined {
  // "일시: 2026년 04월 05일(일)" 가장 우선
  let m = text.match(/일시\s*[:：]?\s*(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;

  // "YYYY년 M월 D일"
  m = text.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;

  // "YYYY-MM-DD" / "YYYY.MM.DD" / "YYYY/MM/DD" — 단, 판매일자는 제외
  const lines = text.split('\n');
  for (const line of lines) {
    if (/판매일자/.test(line)) continue;
    const dm = line.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);
    if (dm) return `${dm[1]}-${pad2(dm[2])}-${pad2(dm[3])}`;
  }

  return undefined;
}

// ─── 시간 파싱 ─────────────────────────────────────────────────
function parseTime(text: string): string | undefined {
  // "오후 6:00" / "오전 11시 30분"
  let m = text.match(/(오전|오후|AM|PM)\s*(\d{1,2})\s*[:시]\s*(\d{0,2})\s*분?/i);
  if (m) {
    let h = parseInt(m[2], 10);
    const mm = (m[3] || '00').padStart(2, '0');
    if (/오후|PM/i.test(m[1]) && h < 12) h += 12;
    if (/오전|AM/i.test(m[1]) && h === 12) h = 0;
    return `${pad2(h)}:${mm}`;
  }

  // "19:00" / "19시 00분"
  m = text.match(/\b(\d{1,2})\s*[:시]\s*(\d{2})(?:\s*분)?/);
  if (m) {
    const h = parseInt(m[1], 10);
    if (h >= 0 && h < 24) return `${pad2(h)}:${m[2]}`;
  }

  return undefined;
}

// ─── 장소 파싱 ─────────────────────────────────────────────────
const VENUE_KEYWORDS = /(홀|센터|극장|돔|아레나|스타디움|경기장|구장|오페라하우스|아트센터|컨벤션|체육관|문화회관|대극장|소극장|콘서트홀|음악당|갤러리|미술관|박물관|핸드볼|야구장|경륜장|월드컵)/;

function parseVenue(lines: string[], full: string): string | undefined {
  // "장소: XXX" 가장 우선
  let m = full.match(/장소\s*[:：]\s*([^\n]+)/);
  if (m) {
    const v = m[1].trim();
    if (v.length > 0 && v.length < 80) return v;
  }

  // 키워드 포함 줄
  const candidates = lines.filter(l =>
    VENUE_KEYWORDS.test(l) &&
    l.length <= 60 &&
    !/예약번호|예매자|전화번호|금액|판매일자/.test(l)
  );

  if (candidates.length > 0) {
    const pure = candidates.find(l => !/\d{4}|\d{1,2}:\d{2}|\d+열|\d+번/.test(l));
    return (pure || candidates[0])
      .replace(/^장소\s*[:：]\s*/, '')
      .trim();
  }

  return undefined;
}

// ─── 좌석 파싱 ─────────────────────────────────────────────────
function parseSeat(text: string): string | undefined {
  // "좌석:" 라벨 우선
  let m = text.match(/좌석\s*[:：]?\s*([^\n]{3,50})/);
  if (m && /\d/.test(m[1])) {
    return m[1].trim();
  }

  // "FLOOR층 A구역 7열 10번" 같은 복합 패턴
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // "R석", "VIP석", "S석" 다음 줄이 좌석 정보일 가능성
    if (/^[A-Z가-힣]+석\s*$/.test(line) && i + 1 < lines.length) {
      const seatLine = lines[i + 1].trim();
      if (/(\d+층|\d+구역|[A-Z가-힣]+구역|\d+열|\d+번|FLOOR|BALCONY)/.test(seatLine)) {
        return seatLine;
      }
    }
    // 한 줄 통합 패턴
    if (/(FLOOR|BALCONY|\d+층).*(구역|블록).*\d+열.*\d+번/.test(line)) {
      return line;
    }
  }

  // 단순 "N열 N번"
  const simple = text.match(/([A-Z가-힣]+구역)?\s*\d+열\s*\d+번/);
  if (simple) return simple[0].trim();

  return undefined;
}

// ─── 제목 파싱 ─────────────────────────────────────────────────
function parseTitle(lines: string[], full: string): string | undefined {
  // "공연명:" 라벨 우선
  let m = full.match(/공연명\s*[:：]\s*(.+)/);
  if (m) return m[1].trim();

  // 메타 라인 (제외 대상)
  const metaPattern = /(예매|주문|티켓|일시|장소|좌석|가격|결제|바코드|QR|회차|SEAT|PRICE|FLOOR|BALCONY|예약번호|전화번호|금액|판매일자|VIP|구역|\d+열|\d+번|^\d+$|^\W+$|오전|오후|AM|PM|^[가-힣]석$|FLOOR층|영문|숫자만|어나더레이블|크림라이브)/i;

  const candidates = lines
    .filter(l => !metaPattern.test(l))
    .filter(l => {
      if (/\d{4}[.\-/년]/.test(l)) return false;
      if (/\d{1,2}[:시]\d{2}/.test(l)) return false;
      return true;
    })
    .filter(l => l.length >= 4 && l.length <= 80)
    .filter(l => {
      const koCount = (l.match(/[가-힣]/g) || []).length;
      const enCount = (l.match(/[A-Za-z]/g) || []).length;
      return koCount + enCount >= 4;
    });

  if (candidates.length === 0) return undefined;

  // 점수: 한글 + 영문 + 길이 + 키워드
  candidates.sort((a, b) => scoreTitle(b) - scoreTitle(a));
  return candidates[0];
}

function scoreTitle(line: string): number {
  let score = 0;
  const koCount = (line.match(/[가-힣]/g) || []).length;
  const enCount = (line.match(/[A-Za-z]/g) || []).length;
  score += koCount * 2;
  score += enCount;
  if (line.length >= 8 && line.length <= 30) score += 10;
  if (/(콘서트|투어|공연|Live|LIVE|TOUR|쇼케이스|팬미팅|페스티벌|꽃밭|월드투어)/.test(line)) score += 20;
  return score;
}

// ─── 카테고리 추측 ─────────────────────────────────────────────
function parseCategory(text: string): string | undefined {
  if (/(뮤지컬|MUSICAL)/i.test(text)) return '뮤지컬';
  if (/(연극|PLAY)/i.test(text)) return '연극';
  if (/(팬미팅|팬콘|쇼케이스|FANMEETING|SHOWCASE)/i.test(text)) return '팬미팅';
  if (/(페스티벌|페스|축제|FESTIVAL)/i.test(text)) return '페스티벌';
  if (/(전시|EXHIBITION)/i.test(text)) return '전시';
  if (/(콘서트|CONCERT|LIVE|투어|TOUR)/i.test(text)) return '콘서트';
  return undefined;
}

// ─── 유틸 ─────────────────────────────────────────────────────
function pad2(v: string | number): string {
  return String(v).padStart(2, '0');
}
