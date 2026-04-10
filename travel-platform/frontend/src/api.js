async function req(url, options = {}) {
  const res = await fetch(url, {
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
  deleteComment: (postId, commentId) => req(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' }),
  updatePost: (id, data) => req(`/api/posts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePost: (id) => req(`/api/posts/${id}`, { method: 'DELETE' }),

  // Plan
  getPlan: (id) => req(`/api/plans/${id}`),
  createPlan: (data) => req('/api/plans', { method: 'POST', body: JSON.stringify(data) }),
  updatePlan: (id, data) => req(`/api/plans/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addPlanItem: (planId, data) => req(`/api/plans/${planId}/items`, { method: 'POST', body: JSON.stringify(data) }),
  removePlanItem: (planId, itemId) => req(`/api/plans/${planId}/items/${itemId}`, { method: 'DELETE' }),
  deletePlan: (id) => req(`/api/plans/${id}`, { method: 'DELETE' }),

  // Plan 협업
  inviteMember: (planId, userId) => req(`/api/plans/${planId}/members/${userId}`, { method: 'POST' }),
  removeMember: (planId, userId) => req(`/api/plans/${planId}/members/${userId}`, { method: 'DELETE' }),
  getMessages: (planId) => req(`/api/plans/${planId}/messages`),
  sendMessage: (planId, data) => req(`/api/plans/${planId}/messages`, { method: 'POST', body: JSON.stringify(data) }),
  getMemberPlans: (userId) => req(`/api/plans/member?userId=${userId}`),

  // Shared Plans
  getSharedPlans: (userId) => req(`/api/plans/shared?userId=${userId}`),

  // Report
  createReport: (data) => req('/api/reports', { method: 'POST', body: JSON.stringify(data) }),
  getReports: (status) => req(`/api/reports${status ? '?status=' + status : ''}`),
  resolveReport: (id, action) => req(`/api/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ action }) }),

  // Notice
  getNotices: (activeOnly) => req(`/api/notices${activeOnly ? '?active=true' : ''}`),
  createNotice: (data) => req('/api/notices', { method: 'POST', body: JSON.stringify(data) }),
  updateNotice: (id, data) => req(`/api/notices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteNotice: (id) => req(`/api/notices/${id}`, { method: 'DELETE' }),

  // 위치 기반 검색
  getPostsNearby: (lat, lng, radius = 2.0) => req(`/api/posts/nearby?lat=${lat}&lng=${lng}&radius=${radius}`),
  getSavedPlacesNearby: (userId, lat, lng, radius = 1.0) => req(`/api/users/${userId}/saved-nearby?lat=${lat}&lng=${lng}&radius=${radius}`),

  // 메뉴 관리
  getMenus: () => req('/api/menus'),
  saveMenus: (items) => req('/api/menus', { method: 'POST', body: JSON.stringify(items) }),

  // Bookmark
  toggleBookmark: (userId, postId) => req(`/api/users/${userId}/bookmark/${postId}`, { method: 'POST' }),

  // Wishlist
  toggleWishlist: (userId, postId) => req(`/api/users/${userId}/wishlist/${postId}`, { method: 'POST' }),

  // Promotion
  getPromotions: (all) => req(`/api/promotions${all ? '?all=true' : ''}`),
  createPromotion: (data) => req('/api/promotions', { method: 'POST', body: JSON.stringify(data) }),
  updatePromotion: (id, data) => req(`/api/promotions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePromotion: (id) => req(`/api/promotions/${id}`, { method: 'DELETE' }),

  // Admin
  getAdminPostStats: () => req('/api/admin/stats/posts'),
  hidePost: (id) => req(`/api/admin/posts/${id}/hide`, { method: 'POST' }),
  adminDeletePost: (id) => req(`/api/admin/posts/${id}`, { method: 'DELETE' }),

  // AI (Claude API)
  getAiTransport: (from, to) => req('/api/ai/transport', { method: 'POST', body: JSON.stringify({ from, to }) }),
  getAiTips: (destination, category) => req('/api/ai/tips', { method: 'POST', body: JSON.stringify({ destination, category }) }),
};
