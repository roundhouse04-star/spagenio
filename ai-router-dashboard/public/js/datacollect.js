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
      <div style="background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:12px 14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:1rem;font-weight:800;color:#6366f1;cursor:pointer;text-decoration:underline;" onclick="openChart('${data.symbol}')">${data.symbol} 📈</span>
          <span style="font-size:0.95rem;font-weight:700;color:${sig.color};">${sig.label}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px;">
          <div style="text-align:center;"><div style="color:var(--muted);font-size:0.75rem;">Current</div><div style="font-weight:700;font-size:0.88rem;">$${data.price?.toFixed(2) || '-'}</div></div>
          <div style="text-align:center;"><div style="color:var(--muted);font-size:0.75rem;">지표값</div><div style="font-weight:700;font-size:0.88rem;">${data.value?.toFixed(2) || data.score?.toFixed(4) || '-'}</div></div>
          <div style="text-align:center;"><div style="color:var(--muted);font-size:0.75rem;">전략</div><div style="font-weight:700;font-size:0.88rem;">${strategy.toUpperCase()}</div></div>
        </div>
        <div style="color:var(--muted);font-size:0.8rem;margin-bottom:4px;">${data.reason || ''}</div>
    `;
    if (data.details) {
      html += `<div style="margin-top:8px;display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">`;
      for (const [k, v] of Object.entries(data.details)) {
        const ds = signalStyle[v.signal] || signalStyle['hold'];
        html += `<div style="background:var(--bg);border-radius:8px;padding:8px 10px;">
          <div style="font-size:0.78rem;color:var(--muted);">${k}</div>
          <div style="font-weight:700;font-size:0.85rem;color:${ds.color};">${ds.label}</div>
          <div style="font-size:0.75rem;color:var(--muted);">${v.reason || ''}</div>
        </div>`;
      }
      html += `</div>`;
    }
    html += `
      <div style="margin-top:10px;text-align:right;">
        <button id="quant-mail-btn"
          onclick='sendQuantResultMail(${JSON.stringify({symbol:data.symbol,signal:data.signal,price:data.price,value:data.value,reason:data.reason,strategy,indicators:data.indicators})})'
          style="padding:6px 14px;background:#6366f1;color:#fff;border:none;border-radius:7px;font-size:0.82rem;font-weight:700;cursor:pointer;">
          📧 메일로 받기
        </button>
      </div>`;
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
    el.innerHTML = `<p style="color:var(--accent-danger, #ff8f8f)">Quant server connection failed (port 5002)</p>`;
  }
}

async function sendQuantResultMail(data) {
  const btn = document.getElementById('quant-mail-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 발송 중...'; }
  try {
    const res = await fetch('/api/mail/quant-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.ok) {
      if (btn) btn.textContent = '✅ 발송 완료!';
      setTimeout(() => { if (btn) { btn.textContent = '📧 메일로 받기'; btn.disabled = false; } }, 3000);
    } else {
      if (btn) btn.textContent = '❌ ' + (result.error || '실패');
      setTimeout(() => { if (btn) { btn.textContent = '📧 메일로 받기'; btn.disabled = false; } }, 3000);
    }
  } catch(e) {
    if (btn) btn.textContent = '❌ 오류';
    setTimeout(() => { if (btn) { btn.textContent = '📧 메일로 받기'; btn.disabled = false; } }, 3000);
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
        <td style="font-weight:700;color:#6366f1;cursor:pointer;" onclick="openChart('${r.symbol}')">${r.symbol} 📈</td>
        <td style="color:${sig.color};font-weight:700;">${sig.label}</td>
        <td>$${r.price?.toFixed(2) || '-'}</td>
        <td>${r.value?.toFixed(2) || r.score?.toFixed(4) || '-'}</td>
        <td style="font-size:0.8rem;color:var(--muted);">${r.reason || r.error || '-'}</td>
      </tr>`;
    }).join('');
    el.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
      <thead><tr style="color:var(--muted);font-size:0.82rem;">
        <th style="padding:8px;text-align:left;">Symbol</th>
        <th style="padding:8px;text-align:left;">신호</th>
        <th style="padding:8px;text-align:left;">Current</th>
        <th style="padding:8px;text-align:left;">지표값</th>
        <th style="padding:8px;text-align:left;">분석 내용</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  } catch (e) {
    if (typeof renderBatchChart === 'function' && data.results) renderBatchChart(data.results);
    el.innerHTML = `<p style="color:var(--accent-danger, #ff8f8f)">Quant server connection failed (port 5002)</p>`;
  }
}

