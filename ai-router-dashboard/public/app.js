// ✅ 자동 로그아웃 (30분 비활동)
(function autoLogout() {
  const TIMEOUT = 30 * 60 * 1000; // 30분
  const WARN_BEFORE = 60 * 1000;  // 1분 전 경고
  let logoutTimer = null;
  let warnTimer = null;
  let warnPopup = null;

  function resetTimer() {
    clearTimeout(logoutTimer);
    clearTimeout(warnTimer);
    removeWarnPopup();

    // 1분 전 경고
    warnTimer = setTimeout(() => {
      showWarnPopup();
    }, TIMEOUT - WARN_BEFORE);

    // 30분 후 로그아웃
    logoutTimer = setTimeout(() => {
      removeWarnPopup();
      sessionStorage.removeItem('auth_token');
      alert('You have been logged out due to inactivity.');
      location.href = '/login';
    }, TIMEOUT);
  }

  function showWarnPopup() {
    removeWarnPopup();
    warnPopup = document.createElement('div');
    warnPopup.id = 'sessionWarnPopup';
    warnPopup.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#fff;border:1.5px solid #fde68a;border-radius:12px;padding:16px 20px;box-shadow:0 8px 30px rgba(0,0,0,0.12);z-index:9998;max-width:300px;';
    warnPopup.innerHTML = `
      <div style="font-weight:700;color:#92400e;margin-bottom:6px;">⚠️ Session Expiring</div>
      <div style="font-size:0.85rem;color:#78350f;margin-bottom:12px;">You will be logged out in 1 minute.</div>
      <button onclick="document.getElementById('sessionWarnPopup').remove(); document.dispatchEvent(new Event('userActivity'));"
        style="width:100%;padding:8px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.88rem;">
        Stay Logged In
      </button>`;
    document.body.appendChild(warnPopup);
  }

  function removeWarnPopup() {
    const p = document.getElementById('sessionWarnPopup');
    if (p) p.remove();
  }

  // 사용자 활동 감지 이벤트
  const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'userActivity'];
  events.forEach(e => document.addEventListener(e, resetTimer, { passive: true }));

  // 시작
  resetTimer();
})();

// ✅ 뒤로가기 금지 (로그인 후 보안)
(function preventBackNavigation() {
  // history에 현재 상태 push해서 뒤로가기 시 감지
  history.pushState(null, '', location.href);
  window.addEventListener('popstate', function () {
    history.pushState(null, '', location.href);
  });
})();

// ✅ API 요청에 토큰 자동 포함 (checkAuth보다 먼저 선언)
const originalFetch = window.fetch;
window.fetch = function (url, options = {}) {
  const token = sessionStorage.getItem('auth_token');
  if (token && !url.includes('/api/auth/')) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
  }
  return originalFetch(url, options).then(res => {
    // 메인 API 401만 로그인으로 (외부 포트 API 제외)
    if (res.status === 401 && typeof url === 'string' && url.includes('/api/') && !url.match(/localhost:\d+/)) {
      sessionStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return res;
  });
};

// ===== 뉴스 통합 검색 함수 =====
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
        el.textContent = data.user.username + ' 님';
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
    loadAccount();
    loadPrices();
    loadPositions();
    loadOrders();
  }

  if (tab === 'lotto') {
    if (typeof lottoInit === 'function') {
      lottoInit();
    }
  }
}

// 탭 버튼 이벤트 등록 (DOM 준비 후 안전하게)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
});

