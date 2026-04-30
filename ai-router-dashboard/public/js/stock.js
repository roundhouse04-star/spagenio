const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const STOCK_API = isLocal ? 'http://localhost:5001' : '/proxy/stock';


// 뒤로가기 금지는 login.html에서만 처리

// ✅ API 요청에 토큰 자동 포함 (checkAuth보다 먼저 선언)
const originalFetch = window.fetch;

// ===== 가격 입력 원/달러 토글 =====
let _tradeCurrency = 'USD'; // 'USD' or 'KRW'
window.toggleTradeCurrency = function () {
  _tradeCurrency = _tradeCurrency === 'USD' ? 'KRW' : 'USD';
  const btn = document.getElementById('tradeCurrencyBtn');
  if (btn) btn.textContent = _tradeCurrency;
};

function getTradePriceUSD() {
  const priceRaw = parseFloat(document.getElementById('tradePrice')?.value || '');
  if (!priceRaw || isNaN(priceRaw)) return null; // 비어있으면 시장가
  if (_tradeCurrency === 'KRW') {
    // 원 → 달러 환산 (현재 환율은 직접 입력값 기준, 약 1350원/달러)
    return parseFloat((priceRaw / 1350).toFixed(2));
  }
  return priceRaw;
}

// ===== 계좌 정보 =====
async function safeJson(res) {
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch (e) { return { ok: false, status: res.status, data: { error: '서버 응답 오류 (JSON 파싱 실패)' } }; }
}

async function loadAccount() {
  const el = document.getElementById('accountCards');
  if (!el) return;

  // 1. 먼저 유저 Alpaca 키 등록 여부 확인
  try {
    const keyRes = await fetch('/api/user/broker-keys');
    const { ok, data: keyData } = await safeJson(keyRes);

    if (!ok || !keyData.registered) {
      el.innerHTML = `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;width:100%;">
          <div style="font-weight:700;color:#92400e;margin-bottom:6px;">🔑 Alpaca Not Connected</div>
          <div style="color:#78350f;font-size:0.88rem;margin-bottom:12px;">Register your Alpaca API key above to view account info.</div>
          <button onclick="toggleAlpacaKeyForm();document.getElementById('alpacaKeyForm').scrollIntoView({behavior:'smooth'})"
            style="background:#6366f1;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;font-size:0.85rem;">
            + Connect Now
          </button>
        </div>`;
      return;
    }

    // 2. 유저 키로 계좌 조회
    const alpacaRes = await fetch('/api/alpaca-user/v2/account');
    const { ok: alpacaOk, status: alpacaStatus, data } = await safeJson(alpacaRes);

    // 계좌 Delete/정지/오류 처리
    if (!alpacaOk || data.code || data.message) {
      const msg = data.message || data.error || '계좌 정보를 가져올 수 없습니다.';

      // 403/401 = 키 만료 또는 계좌 없음
      if (alpacaStatus === 403 || alpacaStatus === 401) {
        el.innerHTML = `
          <div style="background:#fff0f0;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;width:100%;">
            <div style="font-weight:700;color:#dc2626;margin-bottom:6px;">❌ Alpaca Connection Failed</div>
            <div style="color:#991b1b;font-size:0.88rem;margin-bottom:12px;">
              API 키가 만료됐거나 계좌가 Delete된 것 같습니다.<br/>
              키를 다시 확인하거나 Delete 후 재등록해주세요.
            </div>
            <button onclick="deleteAlpacaKeys()"
              style="background:#ef4444;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;font-size:0.85rem;">
              🗑️ Remove Key
            </button>
          </div>`;
        return;
      }

      el.innerHTML = `<div style="background:#fff0f0;border:1px solid #fecaca;border-radius:10px;padding:14px 16px;color:#dc2626;font-size:0.88rem;">⚠️ ${msg}</div>`;
      return;
    }

    // 3. 정상 계좌 표시
    const activeAcc = keyData.accounts?.find(a => a.is_active) || keyData.accounts?.[0];
    const mode = activeAcc?.alpaca_paper ? '🧪 Paper' : '💰 Live';
    el.innerHTML = `
      <div class="account-metric"><div class="lbl">Cash</div><div class="val" style="color:#4f8fff;">$${parseFloat(data.cash).toLocaleString()}</div></div>
      <div class="account-metric"><div class="lbl">Portfolio</div><div class="val" style="color:#10b981;">$${parseFloat(data.portfolio_value).toLocaleString()}</div></div>
      <div class="account-metric"><div class="lbl">Buying Power</div><div class="val" style="color:#f59e0b;">$${parseFloat(data.buying_power).toLocaleString()}</div></div>
      <div class="account-metric"><div class="lbl">Equity</div><div class="val" style="color:#a78bfa;">$${parseFloat(data.equity).toLocaleString()}</div></div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="mini-card" style="color:#ef4444;">서버 연결 Error: ${e.message}</div>`;
  }
}

// ===== 주식 가격 =====
async function loadPrices() {
  const symbols = document.getElementById('stockSymbols').value?.trim();
  const priceCards = document.getElementById('priceCards');
  if (!symbols) {
    priceCards.innerHTML = '<div style="color:#9ca3af;font-size:0.88rem;padding:12px;">종목을 먼저 검색해주세요.</div>';
    return;
  }
  try {
    priceCards.innerHTML = '<div style="color:#9ca3af;font-size:0.85rem;padding:12px;">⏳ 조회 중...</div>';
    const res = await fetch(`${STOCK_API}/api/stock/prices?symbols=${symbols}`);
    const data = await res.json();
    if (!data.stocks?.length) {
      priceCards.innerHTML = '<div style="color:#9ca3af;font-size:0.88rem;padding:12px;">조회된 종목이 없습니다.</div>';
      return;
    }
    priceCards.innerHTML = data.stocks.map(s => `
      <div class="price-card" onclick="openChart('${s.symbol}')" style="cursor:pointer;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span class="symbol">${s.symbol}</span>
          <span style="font-size:0.7rem;color:#4B5563;">📈 차트</span>
        </div>
        <span class="price">$${s.price ?? '-'}</span><br>
        <span class="change ${(s.change ?? 0) >= 0 ? 'up' : 'down'}">
          ${(s.change ?? 0) >= 0 ? '▲' : '▼'} ${Math.abs(s.change ?? 0)} (${s.change_pct?.toFixed(2) ?? '0.00'}%)
        </span>
      </div>
    `).join('');
  } catch (e) {
    priceCards.innerHTML = '<div class="mini-card">가격 조회 실패</div>';
  }
}

// ===== 매수 =====
async function buyStock() {
  const symbol = document.getElementById('tradeSymbol').value.trim().toUpperCase();
  const qtyRaw = document.getElementById('tradeQty').value;
  const resultEl = document.getElementById('tradeResult');

  // 계좌 선택 여부 체크
  if (!window.selectedAccountId && !window.activeAccountId) {
    await spAlert('거래할 계좌를 먼저 선택해주세요', '계좌 미선택', '🔑'); return;
  }

  // 수정1: 입력값 검증
  if (!symbol) { await spAlert('종목 심볼을 입력해주세요', '입력 오류', '⚠️'); return; }
  const qty = parseInt(qtyRaw);
  if (!qty || qty < 1 || isNaN(qty)) { await spAlert('수량은 1 이상 정수로 입력해주세요', '입력 오류', '⚠️'); return; }

  // 수정2: 장 시간 체크 (EST 09:30~16:00)
  const now = new Date();
  const estHour = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }).format(now));
  const estMin = parseInt(new Intl.DateTimeFormat('en-US', { minute: 'numeric', timeZone: 'America/New_York' }).format(now));
  const estTime = estHour * 60 + estMin;
  if (estTime < 9 * 60 + 30 || estTime >= 16 * 60) {
    const ok = await spConfirm(
      `현재 미국 장외 시간입니다 (EST ${String(estHour).padStart(2, '0')}:${String(estMin).padStart(2, '0')}).
장외 매수 주문은 다음날 체결될 수 있어요. 계속할까요?`,
      '장외 시간 경고', '⚠️', '계속', '#f59e0b'
    );
    if (!ok) return;
  }

  resultEl.style.color = 'var(--muted)';
  resultEl.textContent = '⏳ 잔고 확인 중...';
  try {
    const keyRes = await fetch('/api/user/broker-keys');
    const keyData = await keyRes.json();
    if (!keyData.registered) {
      resultEl.style.color = 'var(--red)';
      resultEl.textContent = '❌ Alpaca 키가 등록되지 않았습니다. 위에서 먼저 등록해주세요.';
      return;
    }

    // ✅ 체크1: 계좌 잔고 조회
    const accountRes = await fetch('/api/alpaca-user/v2/account');
    const accountData = await accountRes.json();
    const buyingPower = parseFloat(accountData.buying_power) || 0;

    // ✅ 체크2: 현재가 조회 + 종목 유효성 검증
    const priceRes = await fetch(`/proxy/stock/api/stock/prices?symbols=${symbol}`);
    const priceData = await priceRes.json();
    const stockInfo = priceData.stocks?.[0];
    const currentPrice = stockInfo?.price || 0;

    if (!stockInfo || currentPrice <= 0) {
      await spAlert(
        `${symbol} 종목을 찾을 수 없습니다.\n심볼을 다시 확인해주세요.`,
        '종목 없음', '❌'
      );
      resultEl.style.color = 'var(--red)';
      resultEl.textContent = `❌ ${symbol} 종목을 찾을 수 없습니다.`;
      return;
    }

    // ✅ 체크3: 이미 보유 중인 종목 경고
    try {
      const posRes = await fetch(`/api/alpaca-user/v2/positions/${symbol}`);
      if (posRes.ok) {
        const posData = await posRes.json();
        const heldQty = parseFloat(posData.qty) || 0;
        const avgPrice = parseFloat(posData.avg_entry_price) || 0;
        const ok = await spConfirm(
          `${symbol}을 이미 ${heldQty}주 보유 중입니다 (평균단가 $${avgPrice.toFixed(2)}).\n추가 매수할까요?`,
          '이미 보유 중', '⚠️', '추가 매수', '#f59e0b'
        );
        if (!ok) { resultEl.textContent = ''; return; }
      }
    } catch (e) { }

    // ✅ 체크4: 잔고 부족 (최대 매수 가능 수량 안내)
    const totalCost = currentPrice * qty;
    if (totalCost > buyingPower) {
      const maxQty = Math.floor(buyingPower / currentPrice);
      await spAlert(
        `잔고가 부족합니다.\n\n필요 금액: $${totalCost.toFixed(2)}\n매수 가능 금액: $${buyingPower.toFixed(2)}\n최대 매수 가능 수량: ${maxQty}주`,
        '잔고 부족', '💰'
      );
      resultEl.style.color = 'var(--red)';
      resultEl.textContent = `❌ 잔고 부족 — 필요: $${totalCost.toFixed(2)} / 보유: $${buyingPower.toFixed(2)} / 최대: ${maxQty}주`;
      return;
    }

    // ✅ 체크5: 최종 매수 확인 팝업 (현재가/예상금액/잔여매수력)
    const confirmBuy = await spConfirm(
      `${symbol} ${qty}주 매수할까요?\n\n현재가: $${currentPrice.toFixed(2)}\n예상 금액: $${totalCost.toFixed(2)}\n매수 후 잔여 매수력: $${(buyingPower - totalCost).toFixed(2)}`,
      '매수 확인', '🟢', '매수', '#10b981'
    );
    if (!confirmBuy) { resultEl.textContent = ''; return; }

    resultEl.textContent = '⏳ 주문 중...';

    // ✅ 매수 전 동일 계좌+종목 중복 체크
    const brokerId = window.selectedAccountId || window.activeAccountId || null;
    const dupCheck = await fetch('/api/manual-trade/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, action: 'CHECK', qty, price: currentPrice, broker_key_id: brokerId })
    });
    const dupData = await dupCheck.json();
    if (dupData.duplicate) {
      resultEl.style.color = 'var(--red)';
      resultEl.textContent = `❌ ${dupData.error}`;
      return;
    }

    const res = await fetch('/api/alpaca-user/v2/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify((() => {
        const limitPrice = getTradePriceUSD();
        return limitPrice
          ? { symbol, qty, side: 'buy', type: 'limit', limit_price: limitPrice, time_in_force: 'day' }
          : { symbol, qty, side: 'buy', type: 'market', time_in_force: 'day' };
      })())
    });
    const data = await res.json();
    if (res.ok && data.id) {
      resultEl.style.color = 'var(--green)';
      resultEl.textContent = `✅ 매수 주문 완료\n종목: ${symbol} / 수량: ${qty}주\n주문ID: ${data.id}`;
      // ✅ trade_log에 수동 매수 기록 (trade_type=1)
      await fetch('/api/manual-trade/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, action: 'BUY', qty, price: currentPrice, order_id: data.id, reason: '수동 매수', broker_key_id: window.selectedAccountId || window.activeAccountId || null })
      }).catch(() => { });
    } else {
      resultEl.style.color = 'var(--red)';
      resultEl.textContent = `❌ 오류: ${data.message || data.error || JSON.stringify(data)}`;
    }
    setTimeout(() => { loadAccount(); loadPositions(); loadOrders(); }, 1500);
  } catch (e) {
    resultEl.style.color = 'var(--red)';
    resultEl.textContent = `❌ 오류: ${e.message}`;
  }
}

