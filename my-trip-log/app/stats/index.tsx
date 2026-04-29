/**
 * 내 여행 통계 대시보드
 * - 방문 국가/도시 카운트
 * - 총 여행 일수, 평균 체류
 * - 연도·월별 여행 횟수 (간단 막대그래프)
 * - 카테고리별 평균 지출 (CategoryPieChart 재사용)
 *
 * 모두 로컬 SQLite 데이터로만 계산 (외부 호출 0).
 */
import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Typography, Spacing, Shadows, Fonts } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { getDB } from '@/db/database';
import { CategoryPieChart, type CategoryStat } from '@/components/CategoryPieChart';
import { EXPENSE_CATEGORIES } from '@/db/schema';

interface Stats {
  totalTrips: number;
  totalDays: number;
  countries: { name: string; count: number; flag?: string }[];
  cities: { name: string; count: number }[];
  byYear: { year: string; count: number }[];
  byMonth: { month: number; count: number }[];
  totalSpent: number;
  byCategory: CategoryStat[];
  longestTrip: { title: string; days: number } | null;
}

const COUNTRY_FLAG: Record<string, string> = {
  '대한민국': '🇰🇷', '한국': '🇰🇷',
  '일본': '🇯🇵', '중국': '🇨🇳', '대만': '🇹🇼', '홍콩': '🇭🇰',
  '태국': '🇹🇭', '베트남': '🇻🇳', '필리핀': '🇵🇭', '인도네시아': '🇮🇩',
  '싱가포르': '🇸🇬', '말레이시아': '🇲🇾',
  '미국': '🇺🇸', '캐나다': '🇨🇦', '멕시코': '🇲🇽',
  '영국': '🇬🇧', '프랑스': '🇫🇷', '독일': '🇩🇪', '이탈리아': '🇮🇹', '스페인': '🇪🇸',
  '네덜란드': '🇳🇱', '체코': '🇨🇿', '오스트리아': '🇦🇹',
  '튀르키예': '🇹🇷', '터키': '🇹🇷', '이집트': '🇪🇬',
  '호주': '🇦🇺', '뉴질랜드': '🇳🇿',
  'UAE': '🇦🇪', '두바이': '🇦🇪',
  '괌': '🇬🇺',
};

