/**
 * 비상 상황 가이드 — 8종 (여권분실/도난/부상/질병/체포/자연재해/돈분실/언어)
 *
 * 출처: src/data/safety/emergencyGuides.ts
 */
import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { EMERGENCY_GUIDES, KOREAN_CONSULAR_HELPLINE } from '@/data/safety/emergencyGuides';
import type { EmergencyGuide } from '@/data/safety/types';

export default function EmergencyGuideScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [openId, setOpenId] = useState<string | null>(null);

  const callHelpline = () => {
    haptic.medium();
    Linking.openURL(`tel:${KOREAN_CONSULAR_HELPLINE.number}`);
  };

  return (
    <>
      <Stack.Screen options={{ title: '비상 상황 가이드', headerBackTitle: '안전' }} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Text style={styles.subtitle}>해외에서 위급한 상황 발생 시 단계별 대처법</Text>
          </View>

          {/* 영사 콜센터 — 모든 비상의 공통 연락처 */}
          <Pressable style={styles.helpline} onPress={callHelpline}>
            <Text style={styles.helplineIcon}>📞</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.helplineLabel}>한국 영사 콜센터 — 24시간</Text>
              <Text style={styles.helplineNumber}>{KOREAN_CONSULAR_HELPLINE.number}</Text>
            </View>
            <Text style={styles.helplineCall}>전화 →</Text>
          </Pressable>

          {/* 8가지 가이드 — 펼침/접힘 */}
          <View style={styles.guideList}>
            {EMERGENCY_GUIDES.map((g) => (
              <GuideCard
                key={g.type}
                guide={g}
                isOpen={openId === g.type}
                onToggle={() => {
                  haptic.tap();
                  setOpenId(openId === g.type ? null : g.type);
                }}
                styles={styles}
              />
            ))}
          </View>

          <Text style={styles.footer}>
            출처: 외교부 해외안전여행 + 영사 콜센터 안내{'\n'}
            상황 별 추가 도움이 필요하시면 영사 콜센터로 우선 연락하세요.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function GuideCard({
  guide, isOpen, onToggle, styles,
}: {
  guide: EmergencyGuide;
  isOpen: boolean;
  onToggle: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.card}>
      <Pressable style={styles.cardHeader} onPress={onToggle}>
        <Text style={styles.cardIcon}>{guide.icon}</Text>
        <Text style={styles.cardTitle}>{guide.titleKo}</Text>
        <Text style={styles.cardArrow}>{isOpen ? '▾' : '›'}</Text>
      </Pressable>
      {isOpen && (
        <View style={styles.cardBody}>
          <Text style={styles.sectionLabel}>대처 단계</Text>
          {guide.stepsKo.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <Text style={styles.stepNum}>{i + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
          {guide.tipsKo && guide.tipsKo.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>팁</Text>
              {guide.tipsKo.map((tip, i) => (
                <Text key={i} style={styles.tipText}>• {tip}</Text>
              ))}
            </>
          )}
          {guide.relatedContacts && guide.relatedContacts.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>관련 연락처</Text>
              <Text style={styles.contactText}>
                {guide.relatedContacts.join(' · ')}
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scroll: { padding: Spacing.lg, paddingBottom: Spacing.huge },
    header: { marginBottom: Spacing.lg },
    subtitle: {
      fontSize: Typography.bodyMedium, color: c.textSecondary,
    },
    helpline: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: '#dc2626', borderRadius: 12, padding: Spacing.lg,
      marginBottom: Spacing.lg, ...Shadows.md,
    },
    helplineIcon: { fontSize: 28 },
    helplineLabel: { color: '#fff', fontSize: Typography.labelMedium, opacity: 0.9 },
    helplineNumber: { color: '#fff', fontSize: Typography.titleMedium, fontWeight: '800', marginTop: 2 },
    helplineCall: { color: '#fff', fontSize: Typography.bodyMedium, fontWeight: '700' },

    guideList: { gap: Spacing.sm },
    card: {
      backgroundColor: c.surface, borderRadius: 12, ...Shadows.sm,
      overflow: 'hidden',
    },
    cardHeader: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      padding: Spacing.md,
    },
    cardIcon: { fontSize: 24 },
    cardTitle: { flex: 1, fontSize: Typography.bodyMedium, fontWeight: '700', color: c.textPrimary },
    cardArrow: { fontSize: 18, color: c.textTertiary },
    cardBody: {
      paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderLight,
      paddingTop: Spacing.md,
    },
    sectionLabel: {
      fontSize: Typography.labelSmall, fontWeight: '700',
      color: c.accent, marginBottom: Spacing.sm,
      letterSpacing: 0.5, textTransform: 'uppercase',
    },
    stepRow: {
      flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm,
    },
    stepNum: {
      width: 24, height: 24, borderRadius: 12,
      backgroundColor: c.primary, color: c.textOnPrimary,
      fontSize: Typography.labelSmall, fontWeight: '800',
      textAlign: 'center', textAlignVertical: 'center', lineHeight: 24,
    },
    stepText: {
      flex: 1, fontSize: Typography.bodyMedium, color: c.textPrimary,
      lineHeight: Typography.bodyMedium * 1.5,
    },
    tipText: {
      fontSize: Typography.labelMedium, color: c.textSecondary,
      lineHeight: Typography.labelMedium * 1.6, marginBottom: 4,
    },
    contactText: {
      fontSize: Typography.labelMedium, color: c.textSecondary, fontStyle: 'italic',
    },
    footer: {
      marginTop: Spacing.xl, fontSize: Typography.labelSmall,
      color: c.textTertiary, textAlign: 'center',
      lineHeight: Typography.labelSmall * 1.6,
    },
  });
}
