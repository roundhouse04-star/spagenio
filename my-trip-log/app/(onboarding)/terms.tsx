import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Typography, Spacing, Fonts } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { getDB } from '@/db/database';
import { registerOnServer } from '@/utils/serverStats';
import { haptic } from '@/utils/haptics';

export default function TermsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeDisclaimer, setAgreeDisclaimer] = useState(false);
  const [agreeStats, setAgreeStats] = useState(true);
  const [agreeSnsAlert, setAgreeSnsAlert] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canProceed = agreeTerms && agreePrivacy && agreeDisclaimer;

  const toggleAll = (val: boolean) => {
    haptic.medium();
    setAgreeTerms(val);
    setAgreePrivacy(val);
    setAgreeDisclaimer(val);
    setAgreeStats(val);
    setAgreeSnsAlert(val);
  };
  const allChecked =
    agreeTerms && agreePrivacy && agreeDisclaimer && agreeStats && agreeSnsAlert;

  const handleComplete = async () => {
    if (!canProceed || submitting) {
      if (!canProceed) haptic.warning();
      return;
    }
    setSubmitting(true);
    try {
      const db = await getDB();
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE user
         SET agree_terms = 1,
             agree_privacy = 1,
             agree_disclaimer = 1,
             agree_stats = ?,
             agree_sns_alert = ?,
             updated_at = ?
         WHERE id = (SELECT id FROM user LIMIT 1)`,
        [agreeStats ? 1 : 0, agreeSnsAlert ? 1 : 0, now]
      );

      if (agreeStats) {
        await registerOnServer();
      }

      haptic.success();
      router.replace('/(tabs)');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>STEP 02 / 02</Text>
        <Text style={styles.title}>약관에{'\n'}동의해주세요</Text>
        <Text style={styles.subtitle}>
          Triplive 사용을 위해 아래 약관을 확인해주세요
        </Text>

        <Pressable
          style={styles.allCard}
          onPress={() => toggleAll(!allChecked)}
        >
          <View style={[styles.checkbox, allChecked && styles.checkboxActive]}>
            {allChecked && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.allText}>전체 동의 (선택 항목 포함)</Text>
        </Pressable>

        <View style={styles.termCard}>
          <Pressable
            style={styles.termHeader}
            onPress={() => { haptic.select(); setAgreeTerms(!agreeTerms); }}
          >
            <View style={[styles.checkbox, agreeTerms && styles.checkboxActive]}>
              {agreeTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termTitle}>
              <Text style={styles.required}>[필수]</Text> 서비스 이용약관
            </Text>
          </Pressable>
          <Text style={styles.termBody}>
            본 약관은 Triplive 앱의 사용 방법을 안내합니다.
            앱은 사용자의 여행 정보를 기기 로컬 저장소에만 보관하며,
            동의한 경우에만 익명 통계가 외부로 전송됩니다.
          </Text>
        </View>

        <View style={styles.termCard}>
          <Pressable
            style={styles.termHeader}
            onPress={() => { haptic.select(); setAgreePrivacy(!agreePrivacy); }}
          >
            <View style={[styles.checkbox, agreePrivacy && styles.checkboxActive]}>
              {agreePrivacy && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termTitle}>
              <Text style={styles.required}>[필수]</Text> 개인정보 처리방침
            </Text>
          </Pressable>
          <Text style={styles.termBody}>
            닉네임, 국적 등의 정보는 기기 로컬 DB에만 저장되며,
            앱 삭제 시 완전히 제거됩니다.
            아래 선택 항목에 동의하지 않으면 외부로 전송되지 않습니다.
          </Text>
        </View>

        <View style={styles.termCard}>
          <Pressable
            style={styles.termHeader}
            onPress={() => { haptic.select(); setAgreeDisclaimer(!agreeDisclaimer); }}
          >
            <View style={[styles.checkbox, agreeDisclaimer && styles.checkboxActive]}>
              {agreeDisclaimer && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termTitle}>
              <Text style={styles.required}>[필수]</Text> 면책 조항 확인
            </Text>
          </Pressable>
          <Text style={styles.termBody}>
            본 앱은 무료 개인 도구로 &ldquo;있는 그대로(AS IS)&rdquo; 제공됩니다.
            환율·교통·AI 일정 등은 참고용이며, 데이터 손실·부정확성으로 인한 손해에
            개발자는 책임지지 않습니다.
          </Text>
          <Pressable
            style={styles.detailLink}
            onPress={() => { haptic.tap(); router.push('/(onboarding)/disclaimer'); }}
          >
            <Text style={styles.detailLinkText}>자세히 보기 →</Text>
          </Pressable>
        </View>

        <View style={styles.optionalSection}>
          <Text style={styles.optionalLabel}>OPTIONAL</Text>
          <Text style={styles.optionalDesc}>
            동의하지 않아도 앱 이용에 제한은 없어요
          </Text>
        </View>

        <View style={styles.termCard}>
          <Pressable
            style={styles.termHeader}
            onPress={() => { haptic.select(); setAgreeStats(!agreeStats); }}
          >
            <View style={[styles.checkbox, agreeStats && styles.checkboxActive]}>
              {agreeStats && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termTitle}>
              <Text style={styles.optional}>[선택]</Text> 익명 통계 수집 동의
            </Text>
          </Pressable>
          <Text style={styles.termBody}>
            앱 개선을 위해 익명 ID와 함께 다음 정보를 수집합니다:{'\n'}
            • 국적, OS, 앱 버전, 기기 언어{'\n'}
            • 여행 기록 개수 (제목/내용은 절대 전송 안 됨){'\n'}
            • 마지막 접속일{'\n'}{'\n'}
            ⚠️ 개인 식별 불가능한 익명 ID로만 수집됩니다.
          </Text>
        </View>

        <View style={styles.termCard}>
          <Pressable
            style={styles.termHeader}
            onPress={() => { haptic.select(); setAgreeSnsAlert(!agreeSnsAlert); }}
          >
            <View style={[styles.checkbox, agreeSnsAlert && styles.checkboxActive]}>
              {agreeSnsAlert && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termTitle}>
              <Text style={styles.optional}>[선택]</Text> SNS 출시 알림 동의
            </Text>
          </Pressable>
          <Text style={styles.termBody}>
            추후 Triplive 여행 SNS가 출시되면 알림을 받습니다.{'\n'}
            기존 여행 기록을 SNS로 전환할 수 있는 기능이 제공될 예정입니다.{'\n'}
            언제든지 설정에서 변경할 수 있습니다.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[
            styles.primaryButton,
            (!canProceed || submitting) && styles.primaryButtonDisabled,
          ]}
          onPress={handleComplete}
          disabled={!canProceed || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>완료하고 시작하기</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scroll: { padding: Spacing.xxl, paddingTop: Spacing.huge },
  eyebrow: {
    fontFamily: Fonts.bodyEnSemiBold,
    fontSize: Typography.labelSmall,
    color: c.accent,
    letterSpacing: Typography.letterSpacingExtraWide,
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: Fonts.bodyKrBold,
    fontSize: Typography.displaySmall,
    color: c.textPrimary,
    marginBottom: Spacing.sm,
    lineHeight: Typography.displaySmall * 1.3,
  },
  subtitle: {
    fontFamily: Fonts.bodyKr,
    fontSize: Typography.bodyMedium,
    color: c.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: Typography.bodyMedium * 1.6,
  },
  allCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: c.primary,
    borderRadius: 14,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  allText: {
    fontFamily: Fonts.bodyKrBold,
    fontSize: Typography.bodyMedium,
    color: c.textOnPrimary,
    flex: 1,
  },
  termCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  termHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  checkmark: {
    color: c.textOnPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  termTitle: {
    fontFamily: Fonts.bodyKrMedium,
    fontSize: Typography.bodyMedium,
    color: c.textPrimary,
    flex: 1,
  },
  required: { color: c.error, fontFamily: Fonts.bodyKrBold },
  optional: { color: c.tripPlanning, fontFamily: Fonts.bodyKrBold },
  termBody: {
    fontFamily: Fonts.bodyKr,
    fontSize: Typography.bodySmall,
    color: c.textSecondary,
    lineHeight: Typography.bodySmall * 1.7,
    paddingLeft: Spacing.xxxl + Spacing.sm,
  },
  detailLink: {
    paddingLeft: Spacing.xxxl + Spacing.sm,
    paddingTop: Spacing.sm,
  },
  detailLinkText: {
    fontFamily: Fonts.bodyKrMedium,
    fontSize: Typography.labelSmall,
    color: c.accent,
  },
  optionalSection: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  optionalLabel: {
    fontFamily: Fonts.bodyEnSemiBold,
    fontSize: Typography.labelSmall,
    color: c.accent,
    letterSpacing: Typography.letterSpacingExtraWide,
    marginBottom: Spacing.xs,
  },
  optionalDesc: {
    fontFamily: Fonts.bodyKr,
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
  },
  footer: { padding: Spacing.xxl },
  primaryButton: {
    backgroundColor: c.primary,
    paddingVertical: Spacing.lg,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: { backgroundColor: c.textTertiary },
  primaryButtonText: {
    fontFamily: Fonts.bodyEnBold,
    color: c.textOnPrimary,
    fontSize: Typography.bodyLarge,
    letterSpacing: 0.5,
  },
});
}
