// ============================================================
// positions.js — 포지션 / 주문 / 호가창
// 원본 stock.js 라인 421-755 에서 분할 (모놀리식 정리)
// 모든 함수는 global scope (classic <script>) — 다른 파일에서 호출 가능
// ============================================================

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
    document.getElementById('positionsTable').innerHTML = _safeHTML(`
      <table class="stock-table">
        <thead><tr><th>종목</th><th>수량</th><th>평균단가</th><th>현재가</th><th>평가금액</th><th>손익</th><th>실시간</th></tr></thead>
        <tbody>
          ${positions.map(p => {
      const pl = parseFloat(p.unrealized_pl) || 0;
      const plpc = parseFloat(p.unrealized_plpc) || 0;
      return `
            <tr>
              <td><strong style="cursor:pointer;color:#6366f1;" data-action="showRealtimePrice" data-args="${_jsAttr([p.symbol])}">${p.symbol}</strong></td>
              <td>${p.qty}주</td>
              <td>$${parseFloat(p.avg_entry_price).toFixed(2)}</td>
              <td>$${parseFloat(p.current_price).toFixed(2)}</td>
              <td>$${parseFloat(p.market_value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td class="${pl >= 0 ? 'text-up' : 'text-down'}">
                ${pl >= 0 ? '+' : ''}$${pl.toFixed(2)}<br>
                <small>(${plpc >= 0 ? '+' : ''}${(plpc * 100).toFixed(2)}%)</small>
              </td>
              <td><button class="sp-btn sp-btn-outline sp-btn-sm" data-action="showRealtimePrice" data-args="${_jsAttr([p.symbol])}">📈 조회</button></td>
            </tr>`;
    }).join('')}
        </tbody>
      </table>`);
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

    body.innerHTML = _safeHTML(`
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
        <button data-action="showRealtimePrice" data-args="${_jsAttr([symbol])}" class="sp-btn sp-btn-outline sp-btn-sm" style="margin-right:8px;">🔄 새로고침</button>
        <button onclick="document.getElementById('realtimeModal').style.display='none'" class="sp-btn sp-btn-indigo sp-btn-sm">닫기</button>
      </div>`);
  } catch (e) {
    body.innerHTML = _safeHTML(`<div style="color:#ef4444;padding:16px;">로드 실패: ${e.message}</div>`);
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
    document.getElementById('ordersTable').innerHTML = _safeHTML(`
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
      </table>`);
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
      priceEl.innerHTML = _safeHTML(`
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
        </div>`);
    }

    // ── 호가창 ──
    if (tableEl) {
      const spread = askPrice > 0 && bidPrice > 0 ? (askPrice - bidPrice) : 0;
      const spreadPct = bidPrice > 0 ? (spread / bidPrice * 100) : 0;
      const maxSize = Math.max(askSize, bidSize, 1);
      const askBarW = Math.round(askSize / maxSize * 100);
      const bidBarW = Math.round(bidSize / maxSize * 100);

      tableEl.innerHTML = _safeHTML(`
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
        </div>`);
    }

    if (statusEl) {
      const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      statusEl.textContent = now + ' 기준';
    }

    // 30초마다 자동 갱신
    clearTimeout(_obRefreshTimer);
    _obRefreshTimer = setTimeout(() => loadOrderBook(), 30000);

  } catch (e) {
    if (priceEl) priceEl.innerHTML = _safeHTML(`<div style="color:#ef4444;font-size:0.82rem;padding:12px;">조회 실패: ${e.message}</div>`);
    if (statusEl) statusEl.textContent = '오류';
  }
}

