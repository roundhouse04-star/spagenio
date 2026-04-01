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
  const ok = await spConfirm('이 계좌를 삭제하시겠습니까?', '계좌 삭제', '🗑️', '삭제', '#ef4444');
  if (!ok) return;
  try {
    const res = await fetch(`/api/user/broker-keys/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      if (activeAccountId === id) activeAccountId = null;
      await loadAlpacaKeyStatus();
      loadAccount();
    } else {
      await spAlert(data.error, '오류', '❌');
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
      await spAlert('계좌 타입이 변경됐습니다.', '완료', '✅');
      await loadAlpacaKeyStatus();
    } else {
      await spAlert(data.error || '변경 실패', '오류', '❌');
    }
  } catch(e) {
    await spAlert('서버 오류: ' + e.message, '오류', '❌');
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