// ===== 매도 =====
async function sellStock() {
  const symbol = document.getElementById('tradeSymbol').value.trim().toUpperCase();
  const qtyRaw = document.getElementById('tradeQty').value;
  const resultEl = document.getElementById('tradeResult');

  // 수정1: 입력값 검증
  if (!symbol) { await spAlert('종목 심볼을 입력해주세요', '입력 오류', '⚠️'); return; }
  const qty = parseInt(qtyRaw);
  if (!qty || qty < 1 || isNaN(qty)) { await spAlert('수량은 1 이상 정수로 입력해주세요', '입력 오류', '⚠️'); return; }

  // ✅ 보유 수량 체크: 포지션 없거나 수량 부족하면 차단
  try {
    const posRes = await fetch(`/api/alpaca-user/v2/positions/${symbol}`);
    if (posRes.status === 404) {
      await spAlert(`${symbol} 보유 포지션이 없습니다.
보유하지 않은 종목은 매도할 수 없어요.`, '포지션 없음', '❌');
      return;
    }
    if (posRes.ok) {
      const posData = await posRes.json();
      const heldQty = parseFloat(posData.qty) || 0;
      if (qty > heldQty) {
        await spAlert(
          `보유 수량이 부족합니다.

매도 요청: ${qty}주
보유 수량: ${heldQty}주`,
          '수량 부족', '❌'
        );
        return;
      }
      // 매도 확인 팝업 (현재 손익 포함)
      const pl = parseFloat(posData.unrealized_pl) || 0;
      const plPct = (parseFloat(posData.unrealized_plpc) || 0) * 100;
      const plStr = `${pl >= 0 ? '+' : ''}$${pl.toFixed(2)} (${plPct >= 0 ? '+' : ''}${plPct.toFixed(2)}%)`;
      const ok = await spConfirm(
        `${symbol} ${qty}주를 매도할까요?

현재 손익: ${plStr}
보유 수량: ${heldQty}주`,
        '매도 확인', '🔴', '매도', '#ef4444'
      );
      if (!ok) return;
    }
  } catch (e) {
    // 포지션 조회 실패 시 그냥 진행 (경고만)
    const ok = await spConfirm(`${symbol} ${qty}주를 매도할까요?`, '매도 확인', '🔴', '매도', '#ef4444');
    if (!ok) return;
  }

  // 장 시간 체크
  const now = new Date();
  const estHour = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }).format(now));
  const estMin = parseInt(new Intl.DateTimeFormat('en-US', { minute: 'numeric', timeZone: 'America/New_York' }).format(now));
  const estTime = estHour * 60 + estMin;
  if (estTime < 9 * 60 + 30 || estTime >= 16 * 60) {
    const proceed = await spConfirm(
      `현재 미국 장외 시간입니다 (EST ${String(estHour).padStart(2, '0')}:${String(estMin).padStart(2, '0')}).
장외 매도 주문은 다음날 체결될 수 있어요. 계속할까요?`,
      '장외 시간 경고', '⚠️', '계속', '#f59e0b'
    );
    if (!proceed) return;
  }

  resultEl.style.color = 'var(--muted)';
  resultEl.textContent = '⏳ 주문 중...';
  try {
    const keyRes = await fetch('/api/user/broker-keys');
    const keyData = await keyRes.json();
    if (!keyData.registered) {
      resultEl.style.color = 'var(--red)';
      resultEl.textContent = '❌ Alpaca 키가 등록되지 않았습니다.';
      return;
    }
    // 수정4: time_in_force gtc→day
    const res = await fetch('/api/alpaca-user/v2/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify((() => {
        const limitPrice = getTradePriceUSD();
        return limitPrice
          ? { symbol, qty, side: 'sell', type: 'limit', limit_price: limitPrice, time_in_force: 'day' }
          : { symbol, qty, side: 'sell', type: 'market', time_in_force: 'day' };
      })())
    });
    const data = await res.json();
    if (res.ok && data.id) {
      resultEl.style.color = 'var(--red)';
      resultEl.textContent = `✅ 매도 주문 완료\n종목: ${symbol} / 수량: ${qty}주\n주문ID: ${data.id}`;
      // ✅ trade_log에 수동 매도 기록 (trade_type=1)
      await fetch('/api/manual-trade/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, action: 'SELL', qty, price: parseFloat(data.filled_avg_price || currentPrice || 0), order_id: data.id, reason: '수동 매도', broker_key_id: window.selectedAccountId || window.activeAccountId || null })
      }).catch(() => { });
    } else {
      resultEl.textContent = `❌ Error: ${data.message || data.error || JSON.stringify(data)}`;
    }
    loadAccount(); loadPositions();
  } catch (e) {
    resultEl.textContent = `❌ Error: ${e.message}`;
  }
}

