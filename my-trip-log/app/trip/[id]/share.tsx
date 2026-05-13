/**
 * 여행 일정 공유 화면
 *
 * 두 가지 공유 방식 제공:
 *  - 📷 QR 코드 (같은 자리 친구에게 — 카메라로 스캔)
 *  - 🔗 링크 복사 / 공유 시트 (카톡·문자·이메일 등 원격 공유)
 *
 * 옵션:
 *  - 비용 정보 포함 토글 (예산 + 일정별 cost)
 *
 * 동작:
 *  1) 사용자가 토글 + 모드 선택
 *  2) exportTripForShare() → 압축 Base64
 *  3) QR 또는 buildShareLink() → 화면 표시
 */
import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Alert, Share, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import {
  exportTripForShare, buildShareLink, SHARED_PAYLOAD_MAX_LEN, qrEclForPayload,
} from '@/utils/tripShare';
import { exportTripScheduleAsPdf } from '@/utils/tripPdfExport';
import { getTripById } from '@/db/trips';
import { getTripItems } from '@/db/items';
import type { Trip, TripItem } from '@/types';

type Mode = 'qr' | 'link' | 'pdf';

export default function TripShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [items, setItems] = useState<TripItem[]>([]);
  const [includeCost, setIncludeCost] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);  // null = 선택 화면
  const [encoded, setEncoded] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // 여행 데이터 미리 로드 (미리보기 정보 표시용)
  useEffect(() => {
    if (!Number.isFinite(tripId)) return;
    (async () => {
      const t = await getTripById(tripId);
      setTrip(t);
      if (t) {
        const its = await getTripItems(t.id!);
        setItems(its);
      }
    })();
  }, [tripId]);

  // 토글 / 모드 변경 시 페이로드 재생성
  useEffect(() => {
    if (!mode || !trip) {
      setEncoded('');
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const enc = await exportTripForShare(tripId, { includeCost });
        setEncoded(enc);
      } catch (err) {
        Alert.alert('공유 준비 실패', String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, includeCost, trip, tripId]);

  const link = encoded ? buildShareLink(encoded) : '';
  // 카톡/문자 등 일부 메신저는 URL 4,000자 이상이면 잘림
  const linkTooLong = link.length > 3500;
  const qrTooLarge = encoded.length > SHARED_PAYLOAD_MAX_LEN;
  // QR error-correction level 자동 — 페이로드 클 때 L (낮은 EC) 로 더 많이 담음
  const qrEcl = encoded ? qrEclForPayload(encoded) : 'M';

  const onCopyLink = async () => {
    haptic.tap();
    await Clipboard.setStringAsync(link);
    Alert.alert('복사 완료', '링크가 클립보드에 복사되었어요. 카톡/문자에 붙여넣어주세요.');
  };

  const onShareLink = async () => {
    haptic.tap();

    // 카톡·문자 등 일부 메신저는 4,000자 이상 URL 을 잘라버림
    // → 링크 깨져서 받는 쪽 import 실패. 사전 안내 후 PDF/QR 우회 권유.
    if (link.length > 4000) {
      Alert.alert(
        '링크가 너무 길어요',
        '일정이 많아 카톡·문자에서 링크가 잘릴 수 있어요.\n\nQR 코드 또는 PDF 공유를 권장합니다.',
        [
          { text: '그래도 공유', onPress: () => doShareLink() },
          { text: '취소', style: 'cancel' },
        ],
      );
      return;
    }
    await doShareLink();
  };

  const doShareLink = async () => {
    try {
      // 메시지를 짧게 — 카톡이 link preview 만들 때 본문 길이가 짧을수록 안정적
      await Share.share({
        message: `${trip?.title ?? '여행'} 일정\n${link}`,
      });
    } catch (err) {
      Alert.alert('공유 실패', String(err));
    }
  };

  if (!Number.isFinite(tripId)) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>잘못된 여행 ID</Text>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '일정 공유',
          headerBackTitle: '뒤로',
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* 여행 미리보기 카드 */}
          {trip && (
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>공유할 여행</Text>
              <Text style={styles.previewTitle}>📌 {trip.title}</Text>
              {trip.country || trip.city ? (
                <Text style={styles.previewMeta}>
                  📍 {[trip.city, trip.country].filter(Boolean).join(', ')}
                </Text>
              ) : null}
              {trip.startDate && trip.endDate ? (
                <Text style={styles.previewMeta}>
                  📅 {trip.startDate} ~ {trip.endDate}
                </Text>
              ) : null}
              <Text style={styles.previewMeta}>
                📋 일정 {items.length}개
              </Text>
            </View>
          )}

          {/* 옵션 — 비용 포함 토글 */}
          <View style={styles.optionCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>💰 비용 정보 포함</Text>
              <Text style={styles.optionDesc}>
                예산 · 일정별 예상 비용을 함께 공유합니다
              </Text>
            </View>
            <Pressable
              style={[
                styles.toggle,
                includeCost && styles.toggleOn,
              ]}
              onPress={() => {
                haptic.tap();
                setIncludeCost((v) => !v);
              }}
            >
              <View
                style={[
                  styles.toggleKnob,
                  includeCost && styles.toggleKnobOn,
                ]}
              />
            </Pressable>
          </View>

          {/* 모드 선택 */}
          {mode === null ? (
            <View style={{ marginTop: Spacing.xl }}>
              <Pressable
                style={[styles.bigButton, styles.bigButtonPrimary]}
                onPress={() => {
                  haptic.tap();
                  setMode('qr');
                }}
              >
                <Text style={styles.bigButtonIcon}>📷</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigButtonTitle}>QR 코드로 공유</Text>
                  <Text style={styles.bigButtonDesc}>
                    같은 자리에 있는 친구가 카메라로 스캔
                  </Text>
                </View>
              </Pressable>

              <View style={{ height: Spacing.md }} />

              <Pressable
                style={[styles.bigButton, styles.bigButtonSecondary]}
                onPress={() => {
                  haptic.tap();
                  setMode('link');
                }}
              >
                <Text style={styles.bigButtonIcon}>🔗</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigButtonTitleSecondary}>링크로 공유</Text>
                  <Text style={styles.bigButtonDescSecondary}>
                    카톡 · 문자 · 이메일 (Triplive 사용자)
                  </Text>
                </View>
              </Pressable>

              <View style={{ height: Spacing.md }} />

              <Pressable
                style={[styles.bigButton, styles.bigButtonSecondary]}
                onPress={() => {
                  haptic.tap();
                  setMode('pdf');
                }}
              >
                <Text style={styles.bigButtonIcon}>📄</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigButtonTitleSecondary}>PDF로 공유</Text>
                  <Text style={styles.bigButtonDescSecondary}>
                    Triplive 없는 친구에게도 OK
                  </Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {/* QR 모드 */}
          {mode === 'qr' && (
            <View style={styles.modeCard}>
              {loading || !encoded ? (
                <ActivityIndicator color={colors.accent} size="large" />
              ) : qrTooLarge ? (
                <View>
                  <Text style={styles.warningText}>
                    ⚠️ 일정이 많아 QR 코드 한 장으로는 담을 수 없어요
                  </Text>
                  <Text style={styles.warningSubText}>
                    아래 방법 중 하나로 보내주세요:{'\n'}
                    • 📄 PDF 모드로 공유 (가장 안정적){'\n'}
                    • 💰 비용 정보 토글 끄기 → 페이로드 감소{'\n'}
                    • 일정 일부 삭제 후 다시 시도
                  </Text>
                </View>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <View style={styles.qrFrame}>
                    <QRCode
                      value={buildShareLink(encoded)}
                      size={240}
                      color={colors.textPrimary}
                      backgroundColor={colors.surface}
                      ecl={qrEcl}
                    />
                  </View>
                  <Text style={styles.qrHint}>
                    친구 폰의 Triplive에서{'\n'}
                    여행 탭 → 📥 받기 → QR 스캔
                  </Text>
                </View>
              )}
              <Pressable
                style={styles.changeModeBtn}
                onPress={() => {
                  haptic.tap();
                  setMode(null);
                }}
              >
                <Text style={styles.changeModeBtnText}>← 다른 방법 선택</Text>
              </Pressable>
            </View>
          )}

          {/* PDF 모드 */}
          {mode === 'pdf' && trip && (
            <View style={styles.modeCard}>
              <Text style={styles.pdfTitle}>📄 PDF 일정표</Text>
              <Text style={styles.pdfDesc}>
                Triplive 앱이 없는 친구에게도{'\n'}
                카톡·이메일로 보낼 수 있는 PDF 파일을 만들어요
              </Text>

              <View style={styles.pdfIncluded}>
                <Text style={styles.pdfIncludedLabel}>📦 포함되는 내용:</Text>
                <Text style={styles.pdfIncludedItem}>• 여행 제목 · 날짜 · 도시</Text>
                <Text style={styles.pdfIncludedItem}>• Day 별 일정 (시간 · 장소 · 메모)</Text>
                <Text style={styles.pdfIncludedItem}>• 카테고리 (관광/식사/이동 등)</Text>
                {includeCost && (
                  <Text style={styles.pdfIncludedItem}>• 예상 비용 · 총 예산</Text>
                )}
              </View>

              <Pressable
                style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
                disabled={loading}
                onPress={async () => {
                  haptic.tap();
                  try {
                    await exportTripScheduleAsPdf(trip, items, { includeCost });
                  } catch (err) {
                    Alert.alert('PDF 만들기 실패', String(err));
                  }
                }}
              >
                <Text style={styles.confirmBtnText}>📄 PDF 만들기 + 공유하기</Text>
              </Pressable>

              <Pressable
                style={styles.changeModeBtn}
                onPress={() => {
                  haptic.tap();
                  setMode(null);
                }}
              >
                <Text style={styles.changeModeBtnText}>← 다른 방법 선택</Text>
              </Pressable>
            </View>
          )}

          {/* 링크 모드 */}
          {mode === 'link' && (
            <View style={styles.modeCard}>
              {loading || !encoded ? (
                <ActivityIndicator color={colors.accent} size="large" />
              ) : (
                <>
                  {linkTooLong && (
                    <View style={styles.warningBox}>
                      <Text style={styles.warningText}>
                        ⚠️ 링크가 길어요 ({link.length.toLocaleString()}자)
                      </Text>
                      <Text style={styles.warningSubText}>
                        카톡·문자는 보통 4,000자 이상 URL 을 자릅니다.{'\n'}
                        QR 코드 또는 PDF 모드를 권장해요.
                      </Text>
                    </View>
                  )}
                  <View style={styles.linkBox}>
                    <Text style={styles.linkText} numberOfLines={3}>
                      {link}
                    </Text>
                  </View>
                  <View style={styles.linkActions}>
                    <Pressable style={styles.linkActionBtn} onPress={onCopyLink}>
                      <Text style={styles.linkActionIcon}>📋</Text>
                      <Text style={styles.linkActionLabel}>복사</Text>
                    </Pressable>
                    <Pressable style={styles.linkActionBtn} onPress={onShareLink}>
                      <Text style={styles.linkActionIcon}>📤</Text>
                      <Text style={styles.linkActionLabel}>공유</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.linkHint}>
                    💡 받는 분의 Triplive 앱이 자동으로 열려요{'\n'}
                    {Platform.OS === 'ios'
                      ? '(iOS: Safari 또는 메신저에서 링크 탭)'
                      : '(Android: 메신저에서 링크 탭 → Triplive 선택)'}
                  </Text>
                </>
              )}
              <Pressable
                style={styles.changeModeBtn}
                onPress={() => {
                  haptic.tap();
                  setMode(null);
                }}
              >
                <Text style={styles.changeModeBtnText}>← 다른 방법 선택</Text>
              </Pressable>
            </View>
          )}

          {/* 안내 — 프라이버시 */}
          <View style={styles.privacyBox}>
            <Text style={styles.privacyTitle}>🔒 공유 안전</Text>
            <Text style={styles.privacyText}>
              • 닉네임 · 이메일 · 디바이스 정보는 공유되지 않아요{'\n'}
              • 영수증 사진 · 일기는 공유되지 않아요{'\n'}
              • 실제 사용 비용은 공유되지 않아요 (예산만 옵션){'\n'}
              • 받는 사람도 Triplive 앱이 설치돼있어야 해요
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scroll: { padding: Spacing.lg, paddingBottom: Spacing.huge },
    errorText: {
      color: c.error, textAlign: 'center', marginTop: Spacing.huge,
      fontSize: Typography.bodyLarge,
    },

    previewCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      ...Shadows.sm,
    },
    previewLabel: {
      fontSize: Typography.labelSmall,
      color: c.textTertiary,
      marginBottom: Spacing.xs,
      letterSpacing: 1,
    },
    previewTitle: {
      fontSize: Typography.titleLarge,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: Spacing.sm,
    },
    previewMeta: {
      fontSize: Typography.bodyMedium,
      color: c.textSecondary,
      marginTop: 2,
    },

    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      ...Shadows.sm,
    },
    optionTitle: {
      fontSize: Typography.bodyMedium,
      fontWeight: '600',
      color: c.textPrimary,
    },
    optionDesc: {
      fontSize: Typography.labelSmall,
      color: c.textTertiary,
      marginTop: 2,
    },

    toggle: {
      width: 50,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.border,
      padding: 2,
      justifyContent: 'center',
    },
    toggleOn: {
      backgroundColor: c.accent,
    },
    toggleKnob: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.surface,
    },
    toggleKnobOn: {
      transform: [{ translateX: 20 }],
    },

    bigButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.lg,
      borderRadius: 16,
      gap: Spacing.md,
    },
    bigButtonPrimary: {
      backgroundColor: c.primary,
    },
    bigButtonSecondary: {
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    bigButtonIcon: { fontSize: 32 },
    bigButtonTitle: {
      fontSize: Typography.bodyLarge,
      fontWeight: '700',
      color: c.textOnPrimary,
    },
    bigButtonDesc: {
      fontSize: Typography.labelSmall,
      color: c.textOnPrimary,
      opacity: 0.85,
      marginTop: 2,
    },
    bigButtonTitleSecondary: {
      fontSize: Typography.bodyLarge,
      fontWeight: '700',
      color: c.textPrimary,
    },
    bigButtonDescSecondary: {
      fontSize: Typography.labelSmall,
      color: c.textTertiary,
      marginTop: 2,
    },

    // PDF 모드
    pdfTitle: {
      fontSize: Typography.titleMedium,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: Spacing.sm,
    },
    pdfDesc: {
      fontSize: Typography.bodyMedium,
      color: c.textSecondary,
      lineHeight: Typography.bodyMedium * 1.5,
      marginBottom: Spacing.lg,
    },
    pdfIncluded: {
      backgroundColor: c.surfaceAlt,
      padding: Spacing.md,
      borderRadius: 8,
      marginBottom: Spacing.lg,
    },
    pdfIncludedLabel: {
      fontSize: Typography.bodyMedium,
      fontWeight: '600',
      color: c.textPrimary,
      marginBottom: Spacing.xs,
    },
    pdfIncludedItem: {
      fontSize: Typography.labelSmall,
      color: c.textSecondary,
      marginTop: 2,
    },
    confirmBtn: {
      backgroundColor: c.primary,
      padding: Spacing.lg,
      borderRadius: 12,
      alignItems: 'center',
    },
    confirmBtnDisabled: { opacity: 0.6 },
    confirmBtnText: {
      fontSize: Typography.bodyLarge,
      fontWeight: '700',
      color: c.textOnPrimary,
    },

    modeCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: Spacing.xl,
      marginTop: Spacing.xl,
      ...Shadows.sm,
    },

    qrFrame: {
      padding: Spacing.lg,
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 3,
      borderColor: c.accent,
    },
    qrHint: {
      marginTop: Spacing.lg,
      fontSize: Typography.bodyMedium,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: Typography.bodyMedium * 1.5,
    },

    warningBox: {
      backgroundColor: c.warning + '20',
      padding: Spacing.md,
      borderRadius: 8,
      marginBottom: Spacing.md,
    },
    warningText: {
      fontSize: Typography.bodyMedium,
      color: c.warning,
      fontWeight: '600',
    },
    warningSubText: {
      fontSize: Typography.labelSmall,
      color: c.textSecondary,
      marginTop: 4,
    },

    linkBox: {
      backgroundColor: c.surfaceAlt,
      padding: Spacing.md,
      borderRadius: 8,
      marginBottom: Spacing.md,
    },
    linkText: {
      fontSize: Typography.labelSmall,
      color: c.textSecondary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    linkActions: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    linkActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.md,
      backgroundColor: c.accent,
      borderRadius: 8,
      gap: Spacing.sm,
    },
    linkActionIcon: { fontSize: 18 },
    linkActionLabel: {
      fontSize: Typography.bodyMedium,
      fontWeight: '700',
      color: c.textOnAccent,
    },
    linkHint: {
      fontSize: Typography.labelSmall,
      color: c.textTertiary,
      textAlign: 'center',
      lineHeight: Typography.labelSmall * 1.6,
    },

    changeModeBtn: {
      marginTop: Spacing.lg,
      padding: Spacing.sm,
      alignItems: 'center',
    },
    changeModeBtnText: {
      fontSize: Typography.bodyMedium,
      color: c.accent,
      fontWeight: '600',
    },

    privacyBox: {
      marginTop: Spacing.xl,
      padding: Spacing.lg,
      backgroundColor: c.surfaceAlt,
      borderRadius: 12,
    },
    privacyTitle: {
      fontSize: Typography.bodyMedium,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: Spacing.sm,
    },
    privacyText: {
      fontSize: Typography.labelSmall,
      color: c.textSecondary,
      lineHeight: Typography.labelSmall * 1.7,
    },
  });
}
