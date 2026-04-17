import React, { useState, useEffect, useCallback, useRef } from 'react';

const CITIES = [
  { id: 'seoul', name: 'Seoul', flag: '🇰🇷', country: 'Korea' },
  { id: 'tokyo', name: 'Tokyo', flag: '🇯🇵', country: 'Japan' },
  { id: 'osaka', name: 'Osaka', flag: '🇯🇵', country: 'Japan' },
  { id: 'bangkok', name: 'Bangkok', flag: '🇹🇭', country: 'Thailand' },
  { id: 'singapore', name: 'Singapore', flag: '🇸🇬', country: 'Singapore' },
  { id: 'hongkong', name: 'Hong Kong', flag: '🇭🇰', country: 'Hong Kong' },
  { id: 'paris', name: 'Paris', flag: '🇫🇷', country: 'France' },
  { id: 'london', name: 'London', flag: '🇬🇧', country: 'UK' },
  { id: 'newyork', name: 'New York', flag: '🇺🇸', country: 'USA' },
  { id: 'berlin', name: 'Berlin', flag: '🇩🇪', country: 'Germany' },
  { id: 'barcelona', name: 'Barcelona', flag: '🇪🇸', country: 'Spain' },
  { id: 'rome', name: 'Rome', flag: '🇮🇹', country: 'Italy' },
  { id: 'amsterdam', name: 'Amsterdam', flag: '🇳🇱', country: 'Netherlands' },
];

// BFS Route EXPLORE
function findPath(stationMap, connMap, fromId, toId) {
  if (fromId === toId) return [fromId];
  const visited = new Set([fromId]);
  const queue = [[fromId, [fromId]]];
  while (queue.length > 0) {
    const [cur, path] = queue.shift();
    const neighbors = connMap[cur] || [];
    for (const { toStationId: next } of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        const newPath = [...path, next];
        if (next === toId) return newPath;
        queue.push([next, newPath]);
      }
    }
  }
  return null;
}