async function loadKoreaAnalysis() {
  const el = document.getElementById('koreaResult');
  el.innerHTML = '<p style="color:var(--muted)">Fetching Korea market data...</p>';
  try {
    const res = await fetch(`${QUANT_API}/api/quant/korea`);
    const data = await res.json();
    if (data.error) { el.innerHTML = `<p style="color:#ff8f8f;">Error: ${data.error}</p>`; return; }
    const rows = (data.top10 || []).map((item, i) => `<tr>
      <td style="font-weight:700;color:var(--accent);">${i + 1}</td>
      <td><div style="font-weight:700;">${item.name}</div><div style="color:var(--muted);font-size:0.78rem;">${item.ticker}</div></td>
      <td>${item.price?.toLocaleString()}원</td>
      <td>${item.volume?.toLocaleString()}</td>
      <td>${item.short_ratio?.toFixed(2)}%</td>
      <td style="font-weight:700;color:var(--accent-2);">${item.score?.toFixed(1)}</td>
    </tr>`).join('');
    el.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
      <thead><tr style="color:var(--muted);font-size:0.82rem;">
        <th style="padding:8px;">순위</th><th style="padding:8px;text-align:left;">Symbol</th>
        <th style="padding:8px;">Current</th><th style="padding:8px;">Volume</th>
        <th style="padding:8px;">공매도비중</th><th style="padding:8px;">점수</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p style="color:var(--muted);font-size:0.78rem;margin-top:8px;">업데이트: ${data.updated_at?.slice(0, 19) || '-'}</p>`;
  } catch (e) {
    el.innerHTML = `<p style="color:#ff8f8f;">퀀트 서버 연결 실패</p>`;
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

  const body = { symbols, balance_ratio: balanceRatio, take_profit: takeProfit, stop_loss: stopLoss, signal_mode: signalMode };
  if (isEnabled !== null) body.enabled = isEnabled ? 1 : 0;

  const res = await fetch('/api/auto-trade/settings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const d = await res.json();
  if (d.ok) loadAutoTradeSettings();
}

window.toggleAutoTrade = async function(enable) {
  await saveAutoTradeSettings(enable);
  const el = document.getElementById('autoTradeResult');
  if (el) el.innerHTML = `<div style="padding:10px 14px;border-radius:8px;background:${enable?'#dcfce7':'#fee2e2'};color:${enable?'#065f46':'#991b1b'};font-weight:700;font-size:0.88rem;margin-top:8px;">
    ${enable ? '✅ 자동매매 활성화됨 — 1분마다 신호 체크' : '⏹ 자동매매 비활성화됨'}
  </div>`;
};

window.runAutoTradeNow = async function() {
  const el = document.getElementById('autoTradeResult');
  el.innerHTML = '<div style="padding:10px;color:#6b7280;">🔍 분석 중...</div>';
  try {
    const res = await fetch('/api/auto-trade/run', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const d = await res.json();
    const resultHtml = d.results?.length
      ? d.results.map(r => `<div style="padding:6px 0;border-bottom:1px solid #f3f4f6;">
          <strong>${r.symbol}</strong> — ${r.action} ${r.qty ? r.qty+'주' : ''} ${r.profit||''} ${r.reason?'('+r.reason+')':''}
        </div>`).join('')
      : '<div style="color:#6b7280;">신호 없음 — 매매 조건 미충족</div>';
    el.innerHTML = `<div style="padding:12px 14px;border-radius:8px;background:#f8fafc;border:1px solid #e5e7eb;margin-top:8px;">
      <div style="font-weight:700;margin-bottom:8px;">📊 분석 결과: ${d.message}</div>
      ${resultHtml}
    </div>`;
    loadAutoTradeLog();
  } catch(e) {
    el.innerHTML = `<div style="color:#ef4444;padding:10px;">오류: ${e.message}</div>`;
  }
};

async function loadAutoTradeSettings() {
  try {
    const res = await fetch('/api/auto-trade/settings');
    const d = await res.json();
    if (document.getElementById('atSymbols')) document.getElementById('atSymbols').value = d.symbols || 'QQQ,SPY,AAPL';
    if (document.getElementById('atBalanceRatio')) document.getElementById('atBalanceRatio').value = Math.round((d.balance_ratio||0.1)*100);
    if (document.getElementById('atTakeProfit')) document.getElementById('atTakeProfit').value = Math.round((d.take_profit||0.05)*100);
    if (document.getElementById('atStopLoss')) document.getElementById('atStopLoss').value = Math.round((d.stop_loss||0.05)*100);
    if (document.getElementById('atSignalMode')) document.getElementById('atSignalMode').value = d.signal_mode || 'combined';
    const badge = document.getElementById('autoTradeStatusBadge');
    if (badge) {
      badge.textContent = d.enabled ? '✅ 활성' : '비활성';
      badge.style.background = d.enabled ? '#dcfce7' : '#f1f5f9';
      badge.style.color = d.enabled ? '#065f46' : '#6b7280';
    }
  } catch(e) {}
}

window.loadAutoPositions = async function() {
  const el = document.getElementById('autoPositionsList');
  const countEl = document.getElementById('autoPositionCount');
  if (!el) return;
  try {
    const res = await fetch('/api/auto-trade/positions');
    const d = await res.json();
    if (countEl) countEl.textContent = `(${d.total||0}/3종목)`;
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
          <span style="font-weight:700;color:${pl>=0?'#065f46':'#991b1b'};">${pl>=0?'+':''}$${pl.toFixed(2)} (${plPct>=0?'+':''}${plPct.toFixed(2)}%)</span>
          <button onclick="cancelAutoTrade('${p.symbol}')" class="sp-btn sp-btn-red sp-btn-sm" style="font-size:0.75rem;padding:4px 10px;">취소</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) { el.innerHTML = '<div style="color:#ef4444;padding:12px;">로드 실패</div>'; }
};

window.cancelAutoTrade = async function(symbol) {
  const ok = await spConfirm(`${symbol} 자동매매를 취소하고 포지션을 청산할까요?`, '포지션 청산', '⚠️', '청산', '#ef4444');
  if (!ok) return;
  try {
    const res = await fetch('/api/auto-trade/cancel/' + symbol, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const d = await res.json();
    if (d.ok) {
      await spAlert(`${symbol} 포지션 청산 완료!`, '청산 완료', '✅');
      loadAutoPositions();
      loadAutoTradeLog();
      loadPositions();
    } else {
      await spAlert('취소 실패: ' + (d.error || ''), '오류', '❌');
    }
  } catch(e) { await spAlert('오류: ' + e.message, '오류', '❌'); }
};

window.stopAllAutoTrade = async function() {
  const ok = await spConfirm('모든 자동매매 종목을 청산하고 자동매매를 종료할까요?', '전체 종료', '⚠️', '전체 종료', '#ef4444');
  if (!ok) return;
  try {
    const res = await fetch('/api/auto-trade/stop-all', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const d = await res.json();
    if (d.ok) {
      const msg = d.closed?.length ? `${d.closed.join(', ')} 청산 완료!` : '청산할 포지션 없음';
      await spAlert('자동매매 전체 종료! ' + msg, '종료 완료', '✅');
      loadAutoTradeSettings();
      loadAutoPositions();
      loadAutoTradeLog();
      loadPositions();
    }
  } catch(e) { await spAlert('오류: ' + e.message, '오류', '❌'); }
};

window.loadAutoTradeLog = async function() {
  const el = document.getElementById('autoTradeLog');
  if (!el) return;
  try {
    const res = await fetch('/api/auto-trade/log');
    const d = await res.json();
    if (!d.logs?.length) { el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:24px;">자동매매 이력이 없습니다</div>'; return; }
    const actionMap = { BUY:'매수', SELL_PROFIT:'익절 매도', SELL_LOSS:'손절 매도' };
    el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
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
          <td style="padding:8px;text-align:center;"><span style="padding:2px 8px;border-radius:999px;font-size:0.75rem;font-weight:700;background:${bg};color:${color}">${actionMap[l.action]||l.action}</span></td>
          <td style="padding:8px;text-align:center;">${l.qty}주</td>
          <td style="padding:8px;text-align:center;">$${parseFloat(l.price||0).toFixed(2)}</td>
          <td style="padding:8px;text-align:center;font-weight:700;color:${isProfit?'#065f46':isLoss?'#991b1b':'#374151'}">${l.profit_pct ? (l.profit_pct>0?'+':'')+parseFloat(l.profit_pct).toFixed(2)+'%' : '-'}</td>
          <td style="padding:8px;font-size:0.78rem;color:#6b7280;">${l.reason||''}</td>
        </tr>`;
      }).join('')}
      </tbody></table>`;
  } catch(e) { el.innerHTML = '<div style="color:#ef4444;padding:16px;">로드 실패</div>'; }
};

// 기존 runAutoTrade 호환성 유지
async function runAutoTrade() { await window.runAutoTradeNow(); }

async function loadTradeLog() {
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
      <td style="color:var(--muted);font-size:0.8rem;">${log.strategy}</td>
      <td style="color:var(--muted);font-size:0.78rem;">${log.created_at?.slice(0, 16) || '-'}</td>
    </tr>`).join('');
    el.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
      <thead><tr style="color:var(--muted);font-size:0.82rem;">
        <th style="padding:8px;text-align:left;">Symbol</th><th style="padding:8px;">방향</th>
        <th style="padding:8px;">Qty</th><th style="padding:8px;">가격</th>
        <th style="padding:8px;">전략</th><th style="padding:8px;">시간</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  } catch (e) { }
}

