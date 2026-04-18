import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView, Image,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Typography, Spacing } from '@/theme/theme';
import { createTripLog } from '@/db/logs';

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);

  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [location, setLocation] = useState('');
  const [weather, setWeather] = useState('');
  const [mood, setMood] = useState('');
  const [images, setImages] = useState<string[]>([]);

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

  const handleSave = async () => {
    if (!canSave) {
      Alert.alert('제목이나 내용을 입력해주세요');
      return;
    }
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
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '기록 작성',
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

            <Field label="날짜">
              <TextInput
                style={styles.input}
                value={logDate}
                onChangeText={setLogDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textTertiary}
              />
            </Field>

            <Field label="제목">
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="오늘의 여행"
                placeholderTextColor={Colors.textTertiary}
              />
            </Field>

            <Field label="내용">
              <TextInput
                style={[styles.input, styles.textarea]}
                value={content}
                onChangeText={setContent}
                placeholder="오늘 있었던 일, 느낀 점, 특별한 순간을 기록해보세요"
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />
            </Field>

            <Field label="장소">
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="예: 시부야 스크램블 교차로"
                placeholderTextColor={Colors.textTertiary}
              />
            </Field>

            <Field label="날씨">
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
            </Field>

            <Field label="기분">
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
            </Field>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
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
  saveBtn: { color: Colors.primary, fontWeight: '700' },
  imageActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  imageBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  imageBtnIcon: { fontSize: 28, marginBottom: Spacing.xs },
  imageBtnText: {
    fontSize: Typography.labelMedium,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.surfaceAlt,
  },
  imageRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.error,
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  weatherIcon: { fontSize: 24 },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  moodIcon: { fontSize: 20 },
  moodLabel: {
    fontSize: Typography.labelMedium,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  moodLabelActive: { color: Colors.textOnPrimary },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
});
