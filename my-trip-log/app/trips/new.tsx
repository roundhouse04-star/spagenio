import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Colors, Typography, Spacing, Shadows } from '@/theme/theme';
import { getDB } from '@/db/database';
import { TRIP_STATUS } from '@/db/schema';

export default function NewTripScreen() {
  const [title, setTitle] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('KRW');
  const [status, setStatus] = useState<'planning' | 'ongoing'>('planning');

  const canSave = title.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) {
      Alert.alert('제목을 입력해주세요');
      return;
    }

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
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '새 여행',
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <Text style={styles.headerBtn}>취소</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={handleSave} disabled={!canSave}>
              <Text style={[styles.headerBtn, styles.saveBtn, !canSave && { opacity: 0.4 }]}>
                저장
              </Text>
            </Pressable>
          ),
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Field label="여행 제목" required>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="예: 도쿄 5박 6일"
                placeholderTextColor={Colors.textTertiary}
              />
            </Field>

            <View style={styles.row}>
              <Field label="국가" flex={1}>
                <TextInput
                  style={styles.input}
                  value={country}
                  onChangeText={setCountry}
                  placeholder="일본"
                  placeholderTextColor={Colors.textTertiary}
                />
              </Field>
              <Field label="도시" flex={1}>
                <TextInput
                  style={styles.input}
                  value={city}
                  onChangeText={setCity}
                  placeholder="도쿄"
                  placeholderTextColor={Colors.textTertiary}
                />
              </Field>
            </View>

            <View style={styles.row}>
              <Field label="출발일" flex={1}>
                <TextInput
                  style={styles.input}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textTertiary}
                />
              </Field>
              <Field label="도착일" flex={1}>
                <TextInput
                  style={styles.input}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textTertiary}
                />
              </Field>
            </View>

            <View style={styles.row}>
              <Field label="예산" flex={2}>
                <TextInput
                  style={styles.input}
                  value={budget}
                  onChangeText={setBudget}
                  placeholder="0"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="numeric"
                />
              </Field>
              <Field label="통화" flex={1}>
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
              </Field>
            </View>

            <Field label="상태">
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
            </Field>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

function Field({
  label, required, flex, children,
}: {
  label: string;
  required?: boolean;
  flex?: number;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.field, flex && { flex }]}>
      <Text style={styles.label}>
        {label} {required && <Text style={{ color: Colors.error }}>*</Text>}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.xl, gap: Spacing.lg },
  headerBtn: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.lg,
    fontWeight: '500',
  },
  saveBtn: {
    color: Colors.primary,
    fontWeight: '700',
  },
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
