/**
 * 내 뱃지 화면 — 30개 뱃지 목록 (획득/미획득)
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';

import { Colors, Fonts, FontSizes, Spacing } from '@/theme/theme';
import { Divider } from '@/components/UI';
import { BadgeCard } from '@/components/BadgeCard';
import { BADGE_DEFINITIONS } from '@/services/badgeChecker';
import { getUnlockedBadges } from '@/db/badges';
import type { Badge } from '@/types';

export default function BadgesScreen() {
  const router = useRouter();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [unlockedCount, setUnlockedCount] = useState(0);

  const load = useCallback(async () => {
    const list = await getUnlockedBadges();
    const map = new Map(list.map(b => [b.id, b.unlockedAt]));
    const all: Badge[] = BADGE_DEFINITIONS.map(def => ({
      ...def,
      unlocked: map.has(def.id),
      unlockedAt: map.get(def.id),
    }));
    setBadges(all);
    setUnlockedCount(list.length);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 획득한 것 먼저, 티어 순서로
  const sorted = [...badges].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    const tierOrder = { special: 0, gold: 1, silver: 2, bronze: 3 };
    return tierOrder[a.tier] - tierOrder[b.tier];
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={{ fontSize: 22 }}>‹</Text>
        </Pressable>
        <Text style={styles.navTitle}>내 뱃지</Text>
        <View style={{ width: 22 }} />
      </View>
      <Divider />

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}>
        <View style={styles.headerCard}>
          <Text style={styles.headerIcon}>🏆</Text>
          <Text style={styles.headerCount}>
            {unlockedCount} <Text style={styles.headerTotal}>/ {BADGE_DEFINITIONS.length}</Text>
          </Text>
          <Text style={styles.headerLabel}>뱃지 획득</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(unlockedCount / BADGE_DEFINITIONS.length) * 100}%` }]} />
          </View>
        </View>

        <View style={styles.grid}>
          {sorted.map(badge => (
            <BadgeCard key={badge.id} badge={badge} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    height: 48,
  },
  navTitle: {
    fontSize: FontSizes.title,
    fontFamily: Fonts.semibold,
  },
  headerCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    backgroundColor: '#fff8e1',
    borderRadius: 14,
    marginBottom: Spacing.xl,
  },
  headerIcon: { fontSize: 40, marginBottom: 8 },
  headerCount: { fontSize: 32, fontFamily: Fonts.bold, color: '#9a7410' },
  headerTotal: { fontSize: 18, color: '#a7a097' },
  headerLabel: {
    fontSize: FontSizes.caption,
    color: '#7a5e00',
    marginTop: 2,
    marginBottom: 14,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#fff',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f4c430',
    borderRadius: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
