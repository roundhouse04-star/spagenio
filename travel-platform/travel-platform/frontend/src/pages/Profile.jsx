import React, { useEffect, useState } from 'react';
import { api } from '../api';

// 팔로워/팔로잉 목록 모달
function UserListModal({ title, users, currentUser, onClose, onProfile, onFollow }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="modal-title" style={{ marginBottom: 0 }}>{title}</div>
          <button onClick={onClose} style={{ fontSize: 20, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
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
                  <img src={u.profileImage || `https://ui-avatars.com/api/?name=${u.nickname}&background=4f46e5&color=fff&size=40`}
                    alt={u.nickname} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
                    onClick={() => { onProfile?.(u.id); onClose(); }} />
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { onProfile?.(u.id); onClose(); }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>{u.nickname}</div>
                    {u.bio && <div style={{ fontSize: 12, color: '#9ca3af' }}>{u.bio}</div>}
                  </div>
                  {!isMe && currentUser && (
                    <button className={isFollowing ? 'btn-following' : 'btn-follow'}
                      style={{ fontSize: 12, padding: '6px 14px' }}
                      onClick={() => onFollow?.(u.id, isFollowing)}>
                      {isFollowing ? '팔로잉' : '팔로우'}
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
  const [editData, setEditData] = useState({ nickname: '', bio: '' });
  const [saving, setSaving] = useState(false);

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

  const handleSaveProfile = async () => {
    if (!editData.nickname.trim()) return;
    setSaving(true);
    try {
      const updated = await api.updateUser(userId, { nickname: editData.nickname, bio: editData.bio });
      setUser(prev => ({ ...prev, nickname: editData.nickname, bio: editData.bio }));
      onChangeUser?.({ ...currentUser, nickname: editData.nickname, bio: editData.bio });
      setEditing(false);
    } catch (e) { alert('저장 실패: ' + e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="empty">불러오는 중...</div>;
  if (!user) return <div className="empty">유저를 찾을 수 없어요.</div>;

  // 비공개 게시물 필터 (본인이 아닐 경우)
  const visiblePosts = isMe ? posts : posts.filter(p => p.visibility !== 'private');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="profile-header">
        <img className="avatar avatar-xl"
          src={user.profileImage || `https://ui-avatars.com/api/?name=${user.nickname}&background=4f46e5&color=fff&size=110`}
          alt={user.nickname} />
        <div className="profile-info">
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>프로필 편집</div>
              <input value={editData.nickname} onChange={e => setEditData(p => ({ ...p, nickname: e.target.value }))}
                placeholder="닉네임" maxLength={20}
                style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none' }} />
              <textarea value={editData.bio} onChange={e => setEditData(p => ({ ...p, bio: e.target.value }))}
                placeholder="소개글 (선택)" rows={3} maxLength={100}
                style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleSaveProfile} disabled={saving}
                  style={{ flex: 1, padding: '9px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? '저장 중...' : '저장'}
                </button>
                <button onClick={() => setEditing(false)}
                  style={{ flex: 1, padding: '9px', background: '#f3f4f6', color: '#555', border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
                  취소
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="profile-name">{user.nickname}</div>
                {isMe && (
                  <button onClick={() => { setEditing(true); setEditData({ nickname: user.nickname, bio: user.bio || '' }); }}
                    style={{ padding: '5px 12px', background: '#f3f4f6', border: '1px solid #eee', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#555', cursor: 'pointer' }}>
                    ✏️ 편집
                  </button>
                )}
              </div>
              {user.bio && <div className="profile-bio">{user.bio}</div>}
              <div className="profile-stats">
                <div className="stat"><div className="stat-num">{visiblePosts.length}</div><div className="stat-label">게시물</div></div>
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
                    {isFollowing ? '팔로잉' : '팔로우'}
                  </button>
                  <button onClick={() => setShowBlockConfirm(true)}
                    style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #eee', background: 'white', fontSize: 13, color: isBlocked ? '#ef4444' : '#9ca3af', fontWeight: 600, cursor: 'pointer' }}>
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
            <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>
              {isBlocked
                ? '차단을 해제하면 상대방의 게시물이 다시 보여요.'
                : '차단하면 상대방의 게시물이 보이지 않고, 팔로우 관계가 해제돼요.'}
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowBlockConfirm(false)}>취소</button>
              <button className="btn-cancel" onClick={handleBlock}>{isBlocked ? '차단 해제' : '차단'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 팔로워/팔로잉 모달 */}
      {modal && (
        <UserListModal
          title={modal === 'followers' ? '팔로워' : '팔로잉'}
          users={modalUsers}
          currentUser={currentUser}
          onClose={() => setModal(null)}
          onProfile={onProfile}
          onFollow={handleFollow}
        />
      )}

      {/* 게시물 그리드 */}
      {visiblePosts.length === 0 ? (
        <div className="empty">아직 게시물이 없어요.</div>
      ) : (
        <div className="profile-grid">
          {visiblePosts.map(post => (
            <div key={post.id} className="profile-grid-item" onClick={() => onOpenPost?.(post)}>
              {post.images?.[0]
                ? <img src={post.images[0]} alt={post.title} />
                : <div style={{ width: '100%', height: '100%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>✈️</div>
              }
              {post.visibility === 'private' && (
                <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: 'white' }}>🔒</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
