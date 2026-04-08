import React, { useEffect, useState } from 'react';
import { api } from '../api';
import PostCard from '../components/PostCard';

export default function Explore({ currentUser, onOpenPost, onProfile }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => { load(); }, []);

  const load = async (kw = keyword, ct = country, ci = city) => {
    setLoading(true);
    try {
      const data = await api.getPosts({ keyword: kw, country: ct, city: ci });
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

  const onSearch = () => load(keyword, country, city);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="page-header"><div className="page-title">탐색</div></div>

      <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="search-bar">
          <input className="search-input" placeholder="여행지, 제목, 태그로 검색..." value={keyword}
            onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSearch()} />
          <button className="btn-primary" onClick={onSearch}>검색</button>
        </div>
        <div className="filter-row">
          <input className="filter-select" placeholder="국가 (예: 일본)" value={country}
            onChange={e => setCountry(e.target.value)} style={{ flex: 1 }} />
          <input className="filter-select" placeholder="도시 (예: 오사카)" value={city}
            onChange={e => setCity(e.target.value)} style={{ flex: 1 }} />
        </div>
      </div>

      {loading ? (
        <div className="empty">검색 중...</div>
      ) : posts.length === 0 ? (
        <div className="empty">검색 결과가 없어요.</div>
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
