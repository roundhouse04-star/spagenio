import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api';
import PostCard from '../components/PostCard';
import NoticeBar from '../components/NoticeBar';
import ReportModal from '../components/ReportModal';
import { TRAVEL_STYLES } from '../travelStyles';

const PAGE_SIZE = 8;

// 프로모션 카드 컴포넌트
function PromoCard({ promo }) {
  const typeColor = promo.type === 'ad' ? { bg: '#fffbeb', border: '#fde68a', badge: '#d97706', badgeText: '광고' }
    : promo.type === 'event' ? { bg: '#f0fdf4', border: '#bbf7d0', badge: '#16a34a', badgeText: '이벤트' }
    : { bg: '#eef2ff', border: '#c7d2fe', badge: '#4f46e5', badgeText: '공지' };

  return (
    <div style={{ background: typeColor.bg, border: `1.5px solid ${typeColor.border}`, borderRadius: 18, overflow: 'hidden', marginBottom: 0 }}>
      {promo.imageUrl && (
        <img src={promo.imageUrl} alt={promo.title}
          style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: typeColor.badge, color: 'white' }}>
            {typeColor.badgeText}
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#1a1a2e' }}>{promo.title}</span>
        </div>
        <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>{promo.content}</p>
        {promo.linkUrl && (
          <a href={promo.linkUrl} target="_blank" rel="noreferrer"
            style={{ display: 'inline-block', marginTop: 10, padding: '7px 16px', background: typeColor.badge, color: 'white', borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
            {promo.linkLabel || '자세히 보기'} →
          </a>
        )}
      </div>
    </div>
  );
}

export default function Feed({ currentUser, onOpenPost, onProfile, onTagClick }) {
  const [reportPost, setReportPost] = useState(null);
  const [posts, setPosts] = useState([]);
  const [allPosts, setAllPosts] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);

  const hasFollowings = currentUser?.followingIds?.length > 0;
  const [tab, setTab] = useState(hasFollowings ? 'following' : 'all');

  // 성향 기반 정렬
  const sortByPreference = (posts, preferredStyles) => {
    if (!preferredStyles?.length) return posts;
    return [...posts].sort((a, b) => {
      const aMatch = (a.travelStyles || []).some(s => preferredStyles.includes(s)) ? 1 : 0;
      const bMatch = (b.travelStyles || []).some(s => preferredStyles.includes(s)) ? 1 : 0;
      return bMatch - aMatch;
    });
  };

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

      // 성향 기반 정렬
      const sorted = sortByPreference(data || [], currentUser?.preferredStyles);
      setAllPosts(sorted);
      setPosts(sorted.slice(0, PAGE_SIZE));
      setHasMore(sorted.length > PAGE_SIZE);

      // 프로모션 로드
      try {
        const promos = await api.getPromotions();
        setPromotions(promos || []);
      } catch (e) { setPromotions([]); }

      // 팔로우 추천
      if (tab === 'following' && (!data || data.length === 0)) {
        const users = await api.getUsers();
        const suggested = (users || [])
          .filter(u => u.id !== currentUser?.id && !currentUser?.followingIds?.includes(u.id))
          .sort((a, b) => {
            // 같은 성향 유저 우선
            const aMatch = (a.preferredStyles || []).some(s => currentUser?.preferredStyles?.includes(s)) ? 1 : 0;
            const bMatch = (b.preferredStyles || []).some(s => currentUser?.preferredStyles?.includes(s)) ? 1 : 0;
            return bMatch - aMatch || Math.random() - 0.5;
          })
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

  // 프로모션을 게시물 사이에 삽입하는 로직
  const buildFeedItems = (posts, promotions) => {
    if (!promotions.length) return posts.map(p => ({ type: 'post', data: p }));
    const items = [];
    let promoIdx = 0;
    posts.forEach((post, i) => {
      items.push({ type: 'post', data: post });
      const promo = promotions[promoIdx % promotions.length];
      const interval = promo?.insertEvery || 5;
      if ((i + 1) % interval === 0 && promoIdx < promotions.length * 3) {
        items.push({ type: 'promo', data: promo });
        promoIdx++;
      }
    });
    return items;
  };

  const feedItems = buildFeedItems(posts, promotions.filter(p => p.active));

  // 성향 표시 라벨
  const prefStyles = currentUser?.preferredStyles || [];
  const prefLabels = prefStyles.map(k => TRAVEL_STYLES.find(s => s.key === k)).filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="feed-tabs">
        <button className={`feed-tab${tab === 'all' ? ' active' : ''}`} onClick={() => setTab('all')}>전체</button>
        <button className={`feed-tab${tab === 'following' ? ' active' : ''}`} onClick={() => setTab('following')}>
          팔로잉 {hasFollowings && <span style={{ fontSize: 11, background: '#4f46e5', color: 'white', borderRadius: 10, padding: '1px 6px', marginLeft: 4 }}>{currentUser.followingIds.length}</span>}
        </button>
      </div>

      {/* 성향 기반 필터 표시 */}
      {prefLabels.length > 0 && tab === 'all' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>✨ 내 성향 맞춤:</span>
          {prefLabels.map(s => (
            <span key={s.key} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontWeight: 700 }}>
              {s.icon} {s.label}
            </span>
          ))}
        </div>
      )}

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
                    {/* 공통 성향 표시 */}
                    {prefStyles.length > 0 && (u.preferredStyles || []).some(s => prefStyles.includes(s)) && (
                      <div style={{ fontSize: 10, color: '#4f46e5', fontWeight: 700 }}>같은 성향</div>
                    )}
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
              {feedItems.map((item, idx) =>
                item.type === 'promo' ? (
                  <PromoCard key={`promo-${item.data.id}-${idx}`} promo={item.data} />
                ) : (
                  <PostCard key={item.data.id} post={item.data} currentUserId={currentUser?.id}
                    onOpen={onOpenPost} onProfile={onProfile} onLike={handleLike} onTagClick={onTagClick}
                    onReport={setReportPost} />
                )
              )}
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
