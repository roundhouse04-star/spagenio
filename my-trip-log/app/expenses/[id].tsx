import { useCallback, useState } from 'react';
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
import { Colors, Typography, Spacing, Shadows } from '@/theme/theme';
import { getTripById } from '@/db/trips';
import {
  getExpenses,
  getExpensesByCategory,
  getTripTotalSpent,
  deleteExpense,
} from '@/db/expenses';
import { EXPENSE_CATEGORIES } from '@/db/schema';
import { Trip, Expense, ExpenseCategory } from '@/types';

export default function ExpenseDetailScreen() {
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
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/trip/[id]/expense-new',
              params: { id: String(tripId) },
            } as any)
          }
          hitSlop={10}
          style={styles.addBtn}
        >
          <Text style={styles.addBtnText}>+ 추가</Text>
        </Pressable>
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
                      { color: remaining >= 0 ? Colors.success : Colors.error },
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
                          percent >= 100 ? Colors.error
                            : percent >= 80 ? Colors.warning
                            : Colors.accent,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>{percent.toFixed(0)}%</Text>
              </View>
            </>
          )}
        </View>

        {/* 카테고리별 요약 */}
        {categoryStats.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>카테고리별 지출</Text>
            <View style={styles.categoryGrid}>
              {categoryStats.map((stat) => {
                const cat = EXPENSE_CATEGORIES.find((c) => c.key === stat.category);
                const pct = total > 0 ? (stat.total / total) * 100 : 0;
                return (
                  <Pressable
                    key={stat.category}
                    style={[
                      styles.categoryCard,
                      filter === stat.category && styles.categoryCardActive,
                    ]}
                    onPress={() =>
                      setFilter(filter === stat.category ? 'all' : stat.category)
                    }
                  >
                    <Text style={styles.categoryIcon}>{cat?.icon || '💰'}</Text>
                    <Text style={styles.categoryLabel}>{cat?.label || stat.category}</Text>
                    <Text style={styles.categoryAmount}>
                      ₩{stat.total.toLocaleString()}
                    </Text>
                    <Text style={styles.categoryMeta}>
                      {stat.count}건 · {pct.toFixed(0)}%
                    </Text>
                  </Pressable>
                );
              })}
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
          <Text style={styles.sectionTitle}>
            지출 내역 ({filteredExpenses.length}건)
          </Text>

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

function ExpenseItem({
  expense,
  onDelete,
}: {
  expense: Expense;
  onDelete: () => void;
}) {
  const cat = EXPENSE_CATEGORIES.find((c) => c.key === expense.category);
  const displayAmount =
    expense.amountInHomeCurrency && expense.amountInHomeCurrency > 0
      ? expense.amountInHomeCurrency
      : expense.amount;
  const showOriginal =
    expense.currency !== 'KRW' && expense.amount !== displayAmount;

  return (
    <View style={styles.expenseItem}>
      <View style={styles.expenseItemIcon}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  backBtn: { minWidth: 60 },
  backText: { fontSize: Typography.bodyMedium, color: Colors.textSecondary },
  headerTitle: {
    flex: 1,
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  addBtn: {
    minWidth: 60,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  addBtnText: {
    color: Colors.textOnPrimary,
    fontWeight: '700',
    fontSize: Typography.labelMedium,
    textAlign: 'center',
  },
  scroll: { padding: Spacing.lg },

  // 요약 카드
  summaryCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    ...Shadows.medium,
  },
  summaryLabel: {
    fontSize: Typography.bodySmall,
    color: 'rgba(250, 248, 243, 0.7)',
    marginBottom: Spacing.xs,
  },
  summaryAmount: {
    fontSize: 42,
    fontWeight: '800',
    color: Colors.textOnPrimary,
    marginBottom: Spacing.lg,
  },
  budgetRow: {
    flexDirection: 'row',
    gap: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(250, 248, 243, 0.2)',
    marginBottom: Spacing.md,
  },
  budgetInfo: { flex: 1 },
  budgetInfoLabel: {
    fontSize: Typography.labelSmall,
    color: 'rgba(250, 248, 243, 0.7)',
    marginBottom: 2,
  },
  budgetInfoValue: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressBg: {
    flex: 1,
    height: 10,
    backgroundColor: 'rgba(250, 248, 243, 0.2)',
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
    color: Colors.textOnPrimary,
    minWidth: 40,
    textAlign: 'right',
  },

  // 섹션
  section: { marginBottom: Spacing.xl },
  sectionTitle: {
    fontSize: Typography.headlineSmall,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },

  // 카테고리 그리드
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryCard: {
    width: '31.5%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...Shadows.soft,
  },
  categoryCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceAlt,
  },
  categoryIcon: { fontSize: 24, marginBottom: 4 },
  categoryLabel: {
    fontSize: Typography.labelSmall,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  categoryAmount: {
    fontSize: Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  categoryMeta: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 2,
  },

  // 필터 바
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
  filterText: {
    fontSize: Typography.bodySmall,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  filterClear: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    backgroundColor: Colors.surface,
    borderRadius: 8,
  },
  filterClearText: {
    fontSize: Typography.labelSmall,
    color: Colors.primary,
    fontWeight: '700',
  },

  // 지출 목록
  expenseList: { gap: Spacing.sm },
  expenseItem: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadows.soft,
  },
  expenseItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceAlt,
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
    color: Colors.textPrimary,
  },
  expenseItemAmount: {
    fontSize: Typography.bodyLarge,
    fontWeight: '800',
    color: Colors.primary,
  },
  expenseItemMeta: {
    flex: 1,
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
  },
  expenseItemOriginal: {
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  expenseItemMemo: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: Typography.bodySmall * 1.5,
    marginTop: 4,
  },
  deleteBtn: {
    padding: 4,
    alignSelf: 'flex-start',
  },
  deleteIcon: {
    fontSize: 20,
    color: Colors.textTertiary,
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
    color: Colors.textSecondary,
  },
  emptyExpenses: {
    alignItems: 'center',
    padding: Spacing.xxxl,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  emptyIcon: { fontSize: 44, marginBottom: Spacing.md },
  emptyTitle: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  emptyDesc: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
  },
});
