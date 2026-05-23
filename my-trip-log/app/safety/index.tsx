/**
 * 도구 탭 → 여행 안전 메인 화면
 *
 * 섹션:
 *  1. 진행중 트립 위험 경보 (Top)
 *  2. 메뉴 — 경보, 안전공지, 감염병, 대사관, 비상가이드
 *  3. 한국 영사 콜센터 (하단 항상 노출)
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import * as Location from 'expo-location';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { KOREAN_CONSULAR_HELPLINE } from '@/data/safety/emergencyGuides';
import { fetchHighRiskCountries } from '@/utils/safety/mofaClient';
import { ADVISORY_META, type TravelAdvisory } from '@/data/safety/types';
import { getActiveTrip } from '@/db/trips';
import { requestAlwaysPermissionIfNeeded, syncDangerRegions, stopAllGeofencing } from '@/utils/safety/geofencing';
import { getDangerRegionsByCountry } from '@/data/safety/dangerRegions';

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
  const [locationGranted, setLocationGranted] = useState(false);
  const [dangerRegionCount, setDangerRegionCount] = useState(0);

  useEffect(() => {
    (async () => {
      // 진행중 트립의 국가 가져오기 (있으면)
      try {
        const trip = await getActiveTrip();
        if (trip?.countryCode) {
          setActiveCountry(trip.countryCode);
          setDangerRegionCount(getDangerRegionsByCountry(trip.countryCode).length);
        }
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

      // 백그라운드 위치 권한 상태 확인
      try {
        const bg = await Location.getBackgroundPermissionsAsync();
        setLocationGranted(bg.status === 'granted');
      } catch {
        setLocationGranted(false);
      }
    })();
  }, []);

  const enableLocationAlerts = useCallback(async () => {
    haptic.medium();
    Alert.alert(
      '위험 지역 진입 알림',
      [
        '여행 중 외교부가 지정한 위험 지역(예: 후쿠시마 원전, 태국 남부 분쟁지역)에',
        '진입하면 자동으로 알림을 보내드려요.',
        '',
        '• 위치는 디바이스 안에서만 사용됩니다',
        '• 외부 서버로 전송되지 않습니다',
        '• "항상 허용" 선택하면 앱이 꺼져있어도 알림 가능',
      ].join('\n'),
      [
        { text: '취소', style: 'cancel' },
        {
          text: '권한 설정',
          onPress: async () => {
            const ok = await requestAlwaysPermissionIfNeeded();
            setLocationGranted(ok);
            if (ok && activeCountry) {
              await syncDangerRegions([activeCountry]);
              Alert.alert('완료', '위험 지역 진입 시 알림을 보내드릴게요.');
            } else if (!ok) {
              Alert.alert('권한 거부됨', '설정 앱에서 직접 허용할 수 있어요.');
            }
          },
        },
      ],
    );
  }, [activeCountry]);

  const disableLocationAlerts = useCallback(async () => {
    haptic.medium();
    Alert.alert(
      '위험 지역 알림 끄기',
      '위치 권한은 유지되지만 위험 지역 진입 알림은 더 이상 받지 않습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '끄기',
          style: 'destructive',
          onPress: async () => {
            await stopAllGeofencing();
            Alert.alert('완료', '위험 지역 알림을 껐어요.');
          },
        },
      ],
    );
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

          {/* 위험 지역 진입 알림 — 진행중 트립이 있고 위험 region 등록된 국가일 때 */}
          {activeCountry && dangerRegionCount > 0 && (
            <Pressable
              style={[styles.geoCard, locationGranted ? styles.geoCardOn : styles.geoCardOff]}
              onPress={locationGranted ? disableLocationAlerts : enableLocationAlerts}
            >
              <View style={styles.geoIconBox}>
                <Text style={styles.geoIcon}>{locationGranted ? '📡' : '📍'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.geoTitle}>
                  {locationGranted
                    ? `위험 지역 진입 알림 켜짐 (${dangerRegionCount}곳)`
                    : '위험 지역 진입 알림 켜기'}
                </Text>
                <Text style={styles.geoDesc}>
                  {locationGranted
                    ? `${activeCountry}의 외교부 지정 위험 지역에 접근하면 자동 알림`
                    : `${activeCountry}의 ${dangerRegionCount}개 위험 지역 등록 가능 (위치 권한 필요)`}
                </Text>
              </View>
              <Text style={styles.geoArrow}>{locationGranted ? '⏻' : '›'}</Text>
            </Pressable>
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

    geoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      borderRadius: 12,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
      ...Shadows.sm,
    },
    geoCardOff: {
      backgroundColor: c.surface,
      borderLeftWidth: 3,
      borderLeftColor: c.accent,
    },
    geoCardOn: {
      backgroundColor: '#10B981' + '10',
      borderLeftWidth: 3,
      borderLeftColor: '#10B981',
    },
    geoIconBox: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center', justifyContent: 'center',
    },
    geoIcon: { fontSize: 20 },
    geoTitle: {
      fontSize: Typography.bodyMedium,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: 2,
    },
    geoDesc: {
      fontSize: Typography.labelSmall,
      color: c.textSecondary,
    },
    geoArrow: { fontSize: 18, color: c.textTertiary },
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
