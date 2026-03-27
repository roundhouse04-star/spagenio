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

// ===== 뉴스 통합 검색 함수 =====

// ===== 전역 팝업 시스템 =====
// spAlert(msg, title, icon) — alert() 대체
// spConfirm(msg, title, icon) — confirm() 대체 → Promise<boolean>

function spAlert(msg, title = '알림', icon = 'ℹ️') {
  return new Promise(resolve => {
    const layer = document.getElementById('sp-alert-layer');
    if (!layer) { alert(msg); resolve(); return; }
    document.getElementById('sp-alert-icon').textContent = icon;
    document.getElementById('sp-alert-title').textContent = title;
    document.getElementById('sp-alert-msg').textContent = msg;
    layer.style.cssText = 'display:flex;position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:99998;align-items:center;justify-content:center;';
    const btn = document.getElementById('sp-alert-ok');
    const handler = () => {
      layer.style.display = 'none';
      btn.removeEventListener('click', handler);
      resolve();
    };
    btn.addEventListener('click', handler);
  });
}

function spConfirm(msg, title = '확인', icon = '⚠️', okLabel = '확인', okColor = '#ef4444') {
  return new Promise(resolve => {
    const layer = document.getElementById('sp-confirm-layer');
    if (!layer) { resolve(confirm(msg)); return; }
    document.getElementById('sp-confirm-icon').textContent = icon;
    document.getElementById('sp-confirm-title').textContent = title;
    document.getElementById('sp-confirm-msg').textContent = msg;
    const okBtn = document.getElementById('sp-confirm-ok');
    okBtn.textContent = okLabel;
    okBtn.style.background = okColor;
    layer.style.cssText = 'display:flex;position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:99999;align-items:center;justify-content:center;';
    const okHandler = () => { cleanup(); resolve(true); };
    const cancelHandler = () => { cleanup(); resolve(false); };
    function cleanup() {
      layer.style.display = 'none';
      okBtn.removeEventListener('click', okHandler);
      document.getElementById('sp-confirm-cancel').removeEventListener('click', cancelHandler);
    }
    okBtn.addEventListener('click', okHandler);
    document.getElementById('sp-confirm-cancel').addEventListener('click', cancelHandler);
  });
}