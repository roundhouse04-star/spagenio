import React, { useEffect, useRef, useState } from 'react';

const CATEGORY_CONFIG = {
  all:        { label: '전체',   icon: '🌍', color: '#4f46e5' },
  restaurant: { label: '맛집',   icon: '🍽️', color: '#ef4444' },
  cafe:       { label: '카페',   icon: '☕', color: '#f59e0b' },
  subway:     { label: '교통',   icon: '🚇', color: '#10b981' },
  hotel:      { label: '숙소',   icon: '🏨', color: '#8b5cf6' },
  attraction: { label: '관광',   icon: '🏛️', color: '#0ea5e9' },
  convenience:{ label: '편의점', icon: '🏪', color: '#6b7280' },
};

const OVERPASS_QUERY = (lat, lng, radius = 600) => `
[out:json][timeout:25];
(
  node["amenity"~"restaurant|cafe|fast_food|bar|pub"](around:${radius},${lat},${lng});
  node["tourism"~"attraction|museum|gallery|viewpoint|hotel|hostel|guest_house"](around:${radius},${lat},${lng});
  node["public_transport"~"stop_position|station"](around:${radius},${lat},${lng});
  node["railway"~"subway_entrance|station|tram_stop"](around:${radius},${lat},${lng});
  node["highway"="bus_stop"](around:${radius},${lat},${lng});
  node["shop"~"convenience|supermarket|mall"](around:${radius},${lat},${lng});
);
out body 60;
`;

function classifyNode(node) {
  const t = node.tags || {};
  if (t.railway === 'subway_entrance' || t.railway === 'station' || t.public_transport === 'station') return 'subway';
  if (t.highway === 'bus_stop' || t.public_transport === 'stop_position') return 'subway';
  if (t.tourism === 'hotel' || t.tourism === 'hostel' || t.tourism === 'guest_house') return 'hotel';
  if (t.tourism) return 'attraction';
  if (t.amenity === 'cafe') return 'cafe';
  if (t.amenity === 'restaurant' || t.amenity === 'fast_food' || t.amenity === 'bar') return 'restaurant';
  if (t.shop) return 'convenience';
  return 'attraction';
}

function calcDist(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return d < 1000 ? `${Math.round(d)}m` : `${(d/1000).toFixed(1)}km`;
}

