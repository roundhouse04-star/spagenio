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