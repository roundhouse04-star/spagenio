import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Shadows } from '@/theme/theme';

type Currency = { code: string; name: string; flag: string };

const CURRENCIES: Currency[] = [
  { code: 'KRW', name: '원', flag: '🇰🇷' },
  { code: 'JPY', name: '엔', flag: '🇯🇵' },
  { code: 'USD', name: '달러', flag: '🇺🇸' },
  { code: 'EUR', name: '유로', flag: '🇪🇺' },
  { code: 'THB', name: '바트', flag: '🇹🇭' },
  { code: 'VND', name: '동', flag: '🇻🇳' },
  { code: 'CNY', name: '위안', flag: '🇨🇳' },
  { code: 'GBP', name: '파운드', flag: '🇬🇧' },
];

// 데모 고정 환율 (실제로는 API에서 가져와야 함)
const MOCK_RATES: Record<string, number> = {
  KRW: 1,
  JPY: 9.1,
  USD: 1380,
  EUR: 1500,
  THB: 40,
  VND: 0.056,
  CNY: 190,
  GBP: 1750,
};

export default function ToolsScreen() {
  const [amount, setAmount] = useState('10000');
  const [from, setFrom] = useState('KRW');
  const [to, setTo] = useState('JPY');

  const convert = (amt: string, fromC: string, toC: string): string => {
    const num = parseFloat(amt) || 0;
    const fromRate = MOCK_RATES[fromC] ?? 1;
    const toRate = MOCK_RATES[toC] ?? 1;
    const result = (num * fromRate) / toRate;
    return result.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>도구</Text>
        <Text style={styles.subtitle}>여행에 필요한 모든 도구를 한 곳에</Text>

        <Text style={styles.sectionTitle}>💱 환율 계산기</Text>

        <View style={styles.card}>
          <View style={styles.currencyRow}>
            <CurrencyPicker
              label="보낼 통화"
              value={from}
              onChange={setFrom}
              currencies={CURRENCIES}
            />
            <Pressable style={styles.swapBtn} onPress={swap}>
              <Text style={styles.swapIcon}>⇄</Text>
            </Pressable>
            <CurrencyPicker
              label="받을 통화"
              value={to}
              onChange={setTo}
              currencies={CURRENCIES}
            />
          </View>

          <View style={styles.amountGroup}>
            <Text style={styles.amountLabel}>금액</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          <View style={styles.resultBox}>
            <Text style={styles.resultLabel}>
              {CURRENCIES.find((c) => c.code === to)?.flag} {to}
            </Text>
            <Text style={styles.resultValue}>{convert(amount, from, to)}</Text>
          </View>

          <Text style={styles.rateNote}>
            ※ 실제 사용 시에는 실시간 환율이 반영됩니다
          </Text>
        </View>

        <Text style={styles.sectionTitle}>🚇 지하철 노선도</Text>
        <View style={styles.linkCards}>
          {[
            { icon: '🇰🇷', label: '서울 지하철', desc: '1~9호선, 공항철도' },
            { icon: '🇯🇵', label: '도쿄 지하철', desc: 'Tokyo Metro' },
            { icon: '🇯🇵', label: '오사카 지하철', desc: 'Osaka Metro' },
            { icon: '🇹🇭', label: '방콕 BTS', desc: 'BTS, MRT' },
          ].map((m, i) => (
            <Pressable key={i} style={styles.linkCard}>
              <Text style={styles.linkIcon}>{m.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkLabel}>{m.label}</Text>
                <Text style={styles.linkDesc}>{m.desc}</Text>
              </View>
              <Text style={styles.linkArrow}>›</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>📞 유용한 정보</Text>
        <View style={styles.linkCards}>
          {[
            { icon: '🏥', label: '긴급 연락처', desc: '대사관, 보험' },
            { icon: '🗣️', label: '여행 회화', desc: '기본 표현' },
            { icon: '🔌', label: '전압 & 플러그', desc: '국가별 정보' },
          ].map((m, i) => (
            <Pressable key={i} style={styles.linkCard}>
              <Text style={styles.linkIcon}>{m.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkLabel}>{m.label}</Text>
                <Text style={styles.linkDesc}>{m.desc}</Text>
              </View>
              <Text style={styles.linkArrow}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CurrencyPicker({
  label, value, onChange, currencies,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  currencies: Currency[];
}) {
  const current = currencies.find((c) => c.code === value);
  const [open, setOpen] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <Text style={pickerStyles.label}>{label}</Text>
      <Pressable style={pickerStyles.picker} onPress={() => setOpen(!open)}>
        <Text style={pickerStyles.flag}>{current?.flag}</Text>
        <Text style={pickerStyles.code}>{value}</Text>
      </Pressable>
      {open && (
        <View style={pickerStyles.dropdown}>
          {currencies.map((c) => (
            <Pressable
              key={c.code}
              style={pickerStyles.item}
              onPress={() => {
                onChange(c.code);
                setOpen(false);
              }}
            >
              <Text style={pickerStyles.itemText}>
                {c.flag} {c.code} · {c.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  label: {
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
    marginBottom: Spacing.xs,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceAlt,
    paddingVertical: Spacing.md,
    borderRadius: 12,
  },
  flag: { fontSize: 20 },
  code: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dropdown: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    ...Shadows.strong,
    zIndex: 10,
  },
  item: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemText: {
    fontSize: Typography.bodyMedium,
    color: Colors.textPrimary,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.xxl, paddingBottom: Spacing.huge },
  title: {
    fontSize: Typography.displaySmall,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: Typography.headlineSmall,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: Spacing.lg,
    ...Shadows.soft,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  swapBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  swapIcon: {
    color: Colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  amountGroup: { marginBottom: Spacing.lg },
  amountLabel: {
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
    marginBottom: Spacing.xs,
  },
  amountInput: {
    fontSize: Typography.headlineMedium,
    fontWeight: '700',
    color: Colors.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    paddingVertical: Spacing.sm,
  },
  resultBox: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: Typography.labelMedium,
    color: Colors.accent,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    letterSpacing: 1,
  },
  resultValue: {
    fontSize: Typography.displayMedium,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  rateNote: {
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  linkCards: { gap: Spacing.sm },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.soft,
  },
  linkIcon: { fontSize: 28 },
  linkLabel: {
    fontSize: Typography.bodyLarge,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  linkDesc: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
  },
  linkArrow: {
    fontSize: 24,
    color: Colors.textTertiary,
  },
});
