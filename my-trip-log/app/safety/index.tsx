/**
 * 도구 탭 → 여행 안전 메인 화면
 *
 * 섹션:
 *  1. 진행중 트립 위험 경보 (Top)
 *  2. 메뉴 — 경보, 안전공지, 감염병, 대사관, 비상가이드
 *  3. 한국 영사 콜센터 (하단 항상 노출)
 */
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { KOREAN_CONSULAR_HELPLINE } from '@/data/safety/emergencyGuides';
import { fetchHighRiskCountries } from '@/utils/safety/mofaClient';
import { ADVISORY_META, type TravelAdvisory } from '@/data/safety/types';
import { getActiveTrip } from '@/db/trips';

interface MenuItem {
  icon: string;
  title: string;
  desc: string;
  route: string;
}

const MENU: MenuItem[] = [
  {
    icon: '🟦',
    title: '여행 경보 (국가별)',
    desc: '외교부 위험도 4단계로 확인',
    route: '/safety/advisory',
  },
  {
    icon: '📰',
    title: '안전공지 (실시간)',
    desc: '시위·자연재해·테러 등 외교부 발표',
    route: '/safety/alerts',
  },
  {
    icon: '🦠',
    title: '감염병 정보',
    desc: '국가별 권장 백신 + 예방 수칙',
    route: '/safety/diseases',
  },
  {
    icon: '🏛',
    title: '대사관 / 영사관',
    desc: '도시별 위치 + 긴급 연락처',
    route: '/safety/embassies',
  },
  {
    icon: '🆘',
    title: '비상 상황 가이드',
    desc: '여권분실·도난·부상·체포 대처법',
    route: '/safety/emergency',
  },
];

