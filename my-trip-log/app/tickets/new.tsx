import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Typography, Spacing, Shadows, Fonts } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { TICKET_CATEGORIES } from '@/db/schema';
import { createTicket } from '@/db/tickets';
import { getAllTrips } from '@/db/trips';
import { saveTicketImage, deleteTicketImage } from '@/utils/ticketStorage';
import { recognizeRawText } from '@/utils/ocr';
import { parseTicketText } from '@/utils/ticketParser';
import { Trip, TicketCategory } from '@/types';

const CURRENCIES = ['KRW', 'JPY', 'USD', 'EUR', 'GBP', 'CNY', 'THB', 'VND'];

export default function NewTicketScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string }>();

  const [imageUri, setImageUri] = useState<string | null>(null); // 영구 저장된 URI
  const [savingImage, setSavingImage] = useState(false);

  const [category, setCategory] = useState<TicketCategory>('flight');
  const [title, setTitle] = useState('');
  const [useDate, setUseDate] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [seat, setSeat] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('KRW');
  const [memo, setMemo] = useState('');
  const [tripId, setTripId] = useState<number | null>(
    tripIdParam ? Number(tripIdParam) : null,
  );
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripPickerOpen, setTripPickerOpen] = useState(false);

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getAllTrips().then(setTrips).catch(() => setTrips([]));
  }, []);

  const showsRoute = category === 'flight' || category === 'train' || category === 'bus';
  const canSave = !!imageUri && !!title.trim() && !submitting;

  const pickImage = useCallback(async (source: 'camera' | 'library') => {
    haptic.tap();
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        source === 'camera' ? '카메라 권한 필요' : '사진 권한 필요',
        '설정에서 권한을 허용해주세요',
      );
      return;
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
    if (result.canceled || !result.assets[0]) return;

    setSavingImage(true);
    try {
      // 기존 이미지가 있었다면 (사용자가 다시 선택한 경우) 정리
      if (imageUri) await deleteTicketImage(imageUri).catch(() => undefined);
      const saved = await saveTicketImage(result.assets[0].uri);
      setImageUri(saved);
    } catch (err) {
      console.error('[티켓 이미지 저장 실패]', err);
      Alert.alert('오류', '이미지를 저장하지 못했어요');
    } finally {
      setSavingImage(false);
    }
  }, [imageUri]);

  const showImagePicker = () => {
    Alert.alert('사진 추가', '어디서 가져올까요?', [
      { text: '카메라', onPress: () => pickImage('camera') },
      { text: '앨범', onPress: () => pickImage('library') },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const runOcr = async () => {
    if (!imageUri) {
      Alert.alert('알림', '먼저 사진을 추가해주세요');
      return;
    }
    haptic.tap();
    setOcrLoading(true);
    try {
      const result = await recognizeRawText(imageUri);
      if (result.engine === 'none' || !result.text) {
        haptic.warning();
        Alert.alert(
          'OCR 사용 불가',
          'OCR 자동 채우기는 정식 빌드(EAS)에서만 동작합니다.\n수동으로 입력해주세요.',
        );
        return;
      }
      setOcrText(result.text);
      const ext = parseTicketText(result.text, category);

      let filledFields = 0;
      if (ext.origin && !origin) { setOrigin(ext.origin); filledFields++; }
      if (ext.destination && !destination) { setDestination(ext.destination); filledFields++; }
      if (ext.useDate && !useDate) { setUseDate(ext.useDate); filledFields++; }
      if (ext.seat && !seat) { setSeat(ext.seat); filledFields++; }
      if (ext.amount !== undefined && !amount) {
        setAmount(String(ext.amount));
        filledFields++;
      }
      if (ext.currency && !amount) setCurrency(ext.currency);

      if (filledFields > 0) {
        haptic.success();
        Alert.alert('자동 채우기 완료', `${filledFields}개 항목을 채웠어요. 내용을 확인 후 저장해주세요.`);
      } else {
        haptic.warning();
        Alert.alert('알림', 'OCR로 텍스트는 추출했지만 인식 가능한 항목이 없어요.\n수동으로 입력해주세요.');
      }
    } catch (err) {
      console.error('[티켓 OCR 실패]', err);
      Alert.alert('OCR 오류', '잠시 후 다시 시도해주세요');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSave = async () => {
    if (!canSave || !imageUri) {
      haptic.warning();
      if (!imageUri) Alert.alert('알림', '티켓 사진을 추가해주세요');
      else if (!title.trim()) Alert.alert('알림', '제목을 입력해주세요');
      return;
    }
    setSubmitting(true);
    try {
      await createTicket({
        tripId,
        category,
        title: title.trim(),
        useDate: useDate.trim() || null,
        origin: showsRoute && origin.trim() ? origin.trim().toUpperCase() : null,
        destination: showsRoute && destination.trim() ? destination.trim().toUpperCase() : null,
        seat: seat.trim() || null,
        amount: amount ? parseFloat(amount.replace(/,/g, '')) : null,
        currency: amount ? currency : null,
        imageUri,
        ocrText,
        memo: memo.trim() || null,
      });
      haptic.success();
      router.back();
    } catch (err) {
      console.error('[티켓 저장 실패]', err);
      Alert.alert('저장 실패', '잠시 후 다시 시도해주세요');
    } finally {
      setSubmitting(false);
    }
  };

  const tripLabel = tripId
    ? trips.find((t) => t.id === tripId)?.title ?? '여행 선택'
    : '여행 선택 (선택사항)';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={10} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>새 티켓</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 사진 영역 */}
          <Pressable style={styles.imageBox} onPress={showImagePicker}>
            {savingImage ? (
              <ActivityIndicator color={colors.primary} />
            ) : imageUri ? (
              <>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="contain" />
                <View style={styles.imageReplaceBadge}>
                  <Text style={styles.imageReplaceText}>다시 선택</Text>
                </View>
              </>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderIcon}>📷</Text>
                <Text style={styles.imagePlaceholderText}>탭해서 사진 추가</Text>
                <Text style={styles.imagePlaceholderHint}>카메라 / 앨범</Text>
              </View>
            )}
          </Pressable>

          {/* OCR 자동 채우기 */}
          {imageUri && (
            <Pressable
              style={[styles.ocrButton, ocrLoading && styles.ocrButtonDisabled]}
              onPress={runOcr}
              disabled={ocrLoading}
            >
              {ocrLoading ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={styles.ocrButtonText}>🔍 OCR로 정보 자동 채우기</Text>
              )}
            </Pressable>
          )}

          {/* 카테고리 */}
          <Field label="카테고리 *" styles={styles}>
            <View style={styles.catGrid}>
              {TICKET_CATEGORIES.map((c) => (
                <Pressable
                  key={c.key}
                  style={[styles.catChip, category === c.key && styles.catChipActive]}
                  onPress={() => { haptic.select(); setCategory(c.key); }}
                >
                  <Text style={[styles.catChipText, category === c.key && styles.catChipTextActive]}>
                    {c.icon} {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Field>

          {/* 제목 */}
          <Field label="제목 *" styles={styles}>
            <TextInput
              style={styles.input}
              placeholder="예: ICN → KIX 보딩패스"
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              maxLength={120}
            />
          </Field>

          {/* 사용일 */}
          <Field label="사용일" styles={styles}>
            <TextInput
              style={styles.input}
              placeholder="2026-04-15 (선택)"
              placeholderTextColor={colors.textTertiary}
              value={useDate}
              onChangeText={setUseDate}
              keyboardType="numbers-and-punctuation"
            />
          </Field>

          {/* 경로 (비행/기차/버스) */}
          {showsRoute && (
            <View style={styles.row}>
              <Field label="출발지" styles={styles} compact>
                <TextInput
                  style={styles.input}
                  placeholder="ICN"
                  placeholderTextColor={colors.textTertiary}
                  value={origin}
                  onChangeText={setOrigin}
                  autoCapitalize="characters"
                  maxLength={40}
                />
              </Field>
              <View style={{ width: Spacing.md }} />
              <Field label="도착지" styles={styles} compact>
                <TextInput
                  style={styles.input}
                  placeholder="KIX"
                  placeholderTextColor={colors.textTertiary}
                  value={destination}
                  onChangeText={setDestination}
                  autoCapitalize="characters"
                  maxLength={40}
                />
              </Field>
            </View>
          )}

          {/* 좌석 */}
          <Field label="좌석" styles={styles}>
            <TextInput
              style={styles.input}
              placeholder={category === 'flight' ? '12A' : '구역/번호 (선택)'}
              placeholderTextColor={colors.textTertiary}
              value={seat}
              onChangeText={setSeat}
              autoCapitalize="characters"
              maxLength={20}
            />
          </Field>

          {/* 금액 */}
          <Field label="금액 (선택)" styles={styles}>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                placeholder="350000"
                placeholderTextColor={colors.textTertiary}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
              <View style={{ width: Spacing.sm }} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 3 }}>
                {CURRENCIES.map((cur) => (
                  <Pressable
                    key={cur}
                    style={[styles.currencyChip, currency === cur && styles.currencyChipActive]}
                    onPress={() => { haptic.select(); setCurrency(cur); }}
                  >
                    <Text style={[styles.currencyChipText, currency === cur && styles.currencyChipTextActive]}>
                      {cur}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Field>

          {/* 관련 여행 */}
          <Field label="관련 여행 (선택)" styles={styles}>
            <Pressable
              style={styles.tripSelect}
              onPress={() => { haptic.tap(); setTripPickerOpen((v) => !v); }}
            >
              <Text style={[styles.tripSelectText, !tripId && styles.tripSelectPlaceholder]}>
                {tripLabel}
              </Text>
              <Text style={styles.tripSelectArrow}>▾</Text>
            </Pressable>
            {tripPickerOpen && (
              <View style={styles.tripDropdown}>
                <Pressable
                  style={styles.tripOption}
                  onPress={() => { haptic.select(); setTripId(null); setTripPickerOpen(false); }}
                >
                  <Text style={styles.tripOptionText}>
                    {!tripId ? '✓ ' : '   '}연결 안 함
                  </Text>
                </Pressable>
                {trips.map((t) => (
                  <Pressable
                    key={t.id}
                    style={styles.tripOption}
                    onPress={() => { haptic.select(); setTripId(t.id); setTripPickerOpen(false); }}
                  >
                    <Text style={styles.tripOptionText}>
                      {tripId === t.id ? '✓ ' : '   '}{t.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Field>

          {/* 메모 */}
          <Field label="메모" styles={styles}>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="좌석 정보, 게이트, 특이사항 등 (선택)"
              placeholderTextColor={colors.textTertiary}
              value={memo}
              onChangeText={setMemo}
              multiline
              maxLength={500}
            />
          </Field>

          <View style={{ height: Spacing.huge }} />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.primaryButton, !canSave && styles.primaryButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            {submitting ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.primaryButtonText}>저장</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children, styles, compact }: {
  label: string;
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
  compact?: boolean;
}) {
  return (
    <View style={[styles.field, compact && { flex: 1 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backText: { fontSize: 24, color: c.textPrimary },
    headerTitle: {
      fontSize: Typography.bodyLarge,
      fontWeight: '700',
      color: c.textPrimary,
    },
    scroll: { padding: Spacing.lg },
    imageBox: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: c.border,
      borderStyle: 'dashed',
      height: 240,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
    },
    imagePreview: { width: '100%', height: '100%' },
    imageReplaceBadge: {
      position: 'absolute',
      bottom: Spacing.md,
      right: Spacing.md,
      backgroundColor: c.primary + 'D9',
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.md,
      borderRadius: 999,
    },
    imageReplaceText: { color: c.textOnPrimary, fontSize: Typography.labelSmall, fontWeight: '700' },
    imagePlaceholder: { alignItems: 'center', justifyContent: 'center', gap: Spacing.xs },
    imagePlaceholderIcon: { fontSize: 40, marginBottom: Spacing.sm },
    imagePlaceholderText: {
      fontSize: Typography.bodyMedium,
      fontWeight: '700',
      color: c.textPrimary,
    },
    imagePlaceholderHint: {
      fontSize: Typography.labelSmall,
      color: c.textTertiary,
    },
    ocrButton: {
      marginTop: Spacing.md,
      paddingVertical: Spacing.md,
      borderRadius: 10,
      backgroundColor: c.primary + '15',
      borderWidth: 1,
      borderColor: c.primary,
      alignItems: 'center',
    },
    ocrButtonDisabled: { opacity: 0.6 },
    ocrButtonText: {
      fontSize: Typography.bodyMedium,
      color: c.primary,
      fontWeight: '700',
    },
    field: { marginTop: Spacing.lg },
    fieldLabel: {
      fontFamily: Fonts.bodyEnSemiBold,
      fontSize: Typography.labelSmall,
      color: c.accent,
      letterSpacing: Typography.letterSpacingWide,
      marginBottom: Spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: c.surface,
      color: c.textPrimary,
      fontSize: Typography.bodyMedium,
    },
    textarea: { minHeight: 80, textAlignVertical: 'top' },
    row: { flexDirection: 'row', alignItems: 'center' },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    catChip: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    catChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    catChipText: { fontSize: Typography.bodyMedium, color: c.textSecondary },
    catChipTextActive: { color: c.textOnPrimary, fontWeight: '700' },
    currencyChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      marginRight: Spacing.xs,
    },
    currencyChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    currencyChipText: { fontSize: Typography.labelSmall, color: c.textSecondary },
    currencyChipTextActive: { color: c.textOnPrimary, fontWeight: '700' },
    tripSelect: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      backgroundColor: c.surface,
    },
    tripSelectText: { fontSize: Typography.bodyMedium, color: c.textPrimary, flex: 1 },
    tripSelectPlaceholder: { color: c.textTertiary },
    tripSelectArrow: { fontSize: Typography.bodyMedium, color: c.textTertiary },
    tripDropdown: {
      marginTop: Spacing.xs,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      ...Shadows.medium,
      maxHeight: 220,
    },
    tripOption: {
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    tripOptionText: { fontSize: Typography.bodyMedium, color: c.textPrimary },
    footer: {
      padding: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    primaryButton: {
      backgroundColor: c.primary,
      paddingVertical: Spacing.lg,
      borderRadius: 14,
      alignItems: 'center',
    },
    primaryButtonDisabled: { backgroundColor: c.textTertiary },
    primaryButtonText: {
      color: c.textOnPrimary,
      fontWeight: '700',
      fontSize: Typography.bodyLarge,
      letterSpacing: 0.5,
    },
  });
}
