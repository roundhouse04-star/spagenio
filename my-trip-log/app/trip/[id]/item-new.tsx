import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Colors, Typography, Spacing } from '@/theme/theme';
import { createTripItem } from '@/db/items';
import { TRIP_ITEM_CATEGORIES } from '@/db/schema';
import { TripItemCategory } from '@/types';

export default function NewItemScreen() {
  const { id, day } = useLocalSearchParams<{ id: string; day: string }>();
  const tripId = Number(id);
  const initialDay = Number(day) || 1;

  const [itemDay, setItemDay] = useState(String(initialDay));
  const [startTime, setStartTime] = useState('');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [memo, setMemo] = useState('');
  const [cost, setCost] = useState('');
  const [category, setCategory] = useState<TripItemCategory>('sightseeing');

  const canSave = title.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) {
      Alert.alert('제목을 입력해주세요');
      return;
    }
    try {
      await createTripItem({
        tripId,
        day: parseInt(itemDay) || 1,
        startTime: startTime || null,
        title: title.trim(),
        location: location.trim() || null,
        memo: memo.trim() || null,
        cost: parseFloat(cost) || 0,
        category,
      });
      router.back();
    } catch (err) {
      console.error(err);
      Alert.alert('저장 실패');
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '일정 추가',
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <Text style={styles.headerBtn}>취소</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={handleSave} disabled={!canSave}>
              <Text
                style={[styles.headerBtn, styles.saveBtn, !canSave && { opacity: 0.4 }]}
              >
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
          <ScrollView contentContainerStyle={styles.scroll}>
            <Field label="일정 제목" required>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="예: 스카이트리 방문"
                placeholderTextColor={Colors.textTertiary}
                autoFocus
              />
            </Field>

            <View style={styles.row}>
              <Field label="Day" flex={1}>
                <TextInput
                  style={styles.input}
                  value={itemDay}
                  onChangeText={setItemDay}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={Colors.textTertiary}
                />
              </Field>
              <Field label="시간" flex={2}>
                <TextInput
                  style={styles.input}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="14:00"
                  placeholderTextColor={Colors.textTertiary}
                />
              </Field>
            </View>

            <Field label="카테고리">
              <View style={styles.catGrid}>
                {TRIP_ITEM_CATEGORIES.map((c) => (
                  <Pressable
                    key={c.key}
                    style={[
                      styles.catChip,
                      category === c.key && styles.catChipActive,
                    ]}
                    onPress={() => setCategory(c.key as TripItemCategory)}
                  >
                    <Text
                      style={[
                        styles.catText,
                        category === c.key && styles.catTextActive,
                      ]}
                    >
                      {c.icon} {c.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Field>

            <Field label="장소">
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="예: 도쿄 스카이트리"
                placeholderTextColor={Colors.textTertiary}
              />
            </Field>

            <Field label="비용">
              <TextInput
                style={styles.input}
                value={cost}
                onChangeText={setCost}
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
              />
            </Field>

            <Field label="메모">
              <TextInput
                style={[styles.input, styles.textarea]}
                value={memo}
                onChangeText={setMemo}
                placeholder="추가 정보나 주의사항을 적어두세요"
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={4}
              />
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
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  catChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catText: {
    fontSize: Typography.labelMedium,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  catTextActive: { color: Colors.textOnPrimary },
});