// 외부 접속 시 프록시 사용, 로컬 시 직접 연결
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const STOCK_API = isLocal ? 'http://localhost:5001' : '/proxy/stock';

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
      <div class="account-metric"><div class="lbl">Cash</div><div class="val">$${parseFloat(data.cash).toLocaleString()}</div></div>
      <div class="account-metric"><div class="lbl">Portfolio</div><div class="val">$${parseFloat(data.portfolio_value).toLocaleString()}</div></div>
      <div class="account-metric"><div class="lbl">Buying Power</div><div class="val">$${parseFloat(data.buying_power).toLocaleString()}</div></div>
      <div class="account-metric"><div class="lbl">Equity</div><div class="val">$${parseFloat(data.equity).toLocaleString()}</div></div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="mini-card" style="color:#ef4444;">서버 연결 Error: ${e.message}</div>`;
  }
}

// ===== 주식 가격 =====
async function loadPrices() {
  const symbols = document.getElementById('stockSymbols').value;
  try {
    const res = await fetch(`${STOCK_API}/api/stock/prices?symbols=${symbols}`);
    const data = await res.json();
    document.getElementById('priceCards').innerHTML = data.stocks.map(s => `
      <div class="price-card">
        <span class="symbol">${s.symbol}</span>
        <span class="price">$${s.price}</span>
        <span class="change ${s.change >= 0 ? 'up' : 'down'}">
          ${s.change >= 0 ? '▲' : '▼'} ${Math.abs(s.change)} (${s.change_pct?.toFixed(2)}%)
        </span>
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('priceCards').innerHTML = '<div class="mini-card">가격 조회 실패</div>';
  }
}

// ===== 매수 =====
async function buyStock() {
  const symbol = document.getElementById('tradeSymbol').value.toUpperCase();
  const qty = document.getElementById('tradeQty').value;
  if (!symbol) return alert('Symbol 심볼을 입력해주세요');
  const resultEl = document.getElementById('tradeResult');
  try {
    // 키 등록 여부 먼저 확인
    const keyRes = await fetch('/api/user/broker-keys');
    const keyData = await keyRes.json();
    if (!keyData.registered) {
      resultEl.textContent = '❌ Alpaca key not registered. Please add your key above.';
      return;
    }
    const res = await fetch('/api/alpaca-user/v2/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, qty: Number(qty), side: 'buy', type: 'market', time_in_force: 'gtc' })
    });
    const data = await res.json();
    if (res.ok && data.id) {
      resultEl.textContent = `✅ Buy order submitted
Symbol: ${symbol}
Qty: ${qty}주
Order ID: ${data.id}`;
    } else {
      resultEl.textContent = `❌ Error: ${data.message || data.error || JSON.stringify(data)}`;
    }
    loadAccount(); loadPositions();
  } catch (e) {
    resultEl.textContent = `❌ Error: ${e.message}`;
  }
}

