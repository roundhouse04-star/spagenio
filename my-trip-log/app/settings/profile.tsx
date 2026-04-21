import { useMemo, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Typography, Spacing } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { getDB } from '@/db/database';

const CURRENCIES = [
  { code: 'KRW', flag: '🇰🇷', name: '원' },
  { code: 'JPY', flag: '🇯🇵', name: '엔' },
  { code: 'USD', flag: '🇺🇸', name: '달러' },
  { code: 'EUR', flag: '🇪🇺', name: '유로' },
  { code: 'GBP', flag: '🇬🇧', name: '파운드' },
  { code: 'CNY', flag: '🇨🇳', name: '위안' },
];

const NATIONALITIES = [
  { code: 'KR', label: '🇰🇷 한국' },
  { code: 'JP', label: '🇯🇵 일본' },
  { code: 'US', label: '🇺🇸 미국' },
  { code: 'OTHER', label: '🌍 기타' },
];

export default function ProfileEditScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [nickname, setNickname] = useState('');
  const [nationality, setNationality] = useState('KR');
  const [homeCurrency, setHomeCurrency] = useState('KRW');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const db = await getDB();
      const u = await db.getFirstAsync<any>('SELECT * FROM user LIMIT 1');
      if (u) {
        setNickname(u.nickname || '');
        setNationality(u.nationality || 'KR');
        setHomeCurrency(u.home_currency || 'KRW');
      }
    })();
  }, []);

  const canSave = nickname.trim().length >= 2;

  const handleSave = async () => {
    if (!canSave) {
      haptic.warning();
      return;
    }
    setSaving(true);
    try {
      const db = await getDB();
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE user SET nickname = ?, nationality = ?, home_currency = ?, updated_at = ?
         WHERE id = (SELECT id FROM user LIMIT 1)`,
        [nickname.trim(), nationality, homeCurrency, now]
      );
      haptic.success();
      router.back();
    } catch (err) {
      haptic.error();
      Alert.alert('저장 실패', String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => { haptic.tap(); router.back(); }}>
            <Text style={styles.cancel}>취소</Text>
          </Pressable>
          <Text style={styles.headerTitle}>프로필 수정</Text>
          <Pressable onPress={handleSave} disabled={!canSave || saving}>
            <Text style={[styles.save, (!canSave || saving) && styles.saveDisabled]}>
              저장
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.field}>
            <Text style={styles.label}>닉네임</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="예: 여행자 김영희"
              placeholderTextColor={colors.textTertiary}
              maxLength={20}
            />
            <Text style={styles.hint}>최소 2자, 최대 20자</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>국적</Text>
            <View style={styles.chipRow}>
              {NATIONALITIES.map((c) => (
                <Pressable
                  key={c.code}
                  style={[styles.chip, nationality === c.code && styles.chipActive]}
                  onPress={() => { haptic.select(); setNationality(c.code); }}
                >
                  <Text style={[styles.chipText, nationality === c.code && styles.chipTextActive]}>
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>기본 통화</Text>
            <Text style={styles.hint}>비용 기록 시 기본으로 사용되는 통화입니다</Text>
            <View style={[styles.chipRow, { marginTop: Spacing.sm }]}>
              {CURRENCIES.map((c) => (
                <Pressable
                  key={c.code}
                  style={[styles.chip, homeCurrency === c.code && styles.chipActive]}
                  onPress={() => { haptic.select(); setHomeCurrency(c.code); }}
                >
                  <Text style={[styles.chipText, homeCurrency === c.code && styles.chipTextActive]}>
                    {c.flag} {c.code}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  cancel: { fontSize: Typography.bodyMedium, color: c.textTertiary },
  headerTitle: { fontSize: Typography.bodyLarge, fontWeight: '700', color: c.textPrimary },
  save: { fontSize: Typography.bodyMedium, color: c.primary, fontWeight: '700' },
  saveDisabled: { color: c.textTertiary },

  scroll: { padding: Spacing.xl },
  field: { marginBottom: Spacing.xxl },
  label: {
    fontSize: Typography.labelLarge,
    color: c.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  input: {
    fontSize: Typography.bodyLarge,
    color: c.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: c.primary,
    paddingVertical: Spacing.md,
  },
  hint: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    marginTop: Spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  chipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  chipText: {
    fontSize: Typography.bodyMedium,
    color: c.textSecondary,
  },
  chipTextActive: {
    color: c.textOnPrimary,
    fontWeight: '600',
  },
});
}
