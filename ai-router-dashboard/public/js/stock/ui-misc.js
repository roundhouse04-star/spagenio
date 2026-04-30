// ============================================================
// ui-misc.js — 사이드바 / 탭 전환 / 통합 로그 / 백테스트 / 가격
// 원본 stock.js 라인 2977-3581 에서 분할 (모놀리식 정리)
// 모든 함수는 global scope (classic <script>) — 다른 파일에서 호출 가능
// ============================================================

// ============================================================
// 사이드바 동적 렌더링 (_currentTab/_currentSubTab/_menuData → common.js에서 선언)
// ============================================================
function renderSidebar(menus) {
  const nav = document.getElementById('sidebarNav');
  if (!nav) return;
  // 그룹 레이블 매핑
  const groupLabels = {
    'ai': '메인',
    'stock': '트레이딩',
    'datacollect': '트레이딩',
    'quant': '트레이딩',
    'backtest': '트레이딩',
    'performance': '분석'
  };
  let html = '';
  let lastGroup = '';
  menus.forEach(menu => {
    const group = groupLabels[menu.tab_key] || '';
    if (group && group !== lastGroup) {
      html += `<div class="sp-nav-label" style="margin-top:8px;">${group}</div>`;
      lastGroup = group;
    }
    const hasChildren = menu.children && menu.children.length > 0;
    if (hasChildren) {
      // 부모 메뉴 (서브메뉴 있음)
      html += `
        <button class="tab-btn sp-parent-btn" id="tab-btn-${menu.tab_key}" data-tab="${menu.tab_key}" data-id="${menu.id}"
          onclick="toggleSubMenu(${menu.id}, ${_jsAttr(menu.tab_key)})">
          <span class="nav-icon">${menu.icon}</span> ${menu.name}
          <span class="sp-parent-arrow">▶</span>
        </button>
        <div class="sp-sub-menu" id="sub-menu-${menu.id}">
          ${menu.children.map(child => `
            <button class="sp-sub-btn" id="sub-btn-${child.id}" data-tab="${child.tab_key}" data-sub="${child.sub_key}" data-id="${child.id}"
              onclick="activateMenu(${_jsAttr(child.tab_key)}, ${_jsAttr(child.sub_key)}, ${child.id})">
              <span>${child.icon}</span> ${child.name}
            </button>`).join('')}
        </div>`;
    } else {
      // 일반 메뉴
      html += `
        <button class="tab-btn" id="tab-btn-${menu.tab_key}-${menu.id}" data-tab="${menu.tab_key}" data-id="${menu.id}"
          onclick="activateMenu(${_jsAttr(menu.tab_key)}, null, ${menu.id})">
          <span class="nav-icon">${menu.icon}</span> ${menu.name}
        </button>`;
    }
  });
  nav.innerHTML = html;
}
function toggleSubMenu(menuId) {
  const subMenu = document.getElementById(`sub-menu-${menuId}`);
  const parentBtn = document.querySelector(`[data-id="${menuId}"]`);
  if (!subMenu) return;
  const isOpen = subMenu.classList.contains('open');
  // 모든 서브메뉴 닫기
  document.querySelectorAll('.sp-sub-menu').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.sp-parent-btn').forEach(b => b.classList.remove('open'));
  if (!isOpen) {
    subMenu.classList.add('open');
    if (parentBtn) parentBtn.classList.add('open');
    // 첫 번째 자식 자동 선택
    const firstChild = subMenu.querySelector('.sp-sub-btn');
    if (firstChild) firstChild.click();
  }
}
function activateMenu(tabKey, subKey, menuId) {
  const allTabs = document.querySelectorAll('.tab-content');
  allTabs.forEach(t => { t.style.display = 'none'; t.classList.remove('active-tab'); });
  const targetTab = document.getElementById(`tab-${tabKey}`);
  if (targetTab) { targetTab.style.display = 'block'; targetTab.classList.add('active-tab'); }
  // 버튼 활성화 상태
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.sp-sub-btn').forEach(b => b.classList.remove('active'));
  const parentBtn = document.querySelector(`.sp-parent-btn[data-tab="${tabKey}"]`);
  if (parentBtn) parentBtn.classList.add('active');
  const subBtn = document.getElementById(`sub-btn-${menuId}`);
  if (subBtn) subBtn.classList.add('active');
  const directBtn = document.getElementById(`tab-btn-${tabKey}-${menuId}`);
  if (directBtn) directBtn.classList.add('active');
  // 서브메뉴 열기
  if (subKey) {
    const parentId = _menuData.find(m => m.tab_key === tabKey && !m.parent_id)?.id;
    if (parentId) {
      const subMenu = document.getElementById(`sub-menu-${parentId}`);
      const parentBtnEl = document.querySelector(`[data-id="${parentId}"]`);
      if (subMenu) subMenu.classList.add('open');
      if (parentBtnEl) parentBtnEl.classList.add('open');
    }
    // switchQuantTab 호출 (자동매매 탭)
    if (tabKey === 'quant' && typeof switchQuantTab === 'function') switchQuantTab(subKey);
    // datacollect 탭 서브메뉴 처리
    if (tabKey === 'datacollect') {
      const tabEl = document.getElementById('tab-datacollect');
      if (tabEl) tabEl.style.display = 'block';
      if (typeof switchDcTab === 'function') switchDcTab(subKey || 'stock');
      return;
    }
  }
  // ── stock 탭 직접 처리 ──
  if (tabKey === 'stock' && !subKey) {
    window._currentTab = 'stock';
    setTimeout(() => {
      if (typeof loadAccount === 'function') loadAccount();
      if (typeof loadPositions === 'function') loadPositions();
      if (typeof loadOrders === 'function') loadOrders();
      if (typeof loadTradeLog === 'function') loadTradeLog();
    }, 300);
    return;
  }
  // ── performance 탭은 switchTab 이전에 먼저 처리 ──
  if (tabKey === 'performance') {
    // 즉시 실행 + 딜레이 후 재실행 (데이터 보장)
    if (typeof loadPerformanceSummary === 'function') loadPerformanceSummary();
    if (typeof loadPerformanceHistory === 'function') loadPerformanceHistory();
    setTimeout(() => {
      if (typeof loadAssetPieChart === 'function') loadAssetPieChart();
      if (typeof loadPositionPieChart === 'function') loadPositionPieChart();
      if (typeof loadTradeHistory === 'function') loadTradeHistory();
      if (typeof loadSavedBacktests === 'function') loadSavedBacktests();
    }, 300);
    return;
  }
  // 탭별 초기화 - switchTab 호출로 기존 로직 재활용
  if (typeof switchTab === 'function' && !subKey) {
    switchTab(tabKey);
    return; // switchTab이 탭 표시까지 처리
  }
  if (tabKey === 'quant' && !subKey) {
    setTimeout(() => { if (typeof checkInvestorProfile === 'function') checkInvestorProfile(); }, 50);
  }
  if (tabKey === 'analysis') {
    const analysisTab = document.getElementById('tab-analysis');
    if (analysisTab) analysisTab.style.display = 'block';
  }
}
function renderDefaultSidebar() {
  const nav = document.getElementById('sidebarNav');
  if (!nav) return;
  nav.innerHTML = _safeHTML(`
    <div class="sp-nav-label">메인</div>
    <button class="tab-btn active" id="tab-btn-ai-0" onclick="activateMenu('ai',null,0)"><span class="nav-icon">📰</span> 뉴스</button>
    <div class="sp-nav-label" style="margin-top:8px;">트레이딩</div>
    <button class="tab-btn" id="tab-btn-stock-0" onclick="activateMenu('stock',null,0)"><span class="nav-icon">📈</span> 주식</button>
    <button class="tab-btn" id="tab-btn-datacollect-0" onclick="activateMenu('datacollect',null,0)"><span class="nav-icon">📊</span> 데이터 수집</button>
    <button class="tab-btn" id="tab-btn-quant-0" onclick="activateMenu('quant',null,0)"><span class="nav-icon">🤖</span> 자동매매</button>
    <button class="tab-btn" id="tab-btn-backtest-0" onclick="activateMenu('backtest',null,0)"><span class="nav-icon">🔬</span> 백테스팅</button>
    <div class="sp-nav-label" style="margin-top:8px;">분석</div>
    <button class="tab-btn" id="tab-btn-performance-0" onclick="activateMenu('performance',null,0)"><span class="nav-icon">💹</span> 성과 대시보드</button>`);
}
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(renderAtSavedSettings, 800);
  // 퀀트 탭바 숨기기 (사이드바 서브메뉴로 대체)
  const quantTabBar = document.getElementById('quantTabBar');
  if (quantTabBar) quantTabBar.style.display = 'none';
  // 사이드바 동적 렌더링 (로그인 후 메뉴 로드)
  loadSidebarMenus();
  // 기존 common.js의 탭 전환 오버라이드
  // (common.js가 data-tab 기반으로 탭 전환하므로 유지)
});
// ============================================================
// 파이차트: 자산 비율 + 종목 비율
// ============================================================
// ── 주식 탭 서브탭 전환 ──
function switchStockSubTab(tab) {
  const tradePanel = document.getElementById('stockPanel-trade');
  const accountPanel = document.getElementById('stockPanel-account');
  const tradeBtn = document.getElementById('stockSubTab-trade');
  const accountBtn = document.getElementById('stockSubTab-account');
  if (tradePanel) tradePanel.style.display = tab === 'trade' ? '' : 'none';
  if (accountPanel) accountPanel.style.display = tab === 'account' ? '' : 'none';
  if (tradeBtn) {
    tradeBtn.style.background = tab === 'trade' ? '#6366f1' : 'transparent';
    tradeBtn.style.color = tab === 'trade' ? '#fff' : '#9CA3AF';
  }
  if (accountBtn) {
    accountBtn.style.background = tab === 'account' ? '#6366f1' : 'transparent';
    accountBtn.style.color = tab === 'account' ? '#fff' : '#9CA3AF';
  }
  if (tab === 'account') loadAlpacaKeyStatus();
  // 주식 탭 진입 시 활성 계좌 자동 로드 (activeAccountId 세팅)
  if (tab === 'stock') {
    if (typeof loadAlpacaKeyStatus === 'function') loadAlpacaKeyStatus();
    setTimeout(() => { if (typeof loadAccount === 'function') loadAccount(); }, 300);
  }
}
// ── 통합 거래내역 (자동매매 거래내역 탭) ──
let _unifiedLogFilter = 'all';
function setUnifiedLogFilter(type) {
  _unifiedLogFilter = type;
  const types = ['all', '2', '3', '4'];
  const colors = { all: '#6366f1', '2': '#fb923c', '3': '#34d399', '4': '#60a5fa' };
  types.forEach(t => {
    const btn = document.getElementById(`unifiedLogBtn-${t}`);
    if (!btn) return;
    const isActive = t === type;
    btn.style.background = isActive ? colors[t] : 'transparent';
    btn.style.color = isActive ? '#fff' : '#9CA3AF';
    btn.style.borderColor = isActive ? colors[t] : '#2A2A2A';
  });
  loadUnifiedTradeLog();
}
async function loadUnifiedTradeLog() {
  const el = document.getElementById('unifiedTradeLogTable');
  const countEl = document.getElementById('unifiedLogCount');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:#636366;padding:24px;font-size:0.85rem;">로딩 중...</div>';
  try {
    const res = await fetch('/api/trade4/log');
    const d = await res.json();
    // 자동매매만 (trade_type 2,3,4)
    let logs = (d.logs || []).filter(l => l.trade_type !== 1);
    // 필터 적용
    if (_unifiedLogFilter !== 'all') {
      logs = logs.filter(l => String(l.trade_type) === _unifiedLogFilter);
    }
    if (countEl) countEl.textContent = `${logs.length}건`;
    if (!logs.length) {
      el.innerHTML = '<div style="text-align:center;color:#636366;padding:24px;font-size:0.85rem;">거래 내역이 없습니다</div>';
      return;
    }
    const typeConfig = {
      2: { label: '단순자동', color: '#fb923c', bg: 'rgba(251,146,60,0.13)' },
      3: { label: '완전자동', color: '#34d399', bg: 'rgba(52,211,153,0.13)' },
      4: { label: '일반자동', color: '#60a5fa', bg: 'rgba(96,165,250,0.13)' },
    };
    const actionMap = {
      BUY: '매수', SELL: '매도', SELL_PROFIT: '익절', SELL_PROFIT1: '1차익절',
      SELL_PROFIT2: '2차익절', SELL_LOSS: '손절', SELL_STOP: '손절',
      SELL_FACTOR: '팩터매도', SELL_STOP_ALL: '전체종료'
    };
    const statusConfig = {
      active: { label: '보유중', color: '#f59e0b', bg: 'rgba(245,158,11,0.13)' },
      closed: { label: '종료', color: '#6b7280', bg: 'rgba(107,114,128,0.13)' },
    };
    el.innerHTML = _safeHTML(`<div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
        <thead>
          <tr style="border-bottom:1px solid #2A2A2A;">
            <th style="padding:7px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;white-space:nowrap;">일시</th>
            <th style="padding:7px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">종목</th>
            <th style="padding:7px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">타입</th>
            <th style="padding:7px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">구분</th>
            <th style="padding:7px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">수량</th>
            <th style="padding:7px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">가격</th>
            <th style="padding:7px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">손익</th>
            <th style="padding:7px 10px;text-align:left;font-size:0.7rem;color:#9CA3AF;font-weight:700;">상태</th>
          </tr>
        </thead>
        <tbody>
          ${logs.slice(0, 100).map(l => {
      const isBuy = l.action === 'BUY';
      const isProfit = l.action.includes('PROFIT');
      const isLoss = l.action.includes('LOSS') || l.action.includes('STOP');
      const actionColor = isBuy ? '#60a5fa' : isProfit ? '#34d399' : isLoss ? '#f87171' : '#9CA3AF';
      const pnlVal = parseFloat(l.profit_pct || 0);
      const pnlColor = pnlVal > 0 ? '#34d399' : pnlVal < 0 ? '#f87171' : '#9CA3AF';
      const pnl = (l.profit_pct != null && l.profit_pct !== 0) ? `${pnlVal > 0 ? '+' : ''}${pnlVal.toFixed(2)}%` : '-';
      const tc = typeConfig[l.trade_type] || { label: '기타', color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' };
      const sc = statusConfig[l.status] || { label: l.status, color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' };
      const dt = new Date(l.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      return `<tr onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background=''">
              <td style="padding:7px 10px;border-bottom:1px solid #1E242C;font-size:0.75rem;color:#636366;white-space:nowrap;">${dt}</td>
              <td style="padding:7px 10px;border-bottom:1px solid #1E242C;font-weight:800;color:#E5E7EB;">${l.symbol}</td>
              <td style="padding:7px 10px;border-bottom:1px solid #1E242C;"><span style="padding:2px 7px;border-radius:4px;font-size:0.7rem;font-weight:700;background:${tc.bg};color:${tc.color};">${tc.label}</span></td>
              <td style="padding:7px 10px;border-bottom:1px solid #1E242C;"><span style="padding:2px 7px;border-radius:4px;font-size:0.75rem;font-weight:700;background:${actionColor}22;color:${actionColor};">${actionMap[l.action] || l.action}</span></td>
              <td style="padding:7px 10px;border-bottom:1px solid #1E242C;color:#E5E7EB;">${parseFloat(l.qty || 0)}주</td>
              <td style="padding:7px 10px;border-bottom:1px solid #1E242C;color:#E5E7EB;">$${parseFloat(l.price || 0).toFixed(2)}</td>
              <td style="padding:7px 10px;border-bottom:1px solid #1E242C;font-weight:700;color:${pnlColor};">${pnl}</td>
              <td style="padding:7px 10px;border-bottom:1px solid #1E242C;"><span style="padding:2px 7px;border-radius:4px;font-size:0.7rem;font-weight:600;background:${sc.bg};color:${sc.color};">${sc.label}</span></td>
            </tr>`;
    }).join('')}
        </tbody>
      </table>
    </div>`);
  } catch (e) {
    el.innerHTML = _safeHTML(`<div style="color:#ef4444;font-size:0.82rem;padding:12px;">로드 실패: ${e.message}</div>`);
  }
}
// ===== 데이터 수집 탭 서브탭 전환 =====
function switchDcTab(tab) {
  const stockPanel = document.getElementById('dcPanelStock');
  const koreaPanel = document.getElementById('dcPanelKorea');
  const stockBtn = document.getElementById('dcTabStock');
  const koreaBtn = document.getElementById('dcTabKorea');
  const inactiveStyle = 'flex:1;padding:12px;border:none;background:#1E242C;color:#9CA3AF;font-weight:800;font-size:0.95rem;cursor:pointer;';
  const activeStyle = 'flex:1;padding:12px;border:none;background:#6366f1;color:#fff;font-weight:800;font-size:0.95rem;cursor:pointer;';
  if (stockPanel) stockPanel.style.display = tab === 'stock' ? '' : 'none';
  if (koreaPanel) koreaPanel.style.display = tab === 'korea' ? '' : 'none';
  if (stockBtn) stockBtn.style.cssText = tab === 'stock' ? activeStyle : inactiveStyle;
  if (koreaBtn) koreaBtn.style.cssText = tab === 'korea' ? activeStyle : inactiveStyle;
  if (tab === 'korea') { setTimeout(() => { if (typeof loadKoreaAnalysis === 'function') loadKoreaAnalysis(); }, 100); }
}
window.switchDcTab = switchDcTab;
// 성과 대시보드 계좌 타입 선택
window._perfAccountType = window._perfAccountType || 0;
window._perfAccountType = window._perfAccountType || 0;
window._perfAccountId = window._perfAccountId || '';
function setPerfAccount(accountId) {
  window._perfAccountId = accountId || '';
  const badge = document.getElementById('accountSelectPerfBadge');
  if (badge) badge.textContent = accountId ? '계좌별 조회 중' : '';
  loadPerformanceSummary();
  loadPerformanceHistory();
  loadAssetPieChart();
  loadPositionPieChart();
  loadTradeHistory();
}
window.setPerfAccount = setPerfAccount;
function setPerfAccountType(type) {
  window._perfAccountType = type;
  const labels = { 0: '전체 계좌 기준', 1: '수동 계좌 기준', 2: '자동매매 계좌 기준' };
  const labelEl = document.getElementById('perfAccLabel');
  if (labelEl) labelEl.textContent = labels[type] || '';
  [0, 1, 2].forEach(t => {
    const btn = document.getElementById(`perfAccBtn${t}`);
    if (!btn) return;
    if (t === type) {
      btn.style.background = '#6366f1';
      btn.style.color = '#fff';
      btn.style.borderColor = '#6366f1';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = '#9CA3AF';
      btn.style.borderColor = '#2A2A2A';
    }
  });
  loadPerformanceSummary();
  loadPerformanceHistory();
}

