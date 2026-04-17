import React, { useState, useEffect, useCallback, useRef } from 'react';

const CITIES = [
  { id: 'seoul', name: '서울', flag: '🇰🇷', country: '한국' },
  { id: 'tokyo', name: '도쿄', flag: '🇯🇵', country: '일본' },
  { id: 'osaka', name: '오사카', flag: '🇯🇵', country: '일본' },
  { id: 'bangkok', name: '방콕', flag: '🇹🇭', country: '태국' },
  { id: 'singapore', name: '싱가포르', flag: '🇸🇬', country: '싱가포르' },
  { id: 'hongkong', name: '홍콩', flag: '🇭🇰', country: '홍콩' },
  { id: 'paris', name: '파리', flag: '🇫🇷', country: '프랑스' },
  { id: 'london', name: '런던', flag: '🇬🇧', country: '영국' },
  { id: 'newyork', name: '뉴욕', flag: '🇺🇸', country: '미국' },
  { id: 'berlin', name: '베를린', flag: '🇩🇪', country: '독일' },
  { id: 'barcelona', name: '바르셀로나', flag: '🇪🇸', country: '스페인' },
  { id: 'rome', name: '로마', flag: '🇮🇹', country: '이탈리아' },
  { id: 'amsterdam', name: '암스테르담', flag: '🇳🇱', country: '네덜란드' },
];

// BFS 경로 탐색
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

