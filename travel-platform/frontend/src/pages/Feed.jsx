import React, { useEffect, useState } from 'react';
import { api } from '../api';
import PostCard from '../components/PostCard';

export default function Feed({ currentUser, onOpenPost, onProfile }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // 기본 탭: 팔로잉하는 사람 있으면 'following', 없으면 'all'
  const hasFollowings = currentUser?.followingIds?.length > 0;
  const [tab, setTab] = useState(hasFollowings ? 'following' : 'all');

  useEffect(() => { load(); }, [tab, currentUser?.id]);

  const load = async () => {
    setLoading(true);
    try {
      let data;
      if (tab === 'following' && currentUser) {
        data = await api.getFeed(currentUser.id);
      } else {
        data = await api.getPosts({ currentUserId: currentUser?.id });
      }
      setPosts(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleLike = async (postId) => {
    if (!currentUser) return;
    try {
      const updated = await api.toggleLike(postId, currentUser.id);
      setPosts(prev => prev.map(p => p.id === postId ? updated : p));
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="feed-tabs">
        <button className={`feed-tab${tab === 'all' ? ' active' : ''}`} onClick={() => setTab('all')}>전체</button>
        <button className={`feed-tab${tab === 'following' ? ' active' : ''}`} onClick={() => setTab('following')}>
          팔로잉 {hasFollowings && <span style={{ fontSize: 11, background: '#4f46e5', color: 'white', borderRadius: 10, padding: '1px 6px', marginLeft: 4 }}>{currentUser.followingIds.length}</span>}
        </button>
      </div>

      {loading ? (
        <div className="empty">불러오는 중...</div>
      ) : posts.length === 0 ? (
        <div className="empty">
          {tab === 'following'
            ? '팔로우한 사람의 게시물이 없어요.\n다른 여행자를 팔로우해보세요!'
            : '게시물이 없어요.'}
        </div>
      ) : (
        <div className="feed">
          {posts.map(post => (
            <PostCard key={post.id} post={post} currentUserId={currentUser?.id}
              onOpen={onOpenPost} onProfile={onProfile} onLike={handleLike} />
          ))}
        </div>
      )}
    </div>
  );
}
