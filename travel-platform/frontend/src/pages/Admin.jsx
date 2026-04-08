import React, { useState, useEffect } from 'react';

const API = '';  // 같은 origin, vite proxy가 /api → 9001로 전달

// ── 스타일 ────────────────────────────────────────────────
const S = {
  wrap: { minHeight: '100vh', background: '#f5f6f8', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  app: { display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh' },
  sidebar: { background: '#1a1a2e', padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: 4, position: 'sticky', top: 0, height: '100vh' },
  logo: { fontSize: 16, fontWeight: 900, color: 'white', padding: '4px 12px 20px', letterSpacing: -0.5 },
  navItem: (active) => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, color: active ? 'white' : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: active ? 700 : 500, background: active ? '#4f46e5' : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }),
  main: { padding: 28, display: 'flex', flexDirection: 'column', gap: 20 },
  pageTitle: { fontSize: 20, fontWeight: 800, color: '#1a1a2e' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 },
  statCard: (color) => ({ background: 'white', border: '1px solid #eee', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }),
  statNum: (color) => ({ fontSize: 28, fontWeight: 900, color: color, margin: '6px 0 2px' }),
  statLabel: { fontSize: 12, color: '#9ca3af', fontWeight: 600 },
  statSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  tableWrap: { background: 'white', border: '1px solid #eee', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  tableHeader: { padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  tableTitle: { fontSize: 15, fontWeight: 700, color: '#1a1a2e' },
  th: { padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#fafafa', borderBottom: '1px solid #eee' },
  td: { padding: '12px 16px', fontSize: 13, color: '#374151', borderBottom: '1px solid #f9fafb', verticalAlign: 'middle' },
  badge: (type) => {
    const s = { green: { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }, red: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }, gray: { background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' } };
    return { ...s[type], display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 };
  },
  btn: (type) => {
    const s = { primary: { background: '#4f46e5', color: 'white' }, danger: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }, warning: { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }, gray: { background: '#f3f4f6', color: '#555' } };
    return { ...s[type], padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: s[type].border || 'none', transition: 'all 0.15s' };
  },
  input: { padding: '9px 14px', border: '1px solid #eee', borderRadius: 10, fontSize: 13, outline: 'none', background: 'white' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  modal: { background: 'white', borderRadius: 20, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: 17, fontWeight: 800, color: '#1a1a2e', marginBottom: 20 },
  infoRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 },
  toast: (type) => ({ position: 'fixed', bottom: 24, right: 24, background: type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#1a1a2e', color: 'white', padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600, zIndex: 2000 }),
  loginWrap: { minHeight: '100vh', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  loginBox: { background: 'white', borderRadius: 20, padding: 40, width: '100%', maxWidth: 380 },
};

export default function Admin() {
  const [token, setToken] = useState(sessionStorage.getItem('admin_token') || '');
  const [page, setPage] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showResetPw, setShowResetPw] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [toast, setToast] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginErr, setLoginErr] = useState('');
  const [recentUsers, setRecentUsers] = useState([]);

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
    if (token) { loadStats(); loadRecentUsers(); }
  }, [token]);

  useEffect(() => {
    if (token && page === 'users') loadUsers(1);
  }, [page, token]);

  const loadStats = async () => {
    const res = await apiFetch('/api/auth/admin/stats');
    if (res?.ok) setStats(await res.json());
  };

  const loadRecentUsers = async () => {
    const res = await apiFetch('/api/auth/admin/users?page=1&limit=5');
    if (res?.ok) { const d = await res.json(); setRecentUsers(d.users || []); }
  };

  const loadUsers = async (p = 1) => {
    setCurrentPage(p);
    const res = await apiFetch(`/api/auth/admin/users?page=${p}&limit=15&search=${encodeURIComponent(search)}`);
    if (res?.ok) { const d = await res.json(); setUsers(d.users || []); setTotal(d.total || 0); }
  };

  const adminLogin = async () => {
    setLoginErr('');
    try {
      const res = await fetch('/api/auth/admin/login', {
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
    const res = await apiFetch(`/api/auth/admin/users/${selectedUser.id}`, {
      method: 'PATCH', body: JSON.stringify({ suspended: !selectedUser.suspended })
    });
    if (res?.ok) { showToast(selectedUser.suspended ? '정지 해제됐습니다.' : '계정이 정지됐습니다.'); setSelectedUser(null); loadUsers(currentPage); loadStats(); }
  };

  const deleteUser = async () => {
    if (!selectedUser || !confirm(`${selectedUser.nickname} 회원을 탈퇴 처리하시겠습니까?`)) return;
    const res = await apiFetch(`/api/auth/admin/users/${selectedUser.id}`, { method: 'DELETE' });
    if (res?.ok) { showToast('탈퇴 처리됐습니다.'); setSelectedUser(null); loadUsers(currentPage); loadStats(); }
  };

  const resetPassword = async () => {
    if (!newPw || newPw.length < 8) { showToast('8자 이상 입력해주세요.', 'error'); return; }
    const res = await apiFetch(`/api/auth/admin/users/${showResetPw}/reset-password`, {
      method: 'POST', body: JSON.stringify({ newPassword: newPw })
    });
    if (res?.ok) { showToast('비밀번호가 초기화됐습니다.'); setShowResetPw(null); setNewPw(''); }
  };

  const fmtDate = (ts) => ts ? new Date(ts * 1000).toLocaleDateString('ko-KR') : '-';
  const fmtDateFull = (ts) => ts ? new Date(ts * 1000).toLocaleString('ko-KR') : '-';
  const maskEmail = (e) => { const [id, d] = e.split('@'); return id.slice(0,3) + '***@' + d; };

  // 로그인 안된 상태
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
        {/* 사이드바 */}
        <aside style={S.sidebar}>
          <div style={S.logo}>✈ Travellog <span style={{ fontSize: 10, color: '#818cf8' }}>Admin</span></div>
          <div style={S.navItem(page === 'dashboard')} onClick={() => setPage('dashboard')}>📊 대시보드</div>
          <div style={S.navItem(page === 'users')} onClick={() => setPage('users')}>👥 회원 관리</div>
          <div style={{ marginTop: 'auto' }}>
            <div style={{ padding: '10px 14px', borderRadius: 10, color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer' }}
              onClick={() => { window.location.href = '/'; }}>← 사이트로 돌아가기</div>
            <div style={{ padding: '10px 14px', borderRadius: 10, color: '#ef4444', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
              onClick={() => { setToken(''); sessionStorage.removeItem('admin_token'); }}>로그아웃</div>
          </div>
        </aside>

        {/* 메인 */}
        <main style={S.main}>
          {/* 대시보드 */}
          {page === 'dashboard' && (
            <>
              <div style={S.pageTitle}>대시보드</div>
              <div style={S.statsGrid}>
                {[
                  { label: '전체 회원', num: stats?.total_users ?? '-', color: '#4f46e5', sub: '누적 가입자' },
                  { label: '오늘 가입', num: stats?.today_joined ?? '-', color: '#10b981', sub: '최근 24시간' },
                  { label: '이번 주 가입', num: stats?.week_joined ?? '-', color: '#f59e0b', sub: '최근 7일' },
                  { label: '정지된 계정', num: stats?.suspended_users ?? '-', color: '#ef4444', sub: '이용 제한 중' },
                ].map(s => (
                  <div key={s.label} style={S.statCard()}>
                    <div style={S.statLabel}>{s.label}</div>
                    <div style={S.statNum(s.color)}>{s.num}</div>
                    <div style={S.statSub}>{s.sub}</div>
                  </div>
                ))}
              </div>
              <div style={S.tableWrap}>
                <div style={S.tableHeader}><div style={S.tableTitle}>최근 가입 회원</div></div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {['회원', '이메일', '가입일', '상태'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {recentUsers.map(u => (
                      <tr key={u.id}>
                        <td style={S.td}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#4f46e5' }}>{u.nickname[0]}</div>
                          <span style={{ fontWeight: 600 }}>{u.nickname}</span>
                        </div></td>
                        <td style={{ ...S.td, color: '#6b7280' }}>{maskEmail(u.email)}</td>
                        <td style={{ ...S.td, color: '#9ca3af' }}>{fmtDate(u.created_at)}</td>
                        <td style={S.td}><span style={S.badge(u.suspended ? 'red' : 'green')}>{u.suspended ? '정지' : '정상'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* 회원 관리 */}
          {page === 'users' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={S.pageTitle}>회원 관리</div>
              </div>
              <div style={S.tableWrap}>
                <div style={S.tableHeader}>
                  <div style={S.tableTitle}>전체 회원 <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>({total}명)</span></div>
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
                      <tr key={u.id} style={{ cursor: 'pointer' }}>
                        <td style={S.td}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#4f46e5', flexShrink: 0 }}>{u.nickname[0]}</div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{u.nickname}</div>
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>{u.id.slice(0,8)}...</div>
                          </div>
                        </div></td>
                        <td style={{ ...S.td, color: '#6b7280' }}>{maskEmail(u.email)}</td>
                        <td style={{ ...S.td, color: '#9ca3af' }}>{fmtDate(u.created_at)}</td>
                        <td style={{ ...S.td, color: '#9ca3af' }}>{u.last_login ? fmtDate(u.last_login) : '-'}</td>
                        <td style={S.td}><span style={S.badge(u.suspended ? 'red' : 'green')}>{u.suspended ? '정지' : '정상'}</span></td>
                        <td style={S.td}><div style={{ display: 'flex', gap: 5 }}>
                          <button style={S.btn('gray')} onClick={() => setSelectedUser(u)}>상세</button>
                          <button style={S.btn('warning')} onClick={() => { setShowResetPw(u.id); setNewPw(''); }}>PW초기화</button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* 페이지네이션 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 20px', borderTop: '1px solid #eee' }}>
                  {Array.from({ length: Math.ceil(total / 15) }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => loadUsers(p)}
                      style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #eee', background: p === currentPage ? '#4f46e5' : 'white', color: p === currentPage ? 'white' : '#555', fontSize: 13, cursor: 'pointer' }}>{p}</button>
                  ))}
                  <span style={{ fontSize: 13, color: '#9ca3af', marginLeft: 'auto' }}>{total}명 중 {(currentPage-1)*15+1}~{Math.min(currentPage*15, total)}명</span>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* 회원 상세 모달 */}
      {selectedUser && (
        <div style={S.modalOverlay} onClick={() => setSelectedUser(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>{selectedUser.nickname} 회원 정보</div>
            {[
              ['닉네임', selectedUser.nickname],
              ['이메일', selectedUser.email],
              ['소개', selectedUser.bio || '-'],
              ['가입일', fmtDateFull(selectedUser.created_at)],
              ['최근 로그인', fmtDateFull(selectedUser.last_login)],
              ['마케팅 동의', selectedUser.agree_marketing ? '동의' : '미동의'],
              ['계정 상태', selectedUser.suspended ? '정지' : '정상'],
            ].map(([k, v]) => (
              <div key={k} style={S.infoRow}>
                <span style={{ color: '#9ca3af', fontWeight: 600 }}>{k}</span>
                <span style={{ color: '#1a1a2e', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={S.btn(selectedUser.suspended ? 'primary' : 'warning')} onClick={toggleSuspend}>
                {selectedUser.suspended ? '정지 해제' : '계정 정지'}
              </button>
              <button style={S.btn('danger')} onClick={deleteUser}>탈퇴 처리</button>
              <button style={S.btn('gray')} onClick={() => setSelectedUser(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 초기화 모달 */}
      {showResetPw && (
        <div style={S.modalOverlay} onClick={() => setShowResetPw(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>비밀번호 초기화</div>
            <input style={{ ...S.input, width: '100%', marginBottom: 20 }} type="password"
              placeholder="새 비밀번호 (8자 이상, 대/소문자, 숫자)" value={newPw} onChange={e => setNewPw(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={S.btn('gray')} onClick={() => setShowResetPw(null)}>취소</button>
              <button style={S.btn('primary')} onClick={resetPassword}>초기화</button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && <div style={S.toast(toast.type)}>{toast.msg}</div>}
    </div>
  );
}