export default function SafetyHomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [highRisk, setHighRisk] = useState<TravelAdvisory[]>([]);
  const [activeCountry, setActiveCountry] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // 진행중 트립의 국가 가져오기 (있으면)
      try {
        const trip = await getActiveTrip();
        if (trip?.countryCode) setActiveCountry(trip.countryCode);
      } catch {
        // 진행 트립 없음 — 정상
      }

      // 고위험 국가 목록
      try {
        const data = await fetchHighRiskCountries(2);
        setHighRisk(data.slice(0, 5)); // 상위 5개만
      } catch {
        // API 활성화 전이면 빈 배열
      }
    })();
  }, []);

  const callHelpline = () => {
    haptic.medium();
    Linking.openURL(`tel:${KOREAN_CONSULAR_HELPLINE.number}`);
  };

  return (
    <>
      <Stack.Screen options={{ title: '여행 안전', headerBackTitle: '뒤로' }} />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* 헤더 */}
          <View style={styles.header}>
            <Text style={styles.title}>🛡 여행 안전</Text>
            <Text style={styles.subtitle}>외교부 공식 정보 기반 안전 종합 도구</Text>
          </View>

          {/* 현재 고위험 국가 알림 (2단계 이상) */}
          {highRisk.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⚠️ 현재 고위험 국가 (2단계 이상)</Text>
              <View style={styles.riskList}>
                {highRisk.map((adv) => {
                  const meta = ADVISORY_META[adv.level];
                  return (
                    <View key={adv.countryCode} style={styles.riskRow}>
                      <View style={[styles.dot, { backgroundColor: meta.color }]} />
                      <Text style={styles.riskCountry}>{adv.countryName}</Text>
                      <Text style={[styles.riskLevel, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.note}>외교부 출처. 변동 시 자동 업데이트.</Text>
            </View>
          )}

          {/* 진행중 트립 안내 */}
          {activeCountry && (
            <View style={styles.activeTrip}>
              <Text style={styles.activeTripLabel}>📍 진행중 여행: {activeCountry}</Text>
              <Text style={styles.activeTripDesc}>
                여행 경보 + 안전공지를 자동으로 확인해드려요
              </Text>
            </View>
          )}

          {/* 메뉴 */}
          <View style={styles.menuList}>
            {MENU.map((item) => (
              <Pressable
                key={item.route}
                style={styles.menuItem}
                onPress={() => {
                  haptic.tap();
                  router.push(item.route as any);
                }}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuDesc}>{item.desc}</Text>
                </View>
                <Text style={styles.menuArrow}>›</Text>
              </Pressable>
            ))}
          </View>

          {/* 영사 콜센터 (항상 노출) */}
          <Pressable style={styles.helpline} onPress={callHelpline}>
            <View style={styles.helplineIconBox}>
              <Text style={styles.helplineIcon}>📞</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.helplineLabel}>한국 영사 콜센터</Text>
              <Text style={styles.helplineNumber}>{KOREAN_CONSULAR_HELPLINE.number}</Text>
              <Text style={styles.helplineHours}>{KOREAN_CONSULAR_HELPLINE.hours}</Text>
            </View>
            <Text style={styles.helplineCall}>전화 →</Text>
          </Pressable>

          <Text style={styles.footer}>
            데이터 출처: 외교부 해외안전여행 · WHO · 한국 영사 콜센터
            {'\n'}
            긴급 상황 시 위 콜센터로 우선 연락하세요.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scroll: { padding: Spacing.lg, paddingBottom: Spacing.huge },
    header: { marginBottom: Spacing.xl },
    title: {
      fontSize: Typography.displaySmall,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: Spacing.xs,
    },
    subtitle: {
      fontSize: Typography.bodyMedium,
      color: c.textTertiary,
    },
    section: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      ...Shadows.sm,
    },
    sectionTitle: {
      fontSize: Typography.bodyMedium,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: Spacing.md,
    },
    riskList: { gap: Spacing.sm },
    riskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    dot: { width: 10, height: 10, borderRadius: 5 },
    riskCountry: {
      flex: 1,
      fontSize: Typography.bodyMedium,
      color: c.textPrimary,
    },
    riskLevel: {
      fontSize: Typography.labelMedium,
      fontWeight: '700',
    },
    note: {
      fontSize: Typography.labelSmall,
      color: c.textTertiary,
      marginTop: Spacing.sm,
      fontStyle: 'italic',
    },
    activeTrip: {
      backgroundColor: c.primary + '10',
      borderRadius: 12,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
      borderLeftWidth: 3,
      borderLeftColor: c.primary,
    },
    activeTripLabel: {
      fontSize: Typography.bodyMedium,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: 2,
    },
    activeTripDesc: {
      fontSize: Typography.labelMedium,
      color: c.textSecondary,
    },
    menuList: { gap: Spacing.sm, marginBottom: Spacing.xl },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: Spacing.md,
      ...Shadows.sm,
    },
    menuIcon: { fontSize: 24 },
    menuTitle: {
      fontSize: Typography.bodyMedium,
      fontWeight: '700',
      color: c.textPrimary,
    },
    menuDesc: {
      fontSize: Typography.labelSmall,
      color: c.textTertiary,
      marginTop: 2,
    },
    menuArrow: { fontSize: 22, color: c.textTertiary },
    helpline: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#dc2626',
      borderRadius: 12,
      padding: Spacing.lg,
      gap: Spacing.md,
      ...Shadows.md,
    },
    helplineIconBox: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    helplineIcon: { fontSize: 24 },
    helplineLabel: {
      fontSize: Typography.labelMedium,
      color: '#fff',
      fontWeight: '600',
      opacity: 0.9,
    },
    helplineNumber: {
      fontSize: Typography.titleMedium,
      fontWeight: '800',
      color: '#fff',
      marginTop: 2,
    },
    helplineHours: {
      fontSize: Typography.labelSmall,
      color: '#fff',
      opacity: 0.85,
      marginTop: 2,
    },
    helplineCall: {
      fontSize: Typography.bodyMedium,
      fontWeight: '700',
      color: '#fff',
    },
    footer: {
      marginTop: Spacing.xl,
      fontSize: Typography.labelSmall,
      color: c.textTertiary,
      textAlign: 'center',
      lineHeight: Typography.labelSmall * 1.6,
    },
  });
}