async function loadTradeHistory() {
  const el = document.getElementById('perfTradeHistory');
  if (!el) return;
  try {
    const res = await fetch('/api/trade4/log');
    const d = await res.json();
    if (!d.logs?.length) { el.innerHTML = '<div class="sp-empty">매매 이력 없음</div>'; return; }
    const actionMap = { BUY: '매수', SELL_PROFIT: '익절', SELL_PROFIT1: '1차익절', SELL_PROFIT2: '2차익절', SELL_LOSS: '손절', SELL_STOP: '손절', SELL_FACTOR: '팩터매도' };
    el.innerHTML = _safeHTML(`<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th style="padding:7px 10px;text-align:left;font-size:0.72rem;color:#9CA3AF;font-weight:700;text-transform:uppercase;border-bottom:1px solid #2A2A2A;">일시</th>
        <th style="padding:7px 10px;font-size:0.72rem;color:#9CA3AF;font-weight:700;text-transform:uppercase;border-bottom:1px solid #2A2A2A;">종목</th>
        <th style="padding:7px 10px;font-size:0.72rem;color:#9CA3AF;font-weight:700;text-transform:uppercase;border-bottom:1px solid #2A2A2A;">구분</th>
        <th style="padding:7px 10px;font-size:0.72rem;color:#9CA3AF;font-weight:700;text-transform:uppercase;border-bottom:1px solid #2A2A2A;">가격</th>
        <th style="padding:7px 10px;font-size:0.72rem;color:#9CA3AF;font-weight:700;text-transform:uppercase;border-bottom:1px solid #2A2A2A;">손익</th>
      </tr></thead><tbody>
      ${d.logs.slice(0, 20).map(l => {
      const isBuy = l.action === 'BUY';
      const isProfit = (l.action || '').includes('PROFIT');
      const color = isBuy ? '#4f8fff' : isProfit ? '#FF3B30' : '#007AFF';
      const pnl = l.profit_pct ? `${l.profit_pct > 0 ? '+' : ''}${parseFloat(l.profit_pct).toFixed(2)}%` : '-';
      return `<tr>
          <td style="padding:7px 10px;border-bottom:1px solid #2A2A2A;font-size:0.78rem;color:#9CA3AF;">${new Date(l.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #2A2A2A;font-weight:700;color:#E5E7EB;">${l.symbol}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #2A2A2A;"><span style="padding:2px 7px;border-radius:4px;font-size:0.75rem;font-weight:700;background:${color}22;color:${color};">${actionMap[l.action] || l.action}</span></td>
          <td style="padding:7px 10px;border-bottom:1px solid #2A2A2A;color:#E5E7EB;">$${parseFloat(l.price || 0).toFixed(2)}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #2A2A2A;font-weight:700;color:${isProfit ? '#FF3B30' : (l.action || '').includes('LOSS') || (l.action || '').includes('STOP') ? '#007AFF' : '#9CA3AF'};">${pnl}</td>
        </tr>`;
    }).join('')}
      </tbody></table></div>`);
  } catch (e) { el.innerHTML = '<div class="sp-empty">로드 실패</div>'; }
}
window.loadTradeHistory = loadTradeHistory;

// ============================================================
// 백테스트 결과 저장 JS
// ============================================================
async function loadSavedBacktests() {
  const el = document.getElementById('savedBacktestList');
  if (!el) return;
  try {
    const res = await fetch('/api/backtest/results');
    const d = await res.json();
    if (!d.ok || !d.results?.length) { el.innerHTML = '<div class="sp-empty">저장된 결과 없음</div>'; return; }
    el.innerHTML = d.results.map(r => {
      const ret = parseFloat(r.total_return || 0);
      const retColor = ret >= 0 ? '#FF3B30' : '#007AFF';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border:1px solid #2A2A2A;border-radius:8px;margin-bottom:8px;background:#1E242C;">
        <div>
          <div style="font-weight:700;color:#E5E7EB;font-size:0.88rem;">${r.name || r.symbol}</div>
          <div style="font-size:0.75rem;color:#9CA3AF;margin-top:2px;">${r.strategy} · ${r.start_date || ''} ~ ${r.end_date || ''}</div>
          <div style="font-size:0.75rem;color:#9CA3AF;">승률 ${r.win_rate?.toFixed(0) || '-'}% · MDD ${r.max_drawdown?.toFixed(1) || '-'}%</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:1.1rem;font-weight:800;color:${retColor};">${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%</div>
          <div style="font-size:0.72rem;color:#4B5563;margin-top:2px;">${r.created_at?.slice(0, 10) || ''}</div>
          <button onclick="deleteBacktestResult(${r.id})" style="font-size:0.72rem;color:#4B5563;background:none;border:none;cursor:pointer;margin-top:2px;">🗑️ 삭제</button>
        </div>
      </div>`;
    }).join('');
  } catch (e) { el.innerHTML = '<div class="sp-empty">로드 실패</div>'; }
}
window.loadSavedBacktests = loadSavedBacktests;

async function deleteBacktestResult(id) {
  const ok = await spConfirm('🗑️', '삭제 확인', '이 백테스트 결과를 삭제할까요?', '삭제', '#FF3B30');
  if (!ok) return;
  await fetch(`/api/backtest/results/${id}`, { method: 'DELETE' });
  loadSavedBacktests();
}
window.deleteBacktestResult = deleteBacktestResult;

// ============================================================
// 홈 포트폴리오 요약
// ============================================================
// _lastBtResult, runBacktest, _captureBtResult → chart.js에서 처리
// ── saveAutoTradeSettings 오버라이드 ─────────────────────────────
// 버그 수정: _origSave 선언 순서 수정 + API 이중 호출 제거
const _origSave = typeof window.saveAutoTradeSettings === 'function' ? window.saveAutoTradeSettings : null;
const _origLoad = typeof window.loadAutoTradeSettings === 'function' ? window.loadAutoTradeSettings : null;
let _simpleTradePoller = null;
const _origToggleSimple = typeof window.toggleSimpleAutoTrade === 'function' ? window.toggleSimpleAutoTrade : null;
let _topPicksCache = null;
let _topPicksCacheTime = 0;
let _topPicksCacheMarket = 'nasdaq';
const _origLoadTopPicks = typeof window.loadTopPicks === 'function' ? window.loadTopPicks : null;

window._baseSelectStock = function (symbol, name) {
  // _stockSearchTarget 없으면 _searchTargetId로 폴백
  if (!_stockSearchTarget && _searchTargetId) _stockSearchTarget = _searchTargetId;
  if (!_stockSearchTarget) return;
  // hidden input에 값 설정
  const inp = document.getElementById(_stockSearchTarget);
  if (inp) inp.value = symbol;
  // tradeSymbol 선택 시 → input에 값 설정 + 호가창 로드
  if (_stockSearchTarget === 'tradeSymbol') {
    const inp = document.getElementById('tradeSymbol');
    if (inp) {
      inp.value = symbol;
      clearTimeout(window._obTimer);
      setTimeout(() => { if (typeof loadOrderBook === 'function') loadOrderBook(); }, 100);
    }
  }
  // dc-symbol-badge 업데이트
  if (_stockSearchTarget === 'dc-search-input-target') {
    const badge = document.getElementById('dc-symbol-badge');
    if (badge) badge.innerHTML = _safeHTML(`<span style="padding:3px 10px;background:rgba(99,102,241,0.15);border-radius:999px;color:#a5b4fc;font-size:0.85rem;font-weight:700;">${symbol}</span>`);
    const symEl = document.getElementById('quantSymbol');
    if (symEl) symEl.value = symbol;
    const dcSymEl = document.getElementById('dc-symbols');
    if (dcSymEl) dcSymEl.value = symbol;
  }
  // analysis 종목 배지 업데이트
  if (_stockSearchTarget === 'analysisSymbolInput') {
    const badge = document.getElementById('analysisSymbolBadge');
    if (badge) badge.innerHTML = _safeHTML(`<span style="font-weight:700;color:#E5E7EB;">${symbol}</span><span style="margin-left:6px;font-size:0.78rem;color:#9CA3AF;">${name}</span>`);
    if (badge) badge.style.color = '#E5E7EB';
  }
  // bt-symbol 백테스팅 심볼
  if (_stockSearchTarget === 'bt-symbol') {
    const display = document.getElementById('bt-symbol-display');
    if (display) display.innerHTML = _safeHTML(`<span style="font-weight:700;color:#E5E7EB;">${symbol}</span><span style="margin-left:6px;font-size:0.78rem;color:#9CA3AF;">${name}</span>`);
  }
  closeStockSearch();
};
// window.selectStock은 1348줄 function selectStock 사용 (덮어쓰기 제거)
// 실시간 가격 조회 (tradeSymbol 선택 시)
async function loadTradePrice(symbol) {
  const priceBox = document.getElementById('tradePriceDisplay');
  const priceVal = document.getElementById('tradePriceValue');
  const priceChg = document.getElementById('tradePriceChange');
  if (!priceBox) return;
  priceBox.style.display = 'block';
  if (priceVal) priceVal.textContent = '조회 중...';
  if (priceChg) priceChg.textContent = '';
  try {
    const res = await fetch('/proxy/stock/price?symbol=' + encodeURIComponent(symbol));
    const d = await res.json();
    const price = d.price || d.c || d.last || 0;
    const change = d.change_pct || d.dp || 0;
    if (priceVal) priceVal.textContent = symbol.endsWith('.KS') || symbol.endsWith('.KQ')
      ? '₩' + price.toLocaleString()
      : '$' + price.toFixed(2);
    if (priceChg) {
      priceChg.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
      priceChg.style.color = change >= 0 ? '#FF3B30' : '#1E7BFF';
    }
  } catch (e) {
    if (priceVal) priceVal.textContent = '가격 조회 실패';
  }
}
// ============================================================
// 종목 분석 JS
// ============================================================
let _analysisSymbol = '';
let _analysisChartInstance = null;
async function runStockAnalysis() {
  const symbol = document.getElementById('analysisSymbolInput')?.value?.trim().toUpperCase();
  if (!symbol) { await spAlert('종목을 먼저 검색해서 선택해주세요', '알림', '⚠️'); return; }
  _analysisSymbol = symbol;
  document.getElementById('analysisLoading').style.display = 'block';
  document.getElementById('analysisResult').style.display = 'none';
  document.getElementById('analysisError').style.display = 'none';
  try {
    const res = await fetch(`/proxy/quant/api/quant/stock-analysis?symbol=${symbol}`);
    const d = await res.json();
    if (!d.ok) throw new Error(d.error || '분석 실패');
    renderAnalysisResult(d);
    loadAnalysisChart('3mo');
  } catch (e) {
    document.getElementById('analysisError').style.display = 'block';
    document.getElementById('analysisError').textContent = '❌ ' + e.message;
  } finally {
    document.getElementById('analysisLoading').style.display = 'none';
  }
}
function renderAnalysisResult(d) {
  const isKr = _analysisSymbol.endsWith('.KS') || _analysisSymbol.endsWith('.KQ');
  const currency = isKr ? '₩' : '$';
  const fmt = (v) => v ? `${currency}${isKr ? Math.round(v).toLocaleString() : v.toLocaleString()}` : '-';
  document.getElementById('analysisName').textContent = `${d.fundamentals?.name || d.symbol} (${d.symbol})`;
  document.getElementById('analysisSector').textContent = d.fundamentals?.sector || '';
  document.getElementById('analysisPrice').textContent = fmt(d.current_price);
  const chg = d.change_pct;
  const chgEl = document.getElementById('analysisChange');
  chgEl.textContent = chg != null ? `${chg >= 0 ? '+' : ''}${chg}%` : '-';
  chgEl.style.color = chg >= 0 ? '#FF3B30' : '#1E7BFF';
  document.getElementById('analysis52High').textContent = fmt(d.fundamentals?.fifty_two_week_high);
  document.getElementById('analysis52Low').textContent = fmt(d.fundamentals?.fifty_two_week_low);
  document.getElementById('analysisVolume').textContent = d.fundamentals?.volume ? (d.fundamentals.volume / 1e6).toFixed(1) + 'M' : '-';
  const mc = d.fundamentals?.market_cap;
  document.getElementById('analysisMktCap').textContent = mc ? (mc >= 1e12 ? (mc / 1e12).toFixed(1) + 'T' : (mc / 1e9).toFixed(1) + 'B') : '-';
  const c = d.consensus || {};
  const recMap = { buy: { label: '매수', color: '#10b981', bg: 'rgba(16,185,129,0.15)' }, hold: { label: '보유', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }, sell: { label: '매도', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' }, 'strong buy': { label: '강력매수', color: '#10b981', bg: 'rgba(16,185,129,0.2)' }, 'strong sell': { label: '강력매도', color: '#ef4444', bg: 'rgba(239,68,68,0.2)' } };
  const rec = recMap[c.recommendation?.toLowerCase()] || { label: c.recommendation || '-', color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' };
  const recEl = document.getElementById('analysisRecommendation');
  recEl.textContent = rec.label;
  recEl.style.color = rec.color;
  recEl.style.background = rec.bg;
  document.getElementById('analysisAnalystCount').textContent = c.analyst_count ? `애널리스트 ${c.analyst_count}명` : '';
  document.getElementById('analysisTargetMean').textContent = c.target_mean ? fmt(c.target_mean) : '-';
  document.getElementById('analysisTargetHigh').textContent = c.target_high ? fmt(c.target_high) : '-';
  document.getElementById('analysisTargetLow').textContent = c.target_low ? fmt(c.target_low) : '-';
  const upsideEl = document.getElementById('analysisUpside');
  if (c.upside_pct != null) {
    upsideEl.textContent = `현재가 대비 목표가 ${c.upside_pct >= 0 ? '+' : ''}${c.upside_pct}% ${c.upside_pct >= 0 ? '↑ 상승여력' : '↓ 하락여지'}`;
    upsideEl.style.color = c.upside_pct >= 0 ? '#10b981' : '#ef4444';
  }
  const f = d.fundamentals || {};
  const fundItems = [
    { label: 'PER', value: f.per ? f.per + '배' : '-' },
    { label: 'PBR', value: f.pbr ? f.pbr + '배' : '-' },
    { label: 'ROE', value: f.roe ? f.roe + '%' : '-', color: f.roe > 15 ? '#10b981' : f.roe > 0 ? '#E5E7EB' : '#ef4444' },
    { label: '부채비율', value: f.debt_to_equity ? f.debt_to_equity + '%' : '-', color: f.debt_to_equity < 100 ? '#10b981' : f.debt_to_equity < 200 ? '#f59e0b' : '#ef4444' },
    { label: '매출성장', value: f.revenue_growth ? f.revenue_growth + '%' : '-', color: f.revenue_growth > 10 ? '#10b981' : f.revenue_growth > 0 ? '#E5E7EB' : '#ef4444' },
    { label: '업종', value: f.industry || '-' },
  ];
  document.getElementById('analysisFundamentals').innerHTML = fundItems.map(item => `
    <div style="padding:10px;background:#1E242C;border-radius:8px;">
      <div style="font-size:0.72rem;color:#9CA3AF;margin-bottom:4px;">${item.label}</div>
      <div style="font-weight:700;color:${item.color || '#E5E7EB'};">${item.value}</div>
    </div>`).join('');
  const t = d.technical || {};
  const sigMap = { buy: { label: '매수', color: '#10b981' }, weak_buy: { label: '약한매수', color: '#34d399' }, hold: { label: '중립', color: '#f59e0b' }, weak_sell: { label: '약한매도', color: '#f87171' }, sell: { label: '매도', color: '#ef4444' } };
  const sig = sigMap[t.signal] || { label: t.signal || '-', color: '#9CA3AF' };
  const sigEl = document.getElementById('analysisTechSignal');
  sigEl.textContent = sig.label;
  sigEl.style.background = sig.color + '22';
  sigEl.style.color = sig.color;
  const details = t.details || {};
  const techItems = Object.entries(details).map(([key, val]) => `
    <div style="padding:10px;background:#1E242C;border-radius:8px;">
      <div style="font-size:0.72rem;color:#9CA3AF;margin-bottom:4px;">${key}</div>
      <div style="font-weight:700;color:${val.signal === 'buy' ? '#10b981' : val.signal === 'sell' ? '#ef4444' : '#f59e0b'};font-size:0.8rem;">${val.reason || val.signal || '-'}</div>
    </div>`).join('');
  document.getElementById('analysisTechnical').innerHTML = techItems || '<div style="color:#9CA3AF;padding:8px;">기술적 데이터 없음</div>';
  document.getElementById('analysisResult').style.display = 'block';
}
async function loadAnalysisChart(period) {
  if (!_analysisSymbol) return;
  document.querySelectorAll('.analysis-period-btn').forEach(b => b.classList.remove('active'));
  event?.target?.classList?.add('active');
  try {
    const res = await fetch(`/proxy/quant/api/quant/chart?symbol=${_analysisSymbol}&period=${period}`);
    const data = await res.json();
    if (data.error || !data.dates) return;
    if (_analysisChartInstance) { _analysisChartInstance.destroy(); _analysisChartInstance = null; }
    const ctx = document.getElementById('analysisChartCanvas')?.getContext('2d');
    if (!ctx) return;
    const up = data.ohlc.close[data.ohlc.close.length - 1] >= data.ohlc.close[0];
    _analysisChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.dates,
        datasets: [
          { label: '종가', data: data.ohlc.close, borderColor: up ? '#FF3B30' : '#1E7BFF', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true, backgroundColor: up ? 'rgba(255,59,48,0.05)' : 'rgba(30,123,255,0.05)' },
          { label: 'SMA20', data: data.sma?.sma20, borderColor: '#f59e0b', borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false, borderDash: [4, 2] },
          { label: 'BB상단', data: data.bb?.upper, borderColor: 'rgba(16,185,129,0.4)', borderWidth: 1, pointRadius: 0, fill: false, borderDash: [3, 3] },
          { label: 'BB하단', data: data.bb?.lower, borderColor: 'rgba(16,185,129,0.4)', borderWidth: 1, pointRadius: 0, fill: false, borderDash: [3, 3] },
        ]
      },
      options: {
        responsive: true, animation: false,
        plugins: { legend: { labels: { color: '#9CA3AF', font: { size: 11 } } } },
        scales: {
          x: { ticks: { color: '#9CA3AF', maxTicksLimit: 8, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#9CA3AF', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  } catch (e) { console.error('차트 로드 실패:', e); }
}
// ── 자동매매 계좌 선택기 ──────────────────────────────
window.selectedAccountId = window.selectedAccountId || localStorage.getItem('selectedAccountId') || null;
