/**
 * 여행 일정 PDF 내보내기 + 공유
 *
 * Triplive 앱이 없는 친구한테도 카톡/이메일로 일정을 보낼 수 있도록.
 *
 * 출력 형식:
 *  - A4 세로 1페이지 또는 여러 페이지 (일정 많으면 자동 분할)
 *  - 흑백 + Triplive 워터마크
 *  - Day 별로 일정 정리 (시간 / 제목 / 장소 / 메모 / 비용 옵션)
 *
 * 호출 위치:
 *  - app/trip/[id]/share.tsx — "📄 PDF로 공유" 옵션
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

import type { Trip, TripItem } from '@/types';

export interface TripPdfOptions {
  /** 예상 비용 + 예산 포함 여부 (사용자 토글) */
  includeCost: boolean;
}

/**
 * 여행 + 일정을 PDF 로 생성하고 시스템 공유 시트 띄움.
 */
export async function exportTripScheduleAsPdf(
  trip: Trip,
  items: TripItem[],
  options: TripPdfOptions,
): Promise<void> {
  try {
    const html = buildScheduleHtml(trip, items, options);
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
      width: 595,   // A4 width @ 72dpi (595 x 842)
      height: 842,
    });

    const filename = `triplive-${sanitizeFilename(trip.title)}-${formatDate(new Date())}.pdf`;

    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${trip.title} 일정 공유`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('PDF 생성 완료', `파일이 저장됐습니다.\n${filename}`);
    }
  } catch (err) {
    console.error('[tripPdfExport] failed:', err);
    Alert.alert('PDF 만들기 실패', '잠시 후 다시 시도해주세요.');
  }
}

/** 미리보기 또는 인쇄 다이얼로그 직접 표시 */
export async function printTripSchedule(
  trip: Trip,
  items: TripItem[],
  options: TripPdfOptions,
): Promise<void> {
  try {
    const html = buildScheduleHtml(trip, items, options);
    await Print.printAsync({ html });
  } catch (err) {
    console.error('[tripPdfExport] print failed:', err);
  }
}

// ─── HTML 생성 ─────────────────────────────────────

function buildScheduleHtml(trip: Trip, items: TripItem[], options: TripPdfOptions): string {
  const itemsByDay = groupByDay(items);
  const totalDays = calculateDays(trip.startDate, trip.endDate);
  const totalCost = options.includeCost
    ? items.reduce((sum, it) => sum + (Number(it.cost) || 0), 0)
    : 0;
  const currency = trip.currency || 'KRW';

  const dayBlocks = Array.from(itemsByDay.entries())
    .sort(([a], [b]) => a - b)
    .map(([day, list]) => renderDay(day, list, options, currency, trip.startDate ?? null))
    .join('\n');

  return /* html */ `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(trip.title || '여행')} 일정</title>
<style>
  @page { size: A4; margin: 18mm 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo",
                 "Helvetica Neue", "Arial", sans-serif;
    color: #1E2A3A;
    line-height: 1.55;
    font-size: 11pt;
  }

  /* ─── 헤더 ─── */
  .brand {
    text-align: center;
    font-size: 9pt;
    color: #C9A96A;
    letter-spacing: 4px;
    font-weight: 600;
    margin-bottom: 4mm;
  }
  .title {
    text-align: center;
    font-size: 22pt;
    font-weight: 700;
    margin-bottom: 4mm;
    color: #1E2A3A;
  }
  .meta {
    text-align: center;
    font-size: 10pt;
    color: #5A6478;
    margin-bottom: 2mm;
  }
  .summary {
    text-align: center;
    font-size: 9pt;
    color: #8E96A6;
    margin-bottom: 8mm;
    padding-bottom: 8mm;
    border-bottom: 2px solid #C9A96A;
  }

  /* ─── Day 블록 ─── */
  .day-block {
    margin-bottom: 8mm;
    page-break-inside: avoid;
  }
  .day-header {
    background: #1E2A3A;
    color: #FAF8F3;
    padding: 3mm 4mm;
    border-radius: 4px;
    font-size: 12pt;
    font-weight: 700;
    margin-bottom: 3mm;
  }
  .day-date {
    font-size: 9pt;
    color: #C9A96A;
    margin-left: 6mm;
    font-weight: 400;
  }

  /* ─── 일정 카드 ─── */
  .item {
    display: table;
    width: 100%;
    margin-bottom: 4mm;
    padding-bottom: 4mm;
    border-bottom: 1px solid #E5E7EB;
    page-break-inside: avoid;
  }
  .item:last-child {
    border-bottom: none;
  }
  .item-time-cell {
    display: table-cell;
    width: 18mm;
    vertical-align: top;
    padding-right: 3mm;
  }
  .item-time {
    font-size: 11pt;
    font-weight: 700;
    color: #C9A96A;
  }
  .item-cat {
    display: block;
    font-size: 8pt;
    color: #8E96A6;
    margin-top: 1mm;
  }
  .item-body {
    display: table-cell;
    vertical-align: top;
  }
  .item-title {
    font-size: 11pt;
    font-weight: 600;
    color: #1E2A3A;
    margin-bottom: 1mm;
  }
  .item-location {
    font-size: 9pt;
    color: #5A6478;
    margin-bottom: 1mm;
  }
  .item-memo {
    font-size: 9pt;
    color: #5A6478;
    margin-top: 1mm;
    white-space: pre-wrap;
  }
  .item-cost {
    font-size: 9pt;
    color: #C9A96A;
    font-weight: 600;
    margin-top: 1mm;
  }

  /* ─── 푸터 ─── */
  .footer {
    margin-top: 10mm;
    padding-top: 4mm;
    border-top: 1px solid #E5E7EB;
    text-align: center;
    font-size: 8pt;
    color: #8E96A6;
  }
  .footer .brand-line {
    color: #C9A96A;
    font-weight: 600;
    letter-spacing: 2px;
    margin-bottom: 1mm;
  }
