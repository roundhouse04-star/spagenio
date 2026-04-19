import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';

const API_BASE = 'https://travel.spagenio.com';

const CITIES = [
  { name: 'Seoul', id: 'seoul', flag: '🇰🇷' },
  { name: 'Tokyo', id: 'tokyo', flag: '🇯🇵' },
  { name: 'Osaka', id: 'osaka', flag: '🇯🇵' },
  { name: 'Bangkok', id: 'bangkok', flag: '🇹🇭' },
  { name: 'Singapore', id: 'singapore', flag: '🇸🇬' },
  { name: 'Hong Kong', id: 'hongkong', flag: '🇭🇰' },
  { name: 'Paris', id: 'paris', flag: '🇫🇷' },
  { name: 'London', id: 'london', flag: '🇬🇧' },
  { name: 'New York', id: 'newyork', flag: '🇺🇸' },
  { name: 'Barcelona', id: 'barcelona', flag: '🇪🇸' },
];

export default function TransitScreen() {
  const [selectedCity, setSelectedCity] = useState(null);
  const [lines, setLines] = useState([]);
  const [stations, setStations] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedLine, setExpandedLine] = useState(null);
  const [tab, setTab] = useState('route');
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
    console.log('[TRANSIT] stations:', stations.length, 'connections:', connections.length, 'lines:', lines.length);
    console.log('[TRANSIT] from:', fromText, 'to:', toText);
    if (stations.length > 0) console.log('[TRANSIT] first station:', JSON.stringify(stations[0]));
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
      setRouteResult({ error: 'STATION NOT FOUND' });
      setSearching(false);
      return;
    }

    const graph = {};
    connections.forEach(c => {
      if (!graph[c.fromStationId]) graph[c.fromStationId] = [];
      if (!graph[c.toStationId]) graph[c.toStationId] = [];
      graph[c.fromStationId].push({ to: c.toStationId, lineId: c.lineId, time: c.travelTime || 2 });
      graph[c.toStationId].push({ to: c.fromStationId, lineId: c.lineId, time: c.travelTime || 2 });
    });

    const distances = { [fromStation.id]: 0 };
    const prev = {};
    const visited = new Set();
    const pq = [{ station: fromStation.id, dist: 0 }];
    let iterations = 0;

    while (pq.length > 0 && iterations++ < 100000) {
      pq.sort((a, b) => a.dist - b.dist);
      const current = pq.shift();
      if (visited.has(current.station)) continue;
      visited.add(current.station);
      if (current.station === toStation.id) break;
      (graph[current.station] || []).forEach(neighbor => {
        if (visited.has(neighbor.to)) return;
        const newDist = current.dist + neighbor.time;
        if (distances[neighbor.to] === undefined || newDist < distances[neighbor.to]) {
          distances[neighbor.to] = newDist;
          prev[neighbor.to] = { from: current.station, lineId: neighbor.lineId };
          pq.push({ station: neighbor.to, dist: newDist });
        }
      });
    }
    console.log('[TRANSIT] dijkstra iterations:', iterations, 'visited:', visited.size);

    if (distances[toStation.id] === undefined) {
      setRouteResult({ error: 'NO ROUTE FOUND' });
      setSearching(false);
      return;
    }

    const path = [];
    let curr = toStation.id;
    while (curr) {
      path.unshift({ stationId: curr, ...(prev[curr] || {}) });
      curr = prev[curr]?.from;
    }

    // 세그먼트 생성 (라인이 바뀌면 새 세그먼트)
    const segments = [];
    let curLineId = null;
    let curSegment = [];
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      if (i === 0) {
        // 시작점 - 다음 연결의 lineId로 시작
        curLineId = path[1]?.lineId || null;
        curSegment = [p.stationId];
      } else {
        const lineId = p.lineId;
        if (lineId !== curLineId) {
          // 라인 변경 -> 세그먼트 분리
          if (curSegment.length > 0) {
            segments.push({ lineId: curLineId, stations: curSegment });
          }
          curLineId = lineId;
          curSegment = [path[i - 1].stationId, p.stationId];
        } else {
          curSegment.push(p.stationId);
        }
      }
    }
    if (curSegment.length > 0) segments.push({ lineId: curLineId, stations: curSegment });

    setRouteResult({
      totalTime: distances[toStation.id],
      path,
      segments,
      stationMap,
      lineMap,
      from: fromStation,
      to: toStation,
      transfers: Math.max(0, segments.length - 1),
    });
    setSearching(false);
  };

  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <Text style={S.title}>Transit</Text>
        <Text style={S.subtitle}>METRO · SUBWAY</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, maxHeight: 70 }}
        contentContainerStyle={S.cities}>
        {CITIES.map(city => (
          <TouchableOpacity key={city.id}
            style={[S.cityBtn, selectedCity?.id === city.id && S.cityBtnActive]}
            onPress={() => loadCity(city)}>
            <Text style={{ fontSize: 16 }}>{city.flag}</Text>
            <Text style={[S.cityText, selectedCity?.id === city.id && S.cityTextActive]}>
              {city.name.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {!selectedCity ? (
        <View style={S.empty}>
          <Text style={S.emptyTitle}>SELECT A CITY</Text>
          <Text style={S.emptyDesc}>CHOOSE YOUR DESTINATION</Text>
        </View>
      ) : loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <>
          <View style={S.tabs}>
            <TouchableOpacity style={[S.tab, tab === 'route' && S.tabActive]} onPress={() => setTab('route')}>
              <Text style={[S.tabText, tab === 'route' && S.tabTextActive]}>ROUTE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.tab, tab === 'lines' && S.tabActive]} onPress={() => setTab('lines')}>
              <Text style={[S.tabText, tab === 'lines' && S.tabTextActive]}>LINES</Text>
            </TouchableOpacity>
          </View>

          {tab === 'route' && (
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={S.sectionLabel}>{selectedCity.name.toUpperCase()} · FIND ROUTE</Text>
              <View style={{ gap: 12, marginTop: 14 }}>
                <View>
                  <Text style={S.fieldLabel}>FROM</Text>
                  <TextInput style={S.input} value={fromText}
                    onChangeText={setFromText}
                    placeholder="Departure station"
                    placeholderTextColor={colors.textMuted} />
                </View>
                <View>
                  <Text style={S.fieldLabel}>TO</Text>
                  <TextInput style={S.input} value={toText}
                    onChangeText={setToText}
                    placeholder="Arrival station"
                    placeholderTextColor={colors.textMuted} />
                </View>
                <TouchableOpacity style={S.searchBtn} onPress={searchRoute} disabled={searching}>
                  {searching
                    ? <ActivityIndicator color="white" />
                    : <Text style={S.searchBtnText}>FIND ROUTE</Text>}
                </TouchableOpacity>
              </View>

              {routeResult?.error && (
                <Text style={S.errorText}>{routeResult.error}</Text>
              )}

              {routeResult && !routeResult.error && (
                <View style={S.resultWrap}>
                  {/* 요약 카드 */}
                  <View style={S.summaryCard}>
                    <View style={S.summaryItem}>
                      <Text style={S.summaryNum}>{routeResult.totalTime}min</Text>
                      <Text style={S.summaryLabel}>est. travel</Text>
                    </View>
                    <View style={S.summaryDivider} />
                    <View style={S.summaryItem}>
                      <Text style={S.summaryNum}>{routeResult.path.length - 1}</Text>
                      <Text style={S.summaryLabel}>stops</Text>
                    </View>
                    <View style={S.summaryDivider} />
                    <View style={S.summaryItem}>
                      <Text style={S.summaryNum}>{routeResult.transfers}</Text>
                      <Text style={S.summaryLabel}>transfer</Text>
                    </View>
                  </View>

                  <Text style={S.detailsLabel}>Details Route</Text>

                  {/* 세그먼트별 렌더링 */}
                  {(routeResult.segments || []).map((seg, si) => {
                    const line = routeResult.lineMap[seg.lineId];
                    const lineColor = line?.color || '#888';
                    const lineName = line?.nameKo || line?.nameEn || 'Line';
                    const nextSeg = routeResult.segments[si + 1];
                    const nextLine = nextSeg ? routeResult.lineMap[nextSeg.lineId] : null;
                    return (
                      <View key={si} style={{ marginBottom: 16 }}>
                        {/* 라인 헤더 */}
                        <View style={S.segHeader}>
                          <View style={[S.lineBadge, { backgroundColor: lineColor }]}>
                            <Text style={S.lineBadgeText}>{lineName}</Text>
                          </View>
                          <Text style={S.segStops}>{seg.stations.length - 1}stops</Text>
                        </View>
                        {/* 세그먼트 역들 (라인 색상 왼쪽 바) */}
                        <View style={[S.segBody, { borderLeftColor: lineColor }]}>
                          {seg.stations.map((sid, idx) => {
                            const st = routeResult.stationMap[sid];
                            if (!st) return null;
                            const isFirst = idx === 0;
                            const isLast = idx === seg.stations.length - 1;
                            const faded = !isFirst && !isLast && seg.stations.length > 3;
                            return (
                              <View key={sid} style={[S.segStation, faded && { opacity: 0.5 }]}>
                                <View style={[
                                  S.segDot,
                                  { borderColor: lineColor },
                                  (isFirst || isLast) && { backgroundColor: lineColor, width: 10, height: 10 }
                                ]} />
                                <Text style={[S.segStationName, (isFirst || isLast) && { fontWeight: '700' }]}>
                                  {st.nameKo || st.nameEn}
                                </Text>
                                {(isFirst || isLast) && st.nameEn && st.nameKo && (
                                  <Text style={S.segStationEn}>{st.nameEn}</Text>
                                )}
                              </View>
                            );
                          })}
                        </View>
                        {/* 환승 표시 */}
                        {nextLine && (
                          <View style={S.transferBar}>
                            <Text style={S.transferText}>
                              🔄 Transfer — {nextLine.nameKo || nextLine.nameEn} Board
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}

          {tab === 'lines' && (
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              {lines.map(line => {
                const expanded = expandedLine === line.id;
                const lineStations = expanded ? getLineStations(line.id) : [];
                const bgColor = line.color || colors.primary;
                return (
                  <View key={line.id} style={S.lineWrap}>
                    <TouchableOpacity activeOpacity={0.85}
                      onPress={() => setExpandedLine(expanded ? null : line.id)}
                      style={[S.lineHeader, { backgroundColor: bgColor }]}>
                      <View style={S.lineNumBadge}>
                        <Text style={S.lineNumText}>{line.lineNumber || line.nameKo?.replace(/[^0-9]/g, '') || '?'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={S.lineNameWhite}>{line.nameKo || line.nameEn}</Text>
                        {line.nameEn && line.nameKo && <Text style={S.lineNameEnWhite}>{line.nameEn}</Text>}
                      </View>
                      <Text style={S.chevronWhite}>{expanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {expanded && (
                      <View style={S.stationBox}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}
                          contentContainerStyle={S.stationScroll}>
                          {lineStations.map((s, i) => (
                            <View key={s.id} style={S.stationCol}>
                              {i > 0 && <View style={[S.stationLine, { backgroundColor: bgColor }]} />}
                              <View style={[S.stationDot, { borderColor: bgColor }]} />
                              <Text style={S.stationNameVert}>
                                {(s.nameKo || s.nameEn || '').split('').join('\n')}
                              </Text>
                            </View>
                          ))}
                        </ScrollView>
                        <Text style={S.stationCount}>총 {lineStations.length}개 역</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  title: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 26, color: colors.primary, letterSpacing: -0.8, marginBottom: 2 },
  subtitle: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 2, color: colors.textTertiary, textTransform: 'uppercase' },
  cities: { paddingHorizontal: 20, paddingVertical: 14, gap: 10, alignItems: 'center' },
  cityBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 0.5, borderColor: colors.border, height: 36 },
  cityBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  cityText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.5, color: colors.textTertiary },
  cityTextActive: { color: 'white' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 2, color: colors.textSecondary },
  emptyDesc: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textTertiary, letterSpacing: 1 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 4, gap: 20, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  tab: { paddingVertical: 10 },
  tabActive: { borderBottomWidth: 1, borderBottomColor: colors.primary },
  tabText: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1.5, color: colors.textTertiary },
  tabTextActive: { fontFamily: 'Inter_600SemiBold', color: colors.primary },
  sectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 2, color: colors.primary },
  fieldLabel: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 2, color: colors.textTertiary, marginBottom: 4 },
  input: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textPrimary, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  searchBtn: { backgroundColor: colors.primary, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  searchBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 3, color: 'white' },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1.5, color: colors.accent, textAlign: 'center', marginTop: 20 },
  resultWrap: { marginTop: 24, paddingTop: 24, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  resultTime: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 36, color: colors.primary, letterSpacing: -1 },
  summaryCard: { flexDirection: 'row', backgroundColor: '#FAFAF8', borderRadius: 3, padding: 14, marginBottom: 18, gap: 12 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontFamily: 'Inter_700Bold', fontSize: 22, color: colors.primary },
  summaryLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#8A919C', marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: '#F0EEE9' },
  detailsLabel: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#4A5568', marginBottom: 12 },
  segHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  lineBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 3, marginRight: 8 },
  lineBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: 'white', letterSpacing: 0.5 },
  segStops: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#8A919C' },
  segBody: { borderLeftWidth: 3, paddingLeft: 14, paddingVertical: 4, marginLeft: 8 },
  segStation: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
  segDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', borderWidth: 2, marginLeft: -20 },
  segStationName: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.primary },
  segStationEn: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#8A919C' },
  transferBar: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingLeft: 12 },
  transferText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#f59e0b' },
  resultSub: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 2, color: colors.textTertiary, marginTop: 4 },
  routeList: { marginTop: 20, gap: 14 },
  routeStep: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  routeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 5 },
  routeStation: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 14, color: colors.primary },
  routeLine: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1, color: colors.textTertiary, marginTop: 2 },
  lineWrap: { marginBottom: 12 },
  lineHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 3 },
  lineNumBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'white' },
  lineNumText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: 'white' },
  lineNameWhite: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 16, color: 'white' },
  lineNameEnWhite: { fontFamily: 'Inter_500Medium', fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  chevronWhite: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: 'white' },
  stationBox: { backgroundColor: colors.bgSecondary, padding: 16, paddingBottom: 10 },
  stationScroll: { alignItems: 'flex-start', paddingVertical: 8 },
  stationCol: { alignItems: 'center', position: 'relative', width: 38 },
  stationLine: { position: 'absolute', top: 8, left: -19, width: 38, height: 2 },
  stationDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, backgroundColor: 'white', marginBottom: 6 },
  stationNameVert: { fontFamily: 'Inter_500Medium', fontSize: 10, color: colors.primary, textAlign: 'center', lineHeight: 12 },
  stationCount: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1.5, color: colors.textTertiary, marginTop: 10, textAlign: 'right' },
});
