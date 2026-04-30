// ============================================================
// account.js — loadAccount / loadPrices
// 원본 stock.js 라인 67-171 에서 분할 (모놀리식 정리)
// 모든 함수는 global scope (classic <script>) — 다른 파일에서 호출 가능
// ============================================================

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
      el.innerHTML = _safeHTML(`
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;width:100%;">
          <div style="font-weight:700;color:#92400e;margin-bottom:6px;">🔑 Alpaca Not Connected</div>
          <div style="color:#78350f;font-size:0.88rem;margin-bottom:12px;">Register your Alpaca API key above to view account info.</div>
          <button onclick="toggleAlpacaKeyForm();document.getElementById('alpacaKeyForm').scrollIntoView({behavior:'smooth'})"
            style="background:#6366f1;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;font-size:0.85rem;">
            + Connect Now
          </button>
        </div>`);
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
        el.innerHTML = _safeHTML(`
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
          </div>`);
        return;
      }

      el.innerHTML = _safeHTML(`<div style="background:#fff0f0;border:1px solid #fecaca;border-radius:10px;padding:14px 16px;color:#dc2626;font-size:0.88rem;">⚠️ ${msg}</div>`);
      return;
    }

    // 3. 정상 계좌 표시
    const activeAcc = keyData.accounts?.find(a => a.is_active) || keyData.accounts?.[0];
    const mode = activeAcc?.alpaca_paper ? '🧪 Paper' : '💰 Live';
    el.innerHTML = _safeHTML(`
      <div class="account-metric"><div class="lbl">Cash</div><div class="val" style="color:#4f8fff;">$${parseFloat(data.cash).toLocaleString()}</div></div>
      <div class="account-metric"><div class="lbl">Portfolio</div><div class="val" style="color:#10b981;">$${parseFloat(data.portfolio_value).toLocaleString()}</div></div>
      <div class="account-metric"><div class="lbl">Buying Power</div><div class="val" style="color:#f59e0b;">$${parseFloat(data.buying_power).toLocaleString()}</div></div>
      <div class="account-metric"><div class="lbl">Equity</div><div class="val" style="color:#a78bfa;">$${parseFloat(data.equity).toLocaleString()}</div></div>
    `);
  } catch (e) {
    el.innerHTML = _safeHTML(`<div class="mini-card" style="color:#ef4444;">서버 연결 Error: ${e.message}</div>`);
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
      <div class="price-card" data-action="openChart" data-args="${_jsAttr([s.symbol])}" style="cursor:pointer;">
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