export default function StatsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDB();
      const trips = await db.getAllAsync<{
        id: number; title: string; country: string | null; city: string | null;
        start_date: string | null; end_date: string | null; status: string;
      }>('SELECT id, title, country, city, start_date, end_date, status FROM trips');

      const countriesMap = new Map<string, number>();
      const citiesMap = new Map<string, number>();
      const yearMap = new Map<string, number>();
      const monthCounts: number[] = new Array(12).fill(0);
      let totalDays = 0;
      let longestTrip: { title: string; days: number } | null = null;

      for (const t of trips) {
        if (t.country) countriesMap.set(t.country, (countriesMap.get(t.country) ?? 0) + 1);
        if (t.city) citiesMap.set(t.city, (citiesMap.get(t.city) ?? 0) + 1);
        if (t.start_date) {
          const d = new Date(t.start_date);
          if (!isNaN(d.getTime())) {
            const year = String(d.getFullYear());
            yearMap.set(year, (yearMap.get(year) ?? 0) + 1);
            monthCounts[d.getMonth()] = (monthCounts[d.getMonth()] ?? 0) + 1;
          }
        }
        if (t.start_date && t.end_date) {
          const s = new Date(t.start_date);
          const e = new Date(t.end_date);
          if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
            const days = Math.max(1, Math.floor((e.getTime() - s.getTime()) / 86400000) + 1);
            totalDays += days;
            if (!longestTrip || days > longestTrip.days) {
              longestTrip = { title: t.title, days };
            }
          }
        }
      }

      // 지출 합계 + 카테고리별
      const expenses = await db.getAllAsync<{
        category: string; amount: number; amount_in_home_currency: number | null;
      }>(`SELECT category, amount, amount_in_home_currency FROM expenses`);
      let totalSpent = 0;
      const catTotals = new Map<string, number>();
      for (const e of expenses) {
        const amt = e.amount_in_home_currency ?? e.amount ?? 0;
        totalSpent += amt;
        catTotals.set(e.category, (catTotals.get(e.category) ?? 0) + amt);
      }
      const byCategory: CategoryStat[] = Array.from(catTotals.entries())
        .map(([category, total]) => {
          const meta = EXPENSE_CATEGORIES.find((c) => c.key === category);
          return {
            category,
            label: meta?.label ?? category,
            icon: meta?.icon ?? '💰',
            total,
            count: 0,
          };
        })
        .sort((a, b) => b.total - a.total);

      const countries = Array.from(countriesMap.entries())
        .map(([name, count]) => ({ name, count, flag: COUNTRY_FLAG[name] }))
        .sort((a, b) => b.count - a.count);
      const cities = Array.from(citiesMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      const byYear = Array.from(yearMap.entries())
        .map(([year, count]) => ({ year, count }))
        .sort((a, b) => a.year.localeCompare(b.year));
      const byMonth = monthCounts.map((count, i) => ({ month: i + 1, count }));

      setStats({
        totalTrips: trips.length,
        totalDays,
        countries,
        cities,
        byYear,
        byMonth,
        totalSpent,
        byCategory,
        longestTrip,
      });
    } catch (err) {
      console.error('[stats] load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>📊 내 여행 통계</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !stats || stats.totalTrips === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🌍</Text>
          <Text style={styles.emptyTitle}>아직 통계가 없어요</Text>
          <Text style={styles.emptyDesc}>
            여행을 기록하면 자동으로 통계가 만들어져요
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* 핵심 숫자 4개 */}
          <View style={styles.heroGrid}>
            <HeroStat label="여행 횟수" value={stats.totalTrips} unit="회" styles={styles} />
            <HeroStat label="여행 일수" value={stats.totalDays} unit="일" styles={styles} />
            <HeroStat label="방문 국가" value={stats.countries.length} unit="개국" styles={styles} />
            <HeroStat label="총 지출" value={Math.round(stats.totalSpent / 10000)} unit="만원" styles={styles} />
          </View>

          {stats.longestTrip && (
            <View style={styles.highlightCard}>
              <Text style={styles.highlightEyebrow}>🏆 가장 긴 여행</Text>
              <Text style={styles.highlightTitle}>{stats.longestTrip.title}</Text>
              <Text style={styles.highlightDays}>{stats.longestTrip.days}일간</Text>
            </View>
          )}

          {/* 방문 국가 */}
          {stats.countries.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🌍 방문한 국가 ({stats.countries.length})</Text>
              <View style={styles.countryGrid}>
                {stats.countries.map((c) => (
                  <View key={c.name} style={styles.countryChip}>
                    <Text style={styles.countryFlag}>{c.flag ?? '🌐'}</Text>
                    <Text style={styles.countryName}>{c.name}</Text>
                    <Text style={styles.countryCount}>×{c.count}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 도시 TOP 10 */}
          {stats.cities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🏙 자주 간 도시 TOP {Math.min(10, stats.cities.length)}</Text>
              {stats.cities.map((c, i) => (
                <View key={c.name} style={styles.rankRow}>
                  <Text style={styles.rankNumber}>{i + 1}</Text>
                  <Text style={styles.rankName}>{c.name}</Text>
                  <Text style={styles.rankCount}>{c.count}회</Text>
                </View>
              ))}
            </View>
          )}

          {/* 연도별 막대 그래프 */}
          {stats.byYear.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📅 연도별 여행</Text>
              <BarChart data={stats.byYear.map((y) => ({ label: y.year, value: y.count }))} styles={styles} />
            </View>
          )}

          {/* 월별 패턴 */}
          {stats.byMonth.some((m) => m.count > 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📆 월별 패턴</Text>
              <BarChart
                data={stats.byMonth.map((m) => ({ label: `${m.month}월`, value: m.count }))}
                styles={styles}
                compact
              />
            </View>
          )}

          {/* 카테고리별 지출 */}
          {stats.byCategory.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💰 카테고리별 지출</Text>
              <CategoryPieChart stats={stats.byCategory} total={stats.totalSpent} />
            </View>
          )}

          <View style={{ height: Spacing.huge }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function HeroStat({ label, value, unit, styles }: {
  label: string; value: number; unit: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.heroCard}>
      <Text style={styles.heroValue}>{value.toLocaleString()}</Text>
      <Text style={styles.heroUnit}>{unit}</Text>
      <Text style={styles.heroLabel}>{label}</Text>
    </View>
  );
}

function BarChart({ data, styles, compact }: {
  data: { label: string; value: number }[];
  styles: ReturnType<typeof createStyles>;
  compact?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={[styles.barChart, compact && { gap: 4 }]}>
      {data.map((d) => {
        const ratio = d.value / max;
        return (
          <View key={d.label} style={styles.barItem}>
            <View style={[styles.barFill, { height: `${Math.max(4, ratio * 100)}%`, opacity: d.value > 0 ? 1 : 0.2 }]} />
            <Text style={styles.barValue}>{d.value || ''}</Text>
            <Text style={[styles.barLabel, compact && { fontSize: 9 }]}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backText: { fontSize: 24, color: c.textPrimary },
    headerTitle: { fontSize: Typography.bodyLarge, fontWeight: '700', color: c.textPrimary },

    loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl },
    emptyIcon: { fontSize: 56 },
    emptyTitle: { fontSize: Typography.titleMedium, fontWeight: '700', color: c.textPrimary },
    emptyDesc: { fontSize: Typography.bodySmall, color: c.textSecondary, textAlign: 'center' },

    scroll: { padding: Spacing.lg, gap: Spacing.lg },

    heroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    heroCard: {
      flex: 1, minWidth: '47%',
      backgroundColor: c.surface,
      borderRadius: 14, borderWidth: 1, borderColor: c.border,
      padding: Spacing.md, alignItems: 'flex-start',
      ...Shadows.soft,
    },
    heroValue: {
      fontFamily: Fonts.bodyEnBold, fontSize: 36, color: c.primary,
      letterSpacing: -1, lineHeight: 40,
    },
    heroUnit: { fontSize: Typography.labelSmall, color: c.textTertiary, fontWeight: '600' },
    heroLabel: { fontSize: Typography.labelSmall, color: c.textSecondary, marginTop: Spacing.xs },

    highlightCard: {
      backgroundColor: c.primary + '12', borderRadius: 14,
      borderLeftWidth: 4, borderLeftColor: c.primary,
      padding: Spacing.lg,
    },
    highlightEyebrow: { fontSize: 11, color: c.accent, fontWeight: '700', letterSpacing: 1.5 },
    highlightTitle: { fontSize: Typography.titleMedium, fontWeight: '700', color: c.textPrimary, marginTop: 4 },
    highlightDays: { fontSize: Typography.bodyLarge, color: c.primary, fontWeight: '700', marginTop: 2 },

    section: {
      backgroundColor: c.surface,
      borderRadius: 14, borderWidth: 1, borderColor: c.border,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    sectionTitle: { fontSize: Typography.titleSmall, fontWeight: '700', color: c.textPrimary },

    countryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
    countryChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingVertical: 6, paddingHorizontal: 10,
      backgroundColor: c.surfaceAlt, borderRadius: 999,
    },
    countryFlag: { fontSize: 16 },
    countryName: { fontSize: Typography.labelMedium, color: c.textPrimary, fontWeight: '600' },
    countryCount: { fontSize: 11, color: c.accent, fontWeight: '700' },

    rankRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    rankNumber: {
      width: 24, fontSize: Typography.bodyMedium, fontWeight: '700',
      color: c.accent, textAlign: 'center',
    },
    rankName: { flex: 1, fontSize: Typography.bodyMedium, color: c.textPrimary },
    rankCount: { fontSize: Typography.labelSmall, color: c.textSecondary, fontWeight: '600' },

    barChart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-around',  // 항목 1개=가운데, 여러개=균등
      height: 120,
      paddingHorizontal: Spacing.xs,
    },
    barItem: {
      // flex 제거 — 항목 1개일 때 가로 100% 차지하던 문제 해결
      width: 44,
      alignItems: 'center',
      gap: 2,
      height: '100%',
      justifyContent: 'flex-end',
    },
    barFill: {
      width: 22,                         // 고정 너비 (이전엔 70%라 단일 막대가 거대했음)
      backgroundColor: c.primary,
      borderRadius: 4,
      minHeight: 4,
    },
    barValue: { fontSize: 10, color: c.textTertiary, fontWeight: '600', marginTop: 2 },
    barLabel: { fontSize: 10, color: c.textTertiary },
  });
}
