/**
 * 메인 홈 / 트립 상세 상단의 위험 알림 배너
 *
 * 동작:
 *  - 현재 진행중 트립의 국가 여행경보 조회
 *  - 경보 단계에 따라 색상 + 메시지
 *  - 1단계(안전유의) 이상이면 표시
 *
 * 사용처:
 *  - 홈 탭 상단 (진행 중 트립 있을 때)
 *  - 트립 상세 화면 상단
 */
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { fetchAdvisoryByCountry } from '@/utils/safety/mofaClient';
import { ADVISORY_META, type TravelAdvisory } from '@/data/safety/types';

interface Props {
  /** ISO 2자리 국가코드 (예: 'JP', 'TH') */
  countryCode: string;
  /** 트립 이름 (선택, 표시용) */
  tripTitle?: string;
  /** 자세히 보기 화면 진입 */
  onPress?: () => void;
}

export function SafetyBanner({ countryCode, tripTitle, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [advisory, setAdvisory] = useState<TravelAdvisory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAdvisoryByCountry(countryCode);
        if (!cancelled) {
          setAdvisory(data ?? null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countryCode]);

  // 로딩 중 / 데이터 없음 / 0~1단계는 표시 안 함 (너무 빈번)
  // 단, 2단계 (자제) 이상은 명확히 표시
  if (loading) return null;
  if (!advisory) return null;
  if (advisory.level === 0) return null; // 안전 = 표시 X

  const meta = ADVISORY_META[advisory.level];
  const isHighRisk = advisory.level >= 3;

  const handlePress = () => {
    haptic.tap();
    if (onPress) onPress();
    else router.push('/safety' as any);
  };

  return (
    <Pressable onPress={handlePress} style={[styles.container, { borderLeftColor: meta.color }]}>
      <View style={[styles.iconBox, { backgroundColor: meta.color + '20' }]}>
        <Text style={[styles.icon, { color: meta.color }]}>{isHighRisk ? '⚠️' : '🟦'}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[styles.country, { color: colors.textPrimary }]}>{advisory.countryName}</Text>
          <View style={[styles.levelChip, { backgroundColor: meta.color }]}>
            <Text style={styles.levelText}>{meta.label}</Text>
          </View>
        </View>
        <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={2}>
          {meta.description}
        </Text>
        {tripTitle && (
          <Text style={[styles.tripLabel, { color: colors.textTertiary }]}>여행: {tripTitle}</Text>
        )}
      </View>
      <Text style={[styles.arrow, { color: colors.textTertiary }]}>›</Text>
    </Pressable>
  );
}

/**
 * 컴팩트한 버전 — 위시리스트 도시 옆 작은 색상 점
 */
export function SafetyDot({ countryCode }: { countryCode: string }) {
  const [advisory, setAdvisory] = useState<TravelAdvisory | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdvisoryByCountry(countryCode)
      .then((data) => {
        if (!cancelled) setAdvisory(data ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [countryCode]);

  if (!advisory) return null;
  const meta = ADVISORY_META[advisory.level];

  return <View style={[dotStyles.dot, { backgroundColor: meta.color }]} />;
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderLeftWidth: 4,
      gap: Spacing.md,
      ...Shadows.sm,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: {
      fontSize: 20,
    },
    content: {
      flex: 1,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: 4,
    },
    country: {
      fontSize: Typography.bodyMedium,
      fontWeight: '700',
    },
    levelChip: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: 999,
    },
    levelText: {
      color: '#ffffff',
      fontSize: Typography.labelSmall,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    desc: {
      fontSize: Typography.labelMedium,
    },
    tripLabel: {
      fontSize: Typography.labelSmall,
      marginTop: 4,
    },
    arrow: {
      fontSize: 22,
      fontWeight: '600',
    },
  });
}

const dotStyles = StyleSheet.create({
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
