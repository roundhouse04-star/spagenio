/**
 * 실시간 안전 공지 (Phase 2 예정)
 *
 * 1.2 출시 시점: Coming Soon 안내 화면
 * 1.3 (또는 1.2 후반부): Cloudflare 백엔드 + 외교부 안전공지 API 연동
 *
 * Phase 2 데이터 흐름 (계획):
 *  외교부 안전공지 API → Cloudflare Workers 캐싱 → 앱 fetch
 *  사용자 위치 / 트립 국가와 매칭되는 공지 → 푸시 알림 (APNs)
 *  시위 / 자연재해 / 테러 / 사고 / 감염병 발생 등
 */
import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';

const PREVIEW_TYPES = [
  { icon: '🪧', label: '시위 / 집회', desc: '대규모 집회 일정 + 위치 안내' },
  { icon: '🌪', label: '자연재해', desc: '태풍 · 지진 · 홍수 발생 알림' },
  { icon: '🦠', label: '감염병 발생', desc: 'WHO 발표 신규 발생 지역' },
  { icon: '👮', label: '치안 / 범죄', desc: '강도·소매치기 다발 경고' },
  { icon: '🚨', label: '테러 위협', desc: '특정 지역 경계 상향' },
  { icon: '🛂', label: '입국 정책 변경', desc: '비자·격리·서류 요건 변경' },
];

export default function AlertsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <>
      <Stack.Screen options={{ title: '실시간 안전공지', headerBackTitle: '안전' }} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Coming Soon 카드 */}
          <View style={styles.hero}>
            <Text style={styles.heroIcon}>🛰</Text>
            <Text style={styles.heroTitle}>실시간 안전공지</Text>
            <View style={styles.comingBadge}>
              <Text style={styles.comingText}>1.2 후반부 출시 예정</Text>
            </View>
            <Text style={styles.heroDesc}>
              외교부에서 발표하는 해외 안전공지를 실시간으로 받아보고,
              여행중인 국가에서 발생 시 푸시 알림으로 즉시 알림 받을 수 있어요.
            </Text>
          </View>

          {/* 다룰 정보 종류 */}
          <Text style={styles.sectionTitle}>다룰 정보 종류</Text>
          <View style={styles.typeList}>
            {PREVIEW_TYPES.map((t) => (
              <View key={t.label} style={styles.typeCard}>
                <Text style={styles.typeIcon}>{t.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.typeLabel}>{t.label}</Text>
                  <Text style={styles.typeDesc}>{t.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* 작동 방식 */}
          <Text style={styles.sectionTitle}>작동 방식</Text>
          <View style={styles.stepList}>
            <StepRow num="1" title="외교부 안전공지 자동 수집" desc="공식 API 1시간 단위 캐싱" styles={styles} />
            <StepRow num="2" title="진행중 여행과 매칭" desc="여행지 / 위치와 일치하는 공지만 필터링" styles={styles} />
            <StepRow num="3" title="푸시 알림" desc="중요도 따라 알림 (옵트인)" styles={styles} />
            <StepRow num="4" title="앱에서 자세히 보기" desc="공지 원문 + 대처법 안내" styles={styles} />
          </View>

          {/* 임시 대안 안내 */}
          <View style={styles.altCard}>
            <Text style={styles.altTitle}>그 동안 — 외교부 공식 사이트</Text>
            <Text style={styles.altDesc}>
              해외안전여행 (0404.go.kr) 에서 실시간 공지 직접 확인 가능합니다.
            </Text>
            <View style={styles.altBtn}>
              <Text
                style={styles.altBtnText}
                onPress={() => Linking.openURL('https://www.0404.go.kr/dev/notice_list.mofa')}
              >
                외교부 안전공지 보기 ↗
              </Text>
            </View>
          </View>

          <Text style={styles.footer}>
            데이터 출처 (예정): 외교부 해외안전여행{'\n'}
            푸시 알림 옵트인 후 사용 가능
          </Text>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function StepRow({
  num, title, desc, styles,
}: {
  num: string; title: string; desc: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNum}><Text style={styles.stepNumText}>{num}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDesc}>{desc}</Text>
      </View>
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scroll: { padding: Spacing.lg, paddingBottom: Spacing.huge },

    hero: {
      alignItems: 'center',
      padding: Spacing.xl,
      backgroundColor: c.surface,
      borderRadius: 16,
      marginBottom: Spacing.xl,
      ...Shadows.sm,
    },
    heroIcon: { fontSize: 56, marginBottom: Spacing.md },
    heroTitle: {
      fontSize: Typography.titleLarge, fontWeight: '800',
      color: c.textPrimary, marginBottom: Spacing.sm,
    },
    comingBadge: {
      backgroundColor: c.accent + '20',
      paddingHorizontal: Spacing.md, paddingVertical: 4,
      borderRadius: 999, marginBottom: Spacing.md,
    },
    comingText: { color: c.accent, fontSize: Typography.labelSmall, fontWeight: '700' },
    heroDesc: {
      textAlign: 'center', color: c.textSecondary,
      fontSize: Typography.bodyMedium, lineHeight: Typography.bodyMedium * 1.6,
    },

    sectionTitle: {
      fontSize: Typography.bodyMedium, fontWeight: '700',
      color: c.textPrimary, marginBottom: Spacing.md, marginTop: Spacing.md,
    },
    typeList: { gap: Spacing.sm, marginBottom: Spacing.lg },
    typeCard: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: c.surface, padding: Spacing.md,
      borderRadius: 12, ...Shadows.sm,
    },
    typeIcon: { fontSize: 24 },
    typeLabel: { fontSize: Typography.bodyMedium, fontWeight: '700', color: c.textPrimary },
    typeDesc: { fontSize: Typography.labelSmall, color: c.textTertiary, marginTop: 2 },

    stepList: { gap: Spacing.md, marginBottom: Spacing.xl },
    stepRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
    stepNum: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
    },
    stepNumText: { color: c.textOnPrimary, fontWeight: '800' },
    stepTitle: { fontSize: Typography.bodyMedium, fontWeight: '700', color: c.textPrimary },
    stepDesc: { fontSize: Typography.labelSmall, color: c.textTertiary, marginTop: 2 },

    altCard: {
      backgroundColor: c.surfaceAlt, borderRadius: 12,
      padding: Spacing.lg, marginBottom: Spacing.lg,
    },
    altTitle: { fontSize: Typography.bodyMedium, fontWeight: '700', color: c.textPrimary, marginBottom: 6 },
    altDesc: { fontSize: Typography.labelMedium, color: c.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
    altBtn: { alignSelf: 'flex-start' },
    altBtnText: {
      fontSize: Typography.labelMedium, color: c.accent, fontWeight: '700',
    },

    footer: {
      marginTop: Spacing.xl, fontSize: Typography.labelSmall,
      color: c.textTertiary, textAlign: 'center',
      lineHeight: Typography.labelSmall * 1.6,
    },
  });
}
