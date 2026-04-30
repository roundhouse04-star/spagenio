// ============================================================
// multi-account.js — Alpaca 다계좌 관리
// 원본 stock.js 라인 1654-1983 에서 분할 (모놀리식 정리)
// 모든 함수는 global scope (classic <script>) — 다른 파일에서 호출 가능
// ============================================================

// ===== Alpaca 다계좌 관리 =====
let activeAccountId = null; // 현재 Select된 계좌 ID

// ============================================================
// 거래량 급등 감지
// ============================================================
window.loadVolumeSurge = async function () {
  const el = document.getElementById('volumeSurgeList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:16px;font-size:0.85rem;">⏳ 조회 중...</div>';
  try {
    const res = await fetch('/api/trade4/volume_surge');
    const d = await res.json();
    if (!d.surges?.length) {
      el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:16px;font-size:0.85rem;">거래량 급등 종목 없음</div>';
      return;
    }
    el.innerHTML = d.surges.map(s => {
      const levelColor = s.surge_level === 'extreme' ? '#ef4444' : s.surge_level === 'high' ? '#f59e0b' : '#6366f1';
      const levelLabel = s.surge_level === 'extreme' ? '🔥 폭발' : s.surge_level === 'high' ? '⚡ 급등' : '📈 상승';
      const changeColor = s.change_pct >= 0 ? '#065f46' : '#991b1b';
      const changeBg = s.change_pct >= 0 ? '#dcfce7' : '#fee2e2';
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:8px;background:#fff;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="font-weight:800;font-size:1rem;">${s.symbol}</span>
              <span style="font-size:0.72rem;padding:2px 8px;border-radius:999px;background:${levelColor}20;color:${levelColor};font-weight:700;">${levelLabel}</span>
            </div>
            <div style="font-size:0.78rem;color:#6b7280;">
              오늘: <b>${s.today_volume?.toLocaleString()}</b> | 평균: ${s.avg_volume?.toLocaleString()}
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:1.1rem;font-weight:800;color:${levelColor};">${s.volume_ratio}x</div>
            <div style="font-size:0.78rem;font-weight:700;padding:2px 8px;border-radius:999px;background:${changeBg};color:${changeColor};">
              ${s.change_pct >= 0 ? '▲' : '▼'} ${Math.abs(s.change_pct)}%
            </div>
            <button data-action="quickRiskCalc" data-args="${_jsAttr([s.symbol])}" style="margin-top:4px;padding:3px 8px;font-size:0.72rem;background:#eef2ff;color:#6366f1;border:1px solid #c7d2fe;border-radius:6px;cursor:pointer;">리스크 계산</button>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = _safeHTML(`<div style="color:#ef4444;padding:12px;font-size:0.85rem;">조회 실패: ${e.message}</div>`);
  }
};

// ============================================================
// 뉴스 촉매 탐지
// ============================================================
window.loadNewsCatalyst = async function () {
  const el = document.getElementById('newsCatalystList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:16px;font-size:0.85rem;">⏳ 뉴스 분석 중...</div>';
  try {
    const res = await fetch('/api/trade4/news_catalyst');
    const d = await res.json();
    if (!d.catalysts?.length) {
      el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:16px;font-size:0.85rem;">관련 뉴스 없음</div>';
      return;
    }
    el.innerHTML = d.catalysts.map(c => `
      <div style="padding:10px 14px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:8px;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
          <span style="font-weight:800;font-size:0.95rem;color:#6366f1;">${c.symbol}</span>
          <span style="font-size:0.72rem;padding:2px 8px;border-radius:999px;background:#fef3c7;color:#92400e;font-weight:700;">📰 뉴스 ${c.news_count}건</span>
        </div>
        <div style="font-size:0.82rem;color:#374151;margin-bottom:4px;line-height:1.4;">${c.latest_title}</div>
        ${c.link ? `<a href="${c.link}" target="_blank" style="font-size:0.75rem;color:#6366f1;">↗ 원문 보기</a>` : ''}
      </div>`).join('');
  } catch (e) {
    el.innerHTML = _safeHTML(`<div style="color:#ef4444;padding:12px;font-size:0.85rem;">조회 실패: ${e.message}</div>`);
  }
};

// ============================================================
// 리스크 계산기
// ============================================================
window.quickRiskCalc = async function (symbol) {
  const riskSymbolEl = document.getElementById('riskSymbol');
  if (riskSymbolEl) riskSymbolEl.value = symbol;
  await calcRisk();
};

window.calcRisk = async function () {
  const symbol = document.getElementById('riskSymbol')?.value?.trim()?.toUpperCase();
  const stopLossPct = parseFloat(document.getElementById('riskStopLoss')?.value || 5) / 100;
  const riskRatio = parseFloat(document.getElementById('riskRatio')?.value || 2) / 100;
  const el = document.getElementById('riskResult');
  if (!symbol) { await spAlert('종목을 입력하세요.', '입력 오류', '⚠️'); return; }
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:12px;font-size:0.85rem;">⏳ 계산 중...</div>';
  try {
    const res = await fetch('/api/trade4/risk_calc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, stop_loss_pct: stopLossPct, risk_ratio: riskRatio })
    });
    const d = await res.json();
    if (!d.ok) { el.innerHTML = _safeHTML(`<div style="color:#ef4444;padding:12px;">${d.error}</div>`); return; }
    el.innerHTML = _safeHTML(`
      <div style="background:#f8fafc;border-radius:10px;padding:14px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div style="background:#fff;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:0.72rem;color:#6b7280;margin-bottom:4px;">현재가</div>
            <div style="font-size:1.1rem;font-weight:800;color:#111;">$${d.price?.toFixed(2)}</div>
          </div>
          <div style="background:#fff;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:0.72rem;color:#6b7280;margin-bottom:4px;">계좌 잔고</div>
            <div style="font-size:1.1rem;font-weight:800;color:#111;">$${d.balance?.toLocaleString('en', { maximumFractionDigits: 0 })}</div>
          </div>
          <div style="background:#dcfce7;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:0.72rem;color:#065f46;margin-bottom:4px;">추천 수량</div>
            <div style="font-size:1.3rem;font-weight:800;color:#065f46;">${d.qty}주</div>
          </div>
          <div style="background:#fee2e2;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:0.72rem;color:#991b1b;margin-bottom:4px;">리스크 금액</div>
            <div style="font-size:1.1rem;font-weight:800;color:#991b1b;">$${d.risk_amount?.toFixed(0)} (${d.risk_pct}%)</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <div style="flex:1;background:#fff;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:0.72rem;color:#6b7280;">손절가</div>
            <div style="font-weight:700;color:#ef4444;">$${d.stop_price}</div>
          </div>
          <div style="flex:1;background:#fff;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:0.72rem;color:#6b7280;">목표가 (2:1)</div>
            <div style="font-weight:700;color:#10b981;">$${d.take_profit_price}</div>
          </div>
          <div style="flex:1;background:#fff;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:0.72rem;color:#6b7280;">투자금액</div>
            <div style="font-weight:700;color:#6366f1;">$${d.total_cost?.toLocaleString('en', { maximumFractionDigits: 0 })}</div>
          </div>
        </div>
      </div>`);
  } catch (e) {
    el.innerHTML = _safeHTML(`<div style="color:#ef4444;padding:12px;">오류: ${e.message}</div>`);
  }
};

// ============================================================
// 오늘의 추천 종목 TOP 5
// ============================================================
window.loadTopPicks = async function () {
  const el = document.getElementById('topPicksList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:24px;font-size:0.85rem;">⏳ 분석 중... (10~20초 소요)</div>';
  try {

    const market = window._topPicksMarket || 'nasdaq';
    const res = await fetch(`/api/trade4/top_picks?market=${market}`);
    const d = await res.json();
    if (!d.ok) { el.innerHTML = _safeHTML(`<div style="color:#ef4444;padding:12px;">${d.error}</div>`); return; }
    if (!d.picks?.length) {
      el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:24px;">현재 조건에 맞는 추천 종목이 없습니다</div>';
      return;
    }

    el.innerHTML = _safeHTML(`
      <div style="font-size:0.75rem;color:#9ca3af;margin-bottom:12px;">총 ${d.total_analyzed}개 종목 분석 완료 · ${new Date().toLocaleTimeString('ko-KR')}</div>
      ${d.picks.map((p, i) => {
      const rankColors = ['#f59e0b', '#6b7280', '#cd7c32', '#6366f1', '#6366f1'];
      const rankLabels = ['🥇', '🥈', '🥉', '4위', '5위'];
      const changeColor = p.change_pct >= 0 ? '#065f46' : '#991b1b';
      const changeBg = p.change_pct >= 0 ? '#dcfce7' : '#fee2e2';
      const badges = [
        p.macd_cross ? '<span style="font-size:0.68rem;padding:2px 6px;border-radius:999px;background:#eef2ff;color:#6366f1;font-weight:700;">MACD✅</span>' : '',
        p.has_surge ? '<span style="font-size:0.68rem;padding:2px 6px;border-radius:999px;background:#fff7ed;color:#c2410c;font-weight:700;">거래량⚡</span>' : '',
        p.has_news ? '<span style="font-size:0.68rem;padding:2px 6px;border-radius:999px;background:#f0fdf4;color:#15803d;font-weight:700;">뉴스📰</span>' : '',
      ].filter(Boolean).join(' ');
      return `
          <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:8px;background:#fff;">
            <div style="font-size:1.4rem;width:32px;text-align:center;">${rankLabels[i]}</div>
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <span style="font-weight:800;font-size:1rem;">${p.symbol}</span>
                <span style="font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:999px;background:${rankColors[i]}20;color:${rankColors[i]};">점수 ${p.score}</span>
                ${badges}
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${p.signals.map(s => `<span style="font-size:0.72rem;color:#6b7280;">${s}</span>`).join(' · ')}
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:1rem;font-weight:800;">$${p.price?.toFixed(2)}</div>
              <div style="font-size:0.78rem;font-weight:700;padding:2px 8px;border-radius:999px;background:${changeBg};color:${changeColor};">
                ${p.change_pct >= 0 ? '▲' : '▼'} ${Math.abs(p.change_pct)}%
              </div>
              <button data-action="quickRiskCalc" data-args="${_jsAttr([p.symbol])}" style="margin-top:4px;padding:3px 8px;font-size:0.7rem;background:#eef2ff;color:#6366f1;border:1px solid #c7d2fe;border-radius:6px;cursor:pointer;">리스크 계산</button>
            </div>
          </div>`;
    }).join('')}`);
  } catch (e) {
    el.innerHTML = _safeHTML(`<div style="color:#ef4444;padding:12px;">오류: ${e.message}</div>`);
  }
};

// ============================================================
// 단순 자동매매 UI
// ============================================================
let _simpleTradeEnabled = false;
let _simpleTradeRefresh = null;

window.toggleSimpleAutoTrade = async function () {
  const btn = document.getElementById('simpleTradeToggleBtn');
  _simpleTradeEnabled = !_simpleTradeEnabled;

  // 설정 저장
  const balance_ratio = parseFloat(document.getElementById('simpleBalanceRatio')?.value || 30) / 100;
  const take_profit = parseFloat(document.getElementById('simpleTakeProfit')?.value || 5) / 100;
  const stop_loss = parseFloat(document.getElementById('simpleStopLoss')?.value || 5) / 100;

  const _bkId = window.selectedAccountId || window.activeAccountId || null;
  await fetch('/api/trade2/settings_save', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ balance_ratio, take_profit, stop_loss, broker_key_id: _bkId })
  });

  await fetch('/api/trade2/toggle', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: _simpleTradeEnabled, broker_key_id: _bkId })
  });

  updateSimpleTradeUI();
  loadSimpleTradeState();

  if (_simpleTradeEnabled) {
    _simpleTradeRefresh = setInterval(loadSimpleTradeState, 10000);
  } else {
    clearInterval(_simpleTradeRefresh);
  }
};

