import React, { useEffect, useState } from 'react';
import { api } from '../api';
import PostCard from '../components/PostCard';
import { TRAVEL_STYLES } from '../travelStyles';

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
  const [selectedStyle, setSelectedStyle] = useState(''); // 여행 스타일 필터

  useEffect(() => {
    if (searchTag) {
      setKeyword(searchTag);
      load(searchTag, '', '', '');
    } else {
      load();
    }
  }, [searchTag]);

  const load = async (
    kw = keyword,
    ct = selectedCountry === '전체' ? '' : selectedCountry,
    ci = city,
    style = selectedStyle
  ) => {
    setLoading(true);
    try {
      const data = await api.getPosts({ keyword: kw, country: ct, city: ci, travelStyle: style, currentUserId: currentUser?.id });
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
    load('', name === '전체' ? '' : name, '', selectedStyle);
  };

  const selectStyle = (key) => {
    const next = selectedStyle === key ? '' : key;
    setSelectedStyle(next);
    load(keyword, selectedCountry === '전체' ? '' : selectedCountry, city, next);
  };

  const onSearch = () => load(keyword, selectedCountry === '전체' ? '' : selectedCountry, city, selectedStyle);

  const curStyle = TRAVEL_STYLES.find(s => s.key === selectedStyle);

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
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: isSelected ? '#4f46e5' : '#f3f4f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26,
                  border: isSelected ? '3px solid #4f46e5' : '3px solid #eee',
                  boxShadow: isSelected ? '0 0 0 3px #c7d2fe' : 'none',
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

      {/* 여행 스타일 필터 */}
      <div style={{ background: 'white', borderRadius: 18, border: '1px solid #eee', padding: '16px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 12, letterSpacing: '0.04em' }}>
          여행 스타일
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TRAVEL_STYLES.map(s => {
            const isSelected = selectedStyle === s.key;
            return (
              <button key={s.key} onClick={() => selectStyle(s.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 14px', borderRadius: 20,
                  border: `1.5px solid ${isSelected ? s.color : '#eee'}`,
                  background: isSelected ? s.bg : 'white',
                  color: isSelected ? s.color : '#9ca3af',
                  fontSize: 13, fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer', transition: 'all 0.1s'
                }}>
                <span style={{ fontSize: 16 }}>{s.icon}</span> {s.label}
              </button>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>
          {selectedCountry !== '전체' ? `${COUNTRIES.find(c => c.name === selectedCountry)?.flag} ${selectedCountry} 여행` : '전체 여행'}
          {curStyle && (
            <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: curStyle.bg, color: curStyle.color, border: `1px solid ${curStyle.border}` }}>
              {curStyle.icon} {curStyle.label}
            </span>
          )}
          <span style={{ fontSize: 13, fontWeight: 400, color: '#9ca3af', marginLeft: 8 }}>{posts.length}개</span>
        </div>
        {(selectedStyle || selectedCountry !== '전체' || keyword) && (
          <button onClick={() => { setSelectedStyle(''); setSelectedCountry('전체'); setKeyword(''); setCity(''); load('', '', '', ''); }}
            style={{ fontSize: 12, color: '#9ca3af', background: 'none', border: '1px solid #eee', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>
            필터 초기화
          </button>
        )}
      </div>

      {/* 게시물 목록 */}
      {loading ? (
        <div className="empty">검색 중...</div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>{curStyle?.icon || '✈️'}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 4 }}>게시물이 없어요</div>
          <div style={{ fontSize: 13 }}>다른 필터로 검색해보세요!</div>
        </div>
      ) : (
        <div className="feed">
          {posts.map(post => (
            <PostCard key={post.id} post={post} currentUserId={currentUser?.id}
              onOpen={onOpenPost} onProfile={onProfile} onLike={handleLike}
              onTagClick={(tag) => { setKeyword(tag); load(tag, selectedCountry === '전체' ? '' : selectedCountry, city, selectedStyle); }} />
          ))}
        </div>
      )}
    </div>
  );
}
