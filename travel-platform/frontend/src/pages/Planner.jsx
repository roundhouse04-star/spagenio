import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api';

// ── 지도 컴포넌트 (Leaflet + Nominatim + Overpass) ────────
const CATEGORY = {
  restaurant: { label: '맛집',   icon: '🍽️', color: '#ef4444' },
  cafe:       { label: '카페',   icon: '☕', color: '#f59e0b' },
  subway:     { label: '교통',   icon: '🚇', color: '#10b981' },
  hotel:      { label: '숙소',   icon: '🏨', color: '#8b5cf6' },
  attraction: { label: '관광',   icon: '🏛️', color: '#0ea5e9' },
  convenience:{ label: '편의점', icon: '🏪', color: '#6b7280' },
};

function classifyNode(tags) {
  if (tags.railway === 'subway_entrance' || tags.railway === 'station' || tags.public_transport === 'station') return 'subway';
  if (tags.highway === 'bus_stop' || tags.public_transport === 'stop_position') return 'subway';
  if (tags.tourism === 'hotel' || tags.tourism === 'hostel' || tags.tourism === 'guest_house') return 'hotel';
  if (tags.tourism) return 'attraction';
  if (tags.amenity === 'cafe') return 'cafe';
  if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food') return 'restaurant';
  if (tags.shop) return 'convenience';
  return 'attraction';
}

function calcDist(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return d < 1000 ? `${Math.round(d)}m` : `${(d/1000).toFixed(1)}km`;
}

