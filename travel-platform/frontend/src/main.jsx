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

// ── 로그인 페이지 ─────────────────────────────────────────
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
        sessionStorage.setItem('auth_user', JSON.stringify(data.user));
        onLogin(data.user);
      } else {
        setError(data.error || '로그인에 실패했습니다.');
      }
    } catch (e) {
      setError('서버 연결 오류가 발생했습니다.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#4f46e5', letterSpacing: -1 }}>✈ Travellog</div>
          <div style={{ fontSize: 14, color: '#6b7280', marginTop: 6 }}>여행 이야기를 공유하세요</div>
        </div>

        {/* 로그인 박스 */}
        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 20, padding: 32, boxShadow: '0 4px 20px rgba(79,70,229,0.08)', marginBottom: 12 }}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email" placeholder="이메일" value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 14, outline: 'none', background: '#f9fafb' }}
            />
            <input
              type="password" placeholder="비밀번호" value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 14, outline: 'none', background: '#f9fafb' }}
            />
            <button type="submit" disabled={loading}
              style={{ width: '100%', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4, opacity: loading ? 0.7 : 1 }}>
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#6b7280' }}>
            <a href="/forgot-password" style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}>비밀번호를 잊으셨나요?</a>
          </div>
        </div>

        {/* 회원가입 박스 */}
        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 16, padding: '20px 32px', textAlign: 'center', fontSize: 14, color: '#555' }}>
          계정이 없으신가요?{' '}
          <a href="/terms" style={{ color: '#4f46e5', fontWeight: 700, textDecoration: 'none' }}>회원가입</a>
        </div>

        {/* 앱 다운로드 힌트 */}
        <div style={{ textAlign: 'center', marginTop: 24, color: '#9ca3af', fontSize: 12 }}>
          © 2026 Travellog
        </div>
      </div>
    </div>
  );
}

