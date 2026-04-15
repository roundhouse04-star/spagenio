import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, FlatList, ActivityIndicator } from 'react-native';

const API_BASE = 'https://travel.spagenio.com';

export default function PlannerScreen({ user }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => { loadPlans(); }, []);

  const loadPlans = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/plans?userId=${user.id}`);
      if (res.ok) setPlans(await res.json());
    } catch (e) {}
    setLoading(false);
  };

  const isPast = (endDate) => {
    if (!endDate) return false;
    return new Date(endDate) < new Date();
  };

  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <Text style={S.title}>🗺️ 내 일정</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FF5A5F" style={{ marginTop: 40 }} />
      ) : plans.length === 0 ? (
        <View style={S.empty}>
          <Text style={{ fontSize: 48 }}>🗺️</Text>
          <Text style={S.emptyTitle}>등록된 일정이 없어요</Text>
          <Text style={S.emptyDesc}>웹에서 일정을 만들어보세요!</Text>
        </View>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 30 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={[S.planCard, isPast(item.endDate) && S.pastCard]}
              onPress={() => setSelected(selected?.id === item.id ? null : item)}>
              <View style={S.planHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={S.planTitle}>{item.title}</Text>
                  <Text style={S.planDate}>{item.startDate} ~ {item.endDate}</Text>
                </View>
                <View style={[S.badge, isPast(item.endDate) ? S.badgePast : S.badgeActive]}>
                  <Text style={S.badgeText}>{isPast(item.endDate) ? '완료' : '예정'}</Text>
                </View>
              </View>

              {item.items?.length > 0 && (
                <Text style={S.planPlaces}>📍 {item.items.length}개 장소</Text>
              )}

              {selected?.id === item.id && item.items?.length > 0 && (
                <View style={S.itemList}>
                  {item.items.map((pi, i) => (
                    <View key={i} style={S.placeItem}>
                      <View style={S.placeNum}>
                        <Text style={S.placeNumText}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={S.placeName}>{pi.placeName}</Text>
                        {pi.address && <Text style={S.placeAddr}>{pi.address}</Text>}
                        {pi.howToGet && <Text style={S.placeHow}>🚇 {pi.howToGet}</Text>}
                        {pi.memo && <Text style={S.placeMemo}>💡 {pi.memo}</Text>}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  header: { backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 20, fontWeight: '900', color: '#1a1a2e' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptyDesc: { fontSize: 13, color: '#9ca3af' },
  planCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 2, borderColor: '#FF5A5F' },
  pastCard: { borderColor: '#e5e7eb', opacity: 0.7 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a2e' },
  planDate: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  planPlaces: { fontSize: 12, color: '#FF5A5F', fontWeight: '600', marginTop: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeActive: { backgroundColor: '#fff5f5' },
  badgePast: { backgroundColor: '#f3f4f6' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FF5A5F' },
  itemList: { marginTop: 12, gap: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  placeItem: { flexDirection: 'row', gap: 10 },
  placeNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FF5A5F', justifyContent: 'center', alignItems: 'center' },
  placeNumText: { color: 'white', fontSize: 11, fontWeight: '800' },
  placeName: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  placeAddr: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  placeHow: { fontSize: 11, color: '#3b82f6', marginTop: 2 },
  placeMemo: { fontSize: 11, color: '#6b7280', marginTop: 2 },
});
