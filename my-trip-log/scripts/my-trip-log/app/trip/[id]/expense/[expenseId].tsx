import { useMemo, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { getExpense, updateExpense, deleteExpense } from '@/db/expenses';
import { EXPENSE_CATEGORIES } from '@/db/schema';
import { getRates } from '@/utils/exchange';
import { haptic } from '@/utils/haptics';

const CURRENCIES = [
  { code: 'KRW', flag: '🇰🇷' },
  { code: 'JPY', flag: '🇯🇵' },
  { code: 'USD', flag: '🇺🇸' },
  { code: 'EUR', flag: '🇪🇺' },
  { code: 'GBP', flag: '🇬🇧' },
  { code: 'CNY', flag: '🇨🇳' },
  { code: 'THB', flag: '🇹🇭' },
  { code: 'VND', flag: '🇻🇳' },
];

export default function ExpenseEditScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();
  const tripId = parseInt(id);
  const expIdNum = parseInt(expenseId);

  const [loading, setLoading] = useState(true);
  const [expenseDate, setExpenseDate] = useState('');
  const [category, setCategory] = useState<string>('food');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('KRW');
  const [memo, setMemo] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [ocrEngine, setOcrEngine] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);

  // 환율
  const [rates, setRates] = useState<Record<string, number>>({});
  const [ratesLoading, setRatesLoading] = useState(true);

  // 기존 데이터 로드
  useEffect(() => {
    (async () => {
      try {
        const exp = await getExpense(expIdNum);
        if (!exp) {
          Alert.alert('오류', '비용을 찾을 수 없습니다.');
          router.back();
          return;
        }
        setExpenseDate(exp.expenseDate);
        setCategory(exp.category);
        setTitle(exp.title || '');
        setAmount(String(exp.amount));
        setCurrency(exp.currency);
        setMemo(exp.memo || '');
        setReceiptImage(exp.receiptImage);
        setOcrEngine(exp.ocrEngine);
        setConfidence(exp.receiptConfidence);
      } catch (err) {
        console.error(err);
        Alert.alert('오류', '비용을 불러올 수 없습니다.');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [expIdNum]);

  // 환율 로드
  useEffect(() => {
    (async () => {
      try {
        const data = await getRates('KRW');
        setRates(data);
      } catch (err) {
        console.warn('환율 로드 실패', err);
      } finally {
        setRatesLoading(false);
      }
    })();
  }, []);

  const homeCurrencyAmount = (() => {
    const num = parseFloat(amount);
    if (!num || isNaN(num)) return null;
    if (currency === 'KRW') return num;
    const rate = rates[currency];
    if (!rate) return null;
    return num / rate;
  })();

  const exchangeRate = (() => {
    if (currency === 'KRW') return 1;
    const r = rates[currency];
    if (!r) return null;
    return 1 / r;
  })();

  const canSave = !!title.trim() && parseFloat(amount) > 0;

  const handleSave = async () => {
    if (!canSave) {
      haptic.warning();
      return;
    }
    try {
      await updateExpense(expIdNum, {
        expenseDate,
        category: category as any,
        title: title.trim(),
        amount: parseFloat(amount),
        currency,
        amountInHomeCurrency: homeCurrencyAmount ?? null,
        exchangeRate: exchangeRate ?? null,
        memo: memo.trim() || null,
      });
      haptic.success();
      router.back();
    } catch (err) {
      console.error(err);
      Alert.alert('저장 실패');
    }
  };

  const handleDelete = () => {
    Alert.alert('비용 삭제', '이 비용을 삭제하시겠어요? 되돌릴 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExpense(expIdNum);
            haptic.success();
            router.back();
          } catch (err) {
            console.error(err);
            Alert.alert('삭제 실패');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => { haptic.tap(); router.back(); }}>
            <Text style={styles.cancel}>취소</Text>
          </Pressable>
          <Text style={styles.headerTitle}>비용 편집</Text>
          <Pressable onPress={handleSave} disabled={!canSave}>
            <Text style={[styles.save, !canSave && styles.saveDisabled]}>저장</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* 영수증 이미지 (있으면) */}
          {receiptImage && (
            <View style={styles.field}>
              <Text style={styles.label}>영수증</Text>
              <View style={styles.receiptBox}>
                <Image source={{ uri: receiptImage }} style={styles.receiptImage} />
                {(ocrEngine || confidence != null) && (
                  <View style={styles.receiptMeta}>
                    {ocrEngine && (
                      <Text style={styles.receiptMetaText}>📷 {ocrEngine}</Text>
                    )}
                    {confidence != null && (
                      <Text style={styles.receiptMetaText}>
                        신뢰도 {Math.round(confidence * 100)}%
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>날짜</Text>
            <TextInput
              style={styles.input}
              value={expenseDate}
              onChangeText={setExpenseDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>카테고리</Text>
            <View style={styles.chipRow}>
              {EXPENSE_CATEGORIES.map((c) => (
                <Pressable
                  key={c.key}
                  style={[styles.chip, category === c.key && styles.chipActive]}
                  onPress={() => { haptic.select(); setCategory(c.key); }}
                >
                  <Text style={[styles.chipText, category === c.key && styles.chipTextActive]}>
                    {c.icon} {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>내용 *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="예: 라멘 점심"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>금액 *</Text>
            <View style={styles.amountRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
              />
              <View style={styles.currencyRow}>
                {CURRENCIES.map((c) => (
                  <Pressable
                    key={c.code}
                    style={[styles.currencyChip, currency === c.code && styles.currencyChipActive]}
                    onPress={() => { haptic.select(); setCurrency(c.code); }}
                  >
                    <Text style={styles.currencyChipText}>{c.flag}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {currency !== 'KRW' && parseFloat(amount) > 0 && (
              <View style={styles.conversionBox}>
                {ratesLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={styles.conversionLabel}>환율 조회 중...</Text>
                  </View>
                ) : homeCurrencyAmount ? (
                  <>
                    <Text style={styles.conversionLabel}>
                      ≈ ₩{Math.round(homeCurrencyAmount).toLocaleString()}
                    </Text>
                    <Text style={styles.conversionRate}>
                      1 {currency} = ₩{exchangeRate?.toFixed(2)}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.conversionLabel}>환율 정보 없음</Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>메모 (선택)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={memo}
              onChangeText={setMemo}
              placeholder="결제 수단, 특이사항 등"
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
            />
          </View>

          <Pressable style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>🗑️  이 비용 삭제</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  cancel: { fontSize: Typography.bodyMedium, color: c.textTertiary },
  headerTitle: { fontSize: Typography.bodyLarge, fontWeight: '700', color: c.textPrimary },
  save: { fontSize: Typography.bodyMedium, color: c.primary, fontWeight: '700' },
  saveDisabled: { color: c.textTertiary },
  scroll: { padding: Spacing.xl, paddingBottom: Spacing.huge },
  field: { marginBottom: Spacing.xl },
  label: {
    fontSize: Typography.labelMedium,
    color: c.textSecondary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  input: {
    fontSize: Typography.bodyMedium,
    color: c.textPrimary,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  receiptBox: {
    backgroundColor: c.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.border,
  },
  receiptImage: {
    width: '100%',
    height: 220,
    resizeMode: 'cover',
    backgroundColor: c.surfaceAlt,
  },
  receiptMeta: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  receiptMetaText: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 999,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontSize: Typography.labelMedium, color: c.textSecondary },
  chipTextActive: { color: c.textOnPrimary, fontWeight: '600' },
  amountRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  currencyRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', maxWidth: 200 },
  currencyChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyChipActive: { backgroundColor: c.primary, borderColor: c.primary },
  currencyChipText: { fontSize: 16 },
  conversionBox: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: c.surfaceAlt,
    borderRadius: 10,
    alignItems: 'center',
  },
  conversionLabel: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: c.primary,
  },
  conversionRate: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    marginTop: 2,
  },
  deleteBtn: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.error,
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: Typography.bodyMedium,
    color: c.error,
    fontWeight: '600',
  },
});
}
