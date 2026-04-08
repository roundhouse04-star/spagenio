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
import Admin from './pages/Admin';
import Share from './pages/Share';
import Terms from './pages/Terms';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';

// ── 로그인 페이지 (인스타 레이아웃 + 여행 지도 일러스트) ──
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
        setError(data.error || '이메일 또는 비밀번호가 올바르지 않습니다.');
      }
    } catch (e) {
      setError('서버 연결 오류가 발생했습니다.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: '100%', background: 'white', borderRadius: 20, border: '1px solid #eee', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr', boxShadow: '0 8px 40px rgba(79,70,229,0.08)', minHeight: 'calc(100vh - 40px)' }}>

        {/* 왼쪽: 여행 지도 일러스트 */}
        <div style={{ background: '#f0f4ff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', gap: 20 }}>
          <svg width="100%" viewBox="0 0 320 260" xmlns="http://www.w3.org/2000/svg">
            <rect x="20" y="20" width="280" height="200" rx="16" fill="#e8edf8" stroke="#c7d2fe" strokeWidth="1"/>
            <line x1="20" y1="73" x2="300" y2="73" stroke="#c7d2fe" strokeWidth="0.5" strokeDasharray="4,4"/>
            <line x1="20" y1="126" x2="300" y2="126" stroke="#c7d2fe" strokeWidth="0.5" strokeDasharray="4,4"/>
            <line x1="20" y1="179" x2="300" y2="179" stroke="#c7d2fe" strokeWidth="0.5" strokeDasharray="4,4"/>
            <line x1="80" y1="20" x2="80" y2="220" stroke="#c7d2fe" strokeWidth="0.5" strokeDasharray="4,4"/>
            <line x1="160" y1="20" x2="160" y2="220" stroke="#c7d2fe" strokeWidth="0.5" strokeDasharray="4,4"/>
            <line x1="240" y1="20" x2="240" y2="220" stroke="#c7d2fe" strokeWidth="0.5" strokeDasharray="4,4"/>
            <ellipse cx="90" cy="95" rx="42" ry="28" fill="#bfcbf5" opacity="0.7"/>
            <ellipse cx="175" cy="80" rx="35" ry="22" fill="#bfcbf5" opacity="0.7"/>
            <ellipse cx="240" cy="110" rx="28" ry="18" fill="#bfcbf5" opacity="0.7"/>
            <ellipse cx="130" cy="155" rx="38" ry="20" fill="#bfcbf5" opacity="0.7"/>
            <ellipse cx="230" cy="160" rx="22" ry="14" fill="#bfcbf5" opacity="0.7"/>
            <ellipse cx="65" cy="160" rx="18" ry="12" fill="#bfcbf5" opacity="0.7"/>
            <path d="M90 90 Q130 60 175 78" stroke="#4f46e5" strokeWidth="1.5" fill="none" strokeDasharray="5,3" opacity="0.7"/>
            <path d="M175 78 Q210 70 240 108" stroke="#4f46e5" strokeWidth="1.5" fill="none" strokeDasharray="5,3" opacity="0.7"/>
            <path d="M130 153 Q160 140 175 78" stroke="#818cf8" strokeWidth="1.5" fill="none" strokeDasharray="5,3" opacity="0.6"/>
            <circle cx="240" cy="104" r="10" fill="#4f46e5"/>
            <circle cx="240" cy="104" r="5" fill="white"/>
            <line x1="240" y1="114" x2="240" y2="122" stroke="#4f46e5" strokeWidth="1.5"/>
            <circle cx="175" cy="72" r="10" fill="#10b981"/>
            <circle cx="175" cy="72" r="5" fill="white"/>
            <line x1="175" y1="82" x2="175" y2="90" stroke="#10b981" strokeWidth="1.5"/>
            <circle cx="90" cy="84" r="10" fill="#f59e0b"/>
            <circle cx="90" cy="84" r="5" fill="white"/>
            <line x1="90" y1="94" x2="90" y2="102" stroke="#f59e0b" strokeWidth="1.5"/>
            <circle cx="130" cy="148" r="8" fill="#ef4444"/>
            <circle cx="130" cy="148" r="4" fill="white"/>
            <line x1="130" y1="156" x2="130" y2="162" stroke="#ef4444" strokeWidth="1.5"/>
            <rect x="248" y="66" width="46" height="24" rx="6" fill="white" stroke="#e0e7ff" strokeWidth="1"/>
            <text x="271" y="82" textAnchor="middle" fill="#4f46e5" fontSize="9" fontWeight="600" fontFamily="sans-serif">도쿄 🗼</text>
            <rect x="140" y="46" width="46" height="24" rx="6" fill="white" stroke="#d1fae5" strokeWidth="1"/>
            <text x="163" y="62" textAnchor="middle" fill="#059669" fontSize="9" fontWeight="600" fontFamily="sans-serif">파리 🗼</text>
            <rect x="36" y="56" width="46" height="24" rx="6" fill="white" stroke="#fde68a" strokeWidth="1"/>
            <text x="59" y="72" textAnchor="middle" fill="#d97706" fontSize="9" fontWeight="600" fontFamily="sans-serif">뉴욕 🗽</text>
            <g transform="translate(148,108) rotate(-30)">
              <path d="M0 0 L8 -3 L8 3 Z" fill="#4f46e5" opacity="0.8"/>
              <rect x="-6" y="-1" width="8" height="2" rx="1" fill="#4f46e5" opacity="0.8"/>
              <rect x="-2" y="1" width="5" height="1.5" rx="0.5" fill="#4f46e5" opacity="0.6"/>
            </g>
            <rect x="28" y="190" width="78" height="22" rx="8" fill="white" stroke="#e0e7ff" strokeWidth="1"/>
            <text x="67" y="204" textAnchor="middle" fill="#4f46e5" fontSize="9" fontWeight="600" fontFamily="sans-serif">📍 132개 여행지</text>
            <rect x="118" y="190" width="84" height="22" rx="8" fill="white" stroke="#d1fae5" strokeWidth="1"/>
            <text x="160" y="204" textAnchor="middle" fill="#059669" fontSize="9" fontWeight="600" fontFamily="sans-serif">✈ 2.4만 여행자</text>
            <rect x="214" y="190" width="78" height="22" rx="8" fill="white" stroke="#fde68a" strokeWidth="1"/>
            <text x="253" y="204" textAnchor="middle" fill="#d97706" fontSize="9" fontWeight="600" fontFamily="sans-serif">🗺 8.9만 코스</text>
          </svg>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', textAlign: 'center', lineHeight: 1.4 }}>
            나만의 <span style={{ color: '#4f46e5' }}>여행 코스</span>를<br/>전 세계와 공유하세요
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 1.7 }}>
            실제 여행자들의 생생한 후기와<br/>검증된 여행 코스를 발견해보세요
          </div>
        </div>

        {/* 오른쪽: 로그인 폼 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 40px' }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#1a1a2e', letterSpacing: -0.5, marginBottom: 32 }}>
            ✈ Travel<span style={{ color: '#4f46e5' }}>log</span>
          </div>

          {error && (
            <div style={{ width: '100%', maxWidth: 320, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <form onSubmit={submit} style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 0 }}>
            <input type="email" placeholder="이메일 주소" value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '13px 16px', border: '1px solid #e0e0e0', borderBottom: 'none', borderRadius: '12px 12px 0 0', fontSize: 14, outline: 'none', background: '#fafafa', color: '#1a1a2e' }} />
            <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '13px 16px', border: '1px solid #e0e0e0', borderRadius: '0 0 12px 12px', fontSize: 14, outline: 'none', background: '#fafafa', color: '#1a1a2e' }} />
            <button type="submit" disabled={loading}
              style={{ width: '100%', marginTop: 12, padding: 14, borderRadius: 12, background: loading ? '#a5b4fc' : '#4f46e5', color: 'white', fontSize: 15, fontWeight: 700, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}>
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <a href="/forgot-password" style={{ marginTop: 14, fontSize: 13, color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}>
            비밀번호를 잊으셨나요?
          </a>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0', width: '100%', maxWidth: 320 }}>
            <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
            <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>또는</span>
            <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          </div>

          <a href="/terms" style={{ display: 'block', width: '100%', maxWidth: 320, padding: 12, borderRadius: 12, border: '1.5px solid #4f46e5', background: 'white', color: '#4f46e5', fontSize: 14, fontWeight: 700, textAlign: 'center', textDecoration: 'none', transition: 'background 0.15s' }}
            onMouseEnter={e => e.target.style.background = '#eef2ff'}
            onMouseLeave={e => e.target.style.background = 'white'}>
            새 계정 만들기
          </a>

          <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 12px' }}>
            {['서비스 약관', '개인정보처리방침', '도움말', '위치', 'API'].map(t => (
              <span key={t} style={{ fontSize: 11, color: '#9ca3af', cursor: 'pointer' }}>{t}</span>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: '#d1d5db' }}>© 2026 Travellog</div>
        </div>
      </div>

      {/* 모바일 대응 */}
      <style>{`
        @media (max-width: 640px) {
          .login-grid { grid-template-columns: 1fr !important; }
          .login-left { display: none !important; }
        }
      `}</style>
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
  const [searchTag, setSearchTag] = useState('');

  useEffect(() => { init(); }, []);

  const init = async () => {
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
        } else {
          setCurrentUser(parsed);
        }
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

  const handleTagClick = (tag) => {
    setSearchTag(tag);
    setPage('explore');
    setOpenedPost(null);
  };

  const goPage = (key) => {
    if ((key === 'write' || key === 'planner') && !currentUser) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (key !== 'explore') setSearchTag('');
    setPage(key);
    setOpenedPost(null);
    setShowLogoutMenu(false);
    if (key === 'profile') setProfileUserId(currentUser?.id);
  };

  const navItems = [
    { key: 'feed',    icon: '🏠', label: '홈' },
    { key: 'explore', icon: '🔍', label: '탐색' },
    { key: 'write',   icon: '✏️', label: '글쓰기' },
    { key: 'planner', icon: '🗺️', label: '일정' },
    { key: 'share',   icon: '🔗', label: '정보공유' },
    { key: 'profile', icon: '👤', label: '프로필' },
  ];

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#bbb', fontSize: 16 }}>
      불러오는 중...
    </div>
  );

  if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="app" onClick={() => showLogoutMenu && setShowLogoutMenu(false)}>
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

        {/* 로그아웃 메뉴 */}
        <div style={{ marginTop: 'auto', position: 'relative' }}>
          {showLogoutMenu && (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 8, background: 'white', border: '1px solid #eee', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden', zIndex: 200 }}
              onClick={e => e.stopPropagation()}>
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

      <main className="main">
        {openedPost ? (
          <PostDetail post={openedPost} currentUserId={currentUser?.id} plans={plans}
            onLike={handleLike} onComment={handleComment} onProfile={handleProfile}
            onAddToPlanner={handleAddToPlanner} onBack={() => setOpenedPost(null)} />
        ) : page === 'feed' ? (
          <Feed currentUser={currentUser} onOpenPost={handleOpenPost} onProfile={handleProfile} onTagClick={handleTagClick} />
        ) : page === 'explore' ? (
          <Explore currentUser={currentUser} onOpenPost={handleOpenPost} onProfile={handleProfile} searchTag={searchTag} />
        ) : page === 'write' ? (
          <Write currentUser={currentUser} onDone={() => setPage('feed')} />
        ) : page === 'planner' ? (
          <Planner currentUser={currentUser} plans={plans} onUpdatePlans={setPlans} />
        ) : page === 'share' ? (
          <Share currentUser={currentUser} onProfile={handleProfile} />
        ) : page === 'profile' ? (
          <Profile userId={profileUserId || currentUser?.id} currentUser={currentUser}
            onOpenPost={handleOpenPost} onChangeUser={setCurrentUser} />
        ) : null}
      </main>

      {/* 모바일 하단 네비 */}
      <nav className="bottom-nav" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
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