// ── 메인 앱 ──────────────────────────────────────────────
function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState('feed');
  const [profileUserId, setProfileUserId] = useState(null);
  const [openedPost, setOpenedPost] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    // 세션에 저장된 유저 확인
    const savedUser = sessionStorage.getItem('auth_user');
    const token = sessionStorage.getItem('auth_token');
    if (savedUser && token) {
      try {
        // 토큰 유효성 확인 후 Spring 백엔드에서 유저 정보 가져오기
        const parsed = JSON.parse(savedUser);
        // Spring DB에서 같은 닉네임의 유저 찾기 (임시)
        const users = await api.getUsers();
        const matched = users.find(u => u.nickname === parsed.nickname);
        if (matched) {
          setCurrentUser(matched);
          const userPlans = await api.getUserPlans(matched.id);
          setPlans(userPlans || []);
        } else {
          setCurrentUser(parsed);
        }
      } catch (e) { console.error(e); }
    }
    setLoading(false);
  };

  const handleLogin = async (user) => {
    try {
      // Spring 백엔드에서 닉네임으로 매칭
      const users = await api.getUsers();
      const matched = users.find(u => u.nickname === user.nickname);
      const finalUser = matched || user;
      setCurrentUser(finalUser);
      const userPlans = await api.getUserPlans(finalUser.id);
      setPlans(userPlans || []);
    } catch (e) {
      setCurrentUser(user);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    setCurrentUser(null);
    setPage('feed');
    setOpenedPost(null);
    setShowLogoutMenu(false);
  };

  const handleOpenPost = (post) => setOpenedPost(post);

  const handleProfile = (userId) => {
    setProfileUserId(userId);
    setPage('profile');
    setOpenedPost(null);
  };

  const handleLike = async (postId) => {
    if (!currentUser) return;
    try {
      const updated = await api.toggleLike(postId, currentUser.id);
      if (openedPost?.id === postId) setOpenedPost(updated);
    } catch (e) { console.error(e); }
  };

  const handleComment = async (postId, text) => {
    if (!currentUser) return;
    try {
      const updated = await api.addComment(postId, { userId: currentUser.id, content: text });
      if (openedPost?.id === postId) setOpenedPost(updated);
    } catch (e) { console.error(e); }
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

  const goPage = (key) => {
    if ((key === 'write' || key === 'planner') && !currentUser) {
      alert('로그인이 필요합니다.');
      return;
    }
    setPage(key);
    setOpenedPost(null);
    setShowLogoutMenu(false);
    if (key === 'profile') setProfileUserId(currentUser?.id);
  };

  const navItems = [
    { key: 'feed', icon: '🏠', label: '홈' },
    { key: 'explore', icon: '🔍', label: '탐색' },
    { key: 'write', icon: '✏️', label: '글쓰기' },
    { key: 'planner', icon: '🗺️', label: '일정' },
    { key: 'profile', icon: '👤', label: '프로필' },
  ];

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#bbb', fontSize: 16 }}>
      불러오는 중...
    </div>
  );

  // 비로그인 상태
  if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="app" onClick={() => showLogoutMenu && setShowLogoutMenu(false)}>
      {/* 사이드바 */}
      <aside className="sidebar">
        <div className="logo" style={{ cursor: 'pointer' }} onClick={() => goPage('feed')}>
          ✈ Travel<span>log</span>
        </div>

        {navItems.map(item => (
          <div key={item.key}
            className={`nav-item${page === item.key && !openedPost ? ' active' : ''}`}
            onClick={() => goPage(item.key)}>
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}

        {/* 사이드바 하단 - 유저 + 로그아웃 */}
        <div style={{ marginTop: 'auto', position: 'relative' }}>
          {showLogoutMenu && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 8,
              background: 'white', border: '1px solid #eee', borderRadius: 14,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden', zIndex: 200
            }} onClick={e => e.stopPropagation()}>
              <button onClick={() => { goPage('profile'); setShowLogoutMenu(false); }}
                style={{ width: '100%', padding: '12px 16px', textAlign: 'left', fontSize: 14, color: '#1a1a2e', fontWeight: 600, borderBottom: '1px solid #f0f0f0', background: 'none', cursor: 'pointer' }}>
                👤 내 프로필
              </button>
              <button onClick={() => { window.location.href = '/change-password'; }}
                style={{ width: '100%', padding: '12px 16px', textAlign: 'left', fontSize: 14, color: '#1a1a2e', fontWeight: 600, borderBottom: '1px solid #f0f0f0', background: 'none', cursor: 'pointer' }}>
                🔒 비밀번호 변경
              </button>
              <button onClick={handleLogout}
                style={{ width: '100%', padding: '12px 16px', textAlign: 'left', fontSize: 14, color: '#ef4444', fontWeight: 700, background: 'none', cursor: 'pointer' }}>
                로그아웃
              </button>
            </div>
          )}
          <div className="sidebar-user" onClick={e => { e.stopPropagation(); setShowLogoutMenu(v => !v); }}>
            <img className="avatar avatar-sm"
              src={currentUser.profileImage || `https://ui-avatars.com/api/?name=${currentUser.nickname}&background=4f46e5&color=fff`}
              alt={currentUser.nickname} />
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{currentUser.nickname}</div>
              <div className="sidebar-user-sub">설정</div>
            </div>
            <div style={{ fontSize: 16, color: '#bbb', marginLeft: 'auto' }}>⋯</div>
          </div>
        </div>
      </aside>

      {/* 메인 */}
      <main className="main">
        {openedPost ? (
          <PostDetail post={openedPost} currentUserId={currentUser?.id} plans={plans}
            onLike={handleLike} onComment={handleComment} onProfile={handleProfile}
            onAddToPlanner={handleAddToPlanner} onBack={() => setOpenedPost(null)} />
        ) : page === 'feed' ? (
          <Feed currentUser={currentUser} onOpenPost={handleOpenPost} onProfile={handleProfile} />
        ) : page === 'explore' ? (
          <Explore currentUser={currentUser} onOpenPost={handleOpenPost} onProfile={handleProfile} />
        ) : page === 'write' ? (
          <Write currentUser={currentUser} onDone={() => setPage('feed')} />
        ) : page === 'planner' ? (
          <Planner currentUser={currentUser} plans={plans} onUpdatePlans={setPlans} />
        ) : page === 'profile' ? (
          <Profile userId={profileUserId || currentUser?.id} currentUser={currentUser}
            onOpenPost={handleOpenPost} onChangeUser={setCurrentUser} />
        ) : null}
      </main>

      {/* 모바일 하단 네비 */}
      <nav className="bottom-nav">
        {navItems.map(item => (
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);
