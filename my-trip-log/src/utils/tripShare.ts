/**
 * 여행 일정 공유 — 직렬화/역직렬화
 *
 * 보내는 쪽 (사용자 A):
 *   exportTripForShare(tripId, { includeCost })
 *   → 압축된 Base64 문자열 반환
 *   → QR 코드 또는 Deep Link URL 에 임베드
 *
 * 받는 쪽 (사용자 B):
 *   parseSharedTrip(encoded)
 *   → SharedTripPayload 구조 반환
 *   importTripFromShare(payload, mode)
 *   → 새 여행으로 추가 또는 기존 여행에 일정 합치기
 *
 * ## 프라이버시 원칙
 *  공유 데이터에 절대 포함되지 않는 것:
 *  - 사용자 닉네임 / 이메일 / 디바이스 ID
 *  - 실제 사용 비용 (예산 budget 만 옵션 포함)
 *  - 영수증 사진
 *  - 일기 / 회고
 *  - GPS 좌표
 *
 *  공유 가능 데이터:
 *  - 여행 제목 / 날짜 / 도시
 *  - 일정 (시간 / 장소 텍스트 / 메모)
 *  - 카테고리
 *  - 예산 (사용자 토글 ON 시)
 *  - 일정별 예상 비용 (사용자 토글 ON 시)
 */
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

import { getTripById, createTrip } from '@/db/trips';
import { getTripItems, createTripItem } from '@/db/items';
import type { Trip, TripItem, TripItemCategory } from '@/types';

/** 공유 페이로드 버전 — 미래 호환성을 위해 v 필드 보존. */
const SHARED_PAYLOAD_VERSION = 1;

/** Deep Link 스키마. app.json 의 scheme 와 동일하게 유지. */
export const TRIPLIVE_IMPORT_SCHEME = 'triplive://import';

/**
 * QR 코드 1개에 안전하게 담을 수 있는 페이로드 최대 길이.
 * QR Version 40 (Error correction M) 기준 약 2,300자.
 * 한국어 일정 25개 + 비용 정보면 보통 1,500~2,000자.
 */
export const SHARED_PAYLOAD_MAX_LEN = 2300;

const ALLOWED_CATEGORIES: TripItemCategory[] = [
  'sightseeing', 'food', 'activity', 'accommodation', 'transport', 'shopping', 'other',
];

export interface SharedTripPayload {
  v: 1;
  trip: {
    title: string;
    country: string;
    city: string;
    startDate?: string | null;
    endDate?: string | null;
    budget?: number | null;
    currency: string;
  };
  items: Array<{
    day: number;
    time?: string;
    title: string;
    location?: string;
    category?: string;
    memo?: string;
    cost?: number | null;
  }>;
  meta: {
    sharedAt: string;        // ISO timestamp
    schema: 'triplive-trip';
  };
}

export interface ShareOptions {
  /** 예산 + 일정별 비용 포함 여부 */
  includeCost: boolean;
}

export interface SharedTripPreview {
  title: string;
  country: string;
  city: string;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number | null;
  currency: string;
  itemCount: number;
  daysCount: number;
  includesCost: boolean;
}

/**
 * 여행 + 일정을 압축된 문자열로 직렬화.
 * 결과를 QR 코드 또는 Deep Link URL 에 그대로 임베드 가능.
 */
export async function exportTripForShare(
  tripId: number,
  options: ShareOptions,
): Promise<string> {
  const trip = await getTripById(tripId);
  if (!trip) throw new Error('여행을 찾을 수 없어요');

  const items = await getTripItems(tripId);

  const payload: SharedTripPayload = {
    v: SHARED_PAYLOAD_VERSION,
    trip: {
      title: trip.title ?? '여행',
      country: trip.country ?? '',
      city: trip.city ?? '',
      startDate: trip.startDate ?? null,
      endDate: trip.endDate ?? null,
      budget: options.includeCost ? (trip.budget ?? null) : null,
      currency: trip.currency ?? 'KRW',
    },
    items: items.map((it) => ({
      day: Number(it.day) || 1,
      time: it.startTime || undefined,
      title: it.title || '제목 없음',
      location: it.location || undefined,
      category: it.category || undefined,
      memo: it.memo || undefined,
      cost: options.includeCost ? (it.cost ?? null) : null,
    })),
    meta: {
      sharedAt: new Date().toISOString(),
      schema: 'triplive-trip',
    },
  };

  const json = JSON.stringify(payload);
  return compressToEncodedURIComponent(json);
}

