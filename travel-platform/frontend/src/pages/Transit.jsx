import React, { useState, useEffect, useCallback } from 'react';

const CITIES = [
  { id: 'seoul',     name: '서울',      flag: '🇰🇷', country: '한국' },
  { id: 'tokyo',     name: '도쿄',      flag: '🇯🇵', country: '일본' },
  { id: 'bangkok',   name: '방콕',      flag: '🇹🇭', country: '태국' },
  { id: 'singapore', name: '싱가포르',  flag: '🇸🇬', country: '싱가포르' },
  { id: 'hongkong',  name: '홍콩',      flag: '🇭🇰', country: '홍콩' },
  { id: 'paris',     name: '파리',      flag: '🇫🇷', country: '프랑스' },
  { id: 'london',    name: '런던',      flag: '🇬🇧', country: '영국' },
  { id: 'newyork',   name: '뉴욕',      flag: '🇺🇸', country: '미국' },
  { id: 'berlin',    name: '베를린',    flag: '🇩🇪', country: '독일' },
  { id: 'barcelona', name: '바르셀로나',flag: '🇪🇸', country: '스페인' },
  { id: 'rome',      name: '로마',      flag: '🇮🇹', country: '이탈리아' },
  { id: 'amsterdam', name: '암스테르담',flag: '🇳🇱', country: '네덜란드' },
];

