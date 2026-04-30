// ============================================================
// trade.js — 매수/매도 (buyStock/sellStock)
// 원본 stock.js 라인 172-420 에서 분할 (모놀리식 정리)
// 모든 함수는 global scope (classic <script>) — 다른 파일에서 호출 가능
// ============================================================

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