// ===== 매도 =====
async function sellStock() {
  const symbol = document.getElementById('tradeSymbol').value.toUpperCase();
  const qty = document.getElementById('tradeQty').value;
  if (!symbol) return alert('Symbol 심볼을 입력해주세요');
  const resultEl = document.getElementById('tradeResult');
  try {
    const keyRes = await fetch('/api/user/broker-keys');
    const keyData = await keyRes.json();
    if (!keyData.registered) {
      resultEl.textContent = '❌ Alpaca key not registered. Please add your key above.';
      return;
    }
    const res = await fetch('/api/alpaca-user/v2/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, qty: Number(qty), side: 'sell', type: 'market', time_in_force: 'gtc' })
    });
    const data = await res.json();
    if (res.ok && data.id) {
      resultEl.textContent = `✅ Sell order submitted
Symbol: ${symbol}
Qty: ${qty}주
Order ID: ${data.id}`;
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
    const res = await fetch('/api/alpaca-user/v2/positions');
    const data = await res.json();
    if (!data.positions?.length) {
      document.getElementById('positionsTable').innerHTML = '<p style="color:var(--muted)">보유 종목이 없습니다</p>';
      return;
    }
    document.getElementById('positionsTable').innerHTML = `
      <table class="stock-table">
        <thead><tr><th>종목</th><th>수량</th><th>평균단가</th><th>현재가</th><th>평가금액</th><th>손익</th><th>실시간</th></tr></thead>
        <tbody>
          ${data.positions.map(p => {
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

    // 최근 거래 (latest trade)
    const tradeRes = await fetch('/api/alpaca-user/v2/stocks/' + symbol + '/trades/latest');
    const tradeData = await tradeRes.json();

    // 최근 바 (최신 가격)
    const barRes = await fetch('/api/alpaca-user/v2/stocks/' + symbol + '/bars/latest');
    const barData = await barRes.json();

    const latestPrice = tradeData?.trade?.p || posData?.current_price || '-';
    const latestBar = barData?.bar || {};
    const pl = parseFloat(posData?.unrealized_pl) || 0;
    const plpc = (parseFloat(posData?.unrealized_plpc) || 0) * 100;

    body.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div style="background:#f8fafc;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:0.78rem;color:#6b7280;margin-bottom:4px;">현재가</div>
          <div style="font-size:1.6rem;font-weight:800;color:#6366f1;">$${parseFloat(latestPrice).toFixed(2)}</div>
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
    if (!data.orders?.length) {
      document.getElementById('ordersTable').innerHTML = '<p style="color:var(--muted)">주문 내역이 없습니다</p>';
      return;
    }
    const statusMap = { filled:'체결', partially_filled:'부분체결', canceled:'취소', pending_new:'대기', new:'접수', expired:'만료' };
    document.getElementById('ordersTable').innerHTML = `
      <div style="font-size:0.82rem;color:#6b7280;margin-bottom:8px;">최근 ${data.orders.length}건</div>
      <table class="stock-table">
        <thead><tr><th>종목</th><th>구분</th><th>수량</th><th>주문유형</th><th>상태</th><th>체결가</th><th>체결금액</th><th>날짜</th></tr></thead>
        <tbody>
          ${data.orders.map(o => {
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
let allNews = [];
let currentCategory = 'all';

async function loadNews() {
  try {
    // 날짜 목록 먼저 로드
    const datesRes = await fetch('/api/news/dates');
    const datesData = await datesRes.json();
    updateDateFilter(datesData.dates || []);

    // 뉴스 목록 로드
    await applyNewsFilter();
  } catch (e) {
    document.getElementById('newsContent').innerHTML =
      '<p style="color:var(--muted)">뉴스 데이터 없음. n8n 워크플로우를 실행해주세요.</p>';
  }
}

function updateDateFilter(dates) {
  const select = document.getElementById('newsDateFilter');
  const current = select.value;
  select.innerHTML = '<option value="all">전체 기간</option>' +
    dates.map(d => `<option value="${d}" ${d === current ? 'selected' : ''}>${d}</option>`).join('');
}

async function applyNewsFilter() {
  const date = document.getElementById('newsDateFilter')?.value || 'all';
  const type = document.getElementById('newsTypeFilter')?.value || 'all';

  try {
    const params = new URLSearchParams();
    if (date !== 'all') params.append('date', date);
    if (type !== 'all') params.append('type', type);
    if (currentCategory !== 'all') params.append('category', currentCategory);

    const res = await fetch(`/api/news/list?${params.toString()}`);
    const data = await res.json();
    allNews = data.news || [];

    const count = document.getElementById('newsCount');
    if (count) count.textContent = `총 ${allNews.length}개`;

    renderNews(allNews);
  } catch (e) {
    document.getElementById('newsContent').innerHTML =
      '<p style="color:var(--muted)">뉴스 로드 실패</p>';
  }
}

function filterNewsByCategory(category, btn) {
  document.querySelectorAll('.news-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentCategory = category;
  applyNewsFilter();
}

function renderNews(newsList) {
  const container = document.getElementById('newsContent');
  if (!newsList.length) {
    container.innerHTML = '<p style="color:var(--muted)">No news to display.</p>';
    return;
  }

  const categoryLabels = {
    global: '🌍 글로벌',
    korea: '🇰🇷 한국',
    it: '💻 IT',
    economy: '💰 경제'
  };

  container.innerHTML = newsList.map(n => `
    <div class="news-item">
      <div class="news-category">
        ${categoryLabels[n.category] || n.category}
        <span class="news-history-badge ${n.source || (n.use_claude ? 'claude' : 'raw')}" style="${n.source === 'claude' ? 'background:#eef2ff;color:#6366f1;border-color:#c7d2fe;' :
      n.source === 'gpt' ? 'background:#f0fdf4;color:#16a34a;border-color:#a7f3d0;' :
        'background:#f9fafb;color:#6b7280;border-color:#e5e7eb;'
    }">
          ${n.source === 'claude' ? '🤖 Claude' : n.source === 'gpt' ? '🟢 GPT' : '📡 RSS'}
        </span>
      </div>
      <div class="news-date">${n.date} · ${n.savedAt?.slice(11, 16)} collected</div>
      <div class="news-body">${n.content && n.content.trim() && n.content.trim() !== '제목없음' && n.content.trim() !== '-'
      ? n.content
      : '<span style="color:#d1d5db;font-style:italic;font-size:0.82rem;">No content</span>'
    }</div>
    </div>
  `).join('');
}

// 주식 탭 진입 시 뉴스도 로드
const originalSwitchTab = switchTab;

// ===== 뉴스 Claude 분석 토글 =====
let useClaudeAnalysis = false;

function onClaudeToggleChange() {
  useClaudeAnalysis = document.getElementById('claudeAnalysisToggle').checked;
  const status = document.getElementById('claudeAnalysisStatus');
  if (useClaudeAnalysis) {
    status.textContent = 'ON';
    status.className = 'news-mode-status on';
  } else {
    status.textContent = 'OFF';
    status.className = 'news-mode-status off';
  }
}

// ===== 뉴스 수집 트리거 =====
async function triggerNewsCollection(silent = false, source = null) {
  // source 결정: 명시적 전달 > 모델 선택 > claude 토글
  const model = document.getElementById('preferredModel')?.value || 'rss';
  const src = source || model || 'rss'; // rss | claude | gpt

  const btn = silent ? null : document.getElementById('fetchTodayBtn');
  if (btn) {
    btn.textContent = src === 'claude' ? '⏳ Claude Analyzing...' : src === 'gpt' ? '⏳ GPT Analyzing...' : '⏳ Collecting RSS...';
    btn.disabled = true;
  }

  try {
    const res = await fetch('/api/news/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: src })
    });
    const data = await res.json();
    if (!silent && btn) btn.textContent = '✅ Done!';
    setTimeout(() => loadNews(), src === 'rss' ? 2000 : 5000);
  } catch (e) {
    if (!silent && btn) btn.textContent = '❌ Error';
  }

  if (!silent && btn) {
    setTimeout(() => {
      btn.textContent = '🔄 Collect News';
      btn.disabled = false;
    }, 6000);
  }
}

// ===== 퀀트 엔진 =====
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
      <div style="background:var(--panel-2);border:1px solid var(--line);border-radius:14px;padding:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <span style="font-size:1.2rem;font-weight:800;color:#6366f1;cursor:pointer;text-decoration:underline;" onclick="openChart('${data.symbol}')">${data.symbol} 📈</span>
          <span style="font-size:1.1rem;font-weight:700;color:${sig.color};">${sig.label}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
          <div style="text-align:center;"><div style="color:var(--muted);font-size:0.8rem;">Current</div><div style="font-weight:700;">$${data.price?.toFixed(2) || '-'}</div></div>
          <div style="text-align:center;"><div style="color:var(--muted);font-size:0.8rem;">지표값</div><div style="font-weight:700;">${data.value?.toFixed(2) || data.score?.toFixed(4) || '-'}</div></div>
          <div style="text-align:center;"><div style="color:var(--muted);font-size:0.8rem;">전략</div><div style="font-weight:700;">${strategy.toUpperCase()}</div></div>
        </div>
        <div style="color:var(--muted);font-size:0.88rem;">${data.reason || ''}</div>
    `;
    if (data.details) {
      html += `<div style="margin-top:14px;display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">`;
      for (const [k, v] of Object.entries(data.details)) {
        const ds = signalStyle[v.signal] || signalStyle['hold'];
        html += `<div style="background:var(--bg);border-radius:10px;padding:10px;">
          <div style="font-size:0.82rem;color:var(--muted);">${k}</div>
          <div style="font-weight:700;color:${ds.color};">${ds.label}</div>
          <div style="font-size:0.78rem;color:var(--muted);">${v.reason || ''}</div>
        </div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    el.innerHTML = html;
    // 퀀트 지표 차트
    if (typeof renderQuantChart === 'function' && data.indicators) {
      renderQuantChart(document.getElementById('quantSymbol')?.value || '', data.indicators);
    }
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
    const rows = (data.top10 || []).map((item, i) => `<tr>
      <td style="font-weight:700;color:var(--accent);">${i + 1}</td>
      <td><div style="font-weight:700;">${item.name}</div><div style="color:var(--muted);font-size:0.78rem;">${item.ticker}</div></td>
      <td>${item.price?.toLocaleString()}원</td>
      <td>${item.volume?.toLocaleString()}</td>
      <td>${item.short_ratio?.toFixed(2)}%</td>
      <td style="font-weight:700;color:var(--accent-2);">${item.score?.toFixed(1)}</td>
    </tr>`).join('');
    el.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
      <thead><tr style="color:var(--muted);font-size:0.82rem;">
        <th style="padding:8px;">순위</th><th style="padding:8px;text-align:left;">Symbol</th>
        <th style="padding:8px;">Current</th><th style="padding:8px;">Volume</th>
        <th style="padding:8px;">공매도비중</th><th style="padding:8px;">점수</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p style="color:var(--muted);font-size:0.78rem;margin-top:8px;">업데이트: ${data.updated_at?.slice(0, 19) || '-'}</p>`;
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

  const body = { symbols, balance_ratio: balanceRatio, take_profit: takeProfit, stop_loss: stopLoss, signal_mode: signalMode };
  if (isEnabled !== null) body.enabled = isEnabled ? 1 : 0;

  const res = await fetch('/api/auto-trade/settings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const d = await res.json();
  if (d.ok) loadAutoTradeSettings();
}

window.toggleAutoTrade = async function(enable) {
  await saveAutoTradeSettings(enable);
  const el = document.getElementById('autoTradeResult');
  if (el) el.innerHTML = `<div style="padding:10px 14px;border-radius:8px;background:${enable?'#dcfce7':'#fee2e2'};color:${enable?'#065f46':'#991b1b'};font-weight:700;font-size:0.88rem;margin-top:8px;">
    ${enable ? '✅ 자동매매 활성화됨 — 1분마다 신호 체크' : '⏹ 자동매매 비활성화됨'}
  </div>`;
};

window.runAutoTradeNow = async function() {
  const el = document.getElementById('autoTradeResult');
  el.innerHTML = '<div style="padding:10px;color:#6b7280;">🔍 분석 중...</div>';
  try {
    const res = await fetch('/api/auto-trade/run', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const d = await res.json();
    const resultHtml = d.results?.length
      ? d.results.map(r => `<div style="padding:6px 0;border-bottom:1px solid #f3f4f6;">
          <strong>${r.symbol}</strong> — ${r.action} ${r.qty ? r.qty+'주' : ''} ${r.profit||''} ${r.reason?'('+r.reason+')':''}
        </div>`).join('')
      : '<div style="color:#6b7280;">신호 없음 — 매매 조건 미충족</div>';
    el.innerHTML = `<div style="padding:12px 14px;border-radius:8px;background:#f8fafc;border:1px solid #e5e7eb;margin-top:8px;">
      <div style="font-weight:700;margin-bottom:8px;">📊 분석 결과: ${d.message}</div>
      ${resultHtml}
    </div>`;
    loadAutoTradeLog();
  } catch(e) {
    el.innerHTML = `<div style="color:#ef4444;padding:10px;">오류: ${e.message}</div>`;
  }
};

async function loadAutoTradeSettings() {
  try {
    const res = await fetch('/api/auto-trade/settings');
    const d = await res.json();
    if (document.getElementById('atSymbols')) document.getElementById('atSymbols').value = d.symbols || 'QQQ,SPY,AAPL';
    if (document.getElementById('atBalanceRatio')) document.getElementById('atBalanceRatio').value = Math.round((d.balance_ratio||0.1)*100);
    if (document.getElementById('atTakeProfit')) document.getElementById('atTakeProfit').value = Math.round((d.take_profit||0.05)*100);
    if (document.getElementById('atStopLoss')) document.getElementById('atStopLoss').value = Math.round((d.stop_loss||0.05)*100);
    if (document.getElementById('atSignalMode')) document.getElementById('atSignalMode').value = d.signal_mode || 'combined';
    const badge = document.getElementById('autoTradeStatusBadge');
    if (badge) {
      badge.textContent = d.enabled ? '✅ 활성' : '비활성';
      badge.style.background = d.enabled ? '#dcfce7' : '#f1f5f9';
      badge.style.color = d.enabled ? '#065f46' : '#6b7280';
    }
  } catch(e) {}
}

window.loadAutoPositions = async function() {
  const el = document.getElementById('autoPositionsList');
  const countEl = document.getElementById('autoPositionCount');
  if (!el) return;
  try {
    const res = await fetch('/api/auto-trade/positions');
    const d = await res.json();
    if (countEl) countEl.textContent = `(${d.total||0}/3종목)`;
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
          <span style="font-weight:700;color:${pl>=0?'#065f46':'#991b1b'};">${pl>=0?'+':''}$${pl.toFixed(2)} (${plPct>=0?'+':''}${plPct.toFixed(2)}%)</span>
          <button onclick="cancelAutoTrade('${p.symbol}')" class="sp-btn sp-btn-red sp-btn-sm" style="font-size:0.75rem;padding:4px 10px;">취소</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) { el.innerHTML = '<div style="color:#ef4444;padding:12px;">로드 실패</div>'; }
};

window.cancelAutoTrade = async function(symbol) {
  if (!confirm(`${symbol} 자동매매를 취소하고 포지션을 청산할까요?`)) return;
  try {
    const res = await fetch('/api/auto-trade/cancel/' + symbol, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const d = await res.json();
    if (d.ok) {
      alert(`${symbol} 포지션 청산 완료!`);
      loadAutoPositions();
      loadAutoTradeLog();
      loadPositions();
    } else {
      alert('취소 실패: ' + (d.error || ''));
    }
  } catch(e) { alert('오류: ' + e.message); }
};

window.stopAllAutoTrade = async function() {
  if (!confirm('모든 자동매매 종목을 청산하고 자동매매를 종료할까요?')) return;
  try {
    const res = await fetch('/api/auto-trade/stop-all', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const d = await res.json();
    if (d.ok) {
      const msg = d.closed?.length ? `${d.closed.join(', ')} 청산 완료!` : '청산할 포지션 없음';
      alert('자동매매 전체 종료! ' + msg);
      loadAutoTradeSettings();
      loadAutoPositions();
      loadAutoTradeLog();
      loadPositions();
    }
  } catch(e) { alert('오류: ' + e.message); }
};

window.loadAutoTradeLog = async function() {
  const el = document.getElementById('autoTradeLog');
  if (!el) return;
  try {
    const res = await fetch('/api/auto-trade/log');
    const d = await res.json();
    if (!d.logs?.length) { el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:24px;">자동매매 이력이 없습니다</div>'; return; }
    const actionMap = { BUY:'매수', SELL_PROFIT:'익절 매도', SELL_LOSS:'손절 매도' };
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
          <td style="padding:8px;text-align:center;"><span style="padding:2px 8px;border-radius:999px;font-size:0.75rem;font-weight:700;background:${bg};color:${color}">${actionMap[l.action]||l.action}</span></td>
          <td style="padding:8px;text-align:center;">${l.qty}주</td>
          <td style="padding:8px;text-align:center;">$${parseFloat(l.price||0).toFixed(2)}</td>
          <td style="padding:8px;text-align:center;font-weight:700;color:${isProfit?'#065f46':isLoss?'#991b1b':'#374151'}">${l.profit_pct ? (l.profit_pct>0?'+':'')+parseFloat(l.profit_pct).toFixed(2)+'%' : '-'}</td>
          <td style="padding:8px;font-size:0.78rem;color:#6b7280;">${l.reason||''}</td>
        </tr>`;
      }).join('')}
      </tbody></table>`;
  } catch(e) { el.innerHTML = '<div style="color:#ef4444;padding:16px;">로드 실패</div>'; }
};

// 기존 runAutoTrade 호환성 유지
async function runAutoTrade() { await window.runAutoTradeNow(); }

async function loadTradeLog() {
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
      <td style="color:var(--muted);font-size:0.8rem;">${log.strategy}</td>
      <td style="color:var(--muted);font-size:0.78rem;">${log.created_at?.slice(0, 16) || '-'}</td>
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

// ===== Alpaca 다계좌 관리 =====
let activeAccountId = null; // 현재 Select된 계좌 ID

async function loadAlpacaKeyStatus() {
  const listEl = document.getElementById('alpacaAccountList');
  if (!listEl) return;

  listEl.innerHTML = '<div style="color:#9ca3af;font-size:0.87rem;padding:8px 0;">Loading accounts...</div>';

  try {
    const res = await fetch('/api/user/broker-keys');
    const { ok, data } = await safeJson(res);
    if (!ok) {
      listEl.innerHTML = '<div style="color:#ef4444;font-size:0.87rem;">Failed to load account info.</div>';
      return;
    }

    if (!data.registered || !data.accounts?.length) {
      listEl.innerHTML = `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 18px;">
          <div style="font-weight:700;color:#92400e;margin-bottom:4px;">🔑 No accounts registered</div>
          <div style="color:#78350f;font-size:0.87rem;">Click "+ Add Account" to register your Alpaca account.</div>
        </div>`;
      activeAccountId = null;
      return;
    }

    // Active 계좌 ID 설정
    const activeAcc = data.accounts.find(a => a.is_active) || data.accounts[0];
    if (!activeAccountId) activeAccountId = activeAcc.id;

    listEl.innerHTML = data.accounts.map(acc => {
      const isSelected = acc.id === activeAccountId;
      const mode = acc.alpaca_paper ? '🧪 Paper' : '💰 Live';
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;border:2px solid ${isSelected ? 'var(--accent)' : 'var(--line)'};background:${isSelected ? '#eef2ff' : '#fff'};margin-bottom:8px;cursor:pointer;"
          onclick="selectAccount(${acc.id})">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-weight:700;font-size:0.92rem;color:${isSelected ? 'var(--accent)' : 'var(--text)'};">${acc.account_name}</span>
              <span style="font-size:0.75rem;padding:2px 8px;border-radius:999px;background:${acc.alpaca_paper ? '#fef3c7' : '#d1fae5'};color:${acc.alpaca_paper ? '#92400e' : '#065f46'};font-weight:700;">${mode}</span>
              ${isSelected ? '<span style="font-size:0.75rem;padding:2px 8px;border-radius:999px;background:#eef2ff;color:var(--accent);font-weight:700;">Active</span>' : ''}
            </div>
            <div style="font-size:0.78rem;color:var(--muted);margin-top:2px;">Last updated: ${acc.updated_at?.slice(0, 16) || '-'}</div>
          </div>
          <div style="display:flex;gap:6px;">
            ${!acc.is_active ? `<button onclick="event.stopPropagation();activateAccount(${acc.id})"
              style="padding:5px 10px;background:var(--accent);color:#fff;border:none;border-radius:6px;font-size:0.78rem;font-weight:700;cursor:pointer;">
              Select
            </button>` : ''}
            <button onclick="event.stopPropagation();deleteAccount(${acc.id})"
              style="padding:5px 10px;background:#fff0f0;color:#ef4444;border:1px solid #fecaca;border-radius:6px;font-size:0.78rem;font-weight:700;cursor:pointer;">
              Delete
            </button>
          </div>
        </div>`;
    }).join('');

  } catch (e) { console.error(e); }
}

