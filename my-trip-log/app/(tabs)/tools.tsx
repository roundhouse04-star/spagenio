import { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { router } from 'expo-router';
import { getRates, refreshRates, getLastUpdated } from '@/utils/exchange';
import { haptic } from '@/utils/haptics';

type Currency = { code: string; name: string; flag: string };

const CURRENCIES: Currency[] = [
  { code: 'KRW', name: '원', flag: '🇰🇷' },
  { code: 'JPY', name: '엔', flag: '🇯🇵' },
  { code: 'USD', name: '달러', flag: '🇺🇸' },
  { code: 'EUR', name: '유로', flag: '🇪🇺' },
  { code: 'GBP', name: '파운드', flag: '🇬🇧' },
  { code: 'CNY', name: '위안', flag: '🇨🇳' },
  { code: 'THB', name: '바트', flag: '🇹🇭' },
  { code: 'VND', name: '동', flag: '🇻🇳' },
  { code: 'AUD', name: '호주달러', flag: '🇦🇺' },
  { code: 'SGD', name: '싱가포르달러', flag: '🇸🇬' },
  { code: 'HKD', name: '홍콩달러', flag: '🇭🇰' },
  { code: 'CAD', name: '캐나다달러', flag: '🇨🇦' },
  { code: 'TWD', name: '대만달러', flag: '🇹🇼' },
  { code: 'PHP', name: '페소', flag: '🇵🇭' },
];

export default function ToolsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [amount, setAmount] = useState('10000');
  const [from, setFrom] = useState('KRW');
  const [to, setTo] = useState('JPY');

  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 환율 로드 (from 통화 기준)
  const loadRates = useCallback(async (baseCurrency: string, force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = force
        ? await refreshRates(baseCurrency)
        : await getRates(baseCurrency);
      setRates(data);
      const updated = await getLastUpdated(baseCurrency);
      setLastUpdated(updated);
    } catch (err) {
      setError('환율 정보를 가져오지 못했어요. 잠시 후 다시 시도해주세요.');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRates(from);
  }, [from, loadRates]);

  const convertAmount = (amt: string, toCurr: string): string => {
    const num = parseFloat(amt) || 0;
    const rate = rates[toCurr];
    if (!rate) return '-';
    const result = num * rate;
    // 소수점 처리: KRW/JPY/VND/IDR는 정수, 나머지는 2자리
    const noDecimals = ['KRW', 'JPY', 'VND', 'IDR'];
    return noDecimals.includes(toCurr)
      ? Math.round(result).toLocaleString()
      : result.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const swap = () => {
    haptic.select();
    setFrom(to);
    setTo(from);
  };

  const handleRefresh = () => {
    haptic.medium();
    loadRates(from, true);
  };

  const fmtUpdated = (d: Date | null) => {
    if (!d) return '';
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return '방금 갱신';
    if (min < 60) return `${min}분 전 갱신`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}시간 전 갱신`;
    return `${Math.floor(hr / 24)}일 전 갱신`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>도구</Text>
        <Text style={styles.subtitle}>여행에 필요한 모든 도구를 한 곳에</Text>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>💱 환율 계산기</Text>
          <Pressable onPress={handleRefresh} disabled={refreshing}>
            <Text style={styles.refreshLink}>
              {refreshing ? '갱신 중...' : '🔄 새로고침'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerIcon}>⚠️</Text>
          <Text style={styles.disclaimerText}>
            <Text style={styles.disclaimerTitle}>참고용 환율입니다.</Text>{' '}
            실제 거래 시 은행·카드사·환전소 시세와 차이가 있을 수 있어요. 큰 금액은 현지에서 다시 확인해주세요.
          </Text>
        </View>

        <View style={styles.card}>
          {loading ? (
            <View style={{ padding: Spacing.xxl, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ marginTop: Spacing.md, color: colors.textTertiary, fontSize: 13 }}>
                실시간 환율 불러오는 중...
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.currencyRow}>
                <CurrencyPicker
                  label="보낼 통화"
                  value={from}
                  onChange={(v) => { haptic.select(); setFrom(v); }}
                  currencies={CURRENCIES}
                  styles={styles}
                />
                <Pressable style={styles.swapBtn} onPress={swap}>
                  <Text style={styles.swapIcon}>⇄</Text>
                </Pressable>
                <CurrencyPicker
                  label="받을 통화"
                  value={to}
                  onChange={(v) => { haptic.select(); setTo(v); }}
                  currencies={CURRENCIES}
                  styles={styles}
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
                  placeholderTextColor={colors.textTertiary}
                />
              </View>

              <View style={styles.resultBox}>
                <Text style={styles.resultLabel}>
                  {CURRENCIES.find((c) => c.code === to)?.flag} {to}
                </Text>
                <Text style={styles.resultValue}>{convertAmount(amount, to)}</Text>
              </View>

              {error ? (
                <Text style={styles.errorNote}>⚠️ {error}</Text>
              ) : (
                <Text style={styles.rateNote}>
                  ✅ frankfurter.dev 실시간 환율
                  {lastUpdated && ` · ${fmtUpdated(lastUpdated)}`}
                </Text>
              )}

              {/* 인기 환율 빠른 보기 */}
              <View style={styles.quickRates}>
                <Text style={styles.quickRatesTitle}>1 {from} 기준</Text>
                <View style={styles.quickRatesGrid}>
                  {['JPY', 'USD', 'EUR', 'CNY', 'THB', 'VND'].filter(c => c !== from).slice(0, 4).map(c => {
                    const rate = rates[c];
                    if (!rate) return null;
                    const display = ['JPY', 'VND', 'IDR'].includes(c)
                      ? rate.toFixed(2)
                      : rate.toFixed(4);
                    const flag = CURRENCIES.find(cc => cc.code === c)?.flag || '';
                    return (
                      <View key={c} style={styles.quickRateItem}>
                        <Text style={styles.quickRateLabel}>{flag} {c}</Text>
                        <Text style={styles.quickRateValue}>{display}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>🚇 지하철 노선도</Text>

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerIcon}>⚠️</Text>
          <Text style={styles.disclaimerText}>
            <Text style={styles.disclaimerTitle}>참고용 노선 정보입니다.</Text>{' '}
            운행 시간·요금·역명·환승은 변동될 수 있어요. 실제 이용 전 현지 운영사 공식 정보를 확인해주세요.
          </Text>
        </View>

        <View style={styles.linkCards}>
          {[
            { cityId: 'seoul', icon: '🇰🇷', label: '서울 지하철', desc: '1~9호선, 공항철도' },
            { cityId: 'busan', icon: '🇰🇷', label: '부산 지하철', desc: 'Busan Metro' },
            { cityId: 'tokyo', icon: '🇯🇵', label: '도쿄 지하철', desc: 'Tokyo Metro' },
            { cityId: 'osaka', icon: '🇯🇵', label: '오사카 지하철', desc: 'Osaka Metro' },
            { cityId: 'kyoto', icon: '🇯🇵', label: '교토 지하철', desc: 'Kyoto Subway' },
            { cityId: 'fukuoka', icon: '🇯🇵', label: '후쿠오카 지하철', desc: 'Fukuoka Subway' },
            { cityId: 'taipei', icon: '🇹🇼', label: '타이베이 MRT', desc: 'Taipei Metro' },
            { cityId: 'bangkok', icon: '🇹🇭', label: '방콕 BTS/MRT', desc: 'BTS, MRT' },
            { cityId: 'singapore', icon: '🇸🇬', label: '싱가포르 MRT', desc: 'Singapore MRT' },
            { cityId: 'hongkong', icon: '🇭🇰', label: '홍콩 MTR', desc: 'Hong Kong MTR' },
            { cityId: 'shanghai', icon: '🇨🇳', label: '상하이 지하철', desc: 'Shanghai Metro' },
            { cityId: 'beijing', icon: '🇨🇳', label: '베이징 지하철', desc: 'Beijing Subway' },
            { cityId: 'newyork', icon: '🇺🇸', label: '뉴욕 지하철', desc: 'New York Subway' },
            { cityId: 'london', icon: '🇬🇧', label: '런던 지하철', desc: 'London Underground' },
            { cityId: 'paris', icon: '🇫🇷', label: '파리 메트로', desc: 'Paris Metro' },
            { cityId: 'berlin', icon: '🇩🇪', label: '베를린 지하철', desc: 'Berlin U-Bahn' },
            { cityId: 'amsterdam', icon: '🇳🇱', label: '암스테르담 메트로', desc: 'Amsterdam Metro' },
            { cityId: 'barcelona', icon: '🇪🇸', label: '바르셀로나 메트로', desc: 'Barcelona Metro' },
            { cityId: 'rome', icon: '🇮🇹', label: '로마 메트로', desc: 'Roma Metro' },
          ].map((m, i) => (
            <Pressable
              key={m.cityId}
              style={styles.linkCard}
              onPress={() => {
                haptic.tap();
                router.push(`/transit/${m.cityId}`);
              }}
            >
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
  label, value, onChange, currencies, styles,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  currencies: Currency[];
  styles: ReturnType<typeof createStyles>;
}) {
  const [open, setOpen] = useState(false);
  const current = currencies.find((c) => c.code === value);

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <Pressable style={styles.picker} onPress={() => { haptic.tap(); setOpen(!open); }}>
        <Text style={styles.pickerText}>{current?.flag} {current?.code}</Text>
        <Text style={styles.pickerArrow}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && (
        <View style={styles.dropdown}>
          <ScrollView style={{ maxHeight: 240 }}>
            {currencies.map((c) => (
              <Pressable
                key={c.code}
                style={[
                  styles.dropdownItem,
                  value === c.code && styles.dropdownItemActive,
                ]}
                onPress={() => {
                  haptic.select();
                  onChange(c.code);
                  setOpen(false);
                }}
              >
                <Text style={styles.dropdownText}>
                  {c.flag} {c.code} · {c.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scroll: { padding: Spacing.xxl, paddingBottom: Spacing.huge },
  title: {
    fontSize: Typography.displaySmall,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.bodyMedium,
    color: c.textTertiary,
    marginBottom: Spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '700',
    color: c.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  refreshLink: {
    fontSize: Typography.labelMedium,
    color: c.accent,
    fontWeight: '600',
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: c.warning ? c.warning + '15' : '#FFB84D15',
    borderLeftWidth: 3,
    borderLeftColor: c.warning ?? '#FFB84D',
    borderRadius: 8,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.md,
  },
  disclaimerIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  disclaimerText: {
    flex: 1,
    fontSize: Typography.labelSmall,
    color: c.textSecondary,
    lineHeight: Typography.labelSmall * 1.6,
  },
  disclaimerTitle: {
    fontWeight: '700',
    color: c.textPrimary,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    ...Shadows.sm,
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
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  swapIcon: {
    fontSize: 18,
    color: c.primary,
  },
  pickerLabel: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    marginBottom: Spacing.xs,
  },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    backgroundColor: c.surface,
  },
  pickerText: {
    fontSize: Typography.bodyMedium,
    fontWeight: '600',
    color: c.textPrimary,
  },
  pickerArrow: {
    fontSize: 10,
    color: c.textTertiary,
  },
  dropdown: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    backgroundColor: c.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    zIndex: 100,
    ...Shadows.md,
  },
  dropdownItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  dropdownItemActive: {
    backgroundColor: c.surfaceAlt,
  },
  dropdownText: {
    fontSize: Typography.bodyMedium,
    color: c.textPrimary,
  },
  amountGroup: {
    marginBottom: Spacing.lg,
  },
  amountLabel: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    marginBottom: Spacing.xs,
  },
  amountInput: {
    fontSize: Typography.titleLarge,
    fontWeight: '700',
    color: c.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: c.primary,
    paddingVertical: Spacing.sm,
  },
  resultBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: c.primary,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  resultLabel: {
    fontSize: Typography.bodyMedium,
    color: c.accent,
    fontWeight: '600',
  },
  resultValue: {
    fontSize: Typography.titleLarge,
    fontWeight: '700',
    color: c.textOnPrimary,
  },
  rateNote: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorNote: {
    fontSize: Typography.labelSmall,
    color: c.error,
    textAlign: 'center',
  },
  quickRates: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.borderLight,
  },
  quickRatesTitle: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  quickRatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  quickRateItem: {
    flexBasis: '47%',
    backgroundColor: c.surfaceAlt,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
  },
  quickRateLabel: {
    fontSize: Typography.labelSmall,
    color: c.textSecondary,
  },
  quickRateValue: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: c.textPrimary,
    marginTop: 2,
  },
  linkCards: {
    gap: Spacing.sm,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  linkIcon: {
    fontSize: 24,
  },
  linkLabel: {
    fontSize: Typography.bodyMedium,
    fontWeight: '600',
    color: c.textPrimary,
  },
  linkDesc: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    marginTop: 2,
  },
  linkArrow: {
    fontSize: 20,
    color: c.textTertiary,
  },
});
}

