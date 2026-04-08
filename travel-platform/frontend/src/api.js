const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const BASE = isLocal ? 'http://localhost:19080' : '';

async function req(url, options = {}) {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (res.status === 204) return null;
  const text = await res.text();
  if (!res.ok) throw new Error(JSON.parse(text)?.message || `HTTP ${res.status}`);
  return text ? JSON.parse(text) : null;
}

export const api = {
  // User
  getUsers: () => req('/api/users'),
  getUser: (id) => req(`/api/users/${id}`),
  createUser: (data) => req('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => req(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  follow: (userId, targetId) => req(`/api/users/${userId}/follow/${targetId}`, { method: 'POST' }),
  unfollow: (userId, targetId) => req(`/api/users/${userId}/unfollow/${targetId}`, { method: 'POST' }),
  block: (userId, targetId) => req(`/api/users/${userId}/block/${targetId}`, { method: 'POST' }),
  unblock: (userId, targetId) => req(`/api/users/${userId}/unblock/${targetId}`, { method: 'POST' }),
  getFollowers: (userId) => req(`/api/users/${userId}/followers`),
  getFollowings: (userId) => req(`/api/users/${userId}/followings`),
  getUserPosts: (userId) => req(`/api/users/${userId}/posts`),
  getUserPlans: (userId) => req(`/api/users/${userId}/plans`),

  // Post
  getPosts: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v)));
    return req(`/api/posts${q.toString() ? '?' + q : ''}`);
  },
  getFeed: (userId) => req(`/api/posts?userId=${userId}&feed=true`),
  getPost: (id) => req(`/api/posts/${id}`),
  createPost: (data) => req('/api/posts', { method: 'POST', body: JSON.stringify(data) }),
  toggleLike: (id, userId) => req(`/api/posts/${id}/like`, { method: 'POST', body: JSON.stringify({ userId }) }),
  addComment: (id, data) => req(`/api/posts/${id}/comments`, { method: 'POST', body: JSON.stringify(data) }),
  deletePost: (id) => req(`/api/posts/${id}`, { method: 'DELETE' }),

  // Plan
  getPlan: (id) => req(`/api/plans/${id}`),
  createPlan: (data) => req('/api/plans', { method: 'POST', body: JSON.stringify(data) }),
  updatePlan: (id, data) => req(`/api/plans/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addPlanItem: (planId, data) => req(`/api/plans/${planId}/items`, { method: 'POST', body: JSON.stringify(data) }),
  removePlanItem: (planId, itemId) => req(`/api/plans/${planId}/items/${itemId}`, { method: 'DELETE' }),
  deletePlan: (id) => req(`/api/plans/${id}`, { method: 'DELETE' }),
};
