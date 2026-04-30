// ============================================================
// helpers.js — XSS 헬퍼 / safeJson / 가격 토글
// 원본 stock.js 라인 1-66 에서 분할 (모놀리식 정리)
// 모든 함수는 global scope (classic <script>) — 다른 파일에서 호출 가능
// ============================================================

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const STOCK_API = isLocal ? 'http://localhost:5001' : '/proxy/stock';

// ===== XSS 방지 헬퍼 =====
// DOMPurify 가 <script>, <iframe>, javascript: URL, <object>, <embed> 등은 차단하면서
// 우리 코드의 inline onclick 등은 ADD_ATTR 로 허용 → 기능 유지.
// (완전 방어 아님 — 외부 데이터를 onclick="...${var}..." 안에 보간하는 패턴은 여전히 취약.
//  장기적으로 addEventListener + data-attr 패턴으로 마이그레이션 필요.)
const _SAFE_HTML_CONFIG = {
  ADD_ATTR: ['onclick', 'onchange', 'onkeydown', 'onkeyup', 'oninput', 'onmouseover', 'onmouseout', 'onsubmit', 'onload'],
};
function _safeHTML(html) {
  if (typeof DOMPurify !== 'undefined' && DOMPurify && typeof DOMPurify.sanitize === 'function') {
    return DOMPurify.sanitize(String(html == null ? '' : html), _SAFE_HTML_CONFIG);
  }
  // Fallback: DOMPurify 미로드 시 텍스트로 무력화 (안전 default)
  return String(html == null ? '' : html)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
// 단순 텍스트 이스케이프 (template literal 안에서 ${_esc(x)} 형태로 사용)
function _esc(s) {
  if (s == null) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
// http(s) URL만 허용 (javascript: 등 차단)
function _safeHttpUrl(u) {
  const s = String(u || '').trim();
  return /^https?:\/\//i.test(s) ? s : '';
}
// inline event handler 안에 JS 값 안전 삽입.
// 사용: onclick="fn(${_jsAttr(x)})"  또는  data-args="${_jsAttr([x, y])}"
// JSON.stringify → JS 안전 리터럴 (따옴표 포함) → _esc → HTML 속성 안전.
// 결과: 외부 데이터에 ' " < > 들어와도 JS/HTML 둘 다 무해.
function _jsAttr(v) { return _esc(JSON.stringify(v == null ? null : v)); }

// ===== 글로벌 이벤트 위임 (data-action / data-args 패턴 처리) =====
// inline onclick 대신 data-action="fnName" data-args="${_jsAttr([arg1, arg2])}" 사용 시
// 이 핸들러가 자동으로 window[fnName](...args) 호출.
// XSS 안전 (data-args 는 JSON.parse 만 거치고 함수 인자로 전달).
if (!window.__spagenioActionDelegated) {
  window.__spagenioActionDelegated = true;
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.getAttribute('data-action');
    if (!action) return;
    let args = [];
    const argsAttr = el.getAttribute('data-args');
    if (argsAttr) {
      try { args = JSON.parse(argsAttr); } catch (err) { return; }
      if (!Array.isArray(args)) args = [args];
    }
    const fn = window[action];
    if (typeof fn === 'function') {
      try { fn.apply(null, args); } catch (err) { console.error('[data-action]', action, err); }
    }
  });
}


// 뒤로가기 금지는 login.html에서만 처리

// ✅ API 요청에 토큰 자동 포함 (checkAuth보다 먼저 선언)
const originalFetch = window.fetch;

// ===== 가격 입력 원/달러 토글 =====
let _tradeCurrency = 'USD'; // 'USD' or 'KRW'
window.toggleTradeCurrency = function () {
  _tradeCurrency = _tradeCurrency === 'USD' ? 'KRW' : 'USD';
  const btn = document.getElementById('tradeCurrencyBtn');
  if (btn) btn.textContent = _tradeCurrency;
};

function getTradePriceUSD() {
  const priceRaw = parseFloat(document.getElementById('tradePrice')?.value || '');
  if (!priceRaw || isNaN(priceRaw)) return null; // 비어있으면 시장가
  if (_tradeCurrency === 'KRW') {
    // 원 → 달러 환산 (현재 환율은 직접 입력값 기준, 약 1350원/달러)
    return parseFloat((priceRaw / 1350).toFixed(2));
  }
  return priceRaw;
}