// ── 노선별 직선형 보기 ──
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
      const next = neighbors.find(n => !visited.has(n));
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
        const orderedStations = isExpanded ? getOrderedStations(line.id) : [];
        return (
          <div key={line.id} style={{ background: 'white', borderRadius: 3, border: '1px solid #F0EEE9', marginBottom: 10, overflow: 'hidden' }}>
            <div style={{ background: line.color, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
              onClick={() => setExpandedLine(isExpanded ? null : line.id)}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: line.textColor || 'white' }}>
                {line.nameKo.replace(/호선|Line/g, '').trim().slice(0, 3)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: line.textColor || 'white' }}>{line.nameKo}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{line.nameEn}</div>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18 }}>{isExpanded ? '▲' : '▼'}</span>
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
                            width: isFrom || isTo ? 18 : isTransfer ? 16 : 12,
                            height: isFrom || isTo ? 18 : isTransfer ? 16 : 12,
                            borderRadius: '50%',
                            background: isFrom ? '#16a34a' : isTo ? '#1E2A3A' : 'white',
                            border: (isTransfer ? 3 : 2) + 'px solid ' + (isFrom ? '#16a34a' : isTo ? '#1E2A3A' : isOnPath ? '#f59e0b' : line.color),
                            marginTop: isFrom || isTo ? 11 : isTransfer ? 12 : 14,
                            boxShadow: (isFrom || isTo) ? '0 0 0 3px rgba(255,90,95,0.2)' : 'none',
                          }} />
                          <div style={{
                            writingMode: 'vertical-rl',
                            fontSize: isFrom || isTo ? 11 : 10,
                            fontWeight: isFrom || isTo || isTransfer ? 700 : 400,
                            color: isFrom ? '#16a34a' : isTo ? '#1E2A3A' : isOnPath ? '#f59e0b' : '#4A5568',
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
                  총 {orderedStations.length}개 역
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 전체 노선도 (공식 사이트 연결) ──
function FullMapView({ cityId }) {
  const city = CITIES.find(c => c.id === cityId);

  const MAP_INFO = {
    seoul: { name: '서울교통공사', url: 'https://www.seoulmetro.co.kr/kr/cyberStation.do', desc: '서울 지하철 1~9호선 전체 노선도' },
    tokyo: { name: 'Tokyo Metro', url: 'https://www.tokyometro.jp/en/subwaymap/index.html', desc: '도쿄 메트로 전체 노선도 (영문)' },
    osaka: { name: 'Osaka Metro', url: 'https://subway.osakametro.co.jp/guide/file/rosen_english.pdf', desc: '오사카 메트로 전체 노선도 (영문)' },
    bangkok: { name: 'BTS / MRT', url: 'https://www.bts.co.th/eng/routemap.html', desc: 'BTS 스카이트레인 + MRT 노선도' },
    singapore: { name: 'LTA Singapore', url: 'https://www.lta.gov.sg/content/ltagov/en/getting_around/public_transport/rail_network.html', desc: '싱가포르 MRT/LRT 전체 노선도' },
    hongkong: { name: 'MTR', url: 'https://www.mtr.com.hk/en/customer/services/system_map.html', desc: '홍콩 MTR 전체 노선도 (영문)' },
    paris: { name: 'RATP', url: 'https://www.ratp.fr/en/plans-lignes/metro', desc: '파리 메트로 전체 노선도 (영문)' },
    london: { name: 'TfL', url: 'https://tfl.gov.uk/maps/track/tube', desc: '런던 언더그라운드 노선도' },
    newyork: { name: 'MTA', url: 'https://new.mta.info/maps/subway-map', desc: '뉴욕 서브웨이 전체 노선도' },
    berlin: { name: 'BVG', url: 'https://www.bvg.de/en/connections/network-maps', desc: '베를린 U-Bahn/S-Bahn 노선도' },
    barcelona: { name: 'TMB', url: 'https://www.tmb.cat/en/barcelona-transport/map/metro', desc: '바르셀로나 메트로 노선도' },
    rome: { name: 'ATAC', url: 'https://www.atac.roma.it/en/getting-around/metro', desc: '로마 메트로 노선도' },
    amsterdam: { name: 'GVB', url: 'https://www.gvb.nl/en/travel-information/maps', desc: '암스테르담 메트로 노선도' },
  };

  const info = MAP_INFO[cityId] || {};

  return (
    <div style={{ padding: '12px 16px' }}>
      {/* 메인 카드 */}
      <div style={{ background: 'white', borderRadius: 3, border: '1px solid #F0EEE9', overflow: 'hidden' }}>
        {/* 헤더 */}
        <div style={{ background: 'linear-gradient(135deg, #1E2A3A 0%, #ff8a8e 100%)', padding: '28px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🗺️</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'white', marginBottom: 4 }}>
            {city?.flag} {city?.name} 노선도
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
            {info.desc}
          </div>
        </div>

        {/* 공식 사이트 링크 */}
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
            🔗 {info.name} 공식 노선도 보기
          </a>

          <div style={{ marginTop: 12, fontSize: 11, color: '#8A919C', textAlign: 'center', lineHeight: 1.6 }}>
            공식 사이트에서 최신 노선도를 확인할 수 있어요
          </div>
        </div>
      </div>

      {/* 다른 도시 공식 사이트 바로가기 */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#4A5568', marginBottom: 10 }}>다른 도시 노선도</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {CITIES.filter(c => c.id !== cityId).map(c => {
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

      {/* 안내 */}
      <div style={{ marginTop: 12, padding: '10px 14px', background: '#FAFAF8', borderRadius: 2, fontSize: 11, color: '#8A919C', lineHeight: 1.6 }}>
        💡 경로 검색은 "경로 찾기" 탭을, 노선별 역 정보는 "노선별" 탭을 이용하세요.
      </div>
    </div>
  );
}

export default function Transit() {
  const [selectedCity, setSelectedCity] = useState('seoul');
  const [stations, setStations] = useState([]);
  const [lines, setLines] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fromStation, setFromStation] = useState(null);
  const [toStation, setToStation] = useState(null);
  const [selectingFor, setSelectingFor] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pathResult, setPathResult] = useState(null);
  const [activeTab, setActiveTab] = useState('search');

  useEffect(() => {
    loadCityData(selectedCity);
    setFromStation(null);
    setToStation(null);
    setPathResult(null);
    setSearchQuery('');
  }, [selectedCity]);

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
          if (lineId !== curLine) {
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
    if (lineId === 'transfer') return '환승';
    return lines.find(l => l.id === lineId)?.nameKo || lineId;
  };

  const city = CITIES.find(c => c.id === selectedCity);

  const handleSelectStation = (s) => {
    if (!s) { setFromStation(null); setToStation(null); setPathResult(null); return; }
    if (!fromStation) setFromStation(s);
    else if (!toStation) setToStation(s);
    else { setFromStation(s); setToStation(null); setPathResult(null); }
  };

  const S = {
    wrap: { maxWidth: 680, margin: '0 auto', padding: '0 0 80px' },
    cityTabs: { display: 'flex', gap: 8, overflowX: 'auto', padding: '16px 16px 8px', scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' },
    cityBtn: (active) => ({
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
      padding: '8px 14px', borderRadius: 2, border: '1.5px solid ' + (active ? '#1E2A3A' : '#E2E0DC'),
      background: active ? '#FAFAF8' : 'white', color: active ? '#1E2A3A' : '#8A919C',
      fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap',
    }),
    tabBar: { display: 'flex', borderBottom: '1px solid #F0EEE9', margin: '12px 16px 0' },
    tab: (active) => ({
      flex: 1, padding: '10px 0', textAlign: 'center', fontSize: 13, fontWeight: active ? 700 : 500,
      color: active ? '#1E2A3A' : '#8A919C', borderBottom: active ? '2px solid #1E2A3A' : '2px solid transparent',
      cursor: 'pointer',
    }),
    card: { background: 'white', borderRadius: 3, border: '1px solid #F0EEE9', margin: '12px 16px', padding: 16 },
    stationBtn: (selected) => ({
      flex: 1, padding: '12px 14px', borderRadius: 3,
      background: selected ? '#FAFAF8' : '#FAFAF8',
      border: '1.5px solid ' + (selected ? '#1E2A3A' : '#E2E0DC'),
      color: selected ? '#1E2A3A' : '#4A5568',
      fontSize: 13, fontWeight: selected ? 700 : 500, cursor: 'pointer', textAlign: 'left',
    }),
    input: { width: '100%', padding: '11px 14px', borderRadius: 3, border: '1.5px solid #E2E0DC', fontSize: 13, outline: 'none', background: '#FAFAF8', color: '#1E2A3A', boxSizing: 'border-box' },
    stationItem: (selected) => ({
      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
      borderBottom: '1px solid #FAFAF8', cursor: 'pointer',
      background: selected ? '#FAFAF8' : 'white',
    }),
    lineBadge: (color, textColor) => ({
      display: 'inline-block', padding: '2px 8px', borderRadius: 2,
      background: color, color: textColor || 'white', fontSize: 11, fontWeight: 700,
    }),
    pathSegment: (color) => ({ borderLeft: '4px solid ' + color, paddingLeft: 12, marginLeft: 8, paddingTop: 4, paddingBottom: 4 }),
  };

  return (
    <div style={S.wrap}>
      {/* 도시 선택 */}
      <div style={S.cityTabs}>
        {CITIES.map(c => (
          <button key={c.id} style={S.cityBtn(selectedCity === c.id)}
            onClick={() => setSelectedCity(c.id)}>
            <span style={{ fontSize: 16 }}>{c.flag}</span> {c.name}
          </button>
        ))}
      </div>

      {/* 탭 3개 */}
      <div style={S.tabBar}>
        <div style={S.tab(activeTab === 'search')} onClick={() => setActiveTab('search')}>🔍 경로 찾기</div>
        <div style={S.tab(activeTab === 'lines')} onClick={() => setActiveTab('lines')}>🚇 노선별</div>
        <div style={S.tab(activeTab === 'map')} onClick={() => setActiveTab('map')}>🗺️ 노선도</div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#8A919C' }}>불러오는 중...</div>
      ) : (
        <>
          {/* ── 경로 찾기 탭 ── */}
          {activeTab === 'search' && (
            <>
              <div style={S.card}>
                <div style={{ fontSize: 13, color: '#8A919C', marginBottom: 10, fontWeight: 600 }}>
                  {city?.flag} {city?.name} 지하철 경로 찾기
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <button style={S.stationBtn(!!fromStation)}
                    onClick={() => { setSelectingFor('from'); setSearchQuery(''); }}>
                    <div style={{ fontSize: 11, color: '#8A919C', marginBottom: 2 }}>출발역</div>
                    <div>{fromStation ? fromStation.nameKo : '역 선택'}</div>
                  </button>
                  <button style={{ padding: '12px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#1E2A3A' }}
                    onClick={() => { const tmp = fromStation; setFromStation(toStation); setToStation(tmp); }}>⇄</button>
                  <button style={S.stationBtn(!!toStation)}
                    onClick={() => { setSelectingFor('to'); setSearchQuery(''); }}>
                    <div style={{ fontSize: 11, color: '#8A919C', marginBottom: 2 }}>도착역</div>
                    <div>{toStation ? toStation.nameKo : '역 선택'}</div>
                  </button>
                </div>

                {selectingFor && (
                  <div>
                    <input style={S.input}
                      placeholder={(selectingFor === 'from' ? '출발' : '도착') + '역 검색...'}
                      value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
                    <div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 8, borderRadius: 3, border: '1px solid #F0EEE9' }}>
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
                              if (selectingFor === 'from') setFromStation(s);
                              else setToStation(s);
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
                        <div style={{ padding: 20, textAlign: 'center', color: '#8A919C', fontSize: 13 }}>검색 결과가 없어요</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 경로 결과 */}
              {pathResult && !selectingFor && (
                <div style={S.card}>
                  {pathResult.notFound ? (
                    <div style={{ textAlign: 'center', padding: 20, color: '#8A919C' }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>😢</div>
                      경로를 찾을 수 없어요
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 16, padding: 12, background: '#FAFAF8', borderRadius: 3 }}>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#1E2A3A' }}>{pathResult.totalTime}분</div>
                          <div style={{ fontSize: 11, color: '#8A919C' }}>예상 소요시간</div>
                        </div>
                        <div style={{ width: 1, background: '#F0EEE9' }} />
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#1E2A3A' }}>{pathResult.path.length - 1}</div>
                          <div style={{ fontSize: 11, color: '#8A919C' }}>정거장</div>
                        </div>
                        <div style={{ width: 1, background: '#F0EEE9' }} />
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#1E2A3A' }}>{Math.max(0, pathResult.transfers)}</div>
                          <div style={{ fontSize: 11, color: '#8A919C' }}>환승</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#4A5568', marginBottom: 12 }}>상세 경로</div>
                      {pathResult.segments.map((seg, si) => {
                        const color = getLineColor(seg.lineId);
                        const lineName = getLineName(seg.lineId);
                        return (
                          <div key={si} style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <span style={S.lineBadge(color)}>{lineName}</span>
                              <span style={{ fontSize: 12, color: '#8A919C' }}>{seg.stations.length - 1}정거장</span>
                            </div>
                            <div style={S.pathSegment(color)}>
                              {seg.stations.map((id, idx) => {
                                const st = stationMap[id];
                                if (!st) return null;
                                const isFirst = idx === 0;
                                const isLast = idx === seg.stations.length - 1;
                                return (
                                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', opacity: (!isFirst && !isLast && seg.stations.length > 3) ? 0.5 : 1 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: (isFirst || isLast) ? color : '#ddd', border: '2px solid ' + color, flexShrink: 0 }} />
                                    <span style={{ fontSize: 13, fontWeight: (isFirst || isLast) ? 700 : 400, color: '#1E2A3A' }}>{st.nameKo}</span>
                                    {(isFirst || isLast) && <span style={{ fontSize: 11, color: '#8A919C' }}>{st.nameEn}</span>}
                                  </div>
                                );
                              })}
                            </div>
                            {si < pathResult.segments.length - 1 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0 0 12px', color: '#f59e0b', fontSize: 12, fontWeight: 600 }}>
                                🔄 환승 — {getLineName(pathResult.segments[si + 1].lineId)} 탑승
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}

              {!fromStation && !toStation && !selectingFor && (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: '#8A919C' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🚇</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>출발역과 도착역을 선택하세요</div>
                  <div style={{ fontSize: 12 }}>지하철 경로와 소요시간을 알려드릴게요</div>
                </div>
              )}
            </>
          )}

          {/* ── 노선별 탭 ── */}
          {activeTab === 'lines' && (
            <LineView
              lines={lines} stations={stations} connections={connections}
              stationMap={stationMap} onSelectStation={handleSelectStation}
              fromStation={fromStation} toStation={toStation} pathResult={pathResult}
            />
          )}

          {/* ── 전체 노선도 탭 ── */}
          {activeTab === 'map' && (
            <FullMapView cityId={selectedCity} />
          )}
        </>
      )}
    </div>
  );
}