function PlanMap({ onAddPlace, planPlaces = [] }) {
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const markersRef = useRef([]);
  const nearbyMarkersRef = useRef([]);
  const selectedMarkerRef = useRef(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [nearby, setNearby] = useState([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (window.L) { setLeafletLoaded(true); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || mapInst.current) return;
    const L = window.L;
    const map = L.map(mapRef.current).setView([37.5665, 126.9780], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19
    }).addTo(map);

    // 지도 클릭 시 장소 선택
    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      // 역지오코딩으로 주소 가져오기
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
        const data = await res.json();
        const name = data.name || data.display_name?.split(',')[0] || '선택한 위치';
        const address = data.display_name || '';
        selectLocation(lat, lng, name, address);
      } catch {
        selectLocation(lat, lng, '선택한 위치', '');
      }
    });

    mapInst.current = map;
    renderPlanMarkers(planPlaces);
  }, [leafletLoaded]);

  useEffect(() => {
    renderPlanMarkers(planPlaces);
  }, [planPlaces, leafletLoaded]);

  const renderPlanMarkers = (places) => {
    if (!mapInst.current || !window.L) return;
    const L = window.L;
    markersRef.current.forEach(m => mapInst.current.removeLayer(m));
    markersRef.current = [];
    places.forEach((p, i) => {
      if (!p.lat || !p.lng) return;
      const icon = L.divIcon({
        html: `<div style="width:30px;height:30px;border-radius:50%;background:#4f46e5;color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25)">${i+1}</div>`,
        className: '', iconSize: [30,30], iconAnchor: [15,30]
      });
      const m = L.marker([p.lat, p.lng], { icon }).addTo(mapInst.current);
      m.bindPopup(`<div style="font-size:13px;font-weight:700">📍 ${p.name}</div>`);
      markersRef.current.push(m);
    });
  };

  const selectLocation = (lat, lng, name, address) => {
    if (!mapInst.current || !window.L) return;
    const L = window.L;
    if (selectedMarkerRef.current) mapInst.current.removeLayer(selectedMarkerRef.current);
    const icon = L.divIcon({
      html: `<div style="width:36px;height:36px;border-radius:50%;background:#ef4444;color:white;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3)">📍</div>`,
      className: '', iconSize: [36,36], iconAnchor: [18,36]
    });
    const m = L.marker([lat, lng], { icon }).addTo(mapInst.current);
    m.bindPopup(`<div style="font-size:13px;font-weight:700">${name}</div><div style="font-size:11px;color:#9ca3af;margin-top:4px">${address.slice(0,50)}...</div>`).openPopup();
    selectedMarkerRef.current = m;
    setSelectedPlace({ lat, lng, name, address });
    fetchNearby(lat, lng);
  };

  const searchPlace = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true); setSearchResults([]);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5`);
      const data = await res.json();
      setSearchResults(data);
    } catch (e) { console.error(e); }
    setSearching(false);
  };

  const goToResult = (result) => {
    if (!mapInst.current) return;
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    mapInst.current.flyTo([lat, lng], 16, { duration: 1 });
    selectLocation(lat, lng, result.display_name.split(',')[0], result.display_name);
    setSearchResults([]);
    setSearchQuery(result.display_name.split(',')[0]);
  };

  const fetchNearby = async (lat, lng) => {
    setLoadingNearby(true); setNearby([]);
    clearNearbyMarkers();
    try {
      const query = `[out:json][timeout:25];(node["amenity"~"restaurant|cafe|fast_food|bar"](around:600,${lat},${lng});node["tourism"~"attraction|museum|hotel|hostel"](around:600,${lat},${lng});node["railway"~"subway_entrance|station"](around:800,${lat},${lng});node["highway"="bus_stop"](around:600,${lat},${lng});node["shop"~"convenience|supermarket"](around:400,${lat},${lng}););out body 50;`;
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST', body: 'data=' + encodeURIComponent(query)
      });
      const data = await res.json();
      const items = (data.elements || [])
        .filter(n => n.tags?.name)
        .map(n => ({
          id: n.id, name: n.tags.name,
          type: classifyNode(n.tags || {}),
          lat: n.lat, lng: n.lon,
          dist: calcDist(lat, lng, n.lat, n.lon),
          address: n.tags['addr:street'] || '',
        }))
        .sort((a, b) => {
          const toM = d => parseFloat(d.replace('km','000').replace('m',''));
          return toM(a.dist) - toM(b.dist);
        })
        .slice(0, 40);
      setNearby(items);
      addNearbyMarkers(items);
    } catch (e) { console.error(e); }
    setLoadingNearby(false);
  };

  const clearNearbyMarkers = () => {
    if (!mapInst.current) return;
    nearbyMarkersRef.current.forEach(m => mapInst.current.removeLayer(m));
    nearbyMarkersRef.current = [];
  };

  const addNearbyMarkers = (items) => {
    if (!mapInst.current || !window.L) return;
    const L = window.L;
    items.forEach(p => {
      const cfg = CATEGORY[p.type] || CATEGORY.attraction;
      const icon = L.divIcon({
        html: `<div style="width:26px;height:26px;border-radius:50%;background:${cfg.color};display:flex;align-items:center;justify-content:center;font-size:12px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.2)">${cfg.icon}</div>`,
        className: '', iconSize: [26,26], iconAnchor: [13,26]
      });
      const m = L.marker([p.lat, p.lng], { icon }).addTo(mapInst.current);
      m.bindPopup(`<div style="font-size:13px;font-weight:700">${cfg.icon} ${p.name}</div><div style="font-size:11px;color:#9ca3af">${p.dist}</div>`);
      nearbyMarkersRef.current.push(m);
    });
  };

  const flyToNearby = (p) => {
    if (!mapInst.current) return;
    mapInst.current.flyTo([p.lat, p.lng], 17, { duration: 0.6 });
  };

  const filtered = filter === 'all' ? nearby : nearby.filter(p => p.type === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 검색 */}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchPlace()}
            placeholder="장소 검색 (예: 에펠탑, 도쿄역...)"
            style={{ flex: 1, padding: '11px 16px', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 14, outline: 'none' }} />
          <button onClick={searchPlace} disabled={searching}
            style={{ padding: '11px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            {searching ? '...' : '검색'}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #eee', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, marginTop: 4, overflow: 'hidden' }}>
            {searchResults.map(r => (
              <div key={r.place_id} onClick={() => goToResult(r)}
                style={{ padding: '11px 16px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}
                onMouseEnter={e => e.currentTarget.style.background = '#f5f6f8'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{r.display_name.split(',')[0]}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{r.display_name.split(',').slice(1,3).join(',')}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 지도 */}
      <div ref={mapRef} style={{ width: '100%', height: 340, borderRadius: 16, border: '1px solid #eee', overflow: 'hidden', background: '#f0f4f8' }}>
        {!leafletLoaded && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14 }}>지도 불러오는 중...</div>}
      </div>

      {/* 선택된 장소 → 일정 추가 */}
      {selectedPlace && (
        <div style={{ background: '#eef2ff', border: '1.5px solid #c7d2fe', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>📍 {selectedPlace.name}</div>
            <div style={{ fontSize: 11, color: '#6366f1', marginTop: 3 }}>위도 {selectedPlace.lat.toFixed(5)}, 경도 {selectedPlace.lng.toFixed(5)}</div>
          </div>
          <button onClick={() => onAddPlace(selectedPlace)}
            style={{ padding: '9px 18px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            + 일정에 추가
          </button>
        </div>
      )}

      {/* 주변 장소 */}
      {(loadingNearby || nearby.length > 0) && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>
            📍 주변 장소
            {loadingNearby && <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400, marginLeft: 6 }}>검색 중...</span>}
            {!loadingNearby && <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400, marginLeft: 6 }}>{filtered.length}곳</span>}
          </div>

          {/* 필터 */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {[['all','전체','#4f46e5'], ...Object.entries(CATEGORY).map(([k,v]) => [k, `${v.icon} ${v.label}`, v.color])].map(([key, label, color]) => (
              <button key={key} onClick={() => setFilter(key)}
                style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${filter === key ? color : '#eee'}`, background: filter === key ? color : 'white', color: filter === key ? 'white' : '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
            {filtered.map(p => {
              const cfg = CATEGORY[p.type] || CATEGORY.attraction;
              return (
                <div key={p.id} onClick={() => flyToNearby(p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', border: '1px solid #eee', borderRadius: 12, padding: '10px 14px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#c7d2fe'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#eee'}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: cfg.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{cfg.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{cfg.label} · {p.dist}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); onAddPlace(p); }}
                    style={{ padding: '5px 10px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#4f46e5', cursor: 'pointer', flexShrink: 0 }}>
                    + 추가
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 장소 아이템 컴포넌트 ──────────────────────────────────
function PlanItem({ item, idx, onRemove, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(item.date || '');
  const [memo, setMemo] = useState(item.memo || '');

  const save = () => { onUpdate(item.id, date, memo); setEditing(false); };
  const cancel = () => { setDate(item.date || ''); setMemo(item.memo || ''); setEditing(false); };

  return (
    <div style={{ border: `1px solid ${editing ? '#c7d2fe' : '#eee'}`, borderRadius: 14, padding: '14px 16px', background: editing ? '#fafbff' : 'white', transition: 'all 0.15s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#4f46e5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{idx + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>{item.placeName}</div>
          {item.address && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{item.address}</div>}
          {item.category && <div style={{ fontSize: 11, color: '#6366f1', marginTop: 2 }}>📌 {item.category}</div>}
          {item.howToGet && <div style={{ fontSize: 12, color: '#4f46e5', marginTop: 3 }}>🚇 {item.howToGet}</div>}
          {item.tip && <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 3 }}>💡 {item.tip}</div>}
          {item.fromUserNickname && <div style={{ fontSize: 11, color: '#bbb', marginTop: 3 }}>출처: @{item.fromUserNickname}</div>}

          {!editing ? (
            <>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {item.date && <span style={{ fontSize: 12, color: '#4f46e5', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 8, padding: '3px 10px', fontWeight: 600 }}>📅 {item.date}</span>}
                {item.memo && <span style={{ fontSize: 12, color: '#555', background: '#f9fafb', border: '1px solid #eee', borderRadius: 8, padding: '3px 10px' }}>📝 {item.memo}</span>}
                {!item.date && !item.memo && <span style={{ fontSize: 12, color: '#d1d5db' }}>날짜/메모 없음</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setEditing(true)}
                  style={{ padding: '4px 10px', background: '#f3f4f6', border: '1px solid #eee', borderRadius: 8, fontSize: 11, fontWeight: 600, color: '#555', cursor: 'pointer' }}>
                  ✏️ {item.date || item.memo ? '수정' : '날짜/메모 추가'}
                </button>
                {item.lat && item.lng && (
                  <a href={`https://maps.google.com/?q=${item.lat},${item.lng}`} target="_blank" rel="noreferrer"
                    style={{ padding: '4px 10px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 8, fontSize: 11, fontWeight: 600, color: '#4f46e5', textDecoration: 'none' }}>🗺 지도</a>
                )}
              </div>
            </>
          ) : (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#6b7280', width: 40, flexShrink: 0 }}>📅 날짜</span>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={{ flex: 1, padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 12, color: '#6b7280', width: 40, flexShrink: 0, paddingTop: 8 }}>📝 메모</span>
                <textarea value={memo} onChange={e => setMemo(e.target.value)}
                  placeholder="예: 오전 10시 방문, 예약 필요" rows={2}
                  style={{ flex: 1, padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={save} style={{ flex: 1, padding: '8px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>저장</button>
                <button onClick={cancel} style={{ flex: 1, padding: '8px', background: '#f3f4f6', color: '#555', border: 'none', borderRadius: 9, fontSize: 13, cursor: 'pointer' }}>취소</button>
              </div>
            </div>
          )}
        </div>
        <button onClick={() => onRemove(item.id)}
          style={{ color: '#e5e7eb', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, flexShrink: 0, padding: '0 2px' }}
          onMouseEnter={e => e.target.style.color = '#ef4444'}
          onMouseLeave={e => e.target.style.color = '#e5e7eb'}>✕</button>
      </div>
    </div>
  );
}

// ── 메인 Planner ──────────────────────────────────────────
export default function Planner({ currentUser, plans, onUpdatePlans }) {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [newPlan, setNewPlan] = useState({ title: '', startDate: '', endDate: '', shareType: 'private', shareSchedule: false, sharePlaces: false });
  const [viewMode, setViewMode] = useState('list'); // list | map | chat
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [followings, setFollowings] = useState([]);
  const [memberPlans, setMemberPlans] = useState([]);
  const msgEndRef = React.useRef(null);
  const pollRef = React.useRef(null);

  useEffect(() => { if (currentUser) load(); }, [currentUser]);
  useEffect(() => { if (plans?.length > 0 && !selected) setSelected(plans[0]); }, [plans]);

  useEffect(() => {
    if (selected && viewMode === 'chat') {
      loadMessages();
      pollRef.current = setInterval(loadMessages, 30000);
    }
    return () => clearInterval(pollRef.current);
  }, [selected?.id, viewMode]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const load = async () => {
    setLoading(true);
    try {
      const [owned, membered] = await Promise.all([
        api.getUserPlans(currentUser.id),
        api.getMemberPlans(currentUser.id),
      ]);
      const allPlans = [...(owned || []), ...(membered || [])];
      onUpdatePlans?.(owned || []);
      setMemberPlans(membered || []);
      if (allPlans.length > 0) setSelected(allPlans[0]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadMessages = async () => {
    if (!selected) return;
    try {
      const data = await api.getMessages(selected.id);
      setMessages(data || []);
    } catch (e) { console.error(e); }
  };

  const loadFollowings = async () => {
    try {
      const data = await api.getFollowings(currentUser.id);
      setFollowings(data || []);
    } catch (e) { console.error(e); }
  };

  const sendMessage = async () => {
    if (!msgText.trim() || !selected) return;
    try {
      const msg = await api.sendMessage(selected.id, {
        userId: currentUser.id, content: msgText, type: 'text'
      });
      setMessages(prev => [...prev, msg]);
      setMsgText('');
    } catch (e) { console.error(e); }
  };

  const inviteMember = async (userId, nickname) => {
    if (!selected) return;
    try {
      const updated = await api.inviteMember(selected.id, userId);
      setSelected(updated);
      onUpdatePlans?.((plans || []).map(p => p.id === updated.id ? updated : p));
      // 시스템 메시지
      await api.sendMessage(selected.id, {
        userId: currentUser.id, content: `${currentUser.nickname}님이 ${nickname}님을 초대했어요.`, type: 'system'
      });
      await loadMessages();
      setShowInvite(false);
    } catch (e) { console.error(e); }
  };

  const kickMember = async (userId, nickname) => {
    if (!selected || !confirm(`${nickname}님을 내보내시겠습니까?`)) return;
    try {
      const updated = await api.removeMember(selected.id, userId);
      setSelected(updated);
      onUpdatePlans?.((plans || []).map(p => p.id === updated.id ? updated : p));
    } catch (e) { console.error(e); }
  };

  const createPlan = async () => {
    if (!newPlan.title.trim()) return;
    try {
      const created = await api.createPlan({ ...newPlan, userId: currentUser.id });
      onUpdatePlans?.([created, ...(plans || [])]);
      setSelected(created);
      setShowNewPlan(false);
      setNewPlan({ title: '', startDate: '', endDate: '' });
    } catch (e) { console.error(e); }
  };

  const savePlanEdit = async () => {
    if (!editPlan || !editPlan.title.trim()) return;
    try {
      const updated = await api.updatePlan(editPlan.id, { title: editPlan.title, startDate: editPlan.startDate, endDate: editPlan.endDate });
      onUpdatePlans?.(plans.map(p => p.id === updated.id ? updated : p));
      if (selected?.id === updated.id) setSelected(updated);
      setEditPlan(null);
    } catch (e) { console.error(e); }
  };

  const deletePlan = async (planId) => {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    try {
      await api.deletePlan(planId);
      const next = (plans || []).filter(p => p.id !== planId);
      onUpdatePlans?.(next);
      setSelected(next[0] || null);
    } catch (e) { console.error(e); }
  };

  const removeItem = async (itemId) => {
    if (!selected) return;
    try {
      const updated = await api.removePlanItem(selected.id, itemId);
      setSelected(updated);
      onUpdatePlans?.((plans || []).map(p => p.id === updated.id ? updated : p));
    } catch (e) { console.error(e); }
  };

  const updateItem = async (itemId, date, memo) => {
    if (!selected) return;
    try {
      const item = selected.items.find(i => i.id === itemId);
      if (!item) return;
      await api.removePlanItem(selected.id, itemId);
      const updated = await api.addPlanItem(selected.id, { ...item, date, memo });
      setSelected(updated);
      onUpdatePlans?.((plans || []).map(p => p.id === updated.id ? updated : p));
    } catch (e) { console.error(e); }
  };

  const addPlaceToSelected = async (place) => {
    if (!selected) { alert('먼저 일정을 선택해주세요.'); return; }
    try {
      const item = {
        placeName: place.name, lat: place.lat || 0, lng: place.lng || 0,
        address: place.address || '', category: CATEGORY[place.type]?.label || place.category || '기타',
        howToGet: '', tip: '', fromPostId: '', fromPostTitle: '', fromUserNickname: '',
        date: '', memo: '',
      };
      const updated = await api.addPlanItem(selected.id, item);
      setSelected(updated);
      onUpdatePlans?.((plans || []).map(p => p.id === updated.id ? updated : p));
      alert(`"${place.name}"을 일정에 추가했어요! ✅`);
    } catch (e) { console.error(e); }
  };

  const planPlaces = selected?.items?.filter(i => i.lat && i.lng).map(i => ({
    name: i.placeName, lat: i.lat, lng: i.lng,
  })) || [];

  if (!currentUser) return <div className="empty">로그인이 필요해요.</div>;
  if (loading) return <div className="empty">불러오는 중...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="page-header">
        <div className="page-title">내 여행 플래너</div>
        <button className="btn-primary" onClick={() => setShowNewPlan(true)}>+ 새 일정</button>
      </div>

      {/* 새 일정 만들기 */}
      {showNewPlan && (
        <div className="post-form" style={{ gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>새 일정 만들기</div>
          <input className="form-input" placeholder="일정 이름 (예: 오사카 3박 4일)" value={newPlan.title}
            onChange={e => setNewPlan(p => ({ ...p, title: e.target.value }))} />
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">출발일</label>
              <input type="date" className="form-input" value={newPlan.startDate}
                onChange={e => setNewPlan(p => ({ ...p, startDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">도착일</label>
              <input type="date" className="form-input" value={newPlan.endDate}
                onChange={e => setNewPlan(p => ({ ...p, endDate: e.target.value }))} />
            </div>
          </div>
          {/* 공유 설정 */}
          <div style={{ background: '#f9fafb', border: '1px solid #eee', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>🔗 공유 설정</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {[['private','🔒 비공개'], ['friends','👥 친구 공개'], ['public','🌍 전체 공개']].map(([val, label]) => (
                <button key={val} onClick={() => setNewPlan(p => ({...p, shareType: val}))}
                  style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: `2px solid ${newPlan.shareType === val ? '#4f46e5' : '#eee'}`, background: newPlan.shareType === val ? '#eef2ff' : 'white', color: newPlan.shareType === val ? '#4f46e5' : '#9ca3af', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
            {newPlan.shareType !== 'private' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={newPlan.shareSchedule}
                    onChange={e => setNewPlan(p => ({...p, shareSchedule: e.target.checked}))}
                    style={{ width: 16, height: 16, accentColor: '#4f46e5' }} />
                  <span style={{ color: '#374151', fontWeight: 600 }}>📅 일정 공유</span>
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>— 여행 날짜를 공유해요</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={newPlan.sharePlaces}
                    onChange={e => setNewPlan(p => ({...p, sharePlaces: e.target.checked}))}
                    style={{ width: 16, height: 16, accentColor: '#4f46e5' }} />
                  <span style={{ color: '#374151', fontWeight: 600 }}>📍 장소 공유</span>
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>— 방문할 장소를 공유해요</span>
                </label>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={createPlan}>만들기</button>
            <button className="btn-secondary" onClick={() => setShowNewPlan(false)}>취소</button>
          </div>
        </div>
      )}

      {/* 일정 수정 */}
      {editPlan && (
        <div className="post-form" style={{ gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>일정 수정</div>
          <input className="form-input" placeholder="일정 이름" value={editPlan.title}
            onChange={e => setEditPlan(p => ({ ...p, title: e.target.value }))} />
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">출발일</label>
              <input type="date" className="form-input" value={editPlan.startDate || ''}
                onChange={e => setEditPlan(p => ({ ...p, startDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">도착일</label>
              <input type="date" className="form-input" value={editPlan.endDate || ''}
                onChange={e => setEditPlan(p => ({ ...p, endDate: e.target.value }))} />
            </div>
          </div>
          {/* 공유 설정 */}
          <div style={{ background: '#f9fafb', border: '1px solid #eee', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>🔗 공유 설정</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {[['private','🔒 비공개'], ['friends','👥 친구 공개'], ['public','🌍 전체 공개']].map(([val, label]) => (
                <button key={val} onClick={() => setEditPlan(p => ({...p, shareType: val}))}
                  style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: `2px solid ${editPlan.shareType === val ? '#4f46e5' : '#eee'}`, background: editPlan.shareType === val ? '#eef2ff' : 'white', color: editPlan.shareType === val ? '#4f46e5' : '#9ca3af', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
            {editPlan.shareType !== 'private' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={editPlan.shareSchedule}
                    onChange={e => setEditPlan(p => ({...p, shareSchedule: e.target.checked}))}
                    style={{ width: 16, height: 16, accentColor: '#4f46e5' }} />
                  <span style={{ color: '#374151', fontWeight: 600 }}>📅 일정 공유</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={editPlan.sharePlaces}
                    onChange={e => setEditPlan(p => ({...p, sharePlaces: e.target.checked}))}
                    style={{ width: 16, height: 16, accentColor: '#4f46e5' }} />
                  <span style={{ color: '#374151', fontWeight: 600 }}>📍 장소 공유</span>
                </label>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={savePlanEdit}>저장</button>
            <button className="btn-secondary" onClick={() => setEditPlan(null)}>취소</button>
          </div>
        </div>
      )}

      {(!plans || plans.length === 0) && !showNewPlan ? (
        <div className="empty">아직 일정이 없어요.<br/>새 일정을 만들고 장소를 추가해보세요!</div>
      ) : (
        <div className="plan-layout">
          {/* 왼쪽: 일정 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(plans || []).map(plan => (
              <div key={plan.id} className="plan-card"
                onClick={() => { setSelected(plan); setViewMode('list'); }}
                style={{ outline: selected?.id === plan.id ? '2px solid #4f46e5' : 'none', position: 'relative' }}>
                <div className="plan-card-title">{plan.title}</div>
                <div className="plan-card-meta">{plan.startDate || '날짜 미설정'}{plan.endDate ? ` ~ ${plan.endDate}` : ''}</div>
                <div className="plan-card-count">📍 {plan.items?.length || 0}개 장소</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                  {plan.shareType === 'friends' ? '👥 친구 공개' : plan.shareType === 'public' ? '🌍 전체 공개' : '🔒 비공개'}
                  {plan.shareSchedule && ' · 📅 일정공유'}
                  {plan.sharePlaces && ' · 📍 장소공유'}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => setEditPlan({ id: plan.id, title: plan.title, startDate: plan.startDate, endDate: plan.endDate })}
                    style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #eee', background: '#f9fafb', color: '#555', cursor: 'pointer', fontWeight: 600 }}>✏️ 수정</button>
                  <button onClick={() => deletePlan(plan.id)}
                    style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>🗑 삭제</button>
                </div>
              </div>
            ))}
          </div>

          {/* 오른쪽: 상세 */}
          {selected && (
            <div className="plan-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div>
                  <div className="plan-panel-title">{selected.title}</div>
                  <div className="plan-panel-dates">
                    {selected.startDate || '날짜 미설정'}{selected.endDate ? ` ~ ${selected.endDate}` : ''}
                    <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 6 }}>{selected.items?.length || 0}개 장소</span>
                  </div>
                </div>
              </div>

              {/* 탭 */}
              <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 12, padding: 4, marginBottom: 14 }}>
                {[['list','📋 장소 목록'], ['map','🗺️ 지도/장소 검색'], ['chat','💬 채팅']].map(([key, label]) => (
                  <button key={key}
                    onClick={() => { setViewMode(key); if (key === 'chat') loadMessages(); }}
                    style={{ flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none', background: viewMode === key ? 'white' : 'transparent', color: viewMode === key ? '#4f46e5' : '#9ca3af', fontSize: 12, fontWeight: viewMode === key ? 700 : 500, cursor: 'pointer', boxShadow: viewMode === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* 장소 목록 탭 */}
              {viewMode === 'list' && (
                selected.items?.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#bbb', fontSize: 13, padding: '28px 0', lineHeight: 1.9 }}>
                    아직 추가된 장소가 없어요.<br/>
                    지도/장소 검색 탭에서<br/>장소를 추가해보세요!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selected.items.map((item, idx) => (
                      <PlanItem key={item.id} item={item} idx={idx}
                        onRemove={removeItem}
                        onUpdate={updateItem} />
                    ))}
                  </div>
                )
              )}

              {/* 지도/검색 탭 */}
              {viewMode === 'map' && (
                <PlanMap
                  onAddPlace={addPlaceToSelected}
                  planPlaces={planPlaces}
                />
              )}

              {/* 채팅 탭 */}
              {viewMode === 'chat' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* 멤버 */}
                  <div style={{ background: '#f9fafb', border: '1px solid #eee', borderRadius: 14, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>👥 여행 멤버</div>
                      {selected.userId === currentUser.id && (
                        <button onClick={() => { setShowInvite(true); loadFollowings(); }}
                          style={{ fontSize: 12, padding: '4px 10px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 8, color: '#4f46e5', fontWeight: 700, cursor: 'pointer' }}>
                          + 친구 초대
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {/* 방장 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 20, padding: '5px 12px 5px 6px' }}>
                        <img src={`https://ui-avatars.com/api/?name=${selected.userNickname || '?'}&background=4f46e5&color=fff&size=24`}
                          style={{ width: 24, height: 24, borderRadius: '50%' }} alt="" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5' }}>{selected.userNickname || '방장'}</span>
                        <span style={{ fontSize: 10, color: '#818cf8' }}>방장</span>
                      </div>
                      {/* 멤버들 */}
                      {(selected.members || []).map(m => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #eee', borderRadius: 20, padding: '5px 12px 5px 6px' }}>
                          <img src={m.userProfileImage || `https://ui-avatars.com/api/?name=${m.userNickname}&background=e5e7eb&color=555&size=24`}
                            style={{ width: 24, height: 24, borderRadius: '50%' }} alt="" />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{m.userNickname}</span>
                          {selected.userId === currentUser.id && (
                            <button onClick={() => kickMember(m.userId, m.userNickname)}
                              style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 채팅창 */}
                  <div style={{ border: '1px solid #eee', borderRadius: 16, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', background: '#fafafa', borderBottom: '1px solid #eee', fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>
                      💬 대화 · {messages.length}개
                    </div>
                    <div style={{ height: 320, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, background: '#f9fafb' }}>
                      {messages.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#bbb', fontSize: 13, marginTop: 40 }}>
                          아직 대화가 없어요.<br/>여행 계획을 같이 짜보세요! ✈️
                        </div>
                      )}
                      {messages.map(msg => {
                        const isMe = msg.userId === currentUser.id;
                        const isSystem = msg.type === 'system';
                        if (isSystem) return (
                          <div key={msg.id} style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', padding: '4px 0' }}>
                            {msg.content}
                          </div>
                        );
                        return (
                          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: 3 }}>
                            {!isMe && <div style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>{msg.userNickname}</div>}
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                              {!isMe && (
                                <img src={msg.userProfileImage || `https://ui-avatars.com/api/?name=${msg.userNickname}&background=4f46e5&color=fff&size=28`}
                                  style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} alt="" />
                              )}
                              <div style={{
                                maxWidth: '70%', padding: '9px 13px', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                background: isMe ? '#4f46e5' : 'white', color: isMe ? 'white' : '#1a1a2e',
                                fontSize: 14, lineHeight: 1.5, border: isMe ? 'none' : '1px solid #eee',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.06)', wordBreak: 'break-word',
                              }}>{msg.content}</div>
                              <div style={{ fontSize: 10, color: '#bbb', flexShrink: 0 }}>
                                {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={msgEndRef} />
                    </div>
                    {/* 입력창 */}
                    <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'white', borderTop: '1px solid #eee' }}>
                      <input value={msgText} onChange={e => setMsgText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        placeholder="메시지 입력..."
                        style={{ flex: 1, padding: '9px 14px', border: '1px solid #eee', borderRadius: 20, fontSize: 14, outline: 'none', background: '#f9fafb' }} />
                      <button onClick={sendMessage} disabled={!msgText.trim()}
                        style={{ width: 38, height: 38, borderRadius: '50%', background: msgText.trim() ? '#4f46e5' : '#e5e7eb', color: 'white', border: 'none', cursor: msgText.trim() ? 'pointer' : 'not-allowed', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        ↑
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 친구 초대 모달 */}
      {showInvite && (
        <div className="modal-overlay" onClick={() => setShowInvite(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1a2e', marginBottom: 16 }}>👥 친구 초대</div>
            {followings.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#bbb', padding: '24px 0', fontSize: 14 }}>팔로우한 친구가 없어요.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {followings.filter(u => {
                  const alreadyMember = (selected?.members || []).some(m => m.userId === u.id);
                  const isOwner = selected?.userId === u.id;
                  return !alreadyMember && !isOwner;
                }).map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid #eee', borderRadius: 12 }}>
                    <img src={u.profileImage || `https://ui-avatars.com/api/?name=${u.nickname}&background=4f46e5&color=fff&size=36`}
                      style={{ width: 36, height: 36, borderRadius: '50%' }} alt="" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>{u.nickname}</div>
                      {u.bio && <div style={{ fontSize: 12, color: '#9ca3af' }}>{u.bio}</div>}
                    </div>
                    <button onClick={() => inviteMember(u.id, u.nickname)}
                      style={{ padding: '7px 14px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      초대
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowInvite(false)}
              style={{ width: '100%', marginTop: 14, padding: 11, borderRadius: 12, border: '1px solid #eee', background: '#f3f4f6', color: '#555', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
