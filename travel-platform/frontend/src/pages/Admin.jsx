import React, { useState, useEffect } from 'react';
import { api } from '../api';
import TransitRoutesAdmin from './TransitRoutesAdmin';
import AdminMyTripLog from '../components/AdminMyTripLog';

const S = {
  wrap: { minHeight: '100vh', background: '#f5f6f8', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  app: { display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh' },
  sidebar: { background: '#1a1a2e', padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: 4, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' },
  logo: { fontSize: 15, fontWeight: 900, color: 'white', padding: '4px 12px 20px', letterSpacing: -0.5 },
  navItem: (active) => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, color: active ? 'white' : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: active ? 700 : 500, background: active ? '#4f46e5' : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }),
  main: { padding: 28, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 },
  pageTitle: { fontSize: 20, fontWeight: 800, color: '#1a1a2e' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 },
  statCard: { background: 'white', border: '1px solid #eee', borderRadius: 16, padding: '18px 20px' },
  statNum: (color) => ({ fontSize: 26, fontWeight: 900, color, margin: '6px 0 2px' }),
  statLabel: { fontSize: 12, color: '#9ca3af', fontWeight: 600 },
  tableWrap: { background: 'white', border: '1px solid #eee', borderRadius: 16, overflow: 'hidden' },
  tableHeader: { padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  tableTitle: { fontSize: 15, fontWeight: 700, color: '#1a1a2e' },
  th: { padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#fafafa', borderBottom: '1px solid #eee' },
  td: { padding: '12px 16px', fontSize: 13, color: '#374151', borderBottom: '1px solid #f9fafb', verticalAlign: 'middle' },
  badge: (type) => {
    const s = { green: { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }, red: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }, gray: { background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }, yellow: { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }, blue: { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' } };
    return { ...(s[type] || s.gray), display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 };
  },
  btn: (type) => {
    const s = { primary: { background: '#4f46e5', color: 'white', border: 'none' }, danger: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }, warning: { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }, gray: { background: '#f3f4f6', color: '#555', border: '1px solid #eee' }, green: { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' } };
    return { ...(s[type] || s.gray), padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' };
  },
  input: { padding: '9px 14px', border: '1px solid #eee', borderRadius: 10, fontSize: 13, outline: 'none', background: 'white', color: '#1a1a2e' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  modal: { background: 'white', borderRadius: 20, padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' },
  toast: (type) => ({ position: 'fixed', bottom: 24, right: 24, background: type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#1a1a2e', color: 'white', padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600, zIndex: 2000 }),
  loginWrap: { minHeight: '100vh', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  loginBox: { background: 'white', borderRadius: 20, padding: 40, width: '100%', maxWidth: 380 },
};

const NAV = [
  { key: 'dashboard', icon: '📊', label: '대시보드' },
  { key: 'users', icon: '👥', label: '회원 관리' },
  { key: 'posts', icon: '📝', label: '게시물 관리' },
  { key: 'reports', icon: '🚨', label: '신고 관리' },
  { key: 'notices', icon: '📢', label: '공지사항' },
  { key: 'promotions', icon: '📣', label: '프로모션' },
  { key: 'menus', icon: '🗂️', label: '메뉴 관리' },
  { key: 'ads', icon: '📢', label: '광고 관리' },
  { key: 'business', icon: '🏢', label: '비즈니스/오피셜' },
  { key: 'transit', icon: '✈️', label: '교통 노선 관리' },
  { key: 'mytriplog', icon: '📱', label: 'My Trip Log' },
];

export default function Admin() {
  const [token, setToken] = useState(sessionStorage.getItem('admin_token') || '');
  const [page, setPage] = useState('dashboard');

  // ── 광고 관리 ──
  const [adsList, setAdsList] = useState([]);
  const [adAdvertisers, setAdAdvertisers] = useState([]);
  const [adsLoading, setAdsLoading] = useState(false);

  const loadAds = async () => {
    setAdsLoading(true);
    try {
      const [adsRes, advRes] = await Promise.all([
        fetch('/api/ads'),
        fetch('/api/advertisers')
      ]);
      setAdsList(await adsRes.json());
      setAdAdvertisers(await advRes.json());
    } catch(e) {}
    setAdsLoading(false);
  };

  const updateAdStatus = async (adId, status, reason = '') => {
    await fetch('/api/ads/' + adId + '/status?status=' + status + '&reject_reason=' + encodeURIComponent(reason), { method: 'PUT' });
    loadAds();
  };

  useEffect(() => { if (page === 'ads' && token) loadAds(); }, [page]);

  // ── 비즈니스/오피셜 관리 ──
  const [bizAccounts, setBizAccounts] = useState([]);
  const [bizLoading, setBizLoading] = useState(false);

  const loadBizAccounts = async () => {
    setBizLoading(true);
    try {
      const res = await fetch('/api/business');
      setBizAccounts(await res.json());
    } catch(e) {}
    setBizLoading(false);
  };

  const approveBiz = async (userId, badgeType) => {
    await fetch('/api/business/' + userId + '/approve?badge_type=' + badgeType, { method: 'PUT' });
    loadBizAccounts();
  };

  const rejectBiz = async (userId) => {
    const reason = prompt('거절 사유:');
    if (!reason) return;
    await fetch('/api/business/' + userId + '/reject?reason=' + encodeURIComponent(reason), { method: 'PUT' });
    loadBizAccounts();
  };

  const grantOfficial = async (userId) => {
    if (!confirm('이 계정에 공식(Official) 배지를 부여합니까?')) return;
    await fetch('/api/business/' + userId + '/official', { method: 'PUT' });
    loadBizAccounts();
  };

  const changeBadge = async (userId, badgeType) => {
    await fetch('/api/business/' + userId + '/badge?badge_type=' + badgeType, { method: 'PUT' });
    loadBizAccounts();
  };

  useEffect(() => { if (page === 'business' && token) loadBizAccounts(); }, [page]);




  const [userStats, setUserStats] = useState(null);
  const [postStats, setPostStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [reports, setReports] = useState([]);
  const [notices, setNotices] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [editPromo, setEditPromo] = useState(null); // 수정 중인 프로모션
  const [promoForm, setPromoForm] = useState({ title: '', content: '', imageUrl: '', linkUrl: '', linkLabel: '자세히 보기', type: 'notice', insertEvery: 5, priority: 0, active: true });

  const [menuItems, setMenuItems] = useState([]);
  const [menuSaving, setMenuSaving] = useState(false);
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showResetPw, setShowResetPw] = useState(null);
  const [showNoticeForm, setShowNoticeForm] = useState(false);
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '', type: 'info' });
  const [newPw, setNewPw] = useState('');
  const [toast, setToast] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginErr, setLoginErr] = useState('');
  const [pendingReports, setPendingReports] = useState(0);

  const apiFetch = async (path, options = {}) => {
    const res = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, ...(options.headers || {}) }
    });
    if (res.status === 401) { setToken(''); sessionStorage.removeItem('admin_token'); return null; }
    return res;
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (token) { loadUserStats(); loadPostStats(); loadPendingReports(); }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (page === 'users') loadUsers(1);
    if (page === 'posts') loadPosts();
    if (page === 'reports') loadReports();
    if (page === 'notices') loadNotices();
    if (page === 'promotions') loadPromotions();
    if (page === 'menus') loadMenus();
  }, [page, token]);

  const loadUserStats = async () => {
    const res = await apiFetch('/api/admin/stats');
    if (res?.ok) setUserStats(await res.json());
  };

  const loadPostStats = async () => {
    const res = await apiFetch('/api/admin/stats/posts');
    if (res?.ok) setPostStats(await res.json());
  };

  const loadPendingReports = async () => {
    const res = await apiFetch('/api/reports?status=pending');
    if (res?.ok) { const d = await res.json(); setPendingReports(d.length); }
  };

  const loadUsers = async (p = 1) => {
    setCurrentPage(p);
    const res = await apiFetch(`/api/admin/users?page=${p}&limit=15&search=${encodeURIComponent(search)}`);
    if (res?.ok) { const d = await res.json(); setUsers(d.users || []); setTotalUsers(d.total || 0); }
  };

  const loadPosts = async () => {
    const res = await apiFetch('/api/posts');
    if (res?.ok) setPosts(await res.json());
  };

  const loadReports = async () => {
    const res = await apiFetch('/api/reports');
    if (res?.ok) setReports(await res.json());
  };

  const loadNotices = async () => {
    const res = await apiFetch('/api/notices');
    if (res?.ok) setNotices(await res.json());
  };

  const loadPromotions = async () => {
    const res = await apiFetch('/api/promotions?all=true');
    if (res?.ok) setPromotions(await res.json());
  };

  const loadMenus = async () => {
    const res = await apiFetch('/api/menus');
    if (res?.ok) {
      const data = await res.json();
      setMenuItems(data.sort((a, b) => a.sortOrder - b.sortOrder));
    }
  };

  const saveMenus = async () => {
    setMenuSaving(true);
    const res = await apiFetch('/api/menus', { method: 'POST', body: JSON.stringify(menuItems) });
    if (res?.ok) showToast('메뉴 설정이 저장됐습니다.');
    setMenuSaving(false);
  };

  const moveMenu = (idx, dir) => {
    const items = [...menuItems];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    [items[idx], items[swapIdx]] = [items[swapIdx], items[idx]];
    items.forEach((m, i) => { m.sortOrder = i; });
    setMenuItems([...items]);
  };

  const toggleMenuVisible = (key) => {
    setMenuItems(prev => prev.map(m => m.key === key ? { ...m, visible: !m.visible } : m));
  };

  const updateMenuLabel = (key, label) => {
    setMenuItems(prev => prev.map(m => m.key === key ? { ...m, label } : m));
  };

  const updateMenuIcon = (key, icon) => {
    setMenuItems(prev => prev.map(m => m.key === key ? { ...m, icon } : m));
  };

  const savePromotion = async () => {
    if (!promoForm.title.trim() || !promoForm.content.trim()) { showToast('제목과 내용을 입력해주세요.', 'error'); return; }
    const body = { ...promoForm, insertEvery: Number(promoForm.insertEvery), priority: Number(promoForm.priority) };
    let res;
    if (editPromo) {
      res = await apiFetch(`/api/promotions/${editPromo.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    } else {
      res = await apiFetch('/api/promotions', { method: 'POST', body: JSON.stringify(body) });
    }
    if (res?.ok) {
      showToast(editPromo ? '수정됐습니다.' : '프로모션이 등록됐습니다.');
      setShowPromoForm(false);
      setEditPromo(null);
      setPromoForm({ title: '', content: '', imageUrl: '', linkUrl: '', linkLabel: '자세히 보기', type: 'notice', insertEvery: 5, priority: 0, active: true });
      loadPromotions();
    }
  };

  const togglePromo = async (promo) => {
    const res = await apiFetch(`/api/promotions/${promo.id}`, { method: 'PATCH', body: JSON.stringify({ ...promo, active: !promo.active }) });
    if (res?.ok) { showToast(promo.active ? '비활성화됐습니다.' : '활성화됐습니다.'); loadPromotions(); }
  };

  const deletePromo = async (id) => {
    if (!confirm('프로모션을 삭제할까요?')) return;
    const res = await apiFetch(`/api/promotions/${id}`, { method: 'DELETE' });
    if (res?.ok) { showToast('삭제됐습니다.'); loadPromotions(); }
  };

  const adminLogin = async () => {
    setLoginErr('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (res.ok) { setToken(data.token); sessionStorage.setItem('admin_token', data.token); }
      else setLoginErr(data.detail || '로그인 실패');
    } catch { setLoginErr('서버 연결 오류'); }
  };

  const toggleSuspend = async () => {
    if (!selectedUser) return;
    const res = await apiFetch(`/api/admin/users/${selectedUser.id}`, {
      method: 'PATCH', body: JSON.stringify({ suspended: !selectedUser.suspended })
    });
    if (res?.ok) { showToast(selectedUser.suspended ? '정지 해제됐습니다.' : '계정이 정지됐습니다.'); setSelectedUser(null); loadUsers(currentPage); loadUserStats(); }
  };

  const deleteUser = async () => {
    if (!selectedUser || !confirm(`${selectedUser.nickname} 회원을 탈퇴 처리하시겠습니까?`)) return;
    const res = await apiFetch(`/api/admin/users/${selectedUser.id}`, { method: 'DELETE' });
    if (res?.ok) { showToast('탈퇴 처리됐습니다.'); setSelectedUser(null); loadUsers(currentPage); loadUserStats(); }
  };

  const resetPassword = async () => {
    if (!newPw || newPw.length < 8) { showToast('8자 이상 입력해주세요.', 'error'); return; }
    const res = await apiFetch(`/api/admin/users/${showResetPw}/reset-password`, {
      method: 'POST', body: JSON.stringify({ newPassword: newPw })
    });
    if (res?.ok) { showToast('비밀번호가 초기화됐습니다.'); setShowResetPw(null); setNewPw(''); }
  };

  const hidePost = async (postId) => {
    if (!confirm('게시물을 비공개 처리하시겠습니까?')) return;
    const res = await apiFetch(`/api/admin/posts/${postId}/hide`, { method: 'POST' });
    if (res?.ok) { showToast('비공개 처리됐습니다.'); loadPosts(); }
  };

  const deletePost = async (postId) => {
    if (!confirm('게시물을 삭제하시겠습니까? 복구할 수 없습니다.')) return;
    const res = await apiFetch(`/api/admin/posts/${postId}`, { method: 'DELETE' });
    if (res?.ok) { showToast('게시물이 삭제됐습니다.'); loadPosts(); }
  };

  const resolveReport = async (id, action) => {
    const res = await apiFetch(`/api/reports/${id}/resolve`, {
      method: 'POST', body: JSON.stringify({ action })
    });
    if (res?.ok) { showToast(action === 'resolved' ? '처리 완료됐습니다.' : '무시됐습니다.'); loadReports(); loadPendingReports(); }
  };

  const saveNotice = async () => {
    if (!noticeForm.title || !noticeForm.content) { showToast('제목과 내용을 입력해주세요.', 'error'); return; }
    const res = await apiFetch('/api/notices', {
      method: 'POST', body: JSON.stringify(noticeForm)
    });
    if (res?.ok) { showToast('공지사항이 등록됐습니다.'); setShowNoticeForm(false); setNoticeForm({ title: '', content: '', type: 'info' }); loadNotices(); }
  };

  const toggleNotice = async (notice) => {
    const res = await apiFetch(`/api/notices/${notice.id}`, {
      method: 'PATCH', body: JSON.stringify({ ...notice, active: !notice.active })
    });
    if (res?.ok) { showToast(notice.active ? '비활성화됐습니다.' : '활성화됐습니다.'); loadNotices(); }
  };

  const deleteNotice = async (id) => {
    if (!confirm('공지사항을 삭제하시겠습니까?')) return;
    const res = await apiFetch(`/api/notices/${id}`, { method: 'DELETE' });
    if (res?.ok) { showToast('삭제됐습니다.'); loadNotices(); }
  };

  const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString('ko-KR') : '-';
  const maskEmail = (e) => { if (!e) return '-'; const [id, d] = e.split('@'); return id.slice(0,3) + '***@' + d; };

  if (!token) return (
    <div style={S.loginWrap}>
      <div style={S.loginBox}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#4f46e5', marginBottom: 6 }}>✈ Travellog</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 28 }}>관리자 로그인</div>
        {loginErr && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{loginErr}</div>}
        <input style={{ ...S.input, width: '100%', marginBottom: 10 }} placeholder="관리자 아이디"
          value={loginForm.username} onChange={e => setLoginForm(p => ({ ...p, username: e.target.value }))} />
        <input style={{ ...S.input, width: '100%', marginBottom: 16 }} type="password" placeholder="관리자 비밀번호"
          value={loginForm.password} onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && adminLogin()} />
        <button onClick={adminLogin} style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>로그인</button>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button onClick={() => window.location.href = '/'} style={{ fontSize: 13, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>← 사이트로 돌아가기</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={S.wrap}>
      <div style={S.app}>
        <aside style={S.sidebar}>
          <div style={S.logo}>✈ Travellog <span style={{ fontSize: 10, color: '#818cf8' }}>Admin</span></div>
          {NAV.map(n => (
            <div key={n.key} style={S.navItem(page === n.key)} onClick={() => setPage(n.key)}>
              <span>{n.icon}</span>
              <span>{n.label}</span>
              {n.key === 'reports' && pendingReports > 0 && (
                <span style={{ marginLeft: 'auto', background: '#ef4444', color: 'white', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>{pendingReports}</span>
              )}
            </div>
          ))}
          <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }} onClick={() => window.location.href = '/'}>← 사이트로</div>
            <div style={{ padding: '10px 14px', color: '#ef4444', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
              onClick={() => { setToken(''); sessionStorage.removeItem('admin_token'); }}>로그아웃</div>
          </div>
        </aside>

        <main style={S.main}>

          {/* 대시보드 */}
          {page === 'dashboard' && (
            <>
              <div style={S.pageTitle}>대시보드</div>
              <div style={S.statsGrid}>
                {[
                  { label: '전체 회원', num: userStats?.total_users ?? '-', color: '#4f46e5' },
                  { label: '오늘 가입', num: userStats?.today_joined ?? '-', color: '#10b981' },
                  { label: '정지 계정', num: userStats?.suspended_users ?? '-', color: '#ef4444' },
                  { label: '전체 게시물', num: postStats?.totalPosts ?? '-', color: '#f59e0b' },
                  { label: '공개 게시물', num: postStats?.publicPosts ?? '-', color: '#6366f1' },
                  { label: '총 좋아요', num: postStats?.totalLikes ?? '-', color: '#ec4899' },
                  { label: '대기 신고', num: pendingReports, color: '#dc2626' },
                  { label: '마케팅 동의', num: userStats?.marketing_agree ?? '-', color: '#059669' },
                ].map(s => (
                  <div key={s.label} style={S.statCard}>
                    <div style={S.statLabel}>{s.label}</div>
                    <div style={S.statNum(s.color)}>{s.num?.toLocaleString?.() ?? s.num}</div>
                  </div>
                ))}
              </div>

              {/* 인기 태그 */}
              {postStats?.topTags?.length > 0 && (
                <div style={S.tableWrap}>
                  <div style={S.tableHeader}><div style={S.tableTitle}>인기 태그 TOP 10</div></div>
                  <div style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {postStats.topTags.map((t, i) => (
                      <div key={t.tag} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 20, padding: '5px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af' }}>#{i+1}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5' }}>#{t.tag}</span>
                        <span style={{ fontSize: 12, color: '#6366f1' }}>{t.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 국가별 분포 */}
              {postStats?.countryStats?.length > 0 && (
                <div style={S.tableWrap}>
                  <div style={S.tableHeader}><div style={S.tableTitle}>국가별 게시물</div></div>
                  <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {postStats.countryStats.map(([country, count]) => {
                      const max = postStats.countryStats[0][1];
                      return (
                        <div key={country} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 70, fontSize: 13, fontWeight: 600, color: '#374151' }}>{country}</div>
                          <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                            <div style={{ width: `${(count/max)*100}%`, height: '100%', background: '#4f46e5', borderRadius: 6 }} />
                          </div>
                          <div style={{ width: 30, fontSize: 12, color: '#9ca3af', textAlign: 'right' }}>{count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 인기 게시물 TOP 10 */}
              {postStats?.topPosts?.length > 0 && (
                <div style={S.tableWrap}>
                  <div style={S.tableHeader}><div style={S.tableTitle}>인기 게시물 TOP 10 ❤️</div></div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>
                      {['#', '제목', '작성자', '국가', '좋아요'].map(h => <th key={h} style={S.th}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {postStats.topPosts.map((p, i) => (
                        <tr key={p.id}>
                          <td style={{ ...S.td, fontWeight: 700, color: '#4f46e5' }}>{i+1}</td>
                          <td style={{ ...S.td, maxWidth: 200 }}><div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div></td>
                          <td style={{ ...S.td, color: '#6b7280' }}>{p.userNickname}</td>
                          <td style={S.td}>{p.country || '-'}</td>
                          <td style={{ ...S.td, color: '#ef4444', fontWeight: 700 }}>❤️ {p.likedUserIds?.length || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* 회원 관리 */}
          {page === 'users' && (
            <>
              <div style={S.pageTitle}>회원 관리</div>
              <div style={S.tableWrap}>
                <div style={S.tableHeader}>
                  <div style={S.tableTitle}>전체 회원 <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>({totalUsers}명)</span></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={{ ...S.input, width: 220 }} placeholder="닉네임 또는 이메일 검색"
                      value={search} onChange={e => setSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && loadUsers(1)} />
                    <button style={S.btn('primary')} onClick={() => loadUsers(1)}>검색</button>
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {['회원', '이메일', '가입일', '최근 로그인', '상태', '관리'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#bbb', padding: 24 }}>회원이 없습니다.</td></tr>
                    ) : users.map(u => (
                      <tr key={u.id}>
                        <td style={S.td}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#4f46e5', flexShrink: 0 }}>{u.nickname?.[0]}</div>
                          <div><div style={{ fontWeight: 600 }}>{u.nickname}</div><div style={{ fontSize: 11, color: '#9ca3af' }}>{u.id?.slice(0,8)}...</div></div>
                        </div></td>
                        <td style={{ ...S.td, color: '#6b7280' }}>{maskEmail(u.email)}</td>
                        <td style={{ ...S.td, color: '#9ca3af' }}>{fmtDate(u.createdAt)}</td>
                        <td style={{ ...S.td, color: '#9ca3af' }}>{u.lastLogin ? fmtDate(u.lastLogin) : '-'}</td>
                        <td style={S.td}><span style={S.badge(u.suspended ? 'red' : 'green')}>{u.suspended ? '정지' : '정상'}</span></td>
                        <td style={S.td}><div style={{ display: 'flex', gap: 5 }}>
                          <button style={S.btn('gray')} onClick={() => setSelectedUser(u)}>상세</button>
                          <button style={S.btn('warning')} onClick={() => { setShowResetPw(u.id); setNewPw(''); }}>PW</button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: 'flex', gap: 6, padding: '14px 20px', borderTop: '1px solid #eee', flexWrap: 'wrap' }}>
                  {Array.from({ length: Math.ceil(totalUsers / 15) }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => loadUsers(p)}
                      style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #eee', background: p === currentPage ? '#4f46e5' : 'white', color: p === currentPage ? 'white' : '#555', fontSize: 13, cursor: 'pointer' }}>{p}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 게시물 관리 */}
          {page === 'posts' && (
            <>
              <div style={S.pageTitle}>게시물 관리</div>
              <div style={S.tableWrap}>
                <div style={S.tableHeader}>
                  <div style={S.tableTitle}>전체 게시물 <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>({posts.length}개)</span></div>
                  <button style={S.btn('primary')} onClick={loadPosts}>새로고침</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {['제목', '작성자', '국가', '공개', '좋아요', '댓글', '관리'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {posts.length === 0 ? (
                      <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#bbb', padding: 24 }}>게시물이 없습니다.</td></tr>
                    ) : posts.map(p => (
                      <tr key={p.id}>
                        <td style={{ ...S.td, maxWidth: 200 }}><div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>{p.title}</div></td>
                        <td style={{ ...S.td, color: '#6b7280' }}>{p.userNickname}</td>
                        <td style={S.td}>{p.country || '-'}</td>
                        <td style={S.td}><span style={S.badge(p.visibility === 'public' ? 'green' : 'gray')}>{p.visibility === 'public' ? '공개' : '비공개'}</span></td>
                        <td style={{ ...S.td, color: '#ef4444' }}>❤️ {p.likedUserIds?.length || 0}</td>
                        <td style={{ ...S.td, color: '#6b7280' }}>💬 {p.comments?.length || 0}</td>
                        <td style={S.td}><div style={{ display: 'flex', gap: 5 }}>
                          {p.visibility === 'public' && <button style={S.btn('warning')} onClick={() => hidePost(p.id)}>비공개</button>}
                          <button style={S.btn('danger')} onClick={() => deletePost(p.id)}>삭제</button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* 신고 관리 */}
          {page === 'reports' && (
            <>
              <div style={S.pageTitle}>신고 관리</div>
              <div style={S.tableWrap}>
                <div style={S.tableHeader}>
                  <div style={S.tableTitle}>신고 목록 <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>({reports.length}건)</span></div>
                  <button style={S.btn('primary')} onClick={loadReports}>새로고침</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {['신고자', '대상', '사유', '신고일', '상태', '처리'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {reports.length === 0 ? (
                      <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#bbb', padding: 24 }}>신고가 없습니다.</td></tr>
                    ) : reports.map(r => (
                      <tr key={r.id}>
                        <td style={{ ...S.td, color: '#6b7280' }}>{r.reporterNickname}</td>
                        <td style={{ ...S.td, maxWidth: 180 }}><div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.targetContent}</div></td>
                        <td style={S.td}>{r.reason}</td>
                        <td style={{ ...S.td, color: '#9ca3af' }}>{fmtDate(r.createdAt)}</td>
                        <td style={S.td}><span style={S.badge(r.status === 'pending' ? 'yellow' : r.status === 'resolved' ? 'green' : 'gray')}>{r.status === 'pending' ? '대기' : r.status === 'resolved' ? '처리됨' : '무시됨'}</span></td>
                        <td style={S.td}>{r.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button style={S.btn('danger')} onClick={() => resolveReport(r.id, 'resolved')}>처리</button>
                            <button style={S.btn('gray')} onClick={() => resolveReport(r.id, 'dismissed')}>무시</button>
                          </div>
                        )}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* 공지사항 */}
          {page === 'notices' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={S.pageTitle}>공지사항</div>
                <button style={S.btn('primary')} onClick={() => setShowNoticeForm(true)}>+ 공지 등록</button>
              </div>
              <div style={S.tableWrap}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {['제목', '내용', '유형', '상태', '등록일', '관리'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {notices.length === 0 ? (
                      <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#bbb', padding: 24 }}>공지사항이 없습니다.</td></tr>
                    ) : notices.map(n => (
                      <tr key={n.id}>
                        <td style={{ ...S.td, fontWeight: 600 }}>{n.title}</td>
                        <td style={{ ...S.td, color: '#6b7280', maxWidth: 200 }}><div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.content}</div></td>
                        <td style={S.td}><span style={S.badge(n.type === 'warning' ? 'yellow' : n.type === 'event' ? 'green' : 'blue')}>{n.type === 'info' ? '정보' : n.type === 'warning' ? '경고' : '이벤트'}</span></td>
                        <td style={S.td}><span style={S.badge(n.active ? 'green' : 'gray')}>{n.active ? '활성' : '비활성'}</span></td>
                        <td style={{ ...S.td, color: '#9ca3af' }}>{fmtDate(n.createdAt)}</td>
                        <td style={S.td}><div style={{ display: 'flex', gap: 5 }}>
                          <button style={S.btn(n.active ? 'gray' : 'green')} onClick={() => toggleNotice(n)}>{n.active ? '비활성화' : '활성화'}</button>
                          <button style={S.btn('danger')} onClick={() => deleteNotice(n.id)}>삭제</button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── 프로모션 관리 ── */}
          {page === 'promotions' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={S.pageTitle}>📣 프로모션 메뉴 관리</div>
                <button style={S.btn('primary')} onClick={() => { setShowPromoForm(true); setEditPromo(null); setPromoForm({ title: '', content: '', imageUrl: '', linkUrl: '', linkLabel: '자세히 보기', type: 'notice', insertEvery: 5, priority: 0, active: true }); }}>+ 메뉴 등록</button>
              </div>

              {/* 안내 */}
              <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#4f46e5' }}>
                💡 등록된 메뉴는 피드에서 N개 게시물마다 자동으로 삽입돼요. 활성 상태의 메뉴만 표시됩니다.
              </div>

              {/* 카드 목록 */}
              {promotions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📣</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>등록된 메뉴가 없어요</div>
                  <div style={{ fontSize: 13 }}>+ 메뉴 등록 버튼을 눌러 첫 번째 프로모션을 만들어보세요!</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                  {promotions.map(p => (
                    <div key={p.id} style={{ background: 'white', border: `2px solid ${p.active ? '#c7d2fe' : '#eee'}`, borderRadius: 16, overflow: 'hidden', opacity: p.active ? 1 : 0.6 }}>
                      {/* 이미지 미리보기 */}
                      {p.imageUrl && (
                        <img src={p.imageUrl} alt={p.title}
                          style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                      )}
                      <div style={{ padding: '14px 16px' }}>
                        {/* 타입 뱃지 + 상태 */}
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                          <span style={S.badge(p.type === 'ad' ? 'yellow' : p.type === 'event' ? 'green' : 'blue')}>
                            {p.type === 'ad' ? '광고' : p.type === 'event' ? '이벤트' : '공지'}
                          </span>
                          <span style={S.badge(p.active ? 'green' : 'gray')}>{p.active ? '활성' : '비활성'}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>
                            {p.insertEvery}개마다 · 우선순위 {p.priority}
                          </span>
                        </div>
                        {/* 제목 */}
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a2e', marginBottom: 4 }}>{p.title}</div>
                        {/* 내용 */}
                        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, marginBottom: 8,
                          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {p.content}
                        </div>
                        {/* 링크 */}
                        {p.linkUrl && (
                          <div style={{ fontSize: 11, color: '#4f46e5', marginBottom: 10 }}>
                            🔗 {p.linkUrl}
                          </div>
                        )}
                        {/* 등록일 */}
                        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>등록일: {fmtDate(p.createdAt)}</div>
                        {/* 버튼 */}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button style={{ ...S.btn('primary'), flex: 1, fontSize: 12 }}
                            onClick={() => { setEditPromo(p); setPromoForm({ ...p }); setShowPromoForm(true); }}>
                            ✏️ 수정
                          </button>
                          <button style={{ ...S.btn(p.active ? 'gray' : 'green'), flex: 1, fontSize: 12 }}
                            onClick={() => togglePromo(p)}>
                            {p.active ? '비활성화' : '활성화'}
                          </button>
                          <button style={{ ...S.btn('danger'), fontSize: 12 }}
                            onClick={() => deletePromo(p.id)}>
                            🗑
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {/* ── 메뉴 관리 ── */}
    

      {page === 'business' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={S.tableWrap}>
            <div style={S.tableHeader}>
              <div style={S.tableTitle}>🏢 비즈니스 / 오피셜 관리</div>
              <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#9ca3af' }}>
                <span>전체 {bizAccounts.length}</span>
                <span>| 심사 대기 {bizAccounts.filter(b => b.status === 'pending').length}</span>
                <span>| 승인 {bizAccounts.filter(b => b.status === 'approved').length}</span>
                <span>| 오피셜 {bizAccounts.filter(b => b.account_type === 'official').length}</span>
              </div>
            </div>

            {/* 배지 설명 */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', display: 'flex', gap: 16, fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: '#3b82f6', color: 'white', fontSize: 10, fontWeight: 900 }}>✓</span>
                인증됨 (비즈니스 확인)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: '#f59e0b', color: 'white', fontSize: 10, fontWeight: 900 }}>★</span>
                공식 (Official)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: '#8b5cf6', color: 'white', fontSize: 10, fontWeight: 900 }}>♦</span>
                프리미엄
              </span>
            </div>

            {bizLoading ? <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>로딩 중...</div> :
              bizAccounts.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>등록된 비즈니스 계정이 없어요</div> :
              bizAccounts.map(biz => {
                const catIcons = { restaurant: '🍽️', hotel: '🏨', tour: '🎒', city: '🏙️', transport: '✈️', shopping: '🛍️', creator: '🎬', other: '📢' };
                const statusColors = { pending: { color: '#f59e0b', bg: '#fffbeb', label: '심사 중' }, approved: { color: '#10b981', bg: '#ecfdf5', label: '승인' }, rejected: { color: '#ef4444', bg: '#fef2f2', label: '거절' }, suspended: { color: '#6b7280', bg: '#f3f4f6', label: '정지' } };
                const badgeColors = { none: { color: '#9ca3af', label: '없음' }, verified: { color: '#3b82f6', label: '✓ 인증' }, official: { color: '#f59e0b', label: '★ 공식' }, premium: { color: '#8b5cf6', label: '♦ 프리미엄' } };
                const st = statusColors[biz.status] || statusColors.pending;
                const bd = badgeColors[biz.badge_type] || badgeColors.none;
                return (
                  <div key={biz.id} style={{ padding: '14px 20px', borderBottom: '1px solid #f5f5f5' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <span style={{ fontSize: 28 }}>{catIcons[biz.category] || '📢'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{biz.business_name}</span>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: st.bg, color: st.color, fontWeight: 700 }}>{st.label}</span>
                          {biz.badge_type !== 'none' && (
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: bd.color + '20', color: bd.color, fontWeight: 700 }}>{bd.label}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>@{biz.nickname} · {biz.email}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {biz.business_country && <span>🌍 {biz.business_country} {biz.business_city}</span>}
                          {biz.business_website && <span>🔗 {biz.business_website}</span>}
                          {biz.business_phone && <span>📞 {biz.business_phone}</span>}
                          <span>📅 {biz.created_at?.split('T')[0]}</span>
                        </div>
                        {biz.business_description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{biz.business_description}</div>}
                        {biz.reject_reason && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>거절 사유: {biz.reject_reason}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 40 }}>
                      {biz.status === 'pending' && (
                        <>
                          <button onClick={() => approveBiz(biz.user_id, 'verified')} style={{ padding: '5px 12px', borderRadius: 8, background: '#3b82f6', color: 'white', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✓ 인증 승인</button>
                          <button onClick={() => rejectBiz(biz.user_id)} style={{ padding: '5px 12px', borderRadius: 8, background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>❌ 거절</button>
                        </>
                      )}
                      {biz.status === 'approved' && biz.badge_type !== 'official' && (
                        <button onClick={() => grantOfficial(biz.user_id)} style={{ padding: '5px 12px', borderRadius: 8, background: '#f59e0b', color: 'white', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>★ 공식 배지 부여</button>
                      )}
                      {biz.status === 'approved' && (
                        <select onChange={(e) => changeBadge(biz.user_id, e.target.value)} value={biz.badge_type}
                          style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #eee', fontSize: 11, cursor: 'pointer' }}>
                          <option value="none">배지 없음</option>
                          <option value="verified">✓ 인증</option>
                          <option value="official">★ 공식</option>
                          <option value="premium">♦ 프리미엄</option>
                        </select>
                      )}
                      {biz.business_document && (
                        <a href={biz.business_document} target="_blank" rel="noreferrer" style={{ padding: '5px 12px', borderRadius: 8, background: '#f3f4f6', color: '#6b7280', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>📄 서류 확인</a>
                      )}
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}

      {page === 'ads' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={S.tableWrap}>
            <div style={S.tableHeader}>
              <div style={S.tableTitle}>📢 광고 관리</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>
                  전체 {adsList.length}개 | 운영 중 {adsList.filter(a => a.status === 'active').length}개 | 심사 대기 {adsList.filter(a => a.status === 'pending').length}개
                </span>
              </div>
            </div>

            {/* 통계 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#FF5A5F' }}>{adsList.length}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>전체 광고</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{adsList.filter(a => a.status === 'active').length}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>운영 중</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6' }}>{adsList.reduce((s, a) => s + (a.impressions || 0), 0).toLocaleString()}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>총 노출</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>{adsList.reduce((s, a) => s + (a.clicks || 0), 0)}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>총 클릭</div>
              </div>
            </div>

            {/* 광고주 목록 */}
            {adAdvertisers.length > 0 && (
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 8 }}>등록된 광고주 ({adAdvertisers.length})</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {adAdvertisers.map(adv => (
                    <span key={adv.id} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, background: 'white', border: '1px solid #eee', color: '#374151' }}>
                      🏢 {adv.company_name} ({adv.contact_email})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 광고 목록 */}
            {adsLoading ? <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>로딩 중...</div> :
              adsList.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>등록된 광고가 없어요</div> :
              adsList.map(ad => {
                const statusMap = {
                  draft: { label: '초안', color: '#9ca3af', bg: '#f3f4f6' },
                  pending: { label: '심사 중', color: '#f59e0b', bg: '#fffbeb' },
                  active: { label: '운영 중', color: '#10b981', bg: '#ecfdf5' },
                  paused: { label: '일시정지', color: '#f59e0b', bg: '#fffbeb' },
                  ended: { label: '종료', color: '#6b7280', bg: '#f3f4f6' },
                  rejected: { label: '거절', color: '#ef4444', bg: '#fef2f2' },
                };
                const st = statusMap[ad.status] || statusMap.draft;
                const adv = adAdvertisers.find(a => a.id === ad.advertiser_id);
                return (
                  <div key={ad.id} style={{ padding: '14px 20px', borderBottom: '1px solid #f5f5f5', display: 'flex', gap: 14, alignItems: 'center' }}>
                    {ad.image_url ? (
                      <img src={ad.image_url} alt="" style={{ width: 90, height: 60, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 90, height: 60, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#d1d5db', flexShrink: 0 }}>📢</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{ad.title}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: st.bg, color: st.color }}>{st.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{ad.description}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span>🏢 {adv?.company_name || '-'}</span>
                        <span>🌍 {ad.target_country || '전체'}{ad.target_city ? ' > ' + ad.target_city : ''}</span>
                        <span>👁 {(ad.impressions || 0).toLocaleString()}</span>
                        <span>👆 {ad.clicks || 0}</span>
                        <span>📊 CTR {ad.ctr || 0}%</span>
                        <span>💰 ₩{(ad.budget_daily || 0).toLocaleString()}/일</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                      {ad.status === 'pending' && (
                        <>
                          <button onClick={() => updateAdStatus(ad.id, 'active')}
                            style={{ padding: '5px 12px', borderRadius: 8, background: '#10b981', color: 'white', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            ✅ 승인
                          </button>
                          <button onClick={() => { const r = prompt('거절 사유:'); if (r) updateAdStatus(ad.id, 'rejected', r); }}
                            style={{ padding: '5px 12px', borderRadius: 8, background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            ❌ 거절
                          </button>
                        </>
                      )}
                      {ad.status === 'active' && (
                        <button onClick={() => updateAdStatus(ad.id, 'paused')}
                          style={{ padding: '5px 12px', borderRadius: 8, background: '#fffbeb', color: '#f59e0b', border: '1px solid #fde68a', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          ⏸ 정지
                        </button>
                      )}
                      {ad.status === 'paused' && (
                        <button onClick={() => updateAdStatus(ad.id, 'active')}
                          style={{ padding: '5px 12px', borderRadius: 8, background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          ▶ 재개
                        </button>
                      )}
                      {ad.reject_reason && (
                        <span style={{ fontSize: 11, color: '#ef4444', fontStyle: 'italic' }}>사유: {ad.reject_reason}</span>
                      )}
                      <a href={ad.link_url} target="_blank" rel="noreferrer"
                        style={{ padding: '5px 12px', borderRadius: 8, background: '#f3f4f6', color: '#6b7280', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                        🔗 링크
                      </a>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}

      {page === 'menus' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={S.pageTitle}>🗂️ 메뉴 관리</div>
                <button style={S.btn('primary')} onClick={saveMenus} disabled={menuSaving}>
                  {menuSaving ? '저장 중...' : '💾 변경 저장'}
                </button>
              </div>

              <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#4f46e5' }}>
                💡 메뉴를 켜고 끄거나 순서를 바꾸면 앱의 사이드바와 하단 메뉴에 즉시 반영돼요.
              </div>

              {menuItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>불러오는 중...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {menuItems.map((m, idx) => (
                    <div key={m.key} style={{ background: 'white', border: `2px solid ${m.visible ? '#c7d2fe' : '#eee'}`, borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, opacity: m.visible ? 1 : 0.5, transition: 'all 0.15s' }}>

                      {/* 순서 이동 버튼 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <button onClick={() => moveMenu(idx, -1)} disabled={idx === 0}
                          style={{ width: 26, height: 26, border: '1px solid #eee', borderRadius: 6, background: idx === 0 ? '#f9fafb' : 'white', color: idx === 0 ? '#d1d5db' : '#6b7280', cursor: idx === 0 ? 'default' : 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          ▲
                        </button>
                        <button onClick={() => moveMenu(idx, 1)} disabled={idx === menuItems.length - 1}
                          style={{ width: 26, height: 26, border: '1px solid #eee', borderRadius: 6, background: idx === menuItems.length - 1 ? '#f9fafb' : 'white', color: idx === menuItems.length - 1 ? '#d1d5db' : '#6b7280', cursor: idx === menuItems.length - 1 ? 'default' : 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          ▼
                        </button>
                      </div>

                      {/* 순서 번호 */}
                      <div style={{ width: 24, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#9ca3af' }}>
                        {idx + 1}
                      </div>

                      {/* 아이콘 편집 */}
                      <input value={m.icon} onChange={e => updateMenuIcon(m.key, e.target.value)}
                        style={{ width: 48, textAlign: 'center', fontSize: 22, border: '1px solid #eee', borderRadius: 8, padding: '4px 0', outline: 'none', background: '#fafafa' }} />

                      {/* 라벨 편집 */}
                      <input value={m.label} onChange={e => updateMenuLabel(m.key, e.target.value)}
                        style={{ flex: 1, padding: '8px 12px', border: '1px solid #eee', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#1a1a2e', outline: 'none' }} />

                      {/* 키(고정값) */}
                      <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', padding: '3px 8px', borderRadius: 6, fontFamily: 'monospace', flexShrink: 0 }}>
                        {m.key}
                      </span>

                      {/* 로그인 필요 여부 */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0, fontSize: 12, color: '#6b7280' }}>
                        <input type="checkbox" checked={m.requireLogin || false}
                          onChange={e => setMenuItems(prev => prev.map(item => item.key === m.key ? { ...item, requireLogin: e.target.checked } : item))}
                          style={{ accentColor: '#4f46e5', cursor: 'pointer' }} />
                        로그인 필요
                      </label>

                      {/* 표시/숨김 토글 */}
                      <button onClick={() => toggleMenuVisible(m.key)}
                        style={{ padding: '7px 14px', borderRadius: 10, border: `1.5px solid ${m.visible ? '#4f46e5' : '#e5e7eb'}`, background: m.visible ? '#eef2ff' : '#f9fafb', color: m.visible ? '#4f46e5' : '#9ca3af', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                        {m.visible ? '👁️ 표시 중' : '🙈 숨김'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 미리보기 */}
              {menuItems.length > 0 && (
                <div style={{ marginTop: 20, background: '#1a1a2e', borderRadius: 16, padding: '16px 12px' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, fontWeight: 600 }}>📱 사이드바 미리보기</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {menuItems.filter(m => m.visible !== false).map(m => (
                      <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)' }}>
                        <span style={{ fontSize: 18 }}>{m.icon}</span>
                        <span style={{ fontSize: 13, color: 'white', fontWeight: 500 }}>{m.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {page === 'transit' && <TransitRoutesAdmin />}
          {page === 'mytriplog' && <AdminMyTripLog styles={S} />}
        </main>
      </div>

      {/* 회원 상세 모달 */}
      {selectedUser && (
        <div style={S.modalOverlay} onClick={() => setSelectedUser(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1a2e', marginBottom: 20 }}>{selectedUser.nickname} 회원 정보</div>
            {[
              ['닉네임', selectedUser.nickname], ['이메일', selectedUser.email],
              ['소개', selectedUser.bio || '-'], ['가입일', fmtDate(selectedUser.createdAt)],
              ['마케팅 동의', selectedUser.agreeMarketing ? '동의' : '미동의'],
              ['계정 상태', selectedUser.suspended ? '정지' : '정상'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                <span style={{ color: '#9ca3af', fontWeight: 600 }}>{k}</span>
                <span style={{ color: '#1a1a2e', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={S.btn(selectedUser.suspended ? 'primary' : 'warning')} onClick={toggleSuspend}>{selectedUser.suspended ? '정지 해제' : '계정 정지'}</button>
              <button style={S.btn('danger')} onClick={deleteUser}>탈퇴 처리</button>
              <button style={S.btn('gray')} onClick={() => setSelectedUser(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* PW 초기화 모달 */}
      {showResetPw && (
        <div style={S.modalOverlay} onClick={() => setShowResetPw(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1a2e', marginBottom: 18 }}>비밀번호 초기화</div>
            <input style={{ ...S.input, width: '100%', marginBottom: 20 }} type="password"
              placeholder="새 비밀번호 (8자 이상)" value={newPw} onChange={e => setNewPw(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={S.btn('gray')} onClick={() => setShowResetPw(null)}>취소</button>
              <button style={S.btn('primary')} onClick={resetPassword}>초기화</button>
            </div>
          </div>
        </div>
      )}

      {/* 프로모션 등록/수정 모달 */}
      {showPromoForm && (
        <div style={S.modalOverlay} onClick={() => { setShowPromoForm(false); setEditPromo(null); }}>
          <div style={{ ...S.modal, maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1a2e', marginBottom: 18 }}>
              {editPromo ? '📣 프로모션 수정' : '📣 프로모션 등록'}
            </div>

            {/* 유형 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6, fontWeight: 600 }}>유형</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['notice','📢 공지'], ['event','🎉 이벤트'], ['ad','💰 광고']].map(([val, label]) => (
                  <button key={val} onClick={() => setPromoForm(p => ({...p, type: val}))}
                    style={{ flex: 1, padding: '8px', borderRadius: 10, border: `2px solid ${promoForm.type === val ? '#4f46e5' : '#eee'}`, background: promoForm.type === val ? '#eef2ff' : 'white', color: promoForm.type === val ? '#4f46e5' : '#9ca3af', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <input style={{ ...S.input, width: '100%', marginBottom: 10 }} placeholder="제목 *"
              value={promoForm.title} onChange={e => setPromoForm(p => ({...p, title: e.target.value}))} />
            <textarea style={{ width: '100%', padding: '10px 14px', border: '1px solid #eee', borderRadius: 10, fontSize: 13, outline: 'none', resize: 'vertical', marginBottom: 10, boxSizing: 'border-box' }}
              placeholder="내용 *" rows={3} value={promoForm.content} onChange={e => setPromoForm(p => ({...p, content: e.target.value}))} />

            {/* 이미지 URL */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4, fontWeight: 600 }}>이미지 URL (선택)</div>
              <input style={{ ...S.input, width: '100%', marginBottom: 0 }} placeholder="https://... 이미지 링크"
                value={promoForm.imageUrl} onChange={e => setPromoForm(p => ({...p, imageUrl: e.target.value}))} />
              {promoForm.imageUrl && (
                <img src={promoForm.imageUrl} alt="" style={{ marginTop: 8, width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }}
                  onError={e => e.target.style.display='none'} />
              )}
            </div>

            {/* 링크 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4, fontWeight: 600 }}>링크 설정 (선택)</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...S.input, flex: 2, marginBottom: 0 }} placeholder="링크 URL"
                  value={promoForm.linkUrl} onChange={e => setPromoForm(p => ({...p, linkUrl: e.target.value}))} />
                <input style={{ ...S.input, flex: 1, marginBottom: 0 }} placeholder="버튼 텍스트"
                  value={promoForm.linkLabel} onChange={e => setPromoForm(p => ({...p, linkLabel: e.target.value}))} />
              </div>
            </div>

            {/* 삽입 간격 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6, fontWeight: 600 }}>피드 삽입 간격 (게시물 N개마다 1번 노출)</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[3, 5, 10].map(n => (
                  <button key={n} onClick={() => setPromoForm(p => ({...p, insertEvery: n}))}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${promoForm.insertEvery === n ? '#4f46e5' : '#eee'}`, background: promoForm.insertEvery === n ? '#eef2ff' : 'white', color: promoForm.insertEvery === n ? '#4f46e5' : '#9ca3af', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    {n}개마다
                  </button>
                ))}
              </div>
            </div>

            {/* 우선순위 + 활성 */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4, fontWeight: 600 }}>우선순위 (높을수록 먼저)</div>
                <input type="number" style={{ ...S.input, width: '100%', marginBottom: 0 }} value={promoForm.priority}
                  onChange={e => setPromoForm(p => ({...p, priority: Number(e.target.value)}))} min={0} max={100} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4, fontWeight: 600 }}>즉시 활성화</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 8 }}>
                  <input type="checkbox" checked={promoForm.active} onChange={e => setPromoForm(p => ({...p, active: e.target.checked}))}
                    style={{ width: 18, height: 18, accentColor: '#4f46e5', cursor: 'pointer' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: promoForm.active ? '#4f46e5' : '#9ca3af' }}>
                    {promoForm.active ? '활성' : '비활성'}
                  </span>
                </label>
              </div>
            </div>

            {/* 미리보기 */}
            {promoForm.title && (
              <div style={{ marginBottom: 16, border: '1px dashed #c7d2fe', borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 600 }}>📱 피드 미리보기</div>
                <div style={{ background: promoForm.type === 'ad' ? '#fffbeb' : promoForm.type === 'event' ? '#f0fdf4' : '#eef2ff', border: `1px solid ${promoForm.type === 'ad' ? '#fde68a' : promoForm.type === 'event' ? '#bbf7d0' : '#c7d2fe'}`, borderRadius: 12, overflow: 'hidden' }}>
                  {promoForm.imageUrl && <img src={promoForm.imageUrl} alt="" style={{ width: '100%', height: 80, objectFit: 'cover' }} onError={e => e.target.style.display='none'} />}
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: promoForm.type === 'ad' ? '#d97706' : promoForm.type === 'event' ? '#16a34a' : '#4f46e5', color: 'white' }}>
                        {promoForm.type === 'ad' ? '광고' : promoForm.type === 'event' ? '이벤트' : '공지'}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>{promoForm.title}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{promoForm.content}</div>
                    {promoForm.linkUrl && (
                      <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: promoForm.type === 'ad' ? '#d97706' : promoForm.type === 'event' ? '#16a34a' : '#4f46e5' }}>
                        {promoForm.linkLabel} →
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={S.btn('gray')} onClick={() => { setShowPromoForm(false); setEditPromo(null); }}>취소</button>
              <button style={S.btn('primary')} onClick={savePromotion}>{editPromo ? '수정 완료' : '등록'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 공지 등록 모달 */}
      {showNoticeForm && (
        <div style={S.modalOverlay} onClick={() => setShowNoticeForm(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1a2e', marginBottom: 18 }}>공지사항 등록</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[['info','정보'], ['warning','경고'], ['event','이벤트']].map(([val, label]) => (
                <button key={val} onClick={() => setNoticeForm(p => ({...p, type: val}))}
                  style={{ flex: 1, padding: '8px', borderRadius: 10, border: `2px solid ${noticeForm.type === val ? '#4f46e5' : '#eee'}`, background: noticeForm.type === val ? '#eef2ff' : 'white', color: noticeForm.type === val ? '#4f46e5' : '#9ca3af', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
            <input style={{ ...S.input, width: '100%', marginBottom: 12 }} placeholder="제목"
              value={noticeForm.title} onChange={e => setNoticeForm(p => ({...p, title: e.target.value}))} />
            <textarea style={{ width: '100%', padding: '10px 14px', border: '1px solid #eee', borderRadius: 10, fontSize: 13, outline: 'none', resize: 'vertical', marginBottom: 16 }}
              placeholder="내용" rows={4} value={noticeForm.content} onChange={e => setNoticeForm(p => ({...p, content: e.target.value}))} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={S.btn('gray')} onClick={() => setShowNoticeForm(false)}>취소</button>
              <button style={S.btn('primary')} onClick={saveNotice}>등록</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={S.toast(toast.type)}>{toast.msg}</div>}
    </div>
  );
}
