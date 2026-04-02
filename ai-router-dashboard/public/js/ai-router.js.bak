// ===== ai-router.js =====
// toggleAdvancedFilter, fetchTodayNews, onModelChange, runNewsSearch → news.js로 이동
// checkAuth, logout, loadUserInfo → common.js로 이동
// readForm, applyForm, getJson, postJson, renderStatusCards, renderPresets,
// writeOutput, writeSummaryCards, calcClaudeCost, summarizeResult,
// previewRoute, runRoute, loadAll, toggleConfig → dead code 제거
// searchBtn 이벤트, DOMContentLoaded 탭버튼 등록 → dead code 제거

// ===== 탭 전환 =====
// activateMenu(common.js)에서 호출 / alpaca-keys.js에서 오버라이드
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => { el.style.display = 'none'; });
  document.querySelectorAll('.tab-btn').forEach(btn => { btn.classList.remove('active'); });

  const tabEl = document.getElementById('tab-' + tab);
  if (tabEl) tabEl.style.display = 'block';
  const activeBtn = document.getElementById('tab-btn-' + tab);
  if (activeBtn) activeBtn.classList.add('active');

  if (tab === 'stock') {
    const stockInput = document.getElementById('stockSymbols');
    if (stockInput) stockInput.value = '';
    const stockBadge = document.getElementById('stock-symbol-badge');
    if (stockBadge) {
      stockBadge.querySelectorAll('.stock-badge-item').forEach(el => el.remove());
      const ph = document.getElementById('stock-symbol-placeholder');
      if (ph) ph.style.display = 'inline';
    }
    const priceCards = document.getElementById('priceCards');
    if (priceCards) priceCards.innerHTML = '<div style="color:#9ca3af;font-size:0.88rem;padding:12px 0;">🔍 위에서 종목을 검색하세요 (최대 5종목)</div>';
    if (typeof loadAccount === 'function') loadAccount();
    if (typeof loadPositions === 'function') loadPositions();
    if (typeof loadOrders === 'function') loadOrders();
  }
  if (tab === 'lotto') {
    if (typeof lottoInit === 'function') lottoInit();
  }
  if (tab === 'ai') {
    if (typeof loadNews === 'function') loadNews();
    if (typeof loadMarketIndicators === 'function') loadMarketIndicators();
  }
  if (tab === 'quant') {
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
    if (typeof _dcSelectedSymbols !== 'undefined') { _dcSelectedSymbols = []; _dcActiveSymbol = ''; }
    const searchInput = document.getElementById('dc-search-input');
    if (searchInput) searchInput.value = '';
    const searchResult = document.getElementById('dc-search-result');
    if (searchResult) searchResult.style.display = 'none';
    const badge = document.getElementById('dc-symbol-badge');
    if (badge) badge.innerHTML = '<span style="color:#9ca3af;font-weight:400;font-size:0.85rem;">종목을 검색해서 선택하세요</span>';
    const resultCard = document.getElementById('quantResultCard');
    if (resultCard) resultCard.style.display = 'none';
    const quantResult = document.getElementById('quantResult');
    if (quantResult) quantResult.innerHTML = '';
    const historyResult = document.getElementById('dc-history-result');
    if (historyResult) historyResult.innerHTML = '';
  }
}
