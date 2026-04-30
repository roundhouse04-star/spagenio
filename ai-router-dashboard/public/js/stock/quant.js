// ============================================================
// quant.js — 퀀트 분석 + 자동매매 설정
// 원본 stock.js 라인 892-1233 에서 분할 (모놀리식 정리)
// 모든 함수는 global scope (classic <script>) — 다른 파일에서 호출 가능
// ============================================================

// ===== datacollect.js — 자동매매 + 종목검색 =====
const QUANT_API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5002'
  : '/proxy/quant';

const signalStyle = {
  'buy': { label: '🟢 매수', color: 'var(--accent-2)' },
  'weak_buy': { label: '🔵 약매수', color: '#76a5ff' },
  'hold': { label: '⚪ 중립', color: 'var(--muted)' },
  'weak_sell': { label: '🟡 약매도', color: 'var(--warn)' },
  'sell': { label: '🔴 매도', color: 'var(--accent-danger, #ff8f8f)' }
};

async function runQuantAnalysis() {
  const symbol = document.getElementById('quantSymbol').value.trim().toUpperCase();
  const strategy = document.getElementById('quantStrategy').value;
  const el = document.getElementById('quantResult');
  if (!symbol) return;
  el.innerHTML = '<p style="color:var(--muted)">Analyzing...</p>';
  try {
    const res = await fetch(`${QUANT_API}/api/quant/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, strategy })
    });
    const data = await res.json();
    const sig = signalStyle[data.signal] || signalStyle['hold'];
    let html = `
      <div style="background:#161B22;border:1px solid #2A2A2A;border-radius:10px;padding:12px 14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:1rem;font-weight:800;color:#6366f1;cursor:pointer;text-decoration:underline;" data-action="openChart" data-args="${_jsAttr([data.symbol])}">${data.symbol} 📈</span>
          <span style="font-size:0.95rem;font-weight:700;color:${sig.color};">${sig.label}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px;">
          <div style="text-align:center;"><div style="color:#9CA3AF;font-size:0.75rem;">Current</div><div style="font-weight:700;font-size:0.88rem;">$${data.price?.toFixed(2) || '-'}</div></div>
          <div style="text-align:center;"><div style="color:#9CA3AF;font-size:0.75rem;">지표값</div><div style="font-weight:700;font-size:0.88rem;">${data.value?.toFixed(2) || data.score?.toFixed(4) || '-'}</div></div>
          <div style="text-align:center;"><div style="color:#9CA3AF;font-size:0.75rem;">전략</div><div style="font-weight:700;font-size:0.88rem;">${strategy.toUpperCase()}</div></div>
        </div>
        <div style="color:#9CA3AF;font-size:0.8rem;margin-bottom:4px;">${data.reason || ''}</div>
    `;
    if (data.details) {
      html += `<div style="margin-top:8px;display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">`;
      for (const [k, v] of Object.entries(data.details)) {
        const ds = signalStyle[v.signal] || signalStyle['hold'];
        html += `<div style="background:#0D1117;border-radius:8px;padding:8px 10px;">
          <div style="font-size:0.78rem;color:var(--muted);">${k}</div>
          <div style="font-weight:700;font-size:0.85rem;color:${ds.color};">${ds.label}</div>
          <div style="font-size:0.75rem;color:var(--muted);">${v.reason || ''}</div>
        </div>`;
      }
      html += `</div>`;
    }
    html += `
      `;  // 메일 버튼 제거됨
    html += `</div>`;
    // 결과 카드 표시
    const card = document.getElementById('quantResultCard');
    if (card) card.style.display = 'block';
    el.innerHTML = html;
    // 퀀트 지표 차트
    if (typeof renderQuantChart === 'function' && data.indicators) {
      renderQuantChart(document.getElementById('quantSymbol')?.value || '', data.indicators);
    }
    // 히스토리 자동 조회
    loadHistoryData();
  } catch (e) {
    el.innerHTML = _safeHTML(`<p style="color:var(--accent-danger, #ff8f8f)">Quant server connection failed (port 5002)</p>`);
  }
}


async function runBatchAnalysis() {
  const symbolsStr = document.getElementById('quantBatchSymbols').value.trim();
  const strategy = document.getElementById('quantBatchStrategy').value;
  const symbols = symbolsStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const el = document.getElementById('quantBatchResult');
  if (!symbols.length) return;

  // 5종목 초과 시 경고
  if (symbols.length > 5) {
    el.innerHTML = '<p style="color:#f59e0b;">⚠️ 최대 5종목까지 분석 가능합니다. 종목 수를 줄여주세요.</p>';
    return;
  }
  el.innerHTML = '<p style="color:var(--muted)">Analyzing... (Symbol 수에 따라 시간이 걸릴 수 있어요)</p>';
  try {
    const res = await fetch(`${QUANT_API}/api/quant/analyze/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols, strategy })
    });
    const data = await res.json();
    const rows = (data.results || []).map(r => {
      const sig = signalStyle[r.signal] || signalStyle['hold'];
      return `<tr>
        <td style="font-weight:700;color:#6366f1;cursor:pointer;" data-action="openChart" data-args="${_jsAttr([r.symbol])}">${r.symbol} 📈</td>
        <td style="color:${sig.color};font-weight:700;">${sig.label}</td>
        <td>$${r.price?.toFixed(2) || '-'}</td>
        <td>${r.value?.toFixed(2) || r.score?.toFixed(4) || '-'}</td>
        <td style="font-size:0.8rem;color:var(--muted);">${r.reason || r.error || '-'}</td>
      </tr>`;
    }).join('');
    el.innerHTML = _safeHTML(`<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
      <thead><tr style="color:var(--muted);font-size:0.82rem;">
        <th style="padding:8px;text-align:left;">Symbol</th>
        <th style="padding:8px;text-align:left;">신호</th>
        <th style="padding:8px;text-align:left;">Current</th>
        <th style="padding:8px;text-align:left;">지표값</th>
        <th style="padding:8px;text-align:left;">분석 내용</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`);
  } catch (e) {
    if (typeof renderBatchChart === 'function' && data.results) renderBatchChart(data.results);
    el.innerHTML = _safeHTML(`<p style="color:var(--accent-danger, #ff8f8f)">Quant server connection failed (port 5002)</p>`);
  }
}