function updateSimpleTradeUI() {
  const btn = document.getElementById('simpleTradeToggleBtn');
  const badge = document.getElementById('simpleTradeStatusBadge');
  if (btn) {
    btn.textContent = _simpleTradeEnabled ? '⏹ 중지' : '▶ 시작';
    btn.style.background = _simpleTradeEnabled ? '#ef4444' : '';
  }
  if (badge) {
    badge.textContent = _simpleTradeEnabled ? '🟢 활성' : '비활성';
    badge.style.background = _simpleTradeEnabled ? '#dcfce7' : '#f1f5f9';
    badge.style.color = _simpleTradeEnabled ? '#065f46' : '#6b7280';
  }
}

window.loadSimpleTradeState = async function () {
  try {
    const _bkId2 = window.selectedAccountId || window.activeAccountId || '';
    const res = await fetch(`/api/trade2/state${_bkId2 ? '?broker_key_id=' + _bkId2 : ''}`);
    const d = await res.json();
    if (!d.ok) return;

    const state = d.state;
    const stateEl = document.getElementById('simpleTradeState');
    const logEl = document.getElementById('simpleTradeLog');

    // 상태 표시
    if (stateEl) {
      if (!state || !state.enabled) {
        stateEl.innerHTML = '<div style="text-align:center;color:#6b7280;font-size:0.85rem;">자동매매 비활성 상태입니다</div>';
      } else if (state.status === 'holding' && state.symbol) {
        stateEl.innerHTML = _safeHTML(`
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:0.75rem;color:#6b7280;margin-bottom:2px;">보유 중</div>
              <div style="font-size:1.2rem;font-weight:800;color:#6366f1;">${state.symbol}</div>
              <div style="font-size:0.82rem;color:#6b7280;">${state.qty}주 · 매수가 $${parseFloat(state.buy_price).toFixed(2)}</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:0.72rem;color:#6b7280;">익절/손절</div>
              <div style="font-size:0.88rem;font-weight:700;">+${Math.round((state.take_profit || 0.05) * 100)}% / -${Math.round((state.stop_loss || 0.05) * 100)}%</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:0.72rem;color:#6b7280;">강제청산</div>
              <div style="font-size:0.88rem;font-weight:700;color:#ef4444;">15:55 EST</div>
            </div>
          </div>`);
      } else if (state.status === 'analyzing') {
        stateEl.innerHTML = '<div style="text-align:center;color:#6366f1;font-size:0.85rem;">⏳ 종목 분석 중...</div>';
      } else {
        stateEl.innerHTML = '<div style="text-align:center;color:#6b7280;font-size:0.85rem;">🔍 매수 기회 탐색 중... (장 시간 대기)</div>';
      }

      // 활성화 상태 동기화
      if (state) {
        _simpleTradeEnabled = !!state.enabled;
        updateSimpleTradeUI();
        const br = document.getElementById('simpleBalanceRatio');
        const tp = document.getElementById('simpleTakeProfit');
        const sl = document.getElementById('simpleStopLoss');
        if (br) br.value = Math.round((state.balance_ratio || 0.3) * 100);
        if (tp) tp.value = Math.round((state.take_profit || 0.05) * 100);
        if (sl) sl.value = Math.round((state.stop_loss || 0.05) * 100);
      }
    }

    // 이력 표시
    if (logEl && d.logs?.length) {
      logEl.innerHTML = d.logs.map(l => {
        const isBuy = l.action === 'BUY';
        const color = isBuy ? '#065f46' : (l.profit_pct >= 0 ? '#1d4ed8' : '#991b1b');
        const bg = isBuy ? '#f0fdf4' : (l.profit_pct >= 0 ? '#eff6ff' : '#fef2f2');
        const icon = isBuy ? '🟢' : (l.profit_pct >= 0 ? '✅' : '🔴');
        const time = new Date(l.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-radius:8px;background:${bg};margin-bottom:4px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span>${icon}</span>
            <div>
              <span style="font-weight:700;color:${color};">${l.symbol}</span>
              <span style="font-size:0.75rem;color:#6b7280;margin-left:6px;">${l.qty}주 @ $${parseFloat(l.price).toFixed(2)}</span>
            </div>
          </div>
          <div style="text-align:right;">
            ${!isBuy ? `<div style="font-size:0.82rem;font-weight:700;color:${color};">${l.profit_pct >= 0 ? '+' : ''}${parseFloat(l.profit_pct).toFixed(2)}%</div>` : ''}
            <div style="font-size:0.72rem;color:#9ca3af;">${time}</div>
          </div>
        </div>`;
      }).join('');
    } else if (logEl) {
      logEl.innerHTML = '<div style="text-align:center;color:#6b7280;font-size:0.82rem;padding:12px;">이력 없음</div>';
    }
  } catch (e) { }
};

// 탭 진입 시 상태 로드
const _origSwitchQuantTab = window.switchQuantTab;


