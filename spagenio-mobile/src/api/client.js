import { API_BASE_URL, REQUEST_TIMEOUT } from './config';
import { getToken, clearToken } from '../auth/storage';

// 401 발생 시 호출될 핸들러. AuthContext 가 setOnUnauthorized 로 등록.
let onUnauthorized = null;
export function setOnUnauthorized(fn) { onUnauthorized = fn; }

async function request(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT);
  try {
    const finalHeaders = { 'Content-Type': 'application/json', ...headers };
    if (auth) {
      const token = await getToken();
      if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
    }
    const resp = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: finalHeaders,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    });
    const text = await resp.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

    if (resp.status === 401 && auth) {
      await clearToken();
      if (onUnauthorized) onUnauthorized();
    }
    if (!resp.ok) {
      const err = new Error(data?.error || `HTTP ${resp.status}`);
      err.status = resp.status;
      err.data = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get:  (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put:  (path, body, opts) => request(path, { ...opts, method: 'PUT',  body }),
  del:  (path, opts) => request(path, { ...opts, method: 'DELETE' }),
};