</style>
</head>
<body>
  <div class="brand">TRIPLIVE</div>
  <h1 class="title">${escapeHtml(trip.title || '여행')}</h1>

  ${trip.city || trip.country
    ? `<div class="meta">📍 ${escapeHtml([trip.city, trip.country].filter(Boolean).join(', '))}</div>`
    : ''}

  ${trip.startDate && trip.endDate
    ? `<div class="meta">📅 ${escapeHtml(trip.startDate)} ~ ${escapeHtml(trip.endDate)} (${totalDays}일)</div>`
    : ''}

  <div class="summary">
    📋 일정 ${items.length}개${
      options.includeCost && totalCost > 0
        ? ` · 💰 예상 ${totalCost.toLocaleString()} ${escapeHtml(currency)}`
        : ''
    }
  </div>

  ${dayBlocks || '<div style="text-align:center;color:#8E96A6;padding:20mm;">아직 등록된 일정이 없어요</div>'}

  <div class="footer">
    <div class="brand-line">TRIPLIVE · 여행 기록</div>
    <div>https://triplive.spagenio.com</div>
  </div>
</body>
</html>
`.trim();
}

function renderDay(
  day: number,
  list: TripItem[],
  options: TripPdfOptions,
  currency: string,
  tripStartDate: string | null,
): string {
  const date = computeDayDate(tripStartDate, day);
  const itemsHtml = list
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
    .map((it) => renderItem(it, options, currency))
    .join('\n');

  return `
<div class="day-block">
  <div class="day-header">
    Day ${day}${date ? `<span class="day-date">${escapeHtml(date)}</span>` : ''}
  </div>
  ${itemsHtml}
</div>
`;
}

function renderItem(item: TripItem, options: TripPdfOptions, currency: string): string {
  const time = item.startTime || '';
  const category = item.category ? categoryLabel(item.category) : '';
  return `
<div class="item">
  <div class="item-time-cell">
    <div class="item-time">${escapeHtml(time || '—')}</div>
    ${category ? `<span class="item-cat">${escapeHtml(category)}</span>` : ''}
  </div>
  <div class="item-body">
    <div class="item-title">${escapeHtml(item.title || '제목 없음')}</div>
    ${item.location ? `<div class="item-location">📍 ${escapeHtml(item.location)}</div>` : ''}
    ${item.memo ? `<div class="item-memo">${escapeHtml(item.memo)}</div>` : ''}
    ${
      options.includeCost && item.cost != null && Number(item.cost) > 0
        ? `<div class="item-cost">💰 ${Number(item.cost).toLocaleString()} ${escapeHtml(currency)}</div>`
        : ''
    }
  </div>
</div>
`;
}

// ─── 유틸 ─────────────────────────────────────

function groupByDay(items: TripItem[]): Map<number, TripItem[]> {
  const map = new Map<number, TripItem[]>();
  for (const it of items) {
    const day = Number(it.day) || 1;
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(it);
  }
  return map;
}

function calculateDays(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  return Math.max(Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1, 1);
}

/** trip 시작일 + (day-1) → "2026-05-18" 같은 날짜 문자열 반환 */
function computeDayDate(startDate: string | null, day: number): string {
  if (!startDate) return '';
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + (day - 1));
  return formatDate(d);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    sightseeing: '관광',
    food: '식사',
    activity: '체험',
    accommodation: '숙소',
    transport: '이동',
    shopping: '쇼핑',
    other: '기타',
  };
  return labels[cat] ?? '';
}

function sanitizeFilename(name: string): string {
  return (name || 'trip').replace(/[^\w가-힣\-_]/g, '_').slice(0, 32);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] ?? m),
  );
}