async function selectAccount(id) {
  activeAccountId = id;
  await loadAlpacaKeyStatus();
  loadAccount();
  loadPositions();
  loadOrders();
  loadAutoTradeSettings();
  loadAutoTradeLog();
  loadAutoPositions();
}

async function activateAccount(id) {
  try {
    await fetch(`/api/user/broker-keys/${id}/activate`, { method: 'POST' });
    activeAccountId = id;
    await loadAlpacaKeyStatus();
    loadAccount();
    loadPositions();
    loadOrders();
  } catch (e) { }
}

async function deleteAccount(id) {
  if (!confirm('이 계좌를 Delete하시겠습니까?')) return;
  try {
    const res = await fetch(`/api/user/broker-keys/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      if (activeAccountId === id) activeAccountId = null;
      await loadAlpacaKeyStatus();
      loadAccount();
    } else {
      alert(data.error);
    }
  } catch (e) { }
}

function toggleAlpacaKeyForm() {
  const form = document.getElementById('alpacaKeyForm');
  if (!form) return;
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function saveAlpacaKeys() {
  const account_name = document.getElementById('inputAccountName')?.value.trim();
  const api_key = document.getElementById('inputAlpacaKey')?.value.trim();
  const secret_key = document.getElementById('inputAlpacaSecret')?.value.trim();
  const paper = document.getElementById('inputAlpacaPaper')?.checked;

  if (!api_key && !secret_key) {
    showAlpacaMsg('error', '⚠️ Please enter both API Key and Secret Key.');
    return;
  }
  if (!api_key) {
    showAlpacaMsg('error', '⚠️ Please enter your Alpaca API Key.');
    return;
  }
  if (!secret_key) {
    showAlpacaMsg('error', '⚠️ Please enter your Alpaca Secret Key.');
    return;
  }

  // 연동 중 팝업 표시
  showAlpacaPopup('loading', '🔄 Connecting to Alpaca...');

  try {
    // 1. 먼저 Alpaca API 키 유효성 검증
    const baseUrl = paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
    const testRes = await fetch(`/api/alpaca-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key, secret_key, paper })
    });
    const testData = await testRes.json();

    if (!testRes.ok || testData.error) {
      hideAlpacaPopup();
      showAlpacaMsg('error', '❌ ' + (testData.error || '유효하지 않은 API 키입니다. 키를 다시 확인해주세요.'));
      return;
    }

    // 2. 키 저장
    const res = await fetch('/api/user/broker-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_name, alpaca_api_key: api_key, alpaca_secret_key: secret_key, alpaca_paper: paper })
    });
    const data = await res.json();

    if (res.ok) {
      showAlpacaPopup('success', '✅ Connected!');
      const nameEl = document.getElementById('inputAccountName');
      const keyEl = document.getElementById('inputAlpacaKey');
      const secretEl = document.getElementById('inputAlpacaSecret');
      if (nameEl) nameEl.value = '';
      if (keyEl) keyEl.value = '';
      if (secretEl) secretEl.value = '';
      setTimeout(async () => {
        hideAlpacaPopup();
        document.getElementById('alpacaKeyForm').style.display = 'none';
        clearAlpacaMsg();
        await loadAlpacaKeyStatus();
        loadAccount();
        loadPositions();
        loadOrders();
      }, 1200);
    } else {
      hideAlpacaPopup();
      showAlpacaMsg('error', '❌ ' + (data.error || '저장 실패'));
    }
  } catch (e) {
    hideAlpacaPopup();
    showAlpacaMsg('error', '서버 연결 Error: ' + e.message);
  }
}

