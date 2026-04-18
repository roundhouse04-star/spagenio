import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Typography, Spacing } from '@/theme/theme';
import { getDB, generateAnonId } from '@/db/database';
import { haptic } from '@/utils/haptics';

export default function NicknameScreen() {
  const [nickname, setNickname] = useState('');
  const [nationality, setNationality] = useState('KR');

  const canProceed = nickname.trim().length >= 2;

  const handleNext = async () => {
    if (!canProceed) {
      haptic.warning();
      return;
    }
    haptic.medium();
    const db = await getDB();
    const now = new Date().toISOString();
    const anonId = generateAnonId();

    await db.runAsync(
      `INSERT INTO user
        (anon_id, nickname, nationality, home_currency,
         agree_terms, agree_privacy, agree_stats, agree_sns_alert,
         server_registered, created_at, updated_at)
       VALUES (?, ?, ?, 'KRW', 0, 0, 0, 0, 0, ?, ?)`,
      [anonId, nickname.trim(), nationality, now, now]
    );
    router.push('/(onboarding)/terms');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.eyebrow}>STEP 01 / 02</Text>
          <Text style={styles.title}>어떻게 불러드릴까요?</Text>
          <Text style={styles.subtitle}>
            여행 기록에 표시될 닉네임을 입력해주세요
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>닉네임</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="예: 여행자 김영희"
              placeholderTextColor={Colors.textTertiary}
              maxLength={20}
              autoFocus
            />
            <Text style={styles.hint}>최소 2자, 최대 20자</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>국적</Text>
            <View style={styles.chipRow}>
              {[
                { code: 'KR', label: '🇰🇷 한국' },
                { code: 'JP', label: '🇯🇵 일본' },
                { code: 'US', label: '🇺🇸 미국' },
                { code: 'OTHER', label: '🌍 기타' },
              ].map((c) => (
                <Pressable
                  key={c.code}
                  style={[styles.chip, nationality === c.code && styles.chipActive]}
                  onPress={() => {
                    haptic.select();
                    setNationality(c.code);
                  }}
                >
                  <Text style={[styles.chipText, nationality === c.code && styles.chipTextActive]}>
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.primaryButton, !canProceed && styles.primaryButtonDisabled]}
            onPress={handleNext}
            disabled={!canProceed}
          >
            <Text style={styles.primaryButtonText}>다음</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.xxl, paddingTop: Spacing.huge, flexGrow: 1 },
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
  inputGroup: {
    marginBottom: Spacing.xxl,
  },
  label: {
    fontSize: Typography.labelLarge,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  input: {
    fontSize: Typography.bodyLarge,
    color: Colors.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    paddingVertical: Spacing.md,
  },
  hint: {
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.textOnPrimary,
    fontWeight: '600',
  },
  footer: {
    padding: Spacing.xxl,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: Colors.textTertiary,
  },
  primaryButtonText: {
    color: Colors.textOnPrimary,
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
