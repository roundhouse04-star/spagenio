// ============================================================
// search.js — 종목 검색 / 데이터수집 / 히스토리
// 원본 stock.js 라인 1234-1653 에서 분할 (모놀리식 정리)
// 모든 함수는 global scope (classic <script>) — 다른 파일에서 호출 가능
// ============================================================

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
        <div onclick="dcSelectSymbol(${_jsAttr(r.symbol)}, ${_jsAttr(r.name)})"
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

  } catch (e) {
    resultEl.innerHTML = _safeHTML(`<div style="padding:14px;color:#ef4444;font-size:0.88rem;">오류: ${e.message}</div>`);
  }
}

// 선택된 종목 목록
let _dcSelectedSymbols = [];
let _dcActiveSymbol = '';

function dcSelectSymbol(symbol, name) {
  const resultEl = document.getElementById('dc-search-result');
  if (resultEl) resultEl.style.display = 'none';
  const input = document.getElementById('dc-search-input');
  if (input) input.value = '';

  if (_dcSelectedSymbols.find(s => s.symbol === symbol)) {
    spAlert(`${symbol}은 이미 선택된 종목입니다.`, '중복 선택', 'ℹ️');
    return;
  }
  if (_dcSelectedSymbols.length >= 5) {
    spAlert('최대 5종목까지 선택 가능합니다.', '종목 초과', '⚠️');
    return;
  }

  _dcSelectedSymbols.push({ symbol, name });
  // 첫 선택 시 자동 활성화
  if (_dcSelectedSymbols.length === 1) _dcActiveSymbol = symbol;
  dcRenderSelectedSymbols();
}

function dcSwitchSymbol(symbol) {
  _dcActiveSymbol = symbol;
  const quantSymbol = document.getElementById('quantSymbol');
  if (quantSymbol) quantSymbol.value = symbol;
  const dcSymbols = document.getElementById('dc-symbols');
  if (dcSymbols) dcSymbols.value = symbol;
  dcRenderSelectedSymbols();
  // 해당 종목 자동 분석
  runQuantAnalysis();
  // 히스토리 직접 호출 (quant 서버 실패 시에도 표시)
  if (typeof loadHistoryData === 'function') loadHistoryData();
}

function dcRemoveSymbol(symbol) {
  _dcSelectedSymbols = _dcSelectedSymbols.filter(s => s.symbol !== symbol);
  if (_dcActiveSymbol === symbol) {
    _dcActiveSymbol = _dcSelectedSymbols[0]?.symbol || '';
  }
  dcRenderSelectedSymbols();
}

function dcRenderSelectedSymbols() {
  const badge = document.getElementById('dc-symbol-badge');
  if (!badge) return;

  if (!_dcSelectedSymbols.length) {
    badge.innerHTML = '<span style="color:#9ca3af;font-weight:400;">종목을 검색해서 선택하세요</span>';
  } else {
    badge.innerHTML = _dcSelectedSymbols.map(s => {
      const isActive = s.symbol === _dcActiveSymbol;
      return `<span style="display:inline-flex;align-items:center;gap:4px;background:${isActive ? '#6366f1' : '#eef2ff'};color:${isActive ? '#fff' : '#6366f1'};font-weight:700;font-size:0.85rem;padding:4px 10px;border-radius:999px;margin:2px;cursor:pointer;transition:all 0.15s;"
        onclick="dcSwitchSymbol(${_jsAttr(s.symbol)})">
        ${s.symbol}
        <button onclick="event.stopPropagation();dcRemoveSymbol(${_jsAttr(s.symbol)})"
          style="background:none;border:none;cursor:pointer;color:${isActive ? 'rgba(255,255,255,0.7)' : '#9ca3af'};font-size:0.9rem;padding:0;line-height:1;"
          title="제거">✕</button>
      </span>`;
    }).join('');
  }

  const symbols = _dcSelectedSymbols.map(s => s.symbol);
  const quantSymbol = document.getElementById('quantSymbol');
  const dcSymbols = document.getElementById('dc-symbols');
  const batchInput = document.getElementById('quantBatchSymbols');
  if (quantSymbol) quantSymbol.value = _dcActiveSymbol || symbols[0] || '';
  if (dcSymbols) dcSymbols.value = _dcActiveSymbol || symbols[0] || '';
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
let _stockSearchTarget = '';
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
  if (_searchTargetId === 'bt-symbol') {
    const display = document.getElementById('bt-symbol-display');
    const ph = document.getElementById('bt-symbol-placeholder');
    if (display) {
      if (ph) ph.style.display = 'none';
      // 기존 텍스트 노드 제거 후 추가
      display.querySelectorAll('.bt-symbol-text').forEach(e => e.remove());
      const span = document.createElement('span');
      span.className = 'bt-symbol-text';
      span.style.cssText = 'font-weight:700;color:#6366f1;';
      span.textContent = symbol;
      display.appendChild(span);
    }
  }

  closeStockSearch();

  // 주식 탭 tradeSymbol 선택 시 현재가 자동 설정 + 호가창 로드
  if (_searchTargetId === 'tradeSymbol') {
    setTimeout(() => { if (typeof loadOrderBook === 'function') loadOrderBook(); }, 100);
    fetch('/proxy/stock/api/stock/price?symbol=' + symbol)
      .then(r => r.json())
      .then(d => {
        const price = d.price || d.regularMarketPrice;
        const priceEl = document.getElementById('tradePrice');
        if (price && priceEl) {
          priceEl.value = parseFloat(price).toFixed(2);
          if (typeof _tradeCurrency !== 'undefined') _tradeCurrency = 'USD';
          const btn = document.getElementById('tradeCurrencyBtn');
          if (btn) btn.textContent = 'USD';
        }
      }).catch(() => { });
  }
}

