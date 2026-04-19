import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
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
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0;

  const handleSave = useCallback(async () => {
    if (!canSave || saving) {
      if (!canSave) Alert.alert('제목을 입력해주세요');
      return;
    }
    setSaving(true);
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
      setSaving(false);
    }
  }, [canSave, saving, tripId, itemDay, startTime, title, location, memo, cost, category]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* 커스텀 헤더 (inline Stack.Screen 대신) */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.headerBtn}>취소</Text>
        </Pressable>
        <Text style={styles.headerTitle}>일정 추가</Text>
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
              일정 제목 <Text style={{ color: Colors.error }}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="예: 스카이트리 방문"
              placeholderTextColor={Colors.textTertiary}
              autoFocus
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Day</Text>
              <TextInput
                style={styles.input}
                value={itemDay}
                onChangeText={setItemDay}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
            <View style={[styles.field, { flex: 2 }]}>
              <Text style={styles.label}>시간</Text>
              <TextInput
                style={styles.input}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="14:00"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>카테고리</Text>
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
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>장소</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="예: 도쿄 스카이트리"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>비용</Text>
            <TextInput
              style={styles.input}
              value={cost}
              onChangeText={setCost}
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>메모</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={memo}
              onChangeText={setMemo}
              placeholder="추가 정보나 주의사항을 적어두세요"
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={4}
            />
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
