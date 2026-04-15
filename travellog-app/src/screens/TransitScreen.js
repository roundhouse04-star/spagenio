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
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const loadCity = async (city) => {
    setSelectedCity(city);
    setLoading(true);
    setLines([]);
    setStations([]);
    setConnections([]);
    setExpandedLine(null);
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
    lineConns.forEach(c => {
      stationIds.add(c.fromStationId);
      stationIds.add(c.toStationId);
    });

    // Build order by following the chain
    const ordered = [];
    const visited = new Set();
    // Find start station (appears in from but not in to within this line, or first)
    const fromIds = new Set(lineConns.map(c => c.fromStationId));
    const toIds = new Set(lineConns.map(c => c.toStationId));
    let startId = null;
    for (const fid of fromIds) {
      if (!toIds.has(fid)) { startId = fid; break; }
    }
    if (!startId && fromIds.size > 0) startId = [...fromIds][0];

    if (startId) {
      let current = startId;
      while (current && !visited.has(current)) {
        visited.add(current);
        ordered.push(current);
        const next = lineConns.find(c => c.fromStationId === current && !visited.has(c.toStationId));
        current = next ? next.toStationId : null;
      }
    }

    // Map to station objects
    const stationMap = {};
    stations.forEach(s => { stationMap[s.id] = s; });
    return ordered.map(id => stationMap[id]).filter(Boolean);
  };

  const searchRoute = async () => {
    if (!fromText.trim() || !toText.trim() || !selectedCity) return;
    setSearching(true);
    setSearchResults([]);

    // Find matching stations by name
    const fromStation = stations.find(s =>
      (s.nameKo || '').includes(fromText) || (s.nameEn || '').toLowerCase().includes(fromText.toLowerCase())
    );
    const toStation = stations.find(s =>
      (s.nameKo || '').includes(toText) || (s.nameEn || '').toLowerCase().includes(toText.toLowerCase())
    );

    if (!fromStation || !toStation) {
      setSearchResults([{ error: true, message: '역을 찾을 수 없어요. 정확한 역 이름을 입력해주세요.' }]);
      setSearching(false);
      return;
    }

    // Simple BFS path finding
    const queue = [[fromStation.id]];
    const visitedStations = new Set([fromStation.id]);
    let found = null;

    while (queue.length > 0 && !found) {
      const path = queue.shift();
      const current = path[path.length - 1];
      if (current === toStation.id) { found = path; break; }

      const neighbors = connections
        .filter(c => c.fromStationId === current)
        .map(c => ({ stationId: c.toStationId, lineId: c.lineId, time: c.travelTime }));

      for (const n of neighbors) {
        if (!visitedStations.has(n.stationId)) {
          visitedStations.add(n.stationId);
          queue.push([...path, n.stationId]);
        }
      }
    }

    if (found) {
      const stationMap = {};
      stations.forEach(s => { stationMap[s.id] = s; });
      const lineMap = {};
      lines.forEach(l => { lineMap[l.id] = l; });

      let totalTime = 0;
      let transfers = 0;
      let prevLineId = null;
      const segments = [];

      for (let i = 0; i < found.length - 1; i++) {
        const conn = connections.find(c => c.fromStationId === found[i] && c.toStationId === found[i + 1]);
        if (conn) {
          totalTime += conn.travelTime || 2;
          if (prevLineId && prevLineId !== conn.lineId) transfers++;
          prevLineId = conn.lineId;
        }
      }

      setSearchResults([{
        from: stationMap[found[0]]?.nameKo || found[0],
        to: stationMap[found[found.length - 1]]?.nameKo || found[found.length - 1],
        totalTime,
        transfers,
        stops: found.length,
      }]);
    } else {
      setSearchResults([{ error: true, message: '경로를 찾을 수 없어요.' }]);
    }
    setSearching(false);
  };

  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <Text style={S.title}>🚇 교통</Text>
      </View>

      <ScrollView contentContainerStyle={S.content} showsVerticalScrollIndicator={false}>
        {/* 도시 선택 */}
        <View style={S.citySection}>
          <Text style={S.sectionTitle}>🌍 도시 선택</Text>
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
                  <Text style={S.arrow}>→</Text>
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

                {searchResults.map((r, i) => (
                  <View key={i} style={S.resultCard}>
                    {r.error ? (
                      <Text style={S.errorText}>{r.message}</Text>
                    ) : (
                      <>
                        <View style={S.resultHeader}>
                          <Text style={S.resultRoute}>{r.from} → {r.to}</Text>
                        </View>
                        <View style={S.resultMeta}>
                          <View style={S.resultTag}>
                            <Text style={S.resultTagText}>⏱ {r.totalTime}분</Text>
                          </View>
                          <View style={S.resultTag}>
                            <Text style={S.resultTagText}>🔄 환승 {r.transfers}회</Text>
                          </View>
                          <View style={S.resultTag}>
                            <Text style={S.resultTagText}>🚉 {r.stops}개 역</Text>
                          </View>
                        </View>
                      </>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* 노선별 */}
            {tab === 'lines' && (
              <View style={S.lineSection}>
                <Text style={S.sectionTitle}>{selectedCity.flag} {selectedCity.name} 노선 ({lines.length}개)</Text>
                {lines.map((line, i) => {
                  const lineId = line.id || line.lineId;
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
  content: { padding: 16, gap: 16, paddingBottom: 30 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a2e', marginBottom: 12 },
  citySection: { backgroundColor: 'white', borderRadius: 16, padding: 16 },
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cityBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f3f4f6', flexDirection: 'row', alignItems: 'center', gap: 6 },
  cityBtnActive: { backgroundColor: '#fff5f5', borderWidth: 1.5, borderColor: '#FF5A5F' },
  cityFlag: { fontSize: 18 },
  cityName: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  cityNameActive: { color: '#FF5A5F', fontWeight: '700' },

  // 탭
  tabs: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#fff5f5' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  tabTextActive: { color: '#FF5A5F', fontWeight: '700' },

  // 경로 검색
  searchCard: { backgroundColor: 'white', borderRadius: 16, padding: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputWrap: { flex: 1 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#FF5A5F', marginBottom: 4 },
  searchInput: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 12, fontSize: 14, color: '#1a1a2e' },
  arrow: { fontSize: 18, color: '#FF5A5F', fontWeight: '700', marginTop: 16 },
  searchBtn: { backgroundColor: '#FF5A5F', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  searchBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
  resultCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 14, marginTop: 12 },
  resultHeader: { marginBottom: 8 },
  resultRoute: { fontSize: 15, fontWeight: '800', color: '#1a1a2e' },
  resultMeta: { flexDirection: 'row', gap: 8 },
  resultTag: { backgroundColor: '#fff5f5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  resultTagText: { fontSize: 12, fontWeight: '700', color: '#FF5A5F' },
  errorText: { fontSize: 13, color: '#ef4444', textAlign: 'center' },

  // 노선
  lineSection: { backgroundColor: 'white', borderRadius: 16, padding: 16 },
  lineCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  lineName: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  lineStationsText: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  stationList: { paddingLeft: 24, paddingBottom: 12 },
  stationItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, position: 'relative' },
  stationDot: { width: 10, height: 10, borderRadius: 5, zIndex: 1 },
  stationLine: { position: 'absolute', left: 4, top: 16, width: 2, height: 24 },
  stationName: { fontSize: 13, color: '#374151' },
  transferBadge: { fontSize: 10, color: '#FF5A5F', fontWeight: '700', backgroundColor: '#fff5f5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
});