/**
 * 공유받은 문자열을 검증 후 페이로드로 복원.
 * 손상되거나 형식이 다르면 null 반환.
 */
export function parseSharedTrip(encoded: string): SharedTripPayload | null {
  if (!encoded || typeof encoded !== 'string') return null;

  // Deep Link 전체가 들어왔을 경우 d=... 파라미터 추출
  const trimmed = extractDataParam(encoded);

  let json: string | null;
  try {
    json = decompressFromEncodedURIComponent(trimmed);
  } catch {
    return null;
  }
  if (!json) return null;

  try {
    const parsed = JSON.parse(json) as unknown;
    if (!isValidPayload(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Deep Link URL 또는 raw payload 둘 다 받아서 payload 만 추출. */
function extractDataParam(input: string): string {
  // triplive://import?d=XXX  또는  https://...?d=XXX  형태 처리
  const idx = input.indexOf('d=');
  if (idx === -1) return input.trim();
  let rest = input.substring(idx + 2);
  // 뒤에 다른 query 가 붙어있으면 자르기
  const ampIdx = rest.indexOf('&');
  if (ampIdx !== -1) rest = rest.substring(0, ampIdx);
  return rest.trim();
}

function isValidPayload(p: unknown): p is SharedTripPayload {
  if (!p || typeof p !== 'object') return false;
  const obj = p as Record<string, unknown>;
  if (obj.v !== 1) return false;
  if (!obj.trip || typeof obj.trip !== 'object') return false;
  if (!Array.isArray(obj.items)) return false;
  const t = obj.trip as Record<string, unknown>;
  if (typeof t.title !== 'string') return false;
  return true;
}

/**
 * 공유받은 데이터의 미리보기 (가져오기 확인 모달에서 사용).
 */
export function getSharedTripPreview(payload: SharedTripPayload): SharedTripPreview {
  return {
    title: payload.trip.title,
    country: payload.trip.country,
    city: payload.trip.city,
    startDate: payload.trip.startDate,
    endDate: payload.trip.endDate,
    budget: payload.trip.budget,
    currency: payload.trip.currency,
    itemCount: payload.items.length,
    daysCount: calculateDays(payload.trip.startDate, payload.trip.endDate),
    includesCost:
      payload.trip.budget != null ||
      payload.items.some((it) => it.cost != null && it.cost > 0),
  };
}

function calculateDays(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(diff, 1);
}

export type ImportMode = 'new' | 'merge';

/**
 * 공유받은 페이로드를 로컬 DB 에 import.
 * @param mode 'new' = 새 여행으로 추가 / 'merge' = 기존 여행 ID 에 일정만 추가
 * @param targetTripId merge 모드일 때 필수
 */
export async function importTripFromShare(
  payload: SharedTripPayload,
  mode: ImportMode,
  targetTripId?: number,
): Promise<{ tripId: number; addedCount: number }> {
  let tripId: number;

  if (mode === 'new') {
    tripId = await createTrip({
      title: payload.trip.title,
      country: payload.trip.country,
      city: payload.trip.city,
      startDate: payload.trip.startDate ?? undefined,
      endDate: payload.trip.endDate ?? undefined,
      budget: payload.trip.budget ?? undefined,
      currency: payload.trip.currency || 'KRW',
      status: 'planning',
    });
  } else {
    if (!targetTripId) throw new Error('합칠 기존 여행을 선택해주세요');
    tripId = targetTripId;
  }

  let addedCount = 0;
  for (const item of payload.items) {
    try {
      const category = normalizeCategory(item.category);
      await createTripItem({
        tripId,
        day: item.day || 1,
        startTime: item.time || '',
        title: item.title || '제목 없음',
        location: item.location || '',
        category,
        memo: item.memo || '',
        cost: typeof item.cost === 'number' ? item.cost : 0,
        currency: payload.trip.currency || 'KRW',
      });
      addedCount++;
    } catch (err) {
      // 개별 항목 실패는 silent — 나머지 계속 진행
      console.error('[import 일정 저장 실패]', err, item);
    }
  }

  return { tripId, addedCount };
}

function normalizeCategory(raw: unknown): TripItemCategory {
  if (typeof raw === 'string' && (ALLOWED_CATEGORIES as string[]).includes(raw)) {
    return raw as TripItemCategory;
  }
  return 'other';
}

/**
 * 공유용 Deep Link URL 생성.
 * @param encoded exportTripForShare 결과
 */
export function buildShareLink(encoded: string): string {
  return `${TRIPLIVE_IMPORT_SCHEME}?d=${encoded}`;
}