async function loadKoreaAnalysis() {
  const el = document.getElementById('koreaResult');
  el.innerHTML = '<p style="color:var(--muted)">Fetching Korea market data...</p>';
  try {
    const res = await fetch(`${QUANT_API}/api/quant/korea`);
    const data = await res.json();
    if (data.error) { el.innerHTML = _safeHTML(`<p style="color:#ff8f8f;">Error: ${data.error}</p>`); return; }
    const rows = (data.top10 || []).map((item, i) => `<tr style="cursor:pointer;" data-action="openChart" data-args="${_jsAttr([item.ticker.includes('.') ? item.ticker : item.ticker + '.KS'])}" onmouseover="this.style.background='rgba(79,143,255,0.05)'" onmouseout="this.style.background=''">
      <td style="font-weight:700;color:#4f8fff;">${i + 1}</td>
      <td><div style="font-weight:700;">${item.name}</div><div style="color:#8E8E93;font-size:0.78rem;">${item.ticker}</div></td>
      <td>${item.price?.toLocaleString()}원</td>
      <td>${item.volume?.toLocaleString()}</td>
      <td>${item.short_ratio?.toFixed(2)}%</td>
      <td style="font-weight:700;color:#4f8fff;">${item.score?.toFixed(1)}</td>
    </tr>`).join('');
    el.innerHTML = _safeHTML(`<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
      <thead><tr style="color:var(--muted);font-size:0.82rem;">
        <th style="padding:8px;">순위</th><th style="padding:8px;text-align:left;">Symbol</th>
        <th style="padding:8px;">Current</th><th style="padding:8px;">Volume</th>
        <th style="padding:8px;">공매도비중</th><th style="padding:8px;">점수</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p style="color:#9CA3AF;font-size:0.78rem;margin-top:8px;">업데이트: ${data.updated_at?.slice(0, 19) || '-'}</p>`);
  } catch (e) {
    el.innerHTML = _safeHTML(`<p style="color:#ff8f8f;">퀀트 서버 연결 실패</p>`);
  }
}

