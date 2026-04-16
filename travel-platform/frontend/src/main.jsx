// 광고 페이지 리다이렉트
if (window.location.pathname === '/ads' || window.location.pathname === '/ads/') {
  window.location.href = '/ads/index.html';
}

import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { api } from './api';
import Feed from './pages/Feed';
import Explore from './pages/Explore';
import Profile from './pages/Profile';
import Planner from './pages/Planner';
import Write from './pages/Write';
import PostDetail from './components/PostDetail';
import AdminAds from './components/AdminAds';
import Admin from './pages/Admin';
import Share from './pages/Share';
import Exchange from './pages/Exchange';
import Transit from './pages/Transit';
import Nearby from './pages/Nearby';
import Terms from './pages/Terms';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';

// ── SVG 로고 컴포넌트 ──
function LogoSvg({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#1E2A3A" />
      <path d="M20 10C16.13 10 13 13.13 13 17C13 22.25 20 30 20 30C20 30 27 22.25 27 17C27 13.13 23.87 10 20 10ZM20 19.5C18.62 19.5 17.5 18.38 17.5 17C17.5 15.62 18.62 14.5 20 14.5C21.38 14.5 22.5 15.62 22.5 17C22.5 18.38 21.38 19.5 20 19.5Z" fill="white"/>
    </svg>
  );
}

function LogoFull({ onClick }) {
  return (
    <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }} onClick={onClick}>
      <LogoSvg size={28} />
      <div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 500, color: '#1E2A3A', letterSpacing: -0.5, lineHeight: '22px' }}>Spagenio</div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, fontWeight: 500, letterSpacing: 3, color: '#8A919C', marginTop: 1 }}>TRAVEL</div>
      </div>
    </div>
  );
}

// ── 로그인 페이지 ──
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('이메일과 비밀번호를 입력해주세요.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        sessionStorage.setItem('auth_token', data.token);
        const userData = { ...data.user, followingIds: data.user.followingIds || data.followingIds || [] };
        sessionStorage.setItem('auth_user', JSON.stringify(userData));
        onLogin(data.user);
      } else {
        setError(data.error || '이메일 또는 비밀번호가 올바르지 않습니다.');
      }
    } catch (e) {
      setError('서버 연결 오류가 발생했습니다.');
    } finally { setLoading(false); }
  };

  return (
    <div className="login-container">
      <div className="login-grid">
        {/* 왼쪽: Ink Navy 패널 */}
        <div className="login-left">
          <LogoSvg size={56} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: 3, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>TRAVEL</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 42, fontWeight: 500, color: 'white', letterSpacing: -1.5, lineHeight: 1.1 }}>Spagenio</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, letterSpacing: 2.5, color: 'rgba(255,255,255,0.5)', marginTop: 18 }}>TRAVEL · SHARE · DISCOVER</div>
          </div>
          <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 280, marginTop: 20 }}>
            {[0.12, 0.08, 0.06].map((o, i) => (
              <div key={i} style={{ flex: 1, height: 60, background: `rgba(255,255,255,${o})` }} />
            ))}
          </div>
        </div>

        {/* 오른쪽: 로그인 폼 */}
        <div className="login-right">
          <div style={{ marginBottom: 36, textAlign: 'center' }}>
            <LogoSvg size={48} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 500, color: '#1E2A3A', letterSpacing: -1, marginTop: 16 }}>Spagenio</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: 2.5, color: '#8A919C', marginTop: 6 }}>SIGN IN TO YOUR ACCOUNT</div>
          </div>

          {error && (
            <div style={{ width: '100%', maxWidth: 320, background: '#fef2f2', border: '0.5px solid #fecaca', color: '#dc2626', padding: '10px 14px', fontSize: 12, marginBottom: 14, fontWeight: 500, letterSpacing: 0.5 }}>
              {error}
            </div>
          )}

          <form onSubmit={submit} style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label className="login-label">Email</label>
              <input type="email" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} className="login-input" />
            </div>
            <div>
              <label className="login-label">Password</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="login-input" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: 4, opacity: loading ? 0.5 : 1 }}>
              {loading ? 'SIGNING IN...' : 'SIGN IN'}
            </button>
          </form>

          <a href="/forgot-password" style={{ marginTop: 16, fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: 1, color: '#1E2A3A', textDecoration: 'none' }}>
            FORGOT PASSWORD?
          </a>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0', width: '100%', maxWidth: 320 }}>
            <div style={{ flex: 1, height: '0.5px', background: '#E2E0DC' }} />
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: 2, color: '#8A919C' }}>OR</span>
            <div style={{ flex: 1, height: '0.5px', background: '#E2E0DC' }} />
          </div>

          <a href="/terms" className="btn-outline" style={{ width: '100%', maxWidth: 320, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
            CREATE ACCOUNT
          </a>

          <div style={{ marginTop: 32, fontSize: 9, fontWeight: 500, letterSpacing: 1.5, color: '#B8BCC4' }}>© 2026 TRAVEL SPAGENIO</div>
        </div>
      </div>
    </div>
  );
}

