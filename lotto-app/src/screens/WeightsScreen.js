import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { DEFAULT_ALGOS } from '../lib/lottoEngine';
import { loadWeights, saveWeights } from '../lib/storage';
import { theme } from '../lib/theme';
import BannerAdSlot from '../components/BannerAdSlot';

export default function WeightsScreen() {
  const [algos, setAlgos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const w = await loadWeights();
      setAlgos(w);
      setLoading(false);
    })();
  }, []);

  const total = algos.reduce((s, a) => s + Number(a.weight || 0), 0);

  const onChange = (id, value) => {
    setAlgos((prev) => prev.map((a) => (a.id === id ? { ...a, weight: Math.round(value) } : a)));
  };

  const onCommit = async (next) => {
    await saveWeights(next || algos);
  };

  const onReset = async () => {
    const fresh = DEFAULT_ALGOS.map((a) => ({ ...a }));
    setAlgos(fresh);
    await saveWeights(fresh);
  };

  const onAutoBalance = async () => {
    if (total === 0) {
      Alert.alert('알림', '모든 가중치가 0입니다.');
      return;
    }
    const factor = 100 / total;
    const adjusted = algos.map((a) => ({ ...a, weight: Math.round(a.weight * factor) }));
    const diff = 100 - adjusted.reduce((s, a) => s + a.weight, 0);
    if (diff !== 0) {
      const idx = adjusted.findIndex((a) => a.weight > 0);
      if (idx >= 0) adjusted[idx] = { ...adjusted[idx], weight: adjusted[idx].weight + diff };
    }
    setAlgos(adjusted);
    await saveWeights(adjusted);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={[styles.summary, total === 100 ? styles.summaryOk : styles.summaryWarn]}>
        <Text style={styles.summaryLabel}>가중치 합계</Text>
        <Text style={styles.summaryValue}>{total}%</Text>
      </View>

      {algos.map((a) => (
        <View key={a.id} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{a.name}</Text>
            <Text style={styles.cardWeight}>{a.weight}%</Text>
          </View>
          <Text style={styles.cardDesc}>{a.desc}</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={a.weight}
            onValueChange={(v) => onChange(a.id, v)}
            onSlidingComplete={() => onCommit()}
            minimumTrackTintColor={theme.primary}
            maximumTrackTintColor={theme.border}
            thumbTintColor={theme.primary}
          />
        </View>
      ))}

      <View style={styles.btnRow}>
        <Pressable style={styles.btnGhost} onPress={onAutoBalance}>
          <Text style={styles.btnGhostTxt}>100%로 자동 보정</Text>
        </Pressable>
        <Pressable style={styles.btnDanger} onPress={onReset}>
          <Text style={styles.btnDangerTxt}>기본값 복원</Text>
        </Pressable>
      </View>
    </ScrollView>
    <BannerAdSlot position="bottom" />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 40 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg },
  summary: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, borderRadius: 12, marginBottom: 16,
  },
  summaryOk: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  summaryWarn: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a' },
  summaryLabel: { color: theme.textSub, fontWeight: '700' },
  summaryValue: { fontSize: 20, fontWeight: '800', color: theme.text },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginBottom: 10,
  },
  cardHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4,
  },
  cardTitle: { fontWeight: '800', fontSize: 14, color: theme.text },
  cardWeight: { color: theme.primary, fontWeight: '800', fontSize: 13 },
  cardDesc: { color: theme.textSub, fontSize: 12, marginBottom: 6 },
  slider: { width: '100%', height: 36 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btnGhost: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: theme.primary, alignItems: 'center', backgroundColor: '#eef2ff',
  },
  btnGhostTxt: { color: theme.primary, fontWeight: '700' },
  btnDanger: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#fecaca', alignItems: 'center', backgroundColor: '#fef2f2',
  },
  btnDangerTxt: { color: theme.danger, fontWeight: '700' },
});
