import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function Profile({ userId, currentUser, onOpenPost, onChangeUser }) {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleFollow = async () => {
    if (!currentUser) return;
    try {
      if (isFollowing) {
        await api.unfollow(currentUser.id, userId);
        onChangeUser?.({ ...currentUser, followingIds: currentUser.followingIds.filter(id => id !== userId) });
        setUser(prev => ({ ...prev, followerIds: prev.followerIds.filter(id => id !== currentUser.id) }));
      } else {
        await api.follow(currentUser.id, userId);
        onChangeUser?.({ ...currentUser, followingIds: [...(currentUser.followingIds || []), userId] });
        setUser(prev => ({ ...prev, followerIds: [...(prev.followerIds || []), currentUser.id] }));
      }
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="empty">불러오는 중...</div>;
  if (!user) return <div className="empty">유저를 찾을 수 없어요.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="profile-header">
        <img className="avatar avatar-xl"
          src={user.profileImage || `https://ui-avatars.com/api/?name=${user.nickname}&background=4f46e5&color=fff&size=110`}
          alt={user.nickname} />
        <div className="profile-info">
          <div className="profile-name">{user.nickname}</div>
          {user.bio && <div className="profile-bio">{user.bio}</div>}
          <div className="profile-stats">
            <div className="stat"><div className="stat-num">{posts.length}</div><div className="stat-label">게시물</div></div>
            <div className="stat"><div className="stat-num">{user.followerIds?.length || 0}</div><div className="stat-label">팔로워</div></div>
            <div className="stat"><div className="stat-num">{user.followingIds?.length || 0}</div><div className="stat-label">팔로잉</div></div>
            <div className="stat"><div className="stat-num">{user.visitedCountries || 0}</div><div className="stat-label">방문국가</div></div>
          </div>
          {!isMe && currentUser && (
            <div className="profile-actions">
              <button className={isFollowing ? 'btn-following' : 'btn-follow'} onClick={handleFollow}>
                {isFollowing ? '팔로잉' : '팔로우'}
              </button>
            </div>
          )}
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="empty">아직 게시물이 없어요.</div>
      ) : (
        <div className="profile-grid card">
          {posts.map(post => (
            <div key={post.id} className="profile-grid-item" onClick={() => onOpenPost?.(post)}>
              {post.images?.[0]
                ? <img src={post.images[0]} alt={post.title} />
                : <div style={{ width: '100%', height: '100%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>✈️</div>
              }
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
