import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { TRAVEL_STYLES } from '../travelStyles';

const getThumbUrl = (url) => {
  if (!url) return url;
  if (url.endsWith('.mp4')) {
    return url.replace('_video.mp4', '_thumb.jpg').replace(/_video\.mp4$/, '_thumb.jpg');
  }
  return url;
};

// 팔로워/팔로잉 목록 모달
function UserListModal({ title, users, currentUser, onClose, onProfile, onFollow }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="modal-title" style={{ marginBottom: 0 }}>{title}</div>
          <button onClick={onClose} style={{ fontSize: 20, color: '#8A919C', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
        {users.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#bbb', padding: '24px 0', fontSize: 14 }}>목록이 없어요.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto' }}>
            {users.map(u => {
              const isFollowing = currentUser?.followingIds?.includes(u.id);
              const isMe = currentUser?.id === u.id;
              return (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={u.profileImage || `https://ui-avatars.com/api/?name=${u.nickname}&background=1E2A3A&color=fff&size=40`}
                    alt={u.nickname} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
                    onClick={() => { onProfile?.(u.id); onClose(); }} />
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { onProfile?.(u.id); onClose(); }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1E2A3A' }}>{u.nickname}</div>
                    {u.bio && <div style={{ fontSize: 12, color: '#8A919C' }}>{u.bio}</div>}
                  </div>
                  {!isMe && currentUser && (
                    <button className={isFollowing ? 'btn-following' : 'btn-follow'}
                      style={{ fontSize: 12, padding: '6px 14px' }}
                      onClick={() => onFollow?.(u.id, isFollowing)}>
                      {isFollowing ? 'FOLLOWING' : 'FOLLOW'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Profile({ userId, currentUser, onOpenPost, onChangeUser, onProfile }) {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [modalUsers, setModalUsers] = useState([]);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ nickname: '', bio: '', profileImage: '', preferredStyles: [], nationality: 'KR', wishCountries: [] });
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileTab, setProfileTab] = useState('posts');
  const [bizAccount, setBizAccount] = useState(null);
  const [bizLoading, setBizLoading] = useState(false);
  const [showBizForm, setShowBizForm] = useState(false);

  const loadBizAccount = async (uid) => {
    try {
      const res = await fetch('/api/business/' + uid);
      if (res.ok) { const data = await res.json(); setBizAccount(data); }
    } catch (e) { }
  };

  const registerBusiness = async () => {
    if (!bizForm.business_name) { alert('업체명을 입력해주세요.'); return; }
    setBizLoading(true);
    try {
      const res = await fetch('/api/business/register?' + new URLSearchParams({ ...bizForm, user_id: user.id }), { method: 'POST' });
      if (res.ok) {
        alert('비즈니스 계정 신청이 완료되었습니다! 관리자 심사 후 승인됩니다.');
        loadBizAccount(user.id);
        setShowBizForm(false);
      } else {
        const data = await res.json();
        alert(data.detail || '등록 실패');
      }
    } catch (e) { alert('서버 오류'); }
    setBizLoading(false);
  };

  const [bizForm, setBizForm] = useState({ category: 'restaurant', business_name: '', business_description: '', business_phone: '', business_email: '', business_website: '', business_country: '', business_city: '', business_document: '' }); // posts | saved | badges

  useEffect(() => { load(); }, [userId]);

  const load = async () => {
    setLoading(true);
    try {
      const [u, p] = await Promise.all([api.getUser(userId), api.getUserPosts(userId)]);
      setUser(u); setPosts(p || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const isMe = currentUser?.id === userId;
  const isFollowing = currentUser?.followingIds?.includes(userId);
  const isBlocked = currentUser?.blockedIds?.includes(userId);

  const handleFollow = async (targetId, isFollowing) => {
    if (!currentUser) return;
    try {
      if (isFollowing) {
        await api.unfollow(currentUser.id, targetId);
        onChangeUser?.({ ...currentUser, followingIds: currentUser.followingIds.filter(id => id !== targetId) });
        if (targetId === userId) setUser(prev => ({ ...prev, followerIds: prev.followerIds.filter(id => id !== currentUser.id) }));
      } else {
        await api.follow(currentUser.id, targetId);
        onChangeUser?.({ ...currentUser, followingIds: [...(currentUser.followingIds || []), targetId] });
        if (targetId === userId) setUser(prev => ({ ...prev, followerIds: [...(prev.followerIds || []), currentUser.id] }));
      }
    } catch (e) { console.error(e); }
  };

  const handleBlock = async () => {
    if (!currentUser) return;
    try {
      if (isBlocked) {
        await api.unblock(currentUser.id, userId);
        onChangeUser?.({ ...currentUser, blockedIds: currentUser.blockedIds.filter(id => id !== userId) });
      } else {
        await api.block(currentUser.id, userId);
        onChangeUser?.({ ...currentUser, blockedIds: [...(currentUser.blockedIds || []), userId], followingIds: currentUser.followingIds.filter(id => id !== userId) });
      }
      setShowBlockConfirm(false);
    } catch (e) { console.error(e); }
  };

  const openModal = async (type) => {
    try {
      const users = type === 'followers' ? await api.getFollowers(userId) : await api.getFollowings(userId);
      setModalUsers(users || []);
      setModal(type);
    } catch (e) { console.error(e); }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) { alert('이미지 크기는 30MB 이하여야 해요.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) { const t = await res.text(); throw new Error(t || '업로드 실패'); }
      const data = await res.json();
      const uploadedUrl = data.feed || data.url;
      // 파일 생성 완료 -> DB에 즉시 SAVE
      await api.updateUser(userId, { profileImage: uploadedUrl });
      setEditData(p => ({ ...p, profileImage: uploadedUrl }));
      setImagePreview(uploadedUrl);
      setUser(prev => ({ ...prev, profileImage: uploadedUrl }));
      onChangeUser?.({ ...currentUser, profileImage: uploadedUrl });
      // sessionStorage 업데이트
      const savedUser = JSON.parse(sessionStorage.getItem('auth_user') || '{}');
      sessionStorage.setItem('auth_user', JSON.stringify({ ...savedUser, profileImage: uploadedUrl }));
    } catch (err) {
      alert('이미지 업로드 실패: ' + err.message);
    }
  };

  const handleSaveProfile = async () => {
    if (!editData.nickname.trim()) return;
    setSaving(true);
    try {
      const payload = { nickname: editData.nickname, bio: editData.bio, preferredStyles: editData.preferredStyles, nationality: editData.nationality, wishCountries: JSON.stringify(editData.wishCountries) };
      if (editData.profileImage) payload.profileImage = editData.profileImage;
      await api.updateUser(userId, payload);
      const updated = { ...currentUser, nickname: editData.nickname, bio: editData.bio, preferredStyles: editData.preferredStyles, nationality: editData.nationality, wishCountries: JSON.stringify(editData.wishCountries), ...(editData.profileImage ? { profileImage: editData.profileImage } : {}) };
      setUser(prev => ({ ...prev, ...updated }));
      onChangeUser?.(updated);
      // sessionStorage 업데이트
      const savedUser = JSON.parse(sessionStorage.getItem('auth_user') || '{}');
      sessionStorage.setItem('auth_user', JSON.stringify({ ...savedUser, nationality: editData.nationality, wishCountries: JSON.stringify(editData.wishCountries) }));
      setEditing(false);
      setImagePreview('');
    } catch (e) { alert('SAVE 실패: ' + e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="empty">불러오는 중...</div>;
  if (!user) return <div className="empty">유저를 찾을 수 없어요.</div>;

  const visiblePosts = isMe ? posts : posts.filter(p => p.visibility !== 'private');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="profile-header">
        <img className="avatar avatar-xl"
          src={user.profileImage || `https://ui-avatars.com/api/?name=${user.nickname}&background=1E2A3A&color=fff&size=110`}
          alt={user.nickname} />
        <div className="profile-info">
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A' }}>프로필 편집</div>

              {/* 사진 변경 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img src={imagePreview || editData.profileImage || user.profileImage || `https://ui-avatars.com/api/?name=${user.nickname}&background=1E2A3A&color=fff&size=80`}
                  style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #E2E0DC' }} alt="" />
                <label style={{ cursor: 'pointer' }}>
                  <div style={{ padding: '7px 14px', background: '#F5F4F0', border: '1px solid #E2E0DC', borderRadius: 9, fontSize: 12, fontWeight: 600, color: '#555' }}>
                    📷 사진 변경
                  </div>
                  <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                </label>
                <span style={{ fontSize: 11, color: '#8A919C' }}>JPG, PNG / 30MB 이하</span>
              </div>

              <input value={editData.nickname} onChange={e => setEditData(p => ({ ...p, nickname: e.target.value }))}
                placeholder="Nickname" maxLength={20}
                style={{ padding: '9px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 14, outline: 'none' }} />
              <textarea value={editData.bio} onChange={e => setEditData(p => ({ ...p, bio: e.target.value }))}
                placeholder="소개글 (선택)" rows={3} maxLength={100}
                style={{ padding: '9px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none', resize: 'vertical' }} />

              {/* 여행 성향 */}
              <div>
                <div style={{ fontSize: 12, color: '#8A919C', marginBottom: 8, fontWeight: 600 }}>✈️ 여행 성향 (복수 선택)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {TRAVEL_STYLES.map(s => {
                    const selected = (editData.preferredStyles || []).includes(s.key);
                    return (
                      <button key={s.key} type="button" onClick={() => setEditData(p => ({
                        ...p,
                        preferredStyles: selected
                          ? p.preferredStyles.filter(k => k !== s.key)
                          : [...(p.preferredStyles || []), s.key]
                      }))}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 2, border: `1.5px solid ${selected ? s.color : '#E2E0DC'}`, background: selected ? s.bg : 'white', color: selected ? s.color : '#8A919C', fontSize: 12, fontWeight: selected ? 700 : 500, cursor: 'pointer' }}>
                        <span style={{ fontSize: 14 }}>{s.icon}</span> {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 국적 */}
              <div>
                <div style={{ fontSize: 12, color: '#8A919C', marginBottom: 8, fontWeight: 600 }}>🌏 국적</div>
                <select value={editData.nationality} onChange={e => setEditData(p => ({ ...p, nationality: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none', background: 'white' }}>
                  <option value="KR">🇰🇷 대한민국</option>
                  <option value="JP">🇯🇵 일본</option>
                  <option value="US">🇺🇸 미국</option>
                  <option value="EU">🇪🇺 유럽 (유로)</option>
                  <option value="TH">🇹🇭 태국</option>
                  <option value="CN">🇨🇳 중국</option>
                  <option value="GB">🇬🇧 영국</option>
                  <option value="AU">🇦🇺 호주</option>
                  <option value="SG">🇸🇬 싱가포르</option>
                  <option value="MY">🇲🇾 말레이시아</option>
                  <option value="VN">🇻🇳 베트남</option>
                  <option value="ID">🇮🇩 인도네시아</option>
                  <option value="PH">🇵🇭 필리핀</option>
                </select>
              </div>

              {/* 가고싶은 나라 */}
              <div>
                <div style={{ fontSize: 12, color: '#8A919C', marginBottom: 8, fontWeight: 600 }}>✈️ 가고싶은 나라 <span style={{ fontWeight: 400 }}>(복수 선택)</span></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    { code: 'JP', label: '🇯🇵 일본' }, { code: 'US', label: '🇺🇸 미국' },
                    { code: 'FR', label: '🇫🇷 프랑스' }, { code: 'IT', label: '🇮🇹 이탈리아' },
                    { code: 'TH', label: '🇹🇭 태국' }, { code: 'ID', label: '🇮🇩 발리' },
                    { code: 'ES', label: '🇪🇸 스페인' }, { code: 'GB', label: '🇬🇧 영국' },
                    { code: 'AU', label: '🇦🇺 호주' }, { code: 'SG', label: '🇸🇬 싱가포르' },
                    { code: 'VN', label: '🇻🇳 베트남' }, { code: 'CN', label: '🇨🇳 중국' },
                    { code: 'HK', label: '🇭🇰 홍콩' }, { code: 'TR', label: '🇹🇷 터키' },
                    { code: 'MA', label: '🇲🇦 모로코' }, { code: 'MX', label: '🇲🇽 멕시코' },
                    { code: 'CZ', label: '🇨🇿 체코' }, { code: 'NL', label: '🇳🇱 네덜란드' },
                    { code: 'AE', label: '🇦🇪 두바이' }, { code: 'HW', label: '🌺 하와이' },
                  ].map(c => {
                    const selected = (editData.wishCountries || []).includes(c.code);
                    return (
                      <button key={c.code} type="button"
                        onClick={() => setEditData(p => ({ ...p, wishCountries: selected ? p.wishCountries.filter(x => x !== c.code) : [...(p.wishCountries || []), c.code] }))}
                        style={{ padding: '5px 10px', borderRadius: 2, border: `1.5px solid ${selected ? '#1E2A3A' : '#E2E0DC'}`, background: selected ? '#EEEDEA' : 'white', color: selected ? '#1E2A3A' : '#8A919C', fontSize: 12, fontWeight: selected ? 700 : 500, cursor: 'pointer' }}>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleSaveProfile} disabled={saving || uploading}
                  style={{ flex: 1, padding: '9px', background: uploading ? '#8A919C' : '#1E2A3A', color: 'white', border: 'none', borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer' }}>
                  {uploading ? '업로드 중...' : saving ? 'SAVE 중...' : 'SAVE'}
                </button>
                <button onClick={() => { setEditing(false); setImagePreview(''); }}
                  style={{ flex: 1, padding: '9px', background: '#F5F4F0', color: '#555', border: 'none', borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
                  CANCEL
                </button>
              </div>

              {/* ── 계정 유형 관리 (PC만) ── */}
              <div className="business-section" style={{ marginTop: 8, padding: 16, background: '#FAFAF8', borderRadius: 3, border: '1px solid #F0EEE9' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A', marginBottom: 8 }}>🏢 계정 유형</div>

                {bizAccount ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#4A5568' }}>
                        {bizAccount.account_type === 'official' ? '★ 공식 계정' : bizAccount.badge_type === 'verified' ? '✓ 인증된 비즈니스' : bizAccount.badge_type === 'premium' ? '♦ 프리미엄' : '🏢 비즈니스'}
                      </span>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 2,
                        background: bizAccount.status === 'approved' ? '#ecfdf5' : bizAccount.status === 'pending' ? '#fffbeb' : '#fef2f2',
                        color: bizAccount.status === 'approved' ? '#10b981' : bizAccount.status === 'pending' ? '#f59e0b' : '#ef4444',
                        fontWeight: 700
                      }}>
                        {bizAccount.status === 'approved' ? '승인됨' : bizAccount.status === 'pending' ? '심사 중' : '거절'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#8A919C' }}>
                      <div>{bizAccount.business_name}</div>
                      {bizAccount.business_description && <div style={{ marginTop: 2 }}>{bizAccount.business_description}</div>}
                      {bizAccount.reject_reason && <div style={{ color: '#ef4444', marginTop: 4 }}>거절 사유: {bizAccount.reject_reason}</div>}
                    </div>
                  </div>
                ) : showBizForm ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 12, color: '#8A919C', marginBottom: 4 }}>카테고리 선택</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[
                        { key: 'restaurant', icon: '🍽️', label: '음식점' },
                        { key: 'hotel', icon: '🏨', label: '숙소' },
                        { key: 'tour', icon: '🎒', label: '투어' },
                        { key: 'city', icon: '🏙️', label: '관광청' },
                        { key: 'transport', icon: '✈️', label: '교통' },
                        { key: 'shopping', icon: '🛍️', label: '쇼핑' },
                        { key: 'creator', icon: '🎬', label: '크리에이터' },
                        { key: 'other', icon: '📢', label: '기타' },
                      ].map(cat => (
                        <button key={cat.key} type="button" onClick={() => setBizForm(p => ({ ...p, category: cat.key }))}
                          style={{
                            padding: '5px 10px', borderRadius: 2, border: bizForm.category === cat.key ? '1.5px solid #1E2A3A' : '1px solid #E2E0DC',
                            background: bizForm.category === cat.key ? '#FAFAF8' : 'white', color: bizForm.category === cat.key ? '#1E2A3A' : '#8A919C',
                            fontSize: 11, fontWeight: bizForm.category === cat.key ? 700 : 500, cursor: 'pointer'
                          }}>
                          {cat.icon} {cat.label}
                        </button>
                      ))}
                    </div>
                    <input placeholder="업체명/이름 *" value={bizForm.business_name} onChange={e => setBizForm(p => ({ ...p, business_name: e.target.value }))}
                      style={{ padding: '9px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none' }} />
                    <textarea placeholder="소개 (선택)" rows={2} value={bizForm.business_description} onChange={e => setBizForm(p => ({ ...p, business_description: e.target.value }))}
                      style={{ padding: '9px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none', resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input placeholder="국가" value={bizForm.business_country} onChange={e => setBizForm(p => ({ ...p, business_country: e.target.value }))}
                        style={{ flex: 1, padding: '9px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none' }} />
                      <input placeholder="도시" value={bizForm.business_city} onChange={e => setBizForm(p => ({ ...p, business_city: e.target.value }))}
                        style={{ flex: 1, padding: '9px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none' }} />
                    </div>
                    <input placeholder="웹사이트 (선택)" value={bizForm.business_website} onChange={e => setBizForm(p => ({ ...p, business_website: e.target.value }))}
                      style={{ padding: '9px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none' }} />
                    <input placeholder="연락처 (선택)" value={bizForm.business_phone} onChange={e => setBizForm(p => ({ ...p, business_phone: e.target.value }))}
                      style={{ padding: '9px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none' }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={registerBusiness} disabled={bizLoading}
                        style={{ flex: 1, padding: '9px', background: '#1E2A3A', color: 'white', border: 'none', borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        {bizLoading ? '신청 중...' : '🚀 비즈니스 신청'}
                      </button>
                      <button onClick={() => setShowBizForm(false)}
                        style={{ padding: '9px 16px', background: '#F5F4F0', color: '#555', border: 'none', borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>CANCEL</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 12, color: '#8A919C', marginBottom: 8 }}>일반 계정입니다. 비즈니스 계정으로 전환하면 인증 배지와 통계 기능을 사용할 수 있어요.</div>
                    <button onClick={() => setShowBizForm(true)}
                      style={{ padding: '8px 16px', background: '#1E2A3A', color: 'white', border: 'none', borderRadius: 2, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      🏢 비즈니스 계정으로 전환
                    </button>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="profile-name">{user.nickname}</div>
                {isMe && (
                  <button onClick={() => { setEditing(true); setEditData({ nickname: user.nickname, bio: user.bio || '', profileImage: '', preferredStyles: user.preferredStyles || [], nationality: user.nationality || 'KR', wishCountries: JSON.parse(user.wishCountries || '[]') }); setImagePreview(''); }}
                    style={{ padding: '5px 12px', background: '#F5F4F0', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 12, fontWeight: 600, color: '#555', cursor: 'pointer' }}>
                    ✏️ 편집
                  </button>
                )}
              </div>
              {user.bio && <div className="profile-bio">{user.bio}</div>}
              <div className="profile-stats">
                <div className="stat"><div className="stat-num">{visiblePosts.length}</div><div className="stat-label">POSTS</div></div>
                <div className="stat" style={{ cursor: 'pointer' }} onClick={() => openModal('followers')}>
                  <div className="stat-num">{user.followerIds?.length || 0}</div>
                  <div className="stat-label">팔로워</div>
                </div>
                <div className="stat" style={{ cursor: 'pointer' }} onClick={() => openModal('followings')}>
                  <div className="stat-num">{user.followingIds?.length || 0}</div>
                  <div className="stat-label">팔로잉</div>
                </div>
                <div className="stat"><div className="stat-num">{user.visitedCountries || 0}</div><div className="stat-label">방문국가</div></div>
              </div>
              {!isMe && currentUser && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className={isFollowing ? 'btn-following' : 'btn-follow'}
                    onClick={() => handleFollow(userId, isFollowing)}>
                    {isFollowing ? 'FOLLOWING' : 'FOLLOW'}
                  </button>
                  <button onClick={() => setShowBlockConfirm(true)}
                    style={{ padding: '9px 16px', borderRadius: 2, border: '1px solid #E2E0DC', background: 'white', fontSize: 13, color: isBlocked ? '#ef4444' : '#8A919C', fontWeight: 600, cursor: 'pointer' }}>
                    {isBlocked ? '차단 해제' : '차단'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 차단 확인 */}
      {showBlockConfirm && (
        <div className="modal-overlay" onClick={() => setShowBlockConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-title">{isBlocked ? '차단 해제' : `${user.nickname}님을 차단할까요?`}</div>
            <p style={{ fontSize: 14, color: '#8A919C', lineHeight: 1.7 }}>
              {isBlocked
                ? '차단을 해제하면 상대방의 POSTS이 다시 보여요.'
                : '차단하면 상대방의 POSTS이 보이지 않고, FOLLOW 관계가 해제돼요.'}
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowBlockConfirm(false)}>CANCEL</button>
              <button className="btn-cancel" onClick={handleBlock}>{isBlocked ? '차단 해제' : '차단'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 팔로워/팔로잉 모달 */}
      {modal && (
        <UserListModal
          title={modal === 'followers' ? 'FOLLOWERS' : 'FOLLOWING'}
          users={modalUsers}
          currentUser={currentUser}
          onClose={() => setModal(null)}
          onProfile={onProfile}
          onFollow={handleFollow}
        />
      )}

      {/* 프로필 탭 */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E2E0DC' }}>
        {[
          { key: 'posts', label: `📷 POSTS ${visiblePosts.length}` },
          ...(isMe ? [{ key: 'saved', label: `🔖 SAVED` }] : []),
          { key: 'badges', label: `🏅 BADGES ${user.badges?.length || 0}` },
        ].map(t => (
          <button key={t.key} onClick={() => setProfileTab(t.key)}
            style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', borderBottom: `2px solid ${profileTab === t.key ? '#1E2A3A' : 'transparent'}`, color: profileTab === t.key ? '#1E2A3A' : '#8A919C', fontSize: 13, fontWeight: profileTab === t.key ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* POSTS 탭 */}
      {profileTab === 'posts' && (
        visiblePosts.length === 0 ? (
          <div className="empty">아직 POSTS이 없어요.</div>
        ) : (
          <div className="profile-grid">
            {visiblePosts.map(post => (
              <div key={post.id} className="profile-grid-item" onClick={() => onOpenPost?.(post)}>
                {post.images?.[0]
                  ? <img src={getThumbUrl(post.images[0])} alt={post.title} />
                  : <div style={{ width: '100%', height: '100%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>✈️</div>
                }
                {post.visibility === 'private' && (
                  <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: 'white' }}>🔒</div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* SAVE된 POSTS 탭 (본인만) */}
      {profileTab === 'saved' && isMe && (
        <SavedPosts userId={userId} savedPostIds={user.savedPostIds || []} onOpenPost={onOpenPost} />
      )}

      {/* BADGES 탭 */}
      {profileTab === 'badges' && (
        <BadgeGrid badges={user.badges || []} posts={visiblePosts} user={user} />
      )}
    </div>
  );
}

// ── SAVE된 POSTS ───────────────────────────────────────
function SavedPosts({ userId, savedPostIds, onOpenPost }) {
  const [savedPosts, setSavedPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!savedPostIds.length) { setLoading(false); return; }
      try {
        const all = await api.getPosts();
        setSavedPosts((all || []).filter(p => savedPostIds.includes(p.id)));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [savedPostIds]);

  if (loading) return <div className="empty">불러오는 중...</div>;
  if (!savedPosts.length) return <div className="empty">SAVE된 POSTS이 없어요.<br />POSTS 상세에서 🔖 버튼으로 SAVE해보세요!</div>;

  return (
    <div className="profile-grid">
      {savedPosts.map(post => (
        <div key={post.id} className="profile-grid-item" onClick={() => onOpenPost?.(post)}>
          {post.images?.[0]
            ? <img src={getThumbUrl(post.images[0])} alt={post.title} />
            : <div style={{ width: '100%', height: '100%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>✈️</div>
          }
        </div>
      ))}
    </div>
  );
}

// ── BADGES 그리드 ─────────────────────────────────────────
const BADGE_INFO = {
  first_post: { icon: '✏️', name: '첫 POSTS', desc: '첫 번째 여행 이야기 작성' },
  ten_posts: { icon: '📝', name: '여행 작가', desc: 'POSTS 10개 달성' },
  fifty_posts: { icon: '📚', name: '여행 전문가', desc: 'POSTS 50개 달성' },
  likes_100: { icon: '❤️', name: '인기 여행자', desc: '좋아요 100개 달성' },
  likes_1000: { icon: '🔥', name: '여행 인플루언서', desc: '좋아요 1000개 달성' },
  followers_10: { icon: '👥', name: '친구 만들기', desc: '팔로워 10명 달성' },
  followers_100: { icon: '🌟', name: '여행 스타', desc: '팔로워 100명 달성' },
  countries_5: { icon: '🗺️', name: '세계 탐험가', desc: '5개국 방문' },
  countries_10: { icon: '✈️', name: '글로벌 여행자', desc: '10개국 방문' },
  countries_30: { icon: '🌍', name: '세계 일주', desc: '30개국 방문' },
};

function BadgeGrid({ badges, posts, user }) {
  const allBadgeKeys = Object.keys(BADGE_INFO);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: '#8A919C' }}>획득한 BADGES {badges.length}개 / 전체 {allBadgeKeys.length}개</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
        {allBadgeKeys.map(key => {
          const info = BADGE_INFO[key];
          const earned = badges.includes(key);
          return (
            <div key={key} style={{ border: `1px solid ${earned ? '#c7d2fe' : '#E2E0DC'}`, borderRadius: 3, padding: '14px 12px', textAlign: 'center', background: earned ? '#fafbff' : '#FAFAF8', opacity: earned ? 1 : 0.5 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{info.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: earned ? '#1E2A3A' : '#8A919C', marginBottom: 3 }}>{info.name}</div>
              <div style={{ fontSize: 11, color: '#8A919C', lineHeight: 1.4 }}>{info.desc}</div>
              {earned && <div style={{ fontSize: 10, color: '#1E2A3A', fontWeight: 700, marginTop: 6 }}>✓ 획득</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