// ===== 데이터수집 탭 통합 검색 =====
let _dcSearchTimer = null;
let _dcCurrentSymbol = '';

function dcSearchDebounce(query) {
  clearTimeout(_dcSearchTimer);
  if (!query.trim()) {
    document.getElementById('dc-search-result').style.display = 'none';
    return;
  }
  _dcSearchTimer = setTimeout(() => dcSearch(query), 400);
}

async function dcSearch(query) {
  if (!query.trim()) return;
  const resultEl = document.getElementById('dc-search-result');
  resultEl.style.display = 'block';
  resultEl.innerHTML = '<div style="padding:14px;text-align:center;color:#9ca3af;font-size:0.88rem;">🔍 검색 중...</div>';

  try {
    const res = await fetch(`/proxy/stock/api/stock/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    const results = data.results || [];

    if (!results.length) {
      resultEl.innerHTML = '<div style="padding:14px;text-align:center;color:#9ca3af;font-size:0.88rem;">검색 결과가 없습니다</div>';
      return;
    }

    resultEl.innerHTML = results.map(r => {
      const isKR = r.symbol.endsWith('.KS') || r.symbol.endsWith('.KQ');
      const flag = isKR ? '🇰🇷' : '🇺🇸';
      const exLabel = isKR ? (r.symbol.endsWith('.KQ') ? 'KOSDAQ' : 'KOSPI') : r.exchange;
      const exColor = isKR ? '#c2410c' : '#1d4ed8';
      const exBg = isKR ? '#fff7ed' : '#eff6ff';
      return `
        <div onclick="dcSelectSymbol('${r.symbol}', '${r.name}')"
          style="display:flex;justify-content:space-between;align-items:center;padding:11px 16px;border-bottom:1px solid #f3f4f6;cursor:pointer;"
          onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
          <div>
            <span style="font-size:0.95rem;">${flag}</span>
            <span style="font-weight:700;font-size:0.92rem;color:#0f172a;margin-left:6px;">${r.name}</span>
            <span style="font-size:0.78rem;color:#9ca3af;margin-left:8px;">${r.symbol}</span>
          </div>
          <span style="font-size:0.72rem;padding:2px 8px;border-radius:999px;background:${exBg};color:${exColor};font-weight:700;">${exLabel}</span>
        </div>`;
    }).join('');

  } catch(e) {
    resultEl.innerHTML = `<div style="padding:14px;color:#ef4444;font-size:0.88rem;">오류: ${e.message}</div>`;
  }
}

// 선택된 종목 목록
let _dcSelectedSymbols = [];

function dcSelectSymbol(symbol, name) {
  // 드롭다운 닫기
  const resultEl = document.getElementById('dc-search-result');
  if (resultEl) resultEl.style.display = 'none';

  // 검색창 초기화
  const input = document.getElementById('dc-search-input');
  if (input) input.value = '';

  // 이미 선택된 종목이면 무시
  if (_dcSelectedSymbols.find(s => s.symbol === symbol)) {
    spAlert(`${symbol}은 이미 선택된 종목입니다.`, '중복 선택', 'ℹ️');
    return;
  }

  // 5종목 초과 시 경고
  if (_dcSelectedSymbols.length >= 5) {
    spAlert('최대 5종목까지 선택 가능합니다.', '종목 초과', '⚠️');
    return;
  }

  _dcSelectedSymbols.push({ symbol, name });
  dcRenderSelectedSymbols();
}

function dcRemoveSymbol(symbol) {
  _dcSelectedSymbols = _dcSelectedSymbols.filter(s => s.symbol !== symbol);
  dcRenderSelectedSymbols();
}

function dcRenderSelectedSymbols() {
  const badge = document.getElementById('dc-symbol-badge');
  if (!badge) return;

  if (!_dcSelectedSymbols.length) {
    badge.innerHTML = '<span style="color:#9ca3af;font-weight:400;">종목을 검색해서 선택하세요</span>';
  } else {
    badge.innerHTML = _dcSelectedSymbols.map(s => `
      <span style="display:inline-flex;align-items:center;gap:4px;background:#eef2ff;color:#6366f1;font-weight:700;font-size:0.85rem;padding:4px 10px;border-radius:999px;margin:2px;">
        ${s.symbol}
        <button onclick="dcRemoveSymbol('${s.symbol}')"
          style="background:none;border:none;cursor:pointer;color:#9ca3af;font-size:0.9rem;padding:0;line-height:1;"
          title="제거">✕</button>
      </span>`).join('');
  }

  // hidden input 업데이트
  const symbols = _dcSelectedSymbols.map(s => s.symbol);
  const quantSymbol = document.getElementById('quantSymbol');
  const dcSymbols = document.getElementById('dc-symbols');
  const batchInput = document.getElementById('quantBatchSymbols');
  if (quantSymbol) quantSymbol.value = symbols[0] || '';
  if (dcSymbols) dcSymbols.value = symbols[0] || '';
  if (batchInput) batchInput.value = symbols.join(',');
}

// 검색창 외부 클릭 시 드롭다운 닫기
document.addEventListener('click', (e) => {
  const input = document.getElementById('dc-search-input');
  const result = document.getElementById('dc-search-result');
  if (result && input && !input.contains(e.target) && !result.contains(e.target)) {
    result.style.display = 'none';
  }
});

// ===== 종목 검색 팝업 =====
let _searchTargetId = '';
let _searchMulti = false;
let _searchDebounceTimer = null;

function openStockSearch(targetInputId, isMulti = false) {
  _searchTargetId = targetInputId;
  _searchMulti = isMulti;
  const layer = document.getElementById('sp-stock-search-layer');
  if (!layer) return;
  layer.style.cssText = 'display:flex;position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:99997;align-items:center;justify-content:center;';
  const input = document.getElementById('sp-stock-search-input');
  if (input) { input.value = ''; input.focus(); }
  document.getElementById('sp-stock-search-result').innerHTML =
    '<div style="text-align:center;color:#9ca3af;padding:24px;font-size:0.88rem;">종목명을 입력하세요</div>';
}

function closeStockSearch() {
  const layer = document.getElementById('sp-stock-search-layer');
  if (layer) layer.style.display = 'none';
}

function selectStock(symbol, name) {
  // 데이터수집 탭 검색창이면 dcSelectSymbol로 처리
  if (_searchTargetId === 'dc-search-input-target') {
    closeStockSearch();
    dcSelectSymbol(symbol, name || symbol);
    return;
  }

  const el = document.getElementById(_searchTargetId);
  if (!el) { closeStockSearch(); return; }

  if (_searchMulti) {
    const current = el.value.split(',').map(s => s.trim()).filter(Boolean);
    if (!current.includes(symbol)) {
      if (current.length >= 5) {
        spAlert('최대 5종목까지 추가 가능합니다.', '종목 초과', '⚠️');
        return;
      }
      current.push(symbol);
      el.value = current.join(',');
    }
  } else {
    el.value = symbol;
  }

  // 뱃지 업데이트
  if (_searchTargetId === 'atSymbols') atRenderSymbolBadge();
  if (_searchTargetId === 'stockSymbols') stockRenderSymbolBadge();

  closeStockSearch();
}

function stockRenderSymbolBadge() {
  const badge = document.getElementById('stock-symbol-badge');
  const placeholder = document.getElementById('stock-symbol-placeholder');
  const input = document.getElementById('stockSymbols');
  if (!badge || !input) return;
  const symbols = input.value.split(',').map(s => s.trim()).filter(Boolean);
  if (placeholder) placeholder.style.display = symbols.length ? 'none' : 'inline';
  badge.querySelectorAll('.stock-badge-item').forEach(el => el.remove());
  symbols.forEach(sym => {
    const span = document.createElement('span');
    span.className = 'stock-badge-item';
    span.style.cssText = 'display:inline-flex;align-items:center;gap:4px;background:#eef2ff;color:#6366f1;font-weight:700;font-size:0.82rem;padding:3px 8px;border-radius:999px;';
    span.innerHTML = `${sym} <button onclick="event.stopPropagation();stockRemoveSymbol('${sym}')" style="background:none;border:none;cursor:pointer;color:#9ca3af;font-size:0.85rem;padding:0;line-height:1;">✕</button>`;
    badge.appendChild(span);
  });
}

function stockRemoveSymbol(symbol) {
  const input = document.getElementById('stockSymbols');
  if (!input) return;
  input.value = input.value.split(',').map(s => s.trim()).filter(s => s && s !== symbol).join(',');
  stockRenderSymbolBadge();
}

function atRenderSymbolBadge() {
  const badge = document.getElementById('at-symbol-badge');
  const placeholder = document.getElementById('at-symbol-placeholder');
  const input = document.getElementById('atSymbols');
  if (!badge || !input) return;
  const symbols = input.value.split(',').map(s => s.trim()).filter(Boolean);
  if (placeholder) placeholder.style.display = symbols.length ? 'none' : 'inline';
  badge.querySelectorAll('.at-badge-item').forEach(el => el.remove());
  symbols.forEach(sym => {
    const span = document.createElement('span');
    span.className = 'at-badge-item';
    span.style.cssText = 'display:inline-flex;align-items:center;gap:4px;background:#eef2ff;color:#6366f1;font-weight:700;font-size:0.82rem;padding:3px 8px;border-radius:999px;';
    span.innerHTML = `${sym} <button onclick="event.stopPropagation();atRemoveSymbol('${sym}')" style="background:none;border:none;cursor:pointer;color:#9ca3af;font-size:0.85rem;padding:0;line-height:1;">✕</button>`;
    badge.appendChild(span);
  });
}

function atRemoveSymbol(symbol) {
  const input = document.getElementById('atSymbols');
  if (!input) return;
  input.value = input.value.split(',').map(s => s.trim()).filter(s => s && s !== symbol).join(',');
  atRenderSymbolBadge();
}

function searchStockDebounce(query) {
  clearTimeout(_searchDebounceTimer);
  if (!query.trim()) return;
  _searchDebounceTimer = setTimeout(() => searchStock(query), 400);
}

async function searchStock(query) {
  if (!query.trim()) return;
  const el = document.getElementById('sp-stock-search-result');
  el.innerHTML = '<div style="text-align:center;color:#9ca3af;padding:24px;font-size:0.88rem;">🔍 검색 중...</div>';
  try {
    const res = await fetch(`/proxy/stock/api/stock/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    const results = data.results || [];
    if (!results.length) {
      el.innerHTML = '<div style="text-align:center;color:#9ca3af;padding:24px;font-size:0.88rem;">검색 결과가 없습니다</div>';
      return;
    }
    el.innerHTML = results.map(r => {
      const isKR = r.symbol.endsWith('.KS') || r.symbol.endsWith('.KQ');
      const flag = isKR ? '🇰🇷' : '🇺🇸';
      const exBadge = isKR
        ? `<span style="font-size:0.72rem;padding:1px 6px;border-radius:999px;background:#fff7ed;color:#c2410c;font-weight:700;">${r.symbol.endsWith('.KQ') ? 'KOSDAQ' : 'KOSPI'}</span>`
        : `<span style="font-size:0.72rem;padding:1px 6px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-weight:700;">${r.exchange}</span>`;
      return `
        <div onclick="selectStock('${r.symbol}')"
          style="display:flex;justify-content:space-between;align-items:center;padding:11px 14px;border-bottom:1px solid #f3f4f6;cursor:pointer;transition:background 0.1s;"
          onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
          <div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:0.95rem;">${flag}</span>
              <span style="font-weight:700;font-size:0.92rem;color:#0f172a;">${r.name}</span>
            </div>
            <div style="font-size:0.78rem;color:#9ca3af;margin-top:2px;">${r.symbol}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            ${exBadge}
            <span style="font-size:0.75rem;padding:1px 6px;border-radius:999px;background:#f1f5f9;color:#64748b;">${r.type}</span>
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = `<div style="color:#ef4444;padding:16px;font-size:0.88rem;">오류: ${e.message}</div>`;
  }
}

// ESC로 팝업 닫기
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeStockSearch();
});

// ===== 주가 히스토리 초기 수집 =====
async function initHistoryData() {
  const btn = event.target;
  const ok = await spConfirm(
    '기본 종목 (AAPL, MSFT, GOOGL, NVDA, TSLA, QQQ, SPY) 2년치 데이터를 수집합니다. 약 30~50초 소요됩니다.',
    '초기 데이터 수집', '💾', '수집 시작', '#6366f1'
  );
  if (!ok) return;
  btn.disabled = true;
  btn.textContent = '⏳ 수집 중...';
  try {
    const res = await fetch('/proxy/stock/api/stock/init-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA', 'QQQ', 'SPY'] })
    });
    const data = await res.json();
    if (data.ok) {
      btn.textContent = '✅ 수집 시작됨!';
      const el = document.getElementById('dc-history-result');
      if (el) el.innerHTML = `<div style="padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;color:#065f46;font-size:0.88rem;">
        ✅ ${data.message}<br>
        <span style="color:#6b7280;font-size:0.8rem;">백그라운드에서 수집 중입니다. 1~2분 후 조회해주세요.</span>
      </div>`;
    } else {
      btn.textContent = '❌ 실패';
    }
  } catch(e) {
    btn.textContent = '❌ 오류';
  }
  setTimeout(() => { btn.textContent = '🔄 초기 데이터 수집'; btn.disabled = false; }, 4000);
}

// ===== 주가 히스토리 조회 =====
async function loadHistoryData() {
  const input = document.getElementById('dc-symbols').value.trim().toUpperCase();
  const el = document.getElementById('dc-history-result');
  if (!input) {
    el.innerHTML = '<p style="color:#f59e0b;">⚠️ 위 검색창에서 종목을 먼저 선택해주세요.</p>';
    return;
  }
  const symbol = input.split(',')[0].trim();

  // 한국 종목 여부 판단
  const isKorean = symbol.endsWith('.KS') || symbol.endsWith('.KQ');
  const currency = isKorean ? '₩' : '$';
  const formatPrice = (v) => v ? `${currency}${isKorean ? Math.round(v).toLocaleString() : v.toFixed(2)}` : '-';

  el.innerHTML = '<p style="color:var(--muted)">조회 중...</p>';

  try {
    const res = await fetch(`/proxy/stock/api/stock/history?symbol=${symbol}`);
    const data = await res.json();

    if (data.error) {
      el.innerHTML = `<div style="color:#ef4444;padding:8px;">❌ ${symbol}: ${data.error}</div>`;
      return;
    }

    const rows = (data.data || []).slice(-30).reverse().map(r => `
      <tr>
        <td style="padding:8px 12px;color:#6b7280;font-size:0.82rem;">${r.date}</td>
        <td style="padding:8px 12px;text-align:right;">${formatPrice(r.open)}</td>
        <td style="padding:8px 12px;text-align:right;">${formatPrice(r.high)}</td>
        <td style="padding:8px 12px;text-align:right;">${formatPrice(r.low)}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700;color:#6366f1;">${formatPrice(r.close)}</td>
        <td style="padding:8px 12px;text-align:right;color:#6b7280;font-size:0.82rem;">${r.volume?.toLocaleString()||'-'}</td>
      </tr>`).join('');

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:1rem;font-weight:800;color:#6366f1;">${symbol}</span>
          ${isKorean ? '<span style="font-size:0.75rem;padding:2px 8px;border-radius:999px;background:#fff7ed;color:#c2410c;font-weight:700;">🇰🇷 KRX</span>' : '<span style="font-size:0.75rem;padding:2px 8px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-weight:700;">🇺🇸 US</span>'}
        </div>
        <span style="font-size:0.78rem;color:#9ca3af;">총 ${data.count}건 · 최근 30일 표시</span>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
          <thead>
            <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
              <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:700;">날짜</th>
              <th style="padding:8px 12px;text-align:right;color:#6b7280;font-weight:700;">시가</th>
              <th style="padding:8px 12px;text-align:right;color:#6b7280;font-weight:700;">고가</th>
              <th style="padding:8px 12px;text-align:right;color:#6b7280;font-weight:700;">저가</th>
              <th style="padding:8px 12px;text-align:right;color:#6b7280;font-weight:700;">종가</th>
              <th style="padding:8px 12px;text-align:right;color:#6b7280;font-weight:700;">거래량</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

  } catch(e) {
    el.innerHTML = `<p style="color:#ef4444;">오류: ${e.message}</p>`;
  }
}

// ===== Alpaca 다계좌 관리 =====
let activeAccountId = null; // 현재 Select된 계좌 ID