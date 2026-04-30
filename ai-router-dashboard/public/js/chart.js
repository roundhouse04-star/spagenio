// ===== 차트 인스턴스 관리 =====
let chartInstances = {};

let currentChartSymbol = '';

async function openChart(symbol) {
  if (!symbol) return;
  currentChartSymbol = symbol;
  document.getElementById('chartTitle').textContent = `📈 ${symbol} 차트`;
  document.getElementById('chartPopup').classList.add('open');
  document.body.style.overflow = 'hidden';

  // 기간 버튼 초기화
  document.querySelectorAll('.chart-period-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.chart-period-btn').classList.add('active');

  await loadChartData(symbol, '3mo');
}

function closeChart() {
  document.getElementById('chartPopup').classList.remove('open');
  document.body.style.overflow = '';
  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};
}

async function changePeriod(period, btn) {
  document.querySelectorAll('.chart-period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  await loadChartData(currentChartSymbol, period);
}

async function loadChartData(symbol, period) {
  const modal = document.getElementById('chartModal');
  try {
    // 로딩 표시
    ['priceChartEl', 'volumeChartEl', 'rsiChartEl', 'macdChartEl'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:80px;color:#9ca3af;font-size:0.85rem;">Loading...</div>';
    });

    const res = await fetch(`/proxy/quant/api/quant/chart?symbol=${symbol}&period=${period}`);
    const data = await res.json();

    if (data.error) {
      // alert 대신 모달 내 오류 표시
      ['priceChartEl', 'volumeChartEl', 'rsiChartEl', 'macdChartEl'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = _safeHTML(`<div style="padding:16px;background:rgba(255,59,48,0.12);border-radius:8px;color:#FF3B30;font-size:0.85rem;">⚠️ ${data.error}</div>`);
      });
      return;
    }
    renderCharts(data);
  } catch (e) {
    ['priceChartEl', 'volumeChartEl', 'rsiChartEl', 'macdChartEl'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = _safeHTML(`<div style="padding:16px;background:rgba(255,59,48,0.12);border-radius:8px;color:#FF3B30;font-size:0.85rem;">⚠️ Server connection failed (port 5002)</div>`);
    });
  }
}

function renderCharts(data) {
  // Chart.js는 index.html에서 이미 로드됨
  if (window.Chart) {
    drawAllCharts(data);
  } else {
    // 혹시 아직 로드 안됐으면 잠깐 대기
    setTimeout(() => drawAllCharts(data), 300);
  }
}