// ── by line linear view ──
function LineView({ lines, stations, connections, stationMap, onSelectStation, fromStation, toStation, pathResult }) {
  const [expandedLine, setExpandedLine] = useState(null);
  const pathIds = new Set(pathResult?.path?.map(s => s.id) || []);

  const getOrderedStations = (lineId) => {
    const lineConns = connections.filter(c => c.lineId === lineId);
    if (lineConns.length === 0) return [];
    const adjMap = {};
    lineConns.forEach(c => {
      if (!adjMap[c.fromStationId]) adjMap[c.fromStationId] = new Set();
      if (!adjMap[c.toStationId]) adjMap[c.toStationId] = new Set();
      adjMap[c.fromStationId].add(c.toStationId);
      adjMap[c.toStationId].add(c.fromStationId);
    });
    const allIds = Object.keys(adjMap);
    let startId = allIds.find(id => adjMap[id].size === 1) || allIds[0];
    const ordered = [startId];
    const visited = new Set([startId]);
    let current = startId;
    while (true) {
      const neighbors = [...(adjMap[current] || [])];
      const next = neighbors.find(n =>!visited.has(n));
      if (!next) break;
      ordered.push(next);
      visited.add(next);
      current = next;
    }
    return ordered.map(id => stationMap[id]).filter(Boolean);
  };

  return (
    <div style={{ padding: '12px 16px' }}>
      {lines.map(line => {
        const isExpanded = expandedLine === line.id;
        const orderedStations = isExpanded? getOrderedStations(line.id) : [];
        return (
          <div key={line.id} style={{ background: 'white', borderRadius: 3, border: '1px solid #F0EEE9', marginBottom: 10, overflow: 'hidden' }}>
            <div style={{ background: line.color, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
              onClick={() => setExpandedLine(isExpanded? null : line.id)}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: line.textColor || 'white' }}>
                {line.nameKo.replace(/Line|Line/g, '').trim().slice(0, 3)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: line.textColor || 'white' }}>{line.nameKo}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{line.nameEn}</div>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18 }}>{isExpanded? '▲' : '▼'}</span>
            </div>
            {isExpanded && (
              <div style={{ padding: '12px 0' }}>
                <div style={{ overflowX: 'auto', padding: '16px 16px 24px', scrollbarWidth: 'thin' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: orderedStations.length * 56, position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 20, left: 20, right: 20, height: 4, background: line.color, borderRadius: 2 }} />
                    {orderedStations.map((s, i) => {
                      const isFrom = fromStation?.id === s.id;
                      const isTo = toStation?.id === s.id;
                      const isOnPath = pathIds.has(s.id);
                      const isTransfer = s.isTransfer === 1;
                      return (
                        <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 56, flexShrink: 0, cursor: 'pointer', position: 'relative', zIndex: 1 }}
                          onClick={() => onSelectStation(s)}>
                          <div style={{
                            width: isFrom || isTo? 18 : isTransfer? 16 : 12,
                            height: isFrom || isTo? 18 : isTransfer? 16 : 12,
                            borderRadius: '50%',
                            background: isFrom? '#16a34a' : isTo? '#1E2A3A' : 'white',
                            border: (isTransfer? 3 : 2) + 'px solid ' + (isFrom? '#16a34a' : isTo? '#1E2A3A' : isOnPath? '#f59e0b' : line.color),
                            marginTop: isFrom || isTo? 11 : isTransfer? 12 : 14,
                            boxShadow: (isFrom || isTo)? '0 0 0 3px rgba(255,90,95,0.2)' : 'none',
                          }} />
                          <div style={{
                            writingMode: 'vertical-rl',
                            fontSize: isFrom || isTo? 11 : 10,
                            fontWeight: isFrom || isTo || isTransfer? 700 : 400,
                            color: isFrom? '#16a34a' : isTo? '#1E2A3A' : isOnPath? '#f59e0b' : '#4A5568',
                            marginTop: 6, whiteSpace: 'nowrap', letterSpacing: 0.5,
                          }}>
                            {s.nameKo}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ padding: '0 16px', fontSize: 11, color: '#8A919C' }}>
                  Total {orderedStations.length} stations
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ALL line map (Official site connect) ──
function FullMapView({ cityId }) {
  const city = CITIES.find(c => c.id === cityId);

  const MAP_INFO = {
    seoul: { name: 'Seoul Metro', url: 'https://www.seoulmetro.co.kr/kr/cyberStation.do', desc: 'Seoul Metro Lines 1-9 full map' },
    tokyo: { name: 'Tokyo Metro', url: 'https://www.tokyometro.jp/en/subwaymap/index.html', desc: 'Tokyo Metro full map (English)' },
    osaka: { name: 'Osaka Metro', url: 'https://subway.osakametro.co.jp/guide/file/rosen_english.pdf', desc: 'Osaka Metro full map (English)' },
    bangkok: { name: 'BTS / MRT', url: 'https://www.bts.co.th/eng/routemap.html', desc: 'BTS Skytrain + MRT map' },
    singapore: { name: 'LTA Singapore', url: 'https://www.lta.gov.sg/content/ltagov/en/getting_around/public_transport/rail_network.html', desc: 'Singapore MRT/LRT full map' },
    hongkong: { name: 'MTR', url: 'https://www.mtr.com.hk/en/customer/services/system_map.html', desc: 'Hong Kong MTR full map (English)' },
    paris: { name: 'RATP', url: 'https://www.ratp.fr/en/plans-lignes/metro', desc: 'Paris Metro full map (English)' },
    london: { name: 'TfL', url: 'https://tfl.gov.uk/maps/track/tube', desc: 'London Underground line map' },
    newyork: { name: 'MTA', url: 'https://new.mta.info/maps/subway-map', desc: 'New York Subway ALL line map' },
    berlin: { name: 'BVG', url: 'https://www.bvg.de/en/connections/network-maps', desc: 'Berlin U-Bahn/S-Bahn map' },
    barcelona: { name: 'TMB', url: 'https://www.tmb.cat/en/barcelona-transport/map/metro', desc: 'Barcelona Metro line map' },
    rome: { name: 'ATAC', url: 'https://www.atac.roma.it/en/getting-around/metro', desc: 'Rome Metro line map' },
    amsterdam: { name: 'GVB', url: 'https://www.gvb.nl/en/travel-information/maps', desc: 'Amsterdam Metro line map' },
  };

  const info = MAP_INFO[cityId] || {};

  return (
    <div style={{ padding: '12px 16px' }}>
      {/* Main card */}
      <div style={{ background: 'white', borderRadius: 3, border: '1px solid #F0EEE9', overflow: 'hidden' }}>
        {/* header */}
        <div style={{ background: 'linear-gradient(135deg, #1E2A3A 0%, #ff8a8e 100%)', padding: '28px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🗺️</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'white', marginBottom: 4 }}>
            {city?.flag} {city?.name} line map
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
            {info.desc}
          </div>
        </div>

        {/* Official site Link */}
        <div style={{ padding: '24px' }}>
          <a href={info.url} target="_blank" rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '14px 20px', borderRadius: 3,
              background: '#1E2A3A', color: 'white',
              fontSize: 15, fontWeight: 700, textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(255,90,95,0.3)',
              transition: 'opacity 0.15s',
            }}>
            🔗 {info.name} Official line map View
          </a>

          <div style={{ marginTop: 12, fontSize: 11, color: '#8A919C', textAlign: 'center', lineHeight: 1.6 }}>
            Official sitefrom View the latest line map
          </div>
        </div>
      </div>

      {/* Other city official site Quick link */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#4A5568', marginBottom: 10 }}>other City line map</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {CITIES.filter(c => c.id!== cityId).map(c => {
            const cInfo = MAP_INFO[c.id] || {};
            return (
              <a key={c.id} href={cInfo.url} target="_blank" rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px', borderRadius: 2,
                  background: 'white', border: '1px solid #F0EEE9',
                  textDecoration: 'none', transition: 'border-color 0.15s',
                }}>
                <span style={{ fontSize: 18 }}>{c.flag}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#4A5568' }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: '#8A919C' }}>{cInfo.name}</div>
                </div>
              </a>
            );
          })}
        </div>
      </div>

      {/* Guide */}
      <div style={{ marginTop: 12, padding: '10px 14px', background: '#FAFAF8', borderRadius: 2, fontSize: 11, color: '#8A919C', lineHeight: 1.6 }}>
        💡 For route search use "Route Find" Tab, by line Station Info "by line" tab.
      </div>
    </div>
  );
}

export default function Transit() {
  const [SelectedCity, setSelectedCity] = useState('seoul');
  const [stations, setStations] = useState([]);
  const [lines, setLines] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fromStation, setDeparture] = useState(null);
  const [toStation, setArrival] = useState(null);
  const [selectingFor, setSelectingFor] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pathResult, setPathResult] = useState(null);
  const [activeTab, setActiveTab] = useState('search');

  useEffect(() => {
    loadCityData(SelectedCity);
    setDeparture(null);
    setArrival(null);
    setPathResult(null);
    setSearchQuery('');
  }, [SelectedCity]);

  const loadCityData = async (cityId) => {
    setLoading(true);
    try {
      const [stRes, lnRes, cnRes] = await Promise.all([
        fetch('/api/transit/stations?city=' + cityId),
        fetch('/api/transit/lines?city=' + cityId),
        fetch('/api/transit/connections?city=' + cityId),
      ]);
      const [st, ln, cn] = await Promise.all([stRes.json(), lnRes.json(), cnRes.json()]);
      setStations(st || []);
      setLines(ln || []);
      setConnections(cn || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const connMap = {};
  connections.forEach(c => {
    if (!connMap[c.fromStationId]) connMap[c.fromStationId] = [];
    connMap[c.fromStationId].push(c);
  });
  const stationMap = {};
  stations.forEach(s => { stationMap[s.id] = s; });

  useEffect(() => {
    if (fromStation && toStation) {
      const path = findPath(stationMap, connMap, fromStation.id, toStation.id);
      if (path) {
        const pathStations = path.map(id => stationMap[id]).filter(Boolean);
        const segments = [];
        let curLine = null;
        let curSegment = [];
        for (let i = 0; i < path.length - 1; i++) {
          const conn = (connMap[path[i]] || []).find(c => c.toStationId === path[i + 1]);
          const lineId = conn?.lineId || 'transfer';
          if (lineId!== curLine) {
            if (curSegment.length > 0) segments.push({ lineId: curLine, stations: curSegment });
            curLine = lineId;
            curSegment = [path[i]];
          }
          curSegment.push(path[i + 1]);
        }
        if (curSegment.length > 0) segments.push({ lineId: curLine, stations: curSegment });
        setPathResult({ path: pathStations, segments, totalTime: path.length * 2, transfers: segments.length - 1 });
      } else {
        setPathResult({ notFound: true });
      }
    }
  }, [fromStation, toStation, stations, connections]);

  const filteredStations = stations.filter(s =>
    s.nameKo?.includes(searchQuery) || s.nameEn?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getLineColor = (lineId) => lines.find(l => l.id === lineId)?.color || '#888';
  const getLineName = (lineId) => {
    if (lineId === 'transfer') return 'Transfer';
    return lines.find(l => l.id === lineId)?.nameKo || lineId;
  };

  const city = CITIES.find(c => c.id === SelectedCity);

  const handleSelectStation = (s) => {
    if (!s) { setDeparture(null); setArrival(null); setPathResult(null); return; }
    if (!fromStation) setDeparture(s);
    else if (!toStation) setArrival(s);
    else { setDeparture(s); setArrival(null); setPathResult(null); }
  };

  const S = {
    wrap: { maxWidth: 680, margin: '0 auto', padding: '0 0 80px' },
    cityTabs: { display: 'flex', gap: 8, overflowX: 'auto', padding: '16px 16px 8px', scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' },
    cityBtn: (active) => ({
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
      padding: '8px 14px', borderRadius: 2, border: '1.5px solid ' + (active? '#1E2A3A' : '#E2E0DC'),
      background: active? '#FAFAF8' : 'white', color: active? '#1E2A3A' : '#8A919C',
      fontSize: 13, fontWeight: active? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap',
    }),
    tabBar: { display: 'flex', borderBottom: '1px solid #F0EEE9', margin: '12px 16px 0' },
    tab: (active) => ({
      flex: 1, padding: '10px 0', textAlign: 'center', fontSize: 13, fontWeight: active? 700 : 500,
      color: active? '#1E2A3A' : '#8A919C', borderBottom: active? '2px solid #1E2A3A' : '2px solid transparent',
      cursor: 'pointer',
    }),
    card: { background: 'white', borderRadius: 3, border: '1px solid #F0EEE9', margin: '12px 16px', padding: 16 },
    stationBtn: (Selected) => ({
      flex: 1, padding: '12px 14px', borderRadius: 3,
      background: Selected? '#FAFAF8' : '#FAFAF8',
      border: '1.5px solid ' + (Selected? '#1E2A3A' : '#E2E0DC'),
      color: Selected? '#1E2A3A' : '#4A5568',
      fontSize: 13, fontWeight: Selected? 700 : 500, cursor: 'pointer', textAlign: 'left',
    }),
    input: { width: '100%', padding: '11px 14px', borderRadius: 3, border: '1.5px solid #E2E0DC', fontSize: 13, outline: 'none', background: '#FAFAF8', color: '#1E2A3A', boxSizing: 'border-box' },
    stationItem: (Selected) => ({
      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
      borderBottom: '1px solid #FAFAF8', cursor: 'pointer',
      background: Selected? '#FAFAF8' : 'white',
    }),
    lineBadge: (color, textColor) => ({
      display: 'inline-block', padding: '2px 8px', borderRadius: 2,
      background: color, color: textColor || 'white', fontSize: 11, fontWeight: 700,
    }),
    pathSegment: (color) => ({ borderLeft: '4px solid ' + color, paddingLeft: 12, marginLeft: 8, paddingTop: 4, paddingBottom: 4 }),
  };

  return (
    <div style={S.wrap}>
      {/* City SELECT */}
      <div style={S.cityTabs}>
        {CITIES.map(c => (
          <button key={c.id} style={S.cityBtn(SelectedCity === c.id)}
            onClick={() => setSelectedCity(c.id)}>
            <span style={{ fontSize: 16 }}>{c.flag}</span> {c.name}
          </button>
        ))}
      </div>

      {/* Tab 3 */}
      <div style={S.tabBar}>
        <div style={S.tab(activeTab === 'search')} onClick={() => setActiveTab('search')}>🔍 Route Find</div>
        <div style={S.tab(activeTab === 'lines')} onClick={() => setActiveTab('lines')}>🚇 by line</div>
        <div style={S.tab(activeTab === 'map')} onClick={() => setActiveTab('map')}>🗺️ line map</div>
      </div>

      {loading? (
        <div style={{ textAlign: 'center', padding: 40, color: '#8A919C' }}>Loading...</div>
      ) : (
        <>
          {/* ── Route Find Tab ── */}
          {activeTab === 'search' && (
            <>
              <div style={S.card}>
                <div style={{ fontSize: 13, color: '#8A919C', marginBottom: 10, fontWeight: 600 }}>
                  {city?.flag} {city?.name} Subway Route Find
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <button style={S.stationBtn(!!fromStation)}
                    onClick={() => { setSelectingFor('from'); setSearchQuery(''); }}>
                    <div style={{ fontSize: 11, color: '#8A919C', marginBottom: 2 }}>Departure</div>
                    <div>{fromStation? fromStation.nameKo : 'Station SELECT'}</div>
                  </button>
                  <button style={{ padding: '12px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#1E2A3A' }}
                    onClick={() => { const tmp = fromStation; setDeparture(toStation); setArrival(tmp); }}>⇄</button>
                  <button style={S.stationBtn(!!toStation)}
                    onClick={() => { setSelectingFor('to'); setSearchQuery(''); }}>
                    <div style={{ fontSize: 11, color: '#8A919C', marginBottom: 2 }}>Arrival</div>
                    <div>{toStation? toStation.nameKo : 'Station SELECT'}</div>
                  </button>
                </div>

                {selectingFor && (
                  <div>
                    <input style={S.input}
                      placeholder={(selectingFor === 'from'? 'From' : 'To') + 'Station SEARCH...'}
                      value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
                    <div style={{ height: 240, overflowY: 'auto', marginTop: 8, borderRadius: 3, border: '1px solid #F0EEE9' }}>
                      {filteredStations.slice(0, 50).map(s => {
                        const stLines = lines.filter(l =>
                          connections.some(c => (c.fromStationId === s.id || c.toStationId === s.id) && c.lineId === l.id)
                        );
                        return (
                          <div key={s.id} style={S.stationItem(
                            (selectingFor === 'from' && fromStation?.id === s.id) ||
                            (selectingFor === 'to' && toStation?.id === s.id)
                          )}
                            onClick={() => {
                              if (selectingFor === 'from') setDeparture(s);
                              else setArrival(s);
                              setSelectingFor(null); setSearchQuery('');
                            }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#1E2A3A' }}>{s.nameKo}</div>
                              <div style={{ fontSize: 11, color: '#8A919C' }}>{s.nameEn}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {stLines.slice(0, 3).map(l => (
                                <span key={l.id} style={S.lineBadge(l.color, l.textColor)}>{l.nameKo}</span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {filteredStations.length === 0 && (
                        <div style={{ padding: 20, textAlign: 'center', color: '#8A919C', fontSize: 13 }}>Search results none</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Route Results */}
              {pathResult &&!selectingFor && (
                <div style={S.card}>
                  {pathResult.notFound? (
                    <div style={{ textAlign: 'center', padding: 20, color: '#8A919C' }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>😢</div>
                      No route found
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 16, padding: 12, background: '#FAFAF8', borderRadius: 3 }}>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#1E2A3A' }}>{pathResult.totalTime}min</div>
                          <div style={{ fontSize: 11, color: '#8A919C' }}>est. Travel time</div>
                        </div>
                        <div style={{ width: 1, background: '#F0EEE9' }} />
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#1E2A3A' }}>{pathResult.path.length - 1}</div>
                          <div style={{ fontSize: 11, color: '#8A919C' }}>stops</div>
                        </div>
                        <div style={{ width: 1, background: '#F0EEE9' }} />
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#1E2A3A' }}>{Math.max(0, pathResult.transfers)}</div>
                          <div style={{ fontSize: 11, color: '#8A919C' }}>Transfer</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#4A5568', marginBottom: 12 }}>Details Route</div>
                      {pathResult.segments.map((seg, si) => {
                        const color = getLineColor(seg.lineId);
                        const lineName = getLineName(seg.lineId);
                        return (
                          <div key={si} style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <span style={S.lineBadge(color)}>{lineName}</span>
                              <span style={{ fontSize: 12, color: '#8A919C' }}>{seg.stations.length - 1}stops</span>
                            </div>
                            <div style={S.pathSegment(color)}>
                              {seg.stations.map((id, idx) => {
                                const st = stationMap[id];
                                if (!st) return null;
                                const isFirst = idx === 0;
                                const isLast = idx === seg.stations.length - 1;
                                return (
                                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', opacity: (!isFirst &&!isLast && seg.stations.length > 3)? 0.5 : 1 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: (isFirst || isLast)? color : '#ddd', border: '2px solid ' + color, flexShrink: 0 }} />
                                    <span style={{ fontSize: 13, fontWeight: (isFirst || isLast)? 700 : 400, color: '#1E2A3A' }}>{st.nameKo}</span>
                                    {(isFirst || isLast) && <span style={{ fontSize: 11, color: '#8A919C' }}>{st.nameEn}</span>}
                                  </div>
                                );
                              })}
                            </div>
                            {si < pathResult.segments.length - 1 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0 0 12px', color: '#f59e0b', fontSize: 12, fontWeight: 600 }}>
                                🔄 Transfer — {getLineName(pathResult.segments[si + 1].lineId)} Board
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}

              {!fromStation &&!toStation &&!selectingFor && (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: '#8A919C' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🚇</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Departure and Arrival SELECT</div>
                  <div style={{ fontSize: 12 }}>See subway routes and travel times</div>
                </div>
              )}
            </>
          )}

          {/* ── by line Tab ── */}
          {activeTab === 'lines' && (
            <LineView
              lines={lines} stations={stations} connections={connections}
              stationMap={stationMap} onSelectStation={handleSelectStation}
              fromStation={fromStation} toStation={toStation} pathResult={pathResult}
            />
          )}

          {/* ── ALL line map Tab ── */}
          {activeTab === 'map' && (
            <FullMapView cityId={SelectedCity} />
          )}
        </>
      )}
    </div>
  );
}