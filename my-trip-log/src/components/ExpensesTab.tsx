import { useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { Expense, Trip, ExpenseCategory } from '@/types';
import {
  getExpenses, deleteExpense, getExpensesByCategory, getTripTotalSpent,
} from '@/db/expenses';
import { EXPENSE_CATEGORIES } from '@/db/schema';

export function ExpensesTab({ trip }: { trip: Trip }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [byCategory, setByCategory] = useState<
    { category: ExpenseCategory; total: number; count: number }[]
  >([]);
  const [total, setTotal] = useState(0);
  const [receiptCount, setReceiptCount] = useState(0);

  const load = useCallback(async () => {
    const [all, cats, t] = await Promise.all([
      getExpenses(trip.id),
      getExpensesByCategory(trip.id),
      getTripTotalSpent(trip.id),
    ]);
    setExpenses(all);
    setByCategory(cats);
    setTotal(t);
    // 영수증 있는 비용 개수 계산
    setReceiptCount(all.filter((e: any) => e.receiptImage || e.receipt_image).length);
  }, [trip.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (id: number) => {
    Alert.alert('비용 삭제', '이 비용을 삭제하시겠어요?', [
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

  const budget = trip.budget;
  const remaining = budget - total;
  const usedPct = budget > 0 ? Math.min(100, (total / budget) * 100) : 0;

  return (
    <View style={styles.container}>
      {budget > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>예산 사용률</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${usedPct}%` }]} />
          </View>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryCaption}>사용</Text>
              <Text style={styles.summaryValue}>
                {total.toLocaleString()} {trip.currency}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.summaryCaption}>남음</Text>
              <Text
                style={[
                  styles.summaryValue,
                  remaining < 0 && { color: colors.error },
                ]}
              >
                {remaining.toLocaleString()} {trip.currency}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ⭐ 빠른 액션: 영수증 스캔 / 영수증 목록 / 수동 추가 */}
      <View style={styles.actionRow}>
        <Pressable
          style={styles.actionBtn}
          onPress={() => router.push(`/trip/${trip.id}/receipt-scan`)}
        >
          <Text style={styles.actionIcon}>📸</Text>
          <Text style={styles.actionLabel}>영수증 스캔</Text>
          <Text style={styles.actionDesc}>자동 인식</Text>
        </Pressable>
        <Pressable
          style={styles.actionBtn}
          onPress={() => router.push(`/trip/${trip.id}/receipts`)}
        >
          <Text style={styles.actionIcon}>📒</Text>
          <Text style={styles.actionLabel}>영수증 목록</Text>
          <Text style={styles.actionDesc}>
            {receiptCount > 0 ? `${receiptCount}장 보관` : '모아보기'}
          </Text>
        </Pressable>
        <Pressable
          style={styles.actionBtn}
          onPress={() => router.push({
            pathname: '/trip/[id]/expense-new',
            params: { id: String(trip.id) },
          })}
        >
          <Text style={styles.actionIcon}>✏️</Text>
          <Text style={styles.actionLabel}>수동 입력</Text>
          <Text style={styles.actionDesc}>직접 추가</Text>
        </Pressable>
      </View>

      {byCategory.length > 0 && (
        <View style={styles.catGrid}>
          {byCategory.map((c) => {
            const cat = EXPENSE_CATEGORIES.find((x) => x.key === c.category);
            return (
              <View key={c.category} style={styles.catChip}>
                <Text style={styles.catIcon}>{cat?.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catLabel}>{cat?.label}</Text>
                  <Text style={styles.catAmount}>
                    {c.total.toLocaleString()} · {c.count}건
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {expenses.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💰</Text>
          <Text style={styles.emptyTitle}>비용 기록이 없어요</Text>
          <Text style={styles.emptyDesc}>
            영수증 스캔이나 수동 입력으로 추가해보세요
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {expenses.map((exp) => (
            <ExpenseCard
              key={exp.id}
              expense={exp}
              onDelete={() => handleDelete(exp.id)}
              onEdit={() => router.push({
                pathname: '/trip/[id]/expense/[expenseId]',
                params: { id: String(trip.id), expenseId: String(exp.id) },
              })}
              styles={styles}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function ExpenseCard({
  expense, onDelete, onEdit, styles,
}: {
  expense: Expense;
  onDelete: () => void;
  onEdit: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const cat = EXPENSE_CATEGORIES.find((c) => c.key === expense.category);
  return (
    <Pressable style={styles.card} onPress={onEdit}>
      <Text style={styles.cardIcon}>{cat?.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{expense.title || cat?.label}</Text>
        <Text style={styles.cardDate}>{expense.expenseDate}</Text>
        {expense.memo && (
          <Text style={styles.cardMemo} numberOfLines={1}>
            {expense.memo}
          </Text>
        )}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.cardAmount}>
          {expense.amount.toLocaleString()} {expense.currency}
        </Text>
        {expense.amountInHomeCurrency && expense.currency !== 'KRW' && (
          <Text style={styles.cardConverted}>
            ≈ {expense.amountInHomeCurrency.toLocaleString()} KRW
          </Text>
        )}
        <Pressable onPress={onDelete} hitSlop={10}>
          <Text style={styles.deleteIcon}>⋯</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
  container: { paddingBottom: Spacing.xl },
  summaryCard: {
    backgroundColor: c.primary,
    padding: Spacing.lg,
    borderRadius: 16,
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  summaryLabel: {
    fontSize: Typography.labelSmall,
    color: c.accent,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: c.textOnPrimary,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: c.accent,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCaption: {
    fontSize: Typography.labelSmall,
    color: c.textOnPrimary, opacity: 0.6,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: Typography.headlineSmall,
    fontWeight: '700',
    color: c.textOnPrimary,
  },

  // 빠른 액션 3버튼
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 14,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    ...Shadows.soft,
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: Spacing.xs,
  },
  actionLabel: {
    fontSize: Typography.labelMedium,
    color: c.textPrimary,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: Typography.labelSmall,
    color: c.textSecondary,
  },

  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: c.surface,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
    width: '48.5%',
    ...Shadows.soft,
  },
  catIcon: { fontSize: 20 },
  catLabel: {
    fontSize: Typography.labelMedium,
    fontWeight: '600',
    color: c.textPrimary,
  },
  catAmount: {
    fontSize: Typography.labelSmall,
    color: c.textSecondary,
  },
  list: { gap: Spacing.sm, marginBottom: Spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadows.soft,
  },
  cardIcon: { fontSize: 28 },
  cardTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: 2,
  },
  cardDate: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
  },
  cardMemo: {
    fontSize: Typography.labelSmall,
    color: c.textSecondary,
    marginTop: 2,
  },
  cardAmount: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: c.textPrimary,
  },
  cardConverted: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    marginTop: 2,
  },
  deleteIcon: {
    fontSize: 20,
    color: c.textTertiary,
    fontWeight: '700',
    padding: Spacing.xs,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyIcon: { fontSize: 40, marginBottom: Spacing.sm },
  emptyTitle: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: Spacing.xs,
  },
  emptyDesc: {
    fontSize: Typography.bodySmall,
    color: c.textSecondary,
    textAlign: 'center',
  },
});
}