function drawAllCharts(data) {
  const { dates, ohlc, volume, rsi, bb, macd, sma } = data;

  // 기존 차트 제거
  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};

  const gridColor = 'rgba(255,255,255,0.07)';
  const fontColor = '#9CA3AF';
  const commonOpts = {
    responsive: true,
    animation: false,
    plugins: { legend: { labels: { color: fontColor, font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: fontColor, maxTicksLimit: 10, font: { size: 10 } }, grid: { color: gridColor } },
      y: { ticks: { color: fontColor, font: { size: 10 } }, grid: { color: gridColor } }
    }
  };

  // 1. 주가 차트
  chartInstances.price = new Chart(document.getElementById('chartPrice'), {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        { label: 'Close', data: ohlc.close, borderColor: '#6366f1', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: false },
        { label: 'SMA20', data: sma.sma20, borderColor: '#f59e0b', borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false, borderDash: [4, 2] },
        { label: 'SMA50', data: sma.sma50, borderColor: '#ef4444', borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false, borderDash: [6, 3] },
        { label: 'BB 상단', data: bb.upper, borderColor: 'rgba(16,185,129,0.5)', borderWidth: 1, pointRadius: 0, tension: 0.3, fill: false, borderDash: [3, 3] },
        { label: 'BB 하단', data: bb.lower, borderColor: 'rgba(16,185,129,0.5)', borderWidth: 1, pointRadius: 0, tension: 0.3, fill: '+1', backgroundColor: 'rgba(16,185,129,0.05)', borderDash: [3, 3] },
      ]
    },
    options: { ...commonOpts }
  });

  // 2. Volume 차트
  const volColors = ohlc.close.map((c, i) => i === 0 ? 'rgba(99,102,241,0.5)' : c >= ohlc.close[i - 1] ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)');
  chartInstances.volume = new Chart(document.getElementById('chartVolume'), {
    type: 'bar',
    data: { labels: dates, datasets: [{ label: 'Volume', data: volume, backgroundColor: volColors, borderWidth: 0 }] },
    options: { ...commonOpts, plugins: { legend: { display: false } } }
  });

  // 3. RSI 차트
  chartInstances.rsi = new Chart(document.getElementById('chartRsi'), {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        { label: 'RSI', data: rsi, borderColor: '#8b5cf6', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: false },
        { label: 'Overbought(70)', data: Array(dates.length).fill(70), borderColor: 'rgba(239,68,68,0.4)', borderWidth: 1, pointRadius: 0, borderDash: [4, 2], fill: false },
        { label: 'Oversold(30)', data: Array(dates.length).fill(30), borderColor: 'rgba(16,185,129,0.4)', borderWidth: 1, pointRadius: 0, borderDash: [4, 2], fill: false },
      ]
    },
    options: { ...commonOpts, scales: { ...commonOpts.scales, y: { ...commonOpts.scales.y, min: 0, max: 100 } } }
  });

  // 4. MACD 차트
  const histColors = macd.histogram.map(v => v >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)');
  chartInstances.macd = new Chart(document.getElementById('chartMacd'), {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [
        { type: 'line', label: 'MACD', data: macd.macd, borderColor: '#3b82f6', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: false },
        { type: 'line', label: 'Signal', data: macd.signal, borderColor: '#f97316', borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false },
        { type: 'bar', label: 'Histogram', data: macd.histogram, backgroundColor: histColors, borderWidth: 0 },
      ]
    },
    options: { ...commonOpts }
  });
}

// ESC 키로 닫기
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeChart(); });
// 배경 클릭으로 닫기
document.getElementById('chartPopup')?.addEventListener('click', e => { if (e.target.id === 'chartPopup') closeChart(); });

// ===== Chart.js 차트 관리 =====
const charts = {};

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// 주식 가격 바 차트
function renderPriceChart(stocks) {
  const wrap = document.getElementById('priceChartWrap');
  if (!wrap || !stocks?.length) return;
  wrap.style.display = 'block';
  destroyChart('priceChart');
  const ctx = document.getElementById('priceChart').getContext('2d');
  charts['priceChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: stocks.map(s => s.symbol),
      datasets: [{
        label: 'Current ($)',
        data: stocks.map(s => s.price),
        backgroundColor: stocks.map(s => s.change >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)'),
        borderColor: stocks.map(s => s.change >= 0 ? '#10b981' : '#ef4444'),
        borderWidth: 1, borderRadius: 6,
      }]
    },
    options: {
      responsive: true, plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `$${ctx.parsed.y.toLocaleString()}` } }
      },
      scales: { y: { ticks: { callback: v => '$' + v.toLocaleString() }, grid: { color: 'rgba(255,255,255,0.07)' } }, x: { grid: { display: false } } }
    }
  });
}

// 퀀트 지표 차트 (RSI/Score 등)
function renderQuantChart(symbol, indicators) {
  const wrap = document.getElementById('quantChartWrap');
  if (!wrap || !indicators) return;
  wrap.style.display = 'block';
  destroyChart('quantChart');
  const ctx = document.getElementById('quantChart').getContext('2d');
  const labels = Object.keys(indicators);
  const values = Object.values(indicators).map(v => typeof v === 'number' ? parseFloat(v.toFixed(2)) : 0);
  charts['quantChart'] = new Chart(ctx, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: symbol,
        data: values,
        backgroundColor: 'rgba(99,102,241,0.15)',
        borderColor: '#6366f1',
        pointBackgroundColor: '#6366f1',
        pointRadius: 4, borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { r: { grid: { color: 'rgba(255,255,255,0.07)' }, ticks: { display: false } } }
    }
  });
}

