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
        if (el) el.innerHTML = `<div style="padding:16px;background:#fff0f0;border-radius:8px;color:#ef4444;font-size:0.85rem;">⚠️ ${data.error}</div>`;
      });
      return;
    }
    renderCharts(data);
  } catch (e) {
    ['priceChartEl', 'volumeChartEl', 'rsiChartEl', 'macdChartEl'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<div style="padding:16px;background:#fff0f0;border-radius:8px;color:#ef4444;font-size:0.85rem;">⚠️ Server connection failed (port 5002)</div>`;
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

  const gridColor = 'rgba(0,0,0,0.05)';
  const fontColor = '#6b7280';
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
      scales: { y: { ticks: { callback: v => '$' + v.toLocaleString() }, grid: { color: '#f3f4f6' } }, x: { grid: { display: false } } }
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
      scales: { r: { grid: { color: '#f3f4f6' }, ticks: { display: false } } }
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
      scales: { x: { grid: { color: '#f3f4f6' } }, y: { grid: { display: false } } }
    }
  });
}