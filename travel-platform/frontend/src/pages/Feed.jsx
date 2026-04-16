import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api';
import ReportModal from '../components/ReportModal';
import { TRAVEL_STYLES } from '../travelStyles';

const PAGE_SIZE = 8;

// ── 스폰서 광고 컴포넌트 ──
function SponsoredAd({ ad, currentUser }) {
  const [visible, setVisible] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !visible) { setVisible(true); }
    }, { threshold: 0.5 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const handleClick = async () => {
    try {
      await fetch('/api/ads/' + ad.id + '/click?user_id=' + (currentUser?.id || ''), { method: 'POST' });
    } catch(e) {}
    window.open(ad.link_url, '_blank');
  };

  if (!ad) return null;

  return (
    <div ref={ref} style={{ background: 'white', borderBottom: '1px solid #F0EEE9' }}>
      <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 3, background: '#1E2A3A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, color: 'white', fontWeight: 800 }}>AD</span>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1E2A3A' }}>Sponsored</div>
            <div style={{ fontSize: 10, color: '#8A919C' }}>{ad.target_country || '전체'} · {ad.target_city || '전체'}</div>
          </div>
        </div>
        <span style={{ fontSize: 10, color: '#B8BCC4', background: '#FAFAF8', padding: '2px 8px', borderRadius: 2 }}>광고</span>
      </div>
      <div onClick={handleClick} style={{ cursor: 'pointer', position: 'relative' }}>
        {ad.image_url && (
          <img src={ad.image_url} alt={ad.title}
            style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '40px 16px 16px',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'white', marginBottom: 4 }}>{ad.title}</div>
          {ad.description && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{ad.description}</div>}
        </div>
      </div>
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, color: '#8A919C' }}>{ad.description?.slice(0, 40)}</div>
        <button onClick={handleClick}
          style={{ padding: '6px 16px', borderRadius: 2, background: '#1E2A3A', color: 'white',
            fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          {ad.cta_text || '자세히 보기'}
        </button>
      </div>
    </div>
  );
}



// 자동재생 비디오 (스크롤 시 재생/정지, 음소거 토글)
function AutoPlayVideo({ src, poster }) {
  const videoRef = React.useRef(null);
  const [muted, setMuted] = React.useState(true);
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
          setPlaying(true);
        } else {
          video.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ position: 'relative', lineHeight: 0 }}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted={muted}
        playsInline
        loop
        preload="metadata"
        style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block', background: '#000' }}
      />
      <button
        onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}
        style={{ position: 'absolute', bottom: 14, right: 14, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <span style={{ fontSize: 16, color: 'white' }}>{muted ? '🔇' : '🔊'}</span>
      </button>
    </div>
  );
}



