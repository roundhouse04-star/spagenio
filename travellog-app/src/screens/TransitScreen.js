import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';

const API_BASE = 'https://travel.spagenio.com';

const CITIES = [
  { name: '서울', flag: '🇰🇷' },
  { name: '도쿄', flag: '🇯🇵' },
  { name: '오사카', flag: '🇯🇵' },
  { name: '파리', flag: '🇫🇷' },
  { name: '런던', flag: '🇬🇧' },
  { name: '방콕', flag: '🇹🇭' },
  { name: '싱가포르', flag: '🇸🇬' },
  { name: '뉴욕', flag: '🇺🇸' },
  { name: '홍콩', flag: '🇭🇰' },
  { name: '바르셀로나', flag: '🇪🇸' },
];

export default function TransitScreen() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState(null);
  const [lines, setLines] = useState([]);

  const searchRoute = async () => {
    if (!from.trim() || !to.trim()) return;
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch(`${API_BASE}/api/transit/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      if (res.ok) setResults(await res.json());
    } catch (e) {}
    setLoading(false);
  };

  const loadCityLines = async (city) => {
    setSelectedCity(city);
    setLines([]);
    try {
      const res = await fetch(`${API_BASE}/api/transit/cities`);
      if (res.ok) {
        const data = await res.json();
        const found = data.find(c => c.name === city.name);
        if (found) setLines(found.lines || []);
      }
    } catch (e) {}
  };

  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <Text style={S.title}>🚇 교통</Text>
      </View>

      <ScrollView contentContainerStyle={S.content} showsVerticalScrollIndicator={false}>
        {/* 경로 검색 */}
        <View style={S.searchCard}>
          <Text style={S.sectionTitle}>🔍 경로 검색</Text>
          <View style={S.searchRow}>
            <TextInput style={S.searchInput} placeholder="출발역" placeholderTextColor="#9ca3af"
              value={from} onChangeText={setFrom} />
            <Text style={S.arrow}>→</Text>
            <TextInput style={S.searchInput} placeholder="도착역" placeholderTextColor="#9ca3af"
              value={to} onChangeText={setTo} />
          </View>
          <TouchableOpacity style={S.searchBtn} onPress={searchRoute}
            disabled={!from.trim() || !to.trim()}>
            <Text style={S.searchBtnText}>검색</Text>
          </TouchableOpacity>

          {loading && <ActivityIndicator color="#FF5A5F" style={{ marginTop: 16 }} />}

          {results.length > 0 && (
            <View style={S.resultList}>
              {results.map((r, i) => (
                <View key={i} style={S.resultCard}>
                  <View style={S.resultHeader}>
                    <Text style={S.resultTime}>⏱ {r.totalTime}분</Text>
                    <Text style={S.resultTransfer}>환승 {r.transfers}회</Text>
                  </View>
                  {r.segments?.map((seg, j) => (
                    <View key={j} style={S.segment}>
                      <View style={[S.lineBadge, { backgroundColor: seg.lineColor || '#6b7280' }]}>
                        <Text style={S.lineBadgeText}>{seg.lineName}</Text>
                      </View>
                      <Text style={S.segText}>{seg.from} → {seg.to}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 도시 목록 */}
        <View style={S.citySection}>
          <Text style={S.sectionTitle}>🌍 도시별 노선도</Text>
          <View style={S.cityGrid}>
            {CITIES.map(city => (
              <TouchableOpacity key={city.name} style={[S.cityBtn, selectedCity?.name === city.name && S.cityBtnActive]}
                onPress={() => loadCityLines(city)}>
                <Text style={S.cityFlag}>{city.flag}</Text>
                <Text style={[S.cityName, selectedCity?.name === city.name && S.cityNameActive]}>{city.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 노선 목록 */}
        {selectedCity && (
          <View style={S.lineSection}>
            <Text style={S.sectionTitle}>{selectedCity.flag} {selectedCity.name} 노선</Text>
            {lines.length > 0 ? (
              lines.map((line, i) => (
                <View key={i} style={S.lineCard}>
                  <View style={[S.lineColor, { backgroundColor: line.color || '#6b7280' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={S.lineName}>{line.name}</Text>
                    <Text style={S.lineStations}>{line.stationCount || 0}개 역</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={S.noData}>노선 정보를 불러오는 중...</Text>
            )}
          </View>
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
  searchCard: { backgroundColor: 'white', borderRadius: 16, padding: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 12, padding: 12, fontSize: 14, color: '#1a1a2e' },
  arrow: { fontSize: 18, color: '#FF5A5F', fontWeight: '700' },
  searchBtn: { backgroundColor: '#FF5A5F', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  searchBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
  resultList: { marginTop: 16, gap: 10 },
  resultCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 12 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  resultTime: { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  resultTransfer: { fontSize: 12, color: '#FF5A5F', fontWeight: '600' },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  lineBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  lineBadgeText: { fontSize: 10, color: 'white', fontWeight: '700' },
  segText: { fontSize: 12, color: '#6b7280' },
  citySection: { backgroundColor: 'white', borderRadius: 16, padding: 16 },
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cityBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f3f4f6', flexDirection: 'row', alignItems: 'center', gap: 6 },
  cityBtnActive: { backgroundColor: '#fff5f5', borderWidth: 1.5, borderColor: '#FF5A5F' },
  cityFlag: { fontSize: 18 },
  cityName: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  cityNameActive: { color: '#FF5A5F', fontWeight: '700' },
  lineSection: { backgroundColor: 'white', borderRadius: 16, padding: 16 },
  lineCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  lineColor: { width: 6, height: 30, borderRadius: 3 },
  lineName: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  lineStations: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  noData: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 20 },
});