function showAlpacaPopup(type, msg) {
  let popup = document.getElementById('alpacaConnPopup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'alpacaConnPopup';
    popup.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:9999;';
    document.body.appendChild(popup);
  }
  const colors = { loading: '#6366f1', success: '#10b981', error: '#ef4444' };
  const bgColors = { loading: '#eef2ff', success: '#f0fdf4', error: '#fff0f0' };
  popup.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:36px 40px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.2);min-width:280px;">
      <div style="font-size:2.5rem;margin-bottom:14px;">${type === 'loading' ? '🔄' : type === 'success' ? '✅' : '❌'}</div>
      <div style="font-size:1.05rem;font-weight:700;color:${colors[type] || '#111'};">${msg}</div>
      ${type === 'loading' ? '<div style="margin-top:12px;color:#9ca3af;font-size:0.85rem;">Please wait...</div>' : ''}
    </div>`;
  popup.style.display = 'flex';
}

function hideAlpacaPopup() {
  const popup = document.getElementById('alpacaConnPopup');
  if (popup) popup.style.display = 'none';
}

function showAlpacaMsg(type, text) {
  const el = document.getElementById('alpacaKeyMsg');
  if (!el) return;
  el.textContent = text;
  el.style.display = 'block';
  el.style.color = type === 'success' ? '#10b981' : '#ef4444';
  el.style.background = type === 'success' ? '#f0fdf4' : '#fff0f0';
  el.style.padding = '8px 12px';
  el.style.borderRadius = '8px';
}

function clearAlpacaMsg() {
  const el = document.getElementById('alpacaKeyMsg');
  if (el) { el.style.display = 'none'; el.textContent = ''; }
}

// 주식 탭 진입 시 계좌 목록 로드
const _origSwitchTab2 = switchTab;
switchTab = function (tab) {
  _origSwitchTab2(tab);
  if (tab === 'stock') loadAlpacaKeyStatus();
};

// fetch에 Select된 계좌 ID 헤더 자동 추가 (alpaca-user 요청)
const _origFetch2 = window.fetch;
window.fetch = function (url, options = {}) {
  if (typeof url === 'string' && url.includes('/api/alpaca-user/') && activeAccountId) {
    options.headers = { ...options.headers, 'x-account-id': String(activeAccountId) };
  }
  return _origFetch2(url, options);
};

// ===== 퀀트 차트 팝업 =====
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
