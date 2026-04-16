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

    const distances = {};
    const prev = {};
    const pq = [{ station: fromStation.id, dist: 0 }];
    distances[fromStation.id] = 0;

    while (pq.length > 0) {
      pq.sort((a, b) => a.dist - b.dist);
      const current = pq.shift();
      if (current.station === toStation.id) break;
      (graph[current.station] || []).forEach(neighbor => {
        const newDist = current.dist + neighbor.time;
        if (!distances[neighbor.to] || newDist < distances[neighbor.to]) {
          distances[neighbor.to] = newDist;
          prev[neighbor.to] = { from: current.station, lineId: neighbor.lineId };
          pq.push({ station: neighbor.to, dist: newDist });
        }
      });
    }

    if (!distances[toStation.id]) {
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

    setRouteResult({
      totalTime: distances[toStation.id],
      path,
      stationMap,
      lineMap,
      from: fromStation,
      to: toStation,
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
                  <Text style={S.resultTime}>{routeResult.totalTime} MIN</Text>
                  <Text style={S.resultSub}>{routeResult.path.length - 1} STOPS</Text>
                  <View style={S.routeList}>
                    {routeResult.path.map((p, i) => {
                      const st = routeResult.stationMap[p.stationId];
                      const ln = p.lineId ? routeResult.lineMap[p.lineId] : null;
                      return (
                        <View key={p.stationId} style={S.routeStep}>
                          <View style={S.routeDot} />
                          <View style={{ flex: 1 }}>
                            <Text style={S.routeStation}>{st?.nameKo || st?.nameEn || p.stationId}</Text>
                            {ln && <Text style={S.routeLine}>{ln.nameKo || ln.nameEn}</Text>}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          {tab === 'lines' && (
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              {lines.map(line => {
                const expanded = expandedLine === line.id;
                const lineStations = expanded ? getLineStations(line.id) : [];
                return (
                  <TouchableOpacity key={line.id} style={S.lineCard} activeOpacity={0.9}
                    onPress={() => setExpandedLine(expanded ? null : line.id)}>
                    <View style={S.lineHeader}>
                      <View style={[S.lineBadge, { backgroundColor: line.color || colors.primary }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={S.lineName}>{line.nameKo || line.nameEn}</Text>
                        {line.nameEn && line.nameKo && <Text style={S.lineNameEn}>{line.nameEn.toUpperCase()}</Text>}
                      </View>
                      <Text style={S.chevron}>{expanded ? '−' : '+'}</Text>
                    </View>
                    {expanded && (
                      <View style={S.stationList}>
                        {lineStations.map(s => (
                          <Text key={s.id} style={S.stationName}>
                            {s.nameKo || s.nameEn}
                          </Text>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
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
  resultSub: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 2, color: colors.textTertiary, marginTop: 4 },
  routeList: { marginTop: 20, gap: 14 },
  routeStep: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  routeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 5 },
  routeStation: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 14, color: colors.primary },
  routeLine: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1, color: colors.textTertiary, marginTop: 2 },
  lineCard: { marginBottom: 14, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  lineHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lineBadge: { width: 8, height: 24 },
  lineName: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 15, color: colors.primary },
  lineNameEn: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 1.5, color: colors.textTertiary, marginTop: 2 },
  chevron: { fontFamily: 'Inter_400Regular', fontSize: 20, color: colors.textTertiary },
  stationList: { marginTop: 12, paddingLeft: 20, gap: 8 },
  stationName: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary },
});
