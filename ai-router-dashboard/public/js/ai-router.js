// ===== 상세조회 필터 토글 =====
function toggleAdvancedFilter() {
  const panel = document.getElementById('advFilterPanel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';

  // 외부 클릭 시 닫기
  if (!isOpen) {
    setTimeout(() => {
      document.addEventListener('click', function closePanel(e) {
        const panel = document.getElementById('advFilterPanel');
        const btn = document.getElementById('advFilterBtn');
        if (panel && !panel.contains(e.target) && e.target !== btn) {
          panel.style.display = 'none';
          document.removeEventListener('click', closePanel);
        }
      });
    }, 100);
  }
}

// ===== Fetch Today (webhook 실행) =====
async function fetchTodayNews() {
  const btn = document.getElementById('fetchTodayBtn');
  const model = document.getElementById('preferredModel')?.value || 'rss';

  // 서비스별 버튼 텍스트
  const labels = { rss: '📡 RSS', claude: '🤖 Claude', gpt: '🟢 GPT' };
  const fetchLabel = labels[model] || '📡 Fetch Today';

  if (btn) { btn.disabled = true; btn.textContent = `⏳ Fetching ${labels[model] || ''}...`; }

  try {
    // 선택된 서비스(source)로 webhook 실행
    const res = await fetch('/api/news/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: model })
    });
    const data = await res.json();

    if (data.status === 'ok') {
      if (btn) btn.textContent = '✅ Done!';

      // 수집 완료 후 해당 서비스 데이터 DB에서 로드
      const delay = model === 'rss' ? 2000 : 5000;
      setTimeout(async () => {
        // 타입 필터를 수집한 서비스로 맞추고 로드
        const typeFilter = document.getElementById('newsTypeFilter');
        if (typeFilter) typeFilter.value = model;
        await loadNews();
        if (btn) { btn.textContent = '📡 Fetch Today'; btn.disabled = false; }
      }, delay);
    } else {
      const errMsg = data.error || 'Failed';
      if (btn) { btn.textContent = '❌ ' + errMsg; setTimeout(() => { btn.textContent = '📡 Fetch Today'; btn.disabled = false; }, 3000); }
    }
  } catch (e) {
    if (btn) { btn.textContent = '❌ Error'; setTimeout(() => { btn.textContent = '📡 Fetch Today'; btn.disabled = false; }, 3000); }
  }
}

// 모델 변경 시 UI 조정
function onModelChange(model) {
  // 모델 변경 시 AI Response 숨기기만 - textarea 비활성화 없음
  const aiWrap = document.getElementById('aiResultWrap');
  if (aiWrap) aiWrap.style.display = 'none';
}

async function runNewsSearch() {
  // ===== DB 조회 전용 - 선택된 서비스 기준으로 DB 조회 =====
  const btn = document.getElementById('searchBtn');
  const aiWrap = document.getElementById('aiResultWrap');
  const outputEl = document.getElementById('output');
  const request = document.getElementById('userRequest')?.value.trim();
  const model = document.getElementById('preferredModel')?.value || 'rss';

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Searching...'; }

  try {
    // 선택된 서비스에 맞게 타입 필터 자동 설정
    const typeFilter = document.getElementById('newsTypeFilter');
    if (typeFilter) typeFilter.value = model; // rss / claude / gpt

    // AI Response 영역 항상 숨김 (DB 조회 전용)
    if (aiWrap) aiWrap.style.display = 'none';

    // 선택된 서비스 기준으로 DB에서만 조회 (webhook 실행 안 함)
    await loadNews();

  } catch (e) {
    if (aiWrap) aiWrap.style.display = 'block';
    if (outputEl) outputEl.textContent = 'Error: ' + e.message;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔍 Search DB'; }
  }
}

