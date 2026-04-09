import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api';
import PostCard from '../components/PostCard';
import NoticeBar from '../components/NoticeBar';
import ReportModal from '../components/ReportModal';

const PAGE_SIZE = 8;

export default function Feed({ currentUser, onOpenPost, onProfile, onTagClick }) {
  const [reportPost, setReportPost] = useState(null);
  const [posts, setPosts] = useState([]);
  const [allPosts, setAllPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);

  const hasFollowings = currentUser?.followingIds?.length > 0;
  const [tab, setTab] = useState(hasFollowings ? 'following' : 'all');

  useEffect(() => { load(); }, [tab, currentUser?.id]);

  const load = async () => {
    setLoading(true);
    setPage(1);
    try {
      let data;
      if (tab === 'following' && currentUser) {
        data = await api.getFeed(currentUser.id);
      } else {
        data = await api.getPosts({ currentUserId: currentUser?.id });
      }
      const sorted = (data || []);
      setAllPosts(sorted);
      setPosts(sorted.slice(0, PAGE_SIZE));
      setHasMore(sorted.length > PAGE_SIZE);

      // 팔로우 추천 (팔로잉 탭 & 게시물 없을 때 or 전체에서 항상)
      if (tab === 'following' && (!data || data.length === 0)) {
        const users = await api.getUsers();
        const suggested = (users || [])
          .filter(u => u.id !== currentUser?.id && !currentUser?.followingIds?.includes(u.id))
          .sort(() => Math.random() - 0.5)
          .slice(0, 5);
        setSuggestedUsers(suggested);
      } else {
        setSuggestedUsers([]);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // 무한 스크롤
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const nextPosts = allPosts.slice(0, nextPage * PAGE_SIZE);
    setPosts(nextPosts);
    setPage(nextPage);
    setHasMore(nextPosts.length < allPosts.length);
    setLoadingMore(false);
  }, [loadingMore, hasMore, page, allPosts]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    observerRef.current = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [loadMore]);

  const handleLike = async (postId) => {
    if (!currentUser) return;
    try {
      const updated = await api.toggleLike(postId, currentUser.id);
      setPosts(prev => prev.map(p => p.id === postId ? updated : p));
      setAllPosts(prev => prev.map(p => p.id === postId ? updated : p));
    } catch (e) { console.error(e); }
  };

  const handleFollow = async (userId) => {
    if (!currentUser) return;
    try {
      await api.follow(currentUser.id, userId);
      setSuggestedUsers(prev => prev.filter(u => u.id !== userId));
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
      ) : (
        <>
          {/* 팔로우 추천 */}
          {suggestedUsers.length > 0 && (
            <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 16, padding: '16px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>👥 이런 여행자는 어때요?</div>
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
                {suggestedUsers.map(u => (
                  <div key={u.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 80, flexShrink: 0 }}>
                    <img src={u.profileImage || `https://ui-avatars.com/api/?name=${u.nickname}&background=4f46e5&color=fff&size=56`}
                      style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
                      onClick={() => onProfile?.(u.id)} alt="" />
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', textAlign: 'center', maxWidth: 76, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.nickname}</div>
                    {u.visitedCountries > 0 && <div style={{ fontSize: 10, color: '#9ca3af' }}>{u.visitedCountries}개국</div>}
                    <button onClick={() => handleFollow(u.id)}
                      style={{ padding: '4px 10px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      팔로우
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {posts.length === 0 ? (
            <div className="empty">
              {tab === 'following'
                ? '팔로우한 사람의 게시물이 없어요.\n위에서 여행자를 팔로우해보세요!'
                : '게시물이 없어요.'}
            </div>
          ) : (
            <div className="feed">
              {posts.map(post => (
                <PostCard key={post.id} post={post} currentUserId={currentUser?.id}
                  onOpen={onOpenPost} onProfile={onProfile} onLike={handleLike} onTagClick={onTagClick}
                  onReport={setReportPost} />
              ))}
            </div>
          )}

          {/* 무한 스크롤 센티널 */}
          <div ref={sentinelRef} style={{ height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {loadingMore && <div style={{ fontSize: 12, color: '#9ca3af' }}>불러오는 중...</div>}
            {!hasMore && posts.length > 0 && <div style={{ fontSize: 12, color: '#d1d5db' }}>모든 게시물을 봤어요 ✓</div>}
          </div>
        </>
      )}
      {reportPost && <ReportModal post={reportPost} currentUser={currentUser} onClose={() => setReportPost(null)} />}
    </div>
  );
}
