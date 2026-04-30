// ============================================================
// auto-saved.js — 자동매매 저장 종목 / 한국 시장
// 원본 stock.js 라인 2511-2976 에서 분할 (모놀리식 정리)
// 모든 함수는 global scope (classic <script>) — 다른 파일에서 호출 가능
// ============================================================

// ===== 완전자동매매 저장된 종목 관리 =====
async function renderAutoSavedSymbols() {
  const el = document.getElementById('autoSavedSymbols');
  if (!el) return;
  try {
    const res = await fetch('/api/trade3/pool');
    const d = await res.json();
    const pool = d.pool || [];
    if (!pool.length) {
      el.innerHTML = '<div style="text-align:center;color:#636366;padding:16px;font-size:0.85rem;">저장된 종목 없음</div>';
      return;
    }
    el.innerHTML = _safeHTML(`
      <div style="font-size:0.75rem;color:#9CA3AF;margin-bottom:8px;">저장 ${pool.length}개</div>
      ${pool.map(p => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#1E242C;border-radius:8px;border:1px solid #2A2A2A;margin-bottom:6px;">
          <div>
            <span style="font-weight:700;font-size:0.9rem;color:#6366f1;cursor:pointer;" data-action="openChart" data-args="${_jsAttr([p.symbol])}">${p.symbol} 📈</span>
            <span style="font-size:0.72rem;color:#9CA3AF;margin-left:6px;">점수 ${p.factor_score}</span>
          </div>
          <button data-action="deleteAutoSymbol" data-args="${_jsAttr([p.symbol])}"
            style="padding:3px 10px;border-radius:6px;background:rgba(239,68,68,0.12);border:1px solid #ef444440;color:#ef4444;font-size:0.75rem;font-weight:700;cursor:pointer;">
            🗑️ 삭제
          </button>
        </div>`).join('')}`);
  } catch (e) {
    el.innerHTML = _safeHTML(`<div style="color:#ef4444;font-size:0.82rem;">오류: ${e.message}</div>`);
  }
}
window.saveAutoSymbol = async function (symbol, factor_score) {
  try {
    const res = await fetch('/api/trade3/pool_save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, factor_score: factor_score || 0 })
    });
    const d = await res.json();
    if (!d.ok) { await spAlert(d.message || '저장 실패', '오류', '❌'); return; }
    if (d.message === '이미 저장된 종목') {
      await spAlert(`${symbol}은 이미 저장된 종목이에요!`, '알림', 'ℹ️'); return;
    }
    // 버튼 피드백
    const btns = document.querySelectorAll(`button[onclick*="saveAutoSymbol('${symbol}'"]`);
    btns.forEach(btn => { btn.textContent = `✅ ${symbol} 저장됨`; btn.style.background = '#dcfce7'; btn.style.color = '#166534'; btn.disabled = true; });
    await renderAutoSavedSymbols();
  } catch (e) { await spAlert('오류: ' + e.message, '오류', '❌'); }
};
window.deleteAutoSymbol = async function (symbol) {
  const ok = await spConfirm(`${symbol}을 저장 목록에서 삭제하시겠습니까?`, '종목 삭제', '🗑️', '삭제', '#ef4444');
  if (!ok) return;
  try {
    await fetch(`/api/trade3/pool/${symbol}`, { method: 'DELETE' });
    await renderAutoSavedSymbols();
  } catch (e) { await spAlert('오류: ' + e.message, '오류', '❌'); }
};
// ===== 포지션 + 이력 로드 =====
window.loadAutoStrategyPositions = async function () {
  const el = document.getElementById('asPositions');
  try {
    // 기존 자동매매 포지션 API 재활용 (서버가 Alpaca 키를 관리함)
    const res = await fetch('/api/trade4/positions');
    if (!res.ok) {
      el.innerHTML = '<div style="color:#636366;font-size:0.82rem;padding:12px;">포지션 조회 실패 — Alpaca 키를 확인해주세요</div>';
      return;
    }
    const d = await res.json();
    const list = d.positions || [];
    if (!list.length) { el.innerHTML = '<div style="color:#636366;font-size:0.82rem;padding:12px;text-align:center;">보유 포지션 없음</div>'; return; }
    el.innerHTML = list.map(p => {
      const pl = parseFloat(p.unrealized_plpc) * 100;
      const color = pl >= 0 ? '#16a34a' : '#dc2626';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#1E242C;border-radius:8px;border:1px solid #2A2A2A;margin-bottom:6px;">
      <div><span style="font-weight:800;color:#E5E7EB;">${p.symbol}</span><span style="margin-left:6px;font-size:0.72rem;color:#9CA3AF;">${p.qty}주</span></div>
      <div style="text-align:right;"><div style="font-weight:700;color:#E5E7EB;">$${parseFloat(p.current_price).toFixed(2)}</div><div style="font-size:0.72rem;font-weight:700;color:${color};">${pl >= 0 ? '+' : ''}${pl.toFixed(2)}%</div></div>
    </div>`;
    }).join('');
  } catch (e) { el.innerHTML = _safeHTML(`<div style="color:#636366;font-size:0.82rem;padding:12px;">포지션 정보를 불러올 수 없어요</div>`); }
};
window.loadAutoStrategyLog = async function () {
  const el = document.getElementById('asTradeLog');
  try {
    const res = await fetch('/api/trade4/log');
    const d = await res.json();
    const logs = (d.logs || []).filter(l => l.reason?.includes('퀀트전략') || l.reason?.includes('3단계')).slice(0, 20);
    if (!logs.length) { el.innerHTML = '<div style="color:#636366;font-size:0.82rem;padding:12px;text-align:center;">매매 이력 없음</div>'; return; }
    el.innerHTML = logs.map(l => {
      const isBuy = l.action === 'BUY';
      const color = isBuy ? '#16a34a' : l.action === 'SELL_PROFIT' ? '#6366f1' : '#ef4444';
      const icon = isBuy ? '🟢' : l.action === 'SELL_PROFIT' ? '✅' : '🔴';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#1E242C;border-radius:8px;border:1px solid #2A2A2A;margin-bottom:6px;">
      <div><span style="font-weight:700;color:${color};">${icon} ${l.action}</span> <span style="font-weight:800;color:#E5E7EB;">${l.symbol}</span>
      <div style="font-size:0.7rem;color:#636366;">${l.reason || ''}</div></div>
      <div style="text-align:right;font-size:0.78rem;"><div style="color:#E5E7EB;">$${parseFloat(l.price || 0).toFixed(2)}</div><div style="color:#9CA3AF;">${l.qty}주</div></div>
    </div>`;
    }).join('');
  } catch (e) { el.innerHTML = _safeHTML(`<div style="color:#ef4444;font-size:0.82rem;">로드 실패: ${e.message}</div>`); }
};
// ===== 한국 시장 선택 =====
window.setKrMarket = function (market) {
  _selectedKrMarket = market;
  const kospiBtn = document.getElementById('krMarketBtnKospi');
  const kosdaqBtn = document.getElementById('krMarketBtnKosdaq');
  if (kospiBtn) { kospiBtn.style.background = market === 'kospi' ? '#6366f1' : 'transparent'; kospiBtn.style.color = market === 'kospi' ? '#fff' : '#9CA3AF'; kospiBtn.style.borderColor = market === 'kospi' ? '#6366f1' : '#2A2A2A'; }
  if (kosdaqBtn) { kosdaqBtn.style.background = market === 'kosdaq' ? '#6366f1' : 'transparent'; kosdaqBtn.style.color = market === 'kosdaq' ? '#fff' : '#9CA3AF'; kosdaqBtn.style.borderColor = market === 'kosdaq' ? '#6366f1' : '#2A2A2A'; }
}
// ===== 통합 스크리너 (미국/한국 분기) =====
window.runFactorScreen = async function (mode) {
  const isKr = mode === 'kr';
  const el = document.getElementById(isKr ? 'krTradeResult' : 'autoTradeResult');
  const market = isKr ? _selectedKrMarket : (_selectedMarket || 'nasdaq');
  const strategy = document.getElementById(isKr ? 'krFactorStrategy' : 'atFactorStrategy')?.value || 'value_quality';
  const marketLabel = isKr
    ? (market === 'kosdaq' ? '코스닥150' : '코스피200')
    : (market === 'dow' ? '다우존스30' : market === 'sp500' ? 'S&P500' : market === 'russell1000' ? 'Russell1000' : '나스닥100');
  el.innerHTML = _safeHTML(`<div style="padding:12px;background:rgba(30,123,255,0.08);border-radius:8px;border:1px solid #bae6fd;">
  <div style="font-weight:700;color:#0369a1;margin-bottom:6px;">🔍 ${isKr ? '한국 종목' : '통합'} 스크리닝 중...</div>
  <div style="font-size:0.8rem;color:#9CA3AF;line-height:1.6;">
    📊 1단계: ${marketLabel} 팩터 분석 (PER/PBR/ROE)<br>
    ${isKr ? '📋 분석 전용 (매매 미지원)' : '⏱ 2단계: MACD/RSI 타이밍 체크'}<br>약 1~2분 소요
  </div></div>`);
  try {
    const apiPath = isKr ? '/proxy/quant/api/quant/factor-screen' : '/proxy/quant/api/quant/integrated-screen';
    // 성향 가중치 포함 (있으면)
    const profileWeights = _investorProfile ? {
      w_momentum: _investorProfile.w_momentum,
      w_value: _investorProfile.w_value,
      w_quality: _investorProfile.w_quality,
      w_news: _investorProfile.w_news,
    } : null;
    // 스크리닝 옵션 읽기
    const topN = parseInt(document.getElementById(isKr ? 'asTopN' : 'atTopN')?.value || '10');
    const finalN = parseInt(document.getElementById(isKr ? 'asFinalN' : 'atFinalN')?.value || '3');
    const sigFilter = document.getElementById(isKr ? 'asSignalFilter' : 'atSignalFilter')?.value || 'all';
    const scoreMode = document.getElementById(isKr ? 'asScoreMode' : 'atScoreMode')?.value || 'combined';
    const body = isKr
      ? { strategy, market, top_n: topN, profile_weights: profileWeights }
      : { strategy, market, top_n: topN, final_n: finalN, signal_filter: sigFilter, score_mode: scoreMode, profile_weights: profileWeights };
    const res = await fetch(apiPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json();
    let items = isKr ? d.top : d.results;
    if (!d.ok || !items?.length) { el.innerHTML = '<div style="padding:10px;color:#9CA3AF;font-size:0.85rem;">조건 충족 종목 없음 — 전략을 바꿔보세요</div>'; return; }
    // 신호 필터 적용
    if (!isKr && sigFilter === 'buy') {
      items = items.filter(item => item.timing === 'BUY');
      if (!items.length) { el.innerHTML = '<div style="padding:10px;color:#9CA3AF;font-size:0.85rem;">BUY 신호 종목 없음 — 신호 필터를 BUY+WATCH로 바꿔보세요</div>'; return; }
    }
    // 점수 방식에 따라 재정렬
    if (!isKr && scoreMode === 'factor') {
      items = [...items].sort((a, b) => (b.factor_score || 0) - (a.factor_score || 0));
    } else if (!isKr && scoreMode === 'technical') {
      items = [...items].sort((a, b) => (b.tech_score || 0) - (a.tech_score || 0));
    }
    // finalN 적용
    if (!isKr) items = items.slice(0, finalN);
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    const tBg = { BUY: 'rgba(99,102,241,0.12)', WATCH: 'rgba(245,158,11,0.08)', AVOID: 'rgba(30,123,255,0.06)' };
    const tBor = { BUY: '#6366f1', WATCH: 'rgba(245,158,11,0.4)', AVOID: '#2A2A2A' };
    const tCol = { BUY: '#FF3B30', WATCH: '#FFD60A', AVOID: '#1E7BFF' };
    const rows = items.map((item, i) => {
      const timing = item.timing || 'WATCH';
      const bg = isKr ? (i === 0 ? 'rgba(99,102,241,0.12)' : '#1E242C') : (tBg[timing] || '#1E242C');
      const bor = isKr ? (i === 0 ? '#6366f1' : '#2A2A2A') : (tBor[timing] || '#2A2A2A');
      const timingColor = tCol[timing] || '#9CA3AF';
      const badge = isKr
        ? `<span style="margin-left:8px;font-size:0.72rem;padding:2px 8px;border-radius:4px;background:rgba(255,214,10,0.12);color:#FFD60A;font-weight:700;">📊 분석용</span>`
        : `<span style="margin-left:8px;font-size:0.72rem;padding:2px 8px;border-radius:4px;background:${timingColor}22;color:${timingColor};font-weight:700;">${item.timing_icon || ''} ${timing}</span>`;
      const techRow = !isKr ? `<div style="margin-bottom:4px;"><span style="font-size:0.7rem;color:#9CA3AF;font-weight:600;">타이밍: </span>${(item.tech_reasons || []).filter(Boolean).map(r => `<span style="font-size:0.7rem;padding:1px 6px;background:rgba(255,59,48,0.12);color:#FF3B30;border-radius:4px;margin-right:2px;">${r}</span>`).join('')}</div>` : '';
      const saveBtn = !isKr
        ? (timing === 'AVOID'
          ? `<button onclick="event.stopPropagation();saveOneSymbol(${_jsAttr(item.symbol)})" style="margin-top:8px;width:100%;padding:5px;border-radius:6px;border:1px solid rgba(255,59,48,0.3);background:rgba(255,59,48,0.08);color:#FF3B30;font-size:0.75rem;font-weight:700;cursor:pointer;">⚠️ ${item.symbol} AVOID — 그래도 저장</button>`
          : `<button onclick="event.stopPropagation();saveOneSymbol(${_jsAttr(item.symbol)})" style="margin-top:8px;width:100%;padding:5px;border-radius:6px;border:1px solid #2A2A2A;background:rgba(79,143,255,0.1);color:#4f8fff;font-size:0.75rem;font-weight:700;cursor:pointer;">💾 ${item.symbol} 저장</button>`)
        : '';
      return `<div style="padding:12px 14px;background:${bg};border-radius:8px;border:1px solid ${bor};margin-bottom:8px;cursor:pointer;" data-action="openChart" data-args="${_jsAttr([item.symbol])}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div><span style="font-weight:800;font-size:1rem;color:#E5E7EB;">${medals[i] || ''} ${item.symbol}</span>${badge}</div>
        <div style="text-align:right;"><div style="font-weight:700;color:#E5E7EB;">$${item.price?.toFixed(2) ?? '-'}</div><div style="font-size:0.7rem;color:#4f8fff;">점수 ${item.factor_score}</div></div>
      </div>
      <div style="margin-bottom:4px;"><span style="font-size:0.7rem;color:#9CA3AF;font-weight:600;">팩터: </span>${(item.factor_reasons || item.reasons || []).map(r => `<span style="font-size:0.7rem;padding:1px 6px;background:rgba(79,143,255,0.15);color:#4f8fff;border-radius:4px;margin-right:2px;">${r}</span>`).join('')}</div>
      ${techRow}
      <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:0.72rem;color:#9CA3AF;">
        ${item.per ? `<span>PER ${item.per}</span>` : ''}
        ${item.pbr ? `<span>PBR ${item.pbr}</span>` : ''}
        ${item.roe ? `<span>ROE ${item.roe}%</span>` : ''}
        ${item.momentum_3m != null ? `<span>3M ${item.momentum_3m > 0 ? '+' : ''}${item.momentum_3m}%</span>` : ''}
        ${item.momentum_6m != null ? `<span>6M ${item.momentum_6m > 0 ? '+' : ''}${item.momentum_6m}%</span>` : ''}
        ${item.momentum_12m != null ? `<span>12M ${item.momentum_12m > 0 ? '+' : ''}${item.momentum_12m}%</span>` : ''}
        ${item.sma200 != null ? `<span style="color:${item.above_sma200 ? '#FF3B30' : '#1E7BFF'};">${item.above_sma200 ? '▲' : '▼'} 200일선 $${item.sma200?.toFixed(0)}</span>` : ''}
      </div>
      ${item.news_label && item.news_label !== '뉴스없음' ? `<div style="display:flex;align-items:center;gap:6px;margin-top:5px;padding:4px 8px;background:#111827;border-radius:6px;border:1px solid #2A2A2A;">
        <span style="font-size:0.72rem;color:#9CA3AF;font-weight:600;">뉴스:</span>
        <span style="font-size:0.72rem;font-weight:700;color:${item.news_score > 0.3 ? '#FF3B30' : item.news_score < -0.3 ? '#1E7BFF' : '#9CA3AF'};">${item.news_label}</span>
        <span style="font-size:0.7rem;color:#636366;">${item.news_count}건</span>
        ${item.macro_risk < -1 ? '<span style="font-size:0.7rem;padding:1px 6px;background:rgba(255,214,10,0.15);color:#FFD60A;border-radius:4px;font-weight:700;">⚠️ 거시악재</span>' : ''}
      </div>` : ''}
      ${saveBtn}
    </div>`;
    }).join('');
    // 스크리닝 후 저장된 종목 새로고침 (스크리닝 결과와 별도 표시)
    if (isKr) { setTimeout(() => { if (typeof renderKrSavedSettings === 'function') renderKrSavedSettings(); }, 300); }
    // ✅ 미국 탭: BUY/WATCH 종목만 atSymbols에 반영 (AVOID 제외)
    if (!isKr) {
      const buySymbols = items
        .filter(item => item.timing === 'BUY' || item.timing === 'WATCH')
        .map(item => item.symbol);
      const atSymbolsEl = document.getElementById('atSymbols');
      if (atSymbolsEl) atSymbolsEl.value = buySymbols.join(',');
      if (typeof atRenderSymbolBadge === 'function') atRenderSymbolBadge();
      setTimeout(() => { if (typeof renderAtSavedSettings === 'function') renderAtSavedSettings(); }, 300);
    }
    const scoreModeLabel = scoreMode === 'factor' ? '팩터점수' : scoreMode === 'technical' ? '기술점수' : '복합점수';
    const sigLabel = sigFilter === 'buy' ? 'BUY만' : 'BUY+WATCH';
    el.innerHTML = _safeHTML(`<div style="margin-top:4px;"><div style="font-size:0.78rem;color:#9CA3AF;margin-bottom:8px;">📊 ${marketLabel} · ${d.strategy_label}<br>${d.screened}개 스크리닝 → TOP${isKr ? items.length : finalN}${isKr ? ' (분석 전용)' : ` (${scoreModeLabel} · ${sigLabel})`}</div>${rows}${isKr ? '<div style="margin-top:10px;padding:8px 12px;background:rgba(255,214,10,0.08);border-radius:8px;border:1px solid rgba(255,214,10,0.25);font-size:0.78rem;color:#FFD60A;font-weight:600;">⚠️ 자동매매는 키움증권 API 연동 후 활성화됩니다</div>' : ''}</div>`);
  } catch (e) { el.innerHTML = _safeHTML(`<div style="color:#ef4444;font-size:0.85rem;">오류: ${e.message}</div>`); }
};
window.searchNasdaqTop3 = () => window.runFactorScreen('us');
// ===== 종목 개별 저장 =====
// ===== sp 팝업 헬퍼 (기존 sp-alert-layer / sp-confirm-layer 사용) =====
window.saveOneSymbol = async function (symbol) {
  try {
    const cur = await (await fetch('/api/trade4/settings')).json();
    const existing = (cur.symbols || '').split(',').map(s => s.trim()).filter(Boolean);
    // 이미 저장된 종목 체크
    if (existing.includes(symbol)) {
      await spAlert('ℹ️', '이미 저장된 종목', `${symbol}은 이미 저장된 종목이에요!`);
      return;
    }
    // 5개 제한
    if (existing.length >= 5) {
      await spAlert('⚠️', '저장 한도 초과', `종목은 최대 5개까지 저장할 수 있어요.\n현재 ${existing.length}개 저장됨 — 기존 종목을 삭제 후 추가하세요.`);
      return;
    }
    existing.push(symbol);
    const newSymbols = existing.join(',');
    const atSymbolsEl = document.getElementById('atSymbols');
    if (atSymbolsEl) atSymbolsEl.value = newSymbols;
    const factorStrategy = document.getElementById('atFactorStrategy')?.value || 'value_quality';
    await fetch('/api/trade4/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...cur,
        symbols: newSymbols,
        factor_strategy: factorStrategy,
        factor_market: _selectedMarket || 'nasdaq'
      })
    });
    // 버튼 피드백
    const btns = document.querySelectorAll(`button[data-action="saveOneSymbol" data-args="${_jsAttr([symbol])}"]`);
    btns.forEach(btn => {
      btn.textContent = `✅ ${symbol} 저장됨`;
      btn.style.background = '#dcfce7';
      btn.style.color = '#166534';
      btn.style.borderColor = '#86efac';
      btn.disabled = true;
    });
    setTimeout(() => { if (typeof renderAtSavedSettings === 'function') renderAtSavedSettings(); }, 300);
  } catch (e) {
    await spAlert('❌', '저장 오류', e.message);
  }
};
window.setMarket = function (market) {
  _selectedMarket = market;
  const idMap = { nasdaq: 'marketBtnNasdaq', dow: 'marketBtnDow', sp500: 'marketBtnSp500', russell1000: 'marketBtnRussell' };
  Object.entries(idMap).forEach(([m, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.background = m === market ? '#6366f1' : 'transparent';
    el.style.color = m === market ? '#fff' : '#9CA3AF';
    el.style.borderColor = m === market ? '#6366f1' : '#2A2A2A';
  });
}
// ===== 한국 저장된 종목 렌더링 + 삭제 =====
window.saveKrSymbol = async function (symbol) {
  try {
    const res = await fetch('/api/trade4/settings');
    const d = await res.json();
    const existing = (d.kr_candidate_symbols || '').split(',').map(s => s.trim()).filter(Boolean);
    if (existing.includes(symbol)) {
      await spAlert(`${symbol}은 이미 저장된 종목이에요!`, '알림', 'ℹ️');
      return;
    }
    existing.push(symbol);
    await fetch('/api/trade4/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...d, kr_candidate_symbols: existing.join(',') })
    });
    // 버튼 피드백
    const btns = document.querySelectorAll(`button[data-action="saveKrSymbol" data-args="${_jsAttr([symbol])}"]`);
    btns.forEach(btn => { btn.textContent = `✅ ${symbol} 저장됨`; btn.style.background = '#dcfce7'; btn.style.color = '#166534'; btn.disabled = true; });
    await renderKrSavedSettings();
  } catch (e) {
    await spAlert('오류: ' + e.message, '오류', '❌');
  }
};
async function renderKrSavedSettings() {
  const el = document.getElementById('krSavedSettings');
  if (!el) return;
  try {
    const res = await fetch('/api/trade4/settings');
    const d = await res.json();
    const symbols = (d.kr_candidate_symbols || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!symbols.length) {
      el.innerHTML = '<div style="text-align:center;color:#636366;padding:24px;font-size:0.85rem;">저장된 종목 없음</div>';
      return;
    }
    el.innerHTML = _safeHTML(`
      <div style="font-size:0.75rem;color:#9CA3AF;margin-bottom:8px;">저장 ${symbols.length}개</div>
      ${symbols.map(sym => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#1E242C;border-radius:8px;border:1px solid #2A2A2A;margin-bottom:6px;">
          <span style="font-weight:700;font-size:0.9rem;color:#4f8fff;">${sym}</span>
          <button data-action="deleteKrSymbol" data-args="${_jsAttr([sym])}"
            style="padding:3px 10px;border-radius:6px;background:rgba(239,68,68,0.12);border:1px solid #ef444440;color:#ef4444;font-size:0.75rem;font-weight:700;cursor:pointer;">
            🗑️ 삭제
          </button>
        </div>`).join('')}`);
  } catch (e) {
    el.innerHTML = _safeHTML(`<div style="color:#ef4444;font-size:0.82rem;">오류: ${e.message}</div>`);
  }
}
window.deleteKrSymbol = async function (symbol) {
  const ok = await spConfirm(`${symbol}을 저장 목록에서 삭제하시겠습니까?`, '종목 삭제', '🗑️', '삭제', '#ef4444');
  if (!ok) return;
  try {
    const res = await fetch('/api/trade4/settings');
    const d = await res.json();
    const symbols = (d.kr_candidate_symbols || '').split(',').map(s => s.trim()).filter(Boolean);
    const newSymbols = symbols.filter(s => s !== symbol).join(',');
    await fetch('/api/trade4/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...d, kr_candidate_symbols: newSymbols })
    });
    await renderKrSavedSettings();
  } catch (e) {
    await spAlert('오류: ' + e.message, '오류', '❌');
  }
};
// ===== 저장된 설정 카드 렌더링 =====
const _origLoadAutoTradeSettings = typeof loadAutoTradeSettings === 'function' ? loadAutoTradeSettings : null;
window.loadAutoTradeSettings = async function () {
  if (typeof _origLoadAutoTradeSettings === 'function') await _origLoadAutoTradeSettings();
  renderAtSavedSettings();
};
async function renderAtSavedSettings() {
  const el = document.getElementById('atSavedSettings');
  if (!el) return;
  try {
    const res = await fetch('/api/trade4/settings');
    const d = await res.json();
    if (!d || d.error) { el.innerHTML = '<div style="color:#636366;padding:12px;font-size:0.85rem;">저장된 설정 없음</div>'; return; }
    const symbols = (d.symbols || '').split(',').map(s => s.trim()).filter(Boolean);
    const enabled = !!d.enabled;
    // 전체 상태 배지
    const statusColor = enabled ? '#dcfce7' : '#f1f5f9';
    const statusText = enabled ? '✅ 활성' : '⏹ 비활성';
    const statusFg = enabled ? '#065f46' : '#6b7280';
    let html = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #2A2A2A;">
      <span style="font-size:0.82rem;color:#9CA3AF;">전체 상태</span>
      <span style="font-size:0.78rem;padding:3px 10px;border-radius:999px;background:${enabled ? 'rgba(255,59,48,0.15)' : 'rgba(255,255,255,0.06)'};color:${enabled ? '#FF3B30' : '#9CA3AF'};font-weight:700;">${statusText}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-size:0.78rem;color:#9CA3AF;">📊 종목별 활성/비활성</div>
      <div style="font-size:0.72rem;">
        <span style="padding:2px 8px;border-radius:999px;background:${symbols.length >= 5 ? 'rgba(30,123,255,0.15)' : 'rgba(255,59,48,0.1)'};color:${symbols.length >= 5 ? '#1E7BFF' : '#FF3B30'};font-weight:700;">저장 ${symbols.length}/5</span>
      </div>
    </div>
    <div style="font-size:0.72rem;color:#636366;margin-bottom:8px;">자동매매는 최대 3종목까지 동시 활성화 가능</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;">`;
    if (symbols.length === 0) {
      html += `<div style="color:#636366;font-size:0.85rem;">저장된 종목 없음</div>`;
    } else {
      symbols.forEach(sym => {
        html += `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#1E242C;border-radius:8px;border:1px solid #2A2A2A;">
        <span style="font-weight:700;font-size:0.9rem;color:#4f8fff;cursor:pointer;text-decoration:none;" data-action="openChart" data-args="${_jsAttr([sym])}" title="📈 차트 보기">${sym} 📈</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <span style="font-size:0.75rem;color:#9CA3AF;" id="at-toggle-label-${sym}">${enabled ? '활성' : '비활성'}</span>
            <div onclick="toggleSymbolActive(${_jsAttr(sym)}, this)" 
              style="width:40px;height:22px;border-radius:999px;background:${enabled ? '#10b981' : '#d1d5db'};position:relative;cursor:pointer;transition:background 0.2s;" 
              data-active="${enabled ? '1' : '0'}" id="at-toggle-${sym}">
              <div style="width:18px;height:18px;border-radius:50%;background:#161B22;position:absolute;top:2px;left:${enabled ? '20px' : '2px'};transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2);" id="at-toggle-knob-${sym}"></div>
            </div>
          </label>
          <button data-action="deleteSymbol" data-args="${_jsAttr([sym])}" style="width:22px;height:22px;border-radius:50%;background:rgba(30,123,255,0.15);border:none;cursor:pointer;color:#ef4444;font-size:0.8rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;" title="${sym} 삭제">✕</button>
        </div>
      </div>`;
      });
    }
    html += `</div>
    <div style="font-size:0.78rem;color:#9CA3AF;border-top:1px solid #2A2A2A;padding-top:10px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span>💰 매수 비율</span><span style="font-weight:700;color:#E5E7EB;">${Math.round((d.balance_ratio || 0.1) * 100)}%</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span>✅ 익절</span><span style="font-weight:700;color:#FF3B30;">${Math.round((d.take_profit || 0.05) * 100)}%</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span>❌ 손절</span><span style="font-weight:700;color:#1E7BFF;">${Math.round((d.stop_loss || 0.05) * 100)}%</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span>📈 신호 방식</span><span style="font-weight:700;color:#E5E7EB;">${d.signal_mode || 'combined'}</span>
      </div>
    </div>`;
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = _safeHTML(`<div style="color:#ef4444;font-size:0.85rem;">설정 로드 실패: ${e.message}</div>`);
  }
}
window.deleteSymbol = async function (symbol) {
  const ok = await spConfirm('🗑️', '종목 삭제', `${symbol} 종목을 삭제할까요?`, '삭제', '#ef4444');
  if (!ok) return;
  try {
    const res = await fetch('/api/trade4/settings');
    const d = await res.json();
    const symbols = (d.symbols || '').split(',').map(s => s.trim()).filter(s => s && s !== symbol);
    await fetch('/api/trade4/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...d, symbols: symbols.join(',') })
    });
    renderAtSavedSettings();
  } catch (e) { await spAlert('❌', '삭제 오류', e.message); }
};
window.toggleSymbolActive = async function (symbol, toggleEl) {
  const current = toggleEl.dataset.active === '1';
  const next = !current;
  // 활성화 시 3개 제한 체크
  if (next) {
    try {
      const res = await fetch('/api/trade4/settings');
      const d = await res.json();
      const activeSymbols = (d.symbols || '').split(',').map(s => s.trim()).filter(Boolean);
      // 현재 활성 종목 수 (토글 ON인 것들)
      const activeTogs = document.querySelectorAll('[id^="at-toggle-"][data-active="1"]');
      if (activeTogs.length >= 3) {
        await spAlert('⚠️', '활성화 한도 초과', `자동매매는 최대 3종목까지 동시에 활성화할 수 있어요.\n현재 ${activeTogs.length}개 활성 중 — 다른 종목을 비활성화 후 시도하세요.`);
        return;
      }
    } catch (e) { }
  }
  // 시각적 즉시 반영
  toggleEl.style.background = next ? '#10b981' : '#d1d5db';
  toggleEl.dataset.active = next ? '1' : '0';
  const knob = document.getElementById(`at-toggle-knob-${symbol}`);
  if (knob) knob.style.left = next ? '20px' : '2px';
  const label = document.getElementById(`at-toggle-label-${symbol}`);
  if (label) label.textContent = next ? '활성' : '비활성';
  try {
    const res = await fetch('/api/trade4/settings');
    const d = await res.json();
    let symbols = (d.symbols || '').split(',').map(s => s.trim()).filter(Boolean);
    if (next) {
      if (!symbols.includes(symbol)) symbols.push(symbol);
    } else {
      symbols = symbols.filter(s => s !== symbol);
    }
    await fetch('/api/trade4/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...d, symbols: symbols.join(',') })
    });
  } catch (e) { console.error('종목 토글 오류:', e); }
};
// 페이지 로드 시 실행