// ✅ 인증 체크
async function checkAuth() {
  const token = sessionStorage.getItem('auth_token');
  if (!token) {
    window.location.href = '/login';
    return false;
  }
  try {
    const res = await originalFetch('/api/auth/verify', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) {
      sessionStorage.removeItem('auth_token');
      window.location.href = '/login';
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Auth check failed:', e);
    return true;
  }
}

// 페이지 로드 시 인증 체크
checkAuth();

// ===== 로그아웃 =====
async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('auth_token') }
    });
  } catch (e) { }
  sessionStorage.removeItem('auth_token');
  window.location.href = '/login';
}

// 헤더 유저명 표시
async function loadUserInfo() {
  const token = sessionStorage.getItem('auth_token');
  if (!token) return;
  try {
    const res = await fetch('/api/auth/verify', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.ok) {
      const data = await res.json();
      const el = document.getElementById('headerUsername');
      if (el && data.user?.username) {
        el.textContent = '👤 ' + data.user.username;
      }
      const el2 = document.getElementById('headerUsername2');
      if (el2 && data.user?.username) {
        el2.textContent = data.user.username + ' 님';
      }
    }
  } catch (e) { }
}
loadUserInfo();

const state = {
  config: null,
  presets: {}
};

function el(id) {
  return document.getElementById(id);
}

function readForm() {
  return {
    userRequest: el('userRequest').value.trim(),
    taskType: el('taskType').value,
    taskComplexity: el('taskComplexity').value,
    preferredEngine: el('preferredEngine').value,
    preferredModel: el('preferredModel').value,
    optimizationMode: el('optimizationMode').value,
    autoMode: el('autoMode').checked,
    priorityMode: el('priorityMode').value
  };
}