// ── 메인 앱 ──
function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState('feed');
  const [profileUserId, setProfileUserId] = useState(null);
  const [openedPost, setOpenedPost] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const [searchTag, setSearchTag] = useState('');
  const [feedKey, setFeedKey] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [serverNotifs, setServerNotifs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDmModal, setShowDmModal] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [dmUnread, setDmUnread] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [writeDraft, setWriteDraft] = useState(null);

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (!currentUser) return;
    const handlePopState = () => { window.history.pushState(null, '', window.location.pathname); };
    window.history.pushState(null, '', window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser]);

  const init = async () => {
    try {
      const menus = await api.getMenus();
      if (menus?.length) setNavItems(menus.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (e) {}
    const savedUser = sessionStorage.getItem('auth_user');
    const token = sessionStorage.getItem('auth_token');
    if (savedUser && token) {
      try {
        const parsed = JSON.parse(savedUser);
        const users = await api.getUsers();
        const matched = users.find(u => u.nickname === parsed.nickname);
        if (matched) {
          setCurrentUser(matched);
          const userPlans = await api.getUserPlans(matched.id);
          setPlans(userPlans || []);
        } else { setCurrentUser(parsed); }
      } catch (e) { console.error(e); }
    }
    setLoading(false);
  };

  const handleLogin = async (user) => {
    try {
      const users = await api.getUsers();
      const matched = users.find(u => u.nickname === user.nickname);
      const finalUser = matched || user;
      setCurrentUser(finalUser);
      const userPlans = await api.getUserPlans(finalUser.id);
      setPlans(userPlans || []);
      window.history.replaceState(null, '', window.location.pathname);
    } catch (e) { setCurrentUser(user); }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    setCurrentUser(null);
    setPage('feed');
    setOpenedPost(null);
    setShowLogoutMenu(false);
  };

  const loadNotifications = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`/api/notifications?userId=${currentUser.id}`);
      if (res.ok) { const data = await res.json(); setServerNotifs(Array.isArray(data) ? data : []); }
      const cRes = await fetch(`/api/notifications/unread-count?userId=${currentUser.id}`);
      if (cRes.ok) { const d = await cRes.json(); setUnreadCount(d.count || 0); }
    } catch (e) {}
  };

  useEffect(() => {
    if (currentUser?.id) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [currentUser?.id]);

  const loadConversations = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`/api/dm/conversations?userId=${currentUser.id}`);
      if (res.ok) { const data = await res.json(); setConversations(Array.isArray(data) ? data : []); }
      const ur = await fetch(`/api/dm/unread-count?userId=${currentUser.id}`);
      if (ur.ok) { const d = await ur.json(); setDmUnread(d.count || 0); }
    } catch (e) {}
  };

  useEffect(() => {
    if (currentUser?.id) {
      loadConversations();
      const interval = setInterval(loadConversations, 60000);
      return () => clearInterval(interval);
    }
  }, [currentUser?.id]);

  const openDmModal = async () => { await loadConversations(); setShowDmModal(true); };

  const openConversation = async (convo) => {
    setActiveConvo(convo); setMessages([]);
    try {
      const res = await fetch(`/api/dm/conversations/${convo.id}/messages`);
      if (res.ok) setMessages(await res.json());
      await fetch(`/api/dm/conversations/${convo.id}/read?userId=${currentUser.id}`, { method: 'POST' });
      loadConversations();
    } catch (e) {}
  };

  const sendMessage = async () => {
    const text = msgInput.trim();
    if (!text || !activeConvo) return;
    setMsgInput('');
    try {
      const res = await fetch('/api/dm/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: currentUser.id, receiverId: activeConvo.otherUserId, content: text }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          const mRes = await fetch(`/api/dm/conversations/${activeConvo.id}/messages`);
          if (mRes.ok) setMessages(await mRes.json());
        } else { alert(data.message || '전송 실패'); }
      }
    } catch (e) {}
  };

  const openNotifModal = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`/api/notifications?userId=${currentUser.id}`);
      if (!res.ok) { setServerNotifs([]); setShowNotifModal(true); return; }
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setServerNotifs(list);
      setShowNotifModal(true);
      if (list.length > 0 && list.some(n => !n.isRead)) {
        try {
          await fetch(`/api/notifications/read-all?userId=${currentUser.id}`, { method: 'POST' });
          setUnreadCount(0);
        } catch (e) {}
      }
    } catch (e) { setServerNotifs([]); setShowNotifModal(true); }
  };

  const addNotif = (notif) => { setNotifications(prev => [{ id: Date.now(), ...notif, time: new Date() }, ...prev].slice(0, 30)); };
  const handleOpenPost = (post) => setOpenedPost(post);
  const handleProfile = (userId) => { setProfileUserId(userId); setPage('profile'); setOpenedPost(null); };

  const handleLike = async (postId) => {
    if (!currentUser) return;
    try {
      const updated = await api.toggleLike(postId, currentUser.id);
      if (openedPost?.id === postId) setOpenedPost(updated);
      return updated;
    } catch (e) { console.error(e); }
  };

  const handleComment = async (postId, text) => {
    if (!currentUser) return;
    try {
      const updated = await api.addComment(postId, { userId: currentUser.id, content: text });
      if (openedPost?.id === postId) setOpenedPost(updated);
      addNotif({ type: 'comment', icon: '💬', message: `"${text.slice(0, 20)}${text.length > 20 ? '...' : ''}" 댓글을 달았어요` });
      return updated;
    } catch (e) { console.error(e); }
  };

  const handleDeletePost = (postId) => { setOpenedPost(null); setFeedKey(k => k + 1); addNotif({ type: 'delete', icon: '🗑', message: '게시물을 삭제했어요' }); };
  const handleUpdatePost = (updated) => { setOpenedPost(updated); setFeedKey(k => k + 1); };
  const handleBookmark = (updatedUser) => { setCurrentUser(prev => ({ ...prev, savedPostIds: updatedUser.savedPostIds })); addNotif({ type: 'bookmark', icon: '🔖', message: '게시물을 저장했어요' }); };
  const handleWishlist = (updatedUser) => { setCurrentUser(prev => ({ ...prev, wishlistPostIds: updatedUser.wishlistPostIds })); addNotif({ type: 'wishlist', icon: '✈️', message: '가고 싶다 목록에 추가했어요' }); };

  const handleConvertToPost = (plan) => {
    const draft = {
      title: `[${plan.title}] 여행 후기`,
      content: `📅 ${plan.startDate} ~ ${plan.endDate}\n\n` +
        (plan.items || []).map((item, i) => `${i + 1}. ${item.placeName}${item.memo ? ' — ' + item.memo : ''}`).join('\n'),
      country: '', city: plan.title, tags: ['여행후기'],
    };
    setWriteDraft(draft); setPage('write'); setOpenedPost(null);
    addNotif({ type: 'convert', icon: '✍️', message: '일정을 후기 초안으로 변환했어요' });
  };

  const handleAddToPlanner = async (planId, place, post) => {
    try {
      const item = {
        placeName: place.name, lat: place.lat, lng: place.lng,
        address: place.address, howToGet: place.howToGet, tip: place.tip,
        category: place.category, fromPostId: post.id,
        fromPostTitle: post.title, fromUserNickname: post.userNickname,
        date: '', memo: '',
      };
      const updated = await api.addPlanItem(planId, item);
      setPlans(prev => prev.map(p => p.id === planId ? updated : p));
      alert(`"${place.name}"을 일정에 추가했어요! ✅`);
    } catch (e) { console.error(e); }
  };

  const handleTagClick = (tag) => { setSearchTag(tag); setPage('explore'); setOpenedPost(null); };

  const goPage = (key) => {
    if ((key === 'write' || key === 'planner') && !currentUser) { alert('로그인이 필요합니다.'); return; }
    if (key !== 'explore') setSearchTag('');
    setPage(key); setOpenedPost(null); setShowLogoutMenu(false);
    if (key === 'profile') setProfileUserId(currentUser?.id);
  };

  const [navItems, setNavItems] = useState([
    { key: 'feed', icon: '🏠', label: 'HOME', visible: true, sortOrder: 0, requireLogin: false },
    { key: 'nearby', icon: '📍', label: 'NEARBY', visible: true, sortOrder: 1, requireLogin: true },
    { key: 'explore', icon: '🔍', label: 'EXPLORE', visible: true, sortOrder: 2, requireLogin: false },
    { key: 'write', icon: '✏️', label: 'WRITE', visible: true, sortOrder: 3, requireLogin: true },
    { key: 'planner', icon: '🗺️', label: 'PLANNER', visible: true, sortOrder: 4, requireLogin: true },
    { key: 'share', icon: '🔗', label: 'SHARE', visible: true, sortOrder: 5, requireLogin: true },
    { key: 'exchange', icon: '💱', label: 'EXCHANGE', visible: true, sortOrder: 6, requireLogin: false },
    { key: 'transit', icon: '🚇', label: 'TRANSIT', visible: true, sortOrder: 7, requireLogin: false },
    { key: 'profile', icon: '👤', label: 'PROFILE', visible: true, sortOrder: 8, requireLogin: true },
  ]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
      <LogoSvg size={40} />
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: 2, color: '#8A919C' }}>LOADING...</div>
    </div>
  );

  if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="app" onClick={() => showLogoutMenu && setShowLogoutMenu(false)}>
      <aside className="sidebar">
        <div className="logo" style={{ padding: '4px 14px 28px' }}>
          <LogoFull onClick={() => goPage('feed')} />
        </div>
        {navItems.filter(item => item.visible !== false).map(item => (
          <div key={item.key}
            className={`nav-item${page === item.key && !openedPost ? ' active' : ''}`}
            onClick={() => goPage(item.key)}>
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}

        {/* 알림 벨 */}
        <div style={{ position: 'relative' }}>
          <div className="nav-item" onClick={e => { e.stopPropagation(); setShowNotif(v => !v); setNotifications(prev => prev.map(n => ({ ...n, read: true }))); }}>
            <span className="nav-icon">🔔</span>
            <span>ALERTS</span>
            {notifications.filter(n => !n.read).length > 0 && (
              <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, background: '#FF5A5F', borderRadius: 20, fontSize: 9, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, padding: '0 4px' }}>
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </div>
          {showNotif && (
            <div style={{ position: 'absolute', left: '110%', top: 0, width: 300, background: 'white', border: '0.5px solid #E2E0DC', boxShadow: '0 8px 32px rgba(30,42,58,0.1)', zIndex: 300, overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #F0EEE9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 2, color: '#1E2A3A' }}>NOTIFICATIONS</span>
                <button onClick={() => setShowNotif(false)} style={{ fontSize: 16, color: '#8A919C', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', fontFamily: "'Inter', sans-serif", fontSize: 10, letterSpacing: 1.5, color: '#8A919C' }}>NO NOTIFICATIONS</div>
                ) : notifications.map(n => (
                  <div key={n.id} style={{ padding: '10px 16px', borderBottom: '0.5px solid #F0EEE9', display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: '#4A5568' }}>
                    <span style={{ fontSize: 16 }}>{n.icon}</span>
                    <span>{n.message}</span>
                  </div>
                ))}
              </div>
              {notifications.length > 0 && (
                <button onClick={() => setNotifications([])}
                  style={{ width: '100%', padding: 10, border: 'none', borderTop: '0.5px solid #F0EEE9', background: '#FAFAF8', fontFamily: "'Inter', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: 1.5, color: '#8A919C', cursor: 'pointer' }}>
                  CLEAR ALL
                </button>
              )}
            </div>
          )}
        </div>

        {/* 로그아웃 메뉴 */}
        <div style={{ marginTop: 'auto', position: 'relative' }}>
          {showLogoutMenu && (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 8, background: 'white', border: '0.5px solid #E2E0DC', boxShadow: '0 8px 24px rgba(30,42,58,0.1)', overflow: 'hidden', zIndex: 200 }}
              onClick={e => e.stopPropagation()}>
              <button onClick={() => { goPage('profile'); setShowLogoutMenu(false); }}
                style={{ width: '100%', padding: '12px 16px', textAlign: 'left', fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: 1, color: '#1E2A3A', borderBottom: '0.5px solid #F0EEE9', background: 'none', cursor: 'pointer' }}>
                PROFILE
              </button>
              <button onClick={() => { window.location.href = '/change-password'; }}
                style={{ width: '100%', padding: '12px 16px', textAlign: 'left', fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: 1, color: '#1E2A3A', borderBottom: '0.5px solid #F0EEE9', background: 'none', cursor: 'pointer' }}>
                CHANGE PASSWORD
              </button>
              <button onClick={handleLogout}
                style={{ width: '100%', padding: '12px 16px', textAlign: 'left', fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 1, color: '#FF5A5F', background: 'none', cursor: 'pointer' }}>
                SIGN OUT
              </button>
            </div>
          )}
          <div className="sidebar-user" onClick={e => { e.stopPropagation(); setShowLogoutMenu(v => !v); }}>
            <img className="avatar avatar-sm"
              src={currentUser.profileImage || `https://ui-avatars.com/api/?name=${currentUser.nickname}&background=1E2A3A&color=fff`}
              alt={currentUser.nickname} />
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{currentUser.nickname}</div>
              <div className="sidebar-user-sub">SETTINGS</div>
            </div>
            <div style={{ fontSize: 14, color: '#B8BCC4', marginLeft: 'auto' }}>⋯</div>
          </div>
        </div>
      </aside>

      <main className="main">
        {openedPost ? (
          <PostDetail post={openedPost} currentUserId={currentUser?.id} currentUser={currentUser} plans={plans}
            onLike={handleLike} onComment={handleComment} onProfile={handleProfile}
            onAddToPlanner={handleAddToPlanner} onBack={() => setOpenedPost(null)}
            onDelete={handleDeletePost} onUpdate={handleUpdatePost}
            onBookmark={handleBookmark} onWishlist={handleWishlist} />
        ) : page === 'feed' ? (
          <>
            {/* 모바일 피드 헤더 */}
            <div className="mobile-feed-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '0.5px solid #F0EEE9', background: 'white', position: 'sticky', top: 0, zIndex: 10 }}>
              <LogoFull onClick={() => goPage('feed')} />
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => goPage('nearby')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 6 }}>📍</button>
                <button onClick={openNotifModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 6, position: 'relative' }}>
                  🔔
                  {unreadCount > 0 && (
                    <span style={{ position: 'absolute', top: 2, right: 2, background: '#FF5A5F', color: 'white', fontSize: 8, fontWeight: 700, borderRadius: 10, padding: '1px 4px', minWidth: 14, textAlign: 'center' }}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                <button onClick={openDmModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 6, position: 'relative' }}>
                  💬
                  {dmUnread > 0 && (
                    <span style={{ position: 'absolute', top: 2, right: 2, background: '#FF5A5F', color: 'white', fontSize: 8, fontWeight: 700, borderRadius: 10, padding: '1px 4px', minWidth: 14, textAlign: 'center' }}>
                      {dmUnread > 99 ? '99+' : dmUnread}
                    </span>
                  )}
                </button>
              </div>
            </div>
            {/* 알림 모달 */}
            {showNotifModal && (
              <div onClick={() => setShowNotifModal(false)} className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: 60 }}>
                <div onClick={e => e.stopPropagation()} className="modal-content" style={{ maxWidth: 420, maxHeight: '70vh' }}>
                  <div className="modal-header">
                    <div className="modal-title">NOTIFICATIONS</div>
                    <button onClick={() => setShowNotifModal(false)} style={{ fontSize: 18, color: '#8A919C', cursor: 'pointer' }}>✕</button>
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {serverNotifs.length === 0 ? (
                      <div style={{ padding: 40, textAlign: 'center', fontFamily: "'Inter', sans-serif", fontSize: 10, letterSpacing: 1.5, color: '#8A919C' }}>NO NOTIFICATIONS YET</div>
                    ) : serverNotifs.map(n => {
                      const icons = { like: '❤️', comment: '💬', follow: '👤' };
                      const handleClick = async () => {
                        if (!n.isRead) {
                          try {
                            await fetch(`/api/notifications/${n.id}/read`, { method: 'POST' });
                            setServerNotifs(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x));
                            setUnreadCount(prev => Math.max(0, prev - 1));
                          } catch (e) {}
                        }
                        if (n.postId && (n.type === 'like' || n.type === 'comment')) {
                          setShowNotifModal(false);
                          try {
                            const res = await fetch(`/api/posts/${n.postId}`);
                            if (res.ok) handleOpenPost(await res.json());
                          } catch (e) {}
                        } else if (n.type === 'follow' && n.actorId) {
                          setShowNotifModal(false);
                          handleProfile(n.actorId);
                        }
                      };
                      return (
                        <div key={n.id} onClick={handleClick} style={{ cursor: 'pointer', padding: '12px 20px', borderBottom: '0.5px solid #F0EEE9', display: 'flex', gap: 12, alignItems: 'flex-start', background: n.isRead ? 'white' : '#FAFAF8' }}>
                          <div style={{ fontSize: 18 }}>{icons[n.type] || '🔔'}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#1E2A3A', lineHeight: 1.4 }}>
                              <strong>{n.actorNickname}</strong>님이 {n.message}
                            </div>
                            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: '#8A919C', marginTop: 2 }}>{new Date(n.createdAt).toLocaleString('ko-KR')}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            {/* DM 모달 */}
            {showDmModal && (
              <div onClick={() => { setShowDmModal(false); setActiveConvo(null); }} className="modal-overlay">
                <div onClick={e => e.stopPropagation()} className="modal-content" style={{ height: '80vh' }}>
                  {activeConvo ? (
                    <>
                      <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #F0EEE9', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button onClick={() => setActiveConvo(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#1E2A3A' }}>←</button>
                        <img src={activeConvo.otherProfileImage || `https://ui-avatars.com/api/?name=${activeConvo.otherNickname}&background=1E2A3A&color=fff&size=32`}
                          style={{ width: 28, height: 28, borderRadius: 14 }} alt="" />
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, flex: 1, color: '#1E2A3A' }}>{activeConvo.otherNickname}</div>
                        <button onClick={() => { setShowDmModal(false); setActiveConvo(null); }} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#8A919C' }}>✕</button>
                      </div>
                      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {messages.length === 0 ? (
                          <div style={{ textAlign: 'center', fontFamily: "'Inter', sans-serif", fontSize: 10, letterSpacing: 1.5, color: '#8A919C', marginTop: 40 }}>START A CONVERSATION</div>
                        ) : messages.map(m => {
                          const isMine = m.senderId === currentUser.id;
                          return (
                            <div key={m.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                              <div style={{ maxWidth: '70%', padding: '8px 14px', background: isMine ? '#1E2A3A' : '#F5F4F0', color: isMine ? 'white' : '#1E2A3A', fontFamily: "'Inter', sans-serif", fontSize: 13, lineHeight: 1.4 }}>
                                {m.content}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ padding: 12, borderTop: '0.5px solid #F0EEE9', display: 'flex', gap: 8 }}>
                        <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && !e.repeat) { e.preventDefault(); sendMessage(); } }}
                          placeholder="Type a message..."
                          style={{ flex: 1, padding: '10px 14px', background: '#F5F4F0', border: 'none', fontFamily: "'Inter', sans-serif", fontSize: 13, outline: 'none', color: '#1E2A3A' }} />
                        <button onClick={sendMessage} className="btn-primary" style={{ padding: '10px 16px' }}>SEND</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="modal-header">
                        <div className="modal-title">MESSAGES</div>
                        <button onClick={() => setShowDmModal(false)} style={{ fontSize: 16, color: '#8A919C', cursor: 'pointer' }}>✕</button>
                      </div>
                      <div style={{ flex: 1, overflowY: 'auto' }}>
                        {conversations.length === 0 ? (
                          <div style={{ padding: 40, textAlign: 'center', fontFamily: "'Inter', sans-serif", fontSize: 10, letterSpacing: 1.5, color: '#8A919C' }}>NO CONVERSATIONS YET</div>
                        ) : conversations.map(c => (
                          <div key={c.id} onClick={() => openConversation(c)} style={{ padding: '12px 20px', borderBottom: '0.5px solid #F0EEE9', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }}>
                            <img src={c.otherProfileImage || `https://ui-avatars.com/api/?name=${c.otherNickname}&background=1E2A3A&color=fff&size=44`}
                              style={{ width: 40, height: 40, borderRadius: 20 }} alt="" />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, color: '#1E2A3A' }}>{c.otherNickname}</div>
                              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#8A919C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{c.lastMessage || '(메시지 없음)'}</div>
                            </div>
                            {c.unreadCount > 0 && (
                              <span style={{ background: '#FF5A5F', color: 'white', fontFamily: "'Inter', sans-serif", fontSize: 9, fontWeight: 700, borderRadius: 10, padding: '2px 8px' }}>{c.unreadCount}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            <Feed key={feedKey} currentUser={currentUser} onOpenPost={handleOpenPost} onProfile={handleProfile} onTagClick={handleTagClick} />
          </>
        ) : page === 'nearby' ? (
          <Nearby currentUser={currentUser} onOpenPost={handleOpenPost} />
        ) : page === 'explore' ? (
          <Explore currentUser={currentUser} onOpenPost={handleOpenPost} onProfile={handleProfile} searchTag={searchTag} />
        ) : page === 'write' ? (
          <Write currentUser={currentUser} draft={writeDraft} onDone={() => { setFeedKey(k => k + 1); setPage('feed'); setWriteDraft(null); addNotif({ type: 'post', icon: '✏️', message: '게시물을 작성했어요' }); }} />
        ) : page === 'planner' ? (
          <Planner currentUser={currentUser} plans={plans} onUpdatePlans={setPlans} onConvertToPost={handleConvertToPost} />
        ) : page === 'share' ? (
          <Share currentUser={currentUser} onProfile={handleProfile} />
        ) : page === 'exchange' ? (
          <Exchange />
        ) : page === 'transit' ? (
          <Transit />
        ) : page === 'profile' ? (
          <Profile userId={profileUserId || currentUser?.id} currentUser={currentUser}
            onOpenPost={handleOpenPost} onChangeUser={setCurrentUser} />
        ) : null}
      </main>

      {/* 모바일 하단 네비 */}
      <nav className="bottom-nav" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        {navItems.filter(item => item.visible !== false).map(item => (
          item.key === 'write' ? (
            <div key={item.key} className="bottom-nav-item" onClick={() => goPage(item.key)}>
              <div className="bottom-nav-plus">+</div>
              <div className={`bottom-nav-label${page === item.key ? ' active' : ''}`}>{item.label}</div>
            </div>
          ) : (
            <div key={item.key} className="bottom-nav-item" onClick={() => goPage(item.key)}>
              <div className={`bottom-nav-icon${page === item.key && !openedPost ? ' active' : ''}`}>{item.icon}</div>
              <div className={`bottom-nav-label${page === item.key && !openedPost ? ' active' : ''}`}>{item.label}</div>
            </div>
          )
        ))}
      </nav>
    </div>
  );
}

function Router() {
  const path = window.location.pathname;
  if (path.startsWith('/admin')) return <Admin />;
  if (path.startsWith('/terms')) return <Terms />;
  if (path.startsWith('/register')) return <Register />;
  if (path.startsWith('/forgot-password')) return <ForgotPassword />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><Router /></React.StrictMode>
);
