import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';

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

const LINE_COLORS = {
  '1호선': '#0052A4', '2호선': '#00A84D', '3호선': '#EF7C1C', '4호선': '#00A5DE',
  '5호선': '#996CAC', '6호선': '#CD7C2F', '7호선': '#747F00', '8호선': '#E6186C', '9호선': '#BDB092',
};

export default function TransitScreen() {
  const [selectedCity, setSelectedCity] = useState(null);
  const [lines, setLines] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedLine, setExpandedLine] = useState(null);

  const loadCity = async (city) => {
    setSelectedCity(city);
    setLoading(true);
    setLines([]);
    setStations([]);
    setExpandedLine(null);
    try {
      const [linesRes, stationsRes] = await Promise.all([
        fetch(API_BASE + '/api/transit/lines?city=' + city.id),
        fetch(API_BASE + '/api/transit/stations?city=' + city.id),
      ]);
      if (linesRes.ok) setLines(await linesRes.json());
      if (stationsRes.ok) setStations(await stationsRes.json());
    } catch (e) {}
    setLoading(false);
  };

  const getLineStations = (lineId) => {
    return stations.filter(s => s.lineId === lineId || s.line_id === lineId).sort((a, b) => (a.stationOrder || 0) - (b.stationOrder || 0));
  };

  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <Text style={S.title}>🚇 교통</Text>
      </View>

      <ScrollView contentContainerStyle={S.content} showsVerticalScrollIndicator={false}>
        <View style={S.citySection}>
          <Text style={S.sectionTitle}>🌍 도시별 노선도</Text>
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
          <View style={S.lineSection}>
            <Text style={S.sectionTitle}>{selectedCity.flag} {selectedCity.name} 노선 ({lines.length}개)</Text>
            {lines.map((line, i) => {
              const lineStations = getLineStations(line.id || line.lineId);
              const isOpen = expandedLine === (line.id || line.lineId);
              const color = line.color || LINE_COLORS[line.name] || LINE_COLORS[line.nameKo] || '#6b7280';
              return (
                <View key={i}>
                  <TouchableOpacity style={S.lineCard} onPress={() => setExpandedLine(isOpen ? null : (line.id || line.lineId))}>
                    <View style={[S.lineColor, { backgroundColor: color }]} />
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
                          <Text style={S.stationName}>{st.nameKo || st.name}</Text>
                          {(st.isTransfer === 1 || st.isTransfer === true) && (
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
  lineSection: { backgroundColor: 'white', borderRadius: 16, padding: 16 },
  lineCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  lineColor: { width: 6, height: 30, borderRadius: 3 },
  lineName: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  lineStationsText: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  stationList: { paddingLeft: 20, paddingBottom: 12 },
  stationItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  stationDot: { width: 10, height: 10, borderRadius: 5 },
  stationName: { fontSize: 13, color: '#374151' },
  transferBadge: { fontSize: 10, color: '#FF5A5F', fontWeight: '700', backgroundColor: '#fff5f5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
});
