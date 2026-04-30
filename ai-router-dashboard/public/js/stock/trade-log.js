// ============================================================
// trade-log.js — 거래 로그 (loadTradeLog)
// 원본 stock.js 라인 756-891 에서 분할 (모놀리식 정리)
// 모든 함수는 global scope (classic <script>) — 다른 파일에서 호출 가능
// ============================================================

// ===== 거래 로그 (trade_log 통합) =====
async function loadTradeLog() {
  const el = document.getElementById('quantTradeLog');
  if (!el) return;
  el.innerHTML = '<p style="color:var(--muted);font-size:0.82rem;padding:12px;">로딩 중...</p>';
  try {
    const res = await fetch('/api/trade4/log');
    const d = await res.json();
    const logs = d.logs || [];

    if (!logs.length) {
      el.innerHTML = '<p style="color:var(--muted);font-size:0.82rem;padding:12px;">거래 내역이 없습니다</p>';
      return;
    }

    // trade_type 배지 설정
    const typeConfig = {
      1: { label: '수동', color: '#a78bfa', bg: 'rgba(167,139,250,0.13)' },
      2: { label: '단순자동', color: '#fb923c', bg: 'rgba(251,146,60,0.13)' },
      3: { label: '완전자동', color: '#34d399', bg: 'rgba(52,211,153,0.13)' },
      4: { label: '일반자동', color: '#60a5fa', bg: 'rgba(96,165,250,0.13)' },
    };

    // action 라벨
    const actionMap = {
      BUY: '매수', SELL: '매도',
      SELL_PROFIT: '익절', SELL_PROFIT1: '1차익절', SELL_PROFIT2: '2차익절',
      SELL_LOSS: '손절', SELL_STOP: '손절', SELL_FACTOR: '팩터매도',
      SELL_MANUAL: '수동매도', SELL_STOP_ALL: '전체종료',
    };

    // status 배지
    const statusConfig = {
      active: { label: '보유중', color: '#f59e0b', bg: 'rgba(245,158,11,0.13)' },
      closed: { label: '종료', color: '#6b7280', bg: 'rgba(107,114,128,0.13)' },
    };

    // 타입 필터 탭 상태
    const filterId = 'tradeLogFilter';
    if (!el._filterType) el._filterType = 'all';

    const filterTypes = [
      { key: 'all', label: '전체' },
      { key: '1', label: '수동' },
      { key: '2', label: '단순자동' },
      { key: '3', label: '완전자동' },
      { key: '4', label: '일반자동' },
    ];

    const filtered = el._filterType === 'all'
      ? logs
      : logs.filter(l => String(l.trade_type) === el._filterType);

    const tabsHtml = filterTypes.map(ft => {
      const isActive = el._filterType === ft.key;
      const tc = typeConfig[parseInt(ft.key)];
      const activeColor = tc ? tc.color : '#E5E7EB';
      return `<button onclick="(function(){
        document.getElementById('quantTradeLog')._filterType=${_jsAttr(ft.key)};
        loadTradeLog();
      })()" style="
        padding:4px 12px;border-radius:999px;font-size:0.75rem;font-weight:700;cursor:pointer;border:none;
        background:${isActive ? (tc ? tc.bg : 'rgba(229,231,235,0.2)') : 'transparent'};
        color:${isActive ? activeColor : '#6B7280'};
        border:1px solid ${isActive ? activeColor : 'transparent'};
        transition:all 0.15s;
      ">${ft.label}</button>`;
    }).join('');

    const rowsHtml = filtered.slice(0, 50).map(l => {
      const isBuy = l.action === 'BUY';
      const isProfit = l.action.includes('PROFIT');
      const isLoss = l.action.includes('LOSS') || l.action.includes('STOP');
      const actionColor = isBuy ? '#60a5fa' : isProfit ? '#34d399' : isLoss ? '#f87171' : '#9CA3AF';

      const pnlVal = parseFloat(l.profit_pct || 0);
      const pnlColor = pnlVal > 0 ? '#34d399' : pnlVal < 0 ? '#f87171' : '#9CA3AF';
      const pnl = (l.profit_pct != null && l.profit_pct !== 0)
        ? `${pnlVal > 0 ? '+' : ''}${pnlVal.toFixed(2)}%` : '-';

      const tc = typeConfig[l.trade_type] || { label: '기타', color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' };
      const sc = statusConfig[l.status] || { label: l.status, color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' };

      const dt = new Date(l.created_at).toLocaleString('ko-KR', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      });

      return `<tr onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background=''">
        <td style="padding:8px 10px;border-bottom:1px solid #1E242C;font-size:0.75rem;color:#636366;white-space:nowrap;">${dt}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1E242C;font-weight:800;color:#E5E7EB;letter-spacing:0.03em;">${l.symbol}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1E242C;">
          <span style="padding:2px 7px;border-radius:4px;font-size:0.7rem;font-weight:700;background:${tc.bg};color:${tc.color};">${tc.label}</span>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #1E242C;">
          <span style="padding:2px 7px;border-radius:4px;font-size:0.75rem;font-weight:700;background:${actionColor}22;color:${actionColor};">${actionMap[l.action] || l.action}</span>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #1E242C;color:#E5E7EB;font-size:0.82rem;">${parseFloat(l.qty || 0)}주</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1E242C;color:#E5E7EB;font-size:0.82rem;">$${parseFloat(l.price || 0).toFixed(2)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1E242C;font-weight:700;color:${pnlColor};font-size:0.82rem;">${pnl}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #1E242C;">
          <span style="padding:2px 7px;border-radius:4px;font-size:0.7rem;font-weight:600;background:${sc.bg};color:${sc.color};">${sc.label}</span>
        </td>
      </tr>`;
    }).join('');

    el.innerHTML = _safeHTML(`
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;align-items:center;">
        ${tabsHtml}
        <span style="margin-left:auto;font-size:0.75rem;color:#636366;">${filtered.length}건</span>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
          <thead>
            <tr style="border-bottom:1px solid #2A2A2A;">
              <th style="padding:6px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;white-space:nowrap;">일시</th>
              <th style="padding:6px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">종목</th>
              <th style="padding:6px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">타입</th>
              <th style="padding:6px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">구분</th>
              <th style="padding:6px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">수량</th>
              <th style="padding:6px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">가격</th>
              <th style="padding:6px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">손익</th>
              <th style="padding:6px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">상태</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`);
  } catch (e) {
    el.innerHTML = _safeHTML(`<p style="color:#ef4444;font-size:0.82rem;padding:12px;">로드 실패: ${e.message}</p>`);
  }
}

// 종목 검색 팝업에서 선택 시 호가창도 자동 로드
// 종목 선택 시 호가창 로드 + 현재가 자동 설정


