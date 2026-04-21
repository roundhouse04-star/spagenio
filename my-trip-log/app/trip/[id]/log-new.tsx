import { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView, Image,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { format, parseISO, isValid } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Typography, Spacing } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { createTripLog } from '@/db/logs';
import DatePickerModal from '@/components/DatePickerModal';

const MOODS = [
  { key: '😊', label: '행복' },
  { key: '😌', label: '평온' },
  { key: '🤩', label: '신남' },
  { key: '😮', label: '놀람' },
  { key: '🥰', label: '감동' },
  { key: '😴', label: '피곤' },
];

const WEATHERS = ['☀️', '⛅', '☁️', '🌧️', '⛈️', '🌨️', '🌫️'];

export default function NewLogScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);

  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [location, setLocation] = useState('');
  const [weather, setWeather] = useState('');
  const [mood, setMood] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const canSave = title.trim().length > 0 || content.trim().length > 0;

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10 - images.length,
    });
    if (!result.canceled) {
      setImages([...images, ...result.assets.map((a) => a.uri)]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const removeImage = (uri: string) => {
    setImages(images.filter((i) => i !== uri));
  };

  const handleSave = useCallback(async () => {
    if (!canSave || saving) {
      if (!canSave) Alert.alert('제목이나 내용을 입력해주세요');
      return;
    }
    setSaving(true);
    try {
      await createTripLog({
        tripId,
        logDate,
        title: title.trim() || null,
        content: content.trim() || null,
        images,
        location: location.trim() || null,
        weather: weather || null,
        mood: mood || null,
      });
      router.back();
    } catch (err) {
      console.error(err);
      Alert.alert('저장 실패');
      setSaving(false);
    }
  }, [canSave, saving, tripId, logDate, title, content, images, location, weather, mood]);

  const formatDisplay = (v: string) => {
    if (!v) return '';
    const d = parseISO(v);
    if (!isValid(d)) return v;
    return format(d, 'yyyy.MM.dd (EEE)', { locale: ko });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* 커스텀 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.headerBtn}>취소</Text>
        </Pressable>
        <Text style={styles.headerTitle}>기록 작성</Text>
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
          <View style={styles.imageActions}>
            <Pressable style={styles.imageBtn} onPress={pickImages}>
              <Text style={styles.imageBtnIcon}>🖼️</Text>
              <Text style={styles.imageBtnText}>갤러리</Text>
            </Pressable>
            <Pressable style={styles.imageBtn} onPress={takePhoto}>
              <Text style={styles.imageBtnIcon}>📷</Text>
              <Text style={styles.imageBtnText}>촬영</Text>
            </Pressable>
          </View>

          {images.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imageRow}
            >
              {images.map((uri, i) => (
                <View key={i} style={styles.imageWrap}>
                  <Image source={{ uri }} style={styles.image} />
                  <Pressable
                    style={styles.imageRemove}
                    onPress={() => removeImage(uri)}
                  >
                    <Text style={styles.imageRemoveText}>×</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>날짜</Text>
            <Pressable
              style={styles.dateBox}
              onPress={() => setShowDatePicker(true)}
            >
              <Text
                style={[styles.dateText, !logDate && styles.datePlaceholder]}
              >
                {logDate ? formatDisplay(logDate) : '날짜 선택'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>제목</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="오늘의 여행"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>내용</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={content}
              onChangeText={setContent}
              placeholder="오늘 있었던 일, 느낀 점, 특별한 순간을 기록해보세요"
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>장소</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="예: 시부야 스크램블 교차로"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>날씨</Text>
            <View style={styles.pickerRow}>
              {WEATHERS.map((w) => (
                <Pressable
                  key={w}
                  style={[styles.weatherChip, weather === w && styles.chipActive]}
                  onPress={() => setWeather(weather === w ? '' : w)}
                >
                  <Text style={styles.weatherIcon}>{w}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>기분</Text>
            <View style={styles.pickerRow}>
              {MOODS.map((m) => (
                <Pressable
                  key={m.key}
                  style={[styles.moodChip, mood === m.key && styles.chipActive]}
                  onPress={() => setMood(mood === m.key ? '' : m.key)}
                >
                  <Text style={styles.moodIcon}>{m.key}</Text>
                  <Text
                    style={[
                      styles.moodLabel,
                      mood === m.key && styles.moodLabelActive,
                    ]}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showDatePicker}
        value={logDate}
        title="날짜 선택"
        onConfirm={setLogDate}
        onClose={() => setShowDatePicker(false)}
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
  saveBtn: { color: c.primary, fontWeight: '700' },
  scroll: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing.huge },
  imageActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  imageBtn: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
    borderStyle: 'dashed',
  },
  imageBtnIcon: { fontSize: 28, marginBottom: Spacing.xs },
  imageBtnText: {
    fontSize: Typography.labelMedium,
    color: c.textSecondary,
    fontWeight: '600',
  },
  imageRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  imageWrap: {
    position: 'relative',
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 10,
    backgroundColor: c.surfaceAlt,
  },
  imageRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageRemoveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  field: { gap: Spacing.xs },
  fieldLabel: {
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
  textarea: {
    minHeight: 160,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  weatherChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  weatherIcon: { fontSize: 24 },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 999,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  moodIcon: { fontSize: 20 },
  moodLabel: {
    fontSize: Typography.labelMedium,
    color: c.textSecondary,
    fontWeight: '600',
  },
  moodLabelActive: { color: c.textOnPrimary },
  chipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
});
}