// 프로모션 카드
function PromoCard({ promo }) {
  const typeColor = promo.type === 'ad'
    ? { bg: '#fffbeb', border: '#fde68a', badge: '#d97706', badgeText: '광고' }
    : promo.type === 'event'
      ? { bg: '#f0fdf4', border: '#bbf7d0', badge: '#16a34a', badgeText: '이벤트' }
      : { bg: '#EEEDEA', border: '#c7d2fe', badge: '#1E2A3A', badgeText: '공지' };

  return (
    <div style={{ background: typeColor.bg, border: `1.5px solid ${typeColor.border}`, overflow: 'hidden', borderBottom: '1px solid #F0EEE9' }}>
      {promo.imageUrl && <img src={promo.imageUrl} alt={promo.title} style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 2, background: typeColor.badge, color: 'white' }}>{typeColor.badgeText}</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#1E2A3A' }}>{promo.title}</span>
        </div>
        <p style={{ fontSize: 13, color: '#8A919C', lineHeight: 1.6, margin: 0 }}>{promo.content}</p>
        {promo.linkUrl && (
          <a href={promo.linkUrl} target="_blank" rel="noreferrer"
            style={{ display: 'inline-block', marginTop: 8, padding: '6px 14px', background: typeColor.badge, color: 'white', borderRadius: 2, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
            {promo.linkLabel || '자세히 보기'} →
          </a>
        )}
      </div>
    </div>
  );
}

// 인스타그램 스타일 게시물 카드
function SNSPostCard({ post, currentUserId, onOpen, onProfile, onLike, onReport }) {
  const liked = (post.likedUserIds || []).includes(currentUserId);
  const likeCount = post.likedUserIds?.length || 0;
  const commentCount = post.comments?.length || 0;
  const [showMore, setShowMore] = useState(false);

  return (
    <div style={{ background: 'white', borderBottom: '1px solid #F0EEE9' }}>

      {/* 헤더 — 프로필 + 닉네임 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          onClick={() => onProfile?.(post.userId)}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1E2A3A', border: '2px solid #c7d2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {post.userProfileImage
              ? <img src={post.userProfileImage} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt="" />
              : <span style={{ color: 'white', fontWeight: 800, fontSize: 15 }}>{post.userNickname?.[0]?.toUpperCase()}</span>
            }
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A' }}>{post.userNickname}</div>
            {(post.city || post.country) && (
              <div style={{ fontSize: 11, color: '#8A919C' }}>📍 {[post.city, post.country].filter(Boolean).join(', ')}</div>
            )}
          </div>
        </div>
        <button onClick={() => onReport?.(post)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#4A5568', letterSpacing: 2, padding: '4px 6px' }}>···</button>
      </div>

      {/* 이미지 또는 동영상 */}
      <div onClick={() => onOpen?.(post)} style={{ cursor: 'pointer', lineHeight: 0 }}>
        {post.videos?.[0]?.url ? (
          <video
            src={post.videos[0].url}
            poster={post.videos[0].thumb}
            controls
            playsInline
            preload="metadata"
            style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block', background: '#000' }}
            onClick={e => e.stopPropagation()}
          />
        ) : post.images?.[0]?.endsWith('.mp4')
          ? <AutoPlayVideo src={post.images[0]} poster={post.images[0].replace('_video.mp4', '_thumb.jpg')} />
          : post.images?.[0]
          ? <img src={post.images[0]} alt={post.title} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', aspectRatio: '1/1', background: '#EEEDEA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 64 }}>✈️</span>
          </div>
        }
      </div>

      {/* 액션 버튼 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button onClick={() => onLike?.(post.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 26, padding: '4px 6px', lineHeight: 1 }}>
            {liked ? '❤️' : '🤍'}
          </button>
          <button onClick={() => onOpen?.(post)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, padding: '4px 6px', lineHeight: 1 }}>💬</button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, padding: '4px 6px', lineHeight: 1 }}>✈️</button>
        </div>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, padding: '4px 6px', lineHeight: 1 }}>🔖</button>
      </div>

      {/* 좋아요 수 */}
      {likeCount > 0 && (
        <div style={{ padding: '0 14px 4px', fontSize: 13, fontWeight: 700, color: '#1E2A3A' }}>좋아요 {likeCount}개</div>
      )}

      {/* 캡션 */}
      <div style={{ padding: '0 14px 5px' }}>
        <span style={{ fontSize: 13, color: '#1E2A3A' }}>
          <span style={{ fontWeight: 800 }}>{post.userNickname} </span>
          {post.title}
        </span>
        {post.content && (
          <div style={{ marginTop: 3 }}>
            <span style={{ fontSize: 13, color: '#4A5568', lineHeight: 1.5 }}>
              {showMore ? post.content : post.content.slice(0, 80)}
              {post.content.length > 80 && !showMore && (
                <span style={{ color: '#8A919C', cursor: 'pointer' }} onClick={() => setShowMore(true)}> ... 더 보기</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* 댓글 미리보기 */}
      {commentCount > 0 && (
        <button onClick={() => onOpen?.(post)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 14px 5px', fontSize: 13, color: '#8A919C', display: 'block' }}>
          댓글 {commentCount}개 모두 보기
        </button>
      )}

      {/* 해시태그 + 여행스타일 */}
      {(post.tags?.length > 0 || post.travelStyles?.length > 0) && (
        <div style={{ padding: '0 14px 12px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {post.travelStyles?.slice(0, 2).map(key => {
            const s = TRAVEL_STYLES.find(t => t.key === key);
            if (!s) return null;
            return <span key={key} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 2, background: s.bg, color: s.color, fontWeight: 700 }}>{s.icon} {s.label}</span>;
          })}
          {post.tags?.slice(0, 3).map((t, i) => (
            <span key={i} style={{ fontSize: 13, color: '#1E2A3A', cursor: 'pointer' }}>#{t}</span>
          ))}
        </div>
      )}
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
  const [feedAd, setFeedAd] = useState(null);
  const tabCache = useRef({});
  const cacheTime = useRef({});
  const [tab, setTab] = useState('all');
  const sentinelRef = useRef(null);
  const observerRef = useRef(null);

  const sortByPreference = (posts, preferredStyles) => {
    // 유저 국적 & 희망 국가 가져오기
    const savedUser = JSON.parse(sessionStorage.getItem('auth_user') || '{}');
    const nationality = savedUser?.nationality || 'KR';
    const wishCountries = JSON.parse(savedUser?.wishCountries || '[]');

    // 국가코드 → 나라명 매핑
    const COUNTRY_MAP = {
      JP: ['일본', 'japan'], US: ['미국', '하와이', 'usa'], FR: ['프랑스', 'france'],
      IT: ['이탈리아', 'italy', '로마'], TH: ['태국', '방콕', 'thailand'],
      ID: ['발리', '인도네시아', 'bali'], ES: ['스페인', 'spain', '바르셀로나'],
      GB: ['영국', '런던', 'london'], AU: ['호주', 'australia'],
      SG: ['싱가포르', 'singapore'], VN: ['베트남', 'vietnam'],
      CN: ['중국', 'china'], HK: ['홍콩', 'hong kong'],
      TR: ['터키', '이스탄불'], MA: ['모로코', '마라케시'],
      MX: ['멕시코', 'mexico'], CZ: ['체코', '프라하'],
      NL: ['네덜란드', '암스테르담'], AE: ['두바이', 'dubai'],
      KR: ['한국', '서울', 'korea'],
    };

    const matchesCountry = (post, codes) => {
      const city = (post.city || '').toLowerCase();
      const country = (post.country || '').toLowerCase();
      return codes.some(code => {
        const keywords = COUNTRY_MAP[code] || [];
        return keywords.some(k => city.includes(k.toLowerCase()) || country.includes(k.toLowerCase()));
      });
    };

    return [...posts].sort((a, b) => {
      // 1순위: 희망 국가
      const aWish = wishCountries.length > 0 && matchesCountry(a, wishCountries) ? 2 : 0;
      const bWish = wishCountries.length > 0 && matchesCountry(b, wishCountries) ? 2 : 0;
      if (bWish !== aWish) return bWish - aWish;
      // 2순위: TRAVEL STYLE
      const aStyle = (preferredStyles?.length && (a.travelStyles || []).some(s => preferredStyles.includes(s))) ? 1 : 0;
      const bStyle = (preferredStyles?.length && (b.travelStyles || []).some(s => preferredStyles.includes(s))) ? 1 : 0;
      return bStyle - aStyle;
    });
  };

  const load = async () => {
    setPage(0);
    if (tabCache.current[tab] && cacheTime.current[tab] && (Date.now() - cacheTime.current[tab]) < 60000) {
      setPosts(tabCache.current[tab]);
      setAllPosts(tabCache.current[tab]);
      return;
    }
    setLoading(true);
    setPosts([]);
    setAllPosts([]);
    try {
      if (tab === 'following' && currentUser?.id) {
        const meRes = await fetch('/api/users/' + currentUser.id);
        if (meRes.ok) {
          const meData = await meRes.json();
          const fIds = meData.followingIds || [];
          if (fIds.length > 0) {
            const data = await api.getPosts({ offset: 0, limit: 100 });
            const fPosts = (data || []).filter(p => fIds.includes(p.userId));
            const sorted = fPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setPosts(sorted);
            setAllPosts(sorted);
            tabCache.current['following'] = sorted; cacheTime.current['following'] = Date.now();
          } else {
            setPosts([]);
            tabCache.current['following'] = []; cacheTime.current['following'] = Date.now();
          }
        }
        setHasMore(false);
      } else if (tab === 'popular') {
        const data = await api.getPosts({ offset: 0, limit: 100 });
        const now = Date.now();
        const weekAgo = 7 * 24 * 60 * 60 * 1000;
        // 7일 이내 게시물만
        const recent = (data || []).filter(p => (now - new Date(p.createdAt).getTime()) < weekAgo);
        // 복합 점수: 좋아요x3 + 댓글x2 + 시간 가중치
        const scored = recent.map(p => {
          const likes = (p.likedUserIds?.length || 0) * 3;
          const comments = (p.comments?.length || 0) * 2;
          const hoursAgo = (now - new Date(p.createdAt).getTime()) / (1000 * 60 * 60);
          const timeBoost = Math.max(0, 10 - hoursAgo * 0.1);
          return { ...p, _score: likes + comments + timeBoost };
        });
        const sorted = scored.sort((a, b) => b._score - a._score);
        setPosts(sorted);
        setAllPosts(sorted);
        setHasMore(false);
        tabCache.current['popular'] = sorted; cacheTime.current['popular'] = Date.now();
      } else {
        const data = await api.getPosts({ offset: 0, limit: PAGE_SIZE });
        const sorted = sortByPreference(data || [], currentUser?.preferredStyles);
        setPosts(sorted);
        setAllPosts(sorted);
        setHasMore(sorted.length >= PAGE_SIZE);
        tabCache.current['all'] = sorted; cacheTime.current['all'] = Date.now();
      }
      try {
        const promos = await api.getPromotions();
        setPromotions(promos || []);
      } catch (e) { setPromotions([]); }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);
  useEffect(() => { load(); }, [currentUser?.id]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const nextOffset = nextPage * PAGE_SIZE;
      const data = await api.getPosts({ offset: nextOffset, limit: PAGE_SIZE });
      const sorted = sortByPreference(data || [], currentUser?.preferredStyles);
      if (sorted.length === 0) {
        setHasMore(false);
      } else {
        setAllPosts(prev => [...prev, ...sorted]);
        setPosts(prev => [...prev, ...sorted]);
        setPage(nextPage);
        setHasMore(sorted.length >= PAGE_SIZE);
      }
    } catch (e) { console.error(e); }
    setLoadingMore(false);
  }, [loadingMore, hasMore, page, currentUser]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
        loadMore();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore]);

  const handleLike = async (postId) => {
    if (!currentUser) return;
    try {
      const updated = await api.toggleLike(postId, currentUser.id);
      setPosts(prev => prev.map(p => p.id === postId ? updated : p));
      setAllPosts(prev => prev.map(p => p.id === postId ? updated : p));
    } catch (e) { console.error(e); }
  };

  // 프로모션 삽입
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

  return (
    <div style={{ width: 680, margin: '0 auto', maxWidth: '100%' }}>

      {/* 탭 — 전체 / 팔로잉 */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E2E0DC', background: 'white', position: 'sticky', top: 0, zIndex: 10 }}>
        {[['all', '📍 근처'], ['following', '👤 팔로잉'], ['popular', '🔥 인기']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === key ? 700 : 500, color: tab === key ? '#1E2A3A' : '#8A919C', borderBottom: tab === key ? '2px solid #1E2A3A' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty">불러오는 중...</div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8A919C' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✈️</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#4A5568', marginBottom: 6 }}>게시물이 없어요</div>
          <div style={{ fontSize: 13 }}>첫 번째 여행 이야기를 올려보세요!</div>
        </div>
      ) : (
        <>
          {feedItems.map((item, idx) =>
            item.type === 'promo' ? (
              <PromoCard key={`promo-${item.data.id}-${idx}`} promo={item.data} />
            ) : (
              <SNSPostCard key={item.data.id} post={item.data} currentUserId={currentUser?.id}
                onOpen={onOpenPost} onProfile={onProfile} onLike={handleLike} onReport={setReportPost} />
            )
          )}

          {/* 무한 스크롤 센티널 */}
          <div ref={sentinelRef} style={{ height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 0' }}>
            {loadingMore && <div style={{ fontSize: 12, color: '#8A919C' }}>불러오는 중...</div>}
            {!hasMore && posts.length > 0 && <div style={{ fontSize: 12, color: '#B8BCC4' }}>모든 게시물을 봤어요 ✓</div>}
          </div>
        </>
      )}

      {reportPost && <ReportModal post={reportPost} currentUser={currentUser} onClose={() => setReportPost(null)} />}
    </div>
  );
}
