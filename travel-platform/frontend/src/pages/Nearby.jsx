import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { TRAVEL_STYLES } from '../travelStyles';

// Distance Display
function distLabel(km) {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

// SAVED NEARBY ALERTS Banner
function SavedNearbyBanner({ places, onOpenMaps }) {
  if (!places.length) return null;
  return (
    <div style={{ background: '#1E2A3A', borderRadius: 3, padding: '16px 20px', color: 'white' }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>
        🔔 SAVED PLACES NEARBY
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {places.slice(0, 3).map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.15)', borderRadius: 3, padding: '10px 14px' }}>
            {p.image && <img src={p.image} style={{ width: 40, height: 40, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }} alt="" />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{p.placeName}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{p.postTitle} · {p.userNickname}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{distLabel(p.distKm)}</div>
              {p.lat && p.lng && (
                <button onClick={() => onOpenMaps(p.lat, p.lng, p.placeName)}
                  style={{ fontSize: 10, marginTop: 3, padding: '2px 8px', background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer' }}>
                  Directions
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Nearby POSTS card
function NearbyPostCard({ post, onOpen, closestDist }) {
  const FirstImg = post.images?.[0];
  const styles = post.travelStyles || [];
  return (
    <div onClick={() => onOpen?.(post)}
      style={{ background: 'white', border: '1px solid #eee', borderRadius: 3, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.1s' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.01)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
      {FirstImg && (
        <img src={FirstImg} alt={post.title}
          style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ padding: '12px 14px' }}>
        {styles.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {styles.slice(0, 2).map(key => {
              const s = TRAVEL_STYLES.find(t => t.key === key);
              if (!s) return null;
              return (
                <span key={key} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 2, background: s.bg, color: s.color, fontWeight: 700 }}>
                  {s.icon} {s.label}
                </span>
              );
            })}
          </div>
        )}
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1E2A3A', marginBottom: 4 }}>{post.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: '#8A919C' }}>
            {post.userNickname} · {post.city || post.country || ''}
          </div>
          {closestDist!= null && (
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1E2A3A', background: '#EEEDEA', padding: '2px 8px', borderRadius: 2 }}>
              📍 {distLabel(closestDist)}
            </div>
          )}
        </div>
        {post.places?.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#8A919C' }}>
            📍 {post.places.slice(0, 2).map(p => p.name).join(' · ')}
            {post.places.length > 2? ` +${post.places.length - 2}` : ''}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Nearby({ currentUser, onOpenPost }) {
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [nearbyPosts, setNearbyPosts] = useState([]);
  const [savedNearby, setSavedNearby] = useState([]);
  const [radius, setRadius] = useState(2.0);
  const [styleFilter, setStyleFilter] = useState('');
  const [tab, setTab] = useState('around'); // around | saved

  const getLocation = useCallback(() => {
    setLoading(true);
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('This browser does not support location services.');
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc);
        loadNearby(loc);
      },
      err => {
        setLocationError('Location permission required. Please enable it in browser settings.');
        setLoading(false);
      },
      { timeout: 10000, imumAge: 60000 }
    );
  }, [radius]);

  const loadNearby = async (loc) => {
    setLoading(true);
    try {
      const [posts, saved] = await Promise.all([
        api.getPostsNearby(loc.lat, loc.lng, radius),
        currentUser? api.getSavedPlacesNearby(currentUser.id, loc.lat, loc.lng, 1.0) : Promise.resolve([]),
      ]);

      // Calculate distance to the nearest place for each post
      const postsWithDist = (posts || []).map(post => {
        let minDist = Infinity;
        (post.places || []).forEach(place => {
          if (!place.lat ||!place.lng) return;
          const dLat = (place.lat - loc.lat) * Math.PI / 180;
          const dLng = (place.lng - loc.lng) * Math.PI / 180;
          const a = Math.sin(dLat/2)**2 + Math.cos(loc.lat*Math.PI/180) * Math.cos(place.lat*Math.PI/180) * Math.sin(dLng/2)**2;
          const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          if (dist < minDist) minDist = dist;
        });
        return {...post, _dist: minDist === Infinity? null : minDist };
      });
      postsWithDist.sort((a, b) => (a._dist?? 999) - (b._dist?? 999));

      setNearbyPosts(postsWithDist);
      setSavedNearby(saved || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { getLocation(); }, []);

  const openMaps = (lat, lng, name) => {
    window.open(`https://maps.google.com/?q=${lat},${lng}&label=${encodeURIComponent(name)}`, '_blank');
  };

  const filtered = styleFilter
   ? nearbyPosts.filter(p => (p.travelStyles || []).includes(styleFilter))
    : nearbyPosts;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 500, color: '#1E2A3A', letterSpacing: -0.8 }}>Nearby</div>
          {location && (
            <div style={{ fontSize: 12, color: '#8A919C', marginTop: 2 }}>
              Current location · RADIUS {radius}km
            </div>
          )}
        </div>
        <button onClick={getLocation}
          style={{ padding: '8px 16px', background: '#1E2A3A', color: 'white', border: 'none', borderRadius: 3, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {loading? 'SEARCHING...' : 'REFRESH'}
        </button>
      </div>

      {/* Location Error */}
      {locationError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 3, padding: '14px 16px', fontSize: 13, color: '#dc2626' }}>
          ⚠️ {locationError}
          <button onClick={getLocation}
            style={{ marginLeft: 10, color: '#1E2A3A', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
            Try again
          </button>
        </div>
      )}

      {/* SAVED NEARBY Banner */}
      {savedNearby.length > 0 && (
        <SavedNearbyBanner places={savedNearby} onOpenMaps={openMaps} />
      )}

      {/* RADIUS Settings */}
      {location && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#8A919C', fontWeight: 600 }}>RADIUS</span>
          {[0.5, 1, 2, 5, 10].map(r => (
            <button key={r} onClick={() => { setRadius(r); loadNearby(location); }}
              style={{ padding: '5px 12px', borderRadius: 2, border: `1.5px solid ${radius === r? '#1E2A3A' : '#E2E0DC'}`, background: radius === r? '#EEEDEA' : 'white', color: radius === r? '#1E2A3A' : '#8A919C', fontSize: 12, fontWeight: radius === r? 700 : 500, cursor: 'pointer' }}>
              {r < 1? `${r*1000}m` : `${r}km`}
            </button>
          ))}
        </div>
      )}

      {/* Tab */}
      <div style={{ display: 'flex', gap: 4, background: '#F5F4F0', borderRadius: 3, padding: 4 }}>
        {[['around', 'AROUND'], ['saved', `🔖 SAVED NEARBY ${savedNearby.length > 0? `(${savedNearby.length})` : ''}`]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ flex: 1, padding: '9px 4px', borderRadius: 9, border: 'none', background: tab === key? 'white' : 'transparent', color: tab === key? '#1E2A3A' : '#8A919C', fontSize: 13, fontWeight: tab === key? 700 : 500, cursor: 'pointer', boxShadow: tab === key? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Nearby POSTS Tab */}
      {tab === 'around' && (
        <>
          {/* TRAVEL Style Filter */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setStyleFilter('')}
              style={{ padding: '5px 12px', borderRadius: 2, border: `1.5px solid ${!styleFilter? '#1E2A3A' : '#E2E0DC'}`, background:!styleFilter? '#EEEDEA' : 'white', color:!styleFilter? '#1E2A3A' : '#8A919C', fontSize: 12, fontWeight:!styleFilter? 700 : 500, cursor: 'pointer' }}>
              🌍 ALL
            </button>
            {TRAVEL_STYLES.map(s => {
              const isSelected = styleFilter === s.key;
              return (
                <button key={s.key} onClick={() => setStyleFilter(isSelected? '' : s.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 2, border: `1.5px solid ${isSelected? s.color : '#E2E0DC'}`, background: isSelected? s.bg : 'white', color: isSelected? s.color : '#8A919C', fontSize: 12, fontWeight: isSelected? 700 : 500, cursor: 'pointer' }}>
                  <span style={{ fontSize: 13 }}>{s.icon}</span> {s.label}
                </button>
              );
            })}
          </div>

          {loading? (
            <div className="empty">Searching by location...</div>
          ) :!location? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#8A919C' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📍</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#4A5568', marginBottom: 6 }}>Location permission required</div>
              <div style={{ fontSize: 13 }}>Find nearby restaurants and travel courses</div>
              <button onClick={getLocation}
                style={{ marginTop: 16, padding: '10px 24px', background: '#1E2A3A', color: 'white', border: 'none', borderRadius: 3, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Location Allow
              </button>
            </div>
          ) : filtered.length === 0? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#8A919C' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#4A5568', marginBottom: 4 }}>No nearby posts</div>
              <div style={{ fontSize: 13 }}>RADIUS expand or directly Travel story post!</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, min(280px, 1fr))', gap: 12 }}>
              {filtered.map(post => (
                <NearbyPostCard key={post.id} post={post} onOpen={onOpenPost} closestDist={post._dist} />
              ))}
            </div>
          )}
        </>
      )}

      {/* SAVEone Place Tab */}
      {tab === 'saved' && (
        savedNearby.length === 0? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#8A919C' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔖</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#4A5568', marginBottom: 4 }}>
              {!location? 'ENABLE LOCATION' : 'NO SAVED PLACES NEARBY'}
            </div>
            <div style={{ fontSize: 13 }}>Save places from posts to see them here</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {savedNearby.map((p, i) => (
              <div key={i} style={{ background: 'white', border: '1px solid #eee', borderRadius: 3, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                {p.image && <img src={p.image} style={{ width: 56, height: 56, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }} alt="" />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1E2A3A', marginBottom: 2 }}>{p.placeName}</div>
                  <div style={{ fontSize: 12, color: '#8A919C', marginBottom: 2 }}>{p.postTitle}</div>
                  {p.address && <div style={{ fontSize: 11, color: '#8A919C' }}>{p.address}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1E2A3A' }}>{distLabel(p.distKm)}</div>
                  <button onClick={() => openMaps(p.lat, p.lng, p.placeName)}
                    style={{ marginTop: 6, padding: '5px 12px', background: '#1E2A3A', color: 'white', border: 'none', borderRadius: 2, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    Directions
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
