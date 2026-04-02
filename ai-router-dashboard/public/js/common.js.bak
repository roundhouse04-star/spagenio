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
  // 수정7: mousemove 제거 (마우스만 움직여도 리셋되어 실질적 자동로그아웃 불가)
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'userActivity'];
  events.forEach(e => document.addEventListener(e, resetTimer, { passive: true }));

  // 시작
  resetTimer();
})();

// 뒤로가기 금지는 login.html에서만 처리

// ✅ API 요청에 토큰 자동 포함 (checkAuth보다 먼저 선언)
const originalFetch = window.fetch;

// 클라이언트 에러 서버 전송 함수
function sendClientError({ event_type, error_message, stack_trace = '', extra = {} }) {
  try {
    const user = (() => { try { return JSON.parse(sessionStorage.getItem('user') || '{}'); } catch { return {}; } })();
    const meta = { page: 'front', userId: user.id, username: user.username, url: location.href, ...extra };
    originalFetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type, error_message, stack_trace, meta })
    }).catch(() => {});
  } catch (e) {}
}

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
    // 5xx 에러 수집
    if (res.status >= 500 && typeof url === 'string' && url.includes('/api/')) {
      sendClientError({ event_type: 'FRONT_API_SERVER_ERROR', error_message: `${res.status} ${res.statusText} - ${url}` });
    }
    return res;
  }).catch(err => {
    // 네트워크 연결 실패
    if (typeof url === 'string' && url.includes('/api/')) {
      sendClientError({ event_type: 'FRONT_FETCH_ERROR', error_message: err.message, stack_trace: err.stack || '', extra: { fetchUrl: url } });
    }
    throw err;
  });
};

// JS 런타임 에러 수집
window.onerror = function (message, source, lineno, colno, error) {
  sendClientError({ event_type: 'FRONT_JS_ERROR', error_message: message, stack_trace: error?.stack || `${source}:${lineno}:${colno}` });
};

// 미처리 Promise rejection 수집
window.addEventListener('unhandledrejection', function (e) {
  const msg = e.reason instanceof Error ? e.reason.message : String(e.reason);
  sendClientError({ event_type: 'FRONT_UNHANDLED_REJECTION', error_message: msg, stack_trace: e.reason?.stack || '' });
});

// ===== 전역 팝업 시스템 =====
// spAlert(icon, title, msg) — alert() 대체
// spConfirm(icon, title, msg) — confirm() 대체 → Promise<boolean>

function spAlert(icon, title, msg) {
  return new Promise(resolve => {
    const layer = document.getElementById('sp-alert-layer');
    if (!layer) { alert(`${title}\n${msg}`); resolve(); return; }
    document.getElementById('sp-alert-icon').textContent = icon;
    document.getElementById('sp-alert-title').textContent = title;
    document.getElementById('sp-alert-msg').textContent = msg;
    layer.style.display = 'flex';
    const btn = document.getElementById('sp-alert-ok');
    const handler = () => { layer.style.display = 'none'; btn.removeEventListener('click', handler); resolve(); };
    btn.addEventListener('click', handler);
  });
}

function spConfirm(icon, title, msg, okLabel = '확인', okColor = '#ef4444') {
  return new Promise(resolve => {
    const layer = document.getElementById('sp-confirm-layer');
    if (!layer) { resolve(confirm(`${title}\n${msg}`)); return; }
    document.getElementById('sp-confirm-icon').textContent = icon;
    document.getElementById('sp-confirm-title').textContent = title;
    document.getElementById('sp-confirm-msg').textContent = msg;
    const okBtn = document.getElementById('sp-confirm-ok');
    okBtn.textContent = okLabel;
    okBtn.style.background = okColor;
    layer.style.display = 'flex';
    const okHandler = () => { layer.style.display = 'none'; okBtn.removeEventListener('click', okHandler); cancelBtn.removeEventListener('click', cancelHandler); resolve(true); };
    const cancelBtn = document.getElementById('sp-confirm-cancel');
    const cancelHandler = () => { layer.style.display = 'none'; okBtn.removeEventListener('click', okHandler); cancelBtn.removeEventListener('click', cancelHandler); resolve(false); };
    okBtn.addEventListener('click', okHandler);
    cancelBtn.addEventListener('click', cancelHandler);
  });
}

