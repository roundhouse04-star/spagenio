// ============================================================
// screening.js — 투자자 성향 / 시장 선택 / 스크리닝
// 원본 stock.js 라인 1984-2510 에서 분할 (모놀리식 정리)
// 모든 함수는 global scope (classic <script>) — 다른 파일에서 호출 가능
// ============================================================

// ===== 주식/자동매매/투자자성향/종목분석 (index.html에서 이동) =====
// ===== 전역 변수 =====
let _selectedMarket = 'nasdaq';
let _selectedKrMarket = 'kospi';
let _investorProfile = null; // 투자 성향 캐시
// ============================================================
// 투자 성향 (Investor Profile) 시스템
// ============================================================
const PROFILE_META = {
  aggressive: {
    icon: '🚀', label: '공격형', color: '#dc2626', bg: '#fef2f2', border: '#fecaca',
    desc: '높은 수익을 추구하며 모멘텀 중심으로 투자해요'
  },
  balanced: {
    icon: '📊', label: '균형형', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe',
    desc: '모멘텀과 가치를 균형있게 추구해요'
  },
  moderate: {
    icon: '⚖️', label: '안정성장형', color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd',
    desc: '안정성을 중시하면서 성장도 추구해요'
  },
  conservative: {
    icon: '🛡️', label: '안정형', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0',
    desc: '원금 보존을 최우선으로 안정적으로 투자해요'
  },
  beginner: {
    icon: '🌱', label: '초보형', color: '#92400e', bg: '#fffbeb', border: '#fde68a',
    desc: '대형 우량주 중심의 안전한 투자 전략을 적용해요'
  },
};
// 퀀트 탭 진입 시 성향 확인 → 미등록이면 등록 페이지 표시
async function checkInvestorProfile() {
  try {
    const res = await fetch('/api/investor-profile');
    const d = await res.json();
    if (!d.ok) return;
    const profilePage = document.getElementById('quantProfilePage');
    const profileCard = document.getElementById('investorProfileCard');
    const tabBar = document.querySelector('#tab-quant .sp-page > div:nth-child(3)'); // 탭 선택 div
    const quantPanelUs = document.getElementById('quantPanelUs');
    const quantPanelKr = document.getElementById('quantPanelKr');
    const quantPanelAuto = document.getElementById('quantPanelAuto');
    if (!d.profile || !d.profile.completed) {
      // 미등록 → 성향 등록 페이지 표시, 자동매매 탭/패널 숨김
      profilePage.style.display = '';
      if (profileCard) profileCard.style.display = 'none';
      // 탭바와 패널 숨기기
      document.getElementById('quantTabBar')?.style && (document.getElementById('quantTabBar').style.display = 'none');
      if (quantPanelUs) quantPanelUs.style.display = 'none';
      if (quantPanelKr) quantPanelKr.style.display = 'none';
      if (quantPanelAuto) quantPanelAuto.style.display = 'none';
      const _dayPanel = document.getElementById('quantPanelDay');
      if (_dayPanel) _dayPanel.style.display = 'none';
    } else {
      // 등록 완료 → 성향 등록 페이지 숨기고 자동매매 표시
      profilePage.style.display = 'none';
      _investorProfile = d.profile;
      renderProfileCard(d.profile);
      applyProfileToSettings(d.profile);
      // 탭바 복원
      document.getElementById('quantTabBar')?.style && (document.getElementById('quantTabBar').style.display = '');
    }
  } catch (e) { }
}
// 나중에 하기 → 뉴스 탭으로 이동
window.goToNewsTab = function () {
  const newsBtn = document.getElementById('tab-btn-news') || document.querySelector('[data-tab="news"]');
  if (newsBtn) newsBtn.click();
};
// 성향 등록 페이지 표시 (재설문 포함)
window.showProfilePage = function () {
  const profilePage = document.getElementById('quantProfilePage');
  const profileCard = document.getElementById('investorProfileCard');
  const tabBar = document.getElementById('quantTabBar');
  const usPanel = document.getElementById('quantPanelUs');
  const krPanel = document.getElementById('quantPanelKr');
  const autoPanel = document.getElementById('quantPanelAuto');
  if (profilePage) profilePage.style.display = '';
  if (profileCard) profileCard.style.display = 'none';
  if (tabBar) tabBar.style.display = 'none';
  if (usPanel) usPanel.style.display = 'none';
  if (krPanel) krPanel.style.display = 'none';
  if (autoPanel) autoPanel.style.display = 'none';
  // 페이지 상단으로 스크롤
  document.getElementById('tab-quant')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
function renderProfileCard(p) {
  const card = document.getElementById('investorProfileCard');
  if (!card) return;
  const meta = PROFILE_META[p.profile_type] || PROFILE_META.balanced;
  card.style.display = 'block';
  card.innerHTML = _safeHTML(`
  <div style="background:${meta.bg};border:1.5px solid ${meta.border};border-radius:12px;padding:14px 18px;">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:1.5rem;">${meta.icon}</span>
        <div>
          <div style="font-size:0.72rem;color:${meta.color};font-weight:700;margin-bottom:2px;">내 투자 성향</div>
          <div style="font-size:0.95rem;font-weight:800;color:#E5E7EB;">${meta.label}</div>
          <div style="font-size:0.75rem;color:#9CA3AF;margin-top:1px;">${meta.desc}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
        <div style="display:flex;gap:6px;font-size:0.7rem;">
          <span style="padding:2px 8px;border-radius:999px;background:rgba(79,143,255,0.15);color:#3730a3;">모멘텀 ${Math.round(p.w_momentum * 100)}%</span>
          <span style="padding:2px 8px;border-radius:999px;background:rgba(255,59,48,0.15);color:#166534;">가치 ${Math.round(p.w_value * 100)}%</span>
          <span style="padding:2px 8px;border-radius:999px;background:rgba(255,214,10,0.12);color:#92400e;">퀄리티 ${Math.round(p.w_quality * 100)}%</span>
          <span style="padding:2px 8px;border-radius:999px;background:rgba(30,123,255,0.08);color:#0369a1;">뉴스 ${Math.round(p.w_news * 100)}%</span>
        </div>
        <div style="font-size:0.7rem;color:#9CA3AF;">
          익절 ${Math.round(p.risk_take_profit * 100)}% · 손절 ${Math.round(p.risk_stop_loss * 100)}% · 최대 ${p.risk_max_positions}종목
        </div>
        <button onclick="showProfilePage()"
          style="font-size:0.72rem;padding:3px 10px;border-radius:6px;border:1px solid ${meta.border};background:#161B22;color:${meta.color};cursor:pointer;font-weight:600;">
          ✏️ 재설문
        </button>
      </div>
    </div>
  </div>`);
}
window.submitInvestorProfile = async function () {
  const q_period = parseInt(document.querySelector('input[name="q_period"]:checked')?.value || 2);
  const q_loss = parseInt(document.querySelector('input[name="q_loss"]:checked')?.value || 2);
  const q_return = parseInt(document.querySelector('input[name="q_return"]:checked')?.value || 2);
  const q_style = parseInt(document.querySelector('input[name="q_style"]:checked')?.value || 2);
  const q_experience = parseInt(document.querySelector('input[name="q_experience"]:checked')?.value || 2);
  try {
    const res = await fetch('/api/investor-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q_period, q_loss, q_return, q_style, q_experience })
    });
    const d = await res.json();
    if (!d.ok) { await spAlert('❌', '오류', '저장에 실패했어요'); return; }
    document.getElementById('investor-profile-layer') && (document.getElementById('investor-profile-layer').style.display = 'none');
    _investorProfile = d;
    // 등록 페이지 숨기고 자동매매 탭 표시
    const profilePage = document.getElementById('quantProfilePage');
    if (profilePage) profilePage.style.display = 'none';
    const tabBar = document.getElementById('quantTabBar');
    if (tabBar) tabBar.style.display = 'flex';
    const meta = PROFILE_META[d.profile_type] || PROFILE_META.balanced;
    await spAlert(meta.icon, `${meta.label} 투자자!`,
      `${meta.desc}\n\n모멘텀 ${Math.round(d.w_momentum * 100)}% · 가치 ${Math.round(d.w_value * 100)}% · 퀄리티 ${Math.round(d.w_quality * 100)}%\n익절 ${Math.round(d.risk_take_profit * 100)}% · 손절 ${Math.round(d.risk_stop_loss * 100)}%`);
    // 성향 카드 렌더링
    renderProfileCard({
      profile_type: d.profile_type,
      w_momentum: d.w_momentum, w_value: d.w_value,
      w_quality: d.w_quality, w_news: d.w_news,
      risk_take_profit: d.risk_take_profit, risk_stop_loss: d.risk_stop_loss,
      risk_max_positions: d.risk_max_positions,
    });
    // 자동매매 설정 성향 기반 자동 적용
    applyProfileToSettings(d);
    // 미국 자동매매 탭으로 이동
    switchQuantTab('us');
  } catch (e) { await spAlert('❌', '오류', e.message); }
};
function applyProfileToSettings(profile) {
  // 미국 자동매매 탭에 성향 기반 값 자동 적용
  const tp = document.getElementById('atTakeProfit');
  const sl = document.getElementById('atStopLoss');
  if (tp) tp.value = Math.round(profile.risk_take_profit * 100);
  if (sl) sl.value = Math.round(profile.risk_stop_loss * 100);
  // 완전자동매매 탭
  const asBal = document.getElementById('asBalanceRatio');
  const asMax = document.getElementById('asMaxPositions');
  const asTp1 = document.getElementById('asTakeProfit1');
  const asTp2 = document.getElementById('asTakeProfit2');
  const asSl = document.getElementById('asStopLoss');
  if (asBal) asBal.value = Math.round(profile.risk_balance_ratio * 100);
  if (asMax) asMax.value = profile.risk_max_positions;
  if (asTp1) asTp1.value = Math.round(profile.risk_take_profit * 100);
  if (asTp2) asTp2.value = Math.round(profile.risk_take_profit * 200); // 2차 = 1차 × 2
  if (asSl) asSl.value = Math.round(profile.risk_stop_loss * 100);
}
// ===== 미국/한국 탭 전환 =====
window.switchQuantTab = function (tab) {
  const usPanel = document.getElementById('quantPanelUs');
  const krPanel = document.getElementById('quantPanelKr');
  const autoPanel = document.getElementById('quantPanelAuto');
  const dayPanel = document.getElementById('quantPanelDay');
  const logPanel = document.getElementById('quantPanelLog');
  const usBtn = document.getElementById('quantTabUs');
  const krBtn = document.getElementById('quantTabKr');
  const autoBtn = document.getElementById('quantTabAuto');
  const dayBtn = document.getElementById('quantTabDay');
  const logBtn = document.getElementById('quantTabLog');
  const inactiveStyle = 'flex:1;padding:12px;border:none;background:#1E242C;color:#9CA3AF;font-weight:800;font-size:0.95rem;cursor:pointer;';
  usPanel.style.display = tab === 'us' ? '' : 'none';
  krPanel.style.display = tab === 'kr' ? '' : 'none';
  autoPanel.style.display = tab === 'auto' ? '' : 'none';
  if (dayPanel) dayPanel.style.display = tab === 'day' ? '' : 'none';
  if (logPanel) logPanel.style.display = tab === 'log' ? '' : 'none';
  usBtn.style.cssText = tab === 'us' ? 'flex:1;padding:12px;border:none;background:#6366f1;color:#fff;font-weight:800;font-size:0.95rem;cursor:pointer;' : inactiveStyle;
  krBtn.style.cssText = tab === 'kr' ? 'flex:1;padding:12px;border:none;background:#6366f1;color:#fff;font-weight:800;font-size:0.95rem;cursor:pointer;' : inactiveStyle;
  autoBtn.style.cssText = tab === 'auto' ? 'flex:1;padding:12px;border:none;background:#6366f1;color:#fff;font-weight:800;font-size:0.95rem;cursor:pointer;' : inactiveStyle;
  if (dayBtn) dayBtn.style.cssText = tab === 'day' ? 'flex:1;padding:12px;border:none;background:#6366f1;color:#fff;font-weight:800;font-size:0.95rem;cursor:pointer;' : inactiveStyle;
  if (logBtn) logBtn.style.cssText = tab === 'log' ? 'flex:1;padding:12px;border:none;background:#6366f1;color:#fff;font-weight:800;font-size:0.95rem;cursor:pointer;' : inactiveStyle;
  if (tab === 'auto') { loadAutoStrategySettings(); loadAutoStrategyPositions(); setTimeout(() => { if (typeof renderAutoSavedSymbols === 'function') renderAutoSavedSymbols(); }, 300); setAutoMarket(_autoMarket || 'nasdaq'); }
  if (tab === 'kr') { setTimeout(() => { if (typeof renderKrSavedSettings === 'function') renderKrSavedSettings(); }, 300); setKrMarket(_selectedKrMarket || 'kospi'); }
  if (tab === 'us') { setMarket(_selectedMarket || 'nasdaq'); }
  if (tab === 'day') { loadVolumeSurge(); loadNewsCatalyst(); loadSimpleTradeState(); loadCombinedSignal(); }
  if (tab === 'log') { loadUnifiedTradeLog(); }
  // 퀀트 탭 진입 시 성향 체크 (매번 확인)
  checkInvestorProfile();
};
// ===== 통합 매매 신호 =====
window.loadCombinedSignal = async function () {
  const el = document.getElementById('combinedSignalList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:16px;font-size:0.85rem;">⏳ 분석 중...</div>';
  try {
    const market = window._dayMarket || 'us';
    const [volumeRes, newsRes] = await Promise.all([
      fetch(`/api/trade4/volume_surge?market=${market}`).then(r => r.json()),
      fetch(`/api/trade4/news_catalyst?market=${market}`).then(r => r.json())
    ]);
    const surges = volumeRes.surges || [];
    const catalysts = newsRes.catalysts || [];
    const newsSymbols = new Set(catalysts.map(c => c.symbol));
    // 거래량 급등 + 뉴스 둘 다 있는 종목
    const combined = surges.filter(s => newsSymbols.has(s.symbol));
    // 거래량 급등만 있는 종목
    const surgeOnly = surges.filter(s => !newsSymbols.has(s.symbol)).slice(0, 3);
    if (!combined.length && !surgeOnly.length) {
      el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:24px;font-size:0.85rem;">현재 통합 신호 없음</div>';
      return;
    }
    const currency = market === 'kr' ? '₩' : '$';
    let html = '';
    if (combined.length) {
      html += '<div style="font-size:0.75rem;font-weight:700;color:#6366f1;margin-bottom:8px;">🔥 거래량 + 뉴스 동시 감지</div>';
      html += combined.map(s => {
        const news = catalysts.find(c => c.symbol === s.symbol);
        return `<div style="padding:12px;border:2px solid #6366f1;border-radius:10px;margin-bottom:8px;background:rgba(99,102,241,0.1);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-weight:800;font-size:1rem;color:#4338ca;">${s.symbol}</span>
            <div style="display:flex;gap:6px;">
              <span style="font-size:0.72rem;padding:2px 8px;border-radius:999px;background:rgba(99,102,241,0.2);color:#a5b4fc;font-weight:700;">📊 ${s.volume_ratio}x</span>
              <span style="font-size:0.72rem;padding:2px 8px;border-radius:999px;background:rgba(245,158,11,0.2);color:#fbbf24;font-weight:700;">📰 뉴스</span>
            </div>
          </div>
          <div style="font-size:0.78rem;color:#4338ca;">${news?.latest_title || ''}</div>
          <button data-action="quickRiskCalc" data-args="${_jsAttr([s.symbol])}" style="margin-top:8px;padding:4px 12px;font-size:0.75rem;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;">🛡️ 리스크 계산</button>
        </div>`;
      }).join('');
    }
    if (surgeOnly.length) {
      html += '<div style="font-size:0.75rem;font-weight:700;color:#f59e0b;margin:12px 0 8px;">⚡ 거래량 급등 (뉴스 미감지)</div>';
      html += surgeOnly.map(s => `
        <div style="padding:10px;border:1px solid rgba(245,158,11,0.3);border-radius:10px;margin-bottom:6px;background:rgba(245,158,11,0.08);">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:800;color:#92400e;">${s.symbol}</span>
            <span style="font-size:0.75rem;color:#92400e;">${s.volume_ratio}x · ${currency}${s.price?.toFixed(2)}</span>
          </div>
        </div>`).join('');
    }
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = _safeHTML(`<div style="color:#ef4444;padding:12px;">오류: ${e.message}</div>`);
  }
};
// ===== 완전자동매매 시장 선택 =====
let _autoMarket = 'nasdaq';
window.setAutoMarket = function (market) {
  _autoMarket = market;
  const idMap = { nasdaq: 'asBtnNasdaq', dow: 'asBtnDow', sp500: 'asBtnSp500', russell1000: 'asBtnRussell' };
  Object.entries(idMap).forEach(([m, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.background = m === market ? '#6366f1' : 'transparent';
    el.style.color = m === market ? '#fff' : '#9CA3AF';
    el.style.borderColor = m === market ? '#6366f1' : '#2A2A2A';
  });
}
// ===== TOP5 시장 선택 (일반 자동매매) =====
let _topPicksMarket = 'nasdaq';
window._topPicksMarket = _topPicksMarket;
window.setTopPicksMarket = function (market) {
  _topPicksMarket = market;
  window._topPicksMarket = market;
  const idMap = { nasdaq: 'topPicksBtnNasdaq', dow: 'topPicksBtnDow', sp500: 'topPicksBtnSp500', russell1000: 'topPicksBtnRussell' };
  Object.entries(idMap).forEach(([m, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.background = m === market ? '#6366f1' : 'transparent';
    el.style.color = m === market ? '#fff' : '#9CA3AF';
    el.style.borderColor = m === market ? '#6366f1' : '#2A2A2A';
  });
  // 시장 변경 시 자동 재조회
  if (typeof window.loadTopPicks === 'function') window.loadTopPicks();
};
// ===== 거래량/뉴스 시장 선택 (일반 자동매매) =====
let _dayMarket = 'us';
window._dayMarket = 'us';
window.setDayMarket = function (market) {
  _dayMarket = market;
  window._dayMarket = market;
  const usBtn = document.getElementById('dayMarketBtnUs');
  const krBtn = document.getElementById('dayMarketBtnKr');
  if (usBtn) { usBtn.style.background = market === 'us' ? '#16a34a' : 'transparent'; usBtn.style.color = market === 'us' ? '#fff' : '#9CA3AF'; usBtn.style.borderColor = market === 'us' ? '#16a34a' : '#2A2A2A'; }
  if (krBtn) { krBtn.style.background = market === 'kr' ? '#16a34a' : 'transparent'; krBtn.style.color = market === 'kr' ? '#fff' : '#9CA3AF'; krBtn.style.borderColor = market === 'kr' ? '#16a34a' : '#2A2A2A'; }
  // 나스닥/다우 버튼 미국일 때만 표시
  const usMarketEl = document.getElementById('topPicksUsMarket');
  if (usMarketEl) usMarketEl.style.display = market === 'us' ? 'flex' : 'none';
  // TOP5 market 연동 (한국이면 kr, 미국이면 nasdaq 기본)
  if (market === 'kr') { window._topPicksMarket = 'kr'; }
  else { window._topPicksMarket = window._topPicksMarket === 'kr' ? 'nasdaq' : (window._topPicksMarket || 'nasdaq'); }
  // TOP5 캐시 초기화 (시장 변경 시 재분석 필요)
  if (typeof _topPicksCache !== 'undefined') { _topPicksCache = null; }
  const topPicksEl = document.getElementById('topPicksList');
  if (topPicksEl) topPicksEl.innerHTML = '<div style="text-align:center;color:#6b7280;padding:24px;font-size:0.85rem;">분석 버튼을 눌러주세요 (약 10~20초 소요)</div>';
  // 자동 재조회
  loadVolumeSurge();
  loadNewsCatalyst();
};
// loadVolumeSurge / loadNewsCatalyst — market 파라미터 주입
const _origLoadVolumeSurge = typeof window.loadVolumeSurge === 'function' ? window.loadVolumeSurge : null;
window.loadVolumeSurge = async function () {
  const el = document.getElementById('volumeSurgeList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:16px;font-size:0.85rem;">⏳ 조회 중...</div>';
  try {
    const market = window._dayMarket || 'us';
    const res = await fetch(`/api/trade4/volume_surge?market=${market}`);
    const d = await res.json();
    if (!d.ok || !d.surges?.length) {
      el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:24px;font-size:0.85rem;">급등 종목 없음</div>';
      return;
    }
    el.innerHTML = d.surges.map(s => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #1E242C;">
        <span style="font-weight:800;color:#E5E7EB;">${s.symbol}</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="font-size:0.75rem;color:#f59e0b;font-weight:700;">📊 ${s.volume_ratio}x</span>
          <span style="font-size:0.75rem;color:#9CA3AF;">$${s.price?.toFixed(2) || '-'}</span>
        </div>
      </div>`).join('');
  } catch (e) {
    el.innerHTML = _safeHTML(`<div style="color:#ef4444;font-size:0.82rem;padding:8px;">오류: ${e.message}</div>`);
  }
};
const _origLoadNewsCatalyst = typeof window.loadNewsCatalyst === 'function' ? window.loadNewsCatalyst : null;
window.loadNewsCatalyst = async function () {
  const el = document.getElementById('newsCatalystList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:16px;font-size:0.85rem;">⏳ 조회 중...</div>';
  try {
    const market = window._dayMarket || 'us';
    const res = await fetch(`/api/trade4/news_catalyst?market=${market}`);
    const d = await res.json();
    if (!d.ok || !d.catalysts?.length) {
      el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:24px;font-size:0.85rem;">뉴스 촉매 없음</div>';
      return;
    }
    el.innerHTML = d.catalysts.map(c => `
      <div style="padding:8px 0;border-bottom:1px solid #1E242C;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-weight:800;color:#E5E7EB;">${c.symbol}</span>
          <span style="font-size:0.72rem;padding:2px 8px;border-radius:4px;background:#fef3c7;color:#92400e;font-weight:700;">📰 뉴스</span>
        </div>
        <div style="font-size:0.75rem;color:#9CA3AF;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.title || ''}</div>
      </div>`).join('');
  } catch (e) {
    el.innerHTML = _safeHTML(`<div style="color:#ef4444;font-size:0.82rem;padding:8px;">오류: ${e.message}</div>`);
  }
};
// ===== 완전자동매매 설정 로드/저장 =====
async function loadAutoStrategySettings() {
  try {
    const _bkId3 = window.selectedAccountId || window.activeAccountId || '';
    const res = await fetch(`/api/trade3/settings${_bkId3 ? '?broker_key_id=' + _bkId3 : ''}`);
    if (!res.ok) return;
    const d = await res.json();
    if (!d.ok) return;
    const s = d.settings;
    document.getElementById('asRoeMin').value = s.roe_min ?? 15;
    document.getElementById('asDebtMax').value = s.debt_max ?? 100;
    document.getElementById('asRevenueMin').value = s.revenue_min ?? 10;
    document.getElementById('asMomentumTop').value = s.momentum_top ?? 30;
    document.getElementById('asSma200Filter').checked = s.sma200_filter ?? true;
    document.getElementById('asUseMacd').checked = s.use_macd ?? true;
    document.getElementById('asUseRsi').checked = s.use_rsi ?? true;
    document.getElementById('asRsiThreshold').value = s.rsi_threshold ?? 35;
    document.getElementById('asUseBb').checked = s.use_bb ?? true;
    document.getElementById('asBalanceRatio').value = Math.round((s.balance_ratio ?? 0.2) * 100);
    document.getElementById('asMaxPositions').value = s.max_positions ?? 5;
    document.getElementById('asTakeProfit1').value = Math.round((s.take_profit1 ?? 0.1) * 100);
    document.getElementById('asTakeProfit2').value = Math.round((s.take_profit2 ?? 0.2) * 100);
    document.getElementById('asStopLoss').value = Math.round((s.stop_loss ?? 0.05) * 100);
    document.getElementById('asFactorExit').checked = s.factor_exit ?? true;
    document.getElementById('asSma200Exit').checked = s.sma200_exit ?? true;
    if (s.market) { _autoMarket = s.market; setAutoMarket(s.market); }
    // 활성화 상태
    const active = !!s.enabled;
    const tog = document.getElementById('asToggleBtn');
    const knob = document.getElementById('asToggleKnob');
    const status = document.getElementById('autoStrategyStatus');
    tog.dataset.active = active ? '1' : '0';
    tog.style.background = active ? '#6366f1' : '#d1d5db';
    knob.style.left = active ? '26px' : '2px';
    status.textContent = active ? '✅ 활성' : '⏹ 비활성';
    status.style.background = active ? '#312e81' : '#334155';
    status.style.color = active ? '#c7d2fe' : '#94a3b8';
  } catch (e) { }
}
window.saveAutoStrategy = async function () {
  try {
    const body = {
      market: _autoMarket,
      roe_min: parseFloat(document.getElementById('asRoeMin').value),
      debt_max: parseFloat(document.getElementById('asDebtMax').value),
      revenue_min: parseFloat(document.getElementById('asRevenueMin').value),
      momentum_top: parseFloat(document.getElementById('asMomentumTop').value),
      sma200_filter: document.getElementById('asSma200Filter').checked,
      use_macd: document.getElementById('asUseMacd').checked,
      use_rsi: document.getElementById('asUseRsi').checked,
      rsi_threshold: parseFloat(document.getElementById('asRsiThreshold').value),
      use_bb: document.getElementById('asUseBb').checked,
      balance_ratio: parseFloat(document.getElementById('asBalanceRatio').value) / 100,
      max_positions: parseInt(document.getElementById('asMaxPositions').value),
      take_profit1: parseFloat(document.getElementById('asTakeProfit1').value) / 100,
      take_profit2: parseFloat(document.getElementById('asTakeProfit2').value) / 100,
      stop_loss: parseFloat(document.getElementById('asStopLoss').value) / 100,
      factor_exit: document.getElementById('asFactorExit').checked,
      sma200_exit: document.getElementById('asSma200Exit').checked,
      broker_key_id: window.selectedAccountId || window.activeAccountId || null,
    };
    const res = await fetch('/api/trade3/settings_save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const d = await res.json();
    if (d.ok) await spAlert('✅', '저장 완료', '완전자동매매 전략이 저장됐어요!');
  } catch (e) { await spAlert('❌', '저장 오류', e.message); }
};
// ===== 활성화 토글 =====
window.toggleAutoStrategy = async function () {
  const tog = document.getElementById('asToggleBtn');
  const knob = document.getElementById('asToggleKnob');
  const status = document.getElementById('autoStrategyStatus');
  const active = tog.dataset.active === '1';
  const next = !active;
  if (next) {
    const ok = await spConfirm('🤖', '완전자동매매 활성화', '활성화하면 미국 장 시간마다 자동으로 매수/매도가 실행돼요.\n전략 설정을 먼저 저장했는지 확인하세요!', '활성화', '#6366f1');
    if (!ok) return;
  }
  try {
    const res = await fetch('/api/trade3/toggle', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: next, broker_key_id: window.selectedAccountId || window.activeAccountId || null })
    });
    const d = await res.json();
    if (d.ok) {
      tog.dataset.active = next ? '1' : '0';
      tog.style.background = next ? '#6366f1' : '#d1d5db';
      knob.style.left = next ? '26px' : '2px';
      status.textContent = next ? '✅ 활성' : '⏹ 비활성';
      status.style.background = next ? '#312e81' : '#334155';
      status.style.color = next ? '#c7d2fe' : '#94a3b8';
    }
  } catch (e) { await spAlert('❌', '오류', e.message); }
};
// ===== 스크리닝 실행 =====
window.runAutoStrategyScreen = async function () {
  const el = document.getElementById('asScreenResult');
  const cnt = document.getElementById('asScreenedCount');
  el.innerHTML = '<div style="text-align:center;color:#9CA3AF;padding:20px;font-size:0.85rem;">🔍 팩터 스크리닝 중... (1~2분 소요)</div>';
  try {
    const roeMin = parseFloat(document.getElementById('asRoeMin').value);
    const debtMax = parseFloat(document.getElementById('asDebtMax').value);
    const revMin = parseFloat(document.getElementById('asRevenueMin').value);
    const momTop = parseFloat(document.getElementById('asMomentumTop').value);
    const sma200 = document.getElementById('asSma200Filter').checked;
    const asTopN = parseInt(document.getElementById('asTopN')?.value || '10');
    const asFinalN = parseInt(document.getElementById('asFinalN')?.value || '3');
    const asSignal = document.getElementById('asSignalFilter')?.value || 'all';
    const asScore = document.getElementById('asScoreMode')?.value || 'combined';
    const res = await fetch('/proxy/quant/api/quant/factor-screen', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy: 'momentum_ma', market: _autoMarket, top_n: asTopN, final_n: asFinalN, signal_filter: asSignal, score_mode: asScore })
    });
    const d = await res.json();
    if (!d.ok || !d.top?.length) { el.innerHTML = '<div style="padding:12px;color:#9CA3AF;font-size:0.85rem;">조건 충족 종목 없음</div>'; return; }
    const filtered = d.top.filter(item => {
      if (item.roe && item.roe < roeMin) return false;
      if (item.debt_to_equity && item.debt_to_equity > debtMax) return false;
      if (item.revenue_growth && item.revenue_growth < revMin) return false;
      if (sma200 && item.above_sma200 === 0) return false;
      return true;
    });
    // finalN 적용 + 신호필터 적용
    let finalFiltered = filtered;
    if (asSignal === 'buy') finalFiltered = finalFiltered.filter(item => item.timing === 'BUY');
    if (asScore === 'technical') finalFiltered = [...finalFiltered].sort((a, b) => (b.tech_score || 0) - (a.tech_score || 0));
    else if (asScore === 'factor') finalFiltered = [...finalFiltered].sort((a, b) => (b.factor_score || 0) - (a.factor_score || 0));
    finalFiltered = finalFiltered.slice(0, asFinalN);
    cnt.textContent = `${d.screened}개 → ${finalFiltered.length}개`;
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const rows = finalFiltered.map((item, i) => `
    <div style="padding:10px 12px;background:${i === 0 ? 'rgba(99,102,241,0.1)' : '#1E242C'};border-radius:8px;border:1px solid ${i === 0 ? '#6366f1' : '#2A2A2A'};margin-bottom:6px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <div>
          <span style="font-weight:800;font-size:0.95rem;color:#E5E7EB;">${medals[i]} ${item.symbol}</span>
          <span style="margin-left:6px;font-size:0.68rem;padding:1px 6px;border-radius:999px;background:${item.above_sma200 ? '#dcfce7' : '#fee2e2'};color:${item.above_sma200 ? '#166534' : '#991b1b'};font-weight:700;">${item.above_sma200 ? '▲ 200일선 위' : '▼ 200일선 아래'}</span>
        </div>
        <div style="text-align:right;font-size:0.78rem;">
          <span style="font-weight:700;color:#E5E7EB;">$${item.price?.toFixed(2) ?? '-'}</span>
          <span style="color:#6366f1;margin-left:6px;">점수 ${item.factor_score}</span>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:0.7rem;color:#9CA3AF;">
        ${item.roe ? `<span style="background:rgba(99,102,241,0.2);color:#a5b4fc;padding:1px 6px;border-radius:999px;">ROE ${item.roe}%</span>` : ''}
        ${item.debt_to_equity != null ? `<span style="background:rgba(255,214,10,0.12);color:#92400e;padding:1px 6px;border-radius:999px;">부채 ${item.debt_to_equity}%</span>` : ''}
        ${item.revenue_growth ? `<span style="background:rgba(255,59,48,0.15);color:#166534;padding:1px 6px;border-radius:999px;">매출성장 ${item.revenue_growth}%</span>` : ''}
        ${item.momentum_6m != null ? `<span style="background:rgba(30,123,255,0.08);color:#0369a1;padding:1px 6px;border-radius:999px;">6M ${item.momentum_6m > 0 ? '+' : ''}${item.momentum_6m}%</span>` : ''}
        ${item.news_label && item.news_label !== '뉴스없음' ? `<span style="padding:1px 6px;border-radius:999px;background:${item.news_score > 0.3 ? '#dcfce7' : item.news_score < -0.3 ? '#fee2e2' : '#f1f5f9'};color:${item.news_score > 0.3 ? '#166534' : item.news_score < -0.3 ? '#991b1b' : '#6b7280'};">${item.news_label} ${item.news_count}건</span>` : ''}
        ${item.macro_risk < -1 ? `<span style="padding:1px 6px;border-radius:999px;background:rgba(30,123,255,0.15);color:#991b1b;font-weight:700;">⚠️ 거시악재</span>` : ''}
      </div>
      <button onclick="saveAutoSymbol(${_jsAttr(item.symbol)}, ${item.score || 0})" style="margin-top:8px;width:100%;padding:5px;border-radius:6px;border:none;background:#16a34a;color:#fff;font-size:0.75rem;font-weight:700;cursor:pointer;">💾 ${item.symbol} 저장</button>
    </div>`).join('');
    const marketNames = { 'nasdaq': '나스닥100', 'dow': '다우존스30', 'sp500': 'S&P500', 'russell1000': 'Russell1000' };
    const marketLabel = marketNames[_autoMarket] || _autoMarket;
    el.innerHTML = _safeHTML(`<div style="font-size:0.75rem;color:#9CA3AF;margin-bottom:8px;">${marketLabel} · ${d.screened}개 → TOP${asFinalN} (${asScore === 'combined' ? '복합점수' : asScore === 'factor' ? '팩터점수' : '기술점수'} · ${asSignal === 'buy' ? 'BUY만' : 'BUY+WATCH'})</div>${rows}`);
    // 스크리닝 후 저장된 종목 새로고침
    setTimeout(() => { if (typeof renderAutoSavedSymbols === 'function') renderAutoSavedSymbols(); }, 300);
  } catch (e) { el.innerHTML = _safeHTML(`<div style="color:#ef4444;font-size:0.85rem;">오류: ${e.message}</div>`); }
};