function stockRenderSymbolBadge() {
  const badge = document.getElementById('stock-symbol-badge');
  const placeholder = document.getElementById('stock-symbol-placeholder');
  const input = document.getElementById('stockSymbols');
  if (!badge || !input) return;
  const symbols = input.value.split(',').map(s => s.trim()).filter(Boolean);
  if (placeholder) placeholder.style.display = symbols.length ? 'none' : 'inline';
  badge.querySelectorAll('.stock-badge-item').forEach(el => el.remove());
  if (!symbols.length) return;
  symbols.forEach(sym => {
    const span = document.createElement('span');
    span.className = 'stock-badge-item';
    span.style.cssText = 'display:inline-flex;align-items:center;gap:4px;background:#eef2ff;color:#6366f1;font-weight:700;font-size:0.82rem;padding:3px 8px;border-radius:999px;';
    span.innerHTML = _safeHTML(`${sym} <button onclick="event.stopPropagation();stockRemoveSymbol(${_jsAttr(sym)})" style="background:none;border:none;cursor:pointer;color:#9ca3af;font-size:0.85rem;padding:0;line-height:1;">✕</button>`);
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
    span.innerHTML = _safeHTML(`${sym} <button onclick="event.stopPropagation();atRemoveSymbol(${_jsAttr(sym)})" style="background:none;border:none;cursor:pointer;color:#9ca3af;font-size:0.85rem;padding:0;line-height:1;">✕</button>`);
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
        <div data-symbol="${r.symbol}" data-name="${r.name || r.shortname || r.longname || r.symbol}" onclick="selectStock(this.dataset.symbol, this.dataset.name)"
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
  } catch (e) {
    el.innerHTML = _safeHTML(`<div style="color:#ef4444;padding:16px;font-size:0.88rem;">오류: ${e.message}</div>`);
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
      if (el) el.innerHTML = _safeHTML(`<div style="padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;color:#065f46;font-size:0.88rem;">
        ✅ ${data.message}<br>
        <span style="color:#6b7280;font-size:0.8rem;">백그라운드에서 수집 중입니다. 1~2분 후 조회해주세요.</span>
      </div>`);
    } else {
      btn.textContent = '❌ 실패';
    }
  } catch (e) {
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
      el.innerHTML = _safeHTML(`<div style="color:#ef4444;padding:8px;">❌ ${symbol}: ${data.error}</div>`);
      return;
    }

    const rows = (data.data || []).slice(-30).reverse().map(r => `
      <tr>
        <td style="padding:8px 12px;color:#6b7280;font-size:0.82rem;">${r.date}</td>
        <td style="padding:8px 12px;text-align:right;">${formatPrice(r.open)}</td>
        <td style="padding:8px 12px;text-align:right;">${formatPrice(r.high)}</td>
        <td style="padding:8px 12px;text-align:right;">${formatPrice(r.low)}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700;color:#6366f1;">${formatPrice(r.close)}</td>
        <td style="padding:8px 12px;text-align:right;color:#6b7280;font-size:0.82rem;">${r.volume?.toLocaleString() || '-'}</td>
      </tr>`).join('');

    el.innerHTML = _safeHTML(`
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
      </div>`);

  } catch (e) {
    el.innerHTML = _safeHTML(`<p style="color:#ef4444;">오류: ${e.message}</p>`);
  }
}