// 일괄 분석 점수 바 차트
function renderBatchChart(results) {
  const wrap = document.getElementById('batchChartWrap');
  if (!wrap || !results?.length) return;
  wrap.style.display = 'block';
  destroyChart('batchChart');
  const ctx = document.getElementById('batchChart').getContext('2d');
  const sorted = [...results].sort((a, b) => (b.score || 0) - (a.score || 0));
  charts['batchChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(r => r.symbol),
      datasets: [{
        label: '복합 점수',
        data: sorted.map(r => parseFloat((r.score || 0).toFixed(3))),
        backgroundColor: sorted.map(r => {
          const s = r.signal || r.recommendation || '';
          return s.includes('buy') ? 'rgba(16,185,129,0.7)' : s.includes('sell') ? 'rgba(239,68,68,0.7)' : 'rgba(245,158,11,0.7)';
        }),
        borderRadius: 6, borderWidth: 0,
      }]
    },
    options: {
      indexAxis: 'y', responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `점수: ${ctx.parsed.x}` } }
      },
      scales: { x: { grid: { color: 'rgba(255,255,255,0.07)' } }, y: { grid: { display: false } } }
    }
  });
}
// ===== 성과 대시보드 파이차트 (index.html에서 이동) =====
let assetPieInstance = null;
let perfEquityChartInstance = null;
let positionPieInstance = null;

async function loadAssetPieChart() {
  try {
    const accountId = window._perfAccountId || '';
    const accountParam = accountId ? `&account_id=${accountId}` : '';
    const res = await fetch(`/api/performance/summary?account_type=${window._perfAccountType || 0}${accountParam}`);
    const d = await res.json();
    const chartEl = document.getElementById('assetPieChart');
    const legendEl = document.getElementById('assetPieLegend');
    if (!d.ok || !d.latest) {
      legendEl.innerHTML = '<div style="color:#4B5563;text-align:center;padding:16px;font-size:0.8rem;">스냅샷 없음<br><button onclick="savePerformanceSnapshot()" class="sp-btn sp-btn-indigo sp-btn-sm" style="margin-top:8px;">📸 저장</button></div>';
      return;
    }
    const cash = parseFloat(d.latest.cash || 0);
    const stock = parseFloat(d.latest.portfolio_value || 0);
    const total = cash + stock;
    if (total <= 0) { legendEl.innerHTML = '<div style="color:#4B5563;text-align:center;padding:16px;">데이터 없음</div>'; return; }
    const cashPct = (cash / total * 100).toFixed(1);
    const stockPct = (stock / total * 100).toFixed(1);
    if (assetPieInstance) assetPieInstance.destroy();
    assetPieInstance = new Chart(chartEl.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['현금', '주식'],
        datasets: [{ data: [cash, stock], backgroundColor: ['#4f8fff', '#FF3B30'], borderWidth: 0, hoverOffset: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `$${parseFloat(ctx.parsed).toLocaleString()} (${(ctx.parsed / total * 100).toFixed(1)}%)` } } },
        cutout: '65%'
      }
    });
    legendEl.innerHTML = _safeHTML(`
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:10px;height:10px;border-radius:2px;background:#4f8fff;flex-shrink:0;"></div>
          <div><div style="color:#9CA3AF;font-size:0.72rem;">현금</div><div style="color:#E5E7EB;font-weight:700;">$${cash.toLocaleString()}</div><div style="color:#4f8fff;font-size:0.72rem;">${cashPct}%</div></div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:10px;height:10px;border-radius:2px;background:#FF3B30;flex-shrink:0;"></div>
          <div><div style="color:#9CA3AF;font-size:0.72rem;">주식</div><div style="color:#E5E7EB;font-weight:700;">$${stock.toLocaleString()}</div><div style="color:#FF3B30;font-size:0.72rem;">${stockPct}%</div></div>
        </div>
        <div style="margin-top:4px;padding-top:8px;border-top:1px solid #2A2A2A;">
          <div style="color:#9CA3AF;font-size:0.72rem;">총 자산</div>
          <div style="color:#E5E7EB;font-weight:800;font-size:1rem;">$${total.toLocaleString()}</div>
        </div>
      </div>`);
  } catch (e) { document.getElementById('assetPieLegend').innerHTML = '<div style="color:#4B5563;font-size:0.8rem;">로드 실패</div>'; }
}

