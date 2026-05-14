/**
 * Triplive PRO 결제 화면
 *
 * 진입 경로:
 *  - AdBanner 의 ✕ 버튼 / 플레이스홀더 카드 탭
 *  - 내 정보(me) 탭 → "Triplive PRO" 메뉴
 *
 * 흐름:
 *  1) 스토어에서 상품 정보 fetch (현지화 가격)
 *  2) "구매하기" → buyPro() → 결제 시트 표시
 *  3) 성공 시 purchaseUpdatedListener 가 setProActive → 자동으로 화면 갱신
 *  4) "구매 복원" 은 기존 구매자 위한 별도 버튼 (Apple/Google 정책 필수)
 */
import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Alert, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';

import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import {
  initIapConnection, fetchProProduct, buyPro, restorePurchases,
  PRO_DISPLAY_PRICE, type ProProductInfo,
} from '@/utils/proStore';
import { isProActive } from '@/utils/proStatus';

export default function ProScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [pro, setPro] = useState<boolean>(false);
  const [product, setProduct] = useState<ProProductInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(true);

  // 마운트 시 IAP 연결 + 상태 / 상품 정보 로드
  useEffect(() => {
    (async () => {
      const active = await isProActive();
      setPro(active);

      const ok = await initIapConnection();
      if (!ok) {
        setLoadingProduct(false);
        return;
      }
      const p = await fetchProProduct();
      setProduct(p);
      setLoadingProduct(false);
    })();
  }, []);

  // 구매 후 PRO 상태 다시 체크 (purchaseUpdatedListener 가 setProActive 한 직후)
  useEffect(() => {
    const interval = setInterval(async () => {
      const active = await isProActive();
      if (active && !pro) setPro(true);
    }, 1500);
    return () => clearInterval(interval);
  }, [pro]);

  const onBuy = async () => {
    haptic.tap();
    setBusy(true);
    try {
      await buyPro();
      // 결제 시트가 뜸 → 사용자가 결제 완료하면 purchaseUpdatedListener 가
      // setProActive 를 호출 → 위 interval 이 변화 감지하고 pro=true
      // 사용자 취소나 즉시 실패는 catch 로
    } catch (err: any) {
      if (err?.code !== 'E_USER_CANCELLED') {
        Alert.alert('결제 실패', err?.message || '잠시 후 다시 시도해주세요.');
      }
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    haptic.tap();
    setBusy(true);
    try {
      const ok = await restorePurchases();
      if (ok) {
        setPro(true);
        Alert.alert('복원 완료', 'Triplive PRO 가 활성화되었어요!');
      } else {
        Alert.alert('복원할 구매 없음', '이 계정으로 결제한 PRO 구매를 찾지 못했어요.');
      }
    } catch (err: any) {
      Alert.alert('복원 실패', err?.message || '잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{ title: 'Triplive PRO', headerBackTitle: '뒤로' }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* 히어로 */}
          <View style={styles.hero}>
            <Text style={styles.heroIcon}>✨</Text>
            <Text style={styles.heroTitle}>Triplive PRO</Text>
            <Text style={styles.heroSubtitle}>
              광고 없이 깔끔하게 여행을 기록하세요
            </Text>
          </View>

          {/* 이미 PRO */}
          {pro ? (
            <View style={styles.activeCard}>
              <Text style={styles.activeIcon}>✓</Text>
              <Text style={styles.activeTitle}>PRO 활성</Text>
              <Text style={styles.activeDesc}>
                Triplive PRO 가 이미 활성화되어 있어요.{'\n'}
                광고 없이 자유롭게 사용하세요!
              </Text>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => { haptic.tap(); router.back(); }}
              >
                <Text style={styles.secondaryBtnText}>닫기</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* 혜택 리스트 */}
              <View style={styles.benefitsCard}>
                <Benefit icon="🚫" title="광고 완전 제거"
                  desc="배너 광고 없이 깔끔한 화면" styles={styles} />
                <Benefit icon="✨" title="향후 PRO 기능 우선"
                  desc="새 기능 우선 사용 + 추가 비용 없음" styles={styles} />
                <Benefit icon="🌐" title="가족 공유 가능"
                  desc={Platform.OS === 'ios' ? 'Apple Family Sharing 지원' : 'Google Play 가족 공유 지원'}
                  styles={styles} last />
              </View>

              {/* 가격 카드 */}
              <View style={styles.priceCard}>
                <Text style={styles.priceLabel}>한 번만 결제 · 평생 사용</Text>
                <Text style={styles.priceAmount}>
                  {loadingProduct
                    ? '— ' : (product?.price || PRO_DISPLAY_PRICE)}
                </Text>
                {!loadingProduct && !product && (
                  <Text style={styles.priceNote}>
                    💡 스토어 정보를 불러오지 못했어요.{'\n'}
                    잠시 후 다시 시도해주세요.
                  </Text>
                )}

                <Pressable
                  style={[styles.buyBtn, (busy || !product) && styles.buyBtnDisabled]}
                  disabled={busy || !product}
                  onPress={onBuy}
                >
                  {busy ? (
                    <ActivityIndicator color={colors.textOnPrimary} />
                  ) : (
                    <Text style={styles.buyBtnText}>구매하기</Text>
                  )}
                </Pressable>
              </View>

              {/* 복원 / 정책 */}
              <View style={styles.footerLinks}>
                <Pressable onPress={onRestore} disabled={busy}>
                  <Text style={styles.footerLink}>이전 구매 복원</Text>
                </Pressable>
                <Text style={styles.footerDivider}>·</Text>
                <Pressable onPress={() => {
                  haptic.tap();
                  router.push('/settings/terms');
                }}>
                  <Text style={styles.footerLink}>이용약관</Text>
                </Pressable>
                <Text style={styles.footerDivider}>·</Text>
                <Pressable onPress={() => {
                  haptic.tap();
                  router.push('/settings/privacy');
                }}>
                  <Text style={styles.footerLink}>개인정보</Text>
                </Pressable>
              </View>

              {/* 안내 */}
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>
                  • 결제는 Apple ID / Google Play 계정에 청구됩니다{'\n'}
                  • 환불은 Apple / Google 정책을 따릅니다{'\n'}
                  • 같은 계정으로 다른 기기에서 "복원" 가능{'\n'}
                  • 한 번 결제 시 추가 비용 없음 (구독 아님)
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function Benefit({ icon, title, desc, styles, last }: {
  icon: string; title: string; desc: string;
  styles: ReturnType<typeof createStyles>;
  last?: boolean;
}) {
  return (
    <View style={[styles.benefitRow, last && styles.benefitRowLast]}>
      <Text style={styles.benefitIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitDesc}>{desc}</Text>
      </View>
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scroll: { padding: Spacing.lg, paddingBottom: Spacing.huge },

    hero: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
      marginBottom: Spacing.lg,
    },
    heroIcon: { fontSize: 56, marginBottom: Spacing.sm },
    heroTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: c.textPrimary,
      letterSpacing: -0.5,
    },
    heroSubtitle: {
      fontSize: Typography.bodyMedium,
      color: c.textSecondary,
      marginTop: Spacing.sm,
      textAlign: 'center',
    },

    benefitsCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      ...Shadows.sm,
    },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderLight,
      gap: Spacing.md,
    },
    benefitRowLast: {
      borderBottomWidth: 0,
    },
    benefitIcon: { fontSize: 28 },
    benefitTitle: {
      fontSize: Typography.bodyMedium,
      fontWeight: '700',
      color: c.textPrimary,
    },
    benefitDesc: {
      fontSize: Typography.labelSmall,
      color: c.textTertiary,
      marginTop: 2,
    },

    priceCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: Spacing.xl,
      alignItems: 'center',
      ...Shadows.md,
    },
    priceLabel: {
      fontSize: Typography.labelSmall,
      color: c.textTertiary,
      letterSpacing: 1,
      marginBottom: Spacing.xs,
    },
    priceAmount: {
      fontSize: 36,
      fontWeight: '800',
      color: c.accent,
      letterSpacing: -1,
      marginBottom: Spacing.lg,
    },
    priceNote: {
      fontSize: Typography.labelSmall,
      color: c.warning,
      textAlign: 'center',
      marginBottom: Spacing.md,
      lineHeight: Typography.labelSmall * 1.6,
    },
    buyBtn: {
      backgroundColor: c.primary,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xxl,
      borderRadius: 12,
      minWidth: 240,
      alignItems: 'center',
    },
    buyBtnDisabled: {
      opacity: 0.5,
    },
    buyBtnText: {
      fontSize: Typography.bodyLarge,
      fontWeight: '800',
      color: c.textOnPrimary,
      letterSpacing: 0.5,
    },

    footerLinks: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: Spacing.lg,
      gap: Spacing.sm,
    },
    footerLink: {
      fontSize: Typography.labelSmall,
      color: c.accent,
      fontWeight: '600',
    },
    footerDivider: {
      color: c.textTertiary,
      fontSize: Typography.labelSmall,
    },

    noticeBox: {
      marginTop: Spacing.xl,
      padding: Spacing.md,
      backgroundColor: c.surfaceAlt,
      borderRadius: 8,
    },
    noticeText: {
      fontSize: Typography.labelSmall,
      color: c.textSecondary,
      lineHeight: Typography.labelSmall * 1.8,
    },

    activeCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: Spacing.xxl,
      alignItems: 'center',
      ...Shadows.sm,
    },
    activeIcon: {
      fontSize: 64,
      color: c.success,
      marginBottom: Spacing.md,
    },
    activeTitle: {
      fontSize: Typography.titleLarge,
      fontWeight: '800',
      color: c.textPrimary,
      marginBottom: Spacing.sm,
    },
    activeDesc: {
      fontSize: Typography.bodyMedium,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: Typography.bodyMedium * 1.5,
      marginBottom: Spacing.xl,
    },
    secondaryBtn: {
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xxl,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    secondaryBtnText: {
      fontSize: Typography.bodyMedium,
      fontWeight: '700',
      color: c.textPrimary,
    },
  });
}