export default function MapView({ lat, lng, placeName, places = [], onAddToPlanner, plans = [] }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [showPlanSelect, setShowPlanSelect] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  const centerLat = lat || (places[0]?.lat) || 37.5665;
  const centerLng = lng || (places[0]?.lng) || 126.9780;
  const hasGPS = !!(lat && lng);

  // Leaflet 동적 로드
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

  // 지도 초기화
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || mapInstanceRef.current) return;
    const L = window.L;
    const map = L.map(mapRef.current).setView([centerLat, centerLng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19
    }).addTo(map);
    mapInstanceRef.current = map;
    addMarkers();
    if (hasGPS) fetchNearby();
  }, [leafletLoaded]);

  const addMarkers = () => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    const map = mapInstanceRef.current;
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    // 게시물 장소 핀
    places.forEach((p, i) => {
      if (!p.lat || !p.lng) return;
      const icon = L.divIcon({
        html: `<div style="width:34px;height:34px;border-radius:50%;background:#4f46e5;color:white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25)">${i+1}</div>`,
        className: '', iconSize: [34,34], iconAnchor: [17,34]
      });
      const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);
      marker.bindPopup(`<div style="font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:4px">📍 ${p.name}</div><div style="font-size:11px;color:#9ca3af">${p.address || ''}</div>${p.tip ? `<div style="font-size:11px;color:#f59e0b;margin-top:4px">💡 ${p.tip}</div>` : ''}`);
      markersRef.current.push(marker);
    });

    // GPS 중심 핀
    if (hasGPS) {
      const centerIcon = L.divIcon({
        html: `<div style="width:20px;height:20px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
        className: '', iconSize: [20,20], iconAnchor: [10,10]
      });
      const m = L.marker([lat, lng], { icon: centerIcon }).addTo(map);
      m.bindPopup(`<div style="font-size:13px;font-weight:700">📷 ${placeName || '사진 촬영 위치'}</div>`);
      markersRef.current.push(m);
    }
  };

  const fetchNearby = async () => {
    if (!lat || !lng) return;
    setLoading(true);
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(OVERPASS_QUERY(lat, lng))
      });
      const data = await res.json();
      const items = (data.elements || [])
        .filter(n => n.tags?.name)
        .map(n => ({
          id: n.id,
          name: n.tags.name,
          type: classifyNode(n),
          lat: n.lat, lng: n.lon,
          dist: calcDist(lat, lng, n.lat, n.lon),
          distNum: parseFloat(calcDist(lat, lng, n.lat, n.lon)),
          address: n.tags['addr:full'] || n.tags['addr:street'] || '',
        }))
        .sort((a, b) => {
          const toM = d => parseFloat(d.replace('km','000').replace('m',''));
          return toM(a.dist) - toM(b.dist);
        })
        .slice(0, 40);
      setNearbyPlaces(items);
      addNearbyMarkers(items);
    } catch (e) { console.error('Overpass 오류:', e); }
    setLoading(false);
  };

  const addNearbyMarkers = (items) => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    const map = mapInstanceRef.current;
    items.forEach(p => {
      const cfg = CATEGORY_CONFIG[p.type] || CATEGORY_CONFIG.attraction;
      const icon = L.divIcon({
        html: `<div style="width:28px;height:28px;border-radius:50%;background:${cfg.color};display:flex;align-items:center;justify-content:center;font-size:13px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.2)">${cfg.icon}</div>`,
        className: '', iconSize: [28,28], iconAnchor: [14,28]
      });
      const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);
      marker.bindPopup(`<div style="font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:3px">${cfg.icon} ${p.name}</div><div style="font-size:11px;color:#9ca3af">${p.dist}</div>`);
      marker.on('click', () => setSelectedPlace(p));
      markersRef.current.push(marker);
    });
  };

  const filteredNearby = filter === 'all' ? nearbyPlaces : nearbyPlaces.filter(p => p.type === filter);

  const flyTo = (lat, lng) => {
    if (mapInstanceRef.current) mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 0.8 });
  };

  const handleAddToPlanner = (planId, place) => {
    onAddToPlanner?.(planId, {
      name: place.name,
      lat: place.lat, lng: place.lng,
      address: place.address,
      category: CATEGORY_CONFIG[place.type]?.label || '기타',
      howToGet: '', tip: '',
    });
    setShowPlanSelect(false);
    setSelectedPlace(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 지도 */}
      <div ref={mapRef} style={{ width: '100%', height: 380, borderRadius: 16, border: '1px solid #eee', overflow: 'hidden', background: '#f0f4f8' }}>
        {!leafletLoaded && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14 }}>지도 불러오는 중...</div>}
      </div>

      {/* 주변 장소 */}
      {hasGPS && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>
              📍 주변 장소
              {loading && <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400, marginLeft: 8 }}>검색 중...</span>}
              {!loading && nearbyPlaces.length > 0 && <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400, marginLeft: 8 }}>{filteredNearby.length}곳</span>}
            </div>
          </div>

          {/* 필터 */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
              <button key={key} onClick={() => setFilter(key)}
                style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${filter === key ? cfg.color : '#eee'}`, background: filter === key ? cfg.color : 'white', color: filter === key ? 'white' : '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                {cfg.icon} {cfg.label}
              </button>
            ))}
          </div>

          {/* 장소 목록 */}
          {filteredNearby.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto', paddingRight: 2 }}>
              {filteredNearby.map(place => {
                const cfg = CATEGORY_CONFIG[place.type] || CATEGORY_CONFIG.attraction;
                return (
                  <div key={place.id} onClick={() => { flyTo(place.lat, place.lng); setSelectedPlace(place); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, background: selectedPlace?.id === place.id ? '#eef2ff' : 'white', border: `1px solid ${selectedPlace?.id === place.id ? '#c7d2fe' : '#eee'}`, borderRadius: 12, padding: '10px 14px', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: cfg.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{cfg.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{cfg.label} · {place.dist}</div>
                    </div>
                    {onAddToPlanner && plans.length > 0 && (
                      <button onClick={e => { e.stopPropagation(); setSelectedPlace(place); setShowPlanSelect(true); }}
                        style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4f46e5', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                        + 추가
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : !loading ? (
            <div style={{ textAlign: 'center', color: '#bbb', fontSize: 13, padding: '20px 0' }}>주변 장소 정보가 없어요.</div>
          ) : null}
        </>
      )}

      {/* 일정 선택 모달 */}
      {showPlanSelect && selectedPlace && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 28, width: '100%', maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a2e', marginBottom: 6 }}>일정에 추가</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>"{selectedPlace.name}"을 추가할 일정을 선택해주세요.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
              {plans.map(plan => (
                <div key={plan.id} onClick={() => handleAddToPlanner(plan.id, selectedPlace)}
                  style={{ padding: '14px 16px', borderRadius: 12, border: '1.5px solid #eee', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#4f46e5'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#eee'}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>{plan.title}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>{plan.startDate} ~ {plan.endDate}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowPlanSelect(false)}
              style={{ width: '100%', marginTop: 14, padding: 11, borderRadius: 12, border: '1px solid #eee', background: '#f3f4f6', color: '#555', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
