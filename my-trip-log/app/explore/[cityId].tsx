import { useMemo, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { Typography, Spacing, Shadows, Fonts } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { DESTINATIONS, CATEGORIES } from '@/data/destinations';
import { getRates } from '@/utils/exchange';
import transitData from '@/data/transit.json';

export default function CityDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { cityId } = useLocalSearchParams<{ cityId: string }>();
  const city = DESTINATIONS.find(d => d.id === cityId);

  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(true);

  useEffect(() => {
    if (!city || city.currency === 'KRW') {
      setLoadingRate(false);
      return;
    }
    (async () => {
      try {
        const rates = await getRates('KRW');
        const rate = rates[city.currency];
        if (rate) {
          setExchangeRate(1 / rate); // 1 외화 = X KRW
        }
      } catch {
        // 무시
      } finally {
        setLoadingRate(false);
      }
    })();
  }, [city]);

  // 해당 도시 교통 데이터 있는지
  const transitLines = (() => {
    const data = transitData as { lines?: { cityId: string }[] };
    return (data.lines ?? []).filter((l) => l.cityId === cityId).length;
  })();

  if (!city) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>도시를 찾을 수 없어요</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentMonth = new Date().getMonth() + 1;
  const isBestSeason = city.bestMonths.includes(currentMonth);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 히어로 */}
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>{city.icon}</Text>
          <Text style={styles.heroFlag}>{city.flag}</Text>
          <Text style={styles.heroName}>{city.name}</Text>
          <Text style={styles.heroNameEn}>{city.nameEn}</Text>
          <Text style={styles.heroCountry}>{city.country}</Text>
        </View>

        {/* 기본 정보 카드 */}
        <View style={styles.infoGrid}>
          <InfoItem label="통화" value={city.currency} styles={styles} />
          <InfoItem label="언어" value={city.language} styles={styles} />
          <InfoItem label="시차" value={city.timeZone} styles={styles} />
          {city.flightHours && <InfoItem label="비행 시간" value={city.flightHours} styles={styles} />}
        </View>

        {/* 지금 가기 좋은 시기 */}
        <View style={[styles.seasonBox, isBestSeason && styles.seasonBoxActive]}>
          <Text style={styles.seasonLabel}>
            {isBestSeason ? '✨ 지금이 최적의 시기!' : '🗓️ 가기 좋은 시기'}
          </Text>
          <View style={styles.monthRow}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
              const isBest = city.bestMonths.includes(m);
              const isNow = m === currentMonth;
              return (
                <View
                  key={m}
                  style={[
                    styles.monthChip,
                    isBest && styles.monthChipBest,
                    isNow && styles.monthChipNow,
                  ]}
                >
                  <Text style={[
                    styles.monthText,
                    (isBest || isNow) && styles.monthTextActive,
                  ]}>
                    {m}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 실시간 환율 */}
        {city.currency !== 'KRW' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>💱 실시간 환율</Text>
            {loadingRate ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.md }} />
            ) : exchangeRate ? (
              <View style={styles.rateBox}>
                <Text style={styles.rateMain}>
                  1 {city.currency} = ₩{exchangeRate.toFixed(2)}
                </Text>
                <Pressable
                  style={styles.rateBtn}
                  onPress={() => { haptic.tap(); router.push('/(tabs)/tools'); }}
                >
                  <Text style={styles.rateBtnText}>환율 계산기 →</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.errorText}>환율 정보 없음</Text>
            )}
          </View>
        )}

        {/* 교통 연결 */}
        {transitLines > 0 && (
          <Pressable
            style={styles.transitCard}
            onPress={() => { haptic.tap(); router.push(`/transit/${cityId}`); }}
          >
            <Text style={styles.transitIcon}>🚇</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.transitTitle}>지하철 노선 보기</Text>
              <Text style={styles.transitSub}>{transitLines}개 노선 · 역 정보</Text>
            </View>
            <Text style={styles.transitArrow}>›</Text>
          </Pressable>
        )}

        {/* 카테고리 태그 */}
        <View style={styles.tagsBox}>
          {city.categories.map(cat => {
            const info = CATEGORIES.find(c => c.key === cat);
            if (!info) return null;
            return (
              <View key={cat} style={styles.categoryTag}>
                <Text style={styles.categoryTagText}>
                  {info.icon} {info.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* 대표 명소 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📍 대표 명소</Text>
          <View style={styles.highlightList}>
            {city.highlights.map((h, i) => (
              <View key={i} style={styles.highlightItem}>
                <Text style={styles.highlightNum}>{i + 1}</Text>
                <Text style={styles.highlightText}>{h}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 여행 팁 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💡 현지 팁</Text>
          {city.tips.map((tip, i) => (
            <View key={i} style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: Spacing.huge }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoItem({ label, value, styles }: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 22, color: c.textPrimary },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: Typography.bodyMedium,
    color: c.textTertiary,
  },

  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.huge },

  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  heroIcon: { fontSize: 80, marginBottom: Spacing.sm },
  heroFlag: { fontSize: 24, marginBottom: Spacing.xs },
  heroName: {
    fontSize: Typography.displayMedium,
    fontWeight: '700',
    color: c.textPrimary,
    letterSpacing: -0.5,
  },
  heroNameEn: {
    fontFamily: Fonts.display,
    fontSize: Typography.titleLarge,
    color: c.accent,
    fontStyle: 'italic',
    marginTop: 2,
  },
  heroCountry: {
    fontSize: Typography.labelMedium,
    color: c.textTertiary,
    marginTop: Spacing.xs,
    letterSpacing: 1,
  },

  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  infoItem: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: c.surface,
    padding: Spacing.md,
    borderRadius: 12,
    ...Shadows.sm,
  },
  infoLabel: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: c.textPrimary,
  },

  seasonBox: {
    backgroundColor: c.surface,
    padding: Spacing.lg,
    borderRadius: 14,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  seasonBoxActive: {
    backgroundColor: c.surfaceAlt,
    borderWidth: 2,
    borderColor: c.accent,
  },
  seasonLabel: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: Spacing.md,
  },
  monthRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  monthChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthChipBest: {
    backgroundColor: c.accent,
  },
  monthChipNow: {
    backgroundColor: c.primary,
  },
  monthText: {
    fontSize: 12,
    fontWeight: '600',
    color: c.textTertiary,
  },
  monthTextActive: {
    color: '#fff',
  },

  card: {
    backgroundColor: c.surface,
    padding: Spacing.lg,
    borderRadius: 14,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  cardTitle: {
    fontSize: Typography.titleSmall,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: Spacing.md,
  },

  rateBox: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rateMain: {
    fontSize: Typography.titleMedium,
    fontWeight: '700',
    color: c.primary,
  },
  rateBtn: {
    backgroundColor: c.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 10,
  },
  rateBtnText: {
    color: c.textOnPrimary,
    fontWeight: '600',
    fontSize: Typography.labelMedium,
  },
  errorText: {
    fontSize: Typography.bodyMedium,
    color: c.textTertiary,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },

  transitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: c.primary,
    padding: Spacing.lg,
    borderRadius: 14,
    marginBottom: Spacing.lg,
  },
  transitIcon: { fontSize: 28 },
  transitTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: c.textOnPrimary,
  },
  transitSub: {
    fontSize: Typography.labelSmall,
    color: c.accent,
    marginTop: 2,
  },
  transitArrow: {
    fontSize: 24,
    color: c.textOnPrimary,
  },

  tagsBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  categoryTag: {
    backgroundColor: c.surfaceAlt,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 999,
  },
  categoryTagText: {
    fontSize: Typography.labelMedium,
    color: c.textSecondary,
    fontWeight: '600',
  },

  highlightList: {
    gap: Spacing.sm,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  highlightNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.primary,
    color: c.textOnPrimary,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 11,
    fontWeight: '700',
  },
  highlightText: {
    flex: 1,
    fontSize: Typography.bodyMedium,
    color: c.textPrimary,
  },

  tipItem: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tipBullet: {
    fontSize: 16,
    color: c.accent,
    fontWeight: '700',
    lineHeight: 20,
  },
  tipText: {
    flex: 1,
    fontSize: Typography.bodyMedium,
    color: c.textSecondary,
    lineHeight: Typography.bodyMedium * 1.6,
  },
});
}
