import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Typography, Spacing, Shadows } from '@/theme/theme';
import { getDB } from '@/db/database';

export default function NewTripScreen() {
  const [title, setTitle] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('KRW');
  const [status, setStatus] = useState<'planning' | 'ongoing'>('planning');
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0;

  const handleSave = useCallback(async () => {
    if (!canSave || saving) {
      if (!canSave) Alert.alert('제목을 입력해주세요');
      return;
    }
    setSaving(true);
    try {
      const db = await getDB();
      const now = new Date().toISOString();
      const result = await db.runAsync(
        `INSERT INTO trips
          (title, country, city, start_date, end_date, budget, currency, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title.trim(),
          country.trim() || null,
          city.trim() || null,
          startDate || null,
          endDate || null,
          parseFloat(budget) || 0,
          currency,
          status,
          now,
          now,
        ]
      );
      const newId = result.lastInsertRowId;
      router.replace(`/trip/${newId}`);
    } catch (err) {
      console.error(err);
      Alert.alert('오류', '저장에 실패했습니다');
      setSaving(false);
    }
  }, [canSave, saving, title, country, city, startDate, endDate, budget, currency, status]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* 커스텀 헤더 (Stack.Screen 제거로 인한 포커스 문제 해결) */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.headerBtn}>취소</Text>
        </Pressable>
        <Text style={styles.headerTitle}>새 여행</Text>
        <Pressable
          onPress={handleSave}
          disabled={!canSave || saving}
          hitSlop={10}
        >
          <Text
            style={[
              styles.headerBtn,
              styles.saveBtn,
              (!canSave || saving) && { opacity: 0.4 },
            ]}
          >
            {saving ? '저장중...' : '저장'}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.field}>
            <Text style={styles.label}>
              여행 제목 <Text style={{ color: Colors.error }}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="예: 도쿄 5박 6일"
              placeholderTextColor={Colors.textTertiary}
              returnKeyType="next"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>국가</Text>
              <TextInput
                style={styles.input}
                value={country}
                onChangeText={setCountry}
                placeholder="일본"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>도시</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="도쿄"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>출발일</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>도착일</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 2 }]}>
              <Text style={styles.label}>예산</Text>
              <TextInput
                style={styles.input}
                value={budget}
                onChangeText={setBudget}
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>통화</Text>
              <View style={styles.currencyPicker}>
                {['KRW', 'JPY', 'USD'].map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.currencyBtn, currency === c && styles.currencyBtnActive]}
                    onPress={() => setCurrency(c)}
                  >
                    <Text
                      style={[
                        styles.currencyText,
                        currency === c && styles.currencyTextActive,
                      ]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>상태</Text>
            <View style={styles.statusRow}>
              <Pressable
                style={[styles.statusBtn, status === 'planning' && styles.statusBtnActive]}
                onPress={() => setStatus('planning')}
              >
                <Text style={[styles.statusText, status === 'planning' && styles.statusTextActive]}>
                  📝 계획 중
                </Text>
              </Pressable>
              <Pressable
                style={[styles.statusBtn, status === 'ongoing' && styles.statusBtnActive]}
                onPress={() => setStatus('ongoing')}
              >
                <Text style={[styles.statusText, status === 'ongoing' && styles.statusTextActive]}>
                  ✈️ 진행 중
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  headerBtn: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: Typography.bodyLarge,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  saveBtn: {
    color: Colors.primary,
    fontWeight: '700',
  },
  scroll: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing.huge },
  field: { gap: Spacing.xs },
  label: {
    fontSize: Typography.labelSmall,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  input: {
    fontSize: Typography.bodyLarge,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  currencyPicker: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  currencyBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencyBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  currencyText: {
    fontSize: Typography.labelMedium,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  currencyTextActive: { color: Colors.textOnPrimary },
  statusRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statusBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statusText: {
    fontSize: Typography.bodyMedium,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  statusTextActive: { color: Colors.textOnPrimary },
});