// BFS 경로 탐색
function findPath(stationMap, connMap, fromId, toId) {
  if (fromId === toId) return [fromId];
  const visited = new Set([fromId]);
  const queue = [[fromId, [fromId]]];
  while (queue.length > 0) {
    const [cur, path] = queue.shift();
    const neighbors = connMap[cur] || [];
    for (const { toId: next, lineId, travelTime, isTransfer } of neighbors) {
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

export default function Transit() {
  const [selectedCity, setSelectedCity] = useState('seoul');
  const [stations, setStations] = useState([]);
  const [lines, setLines] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fromStation, setFromStation] = useState(null);
  const [toStation, setToStation] = useState(null);
  const [selectingFor, setSelectingFor] = useState(null); // 'from' | 'to'
  const [searchQuery, setSearchQuery] = useState('');
  const [pathResult, setPathResult] = useState(null);
  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'map'

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
        fetch(`/api/transit/stations?city=${cityId}`),
        fetch(`/api/transit/lines?city=${cityId}`),
        fetch(`/api/transit/connections?city=${cityId}`),
      ]);
      const [st, ln, cn] = await Promise.all([stRes.json(), lnRes.json(), cnRes.json()]);
      setStations(st || []);
      setLines(ln || []);
      setConnections(cn || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // 연결 맵 생성
  const connMap = {};
  connections.forEach(c => {
    if (!connMap[c.fromStationId]) connMap[c.fromStationId] = [];
    connMap[c.fromStationId].push(c);
  });

  const stationMap = {};
  stations.forEach(s => { stationMap[s.id] = s; });

  // 경로 탐색
  useEffect(() => {
    if (fromStation && toStation) {
      const path = findPath(stationMap, connMap, fromStation.id, toStation.id);
      if (path) {
        // 경로 정보 구성
        const pathStations = path.map(id => stationMap[id]).filter(Boolean);
        // 노선별 구간 분석
        const segments = [];
        let curLine = null;
        let curSegment = [];
        for (let i = 0; i < path.length - 1; i++) {
          const conn = (connMap[path[i]] || []).find(c => c.toId === path[i+1] || c.toStationId === path[i+1]);
          const lineId = conn?.lineId || conn?.line_id || 'transfer';
          if (lineId !== curLine) {
            if (curSegment.length > 0) segments.push({ lineId: curLine, stations: curSegment });
            curLine = lineId;
            curSegment = [path[i]];
          }
          curSegment.push(path[i+1]);
        }
        if (curSegment.length > 0) segments.push({ lineId: curLine, stations: curSegment });

        const totalTime = path.length * 2;
        setPathResult({ path: pathStations, segments, totalTime, transfers: segments.length - 1 });
      } else {
        setPathResult({ notFound: true });
      }
    }
  }, [fromStation, toStation, stations, connections]);

  const filteredStations = stations.filter(s =>
    s.nameKo?.includes(searchQuery) || s.nameEn?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getLineColor = (lineId) => {
    const line = lines.find(l => l.id === lineId);
    return line?.color || '#888';
  };

  const getLineName = (lineId) => {
    if (lineId === 'transfer') return '환승';
    const line = lines.find(l => l.id === lineId);
    return line?.nameKo || lineId;
  };

  const city = CITIES.find(c => c.id === selectedCity);

  const S = {
    wrap: { maxWidth: 680, margin: '0 auto', padding: '0 0 80px' },
    cityTabs: { display: 'flex', gap: 8, overflowX: 'auto', padding: '16px 16px 0', scrollbarWidth: 'none' },
    cityBtn: (active) => ({
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
      padding: '8px 14px', borderRadius: 20, border: `1.5px solid ${active ? '#FF5A5F' : '#eee'}`,
      background: active ? '#fff5f5' : 'white', color: active ? '#FF5A5F' : '#6b7280',
      fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer', transition: 'all 0.1s',
      whiteSpace: 'nowrap',
    }),
    tabBar: { display: 'flex', borderBottom: '1px solid #f0f0f0', margin: '12px 16px 0' },
    tab: (active) => ({
      flex: 1, padding: '10px 0', textAlign: 'center', fontSize: 13, fontWeight: active ? 700 : 500,
      color: active ? '#FF5A5F' : '#9ca3af', borderBottom: active ? '2px solid #FF5A5F' : '2px solid transparent',
      cursor: 'pointer', transition: 'all 0.1s',
    }),
    card: { background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', margin: '12px 16px', padding: 16 },
    stationBtn: (selected) => ({
      flex: 1, padding: '12px 14px', borderRadius: 12,
      background: selected ? '#fff5f5' : '#f9fafb',
      border: `1.5px solid ${selected ? '#FF5A5F' : '#e5e7eb'}`,
      color: selected ? '#FF5A5F' : '#374151',
      fontSize: 13, fontWeight: selected ? 700 : 500, cursor: 'pointer',
      textAlign: 'left', transition: 'all 0.1s',
    }),
    input: {
      width: '100%', padding: '11px 14px', borderRadius: 12,
      border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none',
      background: '#f9fafb', color: '#1a1a2e', boxSizing: 'border-box',
    },
    stationItem: (selected) => ({
      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
      borderBottom: '1px solid #f9fafb', cursor: 'pointer',
      background: selected ? '#fff5f5' : 'white',
      transition: 'background 0.1s',
    }),
    lineBadge: (color, textColor = 'white') => ({
      display: 'inline-block', padding: '2px 8px', borderRadius: 10,
      background: color, color: textColor, fontSize: 11, fontWeight: 700,
    }),
    pathSegment: (color) => ({
      borderLeft: `4px solid ${color}`, paddingLeft: 12, marginLeft: 8,
      paddingTop: 4, paddingBottom: 4,
    }),
  };

  return (
    <div style={S.wrap}>
      {/* 도시 선택 */}
      <div style={S.cityTabs}>
        {CITIES.map(c => (
          <button key={c.id} style={S.cityBtn(selectedCity === c.id)}
            onClick={() => setSelectedCity(c.id)}>
            <span style={{ fontSize: 16 }}>{c.flag}</span>
            {c.name}
          </button>
        ))}
      </div>

      {/* 탭 */}
      <div style={S.tabBar}>
        <div style={S.tab(activeTab === 'search')} onClick={() => setActiveTab('search')}>🔍 경로 찾기</div>
        <div style={S.tab(activeTab === 'lines')} onClick={() => setActiveTab('lines')}>🚇 노선 보기</div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>불러오는 중...</div>
      ) : (
        <>
          {activeTab === 'search' && (
            <>
              {/* 출발/도착 선택 */}
              <div style={S.card}>
                <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10, fontWeight: 600 }}>
                  {city?.flag} {city?.name} 지하철 경로 찾기
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <button style={S.stationBtn(!!fromStation)}
                    onClick={() => { setSelectingFor('from'); setSearchQuery(''); }}>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>출발역</div>
                    <div>{fromStation ? fromStation.nameKo : '역 선택'}</div>
                  </button>
                  <button style={{ padding: '12px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#FF5A5F' }}
                    onClick={() => {
                      const tmp = fromStation;
                      setFromStation(toStation);
                      setToStation(tmp);
                    }}>⇄</button>
                  <button style={S.stationBtn(!!toStation)}
                    onClick={() => { setSelectingFor('to'); setSearchQuery(''); }}>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>도착역</div>
                    <div>{toStation ? toStation.nameKo : '역 선택'}</div>
                  </button>
                </div>

                {/* 역 검색 */}
                {selectingFor && (
                  <div>
                    <input
                      style={S.input}
                      placeholder={`${selectingFor === 'from' ? '출발' : '도착'}역 검색...`}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                    <div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 8, borderRadius: 12, border: '1px solid #f0f0f0' }}>
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
                              setSelectingFor(null);
                              setSearchQuery('');
                            }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{s.nameKo}</div>
                              <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.nameEn}</div>
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
                        <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                          검색 결과가 없어요
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 경로 결과 */}
              {pathResult && !selectingFor && (
                <div style={S.card}>
                  {pathResult.notFound ? (
                    <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>😢</div>
                      경로를 찾을 수 없어요
                    </div>
                  ) : (
                    <>
                      {/* 요약 */}
                      <div style={{ display: 'flex', gap: 12, marginBottom: 16, padding: 12, background: '#fff5f5', borderRadius: 12 }}>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#FF5A5F' }}>
                            {pathResult.totalTime}분
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>예상 소요시간</div>
                        </div>
                        <div style={{ width: 1, background: '#f0f0f0' }} />
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#FF5A5F' }}>
                            {pathResult.path.length - 1}
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>정거장</div>
                        </div>
                        <div style={{ width: 1, background: '#f0f0f0' }} />
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#FF5A5F' }}>
                            {Math.max(0, pathResult.transfers)}
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>환승</div>
                        </div>
                      </div>

                      {/* 세그먼트별 경로 */}
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>상세 경로</div>
                      {pathResult.segments.map((seg, si) => {
                        const color = getLineColor(seg.lineId);
                        const lineName = getLineName(seg.lineId);
                        const firstStation = stationMap[seg.stations[0]];
                        const lastStation = stationMap[seg.stations[seg.stations.length - 1]];
                        return (
                          <div key={si} style={{ marginBottom: 16 }}>
                            {/* 노선 배지 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <span style={S.lineBadge(color)}>{lineName}</span>
                              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                                {seg.stations.length - 1}정거장
                              </span>
                            </div>
                            {/* 역 목록 */}
                            <div style={S.pathSegment(color)}>
                              {seg.stations.map((id, idx) => {
                                const st = stationMap[id];
                                const isFirst = idx === 0;
                                const isLast = idx === seg.stations.length - 1;
                                if (!st) return null;
                                return (
                                  <div key={id} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '4px 0', opacity: (!isFirst && !isLast && seg.stations.length > 3) ? 0.5 : 1
                                  }}>
                                    <div style={{
                                      width: 8, height: 8, borderRadius: '50%',
                                      background: (isFirst || isLast) ? color : '#ddd',
                                      border: `2px solid ${color}`, flexShrink: 0
                                    }} />
                                    <div>
                                      <span style={{ fontSize: 13, fontWeight: (isFirst || isLast) ? 700 : 400, color: '#1a1a2e' }}>
                                        {st.nameKo}
                                      </span>
                                      {(isFirst || isLast) && (
                                        <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>{st.nameEn}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {/* 환승 안내 */}
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

              {/* 안내 */}
              {!fromStation && !toStation && !selectingFor && (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: '#9ca3af' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🚇</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>출발역과 도착역을 선택하세요</div>
                  <div style={{ fontSize: 12 }}>지하철 경로와 소요시간을 알려드릴게요</div>
                </div>
              )}
            </>
          )}

          {activeTab === 'lines' && (
            <div style={{ padding: '12px 16px' }}>
              {lines.map(line => {
                const lineStations = stations.filter(s =>
                  connections.some(c =>
                    (c.fromStationId === s.id || c.toStationId === s.id) && c.lineId === line.id
                  )
                );
                return (
                  <div key={line.id} style={{ ...S.card, margin: '0 0 12px', padding: 0, overflow: 'hidden' }}>
                    {/* 노선 헤더 */}
                    <div style={{ background: line.color, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: 'white' }}>
                        {line.nameKo.slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{line.nameKo}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{line.nameEn} · {lineStations.length}역</div>
                      </div>
                    </div>
                    {/* 역 목록 */}
                    <div style={{ padding: '8px 0' }}>
                      {lineStations.slice(0, 5).map((s, i) => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: line.color, flexShrink: 0 }} />
                          <div style={{ fontSize: 13, color: '#374151' }}>{s.nameKo}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.nameEn}</div>
                        </div>
                      ))}
                      {lineStations.length > 5 && (
                        <div style={{ padding: '4px 16px 8px', fontSize: 12, color: '#9ca3af' }}>
                          +{lineStations.length - 5}개 역 더 있음
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
