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

// FOLLOWERS/FOLLOWING List Modal
function UserListModal({ title, users, currentUser, onClose, onProfile, onFollow }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="modal-title" style={{ marginBottom: 0 }}>{title}</div>
          <button onClick={onClose} style={{ fontSize: 20, color: '#8A919C', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
        {users.length === 0? (
          <div style={{ textAlign: 'center', color: '#bbb', padding: '24px 0', fontSize: 14 }}>List None.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: 400, overflowY: 'auto' }}>
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
                    <button className={isFollowing? 'btn-following' : 'btn-follow'}
                      style={{ fontSize: 12, padding: '6px 14px' }}
                      onClick={() => onFollow?.(u.id, isFollowing)}>
                      {isFollowing? 'FOLLOWING' : 'FOLLOW'}
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
    if (!bizForm.business_name) { alert('Business name '); return; }
    setBizLoading(true);
    try {
      const res = await fetch('/api/business/register?' + new URLSearchParams({...bizForm, user_id: user.id }), { method: 'POST' });
      if (res.ok) {
        alert('Business account application submitted. Pending admin review.');
        loadBizAccount(user.id);
        setShowBizForm(false);
      } else {
        const data = await res.json();
        alert(data.detail || 'REGISTER failed');
      }
    } catch (e) { alert('Server error'); }
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
        onChangeUser?.({...currentUser, followingIds: currentUser.followingIds.filter(id => id!== targetId) });
        if (targetId === userId) setUser(prev => ({...prev, followerIds: prev.followerIds.filter(id => id!== currentUser.id) }));
      } else {
        await api.follow(currentUser.id, targetId);
        onChangeUser?.({...currentUser, followingIds: [...(currentUser.followingIds || []), targetId] });
        if (targetId === userId) setUser(prev => ({...prev, followerIds: [...(prev.followerIds || []), currentUser.id] }));
      }
    } catch (e) { console.error(e); }
  };

  const handleBlock = async () => {
    if (!currentUser) return;
    try {
      if (isBlocked) {
        await api.unblock(currentUser.id, userId);
        onChangeUser?.({...currentUser, blockedIds: currentUser.blockedIds.filter(id => id!== userId) });
      } else {
        await api.block(currentUser.id, userId);
        onChangeUser?.({...currentUser, blockedIds: [...(currentUser.blockedIds || []), userId], followingIds: currentUser.followingIds.filter(id => id!== userId) });
      }
      setShowBlockConfirm(false);
    } catch (e) { console.error(e); }
  };

  const openModal = async (type) => {
    try {
      const users = type === 'followers'? await api.getFollowers(userId) : await api.getFollowings(userId);
      setModalUsers(users || []);
      setModal(type);
    } catch (e) { console.error(e); }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) { alert('Image must be under 30MB.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) { const t = await res.text(); throw new Error(t || 'Upload failed'); }
      const data = await res.json();
      const uploadedUrl = data.feed || data.url;
      // file Created -> DB in immediately SAVE
      await api.updateUser(userId, { profileImage: uploadedUrl });
      setEditData(p => ({...p, profileImage: uploadedUrl }));
      setImagePreview(uploadedUrl);
      setUser(prev => ({...prev, profileImage: uploadedUrl }));
      onChangeUser?.({...currentUser, profileImage: uploadedUrl });
      // sessionStorage Update
      const savedUser = JSON.parse(sessionStorage.getItem('auth_user') || '{}');
      sessionStorage.setItem('auth_user', JSON.stringify({...savedUser, profileImage: uploadedUrl }));
    } catch (err) {
      alert('Image Upload failed: ' + err.message);
    }
  };

  const handleSaveProfile = async () => {
    if (!editData.nickname.trim()) return;
    setSaving(true);
    try {
      const payload = { nickname: editData.nickname, bio: editData.bio, preferredStyles: editData.preferredStyles, nationality: editData.nationality, wishCountries: JSON.stringify(editData.wishCountries) };
      if (editData.profileImage) payload.profileImage = editData.profileImage;
      await api.updateUser(userId, payload);
      const updated = {...currentUser, nickname: editData.nickname, bio: editData.bio, preferredStyles: editData.preferredStyles, nationality: editData.nationality, wishCountries: JSON.stringify(editData.wishCountries),...(editData.profileImage? { profileImage: editData.profileImage } : {}) };
      setUser(prev => ({...prev,...updated }));
      onChangeUser?.(updated);
      // sessionStorage Update
      const savedUser = JSON.parse(sessionStorage.getItem('auth_user') || '{}');
      sessionStorage.setItem('auth_user', JSON.stringify({...savedUser, nationality: editData.nationality, wishCountries: JSON.stringify(editData.wishCountries) }));
      setEditing(false);
      setImagePreview('');
    } catch (e) { alert('SAVE failed: ' + e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="empty">Loading...</div>;
  if (!user) return <div className="empty">User not found.</div>;

  const visiblePosts = isMe? posts : posts.filter(p => p.visibility!== 'private');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="profile-header">
        <img className="avatar avatar-xl"
          src={user.profileImage || `https://ui-avatars.com/api/?name=${user.nickname}&background=1E2A3A&color=fff&size=110`}
          alt={user.nickname} />
        <div className="profile-info">
          {editing? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A' }}>PROFILE EDIT</div>

              {/* Photo Change */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img src={imagePreview || editData.profileImage || user.profileImage || `https://ui-avatars.com/api/?name=${user.nickname}&background=1E2A3A&color=fff&size=80`}
                  style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #E2E0DC' }} alt="" />
                <label style={{ cursor: 'pointer' }}>
                  <div style={{ padding: '7px 14px', background: '#F5F4F0', border: '1px solid #E2E0DC', borderRadius: 9, fontSize: 12, fontWeight: 600, color: '#555' }}>
                    📷 Photo Change
                  </div>
                  <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                </label>
                <span style={{ fontSize: 11, color: '#8A919C' }}>JPG, PNG / 30MB </span>
              </div>

              <input value={editData.nickname} onChange={e => setEditData(p => ({...p, nickname: e.target.value }))}
                placeholder="Nickname" maxLength={20}
                style={{ padding: '9px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 14, outline: 'none' }} />
              <textarea value={editData.bio} onChange={e => setEditData(p => ({...p, bio: e.target.value }))}
                placeholder="Short bio (optional)" rows={3} maxLength={100}
                style={{ padding: '9px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none', resize: 'vertical' }} />

              {/* TRAVEL Preferences */}
              <div>
                <div style={{ fontSize: 12, color: '#8A919C', marginBottom: 8, fontWeight: 600 }}>✈️ TRAVEL Preferences (Multiple SELECT)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {TRAVEL_STYLES.map(s => {
                    const Selected = (editData.preferredStyles || []).includes(s.key);
                    return (
                      <button key={s.key} type="button" onClick={() => setEditData(p => ({
                       ...p,
                        preferredStyles: Selected
                         ? p.preferredStyles.filter(k => k!== s.key)
                          : [...(p.preferredStyles || []), s.key]
                      }))}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 2, border: `1.5px solid ${Selected? s.color : '#E2E0DC'}`, background: Selected? s.bg : 'white', color: Selected? s.color : '#8A919C', fontSize: 12, fontWeight: Selected? 700 : 500, cursor: 'pointer' }}>
                        <span style={{ fontSize: 14 }}>{s.icon}</span> {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nationality */}
              <div>
                <div style={{ fontSize: 12, color: '#8A919C', marginBottom: 8, fontWeight: 600 }}>🌏 Nationality</div>
                <select value={editData.nationality} onChange={e => setEditData(p => ({...p, nationality: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none', background: 'white' }}>
                  <option value="KR">🇰🇷 Korea</option>
                  <option value="JP">🇯🇵 Japan</option>
                  <option value="US">🇺🇸 USA</option>
                  <option value="EU">🇪🇺 Europe (EUR)</option>
                  <option value="TH">🇹🇭 Thailand</option>
                  <option value="CN">🇨🇳 China</option>
                  <option value="GB">🇬🇧 UK</option>
                  <option value="AU">🇦🇺 Australia</option>
                  <option value="SG">🇸🇬 Singapore</option>
                  <option value="MY">🇲🇾 Malaysia</option>
                  <option value="VN">🇻🇳 Vietnam</option>
                  <option value="ID">🇮🇩 Indonesia</option>
                  <option value="PH">🇵🇭 Philippines</option>
                </select>
              </div>

              {/* Countries you want to visit */}
              <div>
                <div style={{ fontSize: 12, color: '#8A919C', marginBottom: 8, fontWeight: 600 }}>Countries you want to visit <span style={{ fontWeight: 400 }}>(Multiple SELECT)</span></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    { code: 'JP', label: '🇯🇵 Japan' }, { code: 'US', label: '🇺🇸 USA' },
                    { code: 'FR', label: '🇫🇷 France' }, { code: 'IT', label: '🇮🇹 Italy' },
                    { code: 'TH', label: '🇹🇭 Thailand' }, { code: 'ID', label: '🇮🇩 Bali' },
                    { code: 'ES', label: '🇪🇸 Spain' }, { code: 'GB', label: '🇬🇧 UK' },
                    { code: 'AU', label: '🇦🇺 Australia' }, { code: 'SG', label: '🇸🇬 Singapore' },
                    { code: 'VN', label: '🇻🇳 Vietnam' }, { code: 'CN', label: '🇨🇳 China' },
                    { code: 'HK', label: '🇭🇰 Hong Kong' }, { code: 'TR', label: '🇹🇷 Turkey' },
                    { code: 'MA', label: '🇲🇦 Morocco' }, { code: 'MX', label: '🇲🇽 Mexico' },
                    { code: 'CZ', label: '🇨🇿 Czechia' }, { code: 'NL', label: '🇳🇱 Netherlands' },
                    { code: 'AE', label: '🇦🇪 Dubai' }, { code: 'HW', label: '🌺 Hawaii' },
                  ].map(c => {
                    const Selected = (editData.wishCountries || []).includes(c.code);
                    return (
                      <button key={c.code} type="button"
                        onClick={() => setEditData(p => ({...p, wishCountries: Selected? p.wishCountries.filter(x => x!== c.code) : [...(p.wishCountries || []), c.code] }))}
                        style={{ padding: '5px 10px', borderRadius: 2, border: `1.5px solid ${Selected? '#1E2A3A' : '#E2E0DC'}`, background: Selected? '#EEEDEA' : 'white', color: Selected? '#1E2A3A' : '#8A919C', fontSize: 12, fontWeight: Selected? 700 : 500, cursor: 'pointer' }}>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleSaveProfile} disabled={saving || uploading}
                  style={{ flex: 1, padding: '9px', background: uploading? '#8A919C' : '#1E2A3A', color: 'white', border: 'none', borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: uploading? 'not-allowed' : 'pointer' }}>
                  {uploading? 'Upload...' : saving? 'SAVE...' : 'SAVE'}
                </button>
                <button onClick={() => { setEditing(false); setImagePreview(''); }}
                  style={{ flex: 1, padding: '9px', background: '#F5F4F0', color: '#555', border: 'none', borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
                  CANCEL
                </button>
              </div>

              {/* ── Account type management (PC only) ── */}
              <div className="business-section" style={{ marginTop: 8, padding: 16, background: '#FAFAF8', borderRadius: 3, border: '1px solid #F0EEE9' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A', marginBottom: 8 }}>🏢 Account Type</div>

                {bizAccount? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#4A5568' }}>
                        {bizAccount.account_type === 'official'? '★ Official Account' : bizAccount.badge_type === 'verified'? '✓ Verified Business' : bizAccount.badge_type === 'premium'? '♦ Premium' : '🏢 Business'}
                      </span>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 2,
                        background: bizAccount.status === 'approved'? '#ecfdf5' : bizAccount.status === 'pending'? '#fffbeb' : '#fef2f2',
                        color: bizAccount.status === 'approved'? '#10b981' : bizAccount.status === 'pending'? '#f59e0b' : '#ef4444',
                        fontWeight: 700
                      }}>
                        {bizAccount.status === 'approved'? 'Approved' : bizAccount.status === 'pending'? 'Pending review ' : 'Rejected'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#8A919C' }}>
                      <div>{bizAccount.business_name}</div>
                      {bizAccount.business_description && <div style={{ marginTop: 2 }}>{bizAccount.business_description}</div>}
                      {bizAccount.reject_reason && <div style={{ color: '#ef4444', marginTop: 4 }}>Rejected Reason: {bizAccount.reject_reason}</div>}
                    </div>
                  </div>
                ) : showBizForm? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 12, color: '#8A919C', marginBottom: 4 }}>Category SELECT</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[
                        { key: 'restaurant', icon: '🍽️', label: 'Restaurant' },
                        { key: 'hotel', icon: '🏨', label: 'Hotel' },
                        { key: 'tour', icon: '🎒', label: 'Tour' },
                        { key: 'city', icon: '🏙️', label: 'Tourism board' },
                        { key: 'transport', icon: '✈️', label: 'TRANSIT' },
                        { key: 'shopping', icon: '🛍️', label: 'Shopping' },
                        { key: 'creator', icon: '🎬', label: 'Creator' },
                        { key: 'other', icon: '📢', label: 'Other' },
                      ].map(cat => (
                        <button key={cat.key} type="button" onClick={() => setBizForm(p => ({...p, category: cat.key }))}
                          style={{
                            padding: '5px 10px', borderRadius: 2, border: bizForm.category === cat.key? '1.5px solid #1E2A3A' : '1px solid #E2E0DC',
                            background: bizForm.category === cat.key? '#FAFAF8' : 'white', color: bizForm.category === cat.key? '#1E2A3A' : '#8A919C',
                            fontSize: 11, fontWeight: bizForm.category === cat.key? 700 : 500, cursor: 'pointer'
                          }}>
                          {cat.icon} {cat.label}
                        </button>
                      ))}
                    </div>
                    <input placeholder="Business name/name *" value={bizForm.business_name} onChange={e => setBizForm(p => ({...p, business_name: e.target.value }))}
                      style={{ padding: '9px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none' }} />
                    <textarea placeholder="Description (optional)" rows={2} value={bizForm.business_description} onChange={e => setBizForm(p => ({...p, business_description: e.target.value }))}
                      style={{ padding: '9px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none', resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input placeholder="Country" value={bizForm.business_country} onChange={e => setBizForm(p => ({...p, business_country: e.target.value }))}
                        style={{ flex: 1, padding: '9px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none' }} />
                      <input placeholder="City" value={bizForm.business_city} onChange={e => setBizForm(p => ({...p, business_city: e.target.value }))}
                        style={{ flex: 1, padding: '9px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none' }} />
                    </div>
                    <input placeholder="Website (optional)" value={bizForm.business_website} onChange={e => setBizForm(p => ({...p, business_website: e.target.value }))}
                      style={{ padding: '9px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none' }} />
                    <input placeholder="Contact (optional)" value={bizForm.business_phone} onChange={e => setBizForm(p => ({...p, business_phone: e.target.value }))}
                      style={{ padding: '9px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none' }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={registerBusiness} disabled={bizLoading}
                        style={{ flex: 1, padding: '9px', background: '#1E2A3A', color: 'white', border: 'none', borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        {bizLoading? 'APPLY...' : '🚀 Business APPLY'}
                      </button>
                      <button onClick={() => setShowBizForm(false)}
                        style={{ padding: '9px 16px', background: '#F5F4F0', color: '#555', border: 'none', borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>CANCEL</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 12, color: '#8A919C', marginBottom: 8 }}>Regular account. Upgrade to Business to get verified badge and stats features. </div>
                    <button onClick={() => setShowBizForm(true)}
                      style={{ padding: '8px 16px', background: '#1E2A3A', color: 'white', border: 'none', borderRadius: 2, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      🏢 Business account upgrade
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
                    ✏️ EDIT
                  </button>
                )}
              </div>
              {user.bio && <div className="profile-bio">{user.bio}</div>}
              <div className="profile-stats">
                <div className="stat"><div className="stat-num">{visiblePosts.length}</div><div className="stat-label">POSTS</div></div>
                <div className="stat" style={{ cursor: 'pointer' }} onClick={() => openModal('followers')}>
                  <div className="stat-num">{user.followerIds?.length || 0}</div>
                  <div className="stat-label">FOLLOWERS</div>
                </div>
                <div className="stat" style={{ cursor: 'pointer' }} onClick={() => openModal('followings')}>
                  <div className="stat-num">{user.followingIds?.length || 0}</div>
                  <div className="stat-label">FOLLOWING</div>
                </div>
                <div className="stat"><div className="stat-num">{user.visitedCountries || 0}</div><div className="stat-label">COUNTRIES</div></div>
              </div>
              {!isMe && currentUser && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className={isFollowing? 'btn-following' : 'btn-follow'}
                    onClick={() => handleFollow(userId, isFollowing)}>
                    {isFollowing? 'FOLLOWING' : 'FOLLOW'}
                  </button>
                  <button onClick={() => setShowBlockConfirm(true)}
                    style={{ padding: '9px 16px', borderRadius: 2, border: '1px solid #E2E0DC', background: 'white', fontSize: 13, color: isBlocked? '#ef4444' : '#8A919C', fontWeight: 600, cursor: 'pointer' }}>
                    {isBlocked? 'Unblock' : 'BLOCK'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* BLOCK OK */}
      {showBlockConfirm && (
        <div className="modal-overlay" onClick={() => setShowBlockConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360, width: '100%' }}>
            <div className="modal-title">{isBlocked? 'Unblock' : `Block ${user.nickname}?`}</div>
            <p style={{ fontSize: 14, color: '#8A919C', lineHeight: 1.7 }}>
              {isBlocked
               ? 'Unblock to see their posts again.'
                : 'Blocking hides their posts and removes the follow connection.'}
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowBlockConfirm(false)}>CANCEL</button>
              <button className="btn-cancel" onClick={handleBlock}>{isBlocked? 'Unblock' : 'BLOCK'}</button>
            </div>
          </div>
        </div>
      )}

      {/* FOLLOWERS/FOLLOWING Modal */}
      {modal && (
        <UserListModal
          title={modal === 'followers'? 'FOLLOWERS' : 'FOLLOWING'}
          users={modalUsers}
          currentUser={currentUser}
          onClose={() => setModal(null)}
          onProfile={onProfile}
          onFollow={handleFollow}
        />
      )}

      {/* PROFILE Tab */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E2E0DC' }}>
        {[
          { key: 'posts', label: `📷 POSTS ${visiblePosts.length}` },
         ...(isMe? [{ key: 'saved', label: `🔖 SAVED` }] : []),
          { key: 'badges', label: `🏅 BADGES ${user.badges?.length || 0}` },
        ].map(t => (
          <button key={t.key} onClick={() => setProfileTab(t.key)}
            style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', borderBottom: `2px solid ${profileTab === t.key? '#1E2A3A' : 'transparent'}`, color: profileTab === t.key? '#1E2A3A' : '#8A919C', fontSize: 13, fontWeight: profileTab === t.key? 700 : 500, cursor: 'pointer', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* POSTS Tab */}
      {profileTab === 'posts' && (
        visiblePosts.length === 0? (
          <div className="empty">No posts None.</div>
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

      {/* Saved posts tab (only mine) */}
      {profileTab === 'saved' && isMe && (
        <SavedPosts userId={userId} savedPostIds={user.savedPostIds || []} onOpenPost={onOpenPost} />
      )}

      {/* BADGES Tab */}
      {profileTab === 'badges' && (
        <BadgeGrid badges={user.badges || []} posts={visiblePosts} user={user} />
      )}
    </div>
  );
}

// ── Saved posts ───────────────────────────────────────
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

  if (loading) return <div className="empty">Loading...</div>;
  if (!savedPosts.length) return <div className="empty">No saved posts.<br />Tap 🔖 in post details to save.</div>;

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

// ── BADGES grid ─────────────────────────────────────────
const BADGE_INFO = {
  First_post: { icon: '✏️', name: 'First POSTS', desc: 'First Travel stories Write' },
  ten_posts: { icon: '📝', name: 'Travel Writer', desc: 'POSTS 10 achieved' },
  fifty_posts: { icon: '📚', name: 'Travel Expert', desc: 'POSTS 50 achieved' },
  likes_100: { icon: '❤️', name: 'Popular Traveler', desc: '100 likes received' },
  likes_1000: { icon: '🔥', name: 'TRAVEL influencer', desc: '1,000 likes received' },
  followers_10: { icon: '👥', name: 'Community Starter', desc: 'First 10 followers' },
  followers_100: { icon: '🌟', name: 'Travel Star', desc: 'Reached 100 followers' },
  countries_5: { icon: '🗺️', name: 'World Explorer', desc: '5 countries explored' },
  countries_10: { icon: '✈️', name: 'Global Traveler', desc: '10 countries explored' },
  countries_30: { icon: '🌍', name: 'Globetrotter', desc: '30 countries explored' },
};

function BadgeGrid({ badges, posts, user }) {
  const allBadgeKeys = Object.keys(BADGE_INFO);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: '#8A919C' }}>Earned BADGES {badges.length} / {allBadgeKeys.length}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
        {allBadgeKeys.map(key => {
          const info = BADGE_INFO[key];
          const earned = badges.includes(key);
          return (
            <div key={key} style={{ border: `1px solid ${earned? '#c7d2fe' : '#E2E0DC'}`, borderRadius: 3, padding: '14px 12px', textAlign: 'center', background: earned? '#fafbff' : '#FAFAF8', opacity: earned? 1 : 0.5 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{info.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: earned? '#1E2A3A' : '#8A919C', marginBottom: 3 }}>{info.name}</div>
              <div style={{ fontSize: 11, color: '#8A919C', lineHeight: 1.4 }}>{info.desc}</div>
              {earned && <div style={{ fontSize: 10, color: '#1E2A3A', fontWeight: 700, marginTop: 6 }}>✓ Earned</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
