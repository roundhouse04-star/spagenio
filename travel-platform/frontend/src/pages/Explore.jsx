import React, { useEffect, useState } from 'react';
import { api } from '../api';
import PostCard from '../components/PostCard';
import { TRAVEL_STYLES } from '../travelStyles';

const COUNTRIES = [
  { name: 'ALL', emoji: '🌍', flag: null },
  { name: 'Japan', emoji: '🗼', flag: '🇯🇵' },
  { name: 'France', emoji: '🥐', flag: '🇫🇷' },
  { name: 'Italy', emoji: '🍕', flag: '🇮🇹' },
  { name: 'Thailand', emoji: '🐘', flag: '🇹🇭' },
  { name: 'USA', emoji: '🗽', flag: '🇺🇸' },
  { name: 'Spain', emoji: '💃', flag: '🇪🇸' },
  { name: 'Greece', emoji: '🏛️', flag: '🇬🇷' },
  { name: 'Vietnam', emoji: '🍜', flag: '🇻🇳' },
  { name: 'Indonesia', emoji: '🌺', flag: '🇮🇩' },
  { name: 'Korea', emoji: '🍊', flag: '🇰🇷' },
];

export default function Explore({ currentUser, onOpenPost, onProfile, searchTag }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('');
  const [SelectedCountry, setSelectedCountry] = useState('ALL');
  const [SelectedStyle, setSelectedStyle] = useState('');
  const [showFilter, setShowFilter] = useState(false); // TRAVEL STYLE Filter

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
    ct = SelectedCountry === 'ALL'? '' : SelectedCountry,
    ci = city,
    style = SelectedStyle
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
      setPosts(prev => prev.map(p => p.id === postId? updated : p));
    } catch (e) { console.error(e); }
  };

  const selectCountry = (name) => {
    setSelectedCountry(name);
    setKeyword('');
    setCity('');
    load('', name === 'ALL'? '' : name, '', SelectedStyle);
  };

  const selectStyle = (key) => {
    const next = SelectedStyle === key? '' : key;
    setSelectedStyle(next);
    load(keyword, SelectedCountry === 'ALL'? '' : SelectedCountry, city, next);
  };

  const onSearch = () => load(keyword, SelectedCountry === 'ALL'? '' : SelectedCountry, city, SelectedStyle);

  const curStyle = TRAVEL_STYLES.find(s => s.key === SelectedStyle);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Country stories bar */}
      <div style={{ background: 'white', borderRadius: 3, border: '1px solid #E2E0DC', padding: '18px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#8A919C', marginBottom: 14, letterSpacing: '0.04em' }}>
          POPULAR DESTINATIONS
        </div>
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {COUNTRIES.map(c => {
            const isSelected = SelectedCountry === c.name;
            return (
              <div key={c.name} onClick={() => selectCountry(c.name)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0, cursor: 'pointer' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: isSelected? '#1E2A3A' : '#F5F4F0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26,
                  border: isSelected? '3px solid #1E2A3A' : '3px solid #E2E0DC',
                  boxShadow: isSelected? '0 0 0 3px #c7d2fe' : 'none',
                  transition: 'all 0.2s',
                }}>
                  {c.flag? c.flag : c.emoji}
                </div>
                <div style={{ fontSize: 11, fontWeight: isSelected? 700 : 500, color: isSelected? '#1E2A3A' : '#8A919C', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {c.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter toggle button */}
      <button onClick={() => setShowFilter(!showFilter)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px 20px', borderRadius: 3, border: '1px solid #E2E0DC', background: showFilter? '#FAFAF8' : 'white', color: showFilter? '#1E2A3A' : '#8A919C', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        {showFilter? '🔼 Filter Collapse' : '🔽 Style · Search filter'}
        {(SelectedStyle || keyword || city) && <span style={{ background: '#1E2A3A', color: 'white', borderRadius: 2, padding: '1px 8px', fontSize: 11 }}>ON</span>}
      </button>

      {/* TRAVEL STYLE Filter */}
      {showFilter && <>
      <div style={{ background: 'white', borderRadius: 3, border: '1px solid #E2E0DC', padding: '16px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#8A919C', marginBottom: 12, letterSpacing: '0.04em' }}>
          TRAVEL STYLE
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TRAVEL_STYLES.map(s => {
            const isSelected = SelectedStyle === s.key;
            return (
              <button key={s.key} onClick={() => selectStyle(s.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 14px', borderRadius: 2,
                  border: `1.5px solid ${isSelected? s.color : '#E2E0DC'}`,
                  background: isSelected? s.bg : 'white',
                  color: isSelected? s.color : '#8A919C',
                  fontSize: 13, fontWeight: isSelected? 700 : 500,
                  cursor: 'pointer', transition: 'all 0.1s'
                }}>
                <span style={{ fontSize: 16 }}>{s.icon}</span> {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SEARCH */}
      <div style={{ background: 'white', borderRadius: 3, border: '1px solid #E2E0DC', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="search-input" style={{ flex: 1 }}
            placeholder={SelectedCountry!== 'ALL'? `Search ${SelectedCountry} destinations, titles, tags...` : 'Search destinations, titles, tags...'}
            value={keyword} onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSearch()} />
          <button className="btn-primary" onClick={onSearch}>SEARCH</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#FAFAF8', border: '1px solid #E2E0DC', borderRadius: 2, padding: '8px 14px', fontSize: 13, color: '#8A919C' }}>
            {SelectedCountry!== 'ALL'? `🌏 ${SelectedCountry}` : '🌏 ALL Country'}
          </div>
          <input className="filter-input" placeholder="City (e.g. Osaka)" value={city}
            onChange={e => setCity(e.target.value)} style={{ flex: 1 }} />
        </div>
      </div>
      </>}

      {/* Results header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1E2A3A' }}>
          {SelectedCountry!== 'ALL'? `${COUNTRIES.find(c => c.name === SelectedCountry)?.flag} ${SelectedCountry} TRAVEL` : 'ALL TRAVEL'}
          {curStyle && (
            <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 2, background: curStyle.bg, color: curStyle.color, border: `1px solid ${curStyle.border}` }}>
              {curStyle.icon} {curStyle.label}
            </span>
          )}
          <span style={{ fontSize: 13, fontWeight: 400, color: '#8A919C', marginLeft: 8 }}>{posts}</span>
        </div>
        {(SelectedStyle || SelectedCountry!== 'ALL' || keyword) && (
          <button onClick={() => { setSelectedStyle(''); setSelectedCountry('ALL'); setKeyword(''); setCity(''); load('', '', '', ''); }}
            style={{ fontSize: 12, color: '#8A919C', background: 'none', border: '1px solid #E2E0DC', borderRadius: 2, padding: '5px 12px', cursor: 'pointer' }}>
            Filter Reset
          </button>
        )}
      </div>

      {/* POSTS List */}
      {loading? (
        <div className="empty">SEARCH...</div>
      ) : posts.length === 0? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#8A919C' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>{curStyle?.icon || '✈️'}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#4A5568', marginBottom: 4 }}>posts none</div>
          <div style={{ fontSize: 13 }}>Try other filters search again!</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, Width: '100%' }}>
          {posts.map(post => (
            <PostCard key={post.id} post={post} currentUserId={currentUser?.id}
              onOpen={onOpenPost} onProfile={onProfile} onLike={handleLike}
              onTagClick={(tag) => { setKeyword(tag); load(tag, SelectedCountry === 'ALL'? '' : SelectedCountry, city, SelectedStyle); }} />
          ))}
        </div>
      )}
    </div>
  );
}