async function loadPositionPieChart() {
  const chartEl = document.getElementById('positionPieChart');
  const legendEl = document.getElementById('positionPieLegend');
  try {
    const res = await fetch('/api/alpaca-user/v2/positions');
    const d = await res.json();
    const positions = d.positions || [];
    if (!positions.length) {
      legendEl.innerHTML = '<div style="color:#4B5563;text-align:center;padding:16px;font-size:0.8rem;">보유 종목 없음</div>';
      return;
    }
    const colors = ['#FF3B30', '#1E7BFF', '#FFD60A', '#BF5AF2', '#FF9F0A', '#30D158', '#64D2FF', '#FF6B6B'];
    const labels = positions.map(p => p.symbol);
    const values = positions.map(p => parseFloat(p.market_value) || 0);
    const total = values.reduce((a, b) => a + b, 0);
    if (positionPieInstance) positionPieInstance.destroy();
    positionPieInstance = new Chart(chartEl.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors.slice(0, positions.length), borderWidth: 0, hoverOffset: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `$${parseFloat(ctx.parsed).toLocaleString()} (${(ctx.parsed / total * 100).toFixed(1)}%)` } } },
        cutout: '65%'
      }
    });
    legendEl.innerHTML = _safeHTML(`<div style="display:flex;flex-direction:column;gap:6px;max-height:140px;overflow-y:auto;">
      ${positions.map((p, i) => {
      const val = parseFloat(p.market_value) || 0;
      const pct = (val / total * 100).toFixed(1);
      const pl = parseFloat(p.unrealized_plpc || 0) * 100;
      return `<div style="display:flex;align-items:center;gap:6px;">
          <div style="width:8px;height:8px;border-radius:2px;background:${colors[i]};flex-shrink:0;"></div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#E5E7EB;font-weight:700;font-size:0.78rem;">${p.symbol}</span>
              <span style="color:${colors[i]};font-size:0.72rem;">${pct}%</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#9CA3AF;font-size:0.7rem;">$${val.toLocaleString()}</span>
              <span style="color:${pl >= 0 ? '#FF3B30' : '#1E7BFF'};font-size:0.7rem;">${pl >= 0 ? '+' : ''}${pl.toFixed(1)}%</span>
            </div>
          </div>
        </div>`;
    }).join('')}
    </div>`);
  } catch (e) { legendEl.innerHTML = '<div style="color:#4B5563;font-size:0.8rem;">Alpaca 연결 필요</div>'; }
}


// ===== 성과/백테스트/텔레그램 (index.html에서 이동) =====

