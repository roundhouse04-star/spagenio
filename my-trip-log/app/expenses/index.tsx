import { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { getAllTrips } from '@/db/trips';
import { getTripTotalSpent, getAllExpensesByCategory } from '@/db/expenses';
import { Trip } from '@/types';
import { CategoryPieChart, type CategoryStat } from '@/components/CategoryPieChart';

interface TripExpenseSummary {
  trip: Trip;
  totalSpent: number;
  budget: number;
  percent: number;
}

export default function ExpensesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [summaries, setSummaries] = useState<TripExpenseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [grandTotal, setGrandTotal] = useState(0);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const trips = await getAllTrips();
      const result: TripExpenseSummary[] = [];
      let total = 0;

      for (const t of trips) {
        const spent = await getTripTotalSpent(t.id);
        const budget = t.budget || 0;
        const percent = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
        result.push({ trip: t, totalSpent: spent, budget, percent });
        total += spent;
      }

      // 지출 많은 순으로 정렬
      result.sort((a, b) => b.totalSpent - a.totalSpent);
      setSummaries(result);
      setGrandTotal(total);

      // 모든 여행 합산 카테고리별 집계
      const stats = await getAllExpensesByCategory();
      setCategoryStats(stats);
    } catch (err) {
      console.error('[비용 로드 실패]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const tripsWithSpending = summaries.filter((s) => s.totalSpent > 0);
  const tripsNoSpending = summaries.filter((s) => s.totalSpent === 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backText}>‹ 뒤로</Text>
        </Pressable>
        <Text style={styles.headerTitle}>💰 비용 관리</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 전체 합계 카드 */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>전체 여행 총 지출</Text>
          <Text style={styles.totalAmount}>
            ₩{grandTotal.toLocaleString()}
          </Text>
          <View style={styles.totalMeta}>
            <Text style={styles.totalMetaText}>
              📊 {summaries.length}개 여행
            </Text>
            <Text style={styles.totalMetaText}>
              💸 {tripsWithSpending.length}개 지출 있음
            </Text>
          </View>
        </View>

        {/* 카테고리별 파이차트 (모든 여행 합산) */}
        <CategoryPieChart
          stats={categoryStats}
          total={grandTotal}
          title="전체 카테고리별 지출"
        />

        {/* 지출 있는 여행 */}
        {tripsWithSpending.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>지출 내역이 있는 여행</Text>
            {tripsWithSpending.map((s) => (
              <TripExpenseCard key={s.trip.id} summary={s} styles={styles} colors={colors} />
            ))}
          </View>
        )}

        {/* 지출 없는 여행 */}
        {tripsNoSpending.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              지출 없음 ({tripsNoSpending.length})
            </Text>
            {tripsNoSpending.map((s) => (
              <TripExpenseCard key={s.trip.id} summary={s} styles={styles} colors={colors} />
            ))}
          </View>
        )}

        {/* 비어있는 경우 */}
        {!loading && summaries.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💸</Text>
            <Text style={styles.emptyTitle}>아직 여행이 없어요</Text>
            <Text style={styles.emptyDesc}>
              여행을 만들고 지출을 기록해보세요
            </Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => router.push('/trips/new')}
            >
              <Text style={styles.emptyBtnText}>+ 새 여행 만들기</Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function TripExpenseCard({ summary, styles, colors }: {
  summary: TripExpenseSummary;
  styles: ReturnType<typeof createStyles>;
  colors: ColorPalette;
}) {
  const { trip, totalSpent, budget, percent } = summary;

  const statusColor =
    trip.status === 'ongoing'
      ? colors.tripOngoing
      : trip.status === 'completed'
      ? colors.tripCompleted
      : colors.tripPlanning;

  const statusLabel =
    trip.status === 'ongoing' ? '진행 중'
      : trip.status === 'completed' ? '완료'
      : '계획 중';

  const progressColor =
    percent >= 100 ? colors.error
      : percent >= 80 ? colors.warning
      : colors.success;

  return (
    <Pressable
      style={styles.tripCard}
      onPress={() => router.push(`/expenses/${trip.id}`)}
    >
      <View style={styles.tripCardHeader}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusText, { color: statusColor }]}>
          {statusLabel}
        </Text>
      </View>

      <Text style={styles.tripTitle} numberOfLines={1}>
        {trip.title}
      </Text>

      {(trip.city || trip.country) && (
        <Text style={styles.tripLocation}>
          📍 {[trip.city, trip.country].filter(Boolean).join(', ')}
        </Text>
      )}

      {trip.startDate && (
        <Text style={styles.tripDate}>
          🗓️ {trip.startDate}
          {trip.endDate ? ` ~ ${trip.endDate}` : ''}
        </Text>
      )}

      {/* 지출 정보 */}
      <View style={styles.expenseRow}>
        <View style={styles.expenseInfo}>
          <Text style={styles.expenseLabel}>지출</Text>
          <Text style={styles.expenseAmount}>
            ₩{totalSpent.toLocaleString()}
          </Text>
        </View>
        {budget > 0 && (
          <View style={styles.expenseInfo}>
            <Text style={styles.expenseLabel}>예산</Text>
            <Text style={styles.budgetAmount}>
              ₩{budget.toLocaleString()}
            </Text>
          </View>
        )}
      </View>

      {/* 진행률 바 */}
      {budget > 0 && (
        <View style={styles.progressWrap}>
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${percent}%`,
                  backgroundColor: progressColor,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: progressColor }]}>
            {percent.toFixed(0)}%
          </Text>
        </View>
      )}

      {/* 화살표 */}
      <View style={styles.arrowWrap}>
        <Text style={styles.arrow}>›</Text>
      </View>
    </Pressable>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  backBtn: { minWidth: 60 },
  backText: { fontSize: Typography.bodyMedium, color: c.textSecondary },
  headerTitle: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: c.textPrimary,
  },
  scroll: { padding: Spacing.lg },

  // 전체 합계 카드
  totalCard: {
    backgroundColor: c.primary,
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    ...Shadows.medium,
  },
  totalLabel: {
    fontSize: Typography.bodySmall,
    color: c.textOnPrimary, opacity: 0.7,
    marginBottom: Spacing.xs,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: c.textOnPrimary,
    marginBottom: Spacing.md,
  },
  totalMeta: {
    flexDirection: 'row',
    gap: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.textOnPrimary,
  },
  totalMetaText: {
    fontSize: Typography.labelMedium,
    color: c.textOnPrimary, opacity: 0.85,
    fontWeight: '600',
  },

  // 섹션
  section: { marginBottom: Spacing.xl },
  sectionTitle: {
    fontSize: Typography.headlineSmall,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: Spacing.md,
  },

  // 여행 카드
  tripCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.soft,
    position: 'relative',
  },
  tripCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: Typography.labelSmall,
    fontWeight: '700',
  },
  tripDate: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    marginBottom: Spacing.md,
    fontWeight: '500',
  },
  tripTitle: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: 2,
    paddingRight: 20,
  },
  tripLocation: {
    fontSize: Typography.bodySmall,
    color: c.textSecondary,
    marginBottom: Spacing.xs,
  },

  // 지출 정보
  expenseRow: {
    flexDirection: 'row',
    gap: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  expenseInfo: {
    gap: 2,
  },
  expenseLabel: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    fontWeight: '600',
  },
  expenseAmount: {
    fontSize: Typography.bodyLarge,
    fontWeight: '800',
    color: c.primary,
  },
  budgetAmount: {
    fontSize: Typography.bodyMedium,
    fontWeight: '600',
    color: c.textSecondary,
  },

  // 진행률
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressBg: {
    flex: 1,
    height: 8,
    backgroundColor: c.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: Typography.labelSmall,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
  },

  // 화살표
  arrowWrap: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
  },
  arrow: {
    fontSize: 24,
    color: c.textTertiary,
    fontWeight: '300',
  },

  // 빈 상태
  empty: {
    alignItems: 'center',
    padding: Spacing.xxxl,
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: c.border,
    borderStyle: 'dashed',
  },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: {
    fontSize: Typography.headlineSmall,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: Spacing.xs,
  },
  emptyDesc: {
    fontSize: Typography.bodySmall,
    color: c.textSecondary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  emptyBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: c.primary,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: c.textOnPrimary,
    fontWeight: '700',
    fontSize: Typography.bodyMedium,
  },
});
}
