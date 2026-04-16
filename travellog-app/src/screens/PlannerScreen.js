import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, FlatList, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { colors } from '../theme/colors';

const API_BASE = 'https://travel.spagenio.com';

export default function PlannerScreen({ user }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newPlan, setNewPlan] = useState({ title: '', startDate: '', endDate: '' });

  useEffect(() => { loadPlans(); }, []);

  const loadPlans = async () => {
    if (!user) { setLoading(false); return; }
    try {
      const res = await fetch(API_BASE + '/api/users/' + user.id + '/plans');
      if (res.ok) setPlans(await res.json());
    } catch (e) {}
    setLoading(false);
  };

  const createPlan = async () => {
    if (!newPlan.title.trim()) { Alert.alert('알림', '제목을 입력해주세요'); return; }
    try {
      const res = await fetch(API_BASE + '/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: newPlan.title,
          startDate: newPlan.startDate || new Date().toISOString().split('T')[0],
          endDate: newPlan.endDate || '',
          shareType: 'public',
          shareSchedule: true,
          sharePlaces: true,
        }),
      });
      if (res.ok) {
        setNewPlan({ title: '', startDate: '', endDate: '' });
        setShowNew(false);
        loadPlans();
      }
    } catch (e) { Alert.alert('오류', '일정 생성에 실패했어요'); }
  };

  const deletePlan = (planId) => {
    Alert.alert('Delete', 'Delete this plan?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await fetch(API_BASE + '/api/plans/' + planId, { method: 'DELETE' });
          loadPlans();
          if (selected?.id === planId) setSelected(null);
        } catch (e) {}
      }},
    ]);
  };

  const isPast = (endDate) => {
    if (!endDate) return false;
    return new Date(endDate) < new Date();
  };

  if (loading) return (
    <SafeAreaView style={S.container}>
      <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <View>
          <Text style={S.title}>Planner</Text>
          <Text style={S.subtitle}>CREATE YOUR JOURNEY</Text>
        </View>
        <TouchableOpacity style={S.addBtn} onPress={() => setShowNew(true)}>
          <Plus size={14} color="white" strokeWidth={2} />
          <Text style={S.addBtnText}>NEW</Text>
        </TouchableOpacity>
      </View>

      {plans.length === 0 ? (
        <View style={S.empty}>
          <Text style={S.emptyTitle}>NO PLANS YET</Text>
          <Text style={S.emptyDesc}>START PLANNING YOUR NEXT JOURNEY</Text>
          <TouchableOpacity style={S.emptyBtn} onPress={() => setShowNew(true)}>
            <Text style={S.emptyBtnText}>CREATE NEW PLAN</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 30 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[S.planCard, isPast(item.endDate) && S.pastCard]}
              onPress={() => setSelected(selected?.id === item.id ? null : item)}
              activeOpacity={0.9}>
              <View style={S.planHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[S.planStatus, isPast(item.endDate) && { color: colors.textTertiary }]}>
                    {isPast(item.endDate) ? 'COMPLETED' : 'UPCOMING'}
                  </Text>
                  <Text style={S.planTitle}>{item.title}</Text>
                  <Text style={S.planDate}>
                    {item.startDate}{item.endDate ? ` — ${item.endDate}` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => deletePlan(item.id)} style={{ padding: 8 }}>
                  <Trash2 size={16} color={colors.textTertiary} strokeWidth={1.5} />
                </TouchableOpacity>
              </View>

              {item.items?.length > 0 && (
                <Text style={S.planPlaces}>{item.items.length} PLACES</Text>
              )}

              {selected?.id === item.id && item.items?.length > 0 && (
                <View style={S.detailWrap}>
                  {item.items.map((place, i) => (
                    <View key={place.id || i} style={S.placeItem}>
                      <Text style={S.placeNum}>{String(i + 1).padStart(2, '0')}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={S.placeName}>{place.placeName}</Text>
                        {place.address ? <Text style={S.placeAddr} numberOfLines={1}>{place.address}</Text> : null}
                        {place.memo ? <Text style={S.placeMemo}>{place.memo}</Text> : null}
                        {place.date ? <Text style={S.placeDate}>{place.date.toUpperCase()}</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={showNew} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
          <View style={S.modalHeader}>
            <TouchableOpacity onPress={() => setShowNew(false)}>
              <Text style={S.modalCancel}>CANCEL</Text>
            </TouchableOpacity>
            <Text style={S.modalTitle}>NEW PLAN</Text>
            <TouchableOpacity onPress={createPlan}>
              <Text style={S.modalSave}>SAVE</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
            <View>
              <Text style={S.label}>TITLE</Text>
              <TextInput style={S.input} placeholder="e.g. Tokyo Adventure"
                placeholderTextColor={colors.textMuted} value={newPlan.title}
                onChangeText={t => setNewPlan(p => ({ ...p, title: t }))} />
            </View>
            <View>
              <Text style={S.label}>START DATE</Text>
              <TextInput style={S.input} placeholder="2026-04-20"
                placeholderTextColor={colors.textMuted} value={newPlan.startDate}
                onChangeText={t => setNewPlan(p => ({ ...p, startDate: t }))} />
            </View>
            <View>
              <Text style={S.label}>END DATE</Text>
              <TextInput style={S.input} placeholder="2026-04-24"
                placeholderTextColor={colors.textMuted} value={newPlan.endDate}
                onChangeText={t => setNewPlan(p => ({ ...p, endDate: t }))} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  title: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 26, color: colors.primary, letterSpacing: -0.8, marginBottom: 2 },
  subtitle: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 2, color: colors.textTertiary, textTransform: 'uppercase' },
  addBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8 },
  addBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.5, color: 'white' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 2, color: colors.textSecondary },
  emptyDesc: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textTertiary, letterSpacing: 1 },
  emptyBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, marginTop: 14 },
  emptyBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 2, color: 'white' },
  planCard: { marginBottom: 24, paddingBottom: 20, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  pastCard: { opacity: 0.55 },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  planStatus: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 2, color: colors.primary, marginBottom: 4 },
  planTitle: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 18, color: colors.primary, letterSpacing: -0.3 },
  planDate: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textTertiary, marginTop: 4, letterSpacing: 0.5 },
  planPlaces: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.5, color: colors.textSecondary, marginTop: 8 },
  detailWrap: { marginTop: 14, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: colors.borderLight, gap: 12 },
  placeItem: { flexDirection: 'row', gap: 12 },
  placeNum: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 14, color: colors.textTertiary, width: 24 },
  placeName: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 14, color: colors.primary, lineHeight: 18 },
  placeAddr: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  placeMemo: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  placeDate: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.5, color: colors.primary, marginTop: 4 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  modalTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 2.5, color: colors.primary },
  modalCancel: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1.5, color: colors.textTertiary },
  modalSave: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.5, color: colors.primary },
  label: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 2, color: colors.textTertiary, marginBottom: 6 },
  input: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textPrimary, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
});
