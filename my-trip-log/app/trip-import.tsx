/**
 * 여행 일정 받기 (Import)
 *
 * 진입 경로 2가지:
 *  1) 여행 탭의 [📥 받기] 버튼 → 이 화면 직접 진입 → 카메라로 QR 스캔
 *  2) Deep Link triplive://import?d=... → _layout.tsx 의 useURL 훅이 감지 →
 *     router.push('/trip-import?d=...') → 이 화면이 d 파라미터로 자동 import 흐름
 *
 * 흐름:
 *  - QR/링크 받음 → parseSharedTrip() 으로 검증
 *  - 미리보기 + 가져오기 옵션 (새 여행 / 기존 합치기)
 *  - [가져오기] → importTripFromShare() → 여행 상세 화면 이동
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Alert, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import {
  parseSharedTrip, getSharedTripPreview, importTripFromShare,
  type SharedTripPayload, type SharedTripPreview, type ImportMode,
} from '@/utils/tripShare';
import { getAllTrips } from '@/db/trips';
import type { Trip } from '@/types';

type Step = 'scan' | 'manual' | 'preview' | 'merge-select' | 'done';

export default function TripImportScreen() {
  const { d } = useLocalSearchParams<{ d?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [step, setStep] = useState<Step>('scan');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualText, setManualText] = useState('');
  const [payload, setPayload] = useState<SharedTripPayload | null>(null);
  const [preview, setPreview] = useState<SharedTripPreview | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('new');
  const [existingTrips, setExistingTrips] = useState<Trip[]>([]);
  const [targetTripId, setTargetTripId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);

  // Deep Link 로 들어온 경우 자동 파싱
  useEffect(() => {
    if (d && typeof d === 'string') {
      handleSharedData(d);
    }
  }, [d]);

  // merge 모드일 때 기존 여행 목록 로드
  useEffect(() => {
    if (importMode === 'merge') {
      getAllTrips('all').then(setExistingTrips).catch(() => setExistingTrips([]));
    }
  }, [importMode]);

  const handleSharedData = useCallback((encoded: string) => {
    const parsed = parseSharedTrip(encoded);
    if (!parsed) {
      haptic.error();
      Alert.alert(
        '잘못된 데이터',
        '공유받은 데이터를 읽을 수 없어요. 다시 시도해주세요.',
      );
      return;
    }
    haptic.success();
    setPayload(parsed);
    setPreview(getSharedTripPreview(parsed));
    setStep('preview');
  }, []);

  const onQRScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    handleSharedData(data);
  };

  const onManualImport = () => {
    if (!manualText.trim()) {
      Alert.alert('알림', '공유받은 링크 또는 코드를 붙여넣어주세요');
      return;
    }
    handleSharedData(manualText.trim());
  };

  const onConfirmImport = async () => {
    if (!payload) return;
    if (importMode === 'merge' && !targetTripId) {
      Alert.alert('알림', '합칠 여행을 선택해주세요');
      return;
    }
    setImporting(true);
    try {
      const result = await importTripFromShare(
        payload,
        importMode,
        importMode === 'merge' ? targetTripId! : undefined,
      );
      haptic.success();
      Alert.alert(
        '🎉 가져오기 완료',
        `${payload.trip.title} - 일정 ${result.addedCount}개 추가됨`,
        [
          {
            text: '여행 보기',
            onPress: () => {
              router.dismissAll();
              router.push(`/trip/${result.tripId}`);
            },
          },
          {
            text: '닫기',
            style: 'cancel',
            onPress: () => router.back(),
          },
        ],
      );
    } catch (err) {
      haptic.error();
      Alert.alert('가져오기 실패', String(err));
    } finally {
      setImporting(false);
    }
  };

  // ----- 미리보기 화면 -----
  if (step === 'preview' && payload && preview) {
    return (
      <>
        <Stack.Screen options={{ title: '일정 가져오기', headerBackTitle: '뒤로' }} />
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>받은 여행</Text>
              <Text style={styles.previewTitle}>📌 {preview.title}</Text>
              {(preview.country || preview.city) && (
                <Text style={styles.previewMeta}>
                  📍 {[preview.city, preview.country].filter(Boolean).join(', ')}
                </Text>
              )}
              {preview.startDate && preview.endDate && (
                <Text style={styles.previewMeta}>
                  📅 {preview.startDate} ~ {preview.endDate} ({preview.daysCount}일)
                </Text>
              )}
              <Text style={styles.previewMeta}>
                📋 일정 {preview.itemCount}개
              </Text>
              {preview.includesCost && preview.budget != null && (
                <Text style={styles.previewMeta}>
                  💰 예산 {preview.budget.toLocaleString()} {preview.currency}
                </Text>
              )}
            </View>

            <View style={styles.optionCard}>
              <Text style={styles.optionTitle}>📦 포함된 데이터</Text>
              <View style={{ marginTop: Spacing.sm, gap: 4 }}>
                <Text style={styles.optionListItem}>• 일정 (시간/장소/메모)</Text>
                <Text style={styles.optionListItem}>• 카테고리</Text>
                {preview.includesCost && (
                  <Text style={styles.optionListItem}>• 예산 / 일정별 예상 비용</Text>
                )}
              </View>
            </View>

            <View style={styles.optionCard}>
              <Text style={styles.optionTitle}>📝 가져오기 방식</Text>
              <Pressable
                style={[styles.radioRow, importMode === 'new' && styles.radioRowActive]}
                onPress={() => {
                  haptic.tap();
                  setImportMode('new');
                }}
              >
                <View style={[styles.radio, importMode === 'new' && styles.radioOn]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.radioLabel}>새 여행으로 추가</Text>
                  <Text style={styles.radioDesc}>완전히 새로운 여행을 만들어요</Text>
                </View>
              </Pressable>
              <Pressable
                style={[styles.radioRow, importMode === 'merge' && styles.radioRowActive]}
                onPress={() => {
                  haptic.tap();
                  setImportMode('merge');
                }}
              >
                <View style={[styles.radio, importMode === 'merge' && styles.radioOn]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.radioLabel}>기존 여행에 일정 합치기</Text>
                  <Text style={styles.radioDesc}>이미 있는 여행에 일정만 추가해요</Text>
                </View>
              </Pressable>
            </View>

            {importMode === 'merge' && (
              <View style={styles.optionCard}>
                <Text style={styles.optionTitle}>합칠 여행 선택</Text>
                {existingTrips.length === 0 ? (
                  <Text style={styles.emptyText}>기존 여행이 없어요. 새 여행으로 추가해주세요.</Text>
                ) : (
                  existingTrips.map((t) => (
                    <Pressable
                      key={t.id}
                      style={[
                        styles.tripRow,
                        targetTripId === t.id && styles.tripRowActive,
                      ]}
                      onPress={() => {
                        haptic.tap();
                        setTargetTripId(t.id!);
                      }}
                    >
                      <View style={[styles.radio, targetTripId === t.id && styles.radioOn]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tripRowTitle}>{t.title}</Text>
                        <Text style={styles.tripRowMeta}>
                          {[t.city, t.country].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                    </Pressable>
                  ))
                )}
              </View>
            )}

            <Pressable
              style={[styles.confirmBtn, importing && styles.confirmBtnDisabled]}
              disabled={importing}
              onPress={onConfirmImport}
            >
              {importing ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.confirmBtnText}>✅ 가져오기</Text>
              )}
            </Pressable>

            <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
              <Text style={styles.cancelBtnText}>취소</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </>
    );
  }

  // ----- 카메라 스캔 화면 -----
  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <>
        <Stack.Screen options={{ title: '일정 받기', headerBackTitle: '뒤로' }} />
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <View style={styles.permissionBox}>
            <Text style={styles.permissionIcon}>📷</Text>
            <Text style={styles.permissionTitle}>카메라 권한 필요</Text>
            <Text style={styles.permissionDesc}>
              QR 코드 스캔을 위해 카메라 권한을 허용해주세요
            </Text>
            <Pressable style={styles.confirmBtn} onPress={requestPermission}>
              <Text style={styles.confirmBtnText}>권한 허용</Text>
            </Pressable>
            <Pressable
              style={styles.cancelBtn}
              onPress={() => setStep('manual')}
            >
              <Text style={styles.cancelBtnText}>또는 링크 직접 붙여넣기</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </>
    );
  }

  // 수동 입력 모드
  if (step === 'manual') {
    return (
      <>
        <Stack.Screen options={{ title: '링크 붙여넣기', headerBackTitle: '뒤로' }} />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={64}
        >
          <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.manualLabel}>공유받은 링크 또는 코드를 붙여넣기</Text>
              <TextInput
                style={styles.manualInput}
                placeholder="triplive://import?d=..."
                placeholderTextColor={colors.textTertiary}
                value={manualText}
                onChangeText={setManualText}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable style={styles.confirmBtn} onPress={onManualImport}>
                <Text style={styles.confirmBtnText}>📥 가져오기</Text>
              </Pressable>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => {
                  setStep('scan');
                  setManualText('');
                }}
              >
                <Text style={styles.cancelBtnText}>← QR 스캔으로 돌아가기</Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </>
    );
  }

  // 기본 — QR 스캔 화면
  return (
    <>
      <Stack.Screen options={{ title: '일정 받기', headerBackTitle: '뒤로' }} />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.scanContainer}>
          <View style={styles.cameraFrame}>
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanned ? undefined : onQRScanned}
            />
            <View style={styles.cameraOverlay}>
              <View style={styles.cameraTarget} />
            </View>
          </View>
          <View style={styles.scanGuide}>
            <Text style={styles.scanTitle}>📷 친구의 QR 코드를 비춰주세요</Text>
            <Text style={styles.scanDesc}>
              상대방이 Triplive에서{'\n'}
              여행 → 📤 공유 → QR 코드 화면을 띄워주면{'\n'}
              자동으로 가져옵니다
            </Text>
          </View>
          <Pressable
            style={styles.manualBtn}
            onPress={() => setStep('manual')}
          >
            <Text style={styles.manualBtnText}>🔗 또는 링크 직접 붙여넣기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scroll: { padding: Spacing.lg, paddingBottom: Spacing.huge },

    previewCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: Spacing.lg,
      marginBottom: Spacing.md, ...Shadows.sm,
    },
    previewLabel: {
      fontSize: Typography.labelSmall, color: c.accent,
      marginBottom: Spacing.xs, letterSpacing: 1, fontWeight: '600',
    },
    previewTitle: {
      fontSize: Typography.titleLarge, fontWeight: '700',
      color: c.textPrimary, marginBottom: Spacing.sm,
    },
    previewMeta: {
      fontSize: Typography.bodyMedium, color: c.textSecondary, marginTop: 2,
    },

    optionCard: {
      backgroundColor: c.surface, borderRadius: 12, padding: Spacing.lg,
      marginBottom: Spacing.md, ...Shadows.sm,
    },
    optionTitle: {
      fontSize: Typography.bodyMedium, fontWeight: '700',
      color: c.textPrimary, marginBottom: Spacing.sm,
    },
    optionListItem: {
      fontSize: Typography.labelSmall, color: c.textSecondary,
    },

    radioRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md,
      gap: Spacing.md,
    },
    radioRowActive: {},
    radio: {
      width: 20, height: 20, borderRadius: 10,
      borderWidth: 2, borderColor: c.border,
    },
    radioOn: {
      borderColor: c.accent, backgroundColor: c.accent,
    },
    radioLabel: {
      fontSize: Typography.bodyMedium, fontWeight: '600', color: c.textPrimary,
    },
    radioDesc: {
      fontSize: Typography.labelSmall, color: c.textTertiary, marginTop: 2,
    },

    tripRow: {
      flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
      borderRadius: 8, gap: Spacing.md, marginTop: Spacing.xs,
    },
    tripRowActive: { backgroundColor: c.surfaceAlt },
    tripRowTitle: {
      fontSize: Typography.bodyMedium, fontWeight: '600', color: c.textPrimary,
    },
    tripRowMeta: {
      fontSize: Typography.labelSmall, color: c.textTertiary, marginTop: 2,
    },
    emptyText: {
      fontSize: Typography.bodyMedium, color: c.textTertiary,
      textAlign: 'center', paddingVertical: Spacing.lg,
    },

    confirmBtn: {
      backgroundColor: c.primary, padding: Spacing.lg, borderRadius: 12,
      alignItems: 'center', marginTop: Spacing.lg,
    },
    confirmBtnDisabled: { opacity: 0.6 },
    confirmBtnText: {
      fontSize: Typography.bodyLarge, fontWeight: '700', color: c.textOnPrimary,
    },
    cancelBtn: {
      padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm,
    },
    cancelBtnText: {
      fontSize: Typography.bodyMedium, color: c.textTertiary,
    },

    // 스캔 화면
    scanContainer: { flex: 1, padding: Spacing.lg, justifyContent: 'space-between' },
    cameraFrame: {
      flex: 1, borderRadius: 16, overflow: 'hidden',
      backgroundColor: '#000', marginVertical: Spacing.lg,
    },
    cameraOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center', justifyContent: 'center',
    },
    cameraTarget: {
      width: 240, height: 240, borderWidth: 3,
      borderColor: c.accent, borderRadius: 16,
    },
    scanGuide: { alignItems: 'center', marginBottom: Spacing.lg },
    scanTitle: {
      fontSize: Typography.bodyLarge, fontWeight: '700',
      color: c.textPrimary, marginBottom: Spacing.sm,
    },
    scanDesc: {
      fontSize: Typography.bodyMedium, color: c.textSecondary,
      textAlign: 'center', lineHeight: Typography.bodyMedium * 1.5,
    },
    manualBtn: {
      padding: Spacing.md, alignItems: 'center', borderRadius: 8,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    },
    manualBtnText: {
      fontSize: Typography.bodyMedium, color: c.accent, fontWeight: '600',
    },

    // 수동 입력
    manualLabel: {
      fontSize: Typography.bodyMedium, color: c.textSecondary,
      marginBottom: Spacing.sm,
    },
    manualInput: {
      backgroundColor: c.surface, padding: Spacing.md,
      borderRadius: 8, minHeight: 120,
      fontSize: Typography.bodyMedium, color: c.textPrimary,
      borderWidth: 1, borderColor: c.border,
      textAlignVertical: 'top',
    },

    // 권한
    permissionBox: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      padding: Spacing.xl,
    },
    permissionIcon: { fontSize: 64, marginBottom: Spacing.lg },
    permissionTitle: {
      fontSize: Typography.titleMedium, fontWeight: '700',
      color: c.textPrimary, marginBottom: Spacing.sm,
    },
    permissionDesc: {
      fontSize: Typography.bodyMedium, color: c.textSecondary,
      textAlign: 'center', marginBottom: Spacing.xl,
    },
  });
}
