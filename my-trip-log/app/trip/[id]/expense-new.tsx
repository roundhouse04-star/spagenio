import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Colors, Typography, Spacing } from '@/theme/theme';
import { createExpense } from '@/db/expenses';
import { EXPENSE_CATEGORIES } from '@/db/schema';
import { ExpenseCategory } from '@/types';

// 간단 환율표 (KRW 기준)
const RATES: Record<string, number> = {
  KRW: 1,
  JPY: 9.1,
  USD: 1380,
  EUR: 1500,
  THB: 40,
  VND: 0.056,
  CNY: 190,
  GBP: 1750,
};

export default function NewExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);

  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('KRW');
  const [memo, setMemo] = useState('');

  const canSave = parseFloat(amount) > 0;

  // 자국 통화(KRW) 환산액
  const amountNum = parseFloat(amount) || 0;
  const convertedToKRW = amountNum * (RATES[currency] ?? 1);

  const handleSave = async () => {
    if (!canSave) {
      Alert.alert('금액을 입력해주세요');
      return;
    }
    try {
      await createExpense({
        tripId,
        expenseDate,
        category,
        title: title.trim() || null,
        amount: amountNum,
        currency,
        amountInHomeCurrency: convertedToKRW,
        exchangeRate: RATES[currency] ?? 1,
        memo: memo.trim() || null,
      });
      router.back();
    } catch (err) {
      console.error(err);
      Alert.alert('저장 실패');
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '지출 추가',
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <Text style={styles.headerBtn}>취소</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={handleSave} disabled={!canSave}>
              <Text
                style={[styles.headerBtn, styles.saveBtn, !canSave && { opacity: 0.4 }]}
              >
                저장
              </Text>
            </Pressable>
          ),
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll}>
            <Field label="카테고리" required>
              <View style={styles.catGrid}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <Pressable
                    key={c.key}
                    style={[
                      styles.catChip,
                      category === c.key && styles.catChipActive,
                    ]}
                    onPress={() => setCategory(c.key as ExpenseCategory)}
                  >
                    <Text style={styles.catIcon}>{c.icon}</Text>
                    <Text
                      style={[
                        styles.catText,
                        category === c.key && styles.catTextActive,
                      ]}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Field>

            <Field label="금액" required>
              <View style={styles.amountRow}>
                <TextInput
                  style={[styles.input, { flex: 2 }]}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="numeric"
                  autoFocus
                />
                <View style={styles.currencyBox}>
                  {['KRW', 'JPY', 'USD', 'EUR'].map((c) => (
                    <Pressable
                      key={c}
                      style={[
                        styles.currencyBtn,
                        currency === c && styles.currencyBtnActive,
                      ]}
                      onPress={() => setCurrency(c)}
                    >
                      <Text
                        style={[
                          styles.currencyText,
                          currency === c && styles.currencyTextActive,
                        ]}
                      >
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              {currency !== 'KRW' && amountNum > 0 && (
                <Text style={styles.conversionText}>
                  ≈ {convertedToKRW.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })} KRW
                </Text>
              )}
            </Field>

            <Field label="내용">
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="예: 라멘집"
                placeholderTextColor={Colors.textTertiary}
              />
            </Field>

            <Field label="날짜">
              <TextInput
                style={styles.input}
                value={expenseDate}
                onChangeText={setExpenseDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textTertiary}
              />
            </Field>

            <Field label="메모">
              <TextInput
                style={[styles.input, styles.textarea]}
                value={memo}
                onChangeText={setMemo}
                placeholder="추가 정보"
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={3}
              />
            </Field>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

function Field({
  label, required, children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label} {required && <Text style={{ color: Colors.error }}>*</Text>}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.xl, gap: Spacing.lg },
  headerBtn: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.lg,
    fontWeight: '500',
  },
  saveBtn: { color: Colors.primary, fontWeight: '700' },
  field: { gap: Spacing.xs },
  fieldLabel: {
    fontSize: Typography.labelSmall,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  input: {
    fontSize: Typography.bodyLarge,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catIcon: { fontSize: 18 },
  catText: {
    fontSize: Typography.labelMedium,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  catTextActive: { color: Colors.textOnPrimary },
  amountRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  currencyBox: {
    flex: 1,
    gap: 4,
  },
  currencyBtn: {
    flex: 1,
    paddingVertical: Spacing.xs,
    borderRadius: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  currencyBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  currencyText: {
    fontSize: Typography.labelSmall,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  currencyTextActive: { color: Colors.textOnPrimary },
  conversionText: {
    fontSize: Typography.labelMedium,
    color: Colors.accent,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
});
