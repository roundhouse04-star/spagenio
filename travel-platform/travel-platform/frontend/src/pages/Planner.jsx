import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api';

// ── 지도 컴포넌트 (Leaflet + Nominatim + Overpass) ────────
const CATEGORY = {
  restaurant: { label: '맛집', icon: '🍽️', color: '#ef4444' },
  cafe: { label: '카페', icon: '☕', color: '#f59e0b' },
  subway: { label: '교통', icon: '🚇', color: '#10b981' },
  hotel: { label: '숙소', icon: '🏨', color: '#8b5cf6' },
  attraction: { label: '관광', icon: '🏛️', color: '#0ea5e9' },
  convenience: { label: '편의점', icon: '🏪', color: '#6b7280' },
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
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;
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
        html: `<div style="width:30px;height:30px;border-radius:50%;background:#4f46e5;color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25)">${i + 1}</div>`,
        className: '', iconSize: [30, 30], iconAnchor: [15, 30]
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
      className: '', iconSize: [36, 36], iconAnchor: [18, 36]
    });
    const m = L.marker([lat, lng], { icon }).addTo(mapInst.current);
    m.bindPopup(`<div style="font-size:13px;font-weight:700">${name}</div><div style="font-size:11px;color:#9ca3af;margin-top:4px">${address.slice(0, 50)}...</div>`).openPopup();
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
          const toM = d => parseFloat(d.replace('km', '000').replace('m', ''));
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
        className: '', iconSize: [26, 26], iconAnchor: [13, 26]
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
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{r.display_name.split(',').slice(1, 3).join(',')}</div>
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
            {[['all', '전체', '#4f46e5'], ...Object.entries(CATEGORY).map(([k, v]) => [k, `${v.icon} ${v.label}`, v.color])].map(([key, label, color]) => (
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
function PlanItem({ item, idx, onRemove, onUpdate, readOnly = false }) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(item.date || '');
  const [memo, setMemo] = useState(item.memo || '');

  const save = () => { onUpdate(item.id, date, memo); setEditing(false); };
  const cancel = () => { setDate(item.date || ''); setMemo(item.memo || ''); setEditing(false); };

  return (
    <div style={{ border: `1px solid ${editing ? '#c7d2fe' : '#eee'}`, borderRadius: 14, padding: '14px 16px', background: readOnly ? '#f9fafb' : (editing ? '#fafbff' : 'white'), transition: 'all 0.15s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: readOnly ? '#e5e7eb' : '#4f46e5', color: readOnly ? '#9ca3af' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{idx + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: readOnly ? '#6b7280' : '#1a1a2e' }}>{item.placeName}</div>
          {item.address && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{item.address}</div>}
          {item.category && <div style={{ fontSize: 11, color: '#6366f1', marginTop: 2 }}>📌 {item.category}</div>}
          {item.howToGet && <div style={{ fontSize: 12, color: '#4f46e5', marginTop: 3 }}>🚇 {item.howToGet}</div>}
          {item.tip && <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 3 }}>💡 {item.tip}</div>}
          {item.fromUserNickname && <div style={{ fontSize: 11, color: '#bbb', marginTop: 3 }}>출처: @{item.fromUserNickname}</div>}

          {/* 읽기 전용 모드 */}
          {readOnly ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {item.date && <span style={{ fontSize: 12, color: '#6b7280', background: '#f3f4f6', border: '1px solid #eee', borderRadius: 8, padding: '3px 10px' }}>📅 {item.date}</span>}
              {item.memo && <span style={{ fontSize: 12, color: '#6b7280', background: '#f3f4f6', border: '1px solid #eee', borderRadius: 8, padding: '3px 10px' }}>📝 {item.memo}</span>}
              {item.lat && item.lng && (
                <a href={`https://maps.google.com/?q=${item.lat},${item.lng}`} target="_blank" rel="noreferrer"
                  style={{ padding: '3px 10px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 8, fontSize: 11, fontWeight: 600, color: '#4f46e5', textDecoration: 'none' }}>🗺 지도</a>
              )}
            </div>
          ) : !editing ? (
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
        {/* 삭제 버튼 — readOnly여도 삭제는 가능 */}
        {onRemove && (
          <button onClick={() => onRemove(item.id)}
            style={{ color: '#e5e7eb', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, flexShrink: 0, padding: '0 2px' }}
            onMouseEnter={e => e.target.style.color = '#ef4444'}
            onMouseLeave={e => e.target.style.color = '#e5e7eb'}>✕</button>
        )}
      </div>
    </div>
  );
}

// PlanItemRow — PlanItem alias (아코디언 내 리스트용)
const PlanItemRow = PlanItem;

// ── 날짜별 타임라인 컴포넌트 ──────────────────────────────
function PlanTimeline({ items, startDate, endDate, readOnly, onRemove }) {
  // 날짜별 그룹핑
  const groups = {};
  const undated = [];
  items.forEach(item => {
    if (item.date) {
      if (!groups[item.date]) groups[item.date] = [];
      groups[item.date].push(item);
    } else {
      undated.push(item);
    }
  });

  // 날짜 범위 생성
  const dates = Object.keys(groups).sort();
  if (startDate && endDate) {
    const s = new Date(startDate), e = new Date(endDate);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      if (!groups[key]) groups[key] = [];
      if (!dates.includes(key)) dates.push(key);
    }
    dates.sort();
  }

  if (!dates.length && !undated.length) return (
    <div style={{ textAlign: 'center', color: '#bbb', fontSize: 13, padding: '20px 0' }}>
      장소에 날짜를 지정하면 타임라인으로 볼 수 있어요!
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {dates.map((date, di) => {
        const dayItems = groups[date] || [];
        const dayNum = di + 1;
        return (
          <div key={date}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#4f46e5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                D{dayNum}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{date}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{dayItems.length}개 장소</div>
              </div>
            </div>
            {dayItems.length === 0 ? (
              <div style={{ marginLeft: 46, fontSize: 12, color: '#d1d5db', padding: '8px 0' }}>이 날 장소가 없어요</div>
            ) : (
              <div style={{ marginLeft: 46, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {dayItems.map((item, idx) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'white', border: '1px solid #eee', borderRadius: 12 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{idx + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{item.placeName}</div>
                      {item.address && <div style={{ fontSize: 11, color: '#9ca3af' }}>{item.address}</div>}
                      {item.memo && <div style={{ fontSize: 11, color: '#6b7280' }}>📝 {item.memo}</div>}
                    </div>
                    {item.lat && item.lng && (
                      <a href={`https://maps.google.com/?q=${item.lat},${item.lng}`} target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, color: '#4f46e5', textDecoration: 'none', padding: '3px 8px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 7, flexShrink: 0 }}>🗺</a>
                    )}
                    {!readOnly && onRemove && (
                      <button onClick={() => onRemove(item.id)}
                        style={{ color: '#e5e7eb', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}
                        onMouseEnter={e => e.target.style.color = '#ef4444'}
                        onMouseLeave={e => e.target.style.color = '#e5e7eb'}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {undated.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8, paddingLeft: 46 }}>📌 날짜 미지정 ({undated.length}개)</div>
          <div style={{ marginLeft: 46, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {undated.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f9fafb', border: '1px solid #eee', borderRadius: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', flex: 1 }}>{item.placeName}</div>
                {!readOnly && onRemove && (
                  <button onClick={() => onRemove(item.id)}
                    style={{ color: '#e5e7eb', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
                    onMouseEnter={e => e.target.style.color = '#ef4444'}
                    onMouseLeave={e => e.target.style.color = '#e5e7eb'}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 메인 Planner ──────────────────────────────────────────
export default function Planner({ currentUser, plans, onUpdatePlans, onConvertToPost }) {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [newPlan, setNewPlan] = useState({ title: '', startDate: '', endDate: '', from: '', to: '', pax: 1, shareType: 'private', shareSchedule: false, sharePlaces: false });
  const [routeResults, setRouteResults] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [addedRoutes, setAddedRoutes] = useState([]);
  const [addedPlaces, setAddedPlaces] = useState([]);
  // 아코디언 상태
  const [openTransport, setOpenTransport] = useState(false);
  const [openPlace, setOpenPlace] = useState(false);
  // 장소 검색 상태
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState([]);
  const [placeSearching, setPlaceSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [placeDate, setPlaceDate] = useState('');
  const [placeMemo, setPlaceMemo] = useState('');
  const [placeCategory, setPlaceCategory] = useState('attraction');
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

  const ROUTES_DB = {
    '서울_오사카': [
      { type: 'airplane', icon: '✈', name: '직항 (인천→간사이)', tag: '추천', tagColor: '#4f46e5', time: '1시간 50분', price: '89,000~180,000원', priceNum: 130000, steps: ['인천공항 체크인 (출발 2시간 전)', '대한항공/아시아나/제주항공 탑승', '간사이공항 도착 후 입국', '난카이 라피트로 오사카 시내 이동 (약 50분)'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }, { t: '네이버항공', u: 'https://flight.naver.com' }] },
      { type: 'ferry', icon: '🚢', name: '배 + 기차 (부산→시모노세키→오사카)', tag: '최저가', tagColor: '#f59e0b', time: '약 18시간', price: '60,000~90,000원', priceNum: 75000, steps: ['KTX 서울→부산 (약 2시간 30분, 59,800원)', '부산항 페리 탑승 (야간)', '시모노세키 도착 후 JR로 오사카 이동'], links: [{ t: '부관훼리', u: 'https://www.pukuanferry.com' }] },
    ],
    '서울_도쿄': [
      { type: 'airplane', icon: '✈', name: '직항 (인천→나리타/하네다)', tag: '추천', tagColor: '#4f46e5', time: '2시간 30분', price: '110,000~220,000원', priceNum: 165000, steps: ['인천공항 출발', '대한항공/아시아나 탑승', '나리타 or 하네다 도착', '나리타 익스프레스로 시내 이동 (약 1시간)'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }, { t: '네이버항공', u: 'https://flight.naver.com' }] },
      { type: 'airplane', icon: '✈', name: '경유 (인천→경유→도쿄)', tag: '최저가', tagColor: '#f59e0b', time: '6~9시간', price: '70,000~110,000원', priceNum: 90000, steps: ['인천공항 출발', '경유지 환승 (2~4시간)', '나리타 도착'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }] },
    ],
    '오사카_도쿄': [
      { type: 'train', icon: '🚄', name: '신칸센 노조미', tag: '최단시간', tagColor: '#10b981', time: '2시간 30분', price: '약 15,000엔 (135,000원)', priceNum: 135000, steps: ['신오사카역 출발 (노조미)', '교토→나고야 경유', '도쿄역 도착'], links: [{ t: 'JR패스', u: 'https://www.jrpass.com' }, { t: '에키넷', u: 'https://www.eki-net.com' }] },
      { type: 'bus', icon: '🚌', name: '야간버스 (오사카→도쿄)', tag: '최저가', tagColor: '#f59e0b', time: '약 8시간 (야간)', price: '약 4,000~8,000엔 (36,000~72,000원)', priceNum: 54000, steps: ['난바역 출발 (저녁 10~11시)', '야간 고속버스 탑승', '신주쿠/도쿄역 도착 (아침 6~7시)'], links: [{ t: '버스예약', u: 'https://www.bushikaku.net' }] },
      { type: 'airplane', icon: '✈', name: '국내선 (간사이→하네다)', tag: '', tagColor: '', time: '1시간 10분', price: '약 8,000~15,000엔 (72,000~135,000원)', priceNum: 100000, steps: ['간사이공항 출발', 'ANA/JAL/피치항공 탑승', '하네다공항 도착'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }] },
    ],
    '서울_방콕': [
      { type: 'airplane', icon: '✈', name: '직항 (인천→수완나품)', tag: '추천', tagColor: '#4f46e5', time: '5시간 30분', price: '150,000~280,000원', priceNum: 215000, steps: ['인천공항 출발', '대한항공/타이항공 탑승', '수완나품공항 도착', 'BTS or 택시로 시내 이동'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }] },
      { type: 'airplane', icon: '✈', name: '경유 (인천→경유→방콕)', tag: '최저가', tagColor: '#f59e0b', time: '8~12시간', price: '100,000~180,000원', priceNum: 140000, steps: ['인천공항 출발', '홍콩/싱가포르 경유', '수완나품 or 돈므앙 도착'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }] },
    ],
    '서울_파리': [
      { type: 'airplane', icon: '✈', name: '직항 (인천→파리 CDG)', tag: '추천', tagColor: '#4f46e5', time: '13시간', price: '700,000~1,400,000원', priceNum: 1000000, steps: ['인천공항 출발', '대한항공/에어프랑스 탑승', '샤를드골공항 도착', 'RER B로 시내 이동 (약 45분)'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }] },
      { type: 'airplane', icon: '✈', name: '경유 (인천→경유→파리)', tag: '최저가', tagColor: '#f59e0b', time: '16~22시간', price: '500,000~900,000원', priceNum: 700000, steps: ['인천공항 출발', '두바이/싱가포르 등 경유', '파리 CDG 도착'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }] },
    ],
    '서울_제주': [
      { type: 'airplane', icon: '✈', name: '직항 (김포/인천→제주)', tag: '추천', tagColor: '#4f46e5', time: '1시간', price: '40,000~120,000원', priceNum: 70000, steps: ['김포 or 인천공항 출발', '제주항공/진에어/티웨이 탑승', '제주공항 도착', '렌터카 or 버스 이동'], links: [{ t: '네이버항공', u: 'https://flight.naver.com' }] },
      { type: 'ferry', icon: '🚢', name: '배 (목포/완도→제주)', tag: '최저가', tagColor: '#f59e0b', time: '약 3~5시간', price: '30,000~60,000원', priceNum: 45000, steps: ['목포 or 완도 항구 출발', '한일고속/씨스타크루즈 탑승', '제주항 도착'], links: [{ t: '섬여행', u: 'https://www.island.go.kr' }] },
    ],
    '서울_싱가포르': [
      { type: 'airplane', icon: '✈', name: '직항 (인천→창이)', tag: '추천', tagColor: '#4f46e5', time: '6시간 30분', price: '200,000~400,000원', priceNum: 280000, steps: ['인천공항 출발', '싱가포르항공/스쿠트/진에어 탑승', '창이공항 도착', 'MRT로 시내 이동 (약 30분)'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }, { t: '네이버항공', u: 'https://flight.naver.com' }] },
      { type: 'airplane', icon: '✈', name: '경유 (인천→경유→싱가포르)', tag: '최저가', tagColor: '#f59e0b', time: '10~14시간', price: '150,000~250,000원', priceNum: 200000, steps: ['인천공항 출발', '쿠알라룸푸르/홍콩 경유', '창이공항 도착'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }] },
    ],
    '서울_발리': [
      { type: 'airplane', icon: '✈', name: '직항 (인천→응우라라이)', tag: '추천', tagColor: '#4f46e5', time: '7시간', price: '250,000~500,000원', priceNum: 350000, steps: ['인천공항 출발', '진에어/가루다인도네시아 탑승', '응우라라이공항 도착', '택시로 숙소 이동'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }] },
      { type: 'airplane', icon: '✈', name: '경유 (인천→쿠알라룸푸르→발리)', tag: '최저가', tagColor: '#f59e0b', time: '10~13시간', price: '180,000~320,000원', priceNum: 250000, steps: ['인천공항 출발', '에어아시아/말레이시아항공 탑승', '쿠알라룸푸르 경유 (2~4시간)', '발리 도착'], links: [{ t: '에어아시아', u: 'https://www.airasia.com' }] },
    ],
    '서울_런던': [
      { type: 'airplane', icon: '✈', name: '직항 (인천→히드로)', tag: '추천', tagColor: '#4f46e5', time: '12시간', price: '700,000~1,500,000원', priceNum: 1050000, steps: ['인천공항 출발', '대한항공/아시아나 탑승', '히드로공항 도착', 'Elizabeth line으로 시내 이동 (약 40분)'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }] },
      { type: 'airplane', icon: '✈', name: '경유 (인천→경유→런던)', tag: '최저가', tagColor: '#f59e0b', time: '16~24시간', price: '500,000~900,000원', priceNum: 700000, steps: ['인천공항 출발', '두바이/아부다비/도하 경유', '개트윅 or 히드로 도착'], links: [{ t: '카약', u: 'https://www.kayak.co.kr' }] },
    ],
    '서울_뉴욕': [
      { type: 'airplane', icon: '✈', name: '직항 (인천→JFK)', tag: '추천', tagColor: '#4f46e5', time: '14시간', price: '900,000~2,000,000원', priceNum: 1300000, steps: ['인천공항 출발', '대한항공/아시아나 탑승', 'JFK공항 도착', '에어트레인+지하철로 시내 이동'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }] },
      { type: 'airplane', icon: '✈', name: '경유 (인천→경유→뉴욕)', tag: '최저가', tagColor: '#f59e0b', time: '18~26시간', price: '700,000~1,300,000원', priceNum: 1000000, steps: ['인천공항 출발', '도쿄/시카고/LA 경유', 'JFK or 뉴어크 도착'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }] },
    ],
    '서울_홍콩': [
      { type: 'airplane', icon: '✈', name: '직항 (인천→홍콩 첵랍콕)', tag: '추천', tagColor: '#4f46e5', time: '3시간 30분', price: '100,000~250,000원', priceNum: 175000, steps: ['인천공항 출발', '대한항공/캐세이패시픽/홍콩익스프레스 탑승', '홍콩공항 도착', 'AEL로 시내 이동 (약 24분)'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }] },
    ],
    '서울_베트남': [
      { type: 'airplane', icon: '✈', name: '직항 (인천→하노이/다낭/호치민)', tag: '추천', tagColor: '#4f46e5', time: '4~5시간', price: '120,000~280,000원', priceNum: 180000, steps: ['인천공항 출발', '베트남항공/비엣젯/진에어 탑승', '노이바이/다낭/탄손녓 공항 도착', '그랩 or 택시 이동'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }] },
    ],
    '서울_대만': [
      { type: 'airplane', icon: '✈', name: '직항 (인천→타오위안)', tag: '추천', tagColor: '#4f46e5', time: '2시간 30분', price: '100,000~200,000원', priceNum: 150000, steps: ['인천공항 출발', '중화항공/에바항공/티웨이 탑승', '타오위안공항 도착', 'MRT로 시내 이동 (약 35분)'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }] },
    ],
    '서울_두바이': [
      { type: 'airplane', icon: '✈', name: '직항 (인천→두바이)', tag: '추천', tagColor: '#4f46e5', time: '9시간', price: '400,000~900,000원', priceNum: 600000, steps: ['인천공항 출발', '에미레이트항공/에티하드 탑승', '두바이 DXB 도착', '메트로로 시내 이동'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }] },
    ],
    '서울_시드니': [
      { type: 'airplane', icon: '✈', name: '직항 (인천→시드니)', tag: '추천', tagColor: '#4f46e5', time: '10시간 30분', price: '600,000~1,200,000원', priceNum: 850000, steps: ['인천공항 출발', '대한항공/콴타스 탑승', '시드니 킹스퍼드스미스 도착', '에어포트링크로 시내 이동'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }] },
    ],
    '오사카_교토': [
      { type: 'train', icon: '🚄', name: '특급 하루카 (오사카→교토)', tag: '추천', tagColor: '#4f46e5', time: '75분', price: '약 2,850엔 (25,000원)', priceNum: 25000, steps: ['오사카역 or 신오사카역 출발', 'JR 산인 본선 탑승', '교토역 도착'], links: [{ t: 'JR서일본', u: 'https://www.westjr.co.jp' }] },
      { type: 'bus', icon: '🚌', name: '고속버스 (오사카→교토)', tag: '최저가', tagColor: '#f59e0b', time: '약 1시간', price: '약 600~1,000엔 (5,000~9,000원)', priceNum: 7000, steps: ['우메다 or 난바 버스정류장 출발', '고속버스 탑승', '교토역 or 시내 도착'], links: [{ t: '버스예약', u: 'https://www.bushikaku.net' }] },
    ],
    '도쿄_교토': [
      { type: 'train', icon: '🚄', name: '신칸센 노조미 (도쿄→교토)', tag: '추천', tagColor: '#4f46e5', time: '2시간 15분', price: '약 13,750엔 (123,000원)', priceNum: 123000, steps: ['도쿄역 출발 (노조미)', '교토역 도착'], links: [{ t: 'JR패스', u: 'https://www.jrpass.com' }] },
      { type: 'bus', icon: '🚌', name: '야간버스 (도쿄→교토)', tag: '최저가', tagColor: '#f59e0b', time: '약 8시간 (야간)', price: '약 3,500~7,000엔 (31,000~63,000원)', priceNum: 47000, steps: ['신주쿠역 버스터미널 출발 (저녁 10시)', '야간버스 탑승', '교토역 도착 (아침 6시)'], links: [{ t: '버스예약', u: 'https://www.bushikaku.net' }] },
    ],
    '방콕_치앙마이': [
      { type: 'airplane', icon: '✈', name: '국내선 (수완나품→치앙마이)', tag: '추천', tagColor: '#4f46e5', time: '1시간 20분', price: '약 800~3,000밧 (30,000~112,000원)', priceNum: 60000, steps: ['수완나품공항 출발', '타이항공/노크에어/에어아시아 탑승', '치앙마이공항 도착'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }] },
      { type: 'train', icon: '🚄', name: '야간기차 (방콕→치앙마이)', tag: '최저가', tagColor: '#f59e0b', time: '약 12~13시간 (야간)', price: '약 600~1,500밧 (22,000~56,000원)', priceNum: 38000, steps: ['화람퐁역 출발 (저녁 6~8시)', '2등 침대칸 탑승', '치앙마이역 도착 (오전 7~9시)'], links: [{ t: '태국철도', u: 'https://www.thairailway.go.th' }] },
    ],
    '서울_부산': [
      { type: 'train', icon: '🚄', name: 'KTX (서울→부산)', tag: '추천', tagColor: '#4f46e5', time: '2시간 20분', price: '59,800원 (일반실)', priceNum: 59800, steps: ['서울역 or 수서역 출발', 'KTX/SRT 탑승', '부산역 도착', '지하철 or 택시로 이동'], links: [{ t: '코레일', u: 'https://www.letskorail.com' }, { t: 'SRT', u: 'https://www.srail.or.kr' }] },
      { type: 'bus', icon: '🚌', name: '고속버스 (서울→부산)', tag: '최저가', tagColor: '#f59e0b', time: '약 4시간', price: '20,000~35,000원', priceNum: 27500, steps: ['강남/동서울터미널 출발', '고속버스 탑승', '부산종합버스터미널 도착'], links: [{ t: '고속버스', u: 'https://www.kobus.co.kr' }] },
      { type: 'airplane', icon: '✈', name: '항공 (김포→김해)', tag: '', tagColor: '', time: '55분', price: '50,000~100,000원', priceNum: 70000, steps: ['김포공항 출발', '대한항공/아시아나 탑승', '김해공항 도착'], links: [{ t: '네이버항공', u: 'https://flight.naver.com' }] },
    ],
    '서울_강릉': [
      { type: 'train', icon: '🚄', name: 'KTX-이음 (서울→강릉)', tag: '추천', tagColor: '#4f46e5', time: '1시간 50분', price: '27,600원', priceNum: 27600, steps: ['청량리역 출발', 'KTX-이음 탑승', '강릉역 도착'], links: [{ t: '코레일', u: 'https://www.letskorail.com' }] },
      { type: 'bus', icon: '🚌', name: '고속버스 (서울→강릉)', tag: '최저가', tagColor: '#f59e0b', time: '약 2시간 30분', price: '13,000~18,000원', priceNum: 15500, steps: ['동서울터미널 출발', '고속버스 탑승', '강릉터미널 도착'], links: [{ t: '고속버스', u: 'https://www.kobus.co.kr' }] },
    ],
    '파리_런던': [
      { type: 'train', icon: '🚄', name: '유로스타 (파리→런던)', tag: '추천', tagColor: '#4f46e5', time: '2시간 16분', price: '€39~€350 (56,000~504,000원)', priceNum: 160000, steps: ['파리 북역 출발', '유로스타 탑승', '영불해협 터널 통과', '런던 세인트판크라스역 도착'], links: [{ t: '유로스타', u: 'https://www.eurostar.com' }] },
      { type: 'airplane', icon: '✈', name: '항공 (CDG→히드로)', tag: '최단시간', tagColor: '#10b981', time: '1시간 15분', price: '€50~€200 (72,000~288,000원)', priceNum: 130000, steps: ['파리 CDG 출발', '에어프랑스/BA 탑승', '런던 히드로 도착'], links: [{ t: '스카이스캐너', u: 'https://www.skyscanner.co.kr' }] },
    ],
    '도쿄_오사카': [
      { type: 'train', icon: '🚄', name: '신칸센 노조미 (도쿄→오사카)', tag: '추천', tagColor: '#4f46e5', time: '2시간 30분', price: '약 14,720엔 (132,000원)', priceNum: 132000, steps: ['도쿄역 출발 (노조미)', '나고야 경유', '신오사카역 도착'], links: [{ t: 'JR패스', u: 'https://www.jrpass.com' }] },
      { type: 'bus', icon: '🚌', name: '야간버스 (도쿄→오사카)', tag: '최저가', tagColor: '#f59e0b', time: '약 8시간', price: '약 3,000~8,000엔 (27,000~72,000원)', priceNum: 48000, steps: ['신주쿠역 출발 (야간)', '오사카 난바 도착'], links: [{ t: '버스예약', u: 'https://www.bushikaku.net' }] },
    ],
  };

  const searchRoutes = async () => {
    const from = newPlan.from.trim();
    const to = newPlan.to.trim();
    if (!from || !to) return;
    setRouteLoading(true);
    setRouteResults([]);
    setSelectedRoute(null);

    // 1) 로컬 DB에서 먼저 찾기
    const cities = ['서울', '도쿄', '오사카', '방콕', '치앙마이', '파리', '제주', '런던', '싱가포르', '발리', '뉴욕', '홍콩', '베트남', '대만', '두바이', '시드니', '교토', '부산', '강릉'];
    const f = cities.find(c => from.includes(c)) || from;
    const t = cities.find(c => to.includes(c)) || to;
    const key = f + '_' + t;
    const revKey = t + '_' + f;
    const localResults = ROUTES_DB[key] || ROUTES_DB[revKey] || [];

    if (localResults.length > 0) {
      setTimeout(() => { setRouteResults(localResults); setRouteLoading(false); }, 600);
      return;
    }

    // 2) 로컬 DB에 없으면 Claude AI에게 물어보기
    try {
      const rawJson = await api.getAiTransport(from, to);
      let parsed;
      if (typeof rawJson === 'string') {
        parsed = JSON.parse(rawJson);
      } else {
        parsed = rawJson;
      }
      const aiRoutes = Array.isArray(parsed) ? parsed : [];
      setRouteResults(aiRoutes.length > 0 ? aiRoutes : []);
    } catch (e) {
      console.error('AI transport error:', e);
      setRouteResults([]);
    } finally {
      setRouteLoading(false);
    }
  };

  const searchPlaces = async () => {
    if (!placeQuery.trim()) return;
    setPlaceSearching(true);
    setPlaceResults([]);
    setSelectedPlace(null);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeQuery)}&format=json&limit=5&accept-language=ko`);
      const data = await res.json();
      setPlaceResults(data.map(d => ({
        name: d.display_name.split(',')[0],
        fullName: d.display_name,
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
        type: d.type,
      })));
    } catch (e) { console.error(e); }
    finally { setPlaceSearching(false); }
  };

  const createPlan = async () => {
    if (!newPlan.title.trim()) return;
    try {
      const created = await api.createPlan({
        ...newPlan,
        userId: currentUser.id,
        shareType: newPlan.shareType || 'private',
        shareSchedule: newPlan.shareSchedule || false,
        sharePlaces: newPlan.sharePlaces || false,
      });

      let finalPlan = created;
      // 추가된 교통편 → plan_items
      for (const route of addedRoutes) {
        try {
          finalPlan = await api.addPlanItem(created.id, {
            placeName: `${route.icon} ${route.name}`,
            lat: 0, lng: 0,
            address: `${route.from} → ${route.to}`,
            howToGet: `${route.time} / 예상비용: ${route.price}`,
            tip: route.steps?.join(' → ') || '',
            category: route.type || 'transport',
            date: route.date || newPlan.startDate || '',
            memo: `${newPlan.pax}인 기준 ≈ ${(route.priceNum * newPlan.pax).toLocaleString()}원~`,
          });
        } catch (e) { console.error('교통편 저장 실패:', e); }
      }
      // 추가된 장소 → plan_items
      for (const place of addedPlaces) {
        try {
          finalPlan = await api.addPlanItem(created.id, {
            placeName: place.name,
            lat: place.lat,
            lng: place.lng,
            address: place.fullName || '',
            category: place.category || 'attraction',
            date: place.date || newPlan.startDate || '',
            memo: place.memo || '',
            howToGet: '',
            tip: '',
          });
        } catch (e) { console.error('장소 저장 실패:', e); }
      }

      onUpdatePlans?.([finalPlan, ...(plans || [])]);
      setSelected(finalPlan);
      setShowNewPlan(false);
      setAddedRoutes([]);
      setAddedPlaces([]);
      setRouteResults([]);
      setPlaceResults([]);
      setSelectedPlace(null);
      setSelectedRoute(null);
      setOpenTransport(false);
      setOpenPlace(false);
      setNewPlan({ title: '', startDate: '', endDate: '', from: '', to: '', pax: 1, shareType: 'private', shareSchedule: false, sharePlaces: false });
    } catch (e) { console.error(e); }
  };

  const savePlanEdit = async () => {
    if (!editPlan || !editPlan.title.trim()) return;
    try {
      const updated = await api.updatePlan(editPlan.id, {
        title: editPlan.title,
        startDate: editPlan.startDate,
        endDate: editPlan.endDate,
        shareType: editPlan.shareType,
        shareSchedule: editPlan.shareSchedule,
        sharePlaces: editPlan.sharePlaces,
      });
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

          {/* ── 교통편 검색 (아코디언) ── */}
          <div style={{ border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
            <button onClick={() => setOpenTransport(v => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: openTransport ? '#eef2ff' : '#f9fafb', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: openTransport ? '#4f46e5' : '#1a1a2e' }}>
              <span>✈ 교통편 검색 {addedRoutes.length > 0 && <span style={{ fontSize: 11, background: '#4f46e5', color: 'white', borderRadius: 10, padding: '1px 7px', marginLeft: 6 }}>{addedRoutes.length}</span>}</span>
              <span style={{ fontSize: 16, transition: 'transform 0.2s', display: 'inline-block', transform: openTransport ? 'rotate(180deg)' : 'rotate(0deg)' }}>›</span>
            </button>
            {openTransport && (
              <div style={{ padding: '14px 16px', borderTop: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="form-input" style={{ flex: 1, marginBottom: 0 }} placeholder="출발지 (예: 서울)"
                    value={newPlan.from} onChange={e => setNewPlan(p => ({ ...p, from: e.target.value }))} />
                  <button onClick={() => setNewPlan(p => ({ ...p, from: p.to, to: p.from }))}
                    style={{ padding: '8px 10px', border: '1px solid #eee', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>⇄</button>
                  <input className="form-input" style={{ flex: 1, marginBottom: 0 }} placeholder="목적지 (예: 오사카)"
                    value={newPlan.to} onChange={e => setNewPlan(p => ({ ...p, to: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select className="form-input" style={{ flex: 1, marginBottom: 0 }} value={newPlan.pax}
                    onChange={e => setNewPlan(p => ({ ...p, pax: parseInt(e.target.value) }))}>
                    {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}명</option>)}
                  </select>
                  <button onClick={searchRoutes} disabled={!newPlan.from || !newPlan.to}
                    style={{ flex: 2, padding: '10px', background: newPlan.from && newPlan.to ? '#4f46e5' : '#e5e7eb', color: newPlan.from && newPlan.to ? 'white' : '#9ca3af', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: newPlan.from && newPlan.to ? 'pointer' : 'not-allowed' }}>
                    교통편 검색
                  </button>
                </div>
                {(routeLoading || routeResults.length > 0) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}>📅 탑승일</span>
                    <input type="date" value={newPlan.routeDate || newPlan.startDate || ''}
                      onChange={e => setNewPlan(p => ({ ...p, routeDate: e.target.value }))}
                      style={{ flex: 1, padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none' }} />
                  </div>
                )}
                {routeLoading && (
                  <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>🤖</div>
                    <div style={{ fontSize: 13, color: '#4f46e5', fontWeight: 600 }}>AI가 교통편 분석 중...</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{newPlan.from} → {newPlan.to}</div>
                  </div>
                )}
                {!routeLoading && routeResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{newPlan.from} → {newPlan.to} · {newPlan.pax}인 기준 · 추가 후 다음 구간 계속 검색 가능</div>
                    {routeResults.map((r, i) => (
                      <div key={i} onClick={() => setSelectedRoute(selectedRoute === r ? null : r)}
                        style={{ border: `2px solid ${selectedRoute === r ? '#4f46e5' : '#eee'}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', background: selectedRoute === r ? '#eef2ff' : 'white' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 18 }}>{r.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{r.name}</span>
                              {r.tag && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: r.tagColor + '20', color: r.tagColor, border: `1px solid ${r.tagColor}40` }}>{r.tag}</span>}
                            </div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>⏱ {r.time} · 💰 {r.price}</div>
                          </div>
                          <button onClick={e => {
                              e.stopPropagation();
                              const routeDate = newPlan.routeDate || newPlan.startDate || '';
                              setAddedRoutes(prev => [...prev, { ...r, from: newPlan.from, to: newPlan.to, date: routeDate }]);
                              setRouteResults([]); setSelectedRoute(null);
                              setNewPlan(p => ({ ...p, from: p.to, to: '', routeDate: '' }));
                            }}
                            style={{ padding: '6px 14px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                            + 추가
                          </button>
                        </div>
                        {selectedRoute === r && (
                          <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 8, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {r.steps?.map((s, j) => (
                              <div key={j} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#555' }}>
                                <span>{j === 0 ? '🔵' : j === r.steps.length - 1 ? '🔴' : '⚪'}</span>
                                <span style={{ lineHeight: 1.5 }}>{s}</span>
                              </div>
                            ))}
                            <div style={{ fontSize: 12, color: '#4f46e5', fontWeight: 600, marginTop: 4 }}>
                              {newPlan.pax}인 합계: ≈ {(r.priceNum * newPlan.pax).toLocaleString()}원~
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                              {r.links?.map(l => (
                                <a key={l.t} href={l.u} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                                  style={{ fontSize: 11, padding: '3px 8px', background: '#f3f4f6', border: '1px solid #eee', borderRadius: 6, color: '#555', textDecoration: 'none' }}>{l.t} →</a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <div style={{ textAlign: 'center', fontSize: 11, color: '#bbb' }}>
                      다른 교통편은 <a href="https://www.skyscanner.co.kr" target="_blank" rel="noreferrer" style={{ color: '#4f46e5' }}>스카이스캐너</a>에서 확인하세요
                    </div>
                  </div>
                )}
                {!routeLoading && routeResults.length === 0 && newPlan.from && newPlan.to && (
                  <div style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', padding: '10px 0' }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>🔍</div>
                    <div style={{ fontWeight: 600, color: '#374151', marginBottom: 6 }}>검색된 교통편이 없어요</div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <a href="https://www.skyscanner.co.kr" target="_blank" rel="noreferrer" style={{ fontSize: 11, padding: '4px 10px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 8, color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}>✈ 스카이스캐너</a>
                      <a href="https://flight.naver.com" target="_blank" rel="noreferrer" style={{ fontSize: 11, padding: '4px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#16a34a', textDecoration: 'none', fontWeight: 600 }}>🛫 네이버항공</a>
                      <a href="https://www.letskorail.com" target="_blank" rel="noreferrer" style={{ fontSize: 11, padding: '4px 10px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, color: '#d97706', textDecoration: 'none', fontWeight: 600 }}>🚄 코레일</a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 장소 검색 (아코디언) ── */}
          <div style={{ border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
            <button onClick={() => setOpenPlace(v => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: openPlace ? '#f0fdf4' : '#f9fafb', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: openPlace ? '#16a34a' : '#1a1a2e' }}>
              <span>📍 장소 검색 {addedPlaces.length > 0 && <span style={{ fontSize: 11, background: '#16a34a', color: 'white', borderRadius: 10, padding: '1px 7px', marginLeft: 6 }}>{addedPlaces.length}</span>}</span>
              <span style={{ fontSize: 16, transition: 'transform 0.2s', display: 'inline-block', transform: openPlace ? 'rotate(180deg)' : 'rotate(0deg)' }}>›</span>
            </button>
            {openPlace && (
              <div style={{ padding: '14px 16px', borderTop: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* 검색창 */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" style={{ flex: 1, marginBottom: 0 }}
                    placeholder="장소 검색 (예: 도쿄 스카이트리, 오사카 카페)"
                    value={placeQuery} onChange={e => setPlaceQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchPlaces()} />
                  <button onClick={searchPlaces} disabled={placeSearching || !placeQuery.trim()}
                    style={{ padding: '8px 16px', background: placeQuery.trim() ? '#16a34a' : '#e5e7eb', color: placeQuery.trim() ? 'white' : '#9ca3af', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                    {placeSearching ? '검색중...' : '검색'}
                  </button>
                </div>

                {/* 검색 결과 */}
                {placeResults.length > 0 && !selectedPlace && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {placeResults.map((p, i) => (
                      <div key={i} onClick={() => setSelectedPlace(p)}
                        style={{ padding: '10px 12px', border: '1px solid #eee', borderRadius: 10, cursor: 'pointer', background: 'white', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>📍 {p.name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{p.fullName}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 선택된 장소 + 미니 지도 + 입력 */}
                {selectedPlace && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
                      <span style={{ fontSize: 18 }}>📍</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>{selectedPlace.name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{selectedPlace.fullName}</div>
                      </div>
                      <button onClick={() => setSelectedPlace(null)}
                        style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#9ca3af', padding: '0 4px' }}>✕</button>
                    </div>

                    {/* 미니 지도 */}
                    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #eee', height: 180 }}>
                      <iframe
                        title="map"
                        width="100%" height="180"
                        style={{ border: 'none', display: 'block' }}
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedPlace.lng - 0.01},${selectedPlace.lat - 0.01},${selectedPlace.lng + 0.01},${selectedPlace.lat + 0.01}&layer=mapnik&marker=${selectedPlace.lat},${selectedPlace.lng}`}
                      />
                    </div>

                    {/* 카테고리 */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[['attraction','🏛️ 관광'],['cafe','☕ 카페'],['restaurant','🍽️ 맛집'],['hotel','🏨 숙소'],['shopping','🛍️ 쇼핑'],['etc','📌 기타']].map(([val, label]) => (
                        <button key={val} onClick={() => setPlaceCategory(val)}
                          style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${placeCategory === val ? '#16a34a' : '#eee'}`, background: placeCategory === val ? '#f0fdf4' : 'white', color: placeCategory === val ? '#16a34a' : '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* 날짜 + 메모 */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>📅 방문일</div>
                        <input type="date" value={placeDate || newPlan.startDate || ''}
                          onChange={e => setPlaceDate(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>📝 메모 (선택)</div>
                      <input className="form-input" style={{ marginBottom: 0 }}
                        placeholder="예: 오전 10시 방문 예정, 예약 필수"
                        value={placeMemo} onChange={e => setPlaceMemo(e.target.value)} />
                    </div>

                    <button onClick={() => {
                        setAddedPlaces(prev => [...prev, {
                          ...selectedPlace,
                          category: placeCategory,
                          date: placeDate || newPlan.startDate || '',
                          memo: placeMemo,
                        }]);
                        setSelectedPlace(null);
                        setPlaceQuery('');
                        setPlaceResults([]);
                        setPlaceDate('');
                        setPlaceMemo('');
                        setPlaceCategory('attraction');
                      }}
                      style={{ padding: '10px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      📍 이 장소 추가
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 공유 설정 */}
          <div style={{ background: '#f9fafb', border: '1px solid #eee', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>🔗 공유 설정</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[['private', '🔒 비공개'], ['friends', '👥 친구 공개'], ['public', '🌍 전체 공개']].map(([val, label]) => (
                <button key={val} onClick={() => setNewPlan(p => ({
                    ...p, shareType: val,
                    shareSchedule: val === 'public' ? true : val === 'private' ? false : p.shareSchedule,
                    sharePlaces: val === 'public' ? true : val === 'private' ? false : p.sharePlaces,
                  }))}
                  style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: `2px solid ${newPlan.shareType === val ? '#4f46e5' : '#eee'}`, background: newPlan.shareType === val ? '#eef2ff' : 'white', color: newPlan.shareType === val ? '#4f46e5' : '#9ca3af', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, opacity: newPlan.shareType === 'private' ? 0.4 : 1 }}>
                <input type="checkbox" checked={newPlan.shareSchedule} disabled={newPlan.shareType === 'private'}
                  onChange={e => setNewPlan(p => ({ ...p, shareSchedule: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: '#4f46e5' }} />
                <span style={{ color: '#374151', fontWeight: 600 }}>📅 일정 공유</span>
                <span style={{ color: '#9ca3af', fontSize: 12 }}>— 여행 날짜를 공유해요</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, opacity: newPlan.shareType === 'private' ? 0.4 : 1 }}>
                <input type="checkbox" checked={newPlan.sharePlaces} disabled={newPlan.shareType === 'private'}
                  onChange={e => setNewPlan(p => ({ ...p, sharePlaces: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: '#4f46e5' }} />
                <span style={{ color: '#374151', fontWeight: 600 }}>📍 장소 공유</span>
                <span style={{ color: '#9ca3af', fontSize: 12 }}>— 방문할 장소를 공유해요</span>
              </label>
            </div>
          </div>

          {/* 추가된 항목 리스트 */}
          {(addedRoutes.length > 0 || addedPlaces.length > 0) && (
            <div style={{ background: '#f9fafb', border: '1px solid #eee', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>
                🗂 추가된 항목 ({addedRoutes.length + addedPlaces.length}개)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {addedRoutes.map((r, i) => (
                  <div key={`r-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px' }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{r.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{r.name}</span>
                        {r.tag && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: r.tagColor + '20', color: r.tagColor, border: `1px solid ${r.tagColor}40` }}>{r.tag}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        ✈ {r.from} → {r.to}{r.date && ` · 📅 ${r.date}`} · ⏱ {r.time} · 💰 {r.price}
                      </div>
                    </div>
                    <button onClick={() => setAddedRoutes(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ padding: '4px 10px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, cursor: 'pointer', flexShrink: 0, fontWeight: 600 }}>삭제</button>
                  </div>
                ))}
                {addedPlaces.map((p, i) => (
                  <div key={`p-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px' }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>📍</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 2 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        {p.category && `${p.category}`}{p.date && ` · 📅 ${p.date}`}{p.memo && ` · ${p.memo}`}
                      </div>
                    </div>
                    <button onClick={() => setAddedPlaces(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ padding: '4px 10px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, cursor: 'pointer', flexShrink: 0, fontWeight: 600 }}>삭제</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={createPlan}>만들기</button>
            <button className="btn-secondary" onClick={() => { setShowNewPlan(false); setRouteResults([]); setAddedRoutes([]); setSelectedRoute(null); setAddedPlaces([]); setPlaceResults([]); setSelectedPlace(null); setOpenTransport(false); setOpenPlace(false); }}>취소</button>
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
              {[['private', '🔒 비공개'], ['friends', '👥 친구 공개'], ['public', '🌍 전체 공개']].map(([val, label]) => (
                <button key={val} onClick={() => setEditPlan(p => ({
                    ...p,
                    shareType: val,
                    shareSchedule: val === 'public' ? true : val === 'private' ? false : p.shareSchedule,
                    sharePlaces: val === 'public' ? true : val === 'private' ? false : p.sharePlaces,
                  }))}
                  style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: `2px solid ${editPlan.shareType === val ? '#4f46e5' : '#eee'}`, background: editPlan.shareType === val ? '#eef2ff' : 'white', color: editPlan.shareType === val ? '#4f46e5' : '#9ca3af', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
            {editPlan.shareType !== 'private' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={editPlan.shareSchedule}
                    onChange={e => setEditPlan(p => ({ ...p, shareSchedule: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: '#4f46e5' }} />
                  <span style={{ color: '#374151', fontWeight: 600 }}>📅 일정 공유</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={editPlan.sharePlaces}
                    onChange={e => setEditPlan(p => ({ ...p, sharePlaces: e.target.checked }))}
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
        <div className="empty">아직 일정이 없어요.<br />새 일정을 만들고 장소를 추가해보세요!</div>
      ) : (
        <div className="plan-layout">
          {/* 왼쪽: 일정 목록 — 클릭하면 아코디언으로 상세 펼쳐짐 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(plans || []).map(plan => {
              const isOpen = selected?.id === plan.id;
              const today = new Date().toISOString().slice(0, 10);
              const isPast = plan.endDate && plan.endDate < today;

              return (
                <div key={plan.id} style={{ border: `2px solid ${isOpen ? (isPast ? '#d1d5db' : '#4f46e5') : '#eee'}`, borderRadius: 16, overflow: 'hidden', background: isPast ? '#fafafa' : 'white', transition: 'border-color 0.15s' }}>
                  {/* 카드 헤더 */}
                  <div onClick={() => { setSelected(isOpen ? null : plan); setViewMode('list'); }}
                    style={{ padding: '14px 16px', cursor: 'pointer', background: isOpen ? (isPast ? '#f9fafb' : '#fafbff') : (isPast ? '#fafafa' : 'white') }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <span style={{ fontWeight: 700, fontSize: 15, color: isPast ? '#9ca3af' : '#1a1a2e' }}>{plan.title}</span>
                          {isPast && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', flexShrink: 0 }}>
                              ✅ 완료된 일정
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>
                          {plan.startDate || '날짜 미설정'}{plan.endDate ? ` ~ ${plan.endDate}` : ''}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: isPast ? '#9ca3af' : '#ef4444', fontWeight: 600 }}>📍 {plan.items?.length || 0}개 장소</span>
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>
                            {plan.shareType === 'friends' ? '👥 친구 공개' : plan.shareType === 'public' ? '🌍 전체 공개' : '🔒 비공개'}
                            {plan.shareSchedule && ' · 📅 일정공유'}
                            {plan.sharePlaces && ' · 📍 장소공유'}
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize: 20, color: isPast ? '#d1d5db' : '#c7d2fe', marginLeft: 10, transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}>›</span>
                    </div>
                    {/* 수정/삭제 버튼 */}
                    <div style={{ display: 'flex', gap: 4, marginTop: 10 }} onClick={e => e.stopPropagation()}>
                      {!isPast && (
                        <button onClick={() => setEditPlan({ id: plan.id, title: plan.title, startDate: plan.startDate, endDate: plan.endDate, shareType: plan.shareType || 'private', shareSchedule: plan.shareSchedule || false, sharePlaces: plan.sharePlaces || false })}
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 7, border: '1px solid #eee', background: '#f9fafb', color: '#555', cursor: 'pointer', fontWeight: 600 }}>✏️ 수정</button>
                      )}
                      <button onClick={() => deletePlan(plan.id)}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 7, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>🗑 삭제</button>
                    </div>
                  </div>

                  {/* 아코디언 상세 */}
                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${isPast ? '#e5e7eb' : '#eef2ff'}`, padding: '12px 16px', background: isPast ? '#f9fafb' : '#fafbff' }}>

                      {/* 완료된 일정 안내 배너 + 게시물 변환 버튼 */}
                      {isPast && (
                        <div style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#6b7280', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>🔒</span>
                            <span>완료된 일정이에요. 읽기 전용이에요.</span>
                          </span>
                          <button onClick={() => onConvertToPost?.(plan)}
                            style={{ fontSize: 11, padding: '5px 12px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>
                            ✍️ 후기 쓰기
                          </button>
                        </div>
                      )}

                      {/* 탭 버튼 */}
                      <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 3, marginBottom: 12 }}>
                        {(isPast
                          ? [['list', '📋 장소 목록'], ['timeline', '📅 타임라인']]
                          : [['list', '📋 장소 목록'], ['timeline', '📅 타임라인'], ['map', '🗺️ 지도 검색'], ['chat', '💬 채팅']]
                        ).map(([key, label]) => (
                          <button key={key}
                            onClick={() => { setViewMode(key); if (key === 'chat') loadMessages(); }}
                            style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: 'none', background: viewMode === key ? 'white' : 'transparent', color: viewMode === key ? '#4f46e5' : '#9ca3af', fontSize: 12, fontWeight: viewMode === key ? 700 : 500, cursor: 'pointer', boxShadow: viewMode === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* 타임라인 탭 */}
                      {viewMode === 'timeline' && (
                        <PlanTimeline items={plan.items || []} startDate={plan.startDate} endDate={plan.endDate} readOnly={isPast} onRemove={isPast ? null : removeItem} />
                      )}

                      {/* 장소 목록 탭 */}
                      {viewMode === 'list' && (
                        plan.items?.length === 0 ? (
                          <div style={{ textAlign: 'center', color: '#bbb', fontSize: 13, padding: '20px 0', lineHeight: 1.9 }}>
                            {isPast ? '장소 기록이 없어요.' : '아직 추가된 장소가 없어요.\n지도 검색 탭에서 장소를 추가해보세요!'}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {plan.items.map((item, idx) => (
                              <PlanItemRow key={item.id} item={item} idx={idx}
                                onRemove={isPast ? null : removeItem}
                                onUpdate={isPast ? null : updateItem}
                                readOnly={isPast} />
                            ))}
                          </div>
                        )
                      )}

                      {/* 지도/검색 탭 */}
                      {viewMode === 'map' && (
                        <PlanMap onAddPlace={addPlaceToSelected} planPlaces={planPlaces} />
                      )}

                      {/* 채팅 탭 */}
                      {viewMode === 'chat' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {/* 멤버 */}
                          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 12, padding: '12px 14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>👥 여행 멤버</div>
                              {selected.userId === currentUser.id && (
                                <button onClick={() => { setShowInvite(true); loadFollowings(); }}
                                  style={{ fontSize: 12, padding: '4px 10px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 8, color: '#4f46e5', fontWeight: 700, cursor: 'pointer' }}>
                                  + 친구 초대
                                </button>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 20, padding: '4px 10px 4px 5px' }}>
                                <img src={`https://ui-avatars.com/api/?name=${selected.userNickname || '?'}&background=4f46e5&color=fff&size=22`}
                                  style={{ width: 22, height: 22, borderRadius: '50%' }} alt="" />
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5' }}>{selected.userNickname || '방장'}</span>
                                <span style={{ fontSize: 10, color: '#818cf8' }}>방장</span>
                              </div>
                              {(selected.members || []).map(m => (
                                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'white', border: '1px solid #eee', borderRadius: 20, padding: '4px 10px 4px 5px' }}>
                                  <img src={m.userProfileImage || `https://ui-avatars.com/api/?name=${m.userNickname}&background=e5e7eb&color=555&size=22`}
                                    style={{ width: 22, height: 22, borderRadius: '50%' }} alt="" />
                                  <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{m.userNickname}</span>
                                  {selected.userId === currentUser.id && (
                                    <button onClick={() => kickMember(m.userId, m.userNickname)}
                                      style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>✕</button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* 채팅창 */}
                          <div style={{ border: '1px solid #eee', borderRadius: 14, overflow: 'hidden' }}>
                            <div style={{ height: 260, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, background: '#fafafa' }}>
                              {messages.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#bbb', fontSize: 13, marginTop: 60 }}>채팅을 시작해보세요!</div>
                              ) : (
                                messages.map(msg => {
                                  const isMine = msg.userId === currentUser.id;
                                  return (
                                    <div key={msg.id} style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 6 }}>
                                      {!isMine && <img src={msg.userProfileImage || `https://ui-avatars.com/api/?name=${msg.userNickname}&size=28&background=e5e7eb&color=555`} style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} alt="" />}
                                      <div style={{ maxWidth: '70%' }}>
                                        {!isMine && <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2, paddingLeft: 4 }}>{msg.userNickname}</div>}
                                        <div style={{ background: isMine ? '#4f46e5' : 'white', color: isMine ? 'white' : '#1a1a2e', padding: '8px 12px', borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px', fontSize: 13, lineHeight: 1.4, border: isMine ? 'none' : '1px solid #eee', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>{msg.content}</div>
                                        <div style={{ fontSize: 10, color: '#bbb', marginTop: 2, textAlign: isMine ? 'right' : 'left', paddingLeft: 4, paddingRight: 4 }}>{msg.createdAt?.slice(11, 16)}</div>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                              <div ref={msgEndRef} />
                            </div>
                            <div style={{ padding: '10px 12px', borderTop: '1px solid #eee', display: 'flex', gap: 8, background: 'white' }}>
                              <input value={msgText} onChange={e => setMsgText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                placeholder="메시지 입력..."
                                style={{ flex: 1, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none' }} />
                              <button onClick={sendMessage} disabled={!msgText.trim()}
                                style={{ padding: '8px 14px', background: msgText.trim() ? '#4f46e5' : '#e5e7eb', color: msgText.trim() ? 'white' : '#9ca3af', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>전송</button>
                            </div>
                          </div>
                          {/* 초대 모달 */}
                          {showInvite && (
                            <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 12, padding: '14px 16px' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>친구 초대</div>
                              {followings.length === 0 ? (
                                <div style={{ fontSize: 13, color: '#9ca3af' }}>팔로우한 친구가 없어요.</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {followings.filter(f => f.id !== currentUser.id && !(selected.members || []).find(m => m.userId === f.id)).map(f => (
                                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid #eee', borderRadius: 10, background: '#f9fafb' }}>
                                      <img src={f.profileImage || `https://ui-avatars.com/api/?name=${f.nickname}&size=32`} style={{ width: 32, height: 32, borderRadius: '50%' }} alt="" />
                                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{f.nickname}</span>
                                      <button onClick={() => inviteMember(f.id, f.nickname)}
                                        style={{ padding: '5px 12px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>초대</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <button onClick={() => setShowInvite(false)}
                                style={{ marginTop: 10, width: '100%', padding: '8px', background: '#f3f4f6', border: 'none', borderRadius: 9, fontSize: 13, cursor: 'pointer', color: '#555' }}>닫기</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 오른쪽: 패널 제거 (아코디언으로 통합) */}
        </div>
      )}
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