function applyForm(data) {
  el('userRequest').value = data.userRequest || '';
  el('taskType').value = data.taskType || 'news';
  el('taskComplexity').value = data.taskComplexity || 'medium';
  el('preferredEngine').value = data.preferredEngine || 'hybrid';
  el('preferredModel').value = data.preferredModel || 'gemini';
  el('optimizationMode').value = data.optimizationMode || 'balanced';
  el('autoMode').checked = Boolean(data.autoMode);
  el('priorityMode').value = data.priorityMode || 'balanced';
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} 실패`);
  return await res.json();
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || data.error || '요청 실패');
  }
  return data;
}

function renderStatusCards(config, health) {
  const providers = config.providers || {};
  const statusCards = [
    ['n8n', providers.n8n],
    ['OpenClaw', providers.openclaw],
    ['GPT', providers.gpt],
    ['Gemini', providers.gemini],
    ['Claude', providers.claude],
    ['Uptime', `${health.uptimeSeconds}s`]
  ];

  if (el('statusCards')) el('statusCards').innerHTML = statusCards.map(([name, value]) => `
    <div class="status-card ${String(value).includes('ready') || String(value).includes('connected') ? 'ok' : ''}">
      <strong>${name}</strong>
      <span>${value}</span>
    </div>
  `).join('');
}

function renderPresets(presets) {
  state.presets = presets;
  if (el('presetButtons')) el('presetButtons').innerHTML = Object.entries(presets).map(([key, preset]) => `
    <button class="preset-btn" data-preset="${key}">${preset.label}</button>
  `).join('');

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = state.presets[btn.dataset.preset];
      applyForm(preset);
      writeSummaryCards([
        ['프리셋 적용', preset.label],
        ['엔진', preset.preferredEngine],
        ['모델', preset.preferredModel],
        ['우선순위', preset.priorityMode]
      ]);
    });
  });
}

function writeOutput(data) {
  const box = el('output');
  if (!box) return;
  // Claude 답변
  if (data.result?.answer) { box.textContent = data.result.answer; return; }
  // n8n 결과
  if (data.result) {
    const result = data.result;
    const lines = [];
    if (result.summary) lines.push(result.summary);
    if (result.flow) lines.push('플로우: ' + result.flow);
    if (result.todo) lines.push('할 일:\n' + result.todo.map(t => '  • ' + t).join('\n'));
    if (result.nextAction) lines.push(result.nextAction);
    if (result.raw) lines.push(result.raw);
    if (lines.length > 0) { box.textContent = lines.join('\n\n'); return; }
  }
  // 에러 - 실행 버튼을 눌렀을 때만 표시 (자동 로딩 오류 제외)
  if (data.error && data._userTriggered) {
    box.textContent = 'Error: ' + data.error;
    return;
  }
  // 그 외
  if (!data.error) box.textContent = JSON.stringify(data, null, 2);
}

function writeSummaryCards(entries) {
  // summaryCards 없으면 무시 (제거된 섹션)
  const box = el('summaryCards');
  if (!box) return;
  box.innerHTML = entries.map(([k, v]) => `
    <div class="mini-card">
      <strong>${k}</strong>
      <span>${v}</span>
    </div>
  `).join('');
}

function calcClaudeCost(usage, model) {
  const pricing = {
    'claude-sonnet': { input: 3.0, output: 15.0 },
    'claude-opus': { input: 15.0, output: 75.0 },
    'claude-haiku': { input: 0.25, output: 1.25 }
  };
  const key = Object.keys(pricing).find(k => model?.includes(k)) || 'claude-sonnet';
  const price = pricing[key];
  const inputCost = (usage.input_tokens / 1_000_000) * price.input;
  const outputCost = (usage.output_tokens / 1_000_000) * price.output;
  const total = inputCost + outputCost;
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    totalTokens: usage.input_tokens + usage.output_tokens,
    costUSD: total.toFixed(6),
    costKRW: Math.ceil(total * 1350)
  };
}

function summarizeResult(data) {
  const payload = data.payload || data;
  const engine = payload.engineDecision?.engine || '-';
  const model = payload.modelDecision?.model || '-';
  const reasonEngine = payload.engineDecision?.reason || '-';
  const reasonModel = payload.modelDecision?.reason || '-';
  const cost = payload.estimatedCostBand || '-';
  const latency = data.latencyMs != null ? `${data.latencyMs} ms` : '미측정';

  const cards = [
    ['Select 엔진', engine],
    ['Select 모델', model],
    ['예상 비용대', cost],
    ['지연 시간', latency],
    ['엔진 Select 이유', reasonEngine],
    ['모델 Select 이유', reasonModel]
  ];

  if (data.result?.usage) {
    const c = calcClaudeCost(data.result.usage, data.result.model);
    cards.push(['입력 토큰', c.inputTokens.toLocaleString() + ' tokens']);
    cards.push(['출력 토큰', c.outputTokens.toLocaleString() + ' tokens']);
    cards.push(['총 토큰', c.totalTokens.toLocaleString() + ' tokens']);
    cards.push(['비용 (USD)', '$' + c.costUSD]);
    cards.push(['비용 (KRW)', '약 ' + c.costKRW + '원']);
  }

  writeSummaryCards(cards);
}

async function previewRoute() {
  const payload = readForm();
  const data = await postJson('/api/route-decision', payload);
  writeOutput(data);
  summarizeResult(data);
}

async function runRoute() {
  const payload = readForm();
  const data = await postJson('/api/run', payload);
  writeOutput(data);
  summarizeResult(data);
}

async function loadAll() {
  try {
    const [config, health, presets] = await Promise.all([
      getJson('/api/config'),
      getJson('/api/health'),
      getJson('/api/presets')
    ]);
    state.config = config;
    if (el('configBox')) el('configBox').textContent = JSON.stringify(config, null, 2);
    renderStatusCards(config, health);
    renderPresets(presets);
  } catch (e) { console.warn('loadAll 내부 Error:', e.message); }
}

// previewBtn/runBtn → searchBtn으로 통합됨
if (el('searchBtn')) el('searchBtn').addEventListener('click', runNewsSearch);

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    runNewsSearch();
  }
});

function toggleConfig() {
  const box = document.getElementById('configBox');
  const btn = document.getElementById('toggleConfigBtn');
  if (!box || !btn) return;
  if (box.style.display === 'none') {
    box.style.display = 'block';
    btn.textContent = '숨기기';
  } else {
    box.style.display = 'none';
    btn.textContent = '보기';
  }
}

loadAll().catch(e => console.warn('loadAll:', e.message));

// ===== 탭 전환 =====
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => {
    el.style.display = 'none';
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const tabEl = document.getElementById('tab-' + tab);
  if (tabEl) tabEl.style.display = 'block';

  const activeBtn = document.getElementById('tab-btn-' + tab);
  if (activeBtn) activeBtn.classList.add('active');

  if (tab === 'stock') {
    // Stock Prices 뱃지 + input 초기화
    const stockInput = document.getElementById('stockSymbols');
    if (stockInput) stockInput.value = '';
    const stockBadge = document.getElementById('stock-symbol-badge');
    if (stockBadge) {
      stockBadge.querySelectorAll('.stock-badge-item').forEach(el => el.remove());
      const ph = document.getElementById('stock-symbol-placeholder');
      if (ph) ph.style.display = 'inline';
    }
    // priceCards 초기화 - 빈 안내 메시지
    const priceCards = document.getElementById('priceCards');
    if (priceCards) priceCards.innerHTML = '<div style="color:#9ca3af;font-size:0.88rem;padding:12px 0;">🔍 위에서 종목을 검색하세요 (최대 5종목)</div>';
    loadAccount();
    loadPositions();
    loadOrders();
  }

  if (tab === 'lotto') {
    if (typeof lottoInit === 'function') {
      lottoInit();
    }
  }

  if (tab === 'ai') {
    if (typeof loadNews === 'function') loadNews();
    if (typeof loadMarketIndicators === 'function') loadMarketIndicators();
  }

  if (tab === 'quant') {
    // 자동매매 종목 뱃지 초기화
    const atBadge = document.getElementById('at-symbol-badge');
    if (atBadge) atBadge.querySelectorAll('.at-badge-item').forEach(el => el.remove());
    const atInput = document.getElementById('atSymbols');
    if (atInput) atInput.value = '';
    const atPh = document.getElementById('at-symbol-placeholder');
    if (atPh) atPh.style.display = 'inline';
  }

  if (tab === 'backtest') {
    const btInput = document.getElementById('bt-symbol');
    if (btInput) btInput.value = '';
    const btDisplay = document.getElementById('bt-symbol-display');
    if (btDisplay) btDisplay.querySelectorAll('.bt-symbol-text').forEach(e => e.remove());
    const btPh = document.getElementById('bt-symbol-placeholder');
    if (btPh) btPh.style.display = 'inline';
  }

  if (tab === 'datacollect') {
    // 선택 종목 초기화
    if (typeof _dcSelectedSymbols !== 'undefined') {
      _dcSelectedSymbols = [];
      _dcActiveSymbol = '';
    }
    // 검색창 초기화
    const searchInput = document.getElementById('dc-search-input');
    if (searchInput) searchInput.value = '';
    const searchResult = document.getElementById('dc-search-result');
    if (searchResult) searchResult.style.display = 'none';
    // 뱃지 초기화
    const badge = document.getElementById('dc-symbol-badge');
    if (badge) badge.innerHTML = '<span style="color:#9ca3af;font-weight:400;font-size:0.85rem;">종목을 검색해서 선택하세요</span>';
    // 분석 결과 초기화
    const resultCard = document.getElementById('quantResultCard');
    if (resultCard) resultCard.style.display = 'none';
    const quantResult = document.getElementById('quantResult');
    if (quantResult) quantResult.innerHTML = '';
    // 히스토리 초기화
    const historyResult = document.getElementById('dc-history-result');
    if (historyResult) historyResult.innerHTML = '';
  }
}

// 탭 버튼 이벤트 등록 (DOM 준비 후 안전하게)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // 뉴스탭 기본 표시
  switchTab('ai');
});

// 외부 접속 시 프록시 사용, 로컬 시 직접 연결
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const STOCK_API = isLocal ? 'http://localhost:5001' : '/proxy/stock';