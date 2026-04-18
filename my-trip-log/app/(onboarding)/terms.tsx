import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Typography, Spacing } from '@/theme/theme';
import { getDB } from '@/db/database';
import { registerOnServer } from '@/utils/serverStats';

export default function TermsScreen() {
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeStats, setAgreeStats] = useState(true);   // 선택 - 기본 ON 추천
  const [agreeSnsAlert, setAgreeSnsAlert] = useState(false); // 선택 - 기본 OFF
  const [submitting, setSubmitting] = useState(false);

  const canProceed = agreeTerms && agreePrivacy;

  const toggleAll = (val: boolean) => {
    setAgreeTerms(val);
    setAgreePrivacy(val);
    setAgreeStats(val);
    setAgreeSnsAlert(val);
  };
  const allChecked = agreeTerms && agreePrivacy && agreeStats && agreeSnsAlert;

  const handleComplete = async () => {
    if (!canProceed || submitting) return;
    setSubmitting(true);
    try {
      const db = await getDB();
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE user
         SET agree_terms = 1,
             agree_privacy = 1,
             agree_stats = ?,
             agree_sns_alert = ?,
             updated_at = ?
         WHERE id = (SELECT id FROM user LIMIT 1)`,
        [agreeStats ? 1 : 0, agreeSnsAlert ? 1 : 0, now]
      );

      // 통계 동의했으면 서버 등록 시도 (실패해도 무시)
      if (agreeStats) {
        await registerOnServer();
      }

      router.replace('/(tabs)');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>STEP 02 / 02</Text>
        <Text style={styles.title}>약관에 동의해주세요</Text>
        <Text style={styles.subtitle}>
          My Trip Log 사용을 위해 아래 약관을 확인해주세요
        </Text>

        {/* 모두 동의 */}
        <Pressable
          style={styles.allCard}
          onPress={() => toggleAll(!allChecked)}
        >
          <View style={[styles.checkbox, allChecked && styles.checkboxActive]}>
            {allChecked && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.allText}>전체 동의 (선택 항목 포함)</Text>
        </Pressable>

        {/* 필수 약관 */}
        <View style={styles.termCard}>
          <Pressable
            style={styles.termHeader}
            onPress={() => setAgreeTerms(!agreeTerms)}
          >
            <View style={[styles.checkbox, agreeTerms && styles.checkboxActive]}>
              {agreeTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termTitle}>
              <Text style={styles.required}>[필수]</Text> 서비스 이용약관
            </Text>
          </Pressable>
          <Text style={styles.termBody}>
            본 약관은 My Trip Log 앱의 사용 방법을 안내합니다.
            앱은 사용자의 여행 정보를 기기 로컬 저장소에만 보관하며,
            동의한 경우에만 익명 통계가 외부로 전송됩니다.
          </Text>
        </View>

        <View style={styles.termCard}>
          <Pressable
            style={styles.termHeader}
            onPress={() => setAgreePrivacy(!agreePrivacy)}
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

        {/* 선택 동의 */}
        <View style={styles.optionalSection}>
          <Text style={styles.optionalLabel}>선택 동의</Text>
          <Text style={styles.optionalDesc}>
            동의하지 않아도 앱 이용에 제한은 없어요
          </Text>
        </View>

        <View style={styles.termCard}>
          <Pressable
            style={styles.termHeader}
            onPress={() => setAgreeStats(!agreeStats)}
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
            onPress={() => setAgreeSnsAlert(!agreeSnsAlert)}
          >
            <View style={[styles.checkbox, agreeSnsAlert && styles.checkboxActive]}>
              {agreeSnsAlert && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termTitle}>
              <Text style={styles.optional}>[선택]</Text> SNS 출시 알림 동의
            </Text>
          </Pressable>
          <Text style={styles.termBody}>
            추후 spagenio 여행 SNS가 출시되면 알림을 받습니다.{'\n'}
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
            <ActivityIndicator color={Colors.textOnPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>완료하고 시작하기</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.xxl, paddingTop: Spacing.huge },
  eyebrow: {
    fontSize: Typography.labelSmall,
    color: Colors.accent,
    letterSpacing: Typography.letterSpacingExtraWide,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.displaySmall,
    color: Colors.textPrimary,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: Typography.bodyMedium * 1.5,
  },
  allCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  allText: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.textOnPrimary,
    flex: 1,
  },
  termCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
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
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: Colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  termTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  required: { color: Colors.error, fontWeight: '700' },
  optional: { color: Colors.tripPlanning, fontWeight: '700' },
  termBody: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: Typography.bodySmall * 1.6,
    paddingLeft: Spacing.xxxl + Spacing.sm,
  },
  optionalSection: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  optionalLabel: {
    fontSize: Typography.labelMedium,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  optionalDesc: {
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
  },
  footer: { padding: Spacing.xxl },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: { backgroundColor: Colors.textTertiary },
  primaryButtonText: {
    color: Colors.textOnPrimary,
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
