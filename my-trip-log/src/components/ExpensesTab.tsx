import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Colors, Typography, Spacing, Shadows } from '@/theme/theme';
import { Expense, Trip, ExpenseCategory } from '@/types';
import {
  getExpenses, deleteExpense, getExpensesByCategory, getTripTotalSpent,
} from '@/db/expenses';
import { EXPENSE_CATEGORIES } from '@/db/schema';

export function ExpensesTab({ trip }: { trip: Trip }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [byCategory, setByCategory] = useState<
    { category: ExpenseCategory; total: number; count: number }[]
  >([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    const [all, cats, t] = await Promise.all([
      getExpenses(trip.id),
      getExpensesByCategory(trip.id),
      getTripTotalSpent(trip.id),
    ]);
    setExpenses(all);
    setByCategory(cats);
    setTotal(t);
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
                  remaining < 0 && { color: Colors.error },
                ]}
              >
                {remaining.toLocaleString()} {trip.currency}
              </Text>
            </View>
          </View>
        </View>
      )}

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
          <Text style={styles.emptyDesc}>첫 지출을 추가해보세요</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {expenses.map((exp) => (
            <ExpenseCard
              key={exp.id}
              expense={exp}
              onDelete={() => handleDelete(exp.id)}
            />
          ))}
        </View>
      )}

      <Pressable
        style={styles.addButton}
        onPress={() => router.push({
          pathname: '/trip/[id]/expense-new',
          params: { id: String(trip.id) },
        } as any)}
      >
        <Text style={styles.addButtonText}>+ 지출 추가</Text>
      </Pressable>
    </View>
  );
}

function ExpenseCard({
  expense, onDelete,
}: {
  expense: Expense;
  onDelete: () => void;
}) {
  const cat = EXPENSE_CATEGORIES.find((c) => c.key === expense.category);
  return (
    <View style={styles.card}>
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
        <Pressable onPress={onDelete}>
          <Text style={styles.deleteIcon}>⋯</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: Spacing.xl },
  summaryCard: {
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    borderRadius: 16,
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  summaryLabel: {
    fontSize: Typography.labelSmall,
    color: Colors.accent,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(250, 248, 243, 0.15)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCaption: {
    fontSize: Typography.labelSmall,
    color: 'rgba(250, 248, 243, 0.6)',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: Typography.headlineSmall,
    fontWeight: '700',
    color: Colors.textOnPrimary,
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
    backgroundColor: Colors.surface,
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
    color: Colors.textPrimary,
  },
  catAmount: {
    fontSize: Typography.labelSmall,
    color: Colors.textSecondary,
  },
  list: { gap: Spacing.sm, marginBottom: Spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadows.soft,
  },
  cardIcon: { fontSize: 28 },
  cardTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  cardDate: {
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
  },
  cardMemo: {
    fontSize: Typography.labelSmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cardAmount: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cardConverted: {
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  deleteIcon: {
    fontSize: 20,
    color: Colors.textTertiary,
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
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  emptyDesc: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
  },
  addButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: Colors.textOnPrimary,
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
  },
});
