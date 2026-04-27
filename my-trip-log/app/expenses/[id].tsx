import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import WebView from 'react-native-webview';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { getTripById } from '@/db/trips';
import {
  getExpenses,
  getExpensesByCategory,
  getTripTotalSpent,
  deleteExpense,
} from '@/db/expenses';
import { EXPENSE_CATEGORIES } from '@/db/schema';
import { Trip, Expense, ExpenseCategory } from '@/types';

// 카테고리별 색상 (Pie chart용 — 서로 뚜렷하게 구별되게)
const CATEGORY_COLORS: Record<string, string> = {
  food: '#F56565',          // 빨강 - 식비
  transport: '#4299E1',     // 파랑 - 교통
  accommodation: '#9F7AEA', // 보라 - 숙소
  activity: '#48BB78',      // 초록 - 액티비티
  shopping: '#ED8936',      // 주황 - 쇼핑
  sightseeing: '#38B2AC',   // 청록 - 관광
  other: '#A0AEC0',         // 회색 - 기타
};

export default function ExpenseDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const params = useLocalSearchParams<{ id: string }>();
  const tripId = Number(params.id);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categoryStats, setCategoryStats] = useState<
    { category: ExpenseCategory; total: number; count: number }[]
  >([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<ExpenseCategory | 'all'>('all');

  const load = useCallback(async () => {
    try {
      const [t, exps, stats, totalAmount] = await Promise.all([
        getTripById(tripId),
        getExpenses(tripId),
        getExpensesByCategory(tripId),
        getTripTotalSpent(tripId),
      ]);
      setTrip(t);
      setExpenses(exps);
      setCategoryStats(stats);
      setTotal(totalAmount);
    } catch (err) {
      console.error('[지출 상세 로드 실패]', err);
    }
  }, [tripId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (id: number) => {
    Alert.alert('지출 삭제', '이 지출 내역을 삭제하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(id);
          load();
        },
      },
    ]);
  };

  const filteredExpenses =
    filter === 'all'
      ? expenses
      : expenses.filter((e) => e.category === filter);

  const budget = trip?.budget || 0;
  const percent = budget > 0 ? Math.min(100, (total / budget) * 100) : 0;
  const remaining = budget - total;

  // Pie chart HTML 생성
  const pieHtml = useMemo(() => {
    if (categoryStats.length === 0 || total === 0) return '';
    return buildPieChartHtml(categoryStats, total);
  }, [categoryStats, total]);

  if (!trip) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
            <Text style={styles.backText}>‹ 뒤로</Text>
          </Pressable>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>여행을 찾을 수 없어요</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backText}>‹ 뒤로</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {trip.title}
        </Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/trip/[id]/receipt-scan',
                params: { id: String(tripId) },
              })
            }
            hitSlop={10}
            style={styles.iconBtn}
          >
            <Text style={styles.iconBtnText}>📷</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/trip/[id]/expense-new',
                params: { id: String(tripId) },
              })
            }
            hitSlop={10}
            style={styles.addBtn}
          >
            <Text style={styles.addBtnText}>+ 추가</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 총합 카드 */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>총 지출</Text>
          <Text style={styles.summaryAmount}>
            ₩{total.toLocaleString()}
          </Text>

          {budget > 0 && (
            <>
              <View style={styles.budgetRow}>
                <View style={styles.budgetInfo}>
                  <Text style={styles.budgetInfoLabel}>예산</Text>
                  <Text style={styles.budgetInfoValue}>
                    ₩{budget.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.budgetInfo}>
                  <Text style={styles.budgetInfoLabel}>
                    {remaining >= 0 ? '남은 금액' : '초과'}
                  </Text>
                  <Text
                    style={[
                      styles.budgetInfoValue,
                      { color: remaining >= 0 ? '#7BE495' : '#FF9999' },
                    ]}
                  >
                    ₩{Math.abs(remaining).toLocaleString()}
                  </Text>
                </View>
              </View>

              <View style={styles.progressWrap}>
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${percent}%`,
                        backgroundColor:
                          percent >= 100 ? colors.error
                            : percent >= 80 ? colors.warning
                            : colors.accent,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>{percent.toFixed(0)}%</Text>
              </View>
            </>
          )}
        </View>

        {/* 파이차트 + 범례 */}
        {categoryStats.length > 0 && total > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>카테고리별 지출</Text>

            {/* 파이차트 */}
            <View style={styles.chartCard}>
              <View style={styles.pieWrap}>
                <WebView
                  source={{ html: pieHtml }}
                  style={styles.pie}
                  scrollEnabled={false}
                  javaScriptEnabled
                  backgroundColor="transparent"
                />
              </View>

              {/* 범례 */}
              <View style={styles.legend}>
                {categoryStats.map((stat) => {
                  const cat = EXPENSE_CATEGORIES.find((c) => c.key === stat.category);
                  const pct = total > 0 ? (stat.total / total) * 100 : 0;
                  const color = CATEGORY_COLORS[stat.category] || '#A0AEC0';
                  const isActive = filter === stat.category;
                  return (
                    <Pressable
                      key={stat.category}
                      style={[
                        styles.legendItem,
                        isActive && styles.legendItemActive,
                      ]}
                      onPress={() =>
                        setFilter(isActive ? 'all' : stat.category)
                      }
                    >
                      <View style={[styles.legendDot, { backgroundColor: color }]} />
                      <Text style={styles.legendIcon}>{cat?.icon || '💰'}</Text>
                      <View style={styles.legendBody}>
                        <Text style={styles.legendLabel}>
                          {cat?.label || stat.category}
                        </Text>
                        <Text style={styles.legendMeta}>
                          {stat.count}건
                        </Text>
                      </View>
                      <View style={styles.legendRight}>
                        <Text style={styles.legendAmount}>
                          ₩{stat.total.toLocaleString()}
                        </Text>
                        <Text style={styles.legendPercent}>
                          {pct.toFixed(1)}%
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* 필터 */}
        {filter !== 'all' && (
          <View style={styles.filterBar}>
            <Text style={styles.filterText}>
              🔍 {EXPENSE_CATEGORIES.find((c) => c.key === filter)?.label || filter} 필터링 중
            </Text>
            <Pressable onPress={() => setFilter('all')} style={styles.filterClear}>
              <Text style={styles.filterClearText}>전체 보기</Text>
            </Pressable>
          </View>
        )}

        {/* 지출 목록 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              지출 내역 ({filteredExpenses.length}건)
            </Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/trip/[id]/receipts',
                  params: { id: String(tripId) },
                })
              }
              style={styles.receiptLink}
            >
              <Text style={styles.receiptLinkText}>🧾 영수증</Text>
            </Pressable>
          </View>

          {filteredExpenses.length === 0 ? (
            <View style={styles.emptyExpenses}>
              <Text style={styles.emptyIcon}>💸</Text>
              <Text style={styles.emptyTitle}>
                {filter === 'all' ? '아직 지출이 없어요' : '이 카테고리에 지출이 없어요'}
              </Text>
              <Text style={styles.emptyDesc}>
                +추가 버튼으로 지출을 기록해보세요
              </Text>
            </View>
          ) : (
            <View style={styles.expenseList}>
              {filteredExpenses.map((e) => (
                <ExpenseItem
                  key={e.id}
                  expense={e}
                  onDelete={() => handleDelete(e.id)}
                  onEdit={() => router.push({
                    pathname: '/trip/[id]/expense/[expenseId]',
                    params: { id: String(tripId), expenseId: String(e.id) },
                  })}
                  styles={styles}
                />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ====== Pie Chart HTML 생성 ======
function buildPieChartHtml(
  stats: { category: string; total: number; count: number }[],
  total: number
): string {
  const segments = stats.map((s) => ({
    value: s.total,
    color: CATEGORY_COLORS[s.category] || '#A0AEC0',
  }));

  // SVG Pie chart
  const size = 200;
  const radius = size / 2;
  const cx = radius;
  const cy = radius;
  const innerRadius = radius * 0.55; // 도넛 모양

  let currentAngle = -90; // 12시 방향부터 시작
  const paths = segments.map((seg) => {
    const angle = (seg.value / total) * 360;
    const endAngle = currentAngle + angle;

    const start = polarToCartesian(cx, cy, radius, currentAngle);
    const end = polarToCartesian(cx, cy, radius, endAngle);
    const innerStart = polarToCartesian(cx, cy, innerRadius, endAngle);
    const innerEnd = polarToCartesian(cx, cy, innerRadius, currentAngle);

    const largeArc = angle > 180 ? 1 : 0;

    const d = [
      `M ${start.x} ${start.y}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`,
      `L ${innerStart.x} ${innerStart.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
      'Z',
    ].join(' ');

    currentAngle = endAngle;

    return `<path d="${d}" fill="${seg.color}" />`;
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body {
      margin: 0; padding: 0; height: 100%;
      display: flex; align-items: center; justify-content: center;
      background: transparent;
    }
    svg { display: block; }
    .total { position: absolute; text-align: center; }
    .total-label { font-size: 10px; color: #8E96A6; font-family: -apple-system, sans-serif; }
    .total-value { font-size: 15px; font-weight: 700; color: #1E2A3A; font-family: -apple-system, sans-serif; }
  </style>
</head>
<body>
  <div style="position: relative; width: ${size}px; height: ${size}px;">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${paths.join('\n      ')}
    </svg>
    <div class="total" style="top: 50%; left: 50%; transform: translate(-50%, -50%);">
      <div class="total-label">총 지출</div>
      <div class="total-value">₩${total.toLocaleString()}</div>
    </div>
  </div>
</body>
</html>
  `;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function ExpenseItem({
  expense,
  onDelete,
  onEdit,
  styles,
}: {
  expense: Expense;
  onDelete: () => void;
  onEdit: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const cat = EXPENSE_CATEGORIES.find((c) => c.key === expense.category);
  const displayAmount =
    expense.amountInHomeCurrency && expense.amountInHomeCurrency > 0
      ? expense.amountInHomeCurrency
      : expense.amount;
  const showOriginal =
    expense.currency !== 'KRW' && expense.amount !== displayAmount;

  return (
    <Pressable style={styles.expenseItem} onPress={onEdit}>
      <View
        style={[
          styles.expenseItemIcon,
          { backgroundColor: (CATEGORY_COLORS[expense.category] || '#A0AEC0') + '20' },
        ]}
      >
        <Text style={styles.expenseItemIconText}>{cat?.icon || '💰'}</Text>
      </View>
      <View style={styles.expenseItemBody}>
        <View style={styles.expenseItemRow}>
          <Text style={styles.expenseItemTitle} numberOfLines={1}>
            {expense.title || cat?.label || '지출'}
          </Text>
          <Text style={styles.expenseItemAmount}>
            ₩{displayAmount.toLocaleString()}
          </Text>
        </View>
        <View style={styles.expenseItemRow}>
          <Text style={styles.expenseItemMeta}>
            📅 {expense.expenseDate}
            {expense.paymentMethod && `  ·  ${expense.paymentMethod}`}
          </Text>
          {showOriginal && (
            <Text style={styles.expenseItemOriginal}>
              {expense.currency} {expense.amount.toLocaleString()}
            </Text>
          )}
        </View>
        {expense.memo && (
          <Text style={styles.expenseItemMemo} numberOfLines={2}>
            {expense.memo}
          </Text>
        )}
      </View>
      <Pressable onPress={onDelete} hitSlop={10} style={styles.deleteBtn}>
        <Text style={styles.deleteIcon}>⋯</Text>
      </Pressable>
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
    gap: Spacing.sm,
  },
  backBtn: { minWidth: 60 },
  backText: { fontSize: Typography.bodyMedium, color: c.textSecondary },
  headerTitle: {
    flex: 1,
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: c.textPrimary,
    textAlign: 'center',
  },
  addBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: c.primary,
    borderRadius: 8,
  },
  addBtnText: {
    color: c.textOnPrimary,
    fontWeight: '700',
    fontSize: Typography.labelMedium,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    fontSize: 18,
  },
  scroll: { padding: Spacing.lg },

  // 요약 카드
  summaryCard: {
    backgroundColor: c.primary,
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    ...Shadows.medium,
  },
  summaryLabel: {
    fontSize: Typography.bodySmall,
    color: c.textOnPrimary, opacity: 0.7,
    marginBottom: Spacing.xs,
  },
  summaryAmount: {
    fontSize: 42,
    fontWeight: '800',
    color: c.textOnPrimary,
    marginBottom: Spacing.lg,
  },
  budgetRow: {
    flexDirection: 'row',
    gap: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.textOnPrimary,
    marginBottom: Spacing.md,
  },
  budgetInfo: { flex: 1 },
  budgetInfoLabel: {
    fontSize: Typography.labelSmall,
    color: c.textOnPrimary, opacity: 0.7,
    marginBottom: 2,
  },
  budgetInfoValue: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: c.textOnPrimary,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressBg: {
    flex: 1,
    height: 10,
    backgroundColor: c.textOnPrimary,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressText: {
    fontSize: Typography.labelMedium,
    fontWeight: '700',
    color: c.textOnPrimary,
    minWidth: 40,
    textAlign: 'right',
  },

  // 섹션
  section: { marginBottom: Spacing.xl },
  sectionTitle: {
    fontSize: Typography.headlineSmall,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  receiptLink: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: c.primary + '15',
    borderWidth: 1,
    borderColor: c.primary + '30',
  },
  receiptLinkText: {
    fontSize: Typography.labelSmall,
    fontWeight: '700',
    color: c.primary,
  },

  // 파이차트 카드
  chartCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    ...Shadows.soft,
  },
  pieWrap: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  pie: {
    width: 220,
    height: 220,
    backgroundColor: 'transparent',
  },

  // 범례
  legend: {
    gap: Spacing.xs,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: 10,
  },
  legendItemActive: {
    backgroundColor: c.surfaceAlt,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  legendBody: { flex: 1 },
  legendLabel: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: c.textPrimary,
  },
  legendMeta: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    marginTop: 1,
  },
  legendRight: {
    alignItems: 'flex-end',
  },
  legendAmount: {
    fontSize: Typography.bodyMedium,
    fontWeight: '800',
    color: c.textPrimary,
  },
  legendPercent: {
    fontSize: Typography.labelSmall,
    color: c.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },

  // 필터 바
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surfaceAlt,
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
  filterText: {
    fontSize: Typography.bodySmall,
    color: c.textPrimary,
    fontWeight: '600',
  },
  filterClear: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    backgroundColor: c.surface,
    borderRadius: 8,
  },
  filterClearText: {
    fontSize: Typography.labelSmall,
    color: c.primary,
    fontWeight: '700',
  },

  // 지출 목록
  expenseList: { gap: Spacing.sm },
  expenseItem: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadows.soft,
  },
  expenseItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseItemIconText: { fontSize: 22 },
  expenseItemBody: { flex: 1, gap: 4 },
  expenseItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  expenseItemTitle: {
    flex: 1,
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: c.textPrimary,
  },
  expenseItemAmount: {
    fontSize: Typography.bodyLarge,
    fontWeight: '800',
    color: c.primary,
  },
  expenseItemMeta: {
    flex: 1,
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
  },
  expenseItemOriginal: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    fontStyle: 'italic',
  },
  expenseItemMemo: {
    fontSize: Typography.bodySmall,
    color: c.textSecondary,
    lineHeight: Typography.bodySmall * 1.5,
    marginTop: 4,
  },
  deleteBtn: {
    padding: 4,
    alignSelf: 'flex-start',
  },
  deleteIcon: {
    fontSize: 20,
    color: c.textTertiary,
    fontWeight: '700',
  },

  // 빈 상태
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
  },
  emptyText: {
    fontSize: Typography.bodyMedium,
    color: c.textSecondary,
  },
  emptyExpenses: {
    alignItems: 'center',
    padding: Spacing.xxxl,
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: c.border,
    borderStyle: 'dashed',
  },
  emptyIcon: { fontSize: 44, marginBottom: Spacing.md },
  emptyTitle: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: Spacing.xs,
  },
  emptyDesc: {
    fontSize: Typography.bodySmall,
    color: c.textSecondary,
  },
});
}
