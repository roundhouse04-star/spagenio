/**
 * 여행 회고 PDF/이미지 내보내기
 *
 * - expo-print: HTML → PDF 변환 후 디바이스 저장
 * - expo-sharing: 다른 앱(메일/카카오톡 등)으로 공유
 * - 디자인은 인앱 회고 화면을 단순화한 정적 HTML
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

interface RecapExportData {
  title: string;
  country?: string | null;
  city?: string | null;
  period: string;
  days: number;
  itemCount: number;
  logCount: number;
  totalSpent: number;
  currency: string;
  byCategory: { label: string; icon: string; total: number; pct: number }[];
  memo?: string | null;
}

function buildHtml(d: RecapExportData): string {
  const place = [d.country, d.city].filter(Boolean).join(' · ');
  const catRows = d.byCategory.map((c) => `
    <div class="cat-row">
      <span class="cat-icon">${c.icon}</span>
      <div class="cat-body">
        <div class="cat-line">
          <span class="cat-label">${c.label}</span>
          <span class="cat-value">${c.total.toLocaleString()} ${d.currency}</span>
        </div>
        <div class="cat-bar"><div class="cat-fill" style="width: ${c.pct}%"></div></div>
      </div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="utf-8">
      <style>
        @page { size: A4; margin: 24mm 18mm; }
        body { font-family: -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; color: #1E2A3A; }
        .eyebrow { color: #C9A96A; font-size: 11px; letter-spacing: 2.5px; font-weight: 700; }
        .title { font-size: 36px; font-weight: 800; letter-spacing: -1px; margin-top: 8px; }
        .place { color: #6B7280; font-size: 15px; margin-top: 4px; }
        .period { color: #6B7280; font-size: 13px; margin-top: 6px; }
        .divider { height: 1px; background: #E5E7EB; margin: 24px 0; }
        .num-grid { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
        .num-card { flex: 1; min-width: 120px; padding: 16px; background: #F5EFE4; border-radius: 12px; }
        .num-value { font-size: 30px; font-weight: 800; color: #1E2A3A; letter-spacing: -1px; }
        .num-unit { font-size: 11px; color: #6B7280; font-weight: 600; }
        .num-label { font-size: 11px; color: #6B7280; margin-top: 4px; }
        .section-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
        .cat-row { display: flex; gap: 12px; margin-bottom: 10px; align-items: center; }
        .cat-icon { font-size: 20px; width: 24px; }
        .cat-body { flex: 1; }
        .cat-line { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
        .cat-label { color: #1E2A3A; }
        .cat-value { color: #6B7280; font-weight: 700; }
        .cat-bar { height: 5px; background: #E5E7EB; border-radius: 3px; overflow: hidden; }
        .cat-fill { height: 100%; background: #1E2A3A; }
        .memo { font-size: 13px; line-height: 1.7; color: #374151; margin-top: 12px; }
        .footer { margin-top: 36px; font-size: 10px; color: #9CA3AF; text-align: center; letter-spacing: 1.5px; }
      </style>
    </head>
    <body>
      <div class="eyebrow">TRAVEL RECAP</div>
      <div class="title">${escapeHtml(d.title)}</div>
      ${place ? `<div class="place">${escapeHtml(place)}</div>` : ''}
      ${d.period ? `<div class="period">${escapeHtml(d.period)}</div>` : ''}

      <div class="divider"></div>

      <div class="num-grid">
        <div class="num-card">
          <div class="num-value">${d.days}</div>
          <div class="num-unit">일</div>
          <div class="num-label">여행 일수</div>
        </div>
        <div class="num-card">
          <div class="num-value">${d.itemCount}</div>
          <div class="num-unit">개</div>
          <div class="num-label">일정</div>
        </div>
        <div class="num-card">
          <div class="num-value">${d.logCount}</div>
          <div class="num-unit">개</div>
          <div class="num-label">기록</div>
        </div>
        <div class="num-card">
          <div class="num-value">${Math.round(d.totalSpent).toLocaleString()}</div>
          <div class="num-unit">${d.currency}</div>
          <div class="num-label">총 지출</div>
        </div>
      </div>

      ${d.byCategory.length > 0 ? `
        <div class="section-title">💰 카테고리별 지출</div>
        ${catRows}
      ` : ''}

      ${d.memo ? `
        <div class="divider"></div>
        <div class="section-title">📝 메모</div>
        <div class="memo">${escapeHtml(d.memo).replace(/\n/g, '<br>')}</div>
      ` : ''}

      <div class="footer">TRIPLIVE</div>
    </body>
    </html>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] ?? m));
}

export async function exportRecapAsPdf(data: RecapExportData): Promise<void> {
  try {
    const html = buildHtml(data);
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: '여행 회고 공유',
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('PDF 생성 완료', `파일이 저장됐습니다: ${uri}`);
    }
  } catch (err) {
    console.error('[recapExport] failed:', err);
    Alert.alert('내보내기 실패', '잠시 후 다시 시도해주세요.');
  }
}

/** 인쇄 전용 (PDF 저장 다이얼로그가 있는 OS는 거기서 PDF로 저장 가능) */
export async function printRecap(data: RecapExportData): Promise<void> {
  try {
    const html = buildHtml(data);
    await Print.printAsync({ html });
  } catch (err) {
    console.error('[recapExport] print failed:', err);
  }
}
