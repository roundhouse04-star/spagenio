/**
 * 광고 배너 컴포넌트 (Triplive)
 *
 * 위치: 탭바 바로 위 (모든 탭 화면에서 동일)
 * 높이: 60pt (AdMob ANCHORED_ADAPTIVE_BANNER 사이즈와 유사)
 *
 * ### 동작 모드
 * `config/ads.ts`의 `ADS_ENABLED` 값으로 전환:
 * - `false` (기본): PRO 홍보 플레이스홀더 표시
 * - `true`: 실제 AdMob 광고 표시 (빌드에 패키지 포함 필요)
 *
 * ### AdMob 실광고 활성화 (출시 전 체크리스트)
 * 1. `npm install react-native-google-mobile-ads`
 * 2. `config/ads.ts`의 AD_UNIT_IDS, ADMOB_APP_IDS 채우기
 * 3. `app.json`의 plugins 에 react-native-google-mobile-ads 추가
 * 4. `config/ads.ts`의 `ADS_ENABLED = true`
 * 5. `eas build --profile production` 으로 네이티브 빌드
 *
 * ※ Expo Go 에서는 광고 작동 안 함. 반드시 EAS 빌드 또는 dev-client 필요.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Typography } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { ADS_ENABLED, ADS_LIVE, AD_UNIT_IDS } from '@/config/ads';
import { isProActive } from '@/utils/proStatus';

// Conditional import — 패키지가 없어도 앱이 크래시 안 나게
// ⚠️ ADS_ENABLED 가 false (= __DEV__) 면 require 자체를 시도하지 않음
//    → Expo Go 에서도 안전 (RNGoogleMobileAdsModule TurboModule lookup 회피)
let BannerAd: any = null;
let BannerAdSize: any = null;
let TestIds: any = null;
if (ADS_ENABLED) {
  try {
    // 광고 SDK는 EAS dev/prod 빌드에만 포함 — Expo Go에서는 미설치라 require로 옵셔널 로드
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const GMA = require('react-native-google-mobile-ads');
    BannerAd = GMA?.BannerAd ?? null;
    BannerAdSize = GMA?.BannerAdSize ?? null;
    TestIds = GMA?.TestIds ?? null;
  } catch (e) {
    console.warn('[AdBanner] react-native-google-mobile-ads 없음, 플레이스홀더 fallback', e);
  }
}

type Props = {
  /** 탭 시 동작 (선택). 예: PRO 안내 화면으로 이동. */
  onPress?: () => void;
};

export function AdBanner({ onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [pro, setPro] = useState(false);

  useEffect(() => {
    isProActive().then(setPro).catch(() => setPro(false));
  }, []);

  // PRO 사용자는 광고/플레이스홀더 모두 숨김
  if (pro) return null;

  // 실광고/테스트광고 모드 (ADS_ENABLED + 패키지 설치됨)
  if (ADS_ENABLED && BannerAd && BannerAdSize && TestIds) {
    // ADS_LIVE=true 인 release 빌드에서만 실광고 ID 사용
    // 그 외 모든 production 빌드 (TestFlight 포함) 는 자동으로 데모 ID
    // → 본인/테스터가 클릭해도 무효 트래픽으로 안 잡힘
    const unitId = !ADS_LIVE
      ? TestIds.BANNER
      : Platform.OS === 'ios'
      ? AD_UNIT_IDS.bannerIOS
      : AD_UNIT_IDS.bannerAndroid;

    return (
      <View style={styles.adContainer}>
        <BannerAd
          unitId={unitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>
    );
  }

  // 플레이스홀더 모드 (PRO 홍보 배너)
  const Inner = (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>✨ Triplive PRO 곧 출시!</Text>
          <Text style={styles.sub}>광고 없이 깔끔하게 여행 기록하기</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>SOON</Text>
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.85 }}>
        {Inner}
      </Pressable>
    );
  }
  return Inner;
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: {
      height: 60,
      backgroundColor: '#e6d4a9',
      overflow: 'hidden',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(0,0,0,0.08)',
    },
    adContainer: {
      height: 60,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    content: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      gap: 12,
    },
    title: {
      fontSize: Typography.labelMedium,
      fontWeight: '700',
      color: '#5c4a1a',
    },
    sub: {
      fontSize: Typography.labelSmall,
      color: '#7a6330',
      marginTop: 2,
    },
    badge: {
      backgroundColor: 'rgba(92, 74, 26, 0.92)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    badgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
  });
}
