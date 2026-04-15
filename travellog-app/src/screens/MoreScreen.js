import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const MENU_ITEMS = [
  { key: 'NearbyPage', icon: '📍', label: '내 주변', desc: '주변 게시물 & 저장 장소 알림' },
  { key: 'PlannerPage', icon: '🗺️', label: '일정', desc: '여행 일정 관리 & 코스 추천' },
  { key: 'TransitPage', icon: '🚇', label: '교통', desc: '지하철 노선도 & 경로 검색' },
  { key: 'ExchangePage', icon: '💱', label: '환율', desc: '실시간 환율 계산' },
];

export default function MoreScreen({ user }) {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <Text style={S.title}>더보기</Text>
      </View>
      <ScrollView contentContainerStyle={S.list}>
        {MENU_ITEMS.map(item => (
          <TouchableOpacity key={item.key} style={S.menuItem} activeOpacity={0.7}
            onPress={() => navigation.navigate(item.key)}>
            <View style={S.menuIcon}>
              <Text style={{ fontSize: 24 }}>{item.icon}</Text>
            </View>
            <View style={S.menuText}>
              <Text style={S.menuLabel}>{item.label}</Text>
              <Text style={S.menuDesc}>{item.desc}</Text>
            </View>
            <Text style={S.arrow}>›</Text>
          </TouchableOpacity>
        ))}

        <View style={S.appInfo}>
          <Text style={S.appName}>Travellog</Text>
          <Text style={S.appVersion}>v1.0.0</Text>
          <Text style={S.appCopy}>일상이 여행이다.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  header: { backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 20, fontWeight: '900', color: '#1a1a2e' },
  list: { padding: 16, gap: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 14, padding: 16, gap: 14 },
  menuIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff5f5', justifyContent: 'center', alignItems: 'center' },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  menuDesc: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  arrow: { fontSize: 20, color: '#d1d5db' },
  appInfo: { alignItems: 'center', paddingTop: 30, gap: 4 },
  appName: { fontSize: 16, fontWeight: '800', color: '#FF5A5F' },
  appVersion: { fontSize: 12, color: '#9ca3af' },
  appCopy: { fontSize: 11, color: '#d1d5db', marginTop: 4 },
});
