import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';

const API_BASE = 'https://travel.spagenio.com';

const CITIES = [
  { name: '서울', id: 'seoul', flag: '🇰🇷' },
  { name: '도쿄', id: 'tokyo', flag: '🇯🇵' },
  { name: '오사카', id: 'osaka', flag: '🇯🇵' },
  { name: '방콕', id: 'bangkok', flag: '🇹🇭' },
  { name: '싱가포르', id: 'singapore', flag: '🇸🇬' },
  { name: '홍콩', id: 'hongkong', flag: '🇭🇰' },
  { name: '파리', id: 'paris', flag: '🇫🇷' },
  { name: '런던', id: 'london', flag: '🇬🇧' },
  { name: '뉴욕', id: 'newyork', flag: '🇺🇸' },
  { name: '바르셀로나', id: 'barcelona', flag: '🇪🇸' },
];

export default function TransitScreen() {
  const [selectedCity, setSelectedCity] = useState(null);
  const [lines, setLines] = useState([]);
  const [stations, setStations] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedLine, setExpandedLine] = useState(null);
  const [tab, setTab] = useState('lines');
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [routeResult, setRouteResult] = useState(null);
  const [searching, setSearching] = useState(false);

  const loadCity = async (city) => {
    setSelectedCity(city);
    setLoading(true);
    setLines([]);
    setStations([]);
    setConnections([]);
    setExpandedLine(null);
    setRouteResult(null);
    try {
      const [lRes, sRes, cRes] = await Promise.all([
        fetch(API_BASE + '/api/transit/lines?city=' + city.id),
        fetch(API_BASE + '/api/transit/stations?city=' + city.id),
        fetch(API_BASE + '/api/transit/connections?city=' + city.id),
      ]);
      if (lRes.ok) setLines(await lRes.json());
      if (sRes.ok) setStations(await sRes.json());
      if (cRes.ok) setConnections(await cRes.json());
    } catch (e) {}
    setLoading(false);
  };

  const getLineStations = (lineId) => {
    const lineConns = connections.filter(c => c.lineId === lineId);
    const stationIds = new Set();
    lineConns.forEach(c => { stationIds.add(c.fromStationId); stationIds.add(c.toStationId); });
    const stationMap = {};
    stations.forEach(s => { stationMap[s.id] = s; });
    return [...stationIds]
      .sort((a, b) => {
        const numA = parseInt(a.split('_').pop()) || 0;
        const numB = parseInt(b.split('_').pop()) || 0;
        return numA - numB;
      })
      .map(id => stationMap[id])
      .filter(Boolean);
  };

  const searchRoute = () => {
    if (!fromText.trim() || !toText.trim()) return;
    setSearching(true);
    setRouteResult(null);

    const stationMap = {};
    stations.forEach(s => { stationMap[s.id] = s; });
    const lineMap = {};
    lines.forEach(l => { lineMap[l.id] = l; });

    const fromStation = stations.find(s =>
      (s.nameKo || '').includes(fromText) || (s.nameEn || '').toLowerCase().includes(fromText.toLowerCase())
    );
    const toStation = stations.find(s =>
      (s.nameKo || '').includes(toText) || (s.nameEn || '').toLowerCase().includes(toText.toLowerCase())
    );

    if (!fromStation || !toStation) {
      setRouteResult({ error: true, message: '역을 찾을 수 없어요.' });
      setSearching(false);
      return;
    }

    // BFS with line tracking
    const queue = [{ stationId: fromStation.id, path: [{ stationId: fromStation.id, lineId: null }] }];
    const visited = new Set([fromStation.id]);
    let found = null;

    while (queue.length > 0 && !found) {
      const { stationId, path } = queue.shift();
      if (stationId === toStation.id) { found = path; break; }

      const neighbors = connections.filter(c => c.fromStationId === stationId && !c.isTransfer);
      for (const n of neighbors) {
        if (!visited.has(n.toStationId)) {
          visited.add(n.toStationId);
          queue.push({
            stationId: n.toStationId,
            path: [...path, { stationId: n.toStationId, lineId: n.lineId }],
          });
        }
      }
      // Also check transfer connections
      const transfers = connections.filter(c => c.fromStationId === stationId && c.isTransfer);
      for (const t of transfers) {
        if (!visited.has(t.toStationId)) {
          visited.add(t.toStationId);
          queue.push({
            stationId: t.toStationId,
            path: [...path, { stationId: t.toStationId, lineId: t.lineId, isTransfer: true }],
          });
        }
      }
    }

    if (found) {
      // Build segments grouped by line
      const segments = [];
      let currentSeg = null;
      for (let i = 0; i < found.length; i++) {
        const step = found[i];
        const station = stationMap[step.stationId];
        if (i === 0) {
          currentSeg = { lineId: found[1]?.lineId, stations: [station] };
          continue;
        }
        if (step.isTransfer || (currentSeg && step.lineId !== currentSeg.lineId)) {
          segments.push(currentSeg);
          if (step.isTransfer) {
            segments.push({ isTransfer: true, station: stationMap[found[i - 1]?.stationId] });
          }
          currentSeg = { lineId: step.lineId, stations: [station] };
        } else {
          currentSeg.stations.push(station);
        }
      }
      if (currentSeg) segments.push(currentSeg);

      let totalTime = 0;
      let transfers = 0;
      for (let i = 1; i < found.length; i++) {
        const conn = connections.find(c =>
          c.fromStationId === found[i - 1].stationId && c.toStationId === found[i].stationId
        );
        if (conn) totalTime += conn.travelTime || 2;
        if (found[i].isTransfer) transfers++;
      }

      setRouteResult({
        from: stationMap[fromStation.id],
        to: stationMap[toStation.id],
        totalTime,
        transfers,
        totalStops: found.length,
        segments,
        lineMap,
      });
    } else {
      setRouteResult({ error: true, message: '경로를 찾을 수 없어요.' });
    }
    setSearching(false);
  };

  const getLineColor = (lineId) => {
    const line = lines.find(l => l.id === lineId);
    return line?.color || '#6b7280';
  };

  const getLineName = (lineId) => {
    const line = lines.find(l => l.id === lineId);
    return line?.nameKo || lineId;
  };

  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <Text style={S.title}>🚇 교통</Text>
      </View>

      <ScrollView contentContainerStyle={S.content} showsVerticalScrollIndicator={false}>
        {/* 도시 선택 */}
        <View style={S.citySection}>
          <View style={S.cityGrid}>
            {CITIES.map(city => (
              <TouchableOpacity key={city.id} style={[S.cityBtn, selectedCity?.id === city.id && S.cityBtnActive]}
                onPress={() => loadCity(city)}>
                <Text style={S.cityFlag}>{city.flag}</Text>
                <Text style={[S.cityName, selectedCity?.id === city.id && S.cityNameActive]}>{city.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {loading && <ActivityIndicator color="#FF5A5F" size="large" style={{ marginTop: 20 }} />}

        {selectedCity && !loading && (
          <>
            {/* 탭 */}
            <View style={S.tabs}>
              <TouchableOpacity style={[S.tabBtn, tab === 'search' && S.tabBtnActive]}
                onPress={() => setTab('search')}>
                <Text style={[S.tabText, tab === 'search' && S.tabTextActive]}>🔍 경로 찾기</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.tabBtn, tab === 'lines' && S.tabBtnActive]}
                onPress={() => setTab('lines')}>
                <Text style={[S.tabText, tab === 'lines' && S.tabTextActive]}>🚇 노선별</Text>
              </TouchableOpacity>
            </View>

            {/* 경로 검색 */}
            {tab === 'search' && (
              <View style={S.searchCard}>
                <View style={S.searchRow}>
                  <View style={S.inputWrap}>
                    <Text style={S.inputLabel}>출발</Text>
                    <TextInput style={S.searchInput} placeholder="출발역"
                      placeholderTextColor="#9ca3af" value={fromText} onChangeText={setFromText} />
                  </View>
                  <Text style={S.arrowIcon}>→</Text>
                  <View style={S.inputWrap}>
                    <Text style={S.inputLabel}>도착</Text>
                    <TextInput style={S.searchInput} placeholder="도착역"
                      placeholderTextColor="#9ca3af" value={toText} onChangeText={setToText} />
                  </View>
                </View>
                <TouchableOpacity style={S.searchBtn} onPress={searchRoute}
                  disabled={!fromText.trim() || !toText.trim() || searching}>
                  {searching
                    ? <ActivityIndicator color="white" />
                    : <Text style={S.searchBtnText}>경로 검색</Text>
                  }
                </TouchableOpacity>

                {routeResult && (
                  <View style={S.routeResult}>
                    {routeResult.error ? (
                      <Text style={S.errorText}>{routeResult.message}</Text>
                    ) : (
                      <>
                        <View style={S.routeSummary}>
                          <View style={S.summaryTag}>
                            <Text style={S.summaryTagText}>⏱ {routeResult.totalTime}분</Text>
                          </View>
                          <View style={S.summaryTag}>
                            <Text style={S.summaryTagText}>🔄 환승 {routeResult.transfers}회</Text>
                          </View>
                          <View style={S.summaryTag}>
                            <Text style={S.summaryTagText}>🚉 {routeResult.totalStops}정거장</Text>
                          </View>
                        </View>

                        <Text style={S.routeTitle}>상세 경로</Text>
                        {routeResult.segments.map((seg, i) => {
                          if (seg.isTransfer) {
                            return (
                              <View key={'t' + i} style={S.transferRow}>
                                <Text style={S.transferText}>🔄 환승</Text>
                              </View>
                            );
                          }
                          const color = getLineColor(seg.lineId);
                          return (
                            <View key={i} style={S.segmentWrap}>
                              <View style={S.segmentHeader}>
                                <View style={[S.segLineBadge, { backgroundColor: color }]}>
                                  <Text style={S.segLineName}>{getLineName(seg.lineId)}</Text>
                                </View>
                                <Text style={S.segStopCount}>{seg.stations?.length || 0}정거장</Text>
                              </View>
                              <View style={S.segStations}>
                                {seg.stations?.map((st, j) => (
                                  <View key={j} style={S.segStationRow}>
                                    <View style={[S.segDot, { backgroundColor: color }]} />
                                    {j < seg.stations.length - 1 && (
                                      <View style={[S.segLine, { backgroundColor: color }]} />
                                    )}
                                    <Text style={[S.segStationName,
                                      (j === 0 || j === seg.stations.length - 1) && S.segStationBold
                                    ]}>
                                      {st?.nameKo || st?.name}
                                    </Text>
                                    {st?.isTransfer === 1 && <Text style={S.transferBadge}>환승</Text>}
                                  </View>
                                ))}
                              </View>
                            </View>
                          );
                        })}
                      </>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* 노선별 */}
            {tab === 'lines' && (
              <View style={S.lineSection}>
                <Text style={S.sectionTitle}>{selectedCity.flag} {selectedCity.name} 노선 ({lines.length}개)</Text>
                {lines.map((line, i) => {
                  const lineId = line.id;
                  const lineStations = getLineStations(lineId);
                  const isOpen = expandedLine === lineId;
                  const color = line.color || '#6b7280';
                  return (
                    <View key={i}>
                      <TouchableOpacity style={[S.lineCard, { borderLeftWidth: 4, borderLeftColor: color }]}
                        onPress={() => setExpandedLine(isOpen ? null : lineId)}>
                        <View style={{ flex: 1 }}>
                          <Text style={S.lineName}>{line.nameKo || line.name}</Text>
                          <Text style={S.lineStationsText}>{lineStations.length}개 역</Text>
                        </View>
                        <Text style={{ fontSize: 16, color: '#9ca3af' }}>{isOpen ? '▲' : '▼'}</Text>
                      </TouchableOpacity>
                      {isOpen && lineStations.length > 0 && (
                        <View style={S.stationList}>
                          {lineStations.map((st, j) => (
                            <View key={j} style={S.stationItem}>
                              <View style={[S.stationDot, { backgroundColor: color }]} />
                              {j < lineStations.length - 1 && (
                                <View style={[S.stationLine, { backgroundColor: color }]} />
                              )}
                              <Text style={S.stationName}>{st.nameKo || st.name}</Text>
                              {st.isTransfer === 1 && (
                                <Text style={S.transferBadge}>환승</Text>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  header: { backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 20, fontWeight: '900', color: '#1a1a2e' },
  content: { padding: 16, gap: 12, paddingBottom: 30 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a2e', marginBottom: 12 },
  citySection: { backgroundColor: 'white', borderRadius: 16, padding: 16 },
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cityBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f3f4f6', flexDirection: 'row', alignItems: 'center', gap: 6 },
  cityBtnActive: { backgroundColor: '#fff5f5', borderWidth: 1.5, borderColor: '#FF5A5F' },
  cityFlag: { fontSize: 18 },
  cityName: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  cityNameActive: { color: '#FF5A5F', fontWeight: '700' },
  tabs: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#fff5f5' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  tabTextActive: { color: '#FF5A5F', fontWeight: '700' },
  searchCard: { backgroundColor: 'white', borderRadius: 16, padding: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputWrap: { flex: 1 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#FF5A5F', marginBottom: 4 },
  searchInput: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 12, fontSize: 14, color: '#1a1a2e' },
  arrowIcon: { fontSize: 18, color: '#FF5A5F', fontWeight: '700', marginTop: 16 },
  searchBtn: { backgroundColor: '#FF5A5F', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  searchBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
  routeResult: { marginTop: 16 },
  routeSummary: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryTag: { backgroundColor: '#fff5f5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  summaryTagText: { fontSize: 12, fontWeight: '700', color: '#FF5A5F' },
  routeTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a2e', marginBottom: 12 },
  segmentWrap: { marginBottom: 12 },
  segmentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  segLineBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  segLineName: { fontSize: 12, fontWeight: '800', color: 'white' },
  segStopCount: { fontSize: 11, color: '#9ca3af' },
  segStations: { paddingLeft: 8 },
  segStationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, position: 'relative' },
  segDot: { width: 10, height: 10, borderRadius: 5, zIndex: 1 },
  segLine: { position: 'absolute', left: 4, top: 14, width: 2, height: 20 },
  segStationName: { fontSize: 13, color: '#6b7280' },
  segStationBold: { fontWeight: '700', color: '#1a1a2e' },
  transferRow: { paddingVertical: 8, paddingLeft: 8, marginBottom: 4 },
  transferText: { fontSize: 12, color: '#FF5A5F', fontWeight: '700' },
  errorText: { fontSize: 13, color: '#ef4444', textAlign: 'center', paddingVertical: 16 },
  lineSection: { backgroundColor: 'white', borderRadius: 16, padding: 16 },
  lineCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  lineName: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  lineStationsText: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  stationList: { paddingLeft: 24, paddingBottom: 12 },
  stationItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, position: 'relative' },
  stationDot: { width: 10, height: 10, borderRadius: 5, zIndex: 1 },
  stationLine: { position: 'absolute', left: 4, top: 15, width: 2, height: 20 },
  stationName: { fontSize: 13, color: '#374151' },
  transferBadge: { fontSize: 10, color: '#FF5A5F', fontWeight: '700', backgroundColor: '#fff5f5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
});
