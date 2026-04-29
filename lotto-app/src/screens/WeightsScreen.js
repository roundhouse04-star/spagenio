import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Switch,
} from 'react-native';
import { AUTO_STRATEGIES } from '../lib/lottoEngine';
import { loadAutoStrategy, saveAutoStrategy } from '../lib/appSettings';
import { theme } from '../lib/theme';
import BannerAdSlot from '../components/BannerAdSlot';

// "번호 추천 방식" — 자동추천에 적용할 전략 선택 (단일 선택, 모두 OFF면 랜덤)
export default function WeightsScreen() {
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await loadAutoStrategy();
      setStrategy(s);
      setLoading(false);
    })();
  }, []);

  const onToggle = async (id) => {
    // 이미 선택된 걸 다시 누르면 OFF (모두 OFF = 랜덤)
    const next = strategy === id ? null : id;
    setStrategy(next);
    await saveAutoStrategy(next);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const allOff = !strategy;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>🎯 자동추천 방식</Text>
          <Text style={styles.headerSub}>
            한 가지만 선택하세요. 모두 OFF 시 순수 랜덤으로 추천됩니다.
          </Text>
        </View>

        {AUTO_STRATEGIES.map((s) => {
          const active = strategy === s.id;
          return (
            <Pressable
              key={s.id}
              style={[styles.card, active && styles.cardActive]}
              onPress={() => onToggle(s.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>
                  {s.name}
                </Text>
                <Text style={styles.cardDesc}>{s.desc}</Text>
              </View>
              <Switch
                value={active}
                onValueChange={() => onToggle(s.id)}
                trackColor={{ false: '#e5e7eb', true: '#a5b4fc' }}
                thumbColor={active ? theme.primary : '#fff'}
              />
            </Pressable>
          );
        })}

        <View style={[styles.statusCard, allOff ? styles.statusRandom : styles.statusActive]}>
          <Text style={[styles.statusTxt, allOff ? styles.statusRandomTxt : styles.statusActiveTxt]}>
            {allOff
              ? '🎲 순수 랜덤으로 추천됩니다'
              : `✓ ${AUTO_STRATEGIES.find((s) => s.id === strategy)?.name} 적용 중`}
          </Text>
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

  headerCard: {
    backgroundColor: theme.primary,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 6, lineHeight: 18 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  cardActive: { borderColor: theme.primary, backgroundColor: '#eef2ff' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: theme.text, marginBottom: 3 },
  cardTitleActive: { color: theme.primary },
  cardDesc: { fontSize: 12, color: theme.textSub, lineHeight: 17 },

  statusCard: {
    marginTop: 8, padding: 12, borderRadius: 10, alignItems: 'center',
  },
  statusActive: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  statusRandom: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  statusTxt: { fontSize: 12, fontWeight: '800' },
  statusActiveTxt: { color: '#065f46' },
  statusRandomTxt: { color: '#6b7280' },
});