async function loadPerformanceSummary() {
  try {
    const accountId = window._perfAccountId || '';
    const accountParam = accountId ? `&account_id=${accountId}` : '';
    let res = await fetch(`/api/performance/summary?account_type=${window._perfAccountType || 0}${accountParam}`);
    let d = await res.json();
    // 선택한 타입 데이터 없으면 account_type=0(전체)으로 폴백
    if (!d.ok || !d.latest) {
      res = await fetch(`/api/performance/summary?account_type=0${accountParam}`);
      d = await res.json();
    }
    if (!d.ok || !d.latest) {
      document.getElementById('perf-equity').textContent = '-';
      return;
    }
    const { latest, winRate, maxMdd, monthPnl } = d;
    // 총 자산
    document.getElementById('perf-equity').textContent = `$${parseFloat(latest.total_equity || 0).toLocaleString()}`;
    document.getElementById('perf-equity-sub').textContent = `현금 $${parseFloat(latest.cash || 0).toLocaleString()}`;
    // 오늘 손익
    const dp = parseFloat(latest.daily_pnl || 0);
    const dpc = parseFloat(latest.daily_pnl_pct || 0);
    const dpEl = document.getElementById('perf-daily-pnl');
    dpEl.textContent = `${dp >= 0 ? '+' : ''}$${dp.toFixed(0)}`;
    dpEl.style.color = dp >= 0 ? '#FF3B30' : '#007AFF';
    document.getElementById('perf-daily-pct').textContent = `${dpc >= 0 ? '+' : ''}${dpc.toFixed(2)}%`;
    // 누적 수익률
    const tp = parseFloat(latest.total_pnl || 0);
    const tpc = parseFloat(latest.total_pnl_pct || 0);
    const tpEl = document.getElementById('perf-total-pnl');
    tpEl.textContent = `${tp >= 0 ? '+' : ''}$${tp.toFixed(0)}`;
    tpEl.style.color = tp >= 0 ? '#FF3B30' : '#007AFF';
    document.getElementById('perf-total-pct').textContent = `${tpc >= 0 ? '+' : ''}${tpc.toFixed(2)}%`;
    // 승률 / MDD
    document.getElementById('perf-winrate').textContent = `${winRate.toFixed(0)}%`;
    document.getElementById('perf-mdd').textContent = `MDD -${parseFloat(maxMdd || 0).toFixed(1)}%`;
  } catch (e) { console.error('성과 요약 로드 실패', e); }
}
async function loadPerformanceHistory() {
  try {
    const accountId = window._perfAccountId || '';
    const accountParam = accountId ? `&account_id=${accountId}` : '';
    const res = await fetch(`/api/performance/history?days=30&account_type=${window._perfAccountType || 0}${accountParam}`);
    const d = await res.json();
    const chartEl = document.getElementById('perfEquityChart');
    const emptyEl = document.getElementById('perfChartEmpty');
    if (!d.ok || !d.history?.length) {
      if (chartEl) chartEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    if (chartEl) chartEl.style.display = 'block';
    const labels = d.history.map(h => h.snapshot_date.slice(5));
    const equityData = d.history.map(h => h.total_equity);
    if (perfEquityChartInstance) perfEquityChartInstance.destroy();
    perfEquityChartInstance = new Chart(chartEl.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: '총 자산',
          data: equityData,
          borderColor: '#4f8fff',
          backgroundColor: 'rgba(79,143,255,0.08)',
          borderWidth: 2,
          pointRadius: 3,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#9CA3AF', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
          y: { ticks: { color: '#9CA3AF', font: { size: 10 }, callback: v => '$' + v.toLocaleString() }, grid: { color: 'rgba(255,255,255,0.06)' } }
        }
      }
    });
  } catch (e) { console.error('성과 이력 로드 실패', e); }
}
async function savePerformanceSnapshot() {
  try {
    const res = await fetch('/api/performance/snapshot', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const d = await res.json();
    if (d.ok) {
      await spAlert('성과 스냅샷이 저장됐어요!', '저장 완료', '✅');
      loadPerformanceSummary();
      loadPerformanceHistory();
    } else { await spAlert(d.error || '저장 실패', '오류', '❌'); }
  } catch (e) { await spAlert('오류: ' + e.message, '오류', '❌'); }
}
async function loadTradeHistory() {
  async function saveBacktestResult(resultData) {
    try {
      const res = await fetch('/api/backtest/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resultData)
      });
      const d = await res.json();
      if (d.ok) await spAlert(`백테스트 결과가 저장됐어요! (ID: ${d.id})`, '저장 완료', '✅');
      else await spAlert(d.error || '저장 실패', '오류', '❌');
    } catch (e) { await spAlert('오류: ' + e.message, '오류', '❌'); }
  }
  async function loadSavedBacktests() {
    async function deleteBacktestResult(id) {
      async function saveTelegramSettings() {
        async function testTelegramAlert() {
          try {
            const res = await fetch('/api/telegram/alert/test', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            const d = await res.json();
            showTgMsg(d.ok ? '✅ 테스트 메시지 발송 완료!' : '❌ 발송 실패 — Bot Token/Chat ID를 확인해주세요', d.ok);
            if (d.ok) loadTelegramAlertLog();
          } catch (e) { showTgMsg('❌ 오류: ' + e.message, false); }
        }
        function showTgMsg(msg, isOk) {
          async function loadTelegramAlertLog() {
            async function loadHomePortfolioSummary() {
              try {
                const res = await fetch('/api/performance/summary');
                const d = await res.json();
                if (!d.ok || !d.latest) return;
                const wrap = document.getElementById('homePortfolioWrap');
                if (wrap) wrap.style.display = 'block';
                const { latest, winRate, maxMdd } = d;
                const el = (id) => document.getElementById(id);
                if (el('homeEquity')) el('homeEquity').textContent = `$${parseFloat(latest.total_equity || 0).toLocaleString()}`;
                const dp = parseFloat(latest.daily_pnl || 0);
                const dpc = parseFloat(latest.daily_pnl_pct || 0);
                if (el('homeDailyPnl')) { el('homeDailyPnl').textContent = `${dp >= 0 ? '+' : ''}$${dp.toFixed(0)} (${dpc >= 0 ? '+' : ''}${dpc.toFixed(2)}%)`; el('homeDailyPnl').style.color = dp >= 0 ? '#16a34a' : '#dc2626'; }
                const tp = parseFloat(latest.total_pnl_pct || 0);
                if (el('homeTotalPnl')) { el('homeTotalPnl').textContent = `${tp >= 0 ? '+' : ''}${tp.toFixed(2)}%`; el('homeTotalPnl').style.color = tp >= 0 ? '#16a34a' : '#dc2626'; }
                if (el('homeWinRate')) el('homeWinRate').textContent = `${winRate.toFixed(0)}% / -${parseFloat(maxMdd || 0).toFixed(1)}%`;
              } catch (e) { }
            }
            // ============================================================
            // 백테스트 결과 DB 저장 연동
            // ============================================================
            let _lastBtResult = null;
            const _origRunBacktest = typeof window.runBacktest === 'function' ? window.runBacktest : null;
            window.runBacktest = async function (...args) {
              document.getElementById('bt-save-wrap').style.display = 'none';
              _lastBtResult = null;
              if (typeof _origRunBacktest === 'function') await _origRunBacktest.apply(this, args);
            };
            // 결과 저장 함수
            async function saveBtResultToDb() {
              if (!_lastBtResult) {
                await spAlert('저장할 결과가 없어요. 먼저 백테스트를 실행해주세요.', '알림', 'ℹ️');
                return;
              }
              await saveBacktestResult(_lastBtResult);
              loadSavedBacktests();
            }
            // 백테스트 결과 캡처 (공통 js와 연동)
            window._captureBtResult = function (result) {
              _lastBtResult = result;
            };

            // ── 성과 스냅샷 자동 저장 스케줄러 (KST 06:05) ──
            (function autoSnapshotScheduler() {
              function msUntilSnapshot() {
                const now = new Date();
                const target = new Date();
                target.setHours(6, 5, 0, 0);
                if (now >= target) target.setDate(target.getDate() + 1);
                return target - now;
              }
              function scheduleSnapshot() {
                setTimeout(async () => {
                  try {
                    const res = await fetch('/api/performance/snapshot', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                    const d = await res.json();
                    if (d.ok) console.log('[spagenio] 성과 스냅샷 자동 저장 완료');
                  } catch (e) { }
                  scheduleSnapshot();
                }, msUntilSnapshot());
              }
              scheduleSnapshot();
            })();
          }
        }
      }
    }
  }
}
