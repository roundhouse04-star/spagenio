import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setOnUnauthorized } from '../api/client';
import { getToken, saveToken, clearToken, getUser, saveUser } from './storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  // 부팅 시 저장된 토큰 로드
  useEffect(() => {
    (async () => {
      const t = await getToken();
      const u = await getUser();
      if (t) setToken(t);
      if (u) setUser(u);
      setBootstrapping(false);
    })();
  }, []);

  // 401 → 자동 로그아웃 핸들러 등록
  useEffect(() => {
    setOnUnauthorized(() => {
      setToken(null);
      setUser(null);
    });
  }, []);

  const login = useCallback(async (username, password) => {
    // 일반 로그인. 어드민 로그인은 /api/auth/admin-login 으로 분기 가능 (추후).
    const data = await api.post('/api/auth/login', { username, password }, { auth: false });
    if (!data?.token) throw new Error('토큰 응답 없음');
    const u = { username: data.username || username, is_admin: !!data.is_admin };
    await saveToken(data.token);
    await saveUser(u);
    setToken(data.token);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/api/auth/logout'); } catch (_) {}
    await clearToken();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, bootstrapping }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
