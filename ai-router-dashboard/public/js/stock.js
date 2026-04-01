// ===== 가격 입력 원/달러 토글 =====
let _tradeCurrency = 'USD'; // 'USD' or 'KRW'
window.toggleTradeCurrency = function() {
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
  const estMin  = parseInt(new Intl.DateTimeFormat('en-US', { minute: 'numeric', timeZone: 'America/New_York' }).format(now));
  const estTime = estHour * 60 + estMin;
  if (estTime < 9 * 60 + 30 || estTime >= 16 * 60) {
    const ok = await spConfirm(
      `현재 미국 장외 시간입니다 (EST ${String(estHour).padStart(2,'0')}:${String(estMin).padStart(2,'0')}).
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
    } catch(e) {}

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
      }).catch(() => {});
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
  } catch(e) {
    // 포지션 조회 실패 시 그냥 진행 (경고만)
    const ok = await spConfirm(`${symbol} ${qty}주를 매도할까요?`, '매도 확인', '🔴', '매도', '#ef4444');
    if (!ok) return;
  }

  // 장 시간 체크
  const now = new Date();
  const estHour = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }).format(now));
  const estMin  = parseInt(new Intl.DateTimeFormat('en-US', { minute: 'numeric', timeZone: 'America/New_York' }).format(now));
  const estTime = estHour * 60 + estMin;
  if (estTime < 9 * 60 + 30 || estTime >= 16 * 60) {
    const proceed = await spConfirm(
      `현재 미국 장외 시간입니다 (EST ${String(estHour).padStart(2,'0')}:${String(estMin).padStart(2,'0')}).
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
      }).catch(() => {});
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
              <td>$${parseFloat(p.market_value).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
              <td class="${pl >= 0 ? 'text-up' : 'text-down'}">
                ${pl >= 0 ? '+' : ''}$${pl.toFixed(2)}<br>
                <small>(${plpc >= 0 ? '+' : ''}${(plpc*100).toFixed(2)}%)</small>
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
window.showRealtimePrice = async function(symbol) {
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
          <div style="font-size:1.6rem;font-weight:800;color:#6366f1;">$${(parseFloat(latestPrice)||0).toFixed(2)}</div>
        </div>
        <div style="background:#f8fafc;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:0.78rem;color:#6b7280;margin-bottom:4px;">평균단가</div>
          <div style="font-size:1.6rem;font-weight:800;color:#374151;">$${parseFloat(posData?.avg_entry_price||0).toFixed(2)}</div>
        </div>
        <div style="background:#f8fafc;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:0.78rem;color:#6b7280;margin-bottom:4px;">보유 수량</div>
          <div style="font-size:1.4rem;font-weight:800;color:#374151;">${posData?.qty || '-'}주</div>
        </div>
        <div style="background:#f8fafc;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:0.78rem;color:#6b7280;margin-bottom:4px;">평가금액</div>
          <div style="font-size:1.4rem;font-weight:800;color:#374151;">$${parseFloat(posData?.market_value||0).toFixed(2)}</div>
        </div>
      </div>
      <div style="background:${pl>=0?'#dcfce7':'#fee2e2'};border-radius:10px;padding:16px;text-align:center;margin-bottom:16px;">
        <div style="font-size:0.82rem;color:#6b7280;margin-bottom:4px;">미실현 손익</div>
        <div style="font-size:1.4rem;font-weight:800;color:${pl>=0?'#065f46':'#991b1b'};">
          ${pl>=0?'+':''}$${pl.toFixed(2)} (${plpc>=0?'+':''}${plpc.toFixed(2)}%)
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
  } catch(e) {
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
    const statusMap = { filled:'체결', partially_filled:'부분체결', canceled:'취소', pending_new:'대기', new:'접수', expired:'만료' };
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
            const date = o.filled_at && o.filled_at !== 'None' ? o.filled_at.slice(0,10) : (o.submitted_at?.slice(0,10) || '-');
            return `
            <tr>
              <td><strong>${o.symbol}</strong></td>
              <td><span style="padding:2px 8px;border-radius:999px;font-size:0.75rem;font-weight:700;background:${isBuy?'#dcfce7':'#fee2e2'};color:${isBuy?'#065f46':'#991b1b'}">${isBuy?'매수':'매도'}</span></td>
              <td>${o.qty}주</td>
              <td style="font-size:0.8rem;">${o.order_type||'-'}</td>
              <td><span style="padding:2px 8px;border-radius:999px;font-size:0.75rem;background:#f3f4f6;color:#374151;">${status}</span></td>
              <td>${filled ? '$'+filled.toFixed(2) : '-'}</td>
              <td>${total ? '$'+total.toFixed(2) : '-'}</td>
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
    const histData  = histRes.ok  ? await histRes.json()  : {};

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
    const askSize  = 0;
    const bidSize  = 0;
    const open     = parseFloat(stockInfo.open)   || latestPrice;
    const high     = parseFloat(todayBar.high)    || latestPrice;
    const low      = parseFloat(todayBar.low)     || latestPrice;
    const prevClose = parseFloat(stockInfo.price) || latestPrice;
    const volume   = stockInfo.volume || 0;

    const change    = latestPrice - open;
    const changePct = open > 0 ? (change / open * 100) : 0;
    const isUp      = change >= 0;
    const upColor   = '#16a34a';
    const dnColor   = '#dc2626';
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
          스프레드 ${spread > 0 ? '$'+spread.toFixed(2)+' ('+spreadPct.toFixed(3)+'%)' : '-'}
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
      const now = new Date().toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
      statusEl.textContent = now + ' 기준';
    }

    // 30초마다 자동 갱신
    clearTimeout(_obRefreshTimer);
    _obRefreshTimer = setTimeout(() => loadOrderBook(), 30000);

  } catch(e) {
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
    const res = await fetch('/api/auto-trade/log');
    const d = await res.json();
    const logs = d.logs || [];

    if (!logs.length) {
      el.innerHTML = '<p style="color:var(--muted);font-size:0.82rem;padding:12px;">거래 내역이 없습니다</p>';
      return;
    }

    // trade_type 배지 설정
    const typeConfig = {
      1: { label: '수동',     color: '#a78bfa', bg: 'rgba(167,139,250,0.13)' },
      2: { label: '단순자동', color: '#fb923c', bg: 'rgba(251,146,60,0.13)'  },
      3: { label: '완전자동', color: '#34d399', bg: 'rgba(52,211,153,0.13)'  },
      4: { label: '일반자동', color: '#60a5fa', bg: 'rgba(96,165,250,0.13)'  },
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
      active:  { label: '보유중', color: '#f59e0b', bg: 'rgba(245,158,11,0.13)' },
      closed:  { label: '종료',   color: '#6b7280', bg: 'rgba(107,114,128,0.13)' },
    };

    // 타입 필터 탭 상태
    const filterId = 'tradeLogFilter';
    if (!el._filterType) el._filterType = 'all';

    const filterTypes = [
      { key: 'all', label: '전체' },
      { key: '1',   label: '수동'     },
      { key: '2',   label: '단순자동' },
      { key: '3',   label: '완전자동' },
      { key: '4',   label: '일반자동' },
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
      const isBuy   = l.action === 'BUY';
      const isProfit = l.action.includes('PROFIT');
      const isLoss   = l.action.includes('LOSS') || l.action.includes('STOP');
      const actionColor = isBuy ? '#60a5fa' : isProfit ? '#34d399' : isLoss ? '#f87171' : '#9CA3AF';

      const pnlVal = parseFloat(l.profit_pct || 0);
      const pnlColor = pnlVal > 0 ? '#34d399' : pnlVal < 0 ? '#f87171' : '#9CA3AF';
      const pnl = (l.profit_pct != null && l.profit_pct !== 0)
        ? `${pnlVal > 0 ? '+' : ''}${pnlVal.toFixed(2)}%` : '-';

      const tc = typeConfig[l.trade_type] || { label: '기타', color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' };
      const sc = statusConfig[l.status]   || { label: l.status, color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' };

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
  } catch(e) {
    el.innerHTML = `<p style="color:#ef4444;font-size:0.82rem;padding:12px;">로드 실패: ${e.message}</p>`;
  }
}

// 주식 탭 진입 시 거래 로그 자동 로드
(function() {
  const _origSwitchTab = window.switchTab;
  if (typeof _origSwitchTab === 'function') {
    window.switchTab = function(tabKey, ...args) {
      _origSwitchTab(tabKey, ...args);
      if (tabKey === 'stock') {
        setTimeout(() => loadTradeLog(), 300);
      }
    };
  }
})();

// 종목 검색 팝업에서 선택 시 호가창도 자동 로드
// 종목 선택 시 호가창 로드 + 현재가 자동 설정
const _origSelectStock = window.selectStock;
window.selectStock = function(symbol, name) {
  if (typeof _origSelectStock === 'function') _origSelectStock(symbol, name);
  setTimeout(() => {
    if (document.getElementById('tradeSymbol')?.value === symbol) loadOrderBook();
  }, 100);
  // 현재가 자동 설정
  fetch('/proxy/stock/api/stock/price?symbol=' + symbol)
    .then(r => r.json())
    .then(d => {
      const price = d.price || d.regularMarketPrice;
      const priceEl = document.getElementById('tradePrice');
      if (price && priceEl) {
        priceEl.value = parseFloat(price).toFixed(2);
        _tradeCurrency = 'USD';
        const btn = document.getElementById('tradeCurrencyBtn');
        if (btn) btn.textContent = 'USD';
      }
    }).catch(() => {});
};
