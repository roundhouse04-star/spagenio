import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, FlatList, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@travellog_plans';

export default function PlannerScreen({ user }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newPlan, setNewPlan] = useState({ title: '', startDate: '', endDate: '' });

  useEffect(() => { loadPlans(); }, []);

  const loadPlans = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) setPlans(JSON.parse(data));
    } catch (e) {}
    setLoading(false);
  };

  const savePlans = async (updated) => {
    setPlans(updated);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch (e) {}
  };

  const createPlan = () => {
    if (!newPlan.title.trim()) { Alert.alert('알림', '제목을 입력해주세요'); return; }
    const plan = {
      id: Date.now().toString(),
      title: newPlan.title,
      startDate: newPlan.startDate || new Date().toISOString().split('T')[0],
      endDate: newPlan.endDate || '',
      places: [],
      createdAt: new Date().toISOString(),
    };
    savePlans([plan, ...plans]);
    setNewPlan({ title: '', startDate: '', endDate: '' });
    setShowNew(false);
  };

  const deletePlan = (planId) => {
    Alert.alert('삭제', '일정을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => savePlans(plans.filter(p => p.id !== planId)) },
    ]);
  };

  const addPlace = (planId) => {
    Alert.prompt?.('장소 추가', '장소 이름을 입력하세요', (name) => {
      if (!name?.trim()) return;
      const updated = plans.map(p => {
        if (p.id === planId) {
          return { ...p, places: [...(p.places || []), { name: name.trim(), id: Date.now().toString() }] };
        }
        return p;
      });
      savePlans(updated);
      setSelected(updated.find(p => p.id === planId));
    }) || (() => {
      // Fallback for Android (no Alert.prompt)
      const name = '새 장소';
      const updated = plans.map(p => {
        if (p.id === planId) {
          return { ...p, places: [...(p.places || []), { name, id: Date.now().toString() }] };
        }
        return p;
      });
      savePlans(updated);
      setSelected(updated.find(p => p.id === planId));
    })();
  };

  const isPast = (endDate) => {
    if (!endDate) return false;
    return new Date(endDate) < new Date();
  };

  if (loading) return (
    <SafeAreaView style={S.container}>
      <ActivityIndicator size="large" color="#FF5A5F" style={{ marginTop: 60 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <Text style={S.title}>🗺️ 내 일정</Text>
        <TouchableOpacity style={S.addBtn} onPress={() => setShowNew(true)}>
          <Text style={S.addBtnText}>+ 새 일정</Text>
        </TouchableOpacity>
      </View>

      {plans.length === 0 ? (
        <View style={S.empty}>
          <Text style={{ fontSize: 48 }}>🗺️</Text>
          <Text style={S.emptyTitle}>등록된 일정이 없어요</Text>
          <Text style={S.emptyDesc}>새 일정을 만들어 여행을 계획하세요</Text>
          <TouchableOpacity style={S.emptyBtn} onPress={() => setShowNew(true)}>
            <Text style={S.emptyBtnText}>+ 새 일정 만들기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 30 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[S.planCard, isPast(item.endDate) && S.pastCard]}
              onPress={() => setSelected(selected?.id === item.id ? null : item)}>
              <View style={S.planHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={S.planTitle}>{item.title}</Text>
                  <Text style={S.planDate}>
                    {item.startDate}{item.endDate ? ' ~ ' + item.endDate : ''}
                  </Text>
                </View>
                <View style={S.planActions}>
                  <View style={[S.badge, isPast(item.endDate) ? S.badgePast : S.badgeActive]}>
                    <Text style={[S.badgeText, isPast(item.endDate) && { color: '#9ca3af' }]}>
                      {isPast(item.endDate) ? '완료' : '예정'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => deletePlan(item.id)}>
                    <Text style={{ fontSize: 16 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {item.places?.length > 0 && (
                <Text style={S.planPlaces}>📍 {item.places.length}개 장소</Text>
              )}

              {selected?.id === item.id && (
                <View style={S.detailWrap}>
                  {item.places?.length > 0 ? (
                    item.places.map((place, i) => (
                      <View key={place.id || i} style={S.placeItem}>
                        <View style={S.placeNum}>
                          <Text style={S.placeNumText}>{i + 1}</Text>
                        </View>
                        <Text style={S.placeName}>{place.name}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={S.noPlaces}>아직 장소가 없어요</Text>
                  )}
                  <TouchableOpacity style={S.addPlaceBtn} onPress={() => addPlace(item.id)}>
                    <Text style={S.addPlaceBtnText}>+ 장소 추가</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {/* 새 일정 모달 */}
      <Modal visible={showNew} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
          <View style={S.modalHeader}>
            <TouchableOpacity onPress={() => setShowNew(false)}>
              <Text style={{ fontSize: 15, color: '#9ca3af' }}>취소</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#1a1a2e' }}>새 일정</Text>
            <TouchableOpacity onPress={createPlan}>
              <Text style={{ fontSize: 15, color: '#FF5A5F', fontWeight: '700' }}>저장</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View>
              <Text style={S.label}>여행 제목</Text>
              <TextInput style={S.input} placeholder="예: 도쿄 3박 4일"
                placeholderTextColor="#9ca3af" value={newPlan.title}
                onChangeText={t => setNewPlan(p => ({ ...p, title: t }))} />
            </View>
            <View>
              <Text style={S.label}>출발일</Text>
              <TextInput style={S.input} placeholder="2026-04-20"
                placeholderTextColor="#9ca3af" value={newPlan.startDate}
                onChangeText={t => setNewPlan(p => ({ ...p, startDate: t }))} />
            </View>
            <View>
              <Text style={S.label}>귀국일</Text>
              <TextInput style={S.input} placeholder="2026-04-24"
                placeholderTextColor="#9ca3af" value={newPlan.endDate}
                onChangeText={t => setNewPlan(p => ({ ...p, endDate: t }))} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  header: { backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 20, fontWeight: '900', color: '#1a1a2e' },
  addBtn: { backgroundColor: '#FF5A5F', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: 'white', fontSize: 13, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptyDesc: { fontSize: 13, color: '#9ca3af' },
  emptyBtn: { backgroundColor: '#FF5A5F', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 10 },
  emptyBtnText: { color: 'white', fontSize: 14, fontWeight: '700' },
  planCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, borderLeftWidth: 4, borderLeftColor: '#FF5A5F' },
  pastCard: { borderLeftColor: '#d1d5db', opacity: 0.7 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a2e' },
  planDate: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  planActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planPlaces: { fontSize: 12, color: '#FF5A5F', fontWeight: '600', marginTop: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeActive: { backgroundColor: '#fff5f5' },
  badgePast: { backgroundColor: '#f3f4f6' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FF5A5F' },
  detailWrap: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12, gap: 8 },
  placeItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  placeNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FF5A5F', justifyContent: 'center', alignItems: 'center' },
  placeNumText: { color: 'white', fontSize: 11, fontWeight: '800' },
  placeName: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  noPlaces: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 10 },
  addPlaceBtn: { backgroundColor: '#f3f4f6', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  addPlaceBtnText: { fontSize: 13, color: '#FF5A5F', fontWeight: '700' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 14, fontSize: 14, color: '#1a1a2e' },
});
