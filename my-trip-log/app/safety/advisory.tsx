/**
 * 외교부 국가별 여행 경보 — 전체 목록
 *
 * 기능:
 *  - 외교부 API 에서 전체 국가 fetch
 *  - 위험도별 필터 (전체 / 자제+ / 출국권고+)
 *  - 국가 검색
 *  - 마지막 업데이트 시각 표시
 *  - 새로고침 (캐시 무시)
 *
 * 데이터: src/utils/safety/mofaClient.ts
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { fetchAllAdvisories, getCacheAge, clearAdvisoryCache } from '@/utils/safety/mofaClient';
import { ADVISORY_META, type AdvisoryLevel, type TravelAdvisory } from '@/data/safety/types';

type Filter = 'all' | 'caution+' | 'restrict+';

const FILTERS: { key: Filter; label: string; minLevel: AdvisoryLevel }[] = [
  { key: 'all', label: '전체', minLevel: 0 },
  { key: 'caution+', label: '여행자제 이상', minLevel: 2 },
  { key: 'restrict+', label: '출국권고 이상', minLevel: 3 },
];

export default function AdvisoryScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [data, setData] = useState<TravelAdvisory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [updatedAgo, setUpdatedAgo] = useState<string>('');

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      if (force) await clearAdvisoryCache();
      const list = await fetchAllAdvisories(force);
      setData(list);
      const age = await getCacheAge();
      if (age) {
        const minutes = Math.floor(age.ageMs / 60000);
        setUpdatedAgo(
          minutes < 1 ? '방금' : minutes < 60 ? `${minutes}분 전` : `${Math.floor(minutes / 60)}시간 전`,
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  const filtered = useMemo(() => {
    const minLevel = FILTERS.find((f) => f.key === filter)?.minLevel ?? 0;
    const q = search.trim().toLowerCase();
    return data
      .filter((a) => a.level >= minLevel)
      .filter((a) => {
        if (!q) return true;
        return (
          a.countryCode.toLowerCase().includes(q) ||
          a.countryName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.level - a.level);
  }, [data, filter, search]);

  return (
    <>
      <Stack.Screen options={{ title: '국가별 여행경보', headerBackTitle: '안전' }} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* 검색바 */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            placeholder="국가명 검색"
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* 필터 */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => { haptic.select(); setFilter(f.key); }}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* 본문 */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>외교부 데이터 로딩 중…</Text>
          </View>
        ) : data.length === 0 ? (
          <ScrollView contentContainerStyle={styles.center}>
            <Text style={styles.emptyIcon}>📡</Text>
            <Text style={styles.emptyTitle}>외교부 데이터를 가져올 수 없어요</Text>
            <Text style={styles.emptyDesc}>
              인증키가 활성화 대기 중이거나, 일시적 네트워크 문제일 수 있어요.
              {'\n'}잠시 후 다시 시도해주세요.
            </Text>
            <Pressable style={styles.retryBtn} onPress={() => load(true)}>
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          >
            <View style={styles.statsRow}>
              <Text style={styles.statsCount}>{filtered.length}개 국가</Text>
              {updatedAgo && (
                <Text style={styles.statsUpdated}>업데이트 {updatedAgo}</Text>
              )}
            </View>

            {filtered.map((adv) => {
              const meta = ADVISORY_META[adv.level];
              return (
                <View key={adv.countryCode} style={styles.card}>
                  <View style={[styles.levelBar, { backgroundColor: meta.color }]} />
                  <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.countryCode}>{adv.countryCode}</Text>
                      <Text style={styles.countryName}>{adv.countryName}</Text>
                      <View style={[styles.levelChip, { backgroundColor: meta.color }]}>
                        <Text style={styles.levelText}>{meta.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.desc}>{meta.description}</Text>
                    {adv.message && adv.message.length > 0 && (
                      <Text style={styles.message} numberOfLines={3}>{adv.message}</Text>
                    )}
                  </View>
                </View>
              );
            })}

            {filtered.length === 0 && (
              <View style={styles.center}>
                <Text style={styles.emptyDesc}>조건에 맞는 국가 없음</Text>
              </View>
            )}

            <Text style={styles.footer}>
              데이터 출처: 외교부 해외안전여행 (mofa.go.kr){'\n'}
              실시간 안전공지는 Phase 2 (Cloudflare 백엔드) 에서 푸시 알림 예정
            </Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      backgroundColor: c.surface,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderLight,
    },
    searchIcon: { fontSize: 18 },
    searchInput: { flex: 1, fontSize: Typography.bodyMedium, color: c.textPrimary, paddingVertical: 4 },

    filterRow: {
      flexDirection: 'row', gap: Spacing.sm,
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderLight,
    },
    filterChip: {
      paddingHorizontal: Spacing.md, paddingVertical: 6,
      borderRadius: 999, backgroundColor: c.surfaceAlt,
    },
    filterChipActive: { backgroundColor: c.primary },
    filterText: { fontSize: Typography.labelMedium, color: c.textSecondary, fontWeight: '600' },
    filterTextActive: { color: c.textOnPrimary, fontWeight: '700' },

    scroll: { padding: Spacing.lg, paddingBottom: Spacing.huge },
    statsRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: Spacing.md,
    },
    statsCount: { fontSize: Typography.labelMedium, color: c.textTertiary },
    statsUpdated: { fontSize: Typography.labelSmall, color: c.textTertiary, fontStyle: 'italic' },

    card: {
      flexDirection: 'row', backgroundColor: c.surface, borderRadius: 12,
      marginBottom: Spacing.sm, ...Shadows.sm, overflow: 'hidden',
    },
    levelBar: { width: 4 },
    cardContent: { flex: 1, padding: Spacing.md },
    cardHeader: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4,
    },
    countryCode: {
      fontSize: Typography.labelSmall, color: c.textTertiary,
      fontWeight: '700', letterSpacing: 0.5,
    },
    countryName: { flex: 1, fontSize: Typography.bodyMedium, fontWeight: '700', color: c.textPrimary },
    levelChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
    levelText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    desc: { fontSize: Typography.labelMedium, color: c.textSecondary },
    message: {
      marginTop: 6, fontSize: Typography.labelSmall, color: c.textTertiary,
      lineHeight: Typography.labelSmall * 1.6,
    },

    center: {
      flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.huge,
    },
    loadingText: { marginTop: Spacing.md, color: c.textSecondary, fontSize: Typography.bodyMedium },
    emptyIcon: { fontSize: 48, marginBottom: Spacing.md, opacity: 0.5 },
    emptyTitle: { fontSize: Typography.titleSmall, fontWeight: '700', color: c.textPrimary, marginBottom: Spacing.sm },
    emptyDesc: {
      fontSize: Typography.bodyMedium, color: c.textTertiary, textAlign: 'center',
      lineHeight: Typography.bodyMedium * 1.5,
    },
    retryBtn: {
      marginTop: Spacing.xl, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
      borderRadius: 999, backgroundColor: c.primary,
    },
    retryText: { color: c.textOnPrimary, fontWeight: '700' },

    footer: {
      marginTop: Spacing.xl, fontSize: Typography.labelSmall,
      color: c.textTertiary, textAlign: 'center',
      lineHeight: Typography.labelSmall * 1.6,
    },
  });
}
