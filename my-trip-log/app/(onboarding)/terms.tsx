import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Typography, Spacing } from '@/theme/theme';
import { getDB } from '@/db/database';

export default function TermsScreen() {
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const canProceed = agreeTerms && agreePrivacy;

  const handleComplete = async () => {
    if (!canProceed) return;
    const db = await getDB();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE user SET agree_terms = 1, agree_privacy = 1, updated_at = ? WHERE id = (SELECT id FROM user LIMIT 1)`,
      [now]
    );
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>STEP 02 / 02</Text>
        <Text style={styles.title}>약관에 동의해주세요</Text>
        <Text style={styles.subtitle}>
          My Trip Log 사용을 위해 아래 약관에 동의해주세요
        </Text>

        <View style={styles.termCard}>
          <View style={styles.termHeader}>
            <Pressable
              style={[styles.checkbox, agreeTerms && styles.checkboxActive]}
              onPress={() => setAgreeTerms(!agreeTerms)}
            >
              {agreeTerms && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>
            <Text style={styles.termTitle}>서비스 이용약관 (필수)</Text>
          </View>
          <Text style={styles.termBody}>
            본 약관은 My Trip Log 앱의 사용 방법을 안내합니다.
            앱은 사용자의 여행 정보를 기기 로컬 저장소에만 보관하며,
            외부 서버로 전송하지 않습니다.
          </Text>
        </View>

        <View style={styles.termCard}>
          <View style={styles.termHeader}>
            <Pressable
              style={[styles.checkbox, agreePrivacy && styles.checkboxActive]}
              onPress={() => setAgreePrivacy(!agreePrivacy)}
            >
              {agreePrivacy && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>
            <Text style={styles.termTitle}>개인정보 처리방침 (필수)</Text>
          </View>
          <Text style={styles.termBody}>
            닉네임, 국적 등의 정보는 기기 로컬 DB에만 저장되며,
            앱 삭제 시 완전히 제거됩니다.
            외부로 유출되지 않습니다.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryButton, !canProceed && styles.primaryButtonDisabled]}
          onPress={handleComplete}
          disabled={!canProceed}
        >
          <Text style={styles.primaryButtonText}>완료하고 시작하기</Text>
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
    marginBottom: Spacing.huge,
    lineHeight: Typography.bodyMedium * 1.5,
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
  termBody: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: Typography.bodySmall * 1.6,
    paddingLeft: Spacing.xxxl + Spacing.sm,
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
