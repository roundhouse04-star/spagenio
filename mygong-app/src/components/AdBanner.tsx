/**
 * 광고 배너 컴포넌트.
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
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, FontSizes } from '@/theme/theme';
import { ADS_ENABLED, ADS_LIVE, AD_UNIT_IDS } from '@/config/ads';

// Conditional import — 패키지가 없어도 앱이 크래시 안 나게
let BannerAd: any = null;
let BannerAdSize: any = null;
let TestIds: any = null;
if (ADS_ENABLED) {
  try {
    const GMA = require('react-native-google-mobile-ads');
    BannerAd = GMA.BannerAd;
    BannerAdSize = GMA.BannerAdSize;
    TestIds = GMA.TestIds;
  } catch (err) {
    console.warn('[AdBanner] react-native-google-mobile-ads 패키지 없음, 플레이스홀더로 fallback');
  }
}

type Props = {
  /** 탭 시 동작 (선택). 예: PRO 안내 화면으로 이동. */
  onPress?: () => void;
};

export function AdBanner({ onPress }: Props) {
  // 실광고 모드 (ADS_ENABLED + 패키지 설치됨)
  if (ADS_ENABLED && BannerAd && BannerAdSize && TestIds) {
    // ADS_LIVE=true (eas.json release profile) 일 때만 실 ID 사용.
    // 그 외 모든 빌드 (production / TestFlight / internal) 에선 테스트 광고.
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
      <LinearGradient
        colors={['#fff5d6', '#ffe8b3', '#ffd98a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>✨ 내공연관리 PRO 곧 출시!</Text>
          <Text style={styles.sub}>광고 없이 깔끔하게 즐기세요</Text>
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

const styles = StyleSheet.create({
  container: {
    height: 60,
    backgroundColor: '#fff5d6',
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  adContainer: {
    height: 60,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  title: {
    fontSize: FontSizes.caption,
    fontFamily: Fonts.semibold,
    color: '#7a5e00',
  },
  sub: {
    fontSize: FontSizes.tiny,
    color: '#a06700',
    marginTop: 2,
  },
  badge: {
    backgroundColor: 'rgba(122, 94, 0, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
});
