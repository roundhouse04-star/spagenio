// ===== 뉴스 (RSS 실시간 조회 - DB 저장 없음) =====
let currentCategory = 'all';

async function loadNews() {
  await fetchNews(currentCategory);
}

async function fetchNews(category) {
  const container = document.getElementById('newsContent');
  const count = document.getElementById('newsCount');
  if (container) container.innerHTML = '<p style="color:var(--muted);padding:24px;">⏳ 뉴스 불러오는 중...</p>';

  try {
    const res = await fetch(`/api/news/fetch?category=${encodeURIComponent(category)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '뉴스 조회 실패');
    const newsList = data.news || [];
    if (count) count.textContent = `총 ${newsList.length}개`;
    renderNews(newsList);
  } catch (e) {
    if (container) container.innerHTML =
      `<p style="color:var(--muted);padding:24px;">뉴스를 불러오지 못했습니다.<br><small>${e.message}</small></p>`;
  }
}

function filterNewsByCategory(category, btn) {
  document.querySelectorAll('.news-tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  currentCategory = category;
  fetchNews(category);
}

function renderNews(newsList) {
  const container = document.getElementById('newsContent');
  if (!newsList.length) {
    container.innerHTML = '<p style="color:var(--muted);padding:24px;">표시할 뉴스가 없습니다.<br>RSS 소스가 활성화되어 있는지 확인해주세요.</p>';
    return;
  }

  const categoryLabels = { global: '🌍 글로벌', korea: '🇰🇷 한국', it: '💻 IT', economy: '💰 경제' };

  container.innerHTML = newsList.map(n => {
    const safeUrl = (n.url || '').replace(/'/g, '%27');
    const time = n.publishedAt
      ? new Date(n.publishedAt).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })
      : '';
    return `
    <div class="news-item" style="cursor:pointer;" onclick="window.open('${safeUrl}','_blank')">
      <div class="news-category">
        ${categoryLabels[n.category] || n.category}
        <span class="news-history-badge" style="background:#f9fafb;color:#6b7280;border-color:#e5e7eb;">
          📰 ${n.source}
        </span>
      </div>
      <div class="news-title" style="font-weight:600;font-size:0.97rem;color:#111827;margin:6px 0 4px;line-height:1.5;">
        ${n.title || '제목 없음'}
        <span style="font-size:0.78rem;color:#6366f1;margin-left:6px;">↗ 원문</span>
      </div>
      <div class="news-date" style="font-size:0.8rem;color:#9ca3af;">${time}</div>
    </div>`;
  }).join('');
}

// ===== RSS 소스 관리 =====
async function loadRssSources() {
  try {
    const res = await fetch('/api/news/sources');
    const data = await res.json();
    renderRssSources(data.sources || []);
  } catch (e) {
    console.error('RSS 소스 로드 실패:', e);
  }
}

function renderRssSources(sources) {
  const container = document.getElementById('rssSourceList');
  if (!container) return;

  const categoryLabels = { global: '🌍 글로벌', korea: '🇰🇷 한국', it: '💻 IT', economy: '💰 경제' };

  if (!sources.length) {
    container.innerHTML = '<p style="color:var(--muted);font-size:0.88rem;">등록된 RSS 소스가 없습니다.</p>';
    return;
  }

  container.innerHTML = sources.map(s => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f3f4f6;">
      <label style="position:relative;display:inline-block;width:36px;height:20px;flex-shrink:0;">
        <input type="checkbox" ${s.enabled ? 'checked' : ''} onchange="toggleRssSource(${s.id}, this.checked)"
          style="opacity:0;width:0;height:0;position:absolute;">
        <span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:${s.enabled ? '#6366f1' : '#d1d5db'};border-radius:20px;transition:.3s;">
          <span style="position:absolute;content:'';height:14px;width:14px;left:${s.enabled ? '19px' : '3px'};bottom:3px;background:white;border-radius:50%;transition:.3s;"></span>
        </span>
      </label>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:0.9rem;color:#111827;">${s.name}</div>
        <div style="font-size:0.75rem;color:#9ca3af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.url}</div>
      </div>
      <span style="font-size:0.75rem;padding:2px 8px;border-radius:99px;background:#eef2ff;color:#6366f1;flex-shrink:0;">
        ${categoryLabels[s.category] || s.category}
      </span>
      <button onclick="deleteRssSource(${s.id}, '${s.name}')" class="sp-btn sp-btn-red" style="padding:4px 10px;font-size:0.78rem;">삭제</button>
    </div>
  `).join('');
}

async function toggleRssSource(id, enabled) {
  try {
    await fetch(`/api/news/sources/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
  } catch (e) {
    await spAlert('소스 상태 변경 실패', '오류', '❌');
    loadRssSources();
  }
}

async function deleteRssSource(id, name) {
  const ok = await spConfirm(`"${name}" 소스를 삭제할까요?`, 'RSS 소스 삭제', '🗑️', '삭제', '#ef4444');
  if (!ok) return;
  try {
    await fetch(`/api/news/sources/${id}`, { method: 'DELETE' });
    loadRssSources();
  } catch (e) {
    await spAlert('삭제 실패', '오류', '❌');
  }
}

async function addRssSource() {
  const name     = document.getElementById('rssNewName')?.value?.trim();
  const url      = document.getElementById('rssNewUrl')?.value?.trim();
  const category = document.getElementById('rssNewCategory')?.value || 'global';

  if (!name || !url) { await spAlert('이름과 URL을 모두 입력해주세요.', '입력 오류', '⚠️'); return; }
  if (!url.startsWith('http')) { await spAlert('올바른 URL을 입력해주세요. (http 로 시작)', '입력 오류', '⚠️'); return; }

  try {
    const res = await fetch('/api/news/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url, category })
    });
    const data = await res.json();
    if (!res.ok) { await spAlert(data.error || '추가 실패', '오류', '❌'); return; }
    document.getElementById('rssNewName').value = '';
    document.getElementById('rssNewUrl').value = '';
    loadRssSources();
  } catch (e) {
    await spAlert('RSS 소스 추가 실패', '오류', '❌');
  }
}

// ===== 호환용 함수 유지 =====
let useClaudeAnalysis = false;
function onClaudeToggleChange() {
  useClaudeAnalysis = document.getElementById('claudeAnalysisToggle')?.checked;
  const status = document.getElementById('claudeAnalysisStatus');
  if (!status) return;
  status.textContent = useClaudeAnalysis ? 'ON' : 'OFF';
  status.className = `news-mode-status ${useClaudeAnalysis ? 'on' : 'off'}`;
}
async function triggerNewsCollection(silent = false) {
  await fetchNews(currentCategory);
}

// ===== 퀀트 엔진 =====

// ===== 시장 지표 =====
async function loadMarketIndicators() {
  try {
    const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
    const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
    const res = await fetch('/proxy/stock/api/market/indicators', { headers });
    const data = await res.json();
    renderMarketBar(data.indicators || []);
    renderMarketDetail(data.indicators || []);
  } catch (e) {
    const el = document.getElementById('marketIndicators');
    if (el) el.innerHTML = '<span style="color:#ef4444;font-size:0.8rem;">시장 데이터 로드 실패</span>';
  }
}

function renderMarketBar(indicators) {
  const el = document.getElementById('marketIndicators');
  if (!el) return;
  el.innerHTML = indicators.filter(i => !i.error).map(i => {
    const up = i.change_pct >= 0;
    const color = i.type === 'vix' ? (i.change_pct > 0 ? '#ef4444' : '#10b981') : (up ? '#10b981' : '#ef4444');
    const arrow = up ? '▲' : '▼';
    return `
      <div onclick="showMarketChart('${i.symbol}','${i.label}',${i.price},${i.change_pct})"
        style="display:flex;flex-direction:column;align-items:flex-start;gap:1px;min-width:80px;cursor:pointer;padding:6px 8px;border-radius:8px;transition:background .15s;"
        onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
        <span style="font-size:0.72rem;color:#6b7280;font-weight:600;">${i.label}</span>
        <span style="font-size:0.9rem;font-weight:700;color:#111827;">${i.price.toLocaleString()}</span>
        <span style="font-size:0.75rem;color:${color};font-weight:600;">${arrow} ${Math.abs(i.change_pct)}%</span>
      </div>`;
  }).join('<div style="width:1px;height:36px;background:#e5e7eb;flex-shrink:0;"></div>');

  // 첫 로드 시 나스닥 기본 표시
  const nasdaq = indicators.find(i => i.symbol === '^IXIC' && !i.error && i.price != null)
    || indicators.find(i => !i.error && i.price != null);
  if (nasdaq && !window._chartInitialized) {
    window._chartInitialized = true;
    showMarketChart(nasdaq.symbol, nasdaq.label, nasdaq.price, nasdaq.change_pct);
  }
}

function renderMarketDetail(indicators) {
  const el = document.getElementById('marketDetail');
  if (!el) return;
  el.innerHTML = indicators.filter(i => !i.error).map(i => {
    const up = i.change_pct >= 0;
    const color = i.type === 'vix' ? (i.change_pct > 0 ? '#ef4444' : '#10b981') : (up ? '#10b981' : '#ef4444');
    const bg = color === '#10b981' ? '#f0fdf4' : '#fef2f2';
    const arrow = up ? '▲' : '▼';
    const typeIcon = { index:'📈', vix:'😰', commodity:'🥇', crypto:'🪙', fx:'💵' }[i.type] || '📊';
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f3f4f6;">
        <div>
          <div style="font-size:0.82rem;font-weight:700;color:#374151;">${typeIcon} ${i.label}</div>
          <div style="font-size:0.75rem;color:#9ca3af;">${i.symbol}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.9rem;font-weight:700;color:#111827;">${i.price.toLocaleString()}</div>
          <div style="font-size:0.75rem;font-weight:600;color:${color};background:${bg};padding:1px 6px;border-radius:99px;">
            ${arrow} ${Math.abs(i.change_pct)}%
          </div>
        </div>
      </div>`;
  }).join('');
}

// ===== 시장 미니 차트 =====
let _miniChart = null;

async function showMarketChart(symbol, label, price, changePct) {
  const card = document.getElementById('marketChartCard');
  if (card) card.style.display = 'block';

  // 헤더 업데이트
  const up = changePct >= 0;
  const color = symbol === '^VIX' ? (changePct > 0 ? '#ef4444' : '#10b981') : (up ? '#10b981' : '#ef4444');
  const bg = color === '#10b981' ? '#dcfce7' : '#fee2e2';
  document.getElementById('chartSymbolLabel').textContent = label;
  document.getElementById('chartSymbolSub').textContent = symbol;
  document.getElementById('chartPriceBadge').textContent = price != null ? price.toLocaleString() : '-';
  const badge = document.getElementById('chartChangeBadge');
  badge.textContent = `${up ? '▲' : '▼'} ${Math.abs(changePct)}%`;
  badge.style.color = color;
  badge.style.background = bg;

  // 기존 차트 제거
  if (_miniChart) { _miniChart.destroy(); _miniChart = null; }

  try {
    const token = sessionStorage.getItem('auth_token') || '';
    const res = await fetch(`/proxy/stock/api/stock/history?symbol=${encodeURIComponent(symbol)}&start=${getDateBefore(30)}`, {
      headers: token ? { 'Authorization': 'Bearer ' + token } : {}
    });
    const data = await res.json();
    const rows = (data.data || []).slice(-30);

    if (!rows.length) throw new Error('no data');

    const labels = rows.map(r => r.date.slice(5));
    const prices = rows.map(r => r.close);
    drawMiniChart(labels, prices, color);
  } catch(e) {
    // 데이터 없으면 현재가 기준 플랫 라인
    const labels = Array.from({length:10}, (_, i) => `D-${9-i}`);
    const prices = Array.from({length:10}, () => price);
    drawMiniChart(labels, prices, color);
  }
}

function drawMiniChart(labels, prices, color) {
  const ctx = document.getElementById('marketMiniChart')?.getContext('2d');
  if (!ctx) return;
  _miniChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: prices,
        borderColor: color,
        backgroundColor: color === '#10b981' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => ctx.parsed.y.toLocaleString() }
      }},
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 10 }, color: '#9ca3af' } },
        y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, color: '#9ca3af',
          callback: v => v.toLocaleString() } }
      }
    }
  });
}

function closeMarketChart() {
  const card = document.getElementById('marketChartCard');
  if (card) card.style.display = 'none';
  if (_miniChart) { _miniChart.destroy(); _miniChart = null; }
}

function getDateBefore(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// ===== 자동 로드 + 실시간 갱신 =====
let marketRefreshTimer = null;

// 로그인 후 페이지 로드 시 즉시 실행
document.addEventListener('DOMContentLoaded', () => {
  // 시장 지표 즉시 로드
  loadMarketIndicators();

  // 뉴스 즉시 로드 (기본 탭이 뉴스탭이므로)
  loadNews();

  // 30초마다 시장 지표 자동 갱신
  marketRefreshTimer = setInterval(() => {
    loadMarketIndicators();
  }, 30000);

  // 5분마다 뉴스 자동 갱신
  setInterval(() => {
    loadNews();
  }, 300000);
});
