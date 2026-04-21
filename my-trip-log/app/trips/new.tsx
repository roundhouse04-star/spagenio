import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { format, parseISO, isValid } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { getDB } from '@/db/database';
import DatePickerModal from '@/components/DatePickerModal';

export default function TripFormScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const tripId = id ? Number(id) : null;

  const [loading, setLoading] = useState(isEdit);
  const [title, setTitle] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('KRW');
  const [status, setStatus] = useState<'planning' | 'ongoing' | 'completed'>('planning');
  const [saving, setSaving] = useState(false);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // 수정 모드: 기존 데이터 불러오기
  useEffect(() => {
    if (!isEdit || !tripId) return;
    (async () => {
      try {
        const db = await getDB();
        const t = await db.getFirstAsync<any>(
          'SELECT * FROM trips WHERE id = ?', [tripId]
        );
        if (!t) {
          Alert.alert('오류', '여행을 찾을 수 없습니다', [
            { text: '확인', onPress: () => router.back() },
          ]);
          return;
        }
        if (t.status === 'completed') {
          Alert.alert('수정 불가', '완료된 여행은 수정할 수 없습니다', [
            { text: '확인', onPress: () => router.back() },
          ]);
          return;
        }
        setTitle(t.title ?? '');
        setCountry(t.country ?? '');
        setCity(t.city ?? '');
        setStartDate(t.start_date ?? '');
        setEndDate(t.end_date ?? '');
        setBudget(t.budget ? String(t.budget) : '');
        setCurrency(t.currency ?? 'KRW');
        setStatus(t.status ?? 'planning');
      } catch (err) {
        console.error(err);
        Alert.alert('오류', '불러오기 실패');
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, tripId]);

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

      if (isEdit && tripId) {
        // 수정
        await db.runAsync(
          `UPDATE trips SET
            title = ?, country = ?, city = ?,
            start_date = ?, end_date = ?,
            budget = ?, currency = ?, status = ?,
            updated_at = ?
           WHERE id = ?`,
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
            tripId,
          ]
        );
        router.back();
      } else {
        // 신규 생성
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
      }
    } catch (err) {
      console.error(err);
      Alert.alert('오류', '저장에 실패했습니다');
      setSaving(false);
    }
  }, [canSave, saving, isEdit, tripId, title, country, city, startDate, endDate, budget, currency, status]);

  const formatDisplay = (v: string) => {
    if (!v) return '';
    const d = parseISO(v);
    if (!isValid(d)) return v;
    return format(d, 'yyyy.MM.dd (EEE)', { locale: ko });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.headerBtn}>취소</Text>
          </Pressable>
          <Text style={styles.headerTitle}>여행 수정</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textSecondary }}>불러오는 중…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* 커스텀 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.headerBtn}>취소</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {isEdit ? '여행 수정' : '새 여행'}
        </Text>
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
              여행 제목 <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="예: 도쿄 5박 6일"
              placeholderTextColor={colors.textTertiary}
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
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>도시</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="도쿄"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>출발일</Text>
              <Pressable
                style={styles.dateBox}
                onPress={() => setShowStartPicker(true)}
              >
                <Text
                  style={[
                    styles.dateText,
                    !startDate && styles.datePlaceholder,
                  ]}
                >
                  {startDate ? formatDisplay(startDate) : '날짜 선택'}
                </Text>
              </Pressable>
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>도착일</Text>
              <Pressable
                style={styles.dateBox}
                onPress={() => setShowEndPicker(true)}
              >
                <Text
                  style={[
                    styles.dateText,
                    !endDate && styles.datePlaceholder,
                  ]}
                >
                  {endDate ? formatDisplay(endDate) : '날짜 선택'}
                </Text>
              </Pressable>
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
                placeholderTextColor={colors.textTertiary}
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

      <DatePickerModal
        visible={showStartPicker}
        value={startDate}
        title="출발일 선택"
        onConfirm={(d) => {
          setStartDate(d);
          if (d && endDate && d > endDate) {
            setEndDate('');
          }
        }}
        onClose={() => setShowStartPicker(false)}
      />
      <DatePickerModal
        visible={showEndPicker}
        value={endDate}
        title="도착일 선택"
        minDate={startDate || undefined}
        onConfirm={setEndDate}
        onClose={() => setShowEndPicker(false)}
      />
    </SafeAreaView>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    backgroundColor: c.background,
  },
  headerBtn: {
    fontSize: Typography.bodyMedium,
    color: c.textSecondary,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: Typography.bodyLarge,
    color: c.textPrimary,
    fontWeight: '700',
  },
  saveBtn: {
    color: c.primary,
    fontWeight: '700',
  },
  scroll: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing.huge },
  field: { gap: Spacing.xs },
  label: {
    fontSize: Typography.labelSmall,
    color: c.textSecondary,
    fontWeight: '600',
  },
  input: {
    fontSize: Typography.bodyLarge,
    color: c.textPrimary,
    backgroundColor: c.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
  },
  dateBox: {
    backgroundColor: c.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    minHeight: 48,
    justifyContent: 'center',
  },
  dateText: {
    fontSize: Typography.bodyMedium,
    color: c.textPrimary,
  },
  datePlaceholder: {
    color: c.textTertiary,
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
    backgroundColor: c.surface,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
  },
  currencyBtnActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  currencyText: {
    fontSize: Typography.labelMedium,
    fontWeight: '700',
    color: c.textSecondary,
  },
  currencyTextActive: { color: c.textOnPrimary },
  statusRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statusBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    backgroundColor: c.surface,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
  },
  statusBtnActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  statusText: {
    fontSize: Typography.bodyMedium,
    fontWeight: '600',
    color: c.textSecondary,
  },
  statusTextActive: { color: c.textOnPrimary },
});
}