// ===== 보유 Symbol =====
async function loadPositions() {
  try {
    // ✅ trade_log type=1(수동) active 조회 + Alpaca 실제 포지션으로 현재가 보완
    const [manualRes, alpacaRes] = await Promise.all([
      fetch('/api/manual-trade/positions'),
      fetch('/api/alpaca-user/v2/positions')
    ]);
    const manualData = manualRes.ok ? await manualRes.json() : { positions: [] };
    const alpacaData = alpacaRes.ok ? await alpacaRes.json() : [];

    if (manualData.error && manualData.error.includes('계좌')) {
      document.getElementById('positionsTable').innerHTML = '<p style="color:var(--muted)">🔑 Alpaca 계좌를 먼저 등록해주세요.</p>';
      return;
    }

    const manualPositions = manualData.positions || [];
    const alpacaPositions = Array.isArray(alpacaData) ? alpacaData : (alpacaData.positions || []);

    // Alpaca 포지션을 symbol 기준으로 맵핑 (현재가/손익 보완용)
    const alpacaMap = {};
    alpacaPositions.forEach(p => { alpacaMap[p.symbol] = p; });

    // 수동 포지션 없으면 빈 메시지
    const positions = manualPositions.map(m => {
      const ap = alpacaMap[m.symbol] || {};
      return {
        symbol: m.symbol,
        qty: m.qty,
        avg_entry_price: m.price,
        current_price: ap.current_price || m.price,
        market_value: (ap.current_price || m.price) * m.qty,
        unrealized_pl: ap.unrealized_pl || 0,
        unrealized_plpc: ap.unrealized_plpc || 0,
      };
    });

    if (!positions.length) {
      document.getElementById('positionsTable').innerHTML = '<p style="color:var(--muted)">보유 종목이 없습니다</p>';
      return;
    }
    document.getElementById('positionsTable').innerHTML = `
      <table class="stock-table">
        <thead><tr><th>종목</th><th>수량</th><th>평균단가</th><th>현재가</th><th>평가금액</th><th>손익</th><th>실시간</th></tr></thead>
        <tbody>
          ${positions.map(p => {
      const pl = parseFloat(p.unrealized_pl) || 0;
      const plpc = parseFloat(p.unrealized_plpc) || 0;
      return `
            <tr>
              <td><strong style="cursor:pointer;color:#6366f1;" onclick="showRealtimePrice('${p.symbol}')">${p.symbol}</strong></td>
              <td>${p.qty}주</td>
              <td>$${parseFloat(p.avg_entry_price).toFixed(2)}</td>
              <td>$${parseFloat(p.current_price).toFixed(2)}</td>
              <td>$${parseFloat(p.market_value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td class="${pl >= 0 ? 'text-up' : 'text-down'}">
                ${pl >= 0 ? '+' : ''}$${pl.toFixed(2)}<br>
                <small>(${plpc >= 0 ? '+' : ''}${(plpc * 100).toFixed(2)}%)</small>
              </td>
              <td><button class="sp-btn sp-btn-outline sp-btn-sm" onclick="showRealtimePrice('${p.symbol}')">📈 조회</button></td>
            </tr>`;
    }).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    document.getElementById('positionsTable').innerHTML = '<p style="color:var(--muted)">Stock server connection failed</p>';
  }
}

// 실시간 가격 팝업
window.showRealtimePrice = async function (symbol) {
  const modal = document.getElementById('realtimeModal');
  const title = document.getElementById('realtimeTitle');
  const body = document.getElementById('realtimeBody');
  if (!modal) return;
  title.textContent = `📈 ${symbol} 실시간 정보`;
  body.innerHTML = '<div style="text-align:center;padding:32px;color:#6b7280;">로딩 중...</div>';
  modal.style.display = 'flex';

  try {
    // 현재 포지션 정보
    const posRes = await fetch('/api/alpaca-user/v2/positions/' + symbol);
    const posData = await posRes.json();

    // yfinance로 현재가 조회
    const priceRes = await fetch('/proxy/stock/price?symbol=' + symbol);
    const priceData = await priceRes.json();
    const latestPrice = parseFloat(priceData?.price || priceData?.regularMarketPrice || 0) || parseFloat(posData?.current_price || 0);
    const latestBar = {};
    const pl = parseFloat(posData?.unrealized_pl) || 0;
    const plpc = (parseFloat(posData?.unrealized_plpc) || 0) * 100;

    body.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div style="background:#f8fafc;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:0.78rem;color:#6b7280;margin-bottom:4px;">현재가</div>
          <div style="font-size:1.6rem;font-weight:800;color:#6366f1;">$${(parseFloat(latestPrice) || 0).toFixed(2)}</div>
        </div>
        <div style="background:#f8fafc;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:0.78rem;color:#6b7280;margin-bottom:4px;">평균단가</div>
          <div style="font-size:1.6rem;font-weight:800;color:#374151;">$${parseFloat(posData?.avg_entry_price || 0).toFixed(2)}</div>
        </div>
        <div style="background:#f8fafc;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:0.78rem;color:#6b7280;margin-bottom:4px;">보유 수량</div>
          <div style="font-size:1.4rem;font-weight:800;color:#374151;">${posData?.qty || '-'}주</div>
        </div>
        <div style="background:#f8fafc;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:0.78rem;color:#6b7280;margin-bottom:4px;">평가금액</div>
          <div style="font-size:1.4rem;font-weight:800;color:#374151;">$${parseFloat(posData?.market_value || 0).toFixed(2)}</div>
        </div>
      </div>
      <div style="background:${pl >= 0 ? '#dcfce7' : '#fee2e2'};border-radius:10px;padding:16px;text-align:center;margin-bottom:16px;">
        <div style="font-size:0.82rem;color:#6b7280;margin-bottom:4px;">미실현 손익</div>
        <div style="font-size:1.4rem;font-weight:800;color:${pl >= 0 ? '#065f46' : '#991b1b'};">
          ${pl >= 0 ? '+' : ''}$${pl.toFixed(2)} (${plpc >= 0 ? '+' : ''}${plpc.toFixed(2)}%)
        </div>
      </div>
      ${latestBar.o ? `
      <div style="background:#f8fafc;border-radius:10px;padding:12px;">
        <div style="font-size:0.78rem;font-weight:700;color:#374151;margin-bottom:8px;">최근 바 데이터</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:0.82rem;text-align:center;">
          <div><div style="color:#6b7280;">시가</div><div style="font-weight:700;">$${parseFloat(latestBar.o).toFixed(2)}</div></div>
          <div><div style="color:#6b7280;">고가</div><div style="font-weight:700;color:#065f46;">$${parseFloat(latestBar.h).toFixed(2)}</div></div>
          <div><div style="color:#6b7280;">저가</div><div style="font-weight:700;color:#991b1b;">$${parseFloat(latestBar.l).toFixed(2)}</div></div>
          <div><div style="color:#6b7280;">종가</div><div style="font-weight:700;">$${parseFloat(latestBar.c).toFixed(2)}</div></div>
        </div>
      </div>` : ''}
      <div style="margin-top:12px;text-align:right;">
        <button onclick="showRealtimePrice('${symbol}')" class="sp-btn sp-btn-outline sp-btn-sm" style="margin-right:8px;">🔄 새로고침</button>
        <button onclick="document.getElementById('realtimeModal').style.display='none'" class="sp-btn sp-btn-indigo sp-btn-sm">닫기</button>
      </div>`;
  } catch (e) {
    body.innerHTML = `<div style="color:#ef4444;padding:16px;">로드 실패: ${e.message}</div>`;
  }
};

// ===== 주문 내역 =====
async function loadOrders() {
  try {
    const res = await fetch('/api/alpaca-user/v2/orders?status=all&limit=50');
    const data = await res.json();
    if (data.no_account || !res.ok) {
      document.getElementById('ordersTable').innerHTML = '<p style="color:var(--muted)">🔑 Alpaca 계좌를 먼저 등록해주세요.</p>';
      return;
    }
    // 수정6: Alpaca는 주문을 배열로 직접 반환
    const orders = Array.isArray(data) ? data : (data.orders || []);
    if (!orders.length) {
      document.getElementById('ordersTable').innerHTML = '<p style="color:var(--muted)">주문 내역이 없습니다</p>';
      return;
    }
    const statusMap = { filled: '체결', partially_filled: '부분체결', canceled: '취소', pending_new: '대기', new: '접수', expired: '만료' };
    document.getElementById('ordersTable').innerHTML = `
      <div style="font-size:0.82rem;color:#6b7280;margin-bottom:8px;">최근 ${orders.length}건</div>
      <table class="stock-table">
        <thead><tr><th>종목</th><th>구분</th><th>수량</th><th>주문유형</th><th>상태</th><th>체결가</th><th>체결금액</th><th>날짜</th></tr></thead>
        <tbody>
          ${orders.map(o => {
      const isBuy = o.side?.includes('buy');
      const filled = parseFloat(o.filled_avg_price) || 0;
      const qty = parseFloat(o.filled_qty || o.qty) || 0;
      const total = filled * qty;
      const status = statusMap[o.status] || o.status;
      const date = o.filled_at && o.filled_at !== 'None' ? o.filled_at.slice(0, 10) : (o.submitted_at?.slice(0, 10) || '-');
      return `
            <tr>
              <td><strong>${o.symbol}</strong></td>
              <td><span style="padding:2px 8px;border-radius:999px;font-size:0.75rem;font-weight:700;background:${isBuy ? '#dcfce7' : '#fee2e2'};color:${isBuy ? '#065f46' : '#991b1b'}">${isBuy ? '매수' : '매도'}</span></td>
              <td>${o.qty}주</td>
              <td style="font-size:0.8rem;">${o.order_type || '-'}</td>
              <td><span style="padding:2px 8px;border-radius:999px;font-size:0.75rem;background:#f3f4f6;color:#374151;">${status}</span></td>
              <td>${filled ? '$' + filled.toFixed(2) : '-'}</td>
              <td>${total ? '$' + total.toFixed(2) : '-'}</td>
              <td style="font-size:0.8rem;">${date}</td>
            </tr>`;
    }).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    document.getElementById('ordersTable').innerHTML = '<p style="color:var(--muted)">Stock server connection failed</p>';
  }
}

// ===== 뉴스 =====
// ===== 호가창 =====
let _obRefreshTimer = null;

async function loadOrderBook() {
  const symbol = document.getElementById('tradeSymbol')?.value?.trim().toUpperCase();
  const priceEl = document.getElementById('obPriceCard');
  const tableEl = document.getElementById('obTable');
  const statusEl = document.getElementById('obStatus');
  if (!symbol || symbol.length < 1) return;

  if (statusEl) statusEl.textContent = '조회 중...';

  try {
    // yfinance 실시간 가격 조회 (Alpaca data API 호출 없음)
    const [priceRes, histRes] = await Promise.all([
      fetch(`/proxy/stock/api/stock/price?symbol=${symbol}`),
      fetch(`/proxy/stock/api/stock/history?symbol=${symbol}&period=5`),
    ]);
    const stockInfo = priceRes.ok ? await priceRes.json() : {};
    const histData = histRes.ok ? await histRes.json() : {};

    // 오늘 고가/저가는 히스토리 마지막 행에서
    const todayBar = (histData.data || []).slice(-1)[0] || {};

    const latestPrice = parseFloat(stockInfo.price) || 0;
    // tradePrice 입력란에 현재가 자동 설정
    const tradePriceEl = document.getElementById('tradePrice');
    if (latestPrice > 0 && tradePriceEl) {
      tradePriceEl.value = latestPrice.toFixed(2);
      if (typeof _tradeCurrency !== 'undefined') _tradeCurrency = 'USD';
      const currBtn = document.getElementById('tradeCurrencyBtn');
      if (currBtn) currBtn.textContent = 'USD';
    }
    const askPrice = latestPrice > 0 ? parseFloat((latestPrice + 0.01).toFixed(2)) : 0;
    const bidPrice = latestPrice > 0 ? parseFloat((latestPrice - 0.01).toFixed(2)) : 0;
    const askSize = 0;
    const bidSize = 0;
    const open = parseFloat(stockInfo.open) || latestPrice;
    const high = parseFloat(todayBar.high) || latestPrice;
    const low = parseFloat(todayBar.low) || latestPrice;
    const prevClose = parseFloat(stockInfo.price) || latestPrice;
    const volume = stockInfo.volume || 0;

    const change = latestPrice - open;
    const changePct = open > 0 ? (change / open * 100) : 0;
    const isUp = change >= 0;
    const upColor = '#16a34a';
    const dnColor = '#dc2626';
    const priceColor = isUp ? upColor : dnColor;

    // ── 현재가 카드 ──
    if (priceEl) {
      priceEl.innerHTML = `
        <div style="margin-bottom:12px;">
          <div style="font-size:1.6rem;font-weight:800;color:${priceColor};">
            $${latestPrice.toFixed(2)}
          </div>
          <div style="font-size:0.82rem;font-weight:700;color:${priceColor};margin-top:2px;">
            ${isUp ? '▲' : '▼'} ${Math.abs(change).toFixed(2)} (${Math.abs(changePct).toFixed(2)}%)
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.78rem;">
          <div style="background:#f8fafc;border-radius:6px;padding:6px 8px;">
            <div style="color:#6B7280;">시가</div>
            <div style="font-weight:700;">$${open.toFixed(2)}</div>
          </div>
          <div style="background:#f8fafc;border-radius:6px;padding:6px 8px;">
            <div style="color:#6B7280;">전일종가</div>
            <div style="font-weight:700;">$${prevClose.toFixed(2)}</div>
          </div>
          <div style="background:#f8fafc;border-radius:6px;padding:6px 8px;">
            <div style="color:#16a34a;">고가</div>
            <div style="font-weight:700;color:#16a34a;">$${high.toFixed(2)}</div>
          </div>
          <div style="background:#f8fafc;border-radius:6px;padding:6px 8px;">
            <div style="color:#dc2626;">저가</div>
            <div style="font-weight:700;color:#dc2626;">$${low.toFixed(2)}</div>
          </div>
        </div>
        <div style="margin-top:10px;font-size:0.75rem;color:#6B7280;border-top:1px solid #f3f4f6;padding-top:8px;">
          거래량: ${volume ? Number(volume).toLocaleString() : '-'}
        </div>`;
    }

    // ── 호가창 ──
    if (tableEl) {
      const spread = askPrice > 0 && bidPrice > 0 ? (askPrice - bidPrice) : 0;
      const spreadPct = bidPrice > 0 ? (spread / bidPrice * 100) : 0;
      const maxSize = Math.max(askSize, bidSize, 1);
      const askBarW = Math.round(askSize / maxSize * 100);
      const bidBarW = Math.round(bidSize / maxSize * 100);

      tableEl.innerHTML = `
        <div style="font-size:0.75rem;color:#6B7280;margin-bottom:6px;font-weight:700;">매도 호가</div>
        <div style="background:#fff0f0;border-radius:8px;padding:10px 12px;margin-bottom:4px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:0.75rem;color:#6B7280;">잔량</span>
            <span style="font-size:0.75rem;color:#6B7280;">매도호가</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:0.82rem;color:#6B7280;">${askSize.toLocaleString()}</span>
            <span style="font-size:1.1rem;font-weight:800;color:#dc2626;">
              $${askPrice > 0 ? askPrice.toFixed(2) : '-'}
            </span>
          </div>
          <div style="margin-top:6px;height:6px;background:#fee2e2;border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${askBarW}%;background:#dc2626;border-radius:3px;float:right;"></div>
          </div>
        </div>

        <div style="text-align:center;font-size:0.72rem;color:#6B7280;padding:6px 0;border-top:1px solid #f3f4f6;border-bottom:1px solid #f3f4f6;margin:4px 0;">
          스프레드 ${spread > 0 ? '$' + spread.toFixed(2) + ' (' + spreadPct.toFixed(3) + '%)' : '-'}
        </div>

        <div style="font-size:0.75rem;color:#6B7280;margin-bottom:6px;margin-top:4px;font-weight:700;">매수 호가</div>
        <div style="background:#f0fdf4;border-radius:8px;padding:10px 12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:0.75rem;color:#6B7280;">잔량</span>
            <span style="font-size:0.75rem;color:#6B7280;">매수호가</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:0.82rem;color:#6B7280;">${bidSize.toLocaleString()}</span>
            <span style="font-size:1.1rem;font-weight:800;color:#16a34a;">
              $${bidPrice > 0 ? bidPrice.toFixed(2) : '-'}
            </span>
          </div>
          <div style="margin-top:6px;height:6px;background:#dcfce7;border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${bidBarW}%;background:#16a34a;border-radius:3px;"></div>
          </div>
        </div>

        <div style="margin-top:10px;font-size:0.72rem;color:#9CA3AF;text-align:center;">
          Alpaca 최우선 호가 (Free Plan)
        </div>`;
    }

    if (statusEl) {
      const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      statusEl.textContent = now + ' 기준';
    }

    // 30초마다 자동 갱신
    clearTimeout(_obRefreshTimer);
    _obRefreshTimer = setTimeout(() => loadOrderBook(), 30000);

  } catch (e) {
    if (priceEl) priceEl.innerHTML = `<div style="color:#ef4444;font-size:0.82rem;padding:12px;">조회 실패: ${e.message}</div>`;
    if (statusEl) statusEl.textContent = '오류';
  }
}

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
        document.getElementById('quantTradeLog')._filterType='${ft.key}';
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

    el.innerHTML = `
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
      </div>`;
  } catch (e) {
    el.innerHTML = `<p style="color:#ef4444;font-size:0.82rem;padding:12px;">로드 실패: ${e.message}</p>`;
  }
}

// 종목 검색 팝업에서 선택 시 호가창도 자동 로드
// 종목 선택 시 호가창 로드 + 현재가 자동 설정


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
          <span style="font-size:1rem;font-weight:800;color:#6366f1;cursor:pointer;text-decoration:underline;" onclick="openChart('${data.symbol}')">${data.symbol} 📈</span>
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
    el.innerHTML = `<p style="color:var(--accent-danger, #ff8f8f)">Quant server connection failed (port 5002)</p>`;
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
    const rows = (data.top10 || []).map((item, i) => `<tr style="cursor:pointer;" onclick="openChart('${item.ticker.includes('.') ? item.ticker : item.ticker + '.KS'}')" onmouseover="this.style.background='rgba(79,143,255,0.05)'" onmouseout="this.style.background=''">
      <td style="font-weight:700;color:#4f8fff;">${i + 1}</td>
      <td><div style="font-weight:700;">${item.name}</div><div style="color:#8E8E93;font-size:0.78rem;">${item.ticker}</div></td>
      <td>${item.price?.toLocaleString()}원</td>
      <td>${item.volume?.toLocaleString()}</td>
      <td>${item.short_ratio?.toFixed(2)}%</td>
      <td style="font-weight:700;color:#4f8fff;">${item.score?.toFixed(1)}</td>
    </tr>`).join('');
    el.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
      <thead><tr style="color:var(--muted);font-size:0.82rem;">
        <th style="padding:8px;">순위</th><th style="padding:8px;text-align:left;">Symbol</th>
        <th style="padding:8px;">Current</th><th style="padding:8px;">Volume</th>
        <th style="padding:8px;">공매도비중</th><th style="padding:8px;">점수</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p style="color:#9CA3AF;font-size:0.78rem;margin-top:8px;">업데이트: ${data.updated_at?.slice(0, 19) || '-'}</p>`;
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
  if (el) el.innerHTML = `<div style="padding:10px 14px;border-radius:8px;background:${enable ? '#dcfce7' : '#fee2e2'};color:${enable ? '#065f46' : '#991b1b'};font-weight:700;font-size:0.88rem;margin-top:8px;">
    ${enable ? '✅ 자동매매 활성화됨 — 1분마다 신호 체크' : '⏹ 자동매매 비활성화됨'}
  </div>`;
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
    el.innerHTML = `<div style="padding:12px 14px;border-radius:8px;background:#f8fafc;border:1px solid #e5e7eb;margin-top:8px;">
      <div style="font-weight:700;margin-bottom:8px;">📊 분석 결과: ${d.message}</div>
      ${resultHtml}
    </div>`;
    loadAutoTradeLog();
  } catch (e) {
    el.innerHTML = `<div style="color:#ef4444;padding:10px;">오류: ${e.message}</div>`;
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
          <button onclick="cancelAutoTrade('${p.symbol}')" class="sp-btn sp-btn-red sp-btn-sm" style="font-size:0.75rem;padding:4px 10px;">취소</button>
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
          <td style="padding:8px;text-align:center;"><span style="padding:2px 8px;border-radius:999px;font-size:0.75rem;font-weight:700;background:${bg};color:${color}">${actionMap[l.action] || l.action}</span></td>
          <td style="padding:8px;text-align:center;">${l.qty}주</td>
          <td style="padding:8px;text-align:center;">$${parseFloat(l.price || 0).toFixed(2)}</td>
          <td style="padding:8px;text-align:center;font-weight:700;color:${isProfit ? '#065f46' : isLoss ? '#991b1b' : '#374151'}">${l.profit_pct ? (l.profit_pct > 0 ? '+' : '') + parseFloat(l.profit_pct).toFixed(2) + '%' : '-'}</td>
          <td style="padding:8px;font-size:0.78rem;color:#6b7280;">${l.reason || ''}</td>
        </tr>`;
    }).join('')}
      </tbody></table>`;
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

  } catch (e) {
    resultEl.innerHTML = `<div style="padding:14px;color:#ef4444;font-size:0.88rem;">오류: ${e.message}</div>`;
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
        onclick="dcSwitchSymbol('${s.symbol}')">
        ${s.symbol}
        <button onclick="event.stopPropagation();dcRemoveSymbol('${s.symbol}')"
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
        <td style="padding:8px 12px;text-align:right;color:#6b7280;font-size:0.82rem;">${r.volume?.toLocaleString() || '-'}</td>
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

  } catch (e) {
    el.innerHTML = `<p style="color:#ef4444;">오류: ${e.message}</p>`;
  }
}

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
            <button onclick="quickRiskCalc('${s.symbol}')" style="margin-top:4px;padding:3px 8px;font-size:0.72rem;background:#eef2ff;color:#6366f1;border:1px solid #c7d2fe;border-radius:6px;cursor:pointer;">리스크 계산</button>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = `<div style="color:#ef4444;padding:12px;font-size:0.85rem;">조회 실패: ${e.message}</div>`;
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
    el.innerHTML = `<div style="color:#ef4444;padding:12px;font-size:0.85rem;">조회 실패: ${e.message}</div>`;
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
    if (!d.ok) { el.innerHTML = `<div style="color:#ef4444;padding:12px;">${d.error}</div>`; return; }
    el.innerHTML = `
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
      </div>`;
  } catch (e) {
    el.innerHTML = `<div style="color:#ef4444;padding:12px;">오류: ${e.message}</div>`;
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
    if (!d.ok) { el.innerHTML = `<div style="color:#ef4444;padding:12px;">${d.error}</div>`; return; }
    if (!d.picks?.length) {
      el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:24px;">현재 조건에 맞는 추천 종목이 없습니다</div>';
      return;
    }

    el.innerHTML = `
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
              <button onclick="quickRiskCalc('${p.symbol}')" style="margin-top:4px;padding:3px 8px;font-size:0.7rem;background:#eef2ff;color:#6366f1;border:1px solid #c7d2fe;border-radius:6px;cursor:pointer;">리스크 계산</button>
            </div>
          </div>`;
    }).join('')}`;
  } catch (e) {
    el.innerHTML = `<div style="color:#ef4444;padding:12px;">오류: ${e.message}</div>`;
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
        stateEl.innerHTML = `
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
          </div>`;
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


// ===== 주식/자동매매/투자자성향/종목분석 (index.html에서 이동) =====
// ===== 전역 변수 =====
let _selectedMarket = 'nasdaq';
let _selectedKrMarket = 'kospi';
let _investorProfile = null; // 투자 성향 캐시
// ============================================================
// 투자 성향 (Investor Profile) 시스템
// ============================================================
const PROFILE_META = {
  aggressive: {
    icon: '🚀', label: '공격형', color: '#dc2626', bg: '#fef2f2', border: '#fecaca',
    desc: '높은 수익을 추구하며 모멘텀 중심으로 투자해요'
  },
  balanced: {
    icon: '📊', label: '균형형', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe',
    desc: '모멘텀과 가치를 균형있게 추구해요'
  },
  moderate: {
    icon: '⚖️', label: '안정성장형', color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd',
    desc: '안정성을 중시하면서 성장도 추구해요'
  },
  conservative: {
    icon: '🛡️', label: '안정형', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0',
    desc: '원금 보존을 최우선으로 안정적으로 투자해요'
  },
  beginner: {
    icon: '🌱', label: '초보형', color: '#92400e', bg: '#fffbeb', border: '#fde68a',
    desc: '대형 우량주 중심의 안전한 투자 전략을 적용해요'
  },
};
// 퀀트 탭 진입 시 성향 확인 → 미등록이면 등록 페이지 표시
async function checkInvestorProfile() {
  try {
    const res = await fetch('/api/investor-profile');
    const d = await res.json();
    if (!d.ok) return;
    const profilePage = document.getElementById('quantProfilePage');
    const profileCard = document.getElementById('investorProfileCard');
    const tabBar = document.querySelector('#tab-quant .sp-page > div:nth-child(3)'); // 탭 선택 div
    const quantPanelUs = document.getElementById('quantPanelUs');
    const quantPanelKr = document.getElementById('quantPanelKr');
    const quantPanelAuto = document.getElementById('quantPanelAuto');
    if (!d.profile || !d.profile.completed) {
      // 미등록 → 성향 등록 페이지 표시, 자동매매 탭/패널 숨김
      profilePage.style.display = '';
      if (profileCard) profileCard.style.display = 'none';
      // 탭바와 패널 숨기기
      document.getElementById('quantTabBar')?.style && (document.getElementById('quantTabBar').style.display = 'none');
      if (quantPanelUs) quantPanelUs.style.display = 'none';
      if (quantPanelKr) quantPanelKr.style.display = 'none';
      if (quantPanelAuto) quantPanelAuto.style.display = 'none';
      const _dayPanel = document.getElementById('quantPanelDay');
      if (_dayPanel) _dayPanel.style.display = 'none';
    } else {
      // 등록 완료 → 성향 등록 페이지 숨기고 자동매매 표시
      profilePage.style.display = 'none';
      _investorProfile = d.profile;
      renderProfileCard(d.profile);
      applyProfileToSettings(d.profile);
      // 탭바 복원
      document.getElementById('quantTabBar')?.style && (document.getElementById('quantTabBar').style.display = '');
    }
  } catch (e) { }
}
// 나중에 하기 → 뉴스 탭으로 이동
window.goToNewsTab = function () {
  const newsBtn = document.getElementById('tab-btn-news') || document.querySelector('[data-tab="news"]');
  if (newsBtn) newsBtn.click();
};
// 성향 등록 페이지 표시 (재설문 포함)
window.showProfilePage = function () {
  const profilePage = document.getElementById('quantProfilePage');
  const profileCard = document.getElementById('investorProfileCard');
  const tabBar = document.getElementById('quantTabBar');
  const usPanel = document.getElementById('quantPanelUs');
  const krPanel = document.getElementById('quantPanelKr');
  const autoPanel = document.getElementById('quantPanelAuto');
  if (profilePage) profilePage.style.display = '';
  if (profileCard) profileCard.style.display = 'none';
  if (tabBar) tabBar.style.display = 'none';
  if (usPanel) usPanel.style.display = 'none';
  if (krPanel) krPanel.style.display = 'none';
  if (autoPanel) autoPanel.style.display = 'none';
  // 페이지 상단으로 스크롤
  document.getElementById('tab-quant')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
function renderProfileCard(p) {
  const card = document.getElementById('investorProfileCard');
  if (!card) return;
  const meta = PROFILE_META[p.profile_type] || PROFILE_META.balanced;
  card.style.display = 'block';
  card.innerHTML = `
  <div style="background:${meta.bg};border:1.5px solid ${meta.border};border-radius:12px;padding:14px 18px;">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:1.5rem;">${meta.icon}</span>
        <div>
          <div style="font-size:0.72rem;color:${meta.color};font-weight:700;margin-bottom:2px;">내 투자 성향</div>
          <div style="font-size:0.95rem;font-weight:800;color:#E5E7EB;">${meta.label}</div>
          <div style="font-size:0.75rem;color:#9CA3AF;margin-top:1px;">${meta.desc}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
        <div style="display:flex;gap:6px;font-size:0.7rem;">
          <span style="padding:2px 8px;border-radius:999px;background:rgba(79,143,255,0.15);color:#3730a3;">모멘텀 ${Math.round(p.w_momentum * 100)}%</span>
          <span style="padding:2px 8px;border-radius:999px;background:rgba(255,59,48,0.15);color:#166534;">가치 ${Math.round(p.w_value * 100)}%</span>
          <span style="padding:2px 8px;border-radius:999px;background:rgba(255,214,10,0.12);color:#92400e;">퀄리티 ${Math.round(p.w_quality * 100)}%</span>
          <span style="padding:2px 8px;border-radius:999px;background:rgba(30,123,255,0.08);color:#0369a1;">뉴스 ${Math.round(p.w_news * 100)}%</span>
        </div>
        <div style="font-size:0.7rem;color:#9CA3AF;">
          익절 ${Math.round(p.risk_take_profit * 100)}% · 손절 ${Math.round(p.risk_stop_loss * 100)}% · 최대 ${p.risk_max_positions}종목
        </div>
        <button onclick="showProfilePage()"
          style="font-size:0.72rem;padding:3px 10px;border-radius:6px;border:1px solid ${meta.border};background:#161B22;color:${meta.color};cursor:pointer;font-weight:600;">
          ✏️ 재설문
        </button>
      </div>
    </div>
  </div>`;
}
window.submitInvestorProfile = async function () {
  const q_period = parseInt(document.querySelector('input[name="q_period"]:checked')?.value || 2);
  const q_loss = parseInt(document.querySelector('input[name="q_loss"]:checked')?.value || 2);
  const q_return = parseInt(document.querySelector('input[name="q_return"]:checked')?.value || 2);
  const q_style = parseInt(document.querySelector('input[name="q_style"]:checked')?.value || 2);
  const q_experience = parseInt(document.querySelector('input[name="q_experience"]:checked')?.value || 2);
  try {
    const res = await fetch('/api/investor-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q_period, q_loss, q_return, q_style, q_experience })
    });
    const d = await res.json();
    if (!d.ok) { await spAlert('❌', '오류', '저장에 실패했어요'); return; }
    document.getElementById('investor-profile-layer') && (document.getElementById('investor-profile-layer').style.display = 'none');
    _investorProfile = d;
    // 등록 페이지 숨기고 자동매매 탭 표시
    const profilePage = document.getElementById('quantProfilePage');
    if (profilePage) profilePage.style.display = 'none';
    const tabBar = document.getElementById('quantTabBar');
    if (tabBar) tabBar.style.display = 'flex';
    const meta = PROFILE_META[d.profile_type] || PROFILE_META.balanced;
    await spAlert(meta.icon, `${meta.label} 투자자!`,
      `${meta.desc}\n\n모멘텀 ${Math.round(d.w_momentum * 100)}% · 가치 ${Math.round(d.w_value * 100)}% · 퀄리티 ${Math.round(d.w_quality * 100)}%\n익절 ${Math.round(d.risk_take_profit * 100)}% · 손절 ${Math.round(d.risk_stop_loss * 100)}%`);
    // 성향 카드 렌더링
    renderProfileCard({
      profile_type: d.profile_type,
      w_momentum: d.w_momentum, w_value: d.w_value,
      w_quality: d.w_quality, w_news: d.w_news,
      risk_take_profit: d.risk_take_profit, risk_stop_loss: d.risk_stop_loss,
      risk_max_positions: d.risk_max_positions,
    });
    // 자동매매 설정 성향 기반 자동 적용
    applyProfileToSettings(d);
    // 미국 자동매매 탭으로 이동
    switchQuantTab('us');
  } catch (e) { await spAlert('❌', '오류', e.message); }
};
function applyProfileToSettings(profile) {
  // 미국 자동매매 탭에 성향 기반 값 자동 적용
  const tp = document.getElementById('atTakeProfit');
  const sl = document.getElementById('atStopLoss');
  if (tp) tp.value = Math.round(profile.risk_take_profit * 100);
  if (sl) sl.value = Math.round(profile.risk_stop_loss * 100);
  // 완전자동매매 탭
  const asBal = document.getElementById('asBalanceRatio');
  const asMax = document.getElementById('asMaxPositions');
  const asTp1 = document.getElementById('asTakeProfit1');
  const asTp2 = document.getElementById('asTakeProfit2');
  const asSl = document.getElementById('asStopLoss');
  if (asBal) asBal.value = Math.round(profile.risk_balance_ratio * 100);
  if (asMax) asMax.value = profile.risk_max_positions;
  if (asTp1) asTp1.value = Math.round(profile.risk_take_profit * 100);
  if (asTp2) asTp2.value = Math.round(profile.risk_take_profit * 200); // 2차 = 1차 × 2
  if (asSl) asSl.value = Math.round(profile.risk_stop_loss * 100);
}
// ===== 미국/한국 탭 전환 =====
window.switchQuantTab = function (tab) {
  const usPanel = document.getElementById('quantPanelUs');
  const krPanel = document.getElementById('quantPanelKr');
  const autoPanel = document.getElementById('quantPanelAuto');
  const dayPanel = document.getElementById('quantPanelDay');
  const logPanel = document.getElementById('quantPanelLog');
  const usBtn = document.getElementById('quantTabUs');
  const krBtn = document.getElementById('quantTabKr');
  const autoBtn = document.getElementById('quantTabAuto');
  const dayBtn = document.getElementById('quantTabDay');
  const logBtn = document.getElementById('quantTabLog');
  const inactiveStyle = 'flex:1;padding:12px;border:none;background:#1E242C;color:#9CA3AF;font-weight:800;font-size:0.95rem;cursor:pointer;';
  usPanel.style.display = tab === 'us' ? '' : 'none';
  krPanel.style.display = tab === 'kr' ? '' : 'none';
  autoPanel.style.display = tab === 'auto' ? '' : 'none';
  if (dayPanel) dayPanel.style.display = tab === 'day' ? '' : 'none';
  if (logPanel) logPanel.style.display = tab === 'log' ? '' : 'none';
  usBtn.style.cssText = tab === 'us' ? 'flex:1;padding:12px;border:none;background:#6366f1;color:#fff;font-weight:800;font-size:0.95rem;cursor:pointer;' : inactiveStyle;
  krBtn.style.cssText = tab === 'kr' ? 'flex:1;padding:12px;border:none;background:#6366f1;color:#fff;font-weight:800;font-size:0.95rem;cursor:pointer;' : inactiveStyle;
  autoBtn.style.cssText = tab === 'auto' ? 'flex:1;padding:12px;border:none;background:#6366f1;color:#fff;font-weight:800;font-size:0.95rem;cursor:pointer;' : inactiveStyle;
  if (dayBtn) dayBtn.style.cssText = tab === 'day' ? 'flex:1;padding:12px;border:none;background:#6366f1;color:#fff;font-weight:800;font-size:0.95rem;cursor:pointer;' : inactiveStyle;
  if (logBtn) logBtn.style.cssText = tab === 'log' ? 'flex:1;padding:12px;border:none;background:#6366f1;color:#fff;font-weight:800;font-size:0.95rem;cursor:pointer;' : inactiveStyle;
  if (tab === 'auto') { loadAutoStrategySettings(); loadAutoStrategyPositions(); setTimeout(() => { if (typeof renderAutoSavedSymbols === 'function') renderAutoSavedSymbols(); }, 300); setAutoMarket(_autoMarket || 'nasdaq'); }
  if (tab === 'kr') { setTimeout(() => { if (typeof renderKrSavedSettings === 'function') renderKrSavedSettings(); }, 300); setKrMarket(_selectedKrMarket || 'kospi'); }
  if (tab === 'us') { setMarket(_selectedMarket || 'nasdaq'); }
  if (tab === 'day') { loadVolumeSurge(); loadNewsCatalyst(); loadSimpleTradeState(); loadCombinedSignal(); }
  if (tab === 'log') { loadUnifiedTradeLog(); }
  // 퀀트 탭 진입 시 성향 체크 (매번 확인)
  checkInvestorProfile();
};
// ===== 통합 매매 신호 =====
window.loadCombinedSignal = async function () {
  const el = document.getElementById('combinedSignalList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:16px;font-size:0.85rem;">⏳ 분석 중...</div>';
  try {
    const market = window._dayMarket || 'us';
    const [volumeRes, newsRes] = await Promise.all([
      fetch(`/api/trade4/volume_surge?market=${market}`).then(r => r.json()),
      fetch(`/api/trade4/news_catalyst?market=${market}`).then(r => r.json())
    ]);
    const surges = volumeRes.surges || [];
    const catalysts = newsRes.catalysts || [];
    const newsSymbols = new Set(catalysts.map(c => c.symbol));
    // 거래량 급등 + 뉴스 둘 다 있는 종목
    const combined = surges.filter(s => newsSymbols.has(s.symbol));
    // 거래량 급등만 있는 종목
    const surgeOnly = surges.filter(s => !newsSymbols.has(s.symbol)).slice(0, 3);
    if (!combined.length && !surgeOnly.length) {
      el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:24px;font-size:0.85rem;">현재 통합 신호 없음</div>';
      return;
    }
    const currency = market === 'kr' ? '₩' : '$';
    let html = '';
    if (combined.length) {
      html += '<div style="font-size:0.75rem;font-weight:700;color:#6366f1;margin-bottom:8px;">🔥 거래량 + 뉴스 동시 감지</div>';
      html += combined.map(s => {
        const news = catalysts.find(c => c.symbol === s.symbol);
        return `<div style="padding:12px;border:2px solid #6366f1;border-radius:10px;margin-bottom:8px;background:rgba(99,102,241,0.1);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-weight:800;font-size:1rem;color:#4338ca;">${s.symbol}</span>
            <div style="display:flex;gap:6px;">
              <span style="font-size:0.72rem;padding:2px 8px;border-radius:999px;background:rgba(99,102,241,0.2);color:#a5b4fc;font-weight:700;">📊 ${s.volume_ratio}x</span>
              <span style="font-size:0.72rem;padding:2px 8px;border-radius:999px;background:rgba(245,158,11,0.2);color:#fbbf24;font-weight:700;">📰 뉴스</span>
            </div>
          </div>
          <div style="font-size:0.78rem;color:#4338ca;">${news?.latest_title || ''}</div>
          <button onclick="quickRiskCalc('${s.symbol}')" style="margin-top:8px;padding:4px 12px;font-size:0.75rem;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;">🛡️ 리스크 계산</button>
        </div>`;
      }).join('');
    }
    if (surgeOnly.length) {
      html += '<div style="font-size:0.75rem;font-weight:700;color:#f59e0b;margin:12px 0 8px;">⚡ 거래량 급등 (뉴스 미감지)</div>';
      html += surgeOnly.map(s => `
        <div style="padding:10px;border:1px solid rgba(245,158,11,0.3);border-radius:10px;margin-bottom:6px;background:rgba(245,158,11,0.08);">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:800;color:#92400e;">${s.symbol}</span>
            <span style="font-size:0.75rem;color:#92400e;">${s.volume_ratio}x · ${currency}${s.price?.toFixed(2)}</span>
          </div>
        </div>`).join('');
    }
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div style="color:#ef4444;padding:12px;">오류: ${e.message}</div>`;
  }
};
// ===== 완전자동매매 시장 선택 =====
let _autoMarket = 'nasdaq';
window.setAutoMarket = function (market) {
  _autoMarket = market;
  const idMap = { nasdaq: 'asBtnNasdaq', dow: 'asBtnDow', sp500: 'asBtnSp500', russell1000: 'asBtnRussell' };
  Object.entries(idMap).forEach(([m, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.background = m === market ? '#6366f1' : 'transparent';
    el.style.color = m === market ? '#fff' : '#9CA3AF';
    el.style.borderColor = m === market ? '#6366f1' : '#2A2A2A';
  });
}
// ===== TOP5 시장 선택 (일반 자동매매) =====
let _topPicksMarket = 'nasdaq';
window._topPicksMarket = _topPicksMarket;
window.setTopPicksMarket = function (market) {
  _topPicksMarket = market;
  window._topPicksMarket = market;
  const idMap = { nasdaq: 'topPicksBtnNasdaq', dow: 'topPicksBtnDow', sp500: 'topPicksBtnSp500', russell1000: 'topPicksBtnRussell' };
  Object.entries(idMap).forEach(([m, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.background = m === market ? '#6366f1' : 'transparent';
    el.style.color = m === market ? '#fff' : '#9CA3AF';
    el.style.borderColor = m === market ? '#6366f1' : '#2A2A2A';
  });
  // 시장 변경 시 자동 재조회
  if (typeof window.loadTopPicks === 'function') window.loadTopPicks();
};
// ===== 거래량/뉴스 시장 선택 (일반 자동매매) =====
let _dayMarket = 'us';
window._dayMarket = 'us';
window.setDayMarket = function (market) {
  _dayMarket = market;
  window._dayMarket = market;
  const usBtn = document.getElementById('dayMarketBtnUs');
  const krBtn = document.getElementById('dayMarketBtnKr');
  if (usBtn) { usBtn.style.background = market === 'us' ? '#16a34a' : 'transparent'; usBtn.style.color = market === 'us' ? '#fff' : '#9CA3AF'; usBtn.style.borderColor = market === 'us' ? '#16a34a' : '#2A2A2A'; }
  if (krBtn) { krBtn.style.background = market === 'kr' ? '#16a34a' : 'transparent'; krBtn.style.color = market === 'kr' ? '#fff' : '#9CA3AF'; krBtn.style.borderColor = market === 'kr' ? '#16a34a' : '#2A2A2A'; }
  // 나스닥/다우 버튼 미국일 때만 표시
  const usMarketEl = document.getElementById('topPicksUsMarket');
  if (usMarketEl) usMarketEl.style.display = market === 'us' ? 'flex' : 'none';
  // TOP5 market 연동 (한국이면 kr, 미국이면 nasdaq 기본)
  if (market === 'kr') { window._topPicksMarket = 'kr'; }
  else { window._topPicksMarket = window._topPicksMarket === 'kr' ? 'nasdaq' : (window._topPicksMarket || 'nasdaq'); }
  // TOP5 캐시 초기화 (시장 변경 시 재분석 필요)
  if (typeof _topPicksCache !== 'undefined') { _topPicksCache = null; }
  const topPicksEl = document.getElementById('topPicksList');
  if (topPicksEl) topPicksEl.innerHTML = '<div style="text-align:center;color:#6b7280;padding:24px;font-size:0.85rem;">분석 버튼을 눌러주세요 (약 10~20초 소요)</div>';
  // 자동 재조회
  loadVolumeSurge();
  loadNewsCatalyst();
};
// loadVolumeSurge / loadNewsCatalyst — market 파라미터 주입
const _origLoadVolumeSurge = typeof window.loadVolumeSurge === 'function' ? window.loadVolumeSurge : null;
window.loadVolumeSurge = async function () {
  const el = document.getElementById('volumeSurgeList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:16px;font-size:0.85rem;">⏳ 조회 중...</div>';
  try {
    const market = window._dayMarket || 'us';
    const res = await fetch(`/api/trade4/volume_surge?market=${market}`);
    const d = await res.json();
    if (!d.ok || !d.surges?.length) {
      el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:24px;font-size:0.85rem;">급등 종목 없음</div>';
      return;
    }
    el.innerHTML = d.surges.map(s => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #1E242C;">
        <span style="font-weight:800;color:#E5E7EB;">${s.symbol}</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="font-size:0.75rem;color:#f59e0b;font-weight:700;">📊 ${s.volume_ratio}x</span>
          <span style="font-size:0.75rem;color:#9CA3AF;">$${s.price?.toFixed(2) || '-'}</span>
        </div>
      </div>`).join('');
  } catch (e) {
    el.innerHTML = `<div style="color:#ef4444;font-size:0.82rem;padding:8px;">오류: ${e.message}</div>`;
  }
};
const _origLoadNewsCatalyst = typeof window.loadNewsCatalyst === 'function' ? window.loadNewsCatalyst : null;
window.loadNewsCatalyst = async function () {
  const el = document.getElementById('newsCatalystList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:16px;font-size:0.85rem;">⏳ 조회 중...</div>';
  try {
    const market = window._dayMarket || 'us';
    const res = await fetch(`/api/trade4/news_catalyst?market=${market}`);
    const d = await res.json();
    if (!d.ok || !d.catalysts?.length) {
      el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:24px;font-size:0.85rem;">뉴스 촉매 없음</div>';
      return;
    }
    el.innerHTML = d.catalysts.map(c => `
      <div style="padding:8px 0;border-bottom:1px solid #1E242C;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-weight:800;color:#E5E7EB;">${c.symbol}</span>
          <span style="font-size:0.72rem;padding:2px 8px;border-radius:4px;background:#fef3c7;color:#92400e;font-weight:700;">📰 뉴스</span>
        </div>
        <div style="font-size:0.75rem;color:#9CA3AF;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.title || ''}</div>
      </div>`).join('');
  } catch (e) {
    el.innerHTML = `<div style="color:#ef4444;font-size:0.82rem;padding:8px;">오류: ${e.message}</div>`;
  }
};
// ===== 완전자동매매 설정 로드/저장 =====
async function loadAutoStrategySettings() {
  try {
    const _bkId3 = window.selectedAccountId || window.activeAccountId || '';
    const res = await fetch(`/api/trade3/settings${_bkId3 ? '?broker_key_id=' + _bkId3 : ''}`);
    if (!res.ok) return;
    const d = await res.json();
    if (!d.ok) return;
    const s = d.settings;
    document.getElementById('asRoeMin').value = s.roe_min ?? 15;
    document.getElementById('asDebtMax').value = s.debt_max ?? 100;
    document.getElementById('asRevenueMin').value = s.revenue_min ?? 10;
    document.getElementById('asMomentumTop').value = s.momentum_top ?? 30;
    document.getElementById('asSma200Filter').checked = s.sma200_filter ?? true;
    document.getElementById('asUseMacd').checked = s.use_macd ?? true;
    document.getElementById('asUseRsi').checked = s.use_rsi ?? true;
    document.getElementById('asRsiThreshold').value = s.rsi_threshold ?? 35;
    document.getElementById('asUseBb').checked = s.use_bb ?? true;
    document.getElementById('asBalanceRatio').value = Math.round((s.balance_ratio ?? 0.2) * 100);
    document.getElementById('asMaxPositions').value = s.max_positions ?? 5;
    document.getElementById('asTakeProfit1').value = Math.round((s.take_profit1 ?? 0.1) * 100);
    document.getElementById('asTakeProfit2').value = Math.round((s.take_profit2 ?? 0.2) * 100);
    document.getElementById('asStopLoss').value = Math.round((s.stop_loss ?? 0.05) * 100);
    document.getElementById('asFactorExit').checked = s.factor_exit ?? true;
    document.getElementById('asSma200Exit').checked = s.sma200_exit ?? true;
    if (s.market) { _autoMarket = s.market; setAutoMarket(s.market); }
    // 활성화 상태
    const active = !!s.enabled;
    const tog = document.getElementById('asToggleBtn');
    const knob = document.getElementById('asToggleKnob');
    const status = document.getElementById('autoStrategyStatus');
    tog.dataset.active = active ? '1' : '0';
    tog.style.background = active ? '#6366f1' : '#d1d5db';
    knob.style.left = active ? '26px' : '2px';
    status.textContent = active ? '✅ 활성' : '⏹ 비활성';
    status.style.background = active ? '#312e81' : '#334155';
    status.style.color = active ? '#c7d2fe' : '#94a3b8';
  } catch (e) { }
}
window.saveAutoStrategy = async function () {
  try {
    const body = {
      market: _autoMarket,
      roe_min: parseFloat(document.getElementById('asRoeMin').value),
      debt_max: parseFloat(document.getElementById('asDebtMax').value),
      revenue_min: parseFloat(document.getElementById('asRevenueMin').value),
      momentum_top: parseFloat(document.getElementById('asMomentumTop').value),
      sma200_filter: document.getElementById('asSma200Filter').checked,
      use_macd: document.getElementById('asUseMacd').checked,
      use_rsi: document.getElementById('asUseRsi').checked,
      rsi_threshold: parseFloat(document.getElementById('asRsiThreshold').value),
      use_bb: document.getElementById('asUseBb').checked,
      balance_ratio: parseFloat(document.getElementById('asBalanceRatio').value) / 100,
      max_positions: parseInt(document.getElementById('asMaxPositions').value),
      take_profit1: parseFloat(document.getElementById('asTakeProfit1').value) / 100,
      take_profit2: parseFloat(document.getElementById('asTakeProfit2').value) / 100,
      stop_loss: parseFloat(document.getElementById('asStopLoss').value) / 100,
      factor_exit: document.getElementById('asFactorExit').checked,
      sma200_exit: document.getElementById('asSma200Exit').checked,
      broker_key_id: window.selectedAccountId || window.activeAccountId || null,
    };
    const res = await fetch('/api/trade3/settings_save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const d = await res.json();
    if (d.ok) await spAlert('✅', '저장 완료', '완전자동매매 전략이 저장됐어요!');
  } catch (e) { await spAlert('❌', '저장 오류', e.message); }
};
// ===== 활성화 토글 =====
window.toggleAutoStrategy = async function () {
  const tog = document.getElementById('asToggleBtn');
  const knob = document.getElementById('asToggleKnob');
  const status = document.getElementById('autoStrategyStatus');
  const active = tog.dataset.active === '1';
  const next = !active;
  if (next) {
    const ok = await spConfirm('🤖', '완전자동매매 활성화', '활성화하면 미국 장 시간마다 자동으로 매수/매도가 실행돼요.\n전략 설정을 먼저 저장했는지 확인하세요!', '활성화', '#6366f1');
    if (!ok) return;
  }
  try {
    const res = await fetch('/api/trade3/toggle', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: next, broker_key_id: window.selectedAccountId || window.activeAccountId || null })
    });
    const d = await res.json();
    if (d.ok) {
      tog.dataset.active = next ? '1' : '0';
      tog.style.background = next ? '#6366f1' : '#d1d5db';
      knob.style.left = next ? '26px' : '2px';
      status.textContent = next ? '✅ 활성' : '⏹ 비활성';
      status.style.background = next ? '#312e81' : '#334155';
      status.style.color = next ? '#c7d2fe' : '#94a3b8';
    }
  } catch (e) { await spAlert('❌', '오류', e.message); }
};
// ===== 스크리닝 실행 =====
window.runAutoStrategyScreen = async function () {
  const el = document.getElementById('asScreenResult');
  const cnt = document.getElementById('asScreenedCount');
  el.innerHTML = '<div style="text-align:center;color:#9CA3AF;padding:20px;font-size:0.85rem;">🔍 팩터 스크리닝 중... (1~2분 소요)</div>';
  try {
    const roeMin = parseFloat(document.getElementById('asRoeMin').value);
    const debtMax = parseFloat(document.getElementById('asDebtMax').value);
    const revMin = parseFloat(document.getElementById('asRevenueMin').value);
    const momTop = parseFloat(document.getElementById('asMomentumTop').value);
    const sma200 = document.getElementById('asSma200Filter').checked;
    const asTopN = parseInt(document.getElementById('asTopN')?.value || '10');
    const asFinalN = parseInt(document.getElementById('asFinalN')?.value || '3');
    const asSignal = document.getElementById('asSignalFilter')?.value || 'all';
    const asScore = document.getElementById('asScoreMode')?.value || 'combined';
    const res = await fetch('/proxy/quant/api/quant/factor-screen', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy: 'momentum_ma', market: _autoMarket, top_n: asTopN, final_n: asFinalN, signal_filter: asSignal, score_mode: asScore })
    });
    const d = await res.json();
    if (!d.ok || !d.top?.length) { el.innerHTML = '<div style="padding:12px;color:#9CA3AF;font-size:0.85rem;">조건 충족 종목 없음</div>'; return; }
    const filtered = d.top.filter(item => {
      if (item.roe && item.roe < roeMin) return false;
      if (item.debt_to_equity && item.debt_to_equity > debtMax) return false;
      if (item.revenue_growth && item.revenue_growth < revMin) return false;
      if (sma200 && item.above_sma200 === 0) return false;
      return true;
    });
    // finalN 적용 + 신호필터 적용
    let finalFiltered = filtered;
    if (asSignal === 'buy') finalFiltered = finalFiltered.filter(item => item.timing === 'BUY');
    if (asScore === 'technical') finalFiltered = [...finalFiltered].sort((a, b) => (b.tech_score || 0) - (a.tech_score || 0));
    else if (asScore === 'factor') finalFiltered = [...finalFiltered].sort((a, b) => (b.factor_score || 0) - (a.factor_score || 0));
    finalFiltered = finalFiltered.slice(0, asFinalN);
    cnt.textContent = `${d.screened}개 → ${finalFiltered.length}개`;
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const rows = finalFiltered.map((item, i) => `
    <div style="padding:10px 12px;background:${i === 0 ? 'rgba(99,102,241,0.1)' : '#1E242C'};border-radius:8px;border:1px solid ${i === 0 ? '#6366f1' : '#2A2A2A'};margin-bottom:6px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <div>
          <span style="font-weight:800;font-size:0.95rem;color:#E5E7EB;">${medals[i]} ${item.symbol}</span>
          <span style="margin-left:6px;font-size:0.68rem;padding:1px 6px;border-radius:999px;background:${item.above_sma200 ? '#dcfce7' : '#fee2e2'};color:${item.above_sma200 ? '#166534' : '#991b1b'};font-weight:700;">${item.above_sma200 ? '▲ 200일선 위' : '▼ 200일선 아래'}</span>
        </div>
        <div style="text-align:right;font-size:0.78rem;">
          <span style="font-weight:700;color:#E5E7EB;">$${item.price?.toFixed(2) ?? '-'}</span>
          <span style="color:#6366f1;margin-left:6px;">점수 ${item.factor_score}</span>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:0.7rem;color:#9CA3AF;">
        ${item.roe ? `<span style="background:rgba(99,102,241,0.2);color:#a5b4fc;padding:1px 6px;border-radius:999px;">ROE ${item.roe}%</span>` : ''}
        ${item.debt_to_equity != null ? `<span style="background:rgba(255,214,10,0.12);color:#92400e;padding:1px 6px;border-radius:999px;">부채 ${item.debt_to_equity}%</span>` : ''}
        ${item.revenue_growth ? `<span style="background:rgba(255,59,48,0.15);color:#166534;padding:1px 6px;border-radius:999px;">매출성장 ${item.revenue_growth}%</span>` : ''}
        ${item.momentum_6m != null ? `<span style="background:rgba(30,123,255,0.08);color:#0369a1;padding:1px 6px;border-radius:999px;">6M ${item.momentum_6m > 0 ? '+' : ''}${item.momentum_6m}%</span>` : ''}
        ${item.news_label && item.news_label !== '뉴스없음' ? `<span style="padding:1px 6px;border-radius:999px;background:${item.news_score > 0.3 ? '#dcfce7' : item.news_score < -0.3 ? '#fee2e2' : '#f1f5f9'};color:${item.news_score > 0.3 ? '#166534' : item.news_score < -0.3 ? '#991b1b' : '#6b7280'};">${item.news_label} ${item.news_count}건</span>` : ''}
        ${item.macro_risk < -1 ? `<span style="padding:1px 6px;border-radius:999px;background:rgba(30,123,255,0.15);color:#991b1b;font-weight:700;">⚠️ 거시악재</span>` : ''}
      </div>
      <button onclick="saveAutoSymbol('${item.symbol}', ${item.score || 0})" style="margin-top:8px;width:100%;padding:5px;border-radius:6px;border:none;background:#16a34a;color:#fff;font-size:0.75rem;font-weight:700;cursor:pointer;">💾 ${item.symbol} 저장</button>
    </div>`).join('');
    const marketNames = { 'nasdaq': '나스닥100', 'dow': '다우존스30', 'sp500': 'S&P500', 'russell1000': 'Russell1000' };
    const marketLabel = marketNames[_autoMarket] || _autoMarket;
    el.innerHTML = `<div style="font-size:0.75rem;color:#9CA3AF;margin-bottom:8px;">${marketLabel} · ${d.screened}개 → TOP${asFinalN} (${asScore === 'combined' ? '복합점수' : asScore === 'factor' ? '팩터점수' : '기술점수'} · ${asSignal === 'buy' ? 'BUY만' : 'BUY+WATCH'})</div>${rows}`;
    // 스크리닝 후 저장된 종목 새로고침
    setTimeout(() => { if (typeof renderAutoSavedSymbols === 'function') renderAutoSavedSymbols(); }, 300);
  } catch (e) { el.innerHTML = `<div style="color:#ef4444;font-size:0.85rem;">오류: ${e.message}</div>`; }
};
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
    el.innerHTML = `
      <div style="font-size:0.75rem;color:#9CA3AF;margin-bottom:8px;">저장 ${pool.length}개</div>
      ${pool.map(p => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#1E242C;border-radius:8px;border:1px solid #2A2A2A;margin-bottom:6px;">
          <div>
            <span style="font-weight:700;font-size:0.9rem;color:#6366f1;cursor:pointer;" onclick="openChart('${p.symbol}')">${p.symbol} 📈</span>
            <span style="font-size:0.72rem;color:#9CA3AF;margin-left:6px;">점수 ${p.factor_score}</span>
          </div>
          <button onclick="deleteAutoSymbol('${p.symbol}')"
            style="padding:3px 10px;border-radius:6px;background:rgba(239,68,68,0.12);border:1px solid #ef444440;color:#ef4444;font-size:0.75rem;font-weight:700;cursor:pointer;">
            🗑️ 삭제
          </button>
        </div>`).join('')}`;
  } catch (e) {
    el.innerHTML = `<div style="color:#ef4444;font-size:0.82rem;">오류: ${e.message}</div>`;
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
  } catch (e) { el.innerHTML = `<div style="color:#636366;font-size:0.82rem;padding:12px;">포지션 정보를 불러올 수 없어요</div>`; }
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
  } catch (e) { el.innerHTML = `<div style="color:#ef4444;font-size:0.82rem;">로드 실패: ${e.message}</div>`; }
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
  el.innerHTML = `<div style="padding:12px;background:rgba(30,123,255,0.08);border-radius:8px;border:1px solid #bae6fd;">
  <div style="font-weight:700;color:#0369a1;margin-bottom:6px;">🔍 ${isKr ? '한국 종목' : '통합'} 스크리닝 중...</div>
  <div style="font-size:0.8rem;color:#9CA3AF;line-height:1.6;">
    📊 1단계: ${marketLabel} 팩터 분석 (PER/PBR/ROE)<br>
    ${isKr ? '📋 분석 전용 (매매 미지원)' : '⏱ 2단계: MACD/RSI 타이밍 체크'}<br>약 1~2분 소요
  </div></div>`;
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
          ? `<button onclick="event.stopPropagation();saveOneSymbol('${item.symbol}')" style="margin-top:8px;width:100%;padding:5px;border-radius:6px;border:1px solid rgba(255,59,48,0.3);background:rgba(255,59,48,0.08);color:#FF3B30;font-size:0.75rem;font-weight:700;cursor:pointer;">⚠️ ${item.symbol} AVOID — 그래도 저장</button>`
          : `<button onclick="event.stopPropagation();saveOneSymbol('${item.symbol}')" style="margin-top:8px;width:100%;padding:5px;border-radius:6px;border:1px solid #2A2A2A;background:rgba(79,143,255,0.1);color:#4f8fff;font-size:0.75rem;font-weight:700;cursor:pointer;">💾 ${item.symbol} 저장</button>`)
        : '';
      return `<div style="padding:12px 14px;background:${bg};border-radius:8px;border:1px solid ${bor};margin-bottom:8px;cursor:pointer;" onclick="openChart('${item.symbol}')">
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
    el.innerHTML = `<div style="margin-top:4px;"><div style="font-size:0.78rem;color:#9CA3AF;margin-bottom:8px;">📊 ${marketLabel} · ${d.strategy_label}<br>${d.screened}개 스크리닝 → TOP${isKr ? items.length : finalN}${isKr ? ' (분석 전용)' : ` (${scoreModeLabel} · ${sigLabel})`}</div>${rows}${isKr ? '<div style="margin-top:10px;padding:8px 12px;background:rgba(255,214,10,0.08);border-radius:8px;border:1px solid rgba(255,214,10,0.25);font-size:0.78rem;color:#FFD60A;font-weight:600;">⚠️ 자동매매는 키움증권 API 연동 후 활성화됩니다</div>' : ''}</div>`;
  } catch (e) { el.innerHTML = `<div style="color:#ef4444;font-size:0.85rem;">오류: ${e.message}</div>`; }
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
    const btns = document.querySelectorAll(`button[onclick="saveOneSymbol('${symbol}')"]`);
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
    const btns = document.querySelectorAll(`button[onclick="saveKrSymbol('${symbol}')"]`);
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
    el.innerHTML = `
      <div style="font-size:0.75rem;color:#9CA3AF;margin-bottom:8px;">저장 ${symbols.length}개</div>
      ${symbols.map(sym => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#1E242C;border-radius:8px;border:1px solid #2A2A2A;margin-bottom:6px;">
          <span style="font-weight:700;font-size:0.9rem;color:#4f8fff;">${sym}</span>
          <button onclick="deleteKrSymbol('${sym}')"
            style="padding:3px 10px;border-radius:6px;background:rgba(239,68,68,0.12);border:1px solid #ef444440;color:#ef4444;font-size:0.75rem;font-weight:700;cursor:pointer;">
            🗑️ 삭제
          </button>
        </div>`).join('')}`;
  } catch (e) {
    el.innerHTML = `<div style="color:#ef4444;font-size:0.82rem;">오류: ${e.message}</div>`;
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
        <span style="font-weight:700;font-size:0.9rem;color:#4f8fff;cursor:pointer;text-decoration:none;" onclick="openChart('${sym}')" title="📈 차트 보기">${sym} 📈</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <span style="font-size:0.75rem;color:#9CA3AF;" id="at-toggle-label-${sym}">${enabled ? '활성' : '비활성'}</span>
            <div onclick="toggleSymbolActive('${sym}', this)" 
              style="width:40px;height:22px;border-radius:999px;background:${enabled ? '#10b981' : '#d1d5db'};position:relative;cursor:pointer;transition:background 0.2s;" 
              data-active="${enabled ? '1' : '0'}" id="at-toggle-${sym}">
              <div style="width:18px;height:18px;border-radius:50%;background:#161B22;position:absolute;top:2px;left:${enabled ? '20px' : '2px'};transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2);" id="at-toggle-knob-${sym}"></div>
            </div>
          </label>
          <button onclick="deleteSymbol('${sym}')" style="width:22px;height:22px;border-radius:50%;background:rgba(30,123,255,0.15);border:none;cursor:pointer;color:#ef4444;font-size:0.8rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;" title="${sym} 삭제">✕</button>
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
    el.innerHTML = `<div style="color:#ef4444;font-size:0.85rem;">설정 로드 실패: ${e.message}</div>`;
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
// ============================================================
// 사이드바 동적 렌더링 (_currentTab/_currentSubTab/_menuData → common.js에서 선언)
// ============================================================
function renderSidebar(menus) {
  const nav = document.getElementById('sidebarNav');
  if (!nav) return;
  // 그룹 레이블 매핑
  const groupLabels = {
    'ai': '메인',
    'stock': '트레이딩',
    'datacollect': '트레이딩',
    'quant': '트레이딩',
    'backtest': '트레이딩',
    'performance': '분석'
  };
  let html = '';
  let lastGroup = '';
  menus.forEach(menu => {
    const group = groupLabels[menu.tab_key] || '';
    if (group && group !== lastGroup) {
      html += `<div class="sp-nav-label" style="margin-top:8px;">${group}</div>`;
      lastGroup = group;
    }
    const hasChildren = menu.children && menu.children.length > 0;
    if (hasChildren) {
      // 부모 메뉴 (서브메뉴 있음)
      html += `
        <button class="tab-btn sp-parent-btn" id="tab-btn-${menu.tab_key}" data-tab="${menu.tab_key}" data-id="${menu.id}"
          onclick="toggleSubMenu(${menu.id}, '${menu.tab_key}')">
          <span class="nav-icon">${menu.icon}</span> ${menu.name}
          <span class="sp-parent-arrow">▶</span>
        </button>
        <div class="sp-sub-menu" id="sub-menu-${menu.id}">
          ${menu.children.map(child => `
            <button class="sp-sub-btn" id="sub-btn-${child.id}" data-tab="${child.tab_key}" data-sub="${child.sub_key}" data-id="${child.id}"
              onclick="activateMenu('${child.tab_key}', '${child.sub_key}', ${child.id})">
              <span>${child.icon}</span> ${child.name}
            </button>`).join('')}
        </div>`;
    } else {
      // 일반 메뉴
      html += `
        <button class="tab-btn" id="tab-btn-${menu.tab_key}-${menu.id}" data-tab="${menu.tab_key}" data-id="${menu.id}"
          onclick="activateMenu('${menu.tab_key}', null, ${menu.id})">
          <span class="nav-icon">${menu.icon}</span> ${menu.name}
        </button>`;
    }
  });
  nav.innerHTML = html;
}
function toggleSubMenu(menuId) {
  const subMenu = document.getElementById(`sub-menu-${menuId}`);
  const parentBtn = document.querySelector(`[data-id="${menuId}"]`);
  if (!subMenu) return;
  const isOpen = subMenu.classList.contains('open');
  // 모든 서브메뉴 닫기
  document.querySelectorAll('.sp-sub-menu').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.sp-parent-btn').forEach(b => b.classList.remove('open'));
  if (!isOpen) {
    subMenu.classList.add('open');
    if (parentBtn) parentBtn.classList.add('open');
    // 첫 번째 자식 자동 선택
    const firstChild = subMenu.querySelector('.sp-sub-btn');
    if (firstChild) firstChild.click();
  }
}
function activateMenu(tabKey, subKey, menuId) {
  const allTabs = document.querySelectorAll('.tab-content');
  allTabs.forEach(t => { t.style.display = 'none'; t.classList.remove('active-tab'); });
  const targetTab = document.getElementById(`tab-${tabKey}`);
  if (targetTab) { targetTab.style.display = 'block'; targetTab.classList.add('active-tab'); }
  // 버튼 활성화 상태
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.sp-sub-btn').forEach(b => b.classList.remove('active'));
  const parentBtn = document.querySelector(`.sp-parent-btn[data-tab="${tabKey}"]`);
  if (parentBtn) parentBtn.classList.add('active');
  const subBtn = document.getElementById(`sub-btn-${menuId}`);
  if (subBtn) subBtn.classList.add('active');
  const directBtn = document.getElementById(`tab-btn-${tabKey}-${menuId}`);
  if (directBtn) directBtn.classList.add('active');
  // 서브메뉴 열기
  if (subKey) {
    const parentId = _menuData.find(m => m.tab_key === tabKey && !m.parent_id)?.id;
    if (parentId) {
      const subMenu = document.getElementById(`sub-menu-${parentId}`);
      const parentBtnEl = document.querySelector(`[data-id="${parentId}"]`);
      if (subMenu) subMenu.classList.add('open');
      if (parentBtnEl) parentBtnEl.classList.add('open');
    }
    // switchQuantTab 호출 (자동매매 탭)
    if (tabKey === 'quant' && typeof switchQuantTab === 'function') switchQuantTab(subKey);
    // datacollect 탭 서브메뉴 처리
    if (tabKey === 'datacollect') {
      const tabEl = document.getElementById('tab-datacollect');
      if (tabEl) tabEl.style.display = 'block';
      if (typeof switchDcTab === 'function') switchDcTab(subKey || 'stock');
      return;
    }
  }
  // ── stock 탭 직접 처리 ──
  if (tabKey === 'stock' && !subKey) {
    window._currentTab = 'stock';
    setTimeout(() => {
      if (typeof loadAccount === 'function') loadAccount();
      if (typeof loadPositions === 'function') loadPositions();
      if (typeof loadOrders === 'function') loadOrders();
      if (typeof loadTradeLog === 'function') loadTradeLog();
    }, 300);
    return;
  }
  // ── performance 탭은 switchTab 이전에 먼저 처리 ──
  if (tabKey === 'performance') {
    // 즉시 실행 + 딜레이 후 재실행 (데이터 보장)
    if (typeof loadPerformanceSummary === 'function') loadPerformanceSummary();
    if (typeof loadPerformanceHistory === 'function') loadPerformanceHistory();
    setTimeout(() => {
      if (typeof loadAssetPieChart === 'function') loadAssetPieChart();
      if (typeof loadPositionPieChart === 'function') loadPositionPieChart();
      if (typeof loadTradeHistory === 'function') loadTradeHistory();
      if (typeof loadSavedBacktests === 'function') loadSavedBacktests();
    }, 300);
    return;
  }
  // 탭별 초기화 - switchTab 호출로 기존 로직 재활용
  if (typeof switchTab === 'function' && !subKey) {
    switchTab(tabKey);
    return; // switchTab이 탭 표시까지 처리
  }
  if (tabKey === 'quant' && !subKey) {
    setTimeout(() => { if (typeof checkInvestorProfile === 'function') checkInvestorProfile(); }, 50);
  }
  if (tabKey === 'analysis') {
    const analysisTab = document.getElementById('tab-analysis');
    if (analysisTab) analysisTab.style.display = 'block';
  }
}
function renderDefaultSidebar() {
  const nav = document.getElementById('sidebarNav');
  if (!nav) return;
  nav.innerHTML = `
    <div class="sp-nav-label">메인</div>
    <button class="tab-btn active" id="tab-btn-ai-0" onclick="activateMenu('ai',null,0)"><span class="nav-icon">📰</span> 뉴스</button>
    <div class="sp-nav-label" style="margin-top:8px;">트레이딩</div>
    <button class="tab-btn" id="tab-btn-stock-0" onclick="activateMenu('stock',null,0)"><span class="nav-icon">📈</span> 주식</button>
    <button class="tab-btn" id="tab-btn-datacollect-0" onclick="activateMenu('datacollect',null,0)"><span class="nav-icon">📊</span> 데이터 수집</button>
    <button class="tab-btn" id="tab-btn-quant-0" onclick="activateMenu('quant',null,0)"><span class="nav-icon">🤖</span> 자동매매</button>
    <button class="tab-btn" id="tab-btn-backtest-0" onclick="activateMenu('backtest',null,0)"><span class="nav-icon">🔬</span> 백테스팅</button>
    <div class="sp-nav-label" style="margin-top:8px;">분석</div>
    <button class="tab-btn" id="tab-btn-performance-0" onclick="activateMenu('performance',null,0)"><span class="nav-icon">💹</span> 성과 대시보드</button>`;
}
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(renderAtSavedSettings, 800);
  // 퀀트 탭바 숨기기 (사이드바 서브메뉴로 대체)
  const quantTabBar = document.getElementById('quantTabBar');
  if (quantTabBar) quantTabBar.style.display = 'none';
  // 사이드바 동적 렌더링 (로그인 후 메뉴 로드)
  loadSidebarMenus();
  // 기존 common.js의 탭 전환 오버라이드
  // (common.js가 data-tab 기반으로 탭 전환하므로 유지)
});
// ============================================================
// 파이차트: 자산 비율 + 종목 비율
// ============================================================
// ── 주식 탭 서브탭 전환 ──
function switchStockSubTab(tab) {
  const tradePanel = document.getElementById('stockPanel-trade');
  const accountPanel = document.getElementById('stockPanel-account');
  const tradeBtn = document.getElementById('stockSubTab-trade');
  const accountBtn = document.getElementById('stockSubTab-account');
  if (tradePanel) tradePanel.style.display = tab === 'trade' ? '' : 'none';
  if (accountPanel) accountPanel.style.display = tab === 'account' ? '' : 'none';
  if (tradeBtn) {
    tradeBtn.style.background = tab === 'trade' ? '#6366f1' : 'transparent';
    tradeBtn.style.color = tab === 'trade' ? '#fff' : '#9CA3AF';
  }
  if (accountBtn) {
    accountBtn.style.background = tab === 'account' ? '#6366f1' : 'transparent';
    accountBtn.style.color = tab === 'account' ? '#fff' : '#9CA3AF';
  }
  if (tab === 'account') loadAlpacaKeyStatus();
  // 주식 탭 진입 시 활성 계좌 자동 로드 (activeAccountId 세팅)
  if (tab === 'stock') {
    if (typeof loadAlpacaKeyStatus === 'function') loadAlpacaKeyStatus();
    setTimeout(() => { if (typeof loadAccount === 'function') loadAccount(); }, 300);
  }
}
// ── 통합 거래내역 (자동매매 거래내역 탭) ──
let _unifiedLogFilter = 'all';
function setUnifiedLogFilter(type) {
  _unifiedLogFilter = type;
  const types = ['all', '2', '3', '4'];
  const colors = { all: '#6366f1', '2': '#fb923c', '3': '#34d399', '4': '#60a5fa' };
  types.forEach(t => {
    const btn = document.getElementById(`unifiedLogBtn-${t}`);
    if (!btn) return;
    const isActive = t === type;
    btn.style.background = isActive ? colors[t] : 'transparent';
    btn.style.color = isActive ? '#fff' : '#9CA3AF';
    btn.style.borderColor = isActive ? colors[t] : '#2A2A2A';
  });
  loadUnifiedTradeLog();
}
async function loadUnifiedTradeLog() {
  const el = document.getElementById('unifiedTradeLogTable');
  const countEl = document.getElementById('unifiedLogCount');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:#636366;padding:24px;font-size:0.85rem;">로딩 중...</div>';
  try {
    const res = await fetch('/api/trade4/log');
    const d = await res.json();
    // 자동매매만 (trade_type 2,3,4)
    let logs = (d.logs || []).filter(l => l.trade_type !== 1);
    // 필터 적용
    if (_unifiedLogFilter !== 'all') {
      logs = logs.filter(l => String(l.trade_type) === _unifiedLogFilter);
    }
    if (countEl) countEl.textContent = `${logs.length}건`;
    if (!logs.length) {
      el.innerHTML = '<div style="text-align:center;color:#636366;padding:24px;font-size:0.85rem;">거래 내역이 없습니다</div>';
      return;
    }
    const typeConfig = {
      2: { label: '단순자동', color: '#fb923c', bg: 'rgba(251,146,60,0.13)' },
      3: { label: '완전자동', color: '#34d399', bg: 'rgba(52,211,153,0.13)' },
      4: { label: '일반자동', color: '#60a5fa', bg: 'rgba(96,165,250,0.13)' },
    };
    const actionMap = {
      BUY: '매수', SELL: '매도', SELL_PROFIT: '익절', SELL_PROFIT1: '1차익절',
      SELL_PROFIT2: '2차익절', SELL_LOSS: '손절', SELL_STOP: '손절',
      SELL_FACTOR: '팩터매도', SELL_STOP_ALL: '전체종료'
    };
    const statusConfig = {
      active: { label: '보유중', color: '#f59e0b', bg: 'rgba(245,158,11,0.13)' },
      closed: { label: '종료', color: '#6b7280', bg: 'rgba(107,114,128,0.13)' },
    };
    el.innerHTML = `<div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
        <thead>
          <tr style="border-bottom:1px solid #2A2A2A;">
            <th style="padding:7px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;white-space:nowrap;">일시</th>
            <th style="padding:7px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">종목</th>
            <th style="padding:7px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">타입</th>
            <th style="padding:7px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">구분</th>
            <th style="padding:7px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">수량</th>
            <th style="padding:7px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">가격</th>
            <th style="padding:7px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">손익</th>
            <th style="padding:7px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">상태</th>
          </tr>
        </thead>
        <tbody>
          ${logs.slice(0, 100).map(l => {
      const isBuy = l.action === 'BUY';
      const isProfit = l.action.includes('PROFIT');
      const isLoss = l.action.includes('LOSS') || l.action.includes('STOP');
      const actionColor = isBuy ? '#60a5fa' : isProfit ? '#34d399' : isLoss ? '#f87171' : '#9CA3AF';
      const pnlVal = parseFloat(l.profit_pct || 0);
      const pnlColor = pnlVal > 0 ? '#34d399' : pnlVal < 0 ? '#f87171' : '#9CA3AF';
      const pnl = (l.profit_pct != null && l.profit_pct !== 0) ? `${pnlVal > 0 ? '+' : ''}${pnlVal.toFixed(2)}%` : '-';
      const tc = typeConfig[l.trade_type] || { label: '기타', color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' };
      const sc = statusConfig[l.status] || { label: l.status, color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' };
      const dt = new Date(l.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      return `<tr onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background=''">
              <td style="padding:7px 10px;border-bottom:1px solid #1E242C;font-size:0.75rem;color:#636366;white-space:nowrap;">${dt}</td>
              <td style="padding:7px 10px;border-bottom:1px solid #1E242C;font-weight:800;color:#E5E7EB;">${l.symbol}</td>
              <td style="padding:7px 10px;border-bottom:1px solid #1E242C;"><span style="padding:2px 7px;border-radius:4px;font-size:0.7rem;font-weight:700;background:${tc.bg};color:${tc.color};">${tc.label}</span></td>
              <td style="padding:7px 10px;border-bottom:1px solid #1E242C;"><span style="padding:2px 7px;border-radius:4px;font-size:0.75rem;font-weight:700;background:${actionColor}22;color:${actionColor};">${actionMap[l.action] || l.action}</span></td>
              <td style="padding:7px 10px;border-bottom:1px solid #1E242C;color:#E5E7EB;">${parseFloat(l.qty || 0)}주</td>
              <td style="padding:7px 10px;border-bottom:1px solid #1E242C;color:#E5E7EB;">$${parseFloat(l.price || 0).toFixed(2)}</td>
              <td style="padding:7px 10px;border-bottom:1px solid #1E242C;font-weight:700;color:${pnlColor};">${pnl}</td>
              <td style="padding:7px 10px;border-bottom:1px solid #1E242C;"><span style="padding:2px 7px;border-radius:4px;font-size:0.7rem;font-weight:600;background:${sc.bg};color:${sc.color};">${sc.label}</span></td>
            </tr>`;
    }).join('')}
        </tbody>
      </table>
    </div>`;
  } catch (e) {
    el.innerHTML = `<div style="color:#ef4444;font-size:0.82rem;padding:12px;">로드 실패: ${e.message}</div>`;
  }
}
// ===== 데이터 수집 탭 서브탭 전환 =====
function switchDcTab(tab) {
  const stockPanel = document.getElementById('dcPanelStock');
  const koreaPanel = document.getElementById('dcPanelKorea');
  const stockBtn = document.getElementById('dcTabStock');
  const koreaBtn = document.getElementById('dcTabKorea');
  const inactiveStyle = 'flex:1;padding:12px;border:none;background:#1E242C;color:#9CA3AF;font-weight:800;font-size:0.95rem;cursor:pointer;';
  const activeStyle = 'flex:1;padding:12px;border:none;background:#6366f1;color:#fff;font-weight:800;font-size:0.95rem;cursor:pointer;';
  if (stockPanel) stockPanel.style.display = tab === 'stock' ? '' : 'none';
  if (koreaPanel) koreaPanel.style.display = tab === 'korea' ? '' : 'none';
  if (stockBtn) stockBtn.style.cssText = tab === 'stock' ? activeStyle : inactiveStyle;
  if (koreaBtn) koreaBtn.style.cssText = tab === 'korea' ? activeStyle : inactiveStyle;
  if (tab === 'korea') { setTimeout(() => { if (typeof loadKoreaAnalysis === 'function') loadKoreaAnalysis(); }, 100); }
}
window.switchDcTab = switchDcTab;
// 성과 대시보드 계좌 타입 선택
window._perfAccountType = window._perfAccountType || 0;
window._perfAccountType = window._perfAccountType || 0;
window._perfAccountId = window._perfAccountId || '';
function setPerfAccount(accountId) {
  window._perfAccountId = accountId || '';
  const badge = document.getElementById('accountSelectPerfBadge');
  if (badge) badge.textContent = accountId ? '계좌별 조회 중' : '';
  loadPerformanceSummary();
  loadPerformanceHistory();
  loadAssetPieChart();
  loadPositionPieChart();
  loadTradeHistory();
}
window.setPerfAccount = setPerfAccount;
function setPerfAccountType(type) {
  window._perfAccountType = type;
  const labels = { 0: '전체 계좌 기준', 1: '수동 계좌 기준', 2: '자동매매 계좌 기준' };
  const labelEl = document.getElementById('perfAccLabel');
  if (labelEl) labelEl.textContent = labels[type] || '';
  [0, 1, 2].forEach(t => {
    const btn = document.getElementById(`perfAccBtn${t}`);
    if (!btn) return;
    if (t === type) {
      btn.style.background = '#6366f1';
      btn.style.color = '#fff';
      btn.style.borderColor = '#6366f1';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = '#9CA3AF';
      btn.style.borderColor = '#2A2A2A';
    }
  });
  loadPerformanceSummary();
  loadPerformanceHistory();
}

async function loadTradeHistory() {
  const el = document.getElementById('perfTradeHistory');
  if (!el) return;
  try {
    const res = await fetch('/api/trade4/log');
    const d = await res.json();
    if (!d.logs?.length) { el.innerHTML = '<div class="sp-empty">매매 이력 없음</div>'; return; }
    const actionMap = { BUY: '매수', SELL_PROFIT: '익절', SELL_PROFIT1: '1차익절', SELL_PROFIT2: '2차익절', SELL_LOSS: '손절', SELL_STOP: '손절', SELL_FACTOR: '팩터매도' };
    el.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th style="padding:7px 10px;text-align:left;font-size:0.72rem;color:#9CA3AF;font-weight:700;text-transform:uppercase;border-bottom:1px solid #2A2A2A;">일시</th>
        <th style="padding:7px 10px;font-size:0.72rem;color:#9CA3AF;font-weight:700;text-transform:uppercase;border-bottom:1px solid #2A2A2A;">종목</th>
        <th style="padding:7px 10px;font-size:0.72rem;color:#9CA3AF;font-weight:700;text-transform:uppercase;border-bottom:1px solid #2A2A2A;">구분</th>
        <th style="padding:7px 10px;font-size:0.72rem;color:#9CA3AF;font-weight:700;text-transform:uppercase;border-bottom:1px solid #2A2A2A;">가격</th>
        <th style="padding:7px 10px;font-size:0.72rem;color:#9CA3AF;font-weight:700;text-transform:uppercase;border-bottom:1px solid #2A2A2A;">손익</th>
      </tr></thead><tbody>
      ${d.logs.slice(0, 20).map(l => {
      const isBuy = l.action === 'BUY';
      const isProfit = (l.action || '').includes('PROFIT');
      const color = isBuy ? '#4f8fff' : isProfit ? '#FF3B30' : '#007AFF';
      const pnl = l.profit_pct ? `${l.profit_pct > 0 ? '+' : ''}${parseFloat(l.profit_pct).toFixed(2)}%` : '-';
      return `<tr>
          <td style="padding:7px 10px;border-bottom:1px solid #2A2A2A;font-size:0.78rem;color:#9CA3AF;">${new Date(l.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #2A2A2A;font-weight:700;color:#E5E7EB;">${l.symbol}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #2A2A2A;"><span style="padding:2px 7px;border-radius:4px;font-size:0.75rem;font-weight:700;background:${color}22;color:${color};">${actionMap[l.action] || l.action}</span></td>
          <td style="padding:7px 10px;border-bottom:1px solid #2A2A2A;color:#E5E7EB;">$${parseFloat(l.price || 0).toFixed(2)}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #2A2A2A;font-weight:700;color:${isProfit ? '#FF3B30' : (l.action || '').includes('LOSS') || (l.action || '').includes('STOP') ? '#007AFF' : '#9CA3AF'};">${pnl}</td>
        </tr>`;
    }).join('')}
      </tbody></table></div>`;
  } catch (e) { el.innerHTML = '<div class="sp-empty">로드 실패</div>'; }
}
window.loadTradeHistory = loadTradeHistory;

// ============================================================
// 백테스트 결과 저장 JS
// ============================================================
async function loadSavedBacktests() {
  const el = document.getElementById('savedBacktestList');
  if (!el) return;
  try {
    const res = await fetch('/api/backtest/results');
    const d = await res.json();
    if (!d.ok || !d.results?.length) { el.innerHTML = '<div class="sp-empty">저장된 결과 없음</div>'; return; }
    el.innerHTML = d.results.map(r => {
      const ret = parseFloat(r.total_return || 0);
      const retColor = ret >= 0 ? '#FF3B30' : '#007AFF';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border:1px solid #2A2A2A;border-radius:8px;margin-bottom:8px;background:#1E242C;">
        <div>
          <div style="font-weight:700;color:#E5E7EB;font-size:0.88rem;">${r.name || r.symbol}</div>
          <div style="font-size:0.75rem;color:#9CA3AF;margin-top:2px;">${r.strategy} · ${r.start_date || ''} ~ ${r.end_date || ''}</div>
          <div style="font-size:0.75rem;color:#9CA3AF;">승률 ${r.win_rate?.toFixed(0) || '-'}% · MDD ${r.max_drawdown?.toFixed(1) || '-'}%</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:1.1rem;font-weight:800;color:${retColor};">${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%</div>
          <div style="font-size:0.72rem;color:#4B5563;margin-top:2px;">${r.created_at?.slice(0, 10) || ''}</div>
          <button onclick="deleteBacktestResult(${r.id})" style="font-size:0.72rem;color:#4B5563;background:none;border:none;cursor:pointer;margin-top:2px;">🗑️ 삭제</button>
        </div>
      </div>`;
    }).join('');
  } catch (e) { el.innerHTML = '<div class="sp-empty">로드 실패</div>'; }
}
window.loadSavedBacktests = loadSavedBacktests;

async function deleteBacktestResult(id) {
  const ok = await spConfirm('🗑️', '삭제 확인', '이 백테스트 결과를 삭제할까요?', '삭제', '#FF3B30');
  if (!ok) return;
  await fetch(`/api/backtest/results/${id}`, { method: 'DELETE' });
  loadSavedBacktests();
}
window.deleteBacktestResult = deleteBacktestResult;

// ============================================================
// 홈 포트폴리오 요약
// ============================================================
// _lastBtResult, runBacktest, _captureBtResult → chart.js에서 처리
// ── saveAutoTradeSettings 오버라이드 ─────────────────────────────
// 버그 수정: _origSave 선언 순서 수정 + API 이중 호출 제거
const _origSave = typeof window.saveAutoTradeSettings === 'function' ? window.saveAutoTradeSettings : null;
const _origLoad = typeof window.loadAutoTradeSettings === 'function' ? window.loadAutoTradeSettings : null;
let _simpleTradePoller = null;
const _origToggleSimple = typeof window.toggleSimpleAutoTrade === 'function' ? window.toggleSimpleAutoTrade : null;
let _topPicksCache = null;
let _topPicksCacheTime = 0;
let _topPicksCacheMarket = 'nasdaq';
const _origLoadTopPicks = typeof window.loadTopPicks === 'function' ? window.loadTopPicks : null;

window._baseSelectStock = function (symbol, name) {
  // _stockSearchTarget 없으면 _searchTargetId로 폴백
  if (!_stockSearchTarget && _searchTargetId) _stockSearchTarget = _searchTargetId;
  if (!_stockSearchTarget) return;
  // hidden input에 값 설정
  const inp = document.getElementById(_stockSearchTarget);
  if (inp) inp.value = symbol;
  // tradeSymbol 선택 시 → input에 값 설정 + 호가창 로드
  if (_stockSearchTarget === 'tradeSymbol') {
    const inp = document.getElementById('tradeSymbol');
    if (inp) {
      inp.value = symbol;
      clearTimeout(window._obTimer);
      setTimeout(() => { if (typeof loadOrderBook === 'function') loadOrderBook(); }, 100);
    }
  }
  // dc-symbol-badge 업데이트
  if (_stockSearchTarget === 'dc-search-input-target') {
    const badge = document.getElementById('dc-symbol-badge');
    if (badge) badge.innerHTML = `<span style="padding:3px 10px;background:rgba(99,102,241,0.15);border-radius:999px;color:#a5b4fc;font-size:0.85rem;font-weight:700;">${symbol}</span>`;
    const symEl = document.getElementById('quantSymbol');
    if (symEl) symEl.value = symbol;
    const dcSymEl = document.getElementById('dc-symbols');
    if (dcSymEl) dcSymEl.value = symbol;
  }
  // analysis 종목 배지 업데이트
  if (_stockSearchTarget === 'analysisSymbolInput') {
    const badge = document.getElementById('analysisSymbolBadge');
    if (badge) badge.innerHTML = `<span style="font-weight:700;color:#E5E7EB;">${symbol}</span><span style="margin-left:6px;font-size:0.78rem;color:#9CA3AF;">${name}</span>`;
    if (badge) badge.style.color = '#E5E7EB';
  }
  // bt-symbol 백테스팅 심볼
  if (_stockSearchTarget === 'bt-symbol') {
    const display = document.getElementById('bt-symbol-display');
    if (display) display.innerHTML = `<span style="font-weight:700;color:#E5E7EB;">${symbol}</span><span style="margin-left:6px;font-size:0.78rem;color:#9CA3AF;">${name}</span>`;
  }
  closeStockSearch();
};
// window.selectStock은 1348줄 function selectStock 사용 (덮어쓰기 제거)
// 실시간 가격 조회 (tradeSymbol 선택 시)
async function loadTradePrice(symbol) {
  const priceBox = document.getElementById('tradePriceDisplay');
  const priceVal = document.getElementById('tradePriceValue');
  const priceChg = document.getElementById('tradePriceChange');
  if (!priceBox) return;
  priceBox.style.display = 'block';
  if (priceVal) priceVal.textContent = '조회 중...';
  if (priceChg) priceChg.textContent = '';
  try {
    const res = await fetch('/proxy/stock/price?symbol=' + encodeURIComponent(symbol));
    const d = await res.json();
    const price = d.price || d.c || d.last || 0;
    const change = d.change_pct || d.dp || 0;
    if (priceVal) priceVal.textContent = symbol.endsWith('.KS') || symbol.endsWith('.KQ')
      ? '₩' + price.toLocaleString()
      : '$' + price.toFixed(2);
    if (priceChg) {
      priceChg.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
      priceChg.style.color = change >= 0 ? '#FF3B30' : '#1E7BFF';
    }
  } catch (e) {
    if (priceVal) priceVal.textContent = '가격 조회 실패';
  }
}
// ============================================================
// 종목 분석 JS
// ============================================================
let _analysisSymbol = '';
let _analysisChartInstance = null;
async function runStockAnalysis() {
  const symbol = document.getElementById('analysisSymbolInput')?.value?.trim().toUpperCase();
  if (!symbol) { await spAlert('종목을 먼저 검색해서 선택해주세요', '알림', '⚠️'); return; }
  _analysisSymbol = symbol;
  document.getElementById('analysisLoading').style.display = 'block';
  document.getElementById('analysisResult').style.display = 'none';
  document.getElementById('analysisError').style.display = 'none';
  try {
    const res = await fetch(`/proxy/quant/api/quant/stock-analysis?symbol=${symbol}`);
    const d = await res.json();
    if (!d.ok) throw new Error(d.error || '분석 실패');
    renderAnalysisResult(d);
    loadAnalysisChart('3mo');
  } catch (e) {
    document.getElementById('analysisError').style.display = 'block';
    document.getElementById('analysisError').textContent = '❌ ' + e.message;
  } finally {
    document.getElementById('analysisLoading').style.display = 'none';
  }
}
function renderAnalysisResult(d) {
  const isKr = _analysisSymbol.endsWith('.KS') || _analysisSymbol.endsWith('.KQ');
  const currency = isKr ? '₩' : '$';
  const fmt = (v) => v ? `${currency}${isKr ? Math.round(v).toLocaleString() : v.toLocaleString()}` : '-';
  document.getElementById('analysisName').textContent = `${d.fundamentals?.name || d.symbol} (${d.symbol})`;
  document.getElementById('analysisSector').textContent = d.fundamentals?.sector || '';
  document.getElementById('analysisPrice').textContent = fmt(d.current_price);
  const chg = d.change_pct;
  const chgEl = document.getElementById('analysisChange');
  chgEl.textContent = chg != null ? `${chg >= 0 ? '+' : ''}${chg}%` : '-';
  chgEl.style.color = chg >= 0 ? '#FF3B30' : '#1E7BFF';
  document.getElementById('analysis52High').textContent = fmt(d.fundamentals?.fifty_two_week_high);
  document.getElementById('analysis52Low').textContent = fmt(d.fundamentals?.fifty_two_week_low);
  document.getElementById('analysisVolume').textContent = d.fundamentals?.volume ? (d.fundamentals.volume / 1e6).toFixed(1) + 'M' : '-';
  const mc = d.fundamentals?.market_cap;
  document.getElementById('analysisMktCap').textContent = mc ? (mc >= 1e12 ? (mc / 1e12).toFixed(1) + 'T' : (mc / 1e9).toFixed(1) + 'B') : '-';
  const c = d.consensus || {};
  const recMap = { buy: { label: '매수', color: '#10b981', bg: 'rgba(16,185,129,0.15)' }, hold: { label: '보유', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }, sell: { label: '매도', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' }, 'strong buy': { label: '강력매수', color: '#10b981', bg: 'rgba(16,185,129,0.2)' }, 'strong sell': { label: '강력매도', color: '#ef4444', bg: 'rgba(239,68,68,0.2)' } };
  const rec = recMap[c.recommendation?.toLowerCase()] || { label: c.recommendation || '-', color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' };
  const recEl = document.getElementById('analysisRecommendation');
  recEl.textContent = rec.label;
  recEl.style.color = rec.color;
  recEl.style.background = rec.bg;
  document.getElementById('analysisAnalystCount').textContent = c.analyst_count ? `애널리스트 ${c.analyst_count}명` : '';
  document.getElementById('analysisTargetMean').textContent = c.target_mean ? fmt(c.target_mean) : '-';
  document.getElementById('analysisTargetHigh').textContent = c.target_high ? fmt(c.target_high) : '-';
  document.getElementById('analysisTargetLow').textContent = c.target_low ? fmt(c.target_low) : '-';
  const upsideEl = document.getElementById('analysisUpside');
  if (c.upside_pct != null) {
    upsideEl.textContent = `현재가 대비 목표가 ${c.upside_pct >= 0 ? '+' : ''}${c.upside_pct}% ${c.upside_pct >= 0 ? '↑ 상승여력' : '↓ 하락여지'}`;
    upsideEl.style.color = c.upside_pct >= 0 ? '#10b981' : '#ef4444';
  }
  const f = d.fundamentals || {};
  const fundItems = [
    { label: 'PER', value: f.per ? f.per + '배' : '-' },
    { label: 'PBR', value: f.pbr ? f.pbr + '배' : '-' },
    { label: 'ROE', value: f.roe ? f.roe + '%' : '-', color: f.roe > 15 ? '#10b981' : f.roe > 0 ? '#E5E7EB' : '#ef4444' },
    { label: '부채비율', value: f.debt_to_equity ? f.debt_to_equity + '%' : '-', color: f.debt_to_equity < 100 ? '#10b981' : f.debt_to_equity < 200 ? '#f59e0b' : '#ef4444' },
    { label: '매출성장', value: f.revenue_growth ? f.revenue_growth + '%' : '-', color: f.revenue_growth > 10 ? '#10b981' : f.revenue_growth > 0 ? '#E5E7EB' : '#ef4444' },
    { label: '업종', value: f.industry || '-' },
  ];
  document.getElementById('analysisFundamentals').innerHTML = fundItems.map(item => `
    <div style="padding:10px;background:#1E242C;border-radius:8px;">
      <div style="font-size:0.72rem;color:#9CA3AF;margin-bottom:4px;">${item.label}</div>
      <div style="font-weight:700;color:${item.color || '#E5E7EB'};">${item.value}</div>
    </div>`).join('');
  const t = d.technical || {};
  const sigMap = { buy: { label: '매수', color: '#10b981' }, weak_buy: { label: '약한매수', color: '#34d399' }, hold: { label: '중립', color: '#f59e0b' }, weak_sell: { label: '약한매도', color: '#f87171' }, sell: { label: '매도', color: '#ef4444' } };
  const sig = sigMap[t.signal] || { label: t.signal || '-', color: '#9CA3AF' };
  const sigEl = document.getElementById('analysisTechSignal');
  sigEl.textContent = sig.label;
  sigEl.style.background = sig.color + '22';
  sigEl.style.color = sig.color;
  const details = t.details || {};
  const techItems = Object.entries(details).map(([key, val]) => `
    <div style="padding:10px;background:#1E242C;border-radius:8px;">
      <div style="font-size:0.72rem;color:#9CA3AF;margin-bottom:4px;">${key}</div>
      <div style="font-weight:700;color:${val.signal === 'buy' ? '#10b981' : val.signal === 'sell' ? '#ef4444' : '#f59e0b'};font-size:0.8rem;">${val.reason || val.signal || '-'}</div>
    </div>`).join('');
  document.getElementById('analysisTechnical').innerHTML = techItems || '<div style="color:#9CA3AF;padding:8px;">기술적 데이터 없음</div>';
  document.getElementById('analysisResult').style.display = 'block';
}
async function loadAnalysisChart(period) {
  if (!_analysisSymbol) return;
  document.querySelectorAll('.analysis-period-btn').forEach(b => b.classList.remove('active'));
  event?.target?.classList?.add('active');
  try {
    const res = await fetch(`/proxy/quant/api/quant/chart?symbol=${_analysisSymbol}&period=${period}`);
    const data = await res.json();
    if (data.error || !data.dates) return;
    if (_analysisChartInstance) { _analysisChartInstance.destroy(); _analysisChartInstance = null; }
    const ctx = document.getElementById('analysisChartCanvas')?.getContext('2d');
    if (!ctx) return;
    const up = data.ohlc.close[data.ohlc.close.length - 1] >= data.ohlc.close[0];
    _analysisChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.dates,
        datasets: [
          { label: '종가', data: data.ohlc.close, borderColor: up ? '#FF3B30' : '#1E7BFF', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true, backgroundColor: up ? 'rgba(255,59,48,0.05)' : 'rgba(30,123,255,0.05)' },
          { label: 'SMA20', data: data.sma?.sma20, borderColor: '#f59e0b', borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false, borderDash: [4, 2] },
          { label: 'BB상단', data: data.bb?.upper, borderColor: 'rgba(16,185,129,0.4)', borderWidth: 1, pointRadius: 0, fill: false, borderDash: [3, 3] },
          { label: 'BB하단', data: data.bb?.lower, borderColor: 'rgba(16,185,129,0.4)', borderWidth: 1, pointRadius: 0, fill: false, borderDash: [3, 3] },
        ]
      },
      options: {
        responsive: true, animation: false,
        plugins: { legend: { labels: { color: '#9CA3AF', font: { size: 11 } } } },
        scales: {
          x: { ticks: { color: '#9CA3AF', maxTicksLimit: 8, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#9CA3AF', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  } catch (e) { console.error('차트 로드 실패:', e); }
}
// ── 자동매매 계좌 선택기 ──────────────────────────────
window.selectedAccountId = window.selectedAccountId || localStorage.getItem('selectedAccountId') || null;