// ===== Alpaca 계좌 관리 =====
// loadAlpacaKeyStatus, selectAccount, activateAccount, deleteAccount,
// changeAccountType, saveAlpacaKeys 등 Alpaca 계좌 관련 함수
// fetch 오버라이드: /api/alpaca-user/ 요청에 x-account-id 헤더 자동 추가

async function loadAlpacaKeyStatus() {
  const listEl = document.getElementById('alpacaAccountList');
  if (!listEl) return;

  listEl.innerHTML = '<div style="color:#9ca3af;font-size:0.87rem;padding:8px 0;">계좌 목록 불러오는 중...</div>';

  try {
    const res = await fetch('/api/user/broker-keys');
    const { ok, data } = await safeJson(res);
    if (!ok) {
      listEl.innerHTML = '<div style="color:#ef4444;font-size:0.87rem;">계좌 정보를 불러올 수 없습니다.</div>';
      return;
    }

    if (!data.registered || !data.accounts?.length) {
      listEl.innerHTML = `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 18px;">
          <div style="font-weight:700;color:#92400e;margin-bottom:4px;">🔑 등록된 계좌가 없습니다</div>
          <div style="color:#78350f;font-size:0.87rem;">"+ 계좌 추가" 버튼을 눌러 Alpaca 계좌를 등록해주세요.</div>
        </div>`;
      activeAccountId = null;
      return;
    }

    // Active 계좌 ID 설정
    const activeAcc = data.accounts.find(a => a.is_active) || data.accounts[0];
    if (!activeAccountId) activeAccountId = activeAcc.id;

    listEl.innerHTML = data.accounts.map(acc => {
      const isSelected = acc.id === activeAccountId;
      const mode = acc.alpaca_paper ? '🧪 페이퍼' : '💰 실거래';
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;border:2px solid ${isSelected ? 'var(--accent)' : 'var(--line)'};background:${isSelected ? '#eef2ff' : '#fff'};margin-bottom:8px;">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-weight:700;font-size:0.92rem;color:${isSelected ? 'var(--accent)' : 'var(--text)'};">${acc.account_name}</span>
              <span style="font-size:0.75rem;padding:2px 8px;border-radius:999px;background:${acc.alpaca_paper ? '#fef3c7' : '#d1fae5'};color:${acc.alpaca_paper ? '#92400e' : '#065f46'};font-weight:700;">${mode}</span>
              ${acc.account_type === 1 ? '<span style="font-size:0.75rem;padding:2px 8px;border-radius:999px;background:#ede9fe;color:#7c3aed;font-weight:700;">✋ 수동전용</span>' : ''}
              ${acc.account_type === 2 ? '<span style="font-size:0.75rem;padding:2px 8px;border-radius:999px;background:#dcfce7;color:#166534;font-weight:700;">🤖 자동전용</span>' : ''}
              ${isSelected ? '<span style="font-size:0.75rem;padding:2px 8px;border-radius:999px;background:#eef2ff;color:var(--accent);font-weight:700;">활성</span>' : ''}
            </div>
            <div style="font-size:0.78rem;color:var(--muted);margin-top:2px;">최종 수정: ${acc.updated_at?.slice(0, 16) || '-'}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
            <button onclick="event.stopPropagation();changeAccountType(${acc.id}, ${acc.account_type || 0})"
              style="padding:5px 10px;background:#f5f3ff;color:#7c3aed;border:1px solid #ddd6fe;border-radius:6px;font-size:0.78rem;font-weight:700;cursor:pointer;">
              타입 설정
            </button>
            <button onclick="event.stopPropagation();deleteAccount(${acc.id})"
              style="padding:5px 10px;background:#fff0f0;color:#ef4444;border:1px solid #fecaca;border-radius:6px;font-size:0.78rem;font-weight:700;cursor:pointer;">
              삭제
            </button>
          </div>
        </div>`;
    }).join('');

  } catch (e) { console.error(e); }
}

async function selectAccount(id) {
  if (typeof window.setSelectedAccount === 'function') {
    window.setSelectedAccount(String(id));
  } else {
    activeAccountId = id;
    loadAccount();
  }
  await loadAlpacaKeyStatus();
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
  const ok = await spConfirm('🗑️', '계좌 삭제', '이 계좌를 삭제하시겠습니까?', '삭제', '#ef4444');
  if (!ok) return;
  try {
    const res = await fetch(`/api/user/broker-keys/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      if (activeAccountId === id) activeAccountId = null;
      // localStorage 캐시에서 삭제된 계좌 제거
      if (localStorage.getItem('selectedAccountId') === String(id)) {
        localStorage.removeItem('selectedAccountId');
      }
      await loadAlpacaKeyStatus();
      if (typeof loadAccountSelects === 'function') loadAccountSelects();
      loadAccount();
    } else {
      await spAlert('❌', '오류', data.error);
    }
  } catch (e) { }
}

async function changeAccountType(id, currentType) {
  const typeLabels = { 0: '미설정', 1: '✋ 수동전용', 2: '🤖 자동전용' };
  const options = [
    { value: 0, label: '미설정 (일반 계좌)' },
    { value: 1, label: '✋ 수동전용 (주식 탭 거래)' },
    { value: 2, label: '🤖 자동전용 (자동매매 전용)' },
  ];

  // 선택 팝업
  const html = `
    <div style="padding:20px;">
      <div style="font-size:1rem;font-weight:700;margin-bottom:12px;">계좌 타입 설정</div>
      <div style="font-size:0.85rem;color:#6b7280;margin-bottom:16px;">현재: ${typeLabels[currentType] || '미설정'}</div>
      ${options.map(o => `
        <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;border:1px solid ${o.value === currentType ? '#7c3aed' : '#e5e7eb'};background:${o.value === currentType ? '#f5f3ff' : '#fff'};margin-bottom:8px;cursor:pointer;">
          <input type="radio" name="accType" value="${o.value}" ${o.value === currentType ? 'checked' : ''}>
          <span style="font-weight:600;">${o.label}</span>
        </label>
      `).join('')}
      <div style="font-size:0.78rem;color:#ef4444;margin-top:8px;">⚠️ 수동/자동 전용 계좌는 각 1개만 등록 가능하며, 보유 포지션이 있으면 변경할 수 없습니다.</div>
    </div>`;

  // spConfirm 대신 직접 팝업
  const confirmed = await new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:24px;max-width:380px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
        ${html}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
          <button id="cancelTypeBtn" style="padding:8px 16px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;cursor:pointer;font-weight:600;">취소</button>
          <button id="confirmTypeBtn" style="padding:8px 16px;border-radius:8px;border:none;background:#7c3aed;color:#fff;cursor:pointer;font-weight:700;">변경</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#cancelTypeBtn').onclick = () => { document.body.removeChild(overlay); resolve(null); };
    overlay.querySelector('#confirmTypeBtn').onclick = () => {
      const selected = overlay.querySelector('input[name="accType"]:checked');
      document.body.removeChild(overlay);
      resolve(selected ? parseInt(selected.value) : null);
    };
  });

  if (confirmed === null) return;

  try {
    const res = await fetch(`/api/user/broker-keys/${id}/type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_type: confirmed })
    });
    const data = await res.json();
    if (res.ok) {
      await spAlert('✅', '완료', '계좌 타입이 변경됐습니다.');
      await loadAlpacaKeyStatus();
    } else {
      await spAlert('❌', '오류', data.error || '변경 실패');
    }
  } catch(e) {
    await spAlert('❌', '오류', '서버 오류: ' + e.message);
  }
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
    showAlpacaMsg('error', '⚠️ API Key와 Secret Key를 모두 입력해주세요.');
    return;
  }
  if (!api_key) {
    showAlpacaMsg('error', '⚠️ Alpaca API Key를 입력해주세요.');
    return;
  }
  if (!secret_key) {
    showAlpacaMsg('error', '⚠️ Alpaca Secret Key를 입력해주세요.');
    return;
  }

  // 연동 중 팝업 표시
  showAlpacaPopup('loading', '🔄 Alpaca 연동 중...');

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
    const accountType = parseInt(document.getElementById('inputAccountType')?.value || '0');
    const res = await fetch('/api/user/broker-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_name, alpaca_api_key: api_key, alpaca_secret_key: secret_key, alpaca_paper: paper, account_type: accountType })
    });
    const data = await res.json();

    if (res.ok) {
      showAlpacaPopup('success', '✅ 연동 완료!');
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
    showAlpacaMsg('error', '서버 연결 오류: ' + e.message);
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
      ${type === 'loading' ? '<div style="margin-top:12px;color:#9ca3af;font-size:0.85rem;">잠시 기다려주세요...</div>' : ''}
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

// fetch에 Select된 계좌 ID 헤더 자동 추가 (alpaca-user 요청)
const _origFetch2 = window.fetch;
window.fetch = function (url, options = {}) {
  if (typeof url === 'string' && url.includes('/api/alpaca-user/')) {
    const accId = window.selectedAccountId || window.activeAccountId;
    if (accId) {
      options.headers = { ...options.headers, 'x-account-id': String(accId) };
    }
  }
  return _origFetch2(url, options);
};

// ===== 퀀트 차트 팝업 =====
// chartInstances → chart.js로 이동
// ===== 인증 관련 =====
// checkAuth, logout, loadUserInfo

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
      if (el && data.user?.username) el.textContent = '👤 ' + data.user.username;
      const el2 = document.getElementById('headerUsername2');
      if (el2 && data.user?.username) el2.textContent = data.user.username + ' 님';
    }
  } catch (e) { }
}
loadUserInfo();


// ===== 사이드바 메뉴 시스템 (index.html에서 이동) =====
async function loadSidebarMenus() {
  try {
    const res = await fetch('/api/menus');
    const d = await res.json();
    if (!d.ok) return;
    _menuData = d.menus;
    renderSidebar(d.menus);
    // 첫 번째 메뉴 활성화
    if (d.menus.length > 0) {
      const first = d.menus[0];
      activateMenu(first.tab_key, first.sub_key, first.id);
    }
  } catch (e) {
    // 폴백: 기본 사이드바 렌더링
    renderDefaultSidebar();
  }
}
 function renderSidebar(menus) {
function toggleSubMenu(menuId, tabKey) {
function activateMenu(tabKey, subKey, menuId) {
  _currentTab = tabKey;
  _currentSubTab = subKey;
   // 탭 전환
function renderDefaultSidebar() {

// ===== 계좌 선택기 (index.html에서 이동) =====
async function loadAccountSelects() {
  try {
    const res = await fetch('/api/user/broker-keys');
    const data = await res.json();
    const accounts = data.accounts || data.keys || [];
    if (!Array.isArray(accounts) || !accounts.length) return;
     const selects = ['accountSelectUs', 'accountSelectAuto', 'accountSelectDay', 'accountSelectStock'];
    selects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = accounts.map(a => {
        const typeLabel = a.account_type === 1 ? '수동' : a.account_type === 2 ? '자동' : '';
        const paperLabel = a.alpaca_paper ? '페이퍼' : '실계좌';
        const activeLabel = a.is_active ? ' ✓' : '';
        const label = `${paperLabel}·${typeLabel}${activeLabel}`;
        return `<option value="${a.id}" data-label="${label}">${a.account_name || '계좌 ' + a.id} · ${a.key_preview || ''} (${label})</option>`;
      }).join('');
    });
     // 성과 탭 계좌 선택 콤보박스 (전체 옵션 포함)
    const perfSel = document.getElementById('accountSelectPerf');
    if (perfSel) {
      perfSel.innerHTML = '<option value="">— 전체 계좌 합산 —</option>' + accounts.map(a => {
        const typeLabel = a.account_type === 1 ? '수동' : a.account_type === 2 ? '자동' : '';
        const paperLabel = a.alpaca_paper ? '페이퍼' : '실계좌';
        const activeLabel = a.is_active ? ' ✓' : '';
        return `<option value="${a.id}">${a.account_name || '계좌 ' + a.id} · ${a.key_preview || ''} (${paperLabel}·${typeLabel}${activeLabel})</option>`;
      }).join('');
    }
     // 캐시된 계좌가 실제 목록에 있으면 사용, 없으면 첫 번째 계좌로 폴백
    const cached = localStorage.getItem('selectedAccountId');
    const cachedValid = cached && accounts.find(a => String(a.id) === cached);
    const active = cachedValid ? accounts.find(a => String(a.id) === cached) : (accounts.find(a => a.is_active) || accounts[0]);
    if (active) window.setSelectedAccount(String(active.id));
  } catch (e) { console.error('계좌 로드 실패', e); }
}
 // alpaca-keys.js의 fetch 오버라이드가 x-account-id를 자동으로 붙여주므로
// selectedAccountId만 activeAccountId와 동기화
Object.defineProperty(window, 'activeAccountId', {
  get() { return window.selectedAccountId; },
  set(v) { window.selectedAccountId = v; },
  configurable: true
});
 if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", loadAccountSelects); } else { loadAccountSelects(); }
  