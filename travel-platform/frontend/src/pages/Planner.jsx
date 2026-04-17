import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import CountryPanel from '../components/CountryPanel';
import { detectCountries } from '../countryInfo';

// ── Map component (Leaflet + Nominatim + Overpass) ────────
const CATEGORY = {
  restaurant: { label: 'Restaurant', icon: '🍽️', color: '#ef4444' },
  cafe: { label: 'Cafe', icon: '☕', color: '#f59e0b' },
  subway: { label: 'TRANSIT', icon: '🚇', color: '#10b981' },
  hotel: { label: 'Hotel', icon: '🏨', color: '#8b5cf6' },
  attraction: { label: 'Attraction', icon: '🏛️', color: '#0ea5e9' },
  convenience: { label: 'Convenience', icon: '🏪', color: '#8A919C' },
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
  return d < 1000? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;
}

function PlanMap({ onAddPlace, planPlaces = [] }) {
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const markersRef = useRef([]);
  const nearbyMarkersRef = useRef([]);
  const SelectedMarkerRef = useRef(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [SelectedPlace, setSelectedPlace] = useState(null);
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
    if (!leafletLoaded ||!mapRef.current || mapInst.current) return;
    const L = window.L;
    const map = L.map(mapRef.current).setView([37.5665, 126.9780], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', Zoom: 19
    }).addTo(map);

    // Map click h Place SELECT
    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      // Station geocoding as Get address
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
        const data = await res.json();
        const name = data.name || data.display_name?.split(',')[0] || 'Selected Location';
        const address = data.display_name || '';
        selectLocation(lat, lng, name, address);
      } catch {
        selectLocation(lat, lng, 'Selected Location', '');
      }
    });

    mapInst.current = map;
    renderPlanMarkers(planPlaces);
  }, [leafletLoaded]);

  useEffect(() => {
    renderPlanMarkers(planPlaces);
  }, [planPlaces, leafletLoaded]);

  const renderPlanMarkers = (places) => {
    if (!mapInst.current ||!window.L) return;
    const L = window.L;
    markersRef.current.forEach(m => mapInst.current.removeLayer(m));
    markersRef.current = [];
    places.forEach((p, i) => {
      if (!p.lat ||!p.lng) return;
      const icon = L.divIcon({
        html: `<div style="width:30px;height:30px;border-radius:50%;background:#1E2A3A;color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25)">${i + 1}</div>`,
        className: '', iconSize: [30, 30], iconAnchor: [15, 30]
      });
      const m = L.marker([p.lat, p.lng], { icon }).addTo(mapInst.current);
      m.bindPopup(`<div style="font-size:13px;font-weight:700">📍 ${p.name}</div>`);
      markersRef.current.push(m);
    });
  };

  const selectLocation = (lat, lng, name, address) => {
    if (!mapInst.current ||!window.L) return;
    const L = window.L;
    if (SelectedMarkerRef.current) mapInst.current.removeLayer(SelectedMarkerRef.current);
    const icon = L.divIcon({
      html: `<div style="width:36px;height:36px;border-radius:50%;background:#ef4444;color:white;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3)">📍</div>`,
      className: '', iconSize: [36, 36], iconAnchor: [18, 36]
    });
    const m = L.marker([lat, lng], { icon }).addTo(mapInst.current);
    m.bindPopup(`<div style="font-size:13px;font-weight:700">${name}</div><div style="font-size:11px;color:#8A919C;margin-top:4px">${address.slice(0, 50)}...</div>`).openPopup();
    SelectedMarkerRef.current = m;
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
    if (!mapInst.current ||!window.L) return;
    const L = window.L;
    items.forEach(p => {
      const cfg = CATEGORY[p.type] || CATEGORY.attraction;
      const icon = L.divIcon({
        html: `<div style="width:26px;height:26px;border-radius:50%;background:${cfg.color};display:flex;align-items:center;justify-content:center;font-size:12px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.2)">${cfg.icon}</div>`,
        className: '', iconSize: [26, 26], iconAnchor: [13, 26]
      });
      const m = L.marker([p.lat, p.lng], { icon }).addTo(mapInst.current);
      m.bindPopup(`<div style="font-size:13px;font-weight:700">${cfg.icon} ${p.name}</div><div style="font-size:11px;color:#8A919C">${p.dist}</div>`);
      nearbyMarkersRef.current.push(m);
    });
  };

  const flyToNearby = (p) => {
    if (!mapInst.current) return;
    mapInst.current.flyTo([p.lat, p.lng], 17, { duration: 0.6 });
  };

  const filtered = filter === 'all'? nearby : nearby.filter(p => p.type === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* SEARCH */}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchPlace()}
            placeholder="Search places (e.g. Eiffel Tower, Tokyo Stn...)"
            style={{ flex: 1, padding: '11px 16px', border: '1px solid #E2E0DC', borderRadius: 3, fontSize: 14, outline: 'none' }} />
          <button onClick={searchPlace} disabled={searching}
            style={{ padding: '11px 20px', background: '#1E2A3A', color: 'white', border: 'none', borderRadius: 3, fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            {searching? '...' : 'SEARCH'}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #eee', borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, marginTop: 4, overflow: 'hidden' }}>
            {searchResults.map(r => (
              <div key={r.place_id} onClick={() => goToResult(r)}
                style={{ padding: '11px 16px', cursor: 'pointer', borderBottom: '1px solid #F0EEE9', fontSize: 13 }}
                onMouseEnter={e => e.currentTarget.style.background = '#FAFAF8'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                <div style={{ fontWeight: 600, color: '#1E2A3A' }}>{r.display_name.split(',')[0]}</div>
                <div style={{ fontSize: 11, color: '#8A919C', marginTop: 2 }}>{r.display_name.split(',').slice(1, 3).join(',')}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ width: '100%', height: 340, borderRadius: 3, border: '1px solid #eee', overflow: 'hidden', background: '#f0f4f8' }}>
        {!leafletLoaded && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8A919C', fontSize: 14 }}>Map Loading...</div>}
      </div>

      {/* Add selected place to schedule */}
      {SelectedPlace && (
        <div style={{ background: '#EEEDEA', border: '1.5px solid #E2E0DC', borderRadius: 3, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1E2A3A' }}>📍 {SelectedPlace.name}</div>
            <div style={{ fontSize: 11, color: '#1E2A3A', marginTop: 3 }}>Lat {SelectedPlace.lat.toFixed(5)}, Lng {SelectedPlace.lng.toFixed(5)}</div>
          </div>
          <button onClick={() => onAddPlace(SelectedPlace)}
            style={{ padding: '9px 18px', background: '#1E2A3A', color: 'white', border: 'none', borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            + to the schedule ADD
          </button>
        </div>
      )}

      {/* Nearby Place */}
      {(loadingNearby || nearby.length > 0) && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A', marginBottom: 10 }}>
            📍 Nearby Place
            {loadingNearby && <span style={{ fontSize: 12, color: '#8A919C', fontWeight: 400, marginLeft: 6 }}>SEARCH...</span>}
            {!loadingNearby && <span style={{ fontSize: 12, color: '#8A919C', fontWeight: 400, marginLeft: 6 }}>{filtered.length}places</span>}
          </div>

          {/* Filter */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {[['all', 'ALL', '#1E2A3A'],...Object.entries(CATEGORY).map(([k, v]) => [k, `${v.icon} ${v.label}`, v.color])].map(([key, label, color]) => (
              <button key={key} onClick={() => setFilter(key)}
                style={{ padding: '5px 12px', borderRadius: 2, border: `1.5px solid ${filter === key? color : '#E2E0DC'}`, background: filter === key? color : 'white', color: filter === key? 'white' : '#8A919C', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: 260, overflowY: 'auto' }}>
            {filtered.map(p => {
              const cfg = CATEGORY[p.type] || CATEGORY.attraction;
              return (
                <div key={p.id} onClick={() => flyToNearby(p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', border: '1px solid #eee', borderRadius: 3, padding: '10px 14px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#E2E0DC'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E0DC'}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: cfg.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{cfg.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#8A919C', marginTop: 1 }}>{cfg.label} · {p.dist}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); onAddPlace(p); }}
                    style={{ padding: '5px 10px', background: '#EEEDEA', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 11, fontWeight: 700, color: '#1E2A3A', cursor: 'pointer', flexShrink: 0 }}>
                    + ADD
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

// ── Place item component ──────────────────────────────────
function PlanItem({ item, idx, onRemove, onUpdate, readOnly = false }) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(item.date || '');
  const [memo, setMemo] = useState(item.memo || '');

  const save = () => { onUpdate(item.id, date, memo); setEditing(false); };
  const cancel = () => { setDate(item.date || ''); setMemo(item.memo || ''); setEditing(false); };

  return (
    <div style={{ border: `1px solid ${editing? '#E2E0DC' : '#E2E0DC'}`, borderRadius: 3, padding: '14px 16px', background: readOnly? '#FAFAF8' : (editing? '#fafbff' : 'white'), transition: 'all 0.15s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: readOnly? '#E2E0DC' : '#1E2A3A', color: readOnly? '#8A919C' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{idx + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: readOnly? '#8A919C' : '#1E2A3A' }}>{item.placeName}</div>
          {item.address && <div style={{ fontSize: 12, color: '#8A919C', marginTop: 2 }}>{item.address}</div>}
          {item.category && <div style={{ fontSize: 11, color: '#1E2A3A', marginTop: 2 }}>📌 {item.category}</div>}
          {item.howToGet && <div style={{ fontSize: 12, color: '#1E2A3A', marginTop: 3 }}>🚇 {item.howToGet}</div>}
          {item.tip && <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 3 }}>💡 {item.tip}</div>}
          {item.fromUserNickname && <div style={{ fontSize: 11, color: '#bbb', marginTop: 3 }}>Source: @{item.fromUserNickname}</div>}

          {/* Read-only mode */}
          {readOnly? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {item.date && <span style={{ fontSize: 12, color: '#8A919C', background: '#F5F4F0', border: '1px solid #eee', borderRadius: 2, padding: '3px 10px' }}>📅 {item.date}</span>}
              {item.memo && <span style={{ fontSize: 12, color: '#8A919C', background: '#F5F4F0', border: '1px solid #eee', borderRadius: 2, padding: '3px 10px' }}>📝 {item.memo}</span>}
              {item.lat && item.lng && (
                <a href={`https://maps.google.com/?q=${item.lat},${item.lng}`} target="_blank" rel="noreferrer"
                  style={{ padding: '3px 10px', background: '#EEEDEA', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 11, fontWeight: 600, color: '#1E2A3A', textDecoration: 'none' }}>🗺 Map</a>
              )}
            </div>
          ) :!editing? (
            <>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {item.date && <span style={{ fontSize: 12, color: '#1E2A3A', background: '#EEEDEA', border: '1px solid #E2E0DC', borderRadius: 2, padding: '3px 10px', fontWeight: 600 }}>📅 {item.date}</span>}
                {item.memo && <span style={{ fontSize: 12, color: '#555', background: '#FAFAF8', border: '1px solid #eee', borderRadius: 2, padding: '3px 10px' }}>📝 {item.memo}</span>}
                {!item.date &&!item.memo && <span style={{ fontSize: 12, color: '#B8BCC4' }}>Date/Memo none</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setEditing(true)}
                  style={{ padding: '4px 10px', background: '#F5F4F0', border: '1px solid #eee', borderRadius: 2, fontSize: 11, fontWeight: 600, color: '#555', cursor: 'pointer' }}>
                  ✏️ {item.date || item.memo? 'EDIT' : 'Date/Memo ADD'}
                </button>
                {item.lat && item.lng && (
                  <a href={`https://maps.google.com/?q=${item.lat},${item.lng}`} target="_blank" rel="noreferrer"
                    style={{ padding: '4px 10px', background: '#EEEDEA', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 11, fontWeight: 600, color: '#1E2A3A', textDecoration: 'none' }}>🗺 Map</a>
                )}
              </div>
            </>
          ) : (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#8A919C', width: 40, flexShrink: 0 }}>📅 Date</span>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={{ flex: 1, padding: '7px 10px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 12, color: '#8A919C', width: 40, flexShrink: 0, paddingTop: 8 }}>📝 Memo</span>
                <textarea value={memo} onChange={e => setMemo(e.target.value)}
                  placeholder="e.g. 10 AM visit, reservation needed" rows={2}
                  style={{ flex: 1, padding: '7px 10px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={save} style={{ flex: 1, padding: '8px', background: '#1E2A3A', color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>SAVE</button>
                <button onClick={cancel} style={{ flex: 1, padding: '8px', background: '#F5F4F0', color: '#555', border: 'none', borderRadius: 9, fontSize: 13, cursor: 'pointer' }}>CANCEL</button>
              </div>
            </div>
          )}
        </div>
        {/* DELETE button — readOnly still DELETE available */}
        {onRemove && (
          <button onClick={() => onRemove(item.id)}
            style={{ color: '#E2E0DC', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, flexShrink: 0, padding: '0 2px' }}
            onMouseEnter={e => e.target.style.color = '#ef4444'}
            onMouseLeave={e => e.target.style.color = '#E2E0DC'}>✕</button>
        )}
      </div>
    </div>
  );
}

// PlanItemRow — PlanItem alias (accordion My list)
const PlanItemRow = PlanItem;

// ── By date Thai component ──────────────────────────────
function PlanTimeline({ items, startDate, endDate, readOnly, onRemove }) {
  // By date grouping
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

  // Date range Create
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

  if (!dates.length &&!undated.length) return (
    <div style={{ textAlign: 'center', color: '#bbb', fontSize: 13, padding: '20px 0' }}>
      Assign dates to places to see the timeline!
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
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1E2A3A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                D{dayNum}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A' }}>{date}</div>
                <div style={{ fontSize: 11, color: '#8A919C' }}>{dayItems.length} places</div>
              </div>
            </div>
            {dayItems.length === 0? (
              <div style={{ marginLeft: 46, fontSize: 12, color: '#B8BCC4', padding: '8px 0' }}>No places this day</div>
            ) : (
              <div style={{ marginLeft: 46, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {dayItems.map((item, idx) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'white', border: '1px solid #eee', borderRadius: 3 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#EEEDEA', color: '#1E2A3A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{idx + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A' }}>{item.placeName}</div>
                      {item.address && <div style={{ fontSize: 11, color: '#8A919C' }}>{item.address}</div>}
                      {item.memo && <div style={{ fontSize: 11, color: '#8A919C' }}>📝 {item.memo}</div>}
                    </div>
                    {item.lat && item.lng && (
                      <a href={`https://maps.google.com/?q=${item.lat},${item.lng}`} target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, color: '#1E2A3A', textDecoration: 'none', padding: '3px 8px', background: '#EEEDEA', border: '1px solid #E2E0DC', borderRadius: 7, flexShrink: 0 }}>🗺</a>
                    )}
                    {!readOnly && onRemove && (
                      <button onClick={() => onRemove(item.id)}
                        style={{ color: '#E2E0DC', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}
                        onMouseEnter={e => e.target.style.color = '#ef4444'}
                        onMouseLeave={e => e.target.style.color = '#E2E0DC'}>✕</button>
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
          <div style={{ fontSize: 12, color: '#8A919C', marginBottom: 8, paddingLeft: 46 }}>📌 Date TBD ({undated.length})</div>
          <div style={{ marginLeft: 46, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {undated.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#FAFAF8', border: '1px solid #eee', borderRadius: 3 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#8A919C', flex: 1 }}>{item.placeName}</div>
                {!readOnly && onRemove && (
                  <button onClick={() => onRemove(item.id)}
                    style={{ color: '#E2E0DC', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
                    onMouseEnter={e => e.target.style.color = '#ef4444'}
                    onMouseLeave={e => e.target.style.color = '#E2E0DC'}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main planner ──────────────────────────────────────────
export default function Planner({ currentUser, plans, onUpdatePlans, onConvertToPost }) {
  const [Selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [toast, setToast] = useState(null); // { message, type: 'error' | 'success' }
  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [newPlan, setNewPlan] = useState({ title: '', startDate: '', endDate: '', from: '', to: '', pax: 1, shareType: 'private', shareSchedule: false, sharePlaces: false });
  const [routeResults, setRouteResults] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [SelectedRoute, setSelectedRoute] = useState(null);
  const [addedRoutes, setAddedRoutes] = useState([]);
  const [addedPlaces, setAddedPlaces] = useState([]);
  // accordion state
  const [openTransport, setOpenTransport] = useState(false);
  const [openPlace, setOpenPlace] = useState(false);
  const [openCourse, setOpenCourse] = useState(false);
  const [courseQuery, setCourseQuery] = useState('');
  // Place SEARCH state
  const [recommendedCourses, setRecommendedCourses] = useState([]);
  const [courseLoading, setCourseLoading] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState([]);
  const [placeSearching, setPlaceSearching] = useState(false);
  const [SelectedPlace, setSelectedPlace] = useState(null);
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
  useEffect(() => {
    const timer = setTimeout(() => { loadRecommendedCourses(newPlan.to); }, 500);
    return () => clearTimeout(timer);
  }, [newPlan.to]);
  // Auto SELECT Remove - click h only Details Display

  useEffect(() => {
    if (Selected && viewMode === 'chat') {
      loadMessages();
      pollRef.current = setInterval(loadMessages, 30000);
    }
    return () => clearInterval(pollRef.current);
  }, [Selected?.id, viewMode]);

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
      const allPlans = [...(owned || []),...(membered || [])];
      onUpdatePlans?.(owned || []);
      setMemberPlans(membered || []);
      // Auto SELECT Remove - list only Display
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadMessages = async () => {
    if (!Selected) return;
    try {
      const data = await api.getMessages(Selected.id);
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
    if (!msgText.trim() ||!Selected) return;
    try {
      const msg = await api.sendMessage(Selected.id, {
        userId: currentUser.id, content: msgText, type: 'text'
      });
      setMessages(prev => [...prev, msg]);
      setMsgText('');
    } catch (e) { console.error(e); }
  };

  const inviteMember = async (userId, nickname) => {
    if (!Selected) return;
    try {
      const updated = await api.inviteMember(Selected.id, userId);
      setSelected(updated);
      onUpdatePlans?.((plans || []).map(p => p.id === updated.id? updated : p));
      // System MESSAGE
      await api.sendMessage(Selected.id, {
        userId: currentUser.id, content: `${currentUser.nickname} invited ${nickname}.`, type: 'system'
      });
      await loadMessages();
      setShowInvite(false);
    } catch (e) { console.error(e); }
  };

  const kickMember = async (userId, nickname) => {
    if (!Selected ||!confirm(`Remove ${nickname} from this schedule?`)) return;
    try {
      const updated = await api.removeMember(Selected.id, userId);
      setSelected(updated);
      onUpdatePlans?.((plans || []).map(p => p.id === updated.id? updated : p));
    } catch (e) { console.error(e); }
  };

  const ROUTES_DB = {
    'Seoul_Osaka': [
      { type: 'airplane', icon: '✈', name: 'Direct (Incheon→Kansai)', tag: 'Recommended', tagColor: '#1E2A3A', time: '1h 50m', price: '₩89,000 – ₩180,000', priceNum: 130000, steps: ['Check in 2h before at ICN', 'Board Korean Air, Asiana, or Jeju Air', 'Arrive KIX', 'Nankai Rapit into central Osaka (~50m)'] },
      { type: 'ferry', icon: '🚢', name: 'Ferry + train (Busan→Shimonoseki→Osaka)', tag: 'Cheapest', tagColor: '#f59e0b', time: '~18h', price: '₩60,000 – ₩90,000', priceNum: 75000, steps: ['KTX Seoul→Busan (~2h 30m, KRW 59,800)', 'Board ferry at Busan Port (overnight)', 'Arrive Shimonoseki, then JR to Osaka'] },
    ],
    'Seoul_Tokyo': [
      { type: 'airplane', icon: '✈', name: 'Direct (Incheon→Narita/Haneda)', tag: 'Recommended', tagColor: '#1E2A3A', time: '2h 30m', price: '₩110,000 – ₩280,000', priceNum: 165000, steps: ['Depart ICN', 'Board Korean Air, Asiana, Jeju Air, or T\'way', 'Arrive NRT (Narita) or HND (Haneda)', 'Narita Express/Keisei Skyliner to city center (~1h)'] },
      { type: 'airplane', icon: '✈', name: 'Low-cost carriers (Incheon→Narita)', tag: 'Cheapest', tagColor: '#f59e0b', time: '2h 30m', price: '₩70,000 – ₩150,000', priceNum: 95000, steps: ['Depart ICN', 'Board Jeju Air, T\'way, Peach, or Jin Air', 'Arrive NRT'] },
    ],
    'Osaka_Tokyo': [
      { type: 'train', icon: '🚄', name: 'Shinkansen Nozomi', tag: 'Fastest', tagColor: '#10b981', time: '2h 30m', price: '¥15,000 (₩135,000)', priceNum: 135000, steps: ['Shin-Osaka Stn — Nozomi', 'Transfer at Nagoya', 'Arrive at Tokyo Stn'] },
      { type: 'bus', icon: '🚌', name: 'Night bus (Osaka→Tokyo)', tag: 'Cheapest', tagColor: '#f59e0b', time: '~8h (Night)', price: '¥4,000 – ¥8,000 (₩36,000 – ₩72,000)', priceNum: 54000, steps: ['Namba Stn — 10-11 PM', 'Board night express bus', 'Arrive at Shinjuku/Tokyo Stn (6-7 AM)'] },
      { type: 'airplane', icon: '✈', name: 'Domestic flight (Kansai→Haneda)', tag: '', tagColor: '', time: '1h 10m', price: '¥8,000 – ¥15,000 (₩72,000 – ₩135,000)', priceNum: 100000, steps: ['Depart KIX', 'Board ANA, JAL, or Peach Aviation', 'Arrive HND'] },
    ],
    'Seoul_Bangkok': [
      { type: 'airplane', icon: '✈', name: 'Direct (Incheon→Suvarnabhumi)', tag: 'Recommended', tagColor: '#1E2A3A', time: '5h 30m', price: '₩150,000 – ₩280,000', priceNum: 215000, steps: ['Depart ICN', 'Board Korean Air or Thai Airways', 'Arrive BKK', 'BTS or Taxi to city center'] },
      { type: 'airplane', icon: '✈', name: 'Transit (Incheon→Transit→Bangkok)', tag: 'Cheapest', tagColor: '#f59e0b', time: '8-12h', price: '₩100,000 – ₩180,000', priceNum: 140000, steps: ['Depart ICN', 'Hong Kong/Singapore transit', 'Arrive Suvarnabhumi or Don Mueang'] },
    ],
    'Seoul_Paris': [
      { type: 'airplane', icon: '✈', name: 'Direct (Incheon→Paris CDG)', tag: 'Recommended', tagColor: '#1E2A3A', time: '13h', price: '₩700,000 – ₩1,400,000', priceNum: 1000000, steps: ['Depart ICN', 'Board Korean Air or Air France', 'Arrive CDG', 'RER B to city center (~45m)'] },
      { type: 'airplane', icon: '✈', name: 'Transit (Incheon→Transit→Paris)', tag: 'Cheapest', tagColor: '#f59e0b', time: '16-22h', price: '₩500,000 – ₩900,000', priceNum: 700000, steps: ['Depart ICN', 'Dubai/Singapore transit', 'Arrive CDG'] },
    ],
    'Seoul_Jeju': [
      { type: 'airplane', icon: '✈', name: 'Direct (Gimpo/Incheon→Jeju)', tag: 'Recommended', tagColor: '#1E2A3A', time: '1h', price: '₩40,000 – ₩120,000', priceNum: 70000, steps: ['Depart from Gimpo or Incheon Airport', 'Board Jeju Air, Jin Air, or T\'way Air', 'Arrive CJU', 'Rental car or bus'] },
      { type: 'ferry', icon: '🚢', name: 'Ferry (Mokpo/Wando→Jeju)', tag: 'Cheapest', tagColor: '#f59e0b', time: '~3-5h', price: '₩30,000 – ₩60,000', priceNum: 45000, steps: ['Depart from Mokpo or Wando Port', 'Board Hanil Express or Seastar Cruise', 'Arrive at Jeju Port'] },
    ],
    'Seoul_Singapore': [
      { type: 'airplane', icon: '✈', name: 'Direct (Incheon→Changi)', tag: 'Recommended', tagColor: '#1E2A3A', time: '6h 30m', price: '₩200,000 – ₩400,000', priceNum: 280000, steps: ['Depart ICN', 'Board Singapore Airlines, Scoot, or Jin Air', 'Arrive SIN', 'MRT to city center (~30m)'] },
      { type: 'airplane', icon: '✈', name: 'Transit (Incheon→Transit→Singapore)', tag: 'Cheapest', tagColor: '#f59e0b', time: '10-14h', price: '₩150,000 – ₩250,000', priceNum: 200000, steps: ['Depart ICN', 'Kuala Lumpur/Hong Kong transit', 'Arrive SIN'] },
    ],
    'Seoul_Bali': [
      { type: 'airplane', icon: '✈', name: 'Direct (Incheon→Ngurah Rai)', tag: 'Recommended', tagColor: '#1E2A3A', time: '7h', price: '₩250,000 – ₩500,000', priceNum: 350000, steps: ['Depart ICN', 'Board Jin Air or Lion Air', 'Arrive DPS', 'Taxi to hotel'] },
      { type: 'airplane', icon: '✈', name: 'Transit (Incheon→Kuala Lumpur→Bali)', tag: 'Cheapest', tagColor: '#f59e0b', time: '10-13h', price: '₩180,000 – ₩320,000', priceNum: 250000, steps: ['Depart ICN', 'Board AirAsia or Malaysia Airlines', 'Via Kuala Lumpur (2-4h)', 'Arrive Bali'] },
    ],
    'Seoul_London': [
      { type: 'airplane', icon: '✈', name: 'Direct (Incheon→Heathrow)', tag: 'Recommended', tagColor: '#1E2A3A', time: '12h', price: '₩700,000 – ₩1,500,000', priceNum: 1050000, steps: ['Depart ICN', 'Board Korean Air or Asiana', 'Arrive at Heathrow', 'Elizabeth Line to city center (~40m)'] },
      { type: 'airplane', icon: '✈', name: 'Transit (Incheon→Transit→London)', tag: 'Cheapest', tagColor: '#f59e0b', time: '16-24h', price: '₩500,000 – ₩900,000', priceNum: 700000, steps: ['Depart ICN', 'Dubai/Abu Dhabi transit', 'Arrive Gatwick or Heathrow'] },
    ],
    'Seoul_New York': [
      { type: 'airplane', icon: '✈', name: 'Direct (Incheon→JFK)', tag: 'Recommended', tagColor: '#1E2A3A', time: '14h', price: '₩900,000 – ₩2,000,000', priceNum: 1300000, steps: ['Depart ICN', 'Board Korean Air or Asiana', 'Arrive JFK', 'Airtrain+Subway to city center'] },
      { type: 'airplane', icon: '✈', name: 'Transit (Incheon→Transit→New York)', tag: 'Cheapest', tagColor: '#f59e0b', time: '18-26h', price: '₩700,000 – ₩1,300,000', priceNum: 1000000, steps: ['Depart ICN', 'Tokyo/Osaka/LA transit', 'Arrive JFK or Newark'] },
    ],
    'Seoul_Hong Kong': [
      { type: 'airplane', icon: '✈', name: 'Direct (Incheon→Hong Kong Chek Lap Kok)', tag: 'Recommended', tagColor: '#1E2A3A', time: '3h 30m', price: '₩100,000 – ₩250,000', priceNum: 175000, steps: ['Depart ICN', 'Board Korean Air, Cathay Pacific, or HK Express', 'Arrive at Hong Kong Airport', 'AEL to city center (~24m)'] },
    ],
    'Seoul_Vietnam': [
      { type: 'airplane', icon: '✈', name: 'Direct (Incheon→Hanoi/Danang/Ho Chi Minh)', tag: 'Recommended', tagColor: '#1E2A3A', time: '4-5h', price: '₩120,000 – ₩280,000', priceNum: 180000, steps: ['Depart ICN', 'Board Vietnam Airlines, VietJet, or Jin Air', 'Arrive at Noi Bai, Danang, or Tan Son Nhat', 'Grab or taxi'] },
    ],
    'Seoul_Taiwan': [
      { type: 'airplane', icon: '✈', name: 'Direct (Incheon→Taoyuan)', tag: 'Recommended', tagColor: '#1E2A3A', time: '2h 30m', price: '₩100,000 – ₩200,000', priceNum: 150000, steps: ['Depart ICN', 'Board China Airlines, Eva Air, or T\'way Air', 'Arrive TPE', 'MRT to city center (~35m)'] },
    ],
    'Seoul_Dubai': [
      { type: 'airplane', icon: '✈', name: 'Direct (Incheon→Dubai)', tag: 'Recommended', tagColor: '#1E2A3A', time: '9h', price: '₩400,000 – ₩900,000', priceNum: 600000, steps: ['Depart ICN', 'Board Emirates or Etihad', 'Arrive DXB', 'Metro to city center'] },
    ],
    'Seoul_Sydney': [
      { type: 'airplane', icon: '✈', name: 'Direct (Incheon→Sydney)', tag: 'Recommended', tagColor: '#1E2A3A', time: '10h 30m', price: '₩600,000 – ₩1,200,000', priceNum: 850000, steps: ['Depart ICN', 'Board Korean Air or Qantas', 'Arrive SYD (Kingsford Smith)', 'Airport Link to city center'] },
    ],
    'Osaka_Kyoto': [
      { type: 'train', icon: '🚄', name: 'Express Haruka (Osaka→Kyoto)', tag: 'Recommended', tagColor: '#1E2A3A', time: '75m', price: '~¥2,850 (₩25,000)', priceNum: 25000, steps: ['Depart from Osaka Stn or Shin-Osaka Stn', 'Board JR Sanyo Main Line', 'Arrive at Kyoto Stn'] },
      { type: 'bus', icon: '🚌', name: 'Express bus (Osaka→Kyoto)', tag: 'Cheapest', tagColor: '#f59e0b', time: '~1h', price: '¥600 – ¥1,000 (₩5,000 – ₩9,000)', priceNum: 7000, steps: ['Depart from Umeda or Namba bus terminal', 'Board express bus', 'Arrive Kyoto Stn or city center'] },
    ],
    'Tokyo_Kyoto': [
      { type: 'train', icon: '🚄', name: 'Shinkansen Nozomi (Tokyo→Kyoto)', tag: 'Recommended', tagColor: '#1E2A3A', time: '2h 15m', price: '¥13,750 (₩123,000)', priceNum: 123000, steps: ['Tokyo Stn — Nozomi', 'Arrive at Kyoto Stn'] },
      { type: 'bus', icon: '🚌', name: 'Night bus (Tokyo→Kyoto)', tag: 'Cheapest', tagColor: '#f59e0b', time: '~8h (Night)', price: '¥3,500 – ¥7,000 (₩31,000 – ₩63,000)', priceNum: 47000, steps: ['Depart from Shinjuku Stn Bus Terminal (10 PM)', 'Board night bus', 'Arrive at Kyoto Stn (6 AM)'] },
    ],
    'Bangkok_Chiang Mai': [
      { type: 'airplane', icon: '✈', name: 'Domestic flight (Suvarnabhumi→Chiang Mai)', tag: 'Recommended', tagColor: '#1E2A3A', time: '1h 20m', price: '฿800 – ฿3,000 (₩30,000 – ₩112,000)', priceNum: 60000, steps: ['Depart BKK', 'Board Thai Airways, Nok Air, or AirAsia', 'Arrive CNX'] },
      { type: 'train', icon: '🚄', name: 'NightTrain (Bangkok→Chiang Mai)', tag: 'Cheapest', tagColor: '#f59e0b', time: '~12-13h (Night)', price: '฿600 – ฿1,500 (₩22,000 – ₩56,000)', priceNum: 38000, steps: ['Depart from Hua Lamphong Stn (6-8 PM)', 'Board 2nd class sleeper', 'Arrive at Chiang Mai Stn (7-9 AM)'] },
    ],
    'Seoul_Busan': [
      { type: 'train', icon: '🚄', name: 'KTX (Seoul→Busan)', tag: 'Recommended', tagColor: '#1E2A3A', time: '2h 20m', price: '₩59,800 (Regular)', priceNum: 59800, steps: ['Depart from Seoul Stn or Suseo Stn', 'Board KTX or SRT', 'Arrive at Busan Stn', 'Subway or taxi'] },
      { type: 'bus', icon: '🚌', name: 'Express bus (Seoul→Busan)', tag: 'Cheapest', tagColor: '#f59e0b', time: '~4h', price: '₩20,000 – ₩35,000', priceNum: 27500, steps: ['Depart from Gangnam/East Seoul Terminal', 'Board express bus', 'Arrive at Busan Express Bus Terminal'] },
      { type: 'airplane', icon: '✈', name: 'Flight (Gimpo→Gimhae)', tag: '', tagColor: '', time: '55m', price: '₩50,000 – ₩100,000', priceNum: 70000, steps: ['Depart from Gimpo Airport', 'Board Korean Air or Asiana', 'Arrive at Gimhae Airport'] },
    ],
    'Seoul_Gangneung': [
      { type: 'train', icon: '🚄', name: 'KTX-Eum (Seoul→Gangneung)', tag: 'Recommended', tagColor: '#1E2A3A', time: '1h 50m', price: '₩27,600', priceNum: 27600, steps: ['Depart from Cheongnyangni Stn', 'Board KTX-Eum', 'Arrive at Gangneung Stn'] },
      { type: 'bus', icon: '🚌', name: 'Express bus (Seoul→Gangneung)', tag: 'Cheapest', tagColor: '#f59e0b', time: '~2h 30m', price: '₩13,000 – ₩18,000', priceNum: 15500, steps: ['Depart from East Seoul Terminal', 'Board express bus', 'Arrive at Gangneung Terminal'] },
    ],
    'Paris_London': [
      { type: 'train', icon: '🚄', name: 'Eurostar (Paris→London)', tag: 'Recommended', tagColor: '#1E2A3A', time: '2h 16m', price: '€39 – €350 (₩56,000 – ₩504,000)', priceNum: 160000, steps: ['Depart from Paris Gare du Nord', 'Board Eurostar', 'Via Channel Tunnel', 'Arrive at Arrive at London St Pancras'] },
      { type: 'airplane', icon: '✈', name: 'Flight (CDG→Heathrow)', tag: 'Fastest', tagColor: '#10b981', time: '1h 15m', price: '€50 – €200 (₩72,000 – ₩288,000)', priceNum: 130000, steps: ['Depart CDG', 'Board Air France or BA', 'Arrive LHR'] },
    ],
    'Tokyo_Osaka': [
      { type: 'train', icon: '🚄', name: 'JR Shinkansen Nozomi (Tokyo→Shin-Osaka)', tag: 'Fastest', tagColor: '#10b981', time: '2h 30m', price: '¥14,000 – ¥15,500 (₩126,000 – ₩140,000)', priceNum: 132000, steps: ['Tokyo Stn — JR Nozomi platform', 'Direct to Shin-Osaka (no transfer needed)', 'Arrive Shin-Osaka Stn'] },
      { type: 'train', icon: '🚆', name: 'JR Shinkansen Hikari (cheaper, slower)', tag: '', tagColor: '', time: '3h', price: '¥13,000 – ¥14,500 (₩117,000 – ₩130,000)', priceNum: 125000, steps: ['Tokyo Stn — JR Hikari platform', 'Arrive Shin-Osaka Stn'] },
      { type: 'airplane', icon: '✈', name: 'Domestic flight (Haneda→Itami/Kansai)', tag: 'Recommended', tagColor: '#1E2A3A', time: '1h 10m', price: '¥8,000 – ¥18,000 (₩72,000 – ₩162,000)', priceNum: 115000, steps: ['Depart HND or NRT', 'Board ANA, JAL, Peach, or Jetstar Japan', 'Arrive ITM (Itami) or KIX (Kansai)'] },
      { type: 'bus', icon: '🚌', name: 'Willer Express night bus', tag: 'Cheapest', tagColor: '#f59e0b', time: '~8h (overnight)', price: '¥3,000 – ¥8,000 (₩27,000 – ₩72,000)', priceNum: 48000, steps: ['Shinjuku Bus Terminal — 10-11 PM', 'Board Willer Express or JR Bus', 'Arrive Osaka Umeda / Namba (6-7 AM)'] },
    ],
  };


  // ── Popular Route Recommended ──
  const loadRecommendedCourses = async (city) => {
    if (!city || city.length < 2) { setRecommendedCourses([]); return; }
    setCourseLoading(true);
    try {
      const res = await fetch('/api/posts?keyword=' + encodeURIComponent(city) + '&limit=20');
      if (res.ok) {
        const posts = await res.json();
        // Posts with places only (with route)
        const withCourse = [];
        for (const post of (posts || [])) {
          try {
            const pRes = await fetch('/api/posts/' + post.id);
            if (pRes.ok) {
              const pData = await pRes.json();
              if (pData.places && pData.places.length > 0) {
                withCourse.push(pData);
              }
            }
          } catch(e) {}
          if (withCourse.length >= 5) break;
        }
        setRecommendedCourses(withCourse);
      }
    } catch(e) { console.error(e); }
    setCourseLoading(false);
  };

  // Route to my schedule ADD
  const addCourseToPlaces = (course) => {
    if (!course.places) return;
    const newPlaces = course.places.map(p => ({
      name: p.name,
      lat: p.lat || 0,
      lng: p.lng || 0,
      fullName: p.address || '',
      category: p.category || 'attraction',
      date: newPlan.startDate || '',
      memo: [p.tip, p.howToGet].filter(Boolean).join(' | '),
    }));
    setAddedPlaces(prev => [...prev,...newPlaces]);
  };

  const searchRoutes = async () => {
    const from = newPlan.from.trim();
    const to = newPlan.to.trim();
    if (!from ||!to) return;
    setRouteLoading(true);
    setRouteResults([]);
    setSelectedRoute(null);

    // 1) Normalize city names (Korean → English alias)
    const CITY_ALIAS = {
      // Korea
      '서울': 'Seoul', '인천': 'Seoul', '김포': 'Seoul', '부산': 'Busan',
      '제주': 'Jeju', '제주도': 'Jeju', '강릉': 'Gangneung',
      // Japan
      '도쿄': 'Tokyo', '동경': 'Tokyo', '나리타': 'Tokyo', '하네다': 'Tokyo',
      '오사카': 'Osaka', '간사이': 'Osaka', '교토': 'Kyoto', '후쿠오카': 'Fukuoka',
      '삿포로': 'Sapporo', '나고야': 'Nagoya',
      // SE Asia
      '방콕': 'Bangkok', '치앙마이': 'Chiang Mai', '푸켓': 'Phuket',
      '싱가포르': 'Singapore', '발리': 'Bali', '호치민': 'Ho Chi Minh',
      '하노이': 'Hanoi', '다낭': 'Danang', '타이베이': 'Taipei', '대만': 'Taipei',
      // Other
      '파리': 'Paris', '런던': 'London', '뉴욕': 'New York',
      '홍콩': 'Hong Kong', '두바이': 'Dubai', '시드니': 'Sydney',
    };

    const normalize = (input) => {
      const s = input.trim();
      // Exact Korean match
      if (CITY_ALIAS[s]) return CITY_ALIAS[s];
      // Partial Korean match (handles "인천공항", "도쿄 나리타")
      for (const [kor, eng] of Object.entries(CITY_ALIAS)) {
        if (s.includes(kor)) return eng;
      }
      // English city list for partial English input
      const engCities = ['Seoul', 'Tokyo', 'Osaka', 'Bangkok', 'Chiang Mai', 'Paris', 'Jeju', 'London', 'Singapore', 'Bali', 'New York', 'Hong Kong', 'Sydney', 'Kyoto', 'Busan', 'Gangneung', 'Taipei', 'Fukuoka', 'Sapporo'];
      const eng = engCities.find(c => s.toLowerCase().includes(c.toLowerCase()));
      return eng || s;
    };

    const f = normalize(from);
    const t = normalize(to);
    const key = f + '_' + t;
    const revKey = t + '_' + f;
    const localResults = ROUTES_DB[key] || ROUTES_DB[revKey] || [];

    if (localResults.length > 0) {
      setTimeout(() => { setRouteResults(localResults); setRouteLoading(false); }, 600);
      return;
    }

    // 2) If not in local DB, ask Claude AI (English response requested)
    try {
      const rawJson = await api.getAiTransport(f, t);
      let parsed;
      if (typeof rawJson === 'string') {
        parsed = JSON.parse(rawJson);
      } else {
        parsed = rawJson;
      }
      const aiRoutes = Array.isArray(parsed)? parsed : [];
      // Filter out any routes that contain disallowed brand references
      const cleaned = aiRoutes
        .filter(r => r && r.name && r.price)
        .map(r => ({
          ...r,
          // Strip any Skyscanner/booking mentions from AI response
          name: String(r.name).replace(/스카이스캐너|Skyscanner|skyscanner/gi, '').trim(),
          steps: (r.steps || []).map(s => String(s).replace(/스카이스캐너|Skyscanner|skyscanner/gi, '').trim()),
        }));
      setRouteResults(cleaned);
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
    // Validation with user-friendly messages
    const missing = [];
    if (!newPlan.title.trim()) missing.push('schedule name');
    if (!newPlan.startDate) missing.push('departure date');
    if (!newPlan.endDate) missing.push('arrival date');

    if (missing.length > 0) {
      showToast('Please enter: ' + missing.join(', '));
      return;
    }
    if (new Date(newPlan.endDate) < new Date(newPlan.startDate)) {
      showToast('Arrival date must be on or after departure date.');
      return;
    }

    try {
      const created = await api.createPlan({
       ...newPlan,
        userId: currentUser.id,
        shareType: newPlan.shareType || 'private',
        shareSchedule: newPlan.shareSchedule || false,
        sharePlaces: newPlan.sharePlaces || false,
      });

      let finalPlan = created;
      // added transit options → plan_items
      for (const route of addedRoutes) {
        try {
          finalPlan = await api.addPlanItem(created.id, {
            placeName: `${route.icon} ${route.name}`,
            lat: 0, lng: 0,
            address: `${route.from} → ${route.to}`,
            howToGet: `${route.time} / Est. cost: ${route.price}`,
            tip: route.steps?.join(' → ') || '',
            category: route.type || 'transport',
            date: route.date || newPlan.startDate || '',
            memo: `For ${newPlan.pax} name ≈ KRW ${(route.priceNum * newPlan.pax).toLocaleString()}~`,
          });
        } catch (e) { console.error('transit options SAVE failed:', e); }
      }
      // added Place → plan_items
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
        } catch (e) { console.error('Place SAVE failed:', e); }
      }

      onUpdatePlans?.([finalPlan,...(plans || [])]);
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
    if (!editPlan) return;
    const missing = [];
    if (!editPlan.title?.trim()) missing.push('schedule name');
    if (!editPlan.startDate) missing.push('departure date');
    if (!editPlan.endDate) missing.push('arrival date');

    if (missing.length > 0) {
      showToast('Please enter: ' + missing.join(', '));
      return;
    }
    if (new Date(editPlan.endDate) < new Date(editPlan.startDate)) {
      showToast('Arrival date must be on or after departure date.');
      return;
    }
    try {
      const updated = await api.updatePlan(editPlan.id, {
        title: editPlan.title,
        startDate: editPlan.startDate,
        endDate: editPlan.endDate,
        shareType: editPlan.shareType,
        shareSchedule: editPlan.shareSchedule,
        sharePlaces: editPlan.sharePlaces,
      });
      onUpdatePlans?.(plans.map(p => p.id === updated.id? updated : p));
      if (Selected?.id === updated.id) setSelected(updated);
      setEditPlan(null);
    } catch (e) { console.error(e); }
  };

  const deletePlan = async (planId) => {
    if (!confirm('Delete this schedule?')) return;
    try {
      await api.deletePlan(planId);
      const next = (plans || []).filter(p => p.id!== planId);
      onUpdatePlans?.(next);
      setSelected(next[0] || null);
    } catch (e) { console.error(e); }
  };

  const removeItem = async (itemId) => {
    if (!Selected) return;
    try {
      const updated = await api.removePlanItem(Selected.id, itemId);
      setSelected(updated);
      onUpdatePlans?.((plans || []).map(p => p.id === updated.id? updated : p));
    } catch (e) { console.error(e); }
  };

  const updateItem = async (itemId, date, memo) => {
    if (!Selected) return;
    try {
      const item = Selected.items.find(i => i.id === itemId);
      if (!item) return;
      await api.removePlanItem(Selected.id, itemId);
      const updated = await api.addPlanItem(Selected.id, {...item, date, memo });
      setSelected(updated);
      onUpdatePlans?.((plans || []).map(p => p.id === updated.id? updated : p));
    } catch (e) { console.error(e); }
  };

  const addPlaceToSelected = async (place) => {
    if (!Selected) { showToast('Please select a schedule first.'); return; }
    try {
      const item = {
        placeName: place.name, lat: place.lat || 0, lng: place.lng || 0,
        address: place.address || '', category: CATEGORY[place.type]?.label || place.category || 'Other',
        howToGet: '', tip: '', fromPostId: '', fromPostTitle: '', fromUserNickname: '',
        date: '', memo: '',
      };
      const updated = await api.addPlanItem(Selected.id, item);
      setSelected(updated);
      onUpdatePlans?.((plans || []).map(p => p.id === updated.id? updated : p));
      showToast(`"${place.name}" added to schedule`, 'success');
    } catch (e) { console.error(e); }
  };

  const planPlaces = Selected?.items?.filter(i => i.lat && i.lng).map(i => ({
    name: i.placeName, lat: i.lat, lng: i.lng,
  })) || [];

  if (!currentUser) return <div className="empty">LOGIN required.</div>;
  if (loading) return <div className="empty">Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="page-header">
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 500, color: '#1E2A3A', letterSpacing: -0.8 }}>My TRAVEL PLANNER</div>
        <button className="btn-primary" onClick={() => setShowNewPlan(true)}>+ New schedule</button>
      </div>

      {/* New schedule */}
      {showNewPlan && (
        <div className="post-form" style={{ gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1E2A3A' }}>New schedule</div>
          <input className="form-input" placeholder="Schedule name (e.g. Osaka 3N4D)" value={newPlan.title}
            onChange={e => setNewPlan(p => ({...p, title: e.target.value }))} />
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Departure date</label>
              <input type="date" className="form-input" value={newPlan.startDate}
                onChange={e => setNewPlan(p => ({...p, startDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Arrival date</label>
              <input type="date" className="form-input" value={newPlan.endDate}
                onChange={e => setNewPlan(p => ({...p, endDate: e.target.value }))} />
            </div>
          </div>

          {/* ── transit options SEARCH (accordion) ── */}
          <div style={{ border: '1px solid #eee', borderRadius: 3, overflow: 'hidden' }}>
            <button onClick={() => setOpenTransport(v =>!v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: openTransport? '#EEEDEA' : '#FAFAF8', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: openTransport? '#1E2A3A' : '#1E2A3A' }}>
              <span>✈ transit options SEARCH {addedRoutes.length > 0 && <span style={{ fontSize: 11, background: '#1E2A3A', color: 'white', borderRadius: 2, padding: '1px 7px', marginLeft: 6 }}>{addedRoutes.length}</span>}</span>
              <span style={{ fontSize: 16, transition: 'transform 0.2s', display: 'inline-block', transform: openTransport? 'rotate(180deg)' : 'rotate(0deg)' }}>›</span>
            </button>
            {openTransport && (
              <div style={{ padding: '14px 16px', borderTop: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="form-input" style={{ flex: 1, marginBottom: 0 }} placeholder="From (e.g. Seoul)"
                    value={newPlan.from} onChange={e => setNewPlan(p => ({...p, from: e.target.value }))} />
                  <button onClick={() => setNewPlan(p => ({...p, from: p.to, to: p.from }))}
                    style={{ padding: '8px 10px', border: '1px solid #eee', borderRadius: 2, background: 'white', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>⇄</button>
                  <input className="form-input" style={{ flex: 1, marginBottom: 0 }} placeholder="Destination (e.g. Osaka)"
                    value={newPlan.to} onChange={e => setNewPlan(p => ({...p, to: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select className="form-input" style={{ flex: 1, marginBottom: 0 }} value={newPlan.pax}
                    onChange={e => setNewPlan(p => ({...p, pax: parseInt(e.target.value) }))}>
                    {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}name</option>)}
                  </select>
                  <button onClick={searchRoutes} disabled={!newPlan.from ||!newPlan.to}
                    style={{ flex: 2, padding: '10px', background: newPlan.from && newPlan.to? '#1E2A3A' : '#E2E0DC', color: newPlan.from && newPlan.to? 'white' : '#8A919C', border: 'none', borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: newPlan.from && newPlan.to? 'pointer' : 'not-allowed' }}>
                    transit options SEARCH
                  </button>
                </div>
                {(routeLoading || routeResults.length > 0) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#8A919C', flexShrink: 0 }}>📅 BoardD</span>
                    <input type="date" value={newPlan.routeDate || newPlan.startDate || ''}
                      onChange={e => setNewPlan(p => ({...p, routeDate: e.target.value }))}
                      style={{ flex: 1, padding: '7px 10px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none' }} />
                  </div>
                )}
                {routeLoading && (
                  <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>🤖</div>
                    <div style={{ fontSize: 13, color: '#1E2A3A', fontWeight: 600 }}>AI analyzing transit options...</div>
                    <div style={{ fontSize: 12, color: '#8A919C', marginTop: 2 }}>{newPlan.from} → {newPlan.to}</div>
                  </div>
                )}
                {!routeLoading && routeResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 11, color: '#8A919C' }}>{newPlan.from} → {newPlan.to} · {newPlan.pax} Basis · After adding, keep searching next segments</div>
                    <div style={{ fontSize: 10, color: '#8A919C', textAlign: 'center', padding: '4px 0 8px', fontStyle: 'italic' }}>
                      Estimated price ranges based on recent 3-month averages. Actual fares vary by date and availability.
                    </div>
                    {routeResults.map((r, i) => (
                      <div key={i} onClick={() => setSelectedRoute(SelectedRoute === r? null : r)}
                        style={{ border: `2px solid ${SelectedRoute === r? '#1E2A3A' : '#E2E0DC'}`, borderRadius: 2, padding: '10px 12px', cursor: 'pointer', background: SelectedRoute === r? '#EEEDEA' : 'white' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 18 }}>{r.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A' }}>{r.name}</span>
                              {r.tag && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 2, background: r.tagColor + '20', color: r.tagColor, border: `1px solid ${r.tagColor}40` }}>{r.tag}</span>}
                            </div>
                            <div style={{ fontSize: 12, color: '#8A919C' }}>⏱ {r.time} · 💰 {r.price}</div>
                          </div>
                          <button onClick={e => {
                              e.stopPropagation();
                              const routeDate = newPlan.routeDate || newPlan.startDate || '';
                              setAddedRoutes(prev => [...prev, {...r, from: newPlan.from, to: newPlan.to, date: routeDate }]);
                              setRouteResults([]); setSelectedRoute(null);
                              setNewPlan(p => ({...p, from: p.to, to: '', routeDate: '' }));
                            }}
                            style={{ padding: '6px 14px', background: '#1E2A3A', color: 'white', border: 'none', borderRadius: 2, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                            + ADD
                          </button>
                        </div>
                        {SelectedRoute === r && (
                          <div style={{ borderTop: '1px solid #E2E0DC', marginTop: 8, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {r.steps?.map((s, j) => (
                              <div key={j} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#555' }}>
                                <span>{j === 0? '🔵' : j === r.steps.length - 1? '🔴' : '⚪'}</span>
                                <span style={{ lineHeight: 1.5 }}>{s}</span>
                              </div>
                            ))}
                            <div style={{ fontSize: 12, color: '#1E2A3A', fontWeight: 600, marginTop: 4 }}>
                              {newPlan.pax} Total: ≈ {(r.priceNum * newPlan.pax).toLocaleString()} KRW~
                            </div>

                          </div>
                        )}
                      </div>
                    ))}

                  </div>
                )}
                {!routeLoading && routeResults.length === 0 && newPlan.from && newPlan.to && (
                  <div style={{ textAlign: 'center', fontSize: 12, color: '#8A919C', padding: '10px 0' }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>🔍</div>
                    <div style={{ fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>No transit options found for this route yet.</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Place SEARCH (accordion) ── */}
          <div style={{ border: '1px solid #eee', borderRadius: 3, overflow: 'hidden' }}>
            <button onClick={() => setOpenPlace(v =>!v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: openPlace? '#f0fdf4' : '#FAFAF8', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: openPlace? '#16a34a' : '#1E2A3A' }}>
              <span>📍 Place SEARCH {addedPlaces.length > 0 && <span style={{ fontSize: 11, background: '#16a34a', color: 'white', borderRadius: 2, padding: '1px 7px', marginLeft: 6 }}>{addedPlaces.length}</span>}</span>
              <span style={{ fontSize: 16, transition: 'transform 0.2s', display: 'inline-block', transform: openPlace? 'rotate(180deg)' : 'rotate(0deg)' }}>›</span>
            </button>
            {openPlace && (
              <div style={{ padding: '14px 16px', borderTop: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* SEARCHChangi */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" style={{ flex: 1, marginBottom: 0 }}
                    placeholder="Search places (e.g. Tokyo Skytree, Osaka cafe)"
                    value={placeQuery} onChange={e => setPlaceQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchPlaces()} />
                  <button onClick={searchPlaces} disabled={placeSearching ||!placeQuery.trim()}
                    style={{ padding: '8px 16px', background: placeQuery.trim()? '#16a34a' : '#E2E0DC', color: placeQuery.trim()? 'white' : '#8A919C', border: 'none', borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                    {placeSearching? 'SEARCH...' : 'SEARCH'}
                  </button>
                </div>

                {/* Search results */}
                {placeResults.length > 0 &&!SelectedPlace && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {placeResults.map((p, i) => (
                      <div key={i} onClick={() => setSelectedPlace(p)}
                        style={{ padding: '10px 12px', border: '1px solid #eee', borderRadius: 2, cursor: 'pointer', background: 'white', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#FAFAF8'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A' }}>📍 {p.name}</div>
                        <div style={{ fontSize: 11, color: '#8A919C', marginTop: 2 }}>{p.fullName}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected place + map + enter */}
                {SelectedPlace && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2 }}>
                      <span style={{ fontSize: 18 }}>📍</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>{SelectedPlace.name}</div>
                        <div style={{ fontSize: 11, color: '#8A919C' }}>{SelectedPlace.fullName}</div>
                      </div>
                      <button onClick={() => setSelectedPlace(null)}
                        style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#8A919C', padding: '0 4px' }}>✕</button>
                    </div>

                    {/* Map */}
                    <div style={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #eee', height: 180 }}>
                      <iframe
                        title="map"
                        width="100%" height="180"
                        style={{ border: 'none', display: 'block' }}
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${SelectedPlace.lng - 0.01},${SelectedPlace.lat - 0.01},${SelectedPlace.lng + 0.01},${SelectedPlace.lat + 0.01}&layer=mapnik&marker=${SelectedPlace.lat},${SelectedPlace.lng}`}
                      />
                    </div>

                    {/* Category */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[['attraction','🏛️ Attraction'],['cafe','☕ Cafe'],['restaurant','🍽️ Restaurant'],['hotel','🏨 Hotel'],['shopping','🛍️ Shopping'],['etc','📌 Other']].map(([val, label]) => (
                        <button key={val} onClick={() => setPlaceCategory(val)}
                          style={{ padding: '5px 12px', borderRadius: 2, border: `1px solid ${placeCategory === val? '#16a34a' : '#E2E0DC'}`, background: placeCategory === val? '#f0fdf4' : 'white', color: placeCategory === val? '#16a34a' : '#8A919C', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Date + Memo */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#8A919C', marginBottom: 4 }}>📅 VisitD</div>
                        <input type="date" value={placeDate || newPlan.startDate || ''}
                          onChange={e => setPlaceDate(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#8A919C', marginBottom: 4 }}>📝 Memo (optional)</div>
                      <input className="form-input" style={{ marginBottom: 0 }}
                        placeholder="e.g. 10 AM visit, reservation required"
                        value={placeMemo} onChange={e => setPlaceMemo(e.target.value)} />
                    </div>

                    <button onClick={() => {
                        setAddedPlaces(prev => [...prev, {
                         ...SelectedPlace,
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
                      style={{ padding: '10px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      📍 Place ADD
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 🔥 Popular Route Recommended (accordion) ── */}
          <div style={{ border: '1px solid #eee', borderRadius: 3, overflow: 'hidden' }}>
            <button onClick={() => { if (!openCourse) loadRecommendedCourses(courseQuery || newPlan.to || newPlan.title); setOpenCourse(v =>!v); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: openCourse? '#FAFAF8' : '#FAFAF8', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: openCourse? '#1E2A3A' : '#1E2A3A' }}>
              <span>🔥 Popular Route</span>
              <span style={{ fontSize: 16, transition: 'transform 0.2s', display: 'inline-block', transform: openCourse? 'rotate(180deg)' : 'rotate(0deg)' }}>›</span>
            </button>
            {openCourse && (
              <div style={{ padding: '14px 16px', borderTop: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" style={{ flex: 1, marginBottom: 0 }} placeholder="City (e.g. Tokyo, Paris, Seoul)" value={courseQuery} onChange={e => setCourseQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadRecommendedCourses(courseQuery)} />
                  <button onClick={() => loadRecommendedCourses(courseQuery)} disabled={courseLoading ||!courseQuery.trim()} style={{ padding: '8px 16px', background: courseQuery.trim()? '#1E2A3A' : '#E2E0DC', color: courseQuery.trim()? 'white' : '#8A919C', border: 'none', borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>{courseLoading? 'SEARCH...' : 'SEARCH'}</button>
                </div>
                {courseLoading && <div style={{ textAlign: 'center', padding: 12, color: '#8A919C', fontSize: 12 }}>Route SEARCH...</div>}
                {!courseLoading && recommendedCourses.length === 0 && courseQuery && <div style={{ textAlign: 'center', padding: 16, color: '#8A919C', fontSize: 12 }}> City — Recommended Route No none</div>}
                {recommendedCourses.map(course => (
                  <div key={course.id} style={{ background: 'white', borderRadius: 3, border: '1px solid #F0EEE9', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div><div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A' }}>{course.title}</div><div style={{ fontSize: 11, color: '#8A919C', marginTop: 2 }}>📍 {course.places?.length || 0}places</div></div>
                      <button onClick={() => addCourseToPlaces(course)} style={{ padding: '6px 14px', borderRadius: 2, background: '#1E2A3A', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ ALL ADD</button>
                    </div>
                    <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {course.places?.sort((a, b) => (a.placeOrder || 0) - (b.placeOrder || 0)).map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#FAFAF8', borderRadius: 2, fontSize: 12 }}>
                          <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#1E2A3A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                          <div style={{ flex: 1 }}><span style={{ fontWeight: 600, color: '#1E2A3A' }}>{p.name}</span></div>
                          {p.howToGet && <span style={{ fontSize: 10, color: '#3b82f6', flexShrink: 0 }}>🚇 {(p.howToGet || '').substring(0, 20)}</span>}
                          <button onClick={(e) => { e.stopPropagation(); setAddedPlaces(prev => [...prev, { name: p.name, lat: p.lat || 0, lng: p.lng || 0, fullName: '', category: p.category || 'attraction', date: newPlan.startDate || '', memo: [p.tip, p.howToGet].filter(Boolean).join(' | ') }]); }} style={{ padding: '3px 8px', borderRadius: 6, background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', fontSize: 10, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>+ ADD</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SHARE Settings */}
          <div style={{ background: '#FAFAF8', border: '1px solid #eee', borderRadius: 3, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A', marginBottom: 10 }}>🔗 SHARE Settings</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[['private', '🔒 Private'], ['friends', '👥 Friends-only'], ['public', '🌍 Public']].map(([val, label]) => (
                <button key={val} onClick={() => setNewPlan(p => ({
                   ...p, shareType: val,
                    shareSchedule: val === 'public'? true : val === 'private'? false : p.shareSchedule,
                    sharePlaces: val === 'public'? true : val === 'private'? false : p.sharePlaces,
                  }))}
                  style={{ flex: 1, padding: '8px 4px', borderRadius: 2, border: `2px solid ${newPlan.shareType === val? '#1E2A3A' : '#E2E0DC'}`, background: newPlan.shareType === val? '#EEEDEA' : 'white', color: newPlan.shareType === val? '#1E2A3A' : '#8A919C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, opacity: newPlan.shareType === 'private'? 0.4 : 1 }}>
                <input type="checkbox" checked={newPlan.shareSchedule} disabled={newPlan.shareType === 'private'}
                  onChange={e => setNewPlan(p => ({...p, shareSchedule: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: '#1E2A3A' }} />
                <span style={{ color: '#4A5568', fontWeight: 600 }}>📅 SCHEDULE SHARE</span>
                <span style={{ color: '#8A919C', fontSize: 12 }}>— share travel dates</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, opacity: newPlan.shareType === 'private'? 0.4 : 1 }}>
                <input type="checkbox" checked={newPlan.sharePlaces} disabled={newPlan.shareType === 'private'}
                  onChange={e => setNewPlan(p => ({...p, sharePlaces: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: '#1E2A3A' }} />
                <span style={{ color: '#4A5568', fontWeight: 600 }}>📍 Place SHARE</span>
                <span style={{ color: '#8A919C', fontSize: 12 }}>— share planned places</span>
              </label>
            </div>
          </div>

          {/* Added items */}
          {(addedRoutes.length > 0 || addedPlaces.length > 0) && (
            <div style={{ background: '#FAFAF8', border: '1px solid #eee', borderRadius: 3, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A', marginBottom: 10 }}>
                🗂 added Item ({addedRoutes.length + addedPlaces})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {addedRoutes.map((r, i) => (
                  <div key={`r-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', border: '1px solid #E2E0DC', borderRadius: 2, padding: '10px 14px' }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{r.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A' }}>{r.name}</span>
                        {r.tag && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 2, background: r.tagColor + '20', color: r.tagColor, border: `1px solid ${r.tagColor}40` }}>{r.tag}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#8A919C' }}>
                        ✈ {r.from} → {r.to}{r.date && ` · 📅 ${r.date}`} · ⏱ {r.time} · 💰 {r.price}
                      </div>
                    </div>
                    <button onClick={() => setAddedRoutes(prev => prev.filter((_, idx) => idx!== i))}
                      style={{ padding: '4px 10px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 2, fontSize: 12, cursor: 'pointer', flexShrink: 0, fontWeight: 600 }}>DELETE</button>
                  </div>
                ))}
                {addedPlaces.map((p, i) => (
                  <div key={`p-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', border: '1px solid #E2E0DC', borderRadius: 2, padding: '10px 14px' }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>📍</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A', marginBottom: 2 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#8A919C' }}>
                        {p.category && `${p.category}`}{p.date && ` · 📅 ${p.date}`}{p.memo && ` · ${p.memo}`}
                      </div>
                    </div>
                    <button onClick={() => setAddedPlaces(prev => prev.filter((_, idx) => idx!== i))}
                      style={{ padding: '4px 10px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 2, fontSize: 12, cursor: 'pointer', flexShrink: 0, fontWeight: 600 }}>DELETE</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={createPlan}>Create</button>
            <button className="btn-secondary" onClick={() => { setShowNewPlan(false); setRouteResults([]); setAddedRoutes([]); setSelectedRoute(null); setAddedPlaces([]); setPlaceResults([]); setSelectedPlace(null); setOpenTransport(false); setOpenPlace(false); }}>CANCEL</button>
          </div>
        </div>
      )}

      {/* SCHEDULE EDIT */}
      {editPlan && (
        <div className="post-form" style={{ gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1E2A3A' }}>SCHEDULE EDIT</div>
          <input className="form-input" placeholder="Schedule name" value={editPlan.title}
            onChange={e => setEditPlan(p => ({...p, title: e.target.value }))} />
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Departure date</label>
              <input type="date" className="form-input" value={editPlan.startDate || ''}
                onChange={e => setEditPlan(p => ({...p, startDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Arrival date</label>
              <input type="date" className="form-input" value={editPlan.endDate || ''}
                onChange={e => setEditPlan(p => ({...p, endDate: e.target.value }))} />
            </div>
          </div>
          {/* ── 🔥 Popular Route Recommended (accordion) ── */}
          <div style={{ border: '1px solid #eee', borderRadius: 3, overflow: 'hidden' }}>
            <button onClick={() => { if (!openCourse) loadRecommendedCourses(courseQuery || newPlan.to || newPlan.title); setOpenCourse(v =>!v); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: openCourse? '#FAFAF8' : '#FAFAF8', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: openCourse? '#1E2A3A' : '#1E2A3A' }}>
              <span>🔥 Popular Route</span>
              <span style={{ fontSize: 16, transition: 'transform 0.2s', display: 'inline-block', transform: openCourse? 'rotate(180deg)' : 'rotate(0deg)' }}>›</span>
            </button>
            {openCourse && (
              <div style={{ padding: '14px 16px', borderTop: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" style={{ flex: 1, marginBottom: 0 }} placeholder="City (e.g. Tokyo, Paris, Seoul)" value={courseQuery} onChange={e => setCourseQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadRecommendedCourses(courseQuery)} />
                  <button onClick={() => loadRecommendedCourses(courseQuery)} disabled={courseLoading ||!courseQuery.trim()} style={{ padding: '8px 16px', background: courseQuery.trim()? '#1E2A3A' : '#E2E0DC', color: courseQuery.trim()? 'white' : '#8A919C', border: 'none', borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>{courseLoading? 'SEARCH...' : 'SEARCH'}</button>
                </div>
                {courseLoading && <div style={{ textAlign: 'center', padding: 12, color: '#8A919C', fontSize: 12 }}>Route SEARCH...</div>}
                {!courseLoading && recommendedCourses.length === 0 && courseQuery && <div style={{ textAlign: 'center', padding: 16, color: '#8A919C', fontSize: 12 }}> City — Recommended Route No none</div>}
                {recommendedCourses.map(course => (
                  <div key={course.id} style={{ background: 'white', borderRadius: 3, border: '1px solid #F0EEE9', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div><div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A' }}>{course.title}</div><div style={{ fontSize: 11, color: '#8A919C', marginTop: 2 }}>📍 {course.places?.length || 0}places</div></div>
                      <button onClick={() => addCourseToPlaces(course)} style={{ padding: '6px 14px', borderRadius: 2, background: '#1E2A3A', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ ALL ADD</button>
                    </div>
                    <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {course.places?.sort((a, b) => (a.placeOrder || 0) - (b.placeOrder || 0)).map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#FAFAF8', borderRadius: 2, fontSize: 12 }}>
                          <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#1E2A3A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                          <div style={{ flex: 1 }}><span style={{ fontWeight: 600, color: '#1E2A3A' }}>{p.name}</span></div>
                          {p.howToGet && <span style={{ fontSize: 10, color: '#3b82f6', flexShrink: 0 }}>🚇 {(p.howToGet || '').substring(0, 20)}</span>}
                          <button onClick={(e) => { e.stopPropagation(); setAddedPlaces(prev => [...prev, { name: p.name, lat: p.lat || 0, lng: p.lng || 0, fullName: '', category: p.category || 'attraction', date: newPlan.startDate || '', memo: [p.tip, p.howToGet].filter(Boolean).join(' | ') }]); }} style={{ padding: '3px 8px', borderRadius: 6, background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', fontSize: 10, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>+ ADD</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SHARE Settings */}
          <div style={{ background: '#FAFAF8', border: '1px solid #eee', borderRadius: 3, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A', marginBottom: 10 }}>🔗 SHARE Settings</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {[['private', '🔒 Private'], ['friends', '👥 Friends-only'], ['public', '🌍 Public']].map(([val, label]) => (
                <button key={val} onClick={() => setEditPlan(p => ({
                   ...p,
                    shareType: val,
                    shareSchedule: val === 'public'? true : val === 'private'? false : p.shareSchedule,
                    sharePlaces: val === 'public'? true : val === 'private'? false : p.sharePlaces,
                  }))}
                  style={{ flex: 1, padding: '8px 4px', borderRadius: 2, border: `2px solid ${editPlan.shareType === val? '#1E2A3A' : '#E2E0DC'}`, background: editPlan.shareType === val? '#EEEDEA' : 'white', color: editPlan.shareType === val? '#1E2A3A' : '#8A919C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
            {editPlan.shareType!== 'private' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={editPlan.shareSchedule}
                    onChange={e => setEditPlan(p => ({...p, shareSchedule: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: '#1E2A3A' }} />
                  <span style={{ color: '#4A5568', fontWeight: 600 }}>📅 SCHEDULE SHARE</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={editPlan.sharePlaces}
                    onChange={e => setEditPlan(p => ({...p, sharePlaces: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: '#1E2A3A' }} />
                  <span style={{ color: '#4A5568', fontWeight: 600 }}>📍 Place SHARE</span>
                </label>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={savePlanEdit}>SAVE</button>
            <button className="btn-secondary" onClick={() => setEditPlan(null)}>CANCEL</button>
          </div>
        </div>
      )}

      {(!plans || plans.length === 0) &&!showNewPlan? (
        <div className="empty">No schedules.<br />Create a new schedule and add places!</div>
      ) : (
        <div className="plan-layout">
          {/* Left: SCHEDULE List — click accordionto details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(plans || []).map(plan => {
              const isOpen = Selected?.id === plan.id;
              const today = new Date().toISOString().slice(0, 10);
              const isPast = plan.endDate && plan.endDate < today;

              return (
                <div key={plan.id} style={{ border: isOpen? (isPast? '2px solid #B8BCC4' : '2px solid #1E2A3A') : '2px solid #eee', borderRadius: 3, overflow: 'hidden', background: isPast? '#FAFAF8' : 'white', transition: 'border-color 0.15s' }}>
                  {/* card header */}
                  <div onClick={() => { setSelected(isOpen? null : plan); setViewMode('list'); }}
                    style={{ padding: '14px 16px', cursor: 'pointer', background: isOpen? (isPast? '#FAFAF8' : '#fafbff') : (isPast? '#FAFAF8' : 'white') }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <span style={{ fontWeight: 700, fontSize: 15, color: isPast? '#8A919C' : '#1E2A3A' }}>{plan.title}</span>
                          {isPast && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 2, background: '#F5F4F0', color: '#8A919C', border: '1px solid #E2E0DC', flexShrink: 0 }}>
                              ✅ Completed SCHEDULE
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#8A919C' }}>
                          {plan.startDate || 'Date TBD'}{plan.endDate? ` ~ ${plan.endDate}` : ''}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: isPast? '#8A919C' : '#ef4444', fontWeight: 600 }}>📍 {plan.items?.length || 0} Place</span>
                          <span style={{ fontSize: 11, color: '#8A919C' }}>
                            {plan.shareType === 'friends'? '👥 Friends-only' : plan.shareType === 'public'? '🌍 Public' : '🔒 Private'}
                            {plan.shareSchedule && ' · 📅 SCHEDULESHARE'}
                            {plan.sharePlaces && ' · 📍 PlaceSHARE'}
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize: 20, color: isPast? '#B8BCC4' : '#E2E0DC', marginLeft: 10, transition: 'transform 0.2s', display: 'inline-block', transform: isOpen? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}>›</span>
                    </div>
                    {/* EDIT/DELETE button */}
                    <div style={{ display: 'flex', gap: 4, marginTop: 10 }} onClick={e => e.stopPropagation()}>
                      {!isPast && (
                        <button onClick={() => setEditPlan({ id: plan.id, title: plan.title, startDate: plan.startDate, endDate: plan.endDate, shareType: plan.shareType || 'private', shareSchedule: plan.shareSchedule || false, sharePlaces: plan.sharePlaces || false })}
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 7, border: '1px solid #eee', background: '#FAFAF8', color: '#555', cursor: 'pointer', fontWeight: 600 }}>✏️ EDIT</button>
                      )}
                      <button onClick={() => deletePlan(plan.id)}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 7, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>🗑 DELETE</button>
                    </div>
                  </div>

                  {/* accordion Details */}
                  {isOpen && (
                    <div style={{ borderTop: isPast? '1px solid #E2E0DC' : '1px solid #EEEDEA', background: isPast? '#FAFAF8' : '#fafbff', padding: '12px 16px' }}>

                      {/* Completed SCHEDULE Guide Banner + POSTS Convert button */}
                      {isPast && (
                        <div style={{ background: '#F5F4F0', border: '1px solid #E2E0DC', borderRadius: 2, padding: '10px 14px', fontSize: 13, color: '#8A919C', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>🔒</span>
                            <span>This schedule is completed. Read-only.</span>
                          </span>
                          <button onClick={() => onConvertToPost?.(plan)}
                            style={{ fontSize: 11, padding: '5px 12px', background: '#1E2A3A', color: 'white', border: 'none', borderRadius: 2, cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>
                            ✍️ Write story
                          </button>
                        </div>
                      )}

                      {/* Tab button */}
                      <div style={{ display: 'flex', gap: 4, background: '#F5F4F0', borderRadius: 2, padding: 3, marginBottom: 12 }}>
                        {(isPast
                         ? [['list', '📋 Places'], ['timeline', '📅 Timeline']]
                          : [['list', '📋 Places'], ['timeline', '📅 Timeline'], ['map', '🗺️ Map'], ['chat', '💬 Chat']]
                        ).map(([key, label]) => (
                          <button key={key}
                            onClick={() => { setViewMode(key); if (key === 'chat') loadMessages(); }}
                            style={{ flex: 1, padding: '7px 4px', borderRadius: 2, border: 'none', background: viewMode === key? 'white' : 'transparent', color: viewMode === key? '#1E2A3A' : '#8A919C', fontSize: 12, fontWeight: viewMode === key? 700 : 500, cursor: 'pointer', boxShadow: viewMode === key? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* Thai Tab */}
                      {viewMode === 'timeline' && (
                        <PlanTimeline items={plan.items || []} startDate={plan.startDate} endDate={plan.endDate} readOnly={isPast} onRemove={isPast? null : removeItem} />
                      )}

                      {/* Place List Tab */}
                      {viewMode === 'list' && (
                        plan.items?.length === 0? (
                          <div style={{ textAlign: 'center', color: '#bbb', fontSize: 13, padding: '20px 0', lineHeight: 1.9 }}>
                            {isPast? 'Place Record None.' : 'No places added yet.\nAdd places from the map search tab!'}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {plan.items.map((item, idx) => (
                              <PlanItemRow key={item.id} item={item} idx={idx}
                                onRemove={isPast? null : removeItem}
                                onUpdate={isPast? null : updateItem}
                                readOnly={isPast} />
                            ))}
                          </div>
                        )
                      )}

                      {/* Map/SEARCH Tab */}
                      {viewMode === 'map' && (
                        <PlanMap onAddPlace={addPlaceToSelected} planPlaces={planPlaces} />
                      )}

                      {/* Chat Tab */}
                      {viewMode === 'chat' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {/* Member */}
                          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 3, padding: '12px 14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A' }}>👥 TRAVEL Member</div>
                              {Selected.userId === currentUser.id && (
                                <button onClick={() => { setShowInvite(true); loadFollowings(); }}
                                  style={{ fontSize: 12, padding: '4px 10px', background: '#EEEDEA', border: '1px solid #E2E0DC', borderRadius: 2, color: '#1E2A3A', fontWeight: 700, cursor: 'pointer' }}>
                                  + friends Invite
                                </button>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#EEEDEA', border: '1px solid #E2E0DC', borderRadius: 2, padding: '4px 10px 4px 5px' }}>
                                <img src={`https://ui-avatars.com/api/?name=${Selected.userNickname || '?'}&background=1E2A3A&color=fff&size=22`}
                                  style={{ width: 22, height: 22, borderRadius: '50%' }} alt="" />
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#1E2A3A' }}>{Selected.userNickname || 'Host'}</span>
                                <span style={{ fontSize: 10, color: '#818cf8' }}>Host</span>
                              </div>
                              {(Selected.members || []).map(m => (
                                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'white', border: '1px solid #eee', borderRadius: 2, padding: '4px 10px 4px 5px' }}>
                                  <img src={m.userProfileImage || `https://ui-avatars.com/api/?name=${m.userNickname}&background=e5e7eb&color=555&size=22`}
                                    style={{ width: 22, height: 22, borderRadius: '50%' }} alt="" />
                                  <span style={{ fontSize: 11, fontWeight: 600, color: '#4A5568' }}>{m.userNickname}</span>
                                  {Selected.userId === currentUser.id && (
                                    <button onClick={() => kickMember(m.userId, m.userNickname)}
                                      style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>✕</button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* ChatChangi */}
                          <div style={{ border: '1px solid #eee', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: 260, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, background: '#FAFAF8' }}>
                              {messages.length === 0? (
                                <div style={{ textAlign: 'center', color: '#bbb', fontSize: 13, marginTop: 60 }}>Start chatting!</div>
                              ) : (
                                messages.map(msg => {
                                  const isMine = msg.userId === currentUser.id;
                                  return (
                                    <div key={msg.id} style={{ display: 'flex', flexDirection: isMine? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 6 }}>
                                      {!isMine && <img src={msg.userProfileImage || `https://ui-avatars.com/api/?name=${msg.userNickname}&size=28&background=e5e7eb&color=555`} style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} alt="" />}
                                      <div style={{ width: '70%' }}>
                                        {!isMine && <div style={{ fontSize: 10, color: '#8A919C', marginBottom: 2, paddingLeft: 4 }}>{msg.userNickname}</div>}
                                        <div style={{ background: isMine? '#1E2A3A' : 'white', color: isMine? 'white' : '#1E2A3A', padding: '8px 12px', borderRadius: isMine? '14px 14px 4px 14px' : '14px 14px 14px 4px', fontSize: 13, lineHeight: 1.4, border: isMine? 'none' : '1px solid #eee', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>{msg.content}</div>
                                        <div style={{ fontSize: 10, color: '#bbb', marginTop: 2, textAlign: isMine? 'right' : 'left', paddingLeft: 4, paddingRight: 4 }}>{msg.createdAt?.slice(11, 16)}</div>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                              <div ref={msgEndRef} />
                            </div>
                            <div style={{ padding: '10px 12px', borderTop: '1px solid #eee', display: 'flex', gap: 8, background: 'white' }}>
                              <input value={msgText} onChange={e => setMsgText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' &&!e.shiftKey && sendMessage()}
                                placeholder="MESSAGE Enter..."
                                style={{ flex: 1, padding: '8px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none' }} />
                              <button onClick={sendMessage} disabled={!msgText.trim()}
                                style={{ padding: '8px 14px', background: msgText.trim()? '#1E2A3A' : '#E2E0DC', color: msgText.trim()? 'white' : '#8A919C', border: 'none', borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>SEND</button>
                            </div>
                          </div>
                          {/* Invite Modal */}
                          {showInvite && (
                            <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 3, padding: '14px 16px' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A', marginBottom: 10 }}>friends Invite</div>
                              {followings.length === 0? (
                                <div style={{ fontSize: 13, color: '#8A919C' }}>No followed friends.</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {followings.filter(f => f.id!== currentUser.id &&!(Selected.members || []).find(m => m.userId === f.id)).map(f => (
                                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid #eee', borderRadius: 2, background: '#FAFAF8' }}>
                                      <img src={f.profileImage || `https://ui-avatars.com/api/?name=${f.nickname}&size=32`} style={{ width: 32, height: 32, borderRadius: '50%' }} alt="" />
                                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{f.nickname}</span>
                                      <button onClick={() => inviteMember(f.id, f.nickname)}
                                        style={{ padding: '5px 12px', background: '#1E2A3A', color: 'white', border: 'none', borderRadius: 2, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Invite</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <button onClick={() => setShowInvite(false)}
                                style={{ marginTop: 10, width: '100%', padding: '8px', background: '#F5F4F0', border: 'none', borderRadius: 9, fontSize: 13, cursor: 'pointer', color: '#555' }}>CLOSE</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Country Info panel — accordion displayed separately below */}
                  {isOpen && detectCountries(plan.items || []).length > 0 && (
                    <div style={{ borderTop: '1px solid #EEEDEA' }}>
                      <CountryPanel countries={detectCountries(plan.items || [])} planTitle={plan.title} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: panel Remove (integrated into accordion) */}
        </div>
      )}
      {showInvite && (
        <div className="modal-overlay" onClick={() => setShowInvite(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, width: '100%' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1E2A3A', marginBottom: 16 }}>👥 friends Invite</div>
            {followings.length === 0? (
              <div style={{ textAlign: 'center', color: '#bbb', padding: '24px 0', fontSize: 14 }}>No followed friends.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: 360, overflowY: 'auto' }}>
                {followings.filter(u => {
                  const alreadyMember = (Selected?.members || []).some(m => m.userId === u.id);
                  const isOwner = Selected?.userId === u.id;
                  return!alreadyMember &&!isOwner;
                }).map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid #eee', borderRadius: 3 }}>
                    <img src={u.profileImage || `https://ui-avatars.com/api/?name=${u.nickname}&background=1E2A3A&color=fff&size=36`}
                      style={{ width: 36, height: 36, borderRadius: '50%' }} alt="" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1E2A3A' }}>{u.nickname}</div>
                      {u.bio && <div style={{ fontSize: 12, color: '#8A919C' }}>{u.bio}</div>}
                    </div>
                    <button onClick={() => inviteMember(u.id, u.nickname)}
                      style={{ padding: '7px 14px', background: '#1E2A3A', color: 'white', border: 'none', borderRadius: 2, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      Invite
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowInvite(false)}
              style={{ width: '100%', marginTop: 14, padding: 11, borderRadius: 3, border: '1px solid #eee', background: '#F5F4F0', color: '#555', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>CLOSE</button>
          </div>
        </div>
      )}
      
      {toast && (
        <div style={{
          position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#1E2A3A' : '#fef2f2',
          color: toast.type === 'success' ? 'white' : '#991b1b',
          border: toast.type === 'success' ? 'none' : '1px solid #fecaca',
          borderRadius: 3, padding: '14px 20px',
          fontSize: 13, fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 9999, maxWidth: 420, textAlign: 'center',
          fontFamily: "'Inter', sans-serif", letterSpacing: 0.2,
        }}>
          {toast.type === 'success' ? '✓ ' : '⚠ '}{toast.message}
        </div>
      )}
      </div>
  );
}