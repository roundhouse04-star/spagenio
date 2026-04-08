import React, { useEffect, useState } from 'react';
import { api } from '../api';
import PostCard from '../components/PostCard';

const COUNTRIES = [
  { name: '전체', emoji: '🌍', flag: null },
  { name: '일본', emoji: '🗼', flag: '🇯🇵' },
  { name: '프랑스', emoji: '🥐', flag: '🇫🇷' },
  { name: '이탈리아', emoji: '🍕', flag: '🇮🇹' },
  { name: '태국', emoji: '🐘', flag: '🇹🇭' },
  { name: '미국', emoji: '🗽', flag: '🇺🇸' },
  { name: '스페인', emoji: '💃', flag: '🇪🇸' },
  { name: '그리스', emoji: '🏛️', flag: '🇬🇷' },
  { name: '베트남', emoji: '🍜', flag: '🇻🇳' },
  { name: '인도네시아', emoji: '🌺', flag: '🇮🇩' },
  { name: '한국', emoji: '🍊', flag: '🇰🇷' },
];

export default function Explore({ currentUser, onOpenPost, onProfile, searchTag }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('전체');

  useEffect(() => {
    if (searchTag) {
      setKeyword(searchTag);
      load(searchTag, '', '');
    } else {
      load();
    }
  }, [searchTag]);

  const load = async (kw = keyword, ct = selectedCountry === '전체' ? '' : selectedCountry, ci = city) => {
    setLoading(true);
    try {
      const data = await api.getPosts({ keyword: kw, country: ct, city: ci, currentUserId: currentUser?.id });
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

  const selectCountry = (name) => {
    setSelectedCountry(name);
    setKeyword('');
    setCity('');
    load('', name === '전체' ? '' : name, '');
  };

  const onSearch = () => load(keyword, selectedCountry === '전체' ? '' : selectedCountry, city);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* 국가 스토리 바 */}
      <div style={{ background: 'white', borderRadius: 18, border: '1px solid #eee', padding: '18px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 14, letterSpacing: '0.04em' }}>
          인기 여행지
        </div>
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {COUNTRIES.map(c => {
            const isSelected = selectedCountry === c.name;
            return (
              <div key={c.name} onClick={() => selectCountry(c.name)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0, cursor: 'pointer' }}>
                {/* 원형 아이콘 */}
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: isSelected ? 'linear-gradient(135deg, #4f46e5, #818cf8)' : '#f3f4f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26,
                  border: isSelected ? '3px solid transparent' : '3px solid #eee',
                  boxShadow: isSelected ? '0 0 0 3px #4f46e5' : 'none',
                  transition: 'all 0.2s',
                }}>
                  {c.flag ? c.flag : c.emoji}
                </div>
                <div style={{ fontSize: 11, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#4f46e5' : '#6b7280', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {c.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 검색 */}
      <div style={{ background: 'white', borderRadius: 18, border: '1px solid #eee', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="search-input" style={{ flex: 1 }}
            placeholder={selectedCountry !== '전체' ? `${selectedCountry} 여행지, 제목, 태그로 검색...` : '여행지, 제목, 태그로 검색...'}
            value={keyword} onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSearch()} />
          <button className="btn-primary" onClick={onSearch}>검색</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#fafafa', border: '1px solid #eee', borderRadius: 10, padding: '8px 14px', fontSize: 13, color: '#9ca3af' }}>
            {selectedCountry !== '전체' ? `🌏 ${selectedCountry}` : '🌏 전체 국가'}
          </div>
          <input className="filter-input" placeholder="도시 (예: 오사카)" value={city}
            onChange={e => setCity(e.target.value)} style={{ flex: 1 }} />
        </div>
      </div>

      {/* 결과 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>
          {selectedCountry !== '전체' ? `${COUNTRIES.find(c => c.name === selectedCountry)?.flag} ${selectedCountry} 여행` : '전체 여행'}
          <span style={{ fontSize: 13, fontWeight: 400, color: '#9ca3af', marginLeft: 8 }}>{posts.length}개</span>
        </div>
      </div>

      {/* 게시물 목록 */}
      {loading ? (
        <div className="empty">검색 중...</div>
      ) : posts.length === 0 ? (
        <div className="empty">게시물이 없어요.</div>
      ) : (
        <div className="feed">
          {posts.map(post => (
            <PostCard key={post.id} post={post} currentUserId={currentUser?.id}
              onOpen={onOpenPost} onProfile={onProfile} onLike={handleLike} onTagClick={(tag) => { setKeyword(tag); load(tag, selectedCountry === '전체' ? '' : selectedCountry, city); }} />
          ))}
        </div>
      )}
    </div>
  );
}
