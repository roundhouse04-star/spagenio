/**
 * 공연·티켓 추가/수정 폼에서 공통으로 쓰는 입력 필드 컴포넌트들.
 */
import React from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Platform } from 'react-native';
import { Colors, Fonts, FontSizes, Spacing, Radius } from '@/theme/theme';

export function Field({ label, required, children, hint }: {
  label: string; required?: boolean; children: React.ReactNode; hint?: string;
}) {
  return (
    <View style={{ marginBottom: Spacing.lg }}>
      <Text style={styles.label}>{label}{required && <Text style={{ color: Colors.heart }}> *</Text>}</Text>
      {children}
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

export function TextField({ value, onChangeText, placeholder, multiline, keyboardType }: {
  value: string; onChangeText: (s: string) => void;
  placeholder?: string; multiline?: boolean; keyboardType?: any;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textFaint}
      multiline={multiline}
      keyboardType={keyboardType}
      style={[styles.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
    />
  );
}

export function DateField({ value, onChangeText, placeholder = 'YYYY-MM-DD' }: {
  value: string; onChangeText: (s: string) => void; placeholder?: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textFaint}
      style={styles.input}
      keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
    />
  );
}

export function TimeField({ value, onChangeText, placeholder = 'HH:MM' }: {
  value: string; onChangeText: (s: string) => void; placeholder?: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textFaint}
      style={[styles.input, { maxWidth: 120 }]}
      keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
    />
  );
}

export function CategoryPicker({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: readonly { value: string; icon: string }[];
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <Pressable key={opt.value} onPress={() => onChange(opt.value)}
                     style={[styles.chip, active && styles.chipActive]}>
            <Text style={{ fontSize: FontSizes.caption, color: active ? '#fff' : Colors.text, fontFamily: Fonts.medium }}>
              {opt.icon} {opt.value}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RatingPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1,2,3,4,5].map(n => (
        <Pressable key={n} onPress={() => onChange(n === value ? 0 : n)} hitSlop={4}>
          <Text style={{ fontSize: 30, color: n <= value ? Colors.heart : Colors.textFaint }}>
            {n <= value ? '★' : '☆'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function SelectRow<T extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T | undefined) => void;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Pressable onPress={() => onChange(undefined)}
                   style={[styles.chip, value === undefined && styles.chipActive]}>
          <Text style={{ fontSize: FontSizes.caption, color: value === undefined ? '#fff' : Colors.text }}>
            없음
          </Text>
        </Pressable>
        {options.map(o => (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)}
                     style={[styles.chip, value === o.value && styles.chipActive]}>
            <Text style={{ fontSize: FontSizes.caption, color: value === o.value ? '#fff' : Colors.text }}>
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: FontSizes.caption, fontFamily: Fonts.semibold, color: Colors.text, marginBottom: 6 },
  hint: { fontSize: FontSizes.tiny, color: Colors.textFaint, marginTop: 4 },
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: FontSizes.body, fontFamily: Fonts.regular, color: Colors.text,
    backgroundColor: Colors.bg,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, backgroundColor: Colors.bg,
  },
  chipActive: { backgroundColor: Colors.text, borderColor: Colors.text },
});

// ─── PhotoField — 카메라 촬영 / 앨범 선택 / 사진 제거 ──────────
import { Image, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

export function PhotoField({ value, onChange, onExtractRequest }: {
  value?: string;
  onChange: (uri: string | undefined) => void;
  /** 사용자가 "자동 읽기" 버튼을 눌렀을 때 호출. text 는 OCR 결과. */
  onExtractRequest?: (uri: string, text?: string) => void;
}) {
  const [busy, setBusy] = React.useState(false);

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('카메라 권한이 필요해요'); return; }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      await handleNewPhoto(result.assets[0].uri);
    }
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('사진 라이브러리 권한이 필요해요'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      await handleNewPhoto(result.assets[0].uri);
    }
  };

  // 영구 보관을 위해 앱 내부로 복사 (임시 cache 경로는 나중에 사라질 수 있음)
  const handleNewPhoto = async (srcUri: string) => {
    try {
      setBusy(true);
      const dir = (FileSystem.documentDirectory ?? '') + 'tickets/';
      try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {}
      const fileName = `t_${Date.now()}.jpg`;
      const destUri = dir + fileName;
      await FileSystem.copyAsync({ from: srcUri, to: destUri });
      onChange(destUri);
      // 주의: 자동 OCR 안 함. 사용자가 "자동 읽기" 버튼 누를 때만 실행
    } catch (e: any) {
      Alert.alert('사진 저장 실패', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const clearPhoto = () => {
    Alert.alert('사진 삭제', '정말 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => onChange(undefined) },
    ]);
  };

  return (
    <View>
      {value ? (
        <View style={photoStyles.previewBox}>
          <Image source={{ uri: value }} style={photoStyles.preview} />
          <Pressable onPress={clearPhoto} hitSlop={8} style={photoStyles.clearBtn}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>✕</Text>
          </Pressable>
        </View>
      ) : (
        <View style={photoStyles.placeholderBox}>
          <Text style={{ fontSize: 32, color: Colors.ink4 }}>◼</Text>
          <Text style={{ fontSize: 11, color: Colors.ink3, marginTop: 6 }}>
            티켓 사진을 등록해보세요
          </Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <Pressable onPress={pickFromCamera}
                   disabled={busy}
                   style={({ pressed }) => [photoStyles.btn, pressed && { opacity: 0.6 }]}>
          <Text style={photoStyles.btnText}>◉ 카메라로 촬영</Text>
        </Pressable>
        <Pressable onPress={pickFromLibrary}
                   disabled={busy}
                   style={({ pressed }) => [photoStyles.btn, pressed && { opacity: 0.6 }]}>
          <Text style={photoStyles.btnText}>▦ 앨범에서 선택</Text>
        </Pressable>
      </View>

      {/* OCR 버튼 — 사진이 있고 onExtractRequest 콜백이 있을 때만 */}
      {value && onExtractRequest && (
        <Pressable onPress={() => runOcr(value)}
                   disabled={busy}
                   style={({ pressed }) => [photoStyles.ocrBtn, pressed && { opacity: 0.6 }]}>
          <Text style={photoStyles.ocrBtnText}>◈ 사진에서 자동 읽기 (OCR)</Text>
        </Pressable>
      )}

      {busy && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <ActivityIndicator size="small" />
          <Text style={{ fontSize: 11, color: Colors.ink3 }}>처리 중…</Text>
        </View>
      )}
    </View>
  );

  // OCR 실행 — 네이티브 모듈 확인 후 호출
  async function runOcr(uri: string) {
    const { isOcrAvailable, extractTextFromImage, OCR_UNAVAILABLE_MSG } =
      require('@/services/ocrService');
    if (!isOcrAvailable()) {
      Alert.alert('OCR 사용 불가', OCR_UNAVAILABLE_MSG);
      return;
    }
    try {
      setBusy(true);
      const text = await extractTextFromImage(uri);
      if (!text) {
        Alert.alert('인식 결과 없음', '글자를 읽지 못했어요. 더 밝은 곳에서 다시 시도해보세요.');
        return;
      }
      onExtractRequest?.(uri, text);
    } catch (e: any) {
      Alert.alert('OCR 실패', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }
}

const photoStyles = StyleSheet.create({
  previewBox: { position: 'relative', borderWidth: 1, borderColor: Colors.ink },
  preview: { width: '100%', aspectRatio: 3 / 4, resizeMode: 'cover' },
  clearBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },
  placeholderBox: {
    borderWidth: 1, borderColor: Colors.ink, borderStyle: 'dashed',
    aspectRatio: 3 / 4,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.fill,
  },
  btn: {
    flex: 1, borderWidth: 1, borderColor: Colors.ink,
    paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.paper,
  },
  btnText: {
    fontSize: 12, fontFamily: Fonts.medium, color: Colors.ink,
  },
  ocrBtn: {
    marginTop: 8,
    borderWidth: 1, borderColor: Colors.ink,
    backgroundColor: Colors.ink,
    paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  ocrBtnText: {
    fontSize: 12, fontFamily: Fonts.medium, color: '#fff',
  },
});