// ===== 자동매매 설정 저장 =====
async function saveAutoTradeSettings(enabled) {
  const symbols = document.getElementById('atSymbols')?.value?.trim() || 'QQQ,SPY,AAPL';
  const balanceRatio = parseFloat(document.getElementById('atBalanceRatio')?.value || 10) / 100;
  const takeProfit = parseFloat(document.getElementById('atTakeProfit')?.value || 5) / 100;
  const stopLoss = parseFloat(document.getElementById('atStopLoss')?.value || 5) / 100;
  const signalMode = document.getElementById('atSignalMode')?.value || 'combined';
  const isEnabled = enabled !== undefined ? enabled : null;

  const body = { symbols, balance_ratio: balanceRatio, take_profit: takeProfit, stop_loss: stopLoss, signal_mode: signalMode, broker_key_id: window.selectedAccountId || window.activeAccountId || null };
  if (isEnabled !== null) body.enabled = isEnabled ? 1 : 0;

  const res = await fetch('/api/trade4/settings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const d = await res.json();
  if (d.ok) loadAutoTradeSettings();
}

window.toggleAutoTrade = async function (enable) {
  await saveAutoTradeSettings(enable);
  const el = document.getElementById('autoTradeResult');
  if (el) el.innerHTML = _safeHTML(`<div style="padding:10px 14px;border-radius:8px;background:${enable ? '#dcfce7' : '#fee2e2'};color:${enable ? '#065f46' : '#991b1b'};font-weight:700;font-size:0.88rem;margin-top:8px;">
    ${enable ? '✅ 자동매매 활성화됨 — 1분마다 신호 체크' : '⏹ 자동매매 비활성화됨'}
  </div>`);
};

window.runAutoTradeNow = async function () {
  const el = document.getElementById('autoTradeResult');
  el.innerHTML = '<div style="padding:10px;color:#6b7280;">🔍 분석 중...</div>';
  try {
    const res = await fetch('/api/trade4/run', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const d = await res.json();
    const resultHtml = d.results?.length
      ? d.results.map(r => `<div style="padding:6px 0;border-bottom:1px solid #f3f4f6;">
          <strong>${r.symbol}</strong> — ${r.action} ${r.qty ? r.qty + '주' : ''} ${r.profit || ''} ${r.reason ? '(' + r.reason + ')' : ''}
        </div>`).join('')
      : '<div style="color:#6b7280;">신호 없음 — 매매 조건 미충족</div>';
    el.innerHTML = _safeHTML(`<div style="padding:12px 14px;border-radius:8px;background:#f8fafc;border:1px solid #e5e7eb;margin-top:8px;">
      <div style="font-weight:700;margin-bottom:8px;">📊 분석 결과: ${d.message}</div>
      ${resultHtml}
    </div>`);
    loadAutoTradeLog();
  } catch (e) {
    el.innerHTML = _safeHTML(`<div style="color:#ef4444;padding:10px;">오류: ${e.message}</div>`);
  }
};

async function loadAutoTradeSettings() {
  try {
    const bkId = window.selectedAccountId || window.activeAccountId || '';
    const res = await fetch(`/api/trade4/settings${bkId ? '?broker_key_id=' + bkId : ''}`);
    const d = await res.json();
    if (document.getElementById('atSymbols')) document.getElementById('atSymbols').value = d.symbols || 'QQQ,SPY,AAPL';
    if (document.getElementById('atBalanceRatio')) document.getElementById('atBalanceRatio').value = Math.round((d.balance_ratio || 0.1) * 100);
    if (document.getElementById('atTakeProfit')) document.getElementById('atTakeProfit').value = Math.round((d.take_profit || 0.05) * 100);
    if (document.getElementById('atStopLoss')) document.getElementById('atStopLoss').value = Math.round((d.stop_loss || 0.05) * 100);
    if (document.getElementById('atSignalMode')) document.getElementById('atSignalMode').value = d.signal_mode || 'combined';
    const badge = document.getElementById('autoTradeStatusBadge');
    if (badge) {
      badge.textContent = d.enabled ? '✅ 활성' : '비활성';
      badge.style.background = d.enabled ? '#dcfce7' : '#f1f5f9';
      badge.style.color = d.enabled ? '#065f46' : '#6b7280';
    }
  } catch (e) { }
}

window.loadAutoPositions = async function () {
  const el = document.getElementById('autoPositionsList');
  const countEl = document.getElementById('autoPositionCount');
  if (!el) return;
  try {
    const res = await fetch('/api/trade4/positions');
    const d = await res.json();
    if (countEl) countEl.textContent = `(${d.total || 0}/3종목)`;
    if (!d.positions?.length) {
      el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:12px;font-size:0.85rem;">보유 중인 자동매매 종목 없음</div>';
      return;
    }
    el.innerHTML = d.positions.map(p => {
      const pl = parseFloat(p.unrealized_pl) || 0;
      const plPct = (parseFloat(p.unrealized_plpc) || 0) * 100;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:6px;">
        <div>
          <span style="font-weight:800;font-size:0.95rem;">${p.symbol}</span>
          <span style="font-size:0.78rem;color:#6b7280;margin-left:8px;">${p.qty}주 · $${parseFloat(p.current_price).toFixed(2)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-weight:700;color:${pl >= 0 ? '#065f46' : '#991b1b'};">${pl >= 0 ? '+' : ''}$${pl.toFixed(2)} (${plPct >= 0 ? '+' : ''}${plPct.toFixed(2)}%)</span>
          <button data-action="cancelAutoTrade" data-args="${_jsAttr([p.symbol])}" class="sp-btn sp-btn-red sp-btn-sm" style="font-size:0.75rem;padding:4px 10px;">취소</button>
        </div>
      </div>`;
    }).join('');
  } catch (e) { el.innerHTML = '<div style="color:#ef4444;padding:12px;">로드 실패</div>'; }
};

window.cancelAutoTrade = async function (symbol) {
  const ok = await spConfirm(`${symbol} 자동매매를 취소하고 포지션을 청산할까요?`, '포지션 청산', '⚠️', '청산', '#ef4444');
  if (!ok) return;
  try {
    const res = await fetch('/api/trade4/cancel/' + symbol, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const d = await res.json();
    if (d.ok) {
      await spAlert(`${symbol} 포지션 청산 완료!`, '청산 완료', '✅');
      loadAutoPositions();
      loadAutoTradeLog();
      loadPositions();
    } else {
      await spAlert('취소 실패: ' + (d.error || ''), '오류', '❌');
    }
  } catch (e) { await spAlert('오류: ' + e.message, '오류', '❌'); }
};

window.stopAllAutoTrade = async function () {
  const ok = await spConfirm('모든 자동매매 종목을 청산하고 자동매매를 종료할까요?', '전체 종료', '⚠️', '전체 종료', '#ef4444');
  if (!ok) return;
  try {
    const res = await fetch('/api/trade4/stop_all', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const d = await res.json();
    if (d.ok) {
      const msg = d.closed?.length ? `${d.closed.join(', ')} 청산 완료!` : '청산할 포지션 없음';
      await spAlert('자동매매 전체 종료! ' + msg, '종료 완료', '✅');
      loadAutoTradeSettings();
      loadAutoPositions();
      loadAutoTradeLog();
      loadPositions();
    }
  } catch (e) { await spAlert('오류: ' + e.message, '오류', '❌'); }
};

window.loadAutoTradeLog = async function () {
  const el = document.getElementById('autoTradeLog');
  if (!el) return;
  try {
    const res = await fetch('/api/trade4/log');
    const d = await res.json();
    if (!d.logs?.length) { el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:24px;">자동매매 이력이 없습니다</div>'; return; }
    const actionMap = { BUY: '매수', SELL_PROFIT: '익절 매도', SELL_LOSS: '손절 매도' };
    el.innerHTML = _safeHTML(`<table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
      <thead><tr style="border-bottom:2px solid #f3f4f6;color:#6b7280;font-weight:700;">
        <th style="padding:8px;text-align:left;">일시</th>
        <th style="padding:8px;text-align:center;">종목</th>
        <th style="padding:8px;text-align:center;">구분</th>
        <th style="padding:8px;text-align:center;">수량</th>
        <th style="padding:8px;text-align:center;">가격</th>
        <th style="padding:8px;text-align:center;">손익</th>
        <th style="padding:8px;text-align:left;">사유</th>
      </tr></thead><tbody>
      ${d.logs.map(l => {
      const isBuy = l.action === 'BUY';
      const isProfit = l.action === 'SELL_PROFIT';
      const isLoss = l.action === 'SELL_LOSS';
      const color = isBuy ? '#1e40af' : isProfit ? '#065f46' : '#991b1b';
      const bg = isBuy ? '#dbeafe' : isProfit ? '#dcfce7' : '#fee2e2';
      return `<tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:8px;font-size:0.78rem;">${new Date(l.created_at).toLocaleString('ko-KR')}</td>
          <td style="padding:8px;text-align:center;font-weight:700;">${l.symbol}</td>
          <td style="padding:8px;text-align:center;"><span style="padding:2px 8px;border-radius:999px;font-size:0.75rem;font-weight:700;background:${bg};color:${color}">${actionMap[l.action] || l.action}</span></td>
          <td style="padding:8px;text-align:center;">${l.qty}주</td>
          <td style="padding:8px;text-align:center;">$${parseFloat(l.price || 0).toFixed(2)}</td>
          <td style="padding:8px;text-align:center;font-weight:700;color:${isProfit ? '#065f46' : isLoss ? '#991b1b' : '#374151'}">${l.profit_pct ? (l.profit_pct > 0 ? '+' : '') + parseFloat(l.profit_pct).toFixed(2) + '%' : '-'}</td>
          <td style="padding:8px;font-size:0.78rem;color:#6b7280;">${l.reason || ''}</td>
        </tr>`;
    }).join('')}
      </tbody></table>`);
  } catch (e) { el.innerHTML = '<div style="color:#ef4444;padding:16px;">로드 실패</div>'; }
};

// 기존 runAutoTrade 호환성 유지
async function runAutoTrade() { await window.runAutoTradeNow(); }

async function loadQuantTradeLog() {
  const el = document.getElementById('quantTradeLog');
  try {
    const res = await fetch(`${QUANT_API}/api/quant/trade/log`);
    const data = await res.json();
    if (!data.logs?.length) { el.innerHTML = '<p style="color:var(--muted)">No trade history</p>'; return; }
    const rows = data.logs.map(log => `<tr>
      <td style="font-weight:700;">${log.symbol}</td>
      <td style="color:${log.side === 'buy' ? 'var(--accent-2)' : '#ff8f8f'};font-weight:700;">${log.side === 'buy' ? '매수' : '매도'}</td>
      <td>${log.qty}주</td>
      <td>$${log.price?.toFixed(2) || '-'}</td>
      <td style="color:#9CA3AF;font-size:0.8rem;">${log.strategy}</td>
      <td style="color:#9CA3AF;font-size:0.78rem;">${log.created_at?.slice(0, 16) || '-'}</td>
    </tr>`).join('');
    el.innerHTML = _safeHTML(`<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
      <thead><tr style="color:var(--muted);font-size:0.82rem;">
        <th style="padding:8px;text-align:left;">Symbol</th><th style="padding:8px;">방향</th>
        <th style="padding:8px;">Qty</th><th style="padding:8px;">가격</th>
        <th style="padding:8px;">전략</th><th style="padding:8px;">시간</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`);
  } catch (e) { }
}

