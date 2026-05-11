/**
 * AI 답변 → 일정 JSON 견고한 파싱
 *
 * 사용자가 ChatGPT/Gemini/Claude 답변을 붙여넣을 때 흔히 발생하는
 * "약간 어긋난 JSON"을 자동 복구해서 앱이 에러나 크래시 없이 동작하도록.
 *
 * ## 처리하는 케이스
 * 1. 마크다운 코드블록 제거
 * 2. JSON 외 텍스트 무시 (첫 중괄호 ~ 마지막 중괄호 만 추출)
 * 3. trailing comma 자동 제거 (AI 가 가장 자주 하는 문법 오류)
 * 4. 라인 주석 및 블록 주석 제거
 * 5. 스마트 따옴표 → 일반 따옴표 변환
 * 6. 상위 키 다양성: items / schedule / itinerary / data / activities / days
 * 7. 각 항목 필드 alias: day/Day/dayNumber, title/name/activity, ...
 * 8. "1일차" 같은 문자열 → 숫자 추출
 * 9. null/undefined 항목은 기본값으로 채움 (저장 자체는 성공)
 */

export interface AiItineraryItem {
  day: number;
  startTime: string;
  title: string;
  location: string;
  category: string;
  memo: string;
  cost: number;
}

export interface ParsedAiItinerary {
  items: AiItineraryItem[];
}

export class AiJsonParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiJsonParseError';
  }
}

/**
 * AI 답변 텍스트를 견고하게 파싱.
 * 어떤 입력이 들어와도 throw 또는 정상 결과 둘 중 하나만 반환 (앱 크래시 X).
 */
export function parseAiItinerary(rawText: string): ParsedAiItinerary {
  if (!rawText || !rawText.trim()) {
    throw new AiJsonParseError('답변이 비어있어요. AI 답변을 붙여넣어주세요.');
  }

  // ─── 1. 마크다운 코드블록 제거 ─────────────────
  let cleaned = rawText
    .replace(/```json/gi, '')
    .replace(/```javascript/gi, '')
    .replace(/```/g, '')
    .trim();

  // ─── 2. JSON 추출 (첫 { ~ 마지막 } 또는 첫 [ ~ 마지막 ]) ──
  const objStart = cleaned.indexOf('{');
  const objEnd = cleaned.lastIndexOf('}');
  const arrStart = cleaned.indexOf('[');
  const arrEnd = cleaned.lastIndexOf(']');

  // 객체 우선, 객체 없으면 배열, 둘 다 없으면 실패
  if (objStart !== -1 && objEnd !== -1 && objStart < objEnd) {
    cleaned = cleaned.substring(objStart, objEnd + 1);
  } else if (arrStart !== -1 && arrEnd !== -1 && arrStart < arrEnd) {
    cleaned = cleaned.substring(arrStart, arrEnd + 1);
  } else {
    throw new AiJsonParseError(
      'JSON 형식을 찾을 수 없어요.\n\nAI 답변에 "{ }" 또는 "[ ]"가 포함됐는지 확인해주세요.\n\n팁: AI에게 "JSON 형식으로만 답해줘"라고 다시 요청해보세요.'
    );
  }

  // ─── 3. 주석 제거 (AI 가 친절하려고 // 추가하는 경우) ─
  // 블록 주석 (/star ... star/ 형태) 제거
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  // 라인 주석 (// ...) 제거 — URL 의 //(http://) 는 보존
  cleaned = cleaned.replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');

  // ─── 4. trailing comma 제거 ─────────────────
  // 객체나 배열 마지막 쉼표 제거 (가장 흔한 AI 실수)
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  // ─── 5. 스마트 따옴표 → 일반 따옴표 ────────────
  cleaned = cleaned
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'");

  // ─── 6. JSON.parse 시도 ───────────────────
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const msg = (err as Error).message;
    throw new AiJsonParseError(
      `JSON 문법이 잘못됐어요:\n${msg}\n\n팁: AI에게 "JSON 형식으로만, 주석/설명 없이 답해줘"라고 다시 요청해보세요.`
    );
  }

  // ─── 7. items 배열 찾기 (다양한 키 시도) ────────
  const itemsArray = extractItemsArray(parsed);

  if (!itemsArray || itemsArray.length === 0) {
    throw new AiJsonParseError(
      '일정 배열을 찾을 수 없어요.\n\nAI 답변에 일정 항목이 포함됐는지 확인해주세요.\n\n팁: AI에게 \'items 키에 일정 배열로 답해줘\'라고 명시해보세요.'
    );
  }

  // ─── 8. 각 item 정규화 (필드명 alias) ──────────
  const items: AiItineraryItem[] = itemsArray.map(normalizeItem);

  return { items };
}

/**
 * 다양한 키 이름에서 items 배열 추출
 */
function extractItemsArray(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed; // 최상위가 배열

  if (!parsed || typeof parsed !== 'object') return null;

  const obj = parsed as Record<string, unknown>;

  // 직접 키 시도
  const directKeys = ['items', 'schedule', 'itinerary', 'data', 'activities', 'list'];
  for (const key of directKeys) {
    const value = obj[key];
    if (Array.isArray(value)) return value;
  }

  // days 배열 (각 day 안에 items 가 있는 형태)
  const days = obj.days || obj.daySchedule || obj.daily;
  if (Array.isArray(days)) {
    const flat: unknown[] = [];
    for (const day of days) {
      if (day && typeof day === 'object') {
        const d = day as Record<string, unknown>;
        const dayItems =
          (Array.isArray(d.items) && d.items) ||
          (Array.isArray(d.activities) && d.activities) ||
          (Array.isArray(d.schedule) && d.schedule);
        if (dayItems) {
          for (const it of dayItems) {
            if (it && typeof it === 'object') {
              // day 정보가 부모에 있으면 자식에 주입
              const dayNum = d.day ?? d.dayNumber ?? d.day_number;
              if (dayNum !== undefined && (it as Record<string, unknown>).day === undefined) {
                (it as Record<string, unknown>).day = dayNum;
              }
              flat.push(it);
            }
          }
        }
      }
    }
    if (flat.length > 0) return flat;
  }

  return null;
}

/**
 * 개별 일정 항목 정규화 (필드명 alias + 타입 보정)
 */
function normalizeItem(rawItem: unknown): AiItineraryItem {
  if (!rawItem || typeof rawItem !== 'object') {
    return defaultItem();
  }

  const r = rawItem as Record<string, unknown>;

  return {
    day: toNumber(r.day ?? r.Day ?? r.dayNumber ?? r.day_number ?? r.dayIndex ?? 1) || 1,
    startTime: toStr(r.startTime ?? r.start_time ?? r.time ?? r.start ?? r.hour ?? ''),
    title: toStr(r.title ?? r.name ?? r.activity ?? r.item ?? '제목 없음') || '제목 없음',
    location: toStr(r.location ?? r.place ?? r.address ?? r.where ?? r.spot ?? ''),
    category: toStr(r.category ?? r.type ?? r.kind ?? r.tag ?? ''),
    memo: toStr(r.memo ?? r.note ?? r.notes ?? r.description ?? r.detail ?? r.desc ?? ''),
    cost: toNumber(r.cost ?? r.price ?? r.expense ?? r.budget ?? 0),
  };
}

function defaultItem(): AiItineraryItem {
  return {
    day: 1,
    startTime: '',
    title: '제목 없음',
    location: '',
    category: '',
    memo: '',
    cost: 0,
  };
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function toNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    // "1일차", "10,000원", "$50" 같은 문자열에서 숫자 추출
    const match = v.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    if (match) {
      const n = Number(match[0]);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}
