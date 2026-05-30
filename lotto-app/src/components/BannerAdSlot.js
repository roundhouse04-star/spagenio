// AdMob Banner — Expo Go에선 native module이 없으므로 placeholder 표시
// 실기기 dev build / production에서만 실제 광고 노출
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';
import { theme } from '../lib/theme';
import { getReceiptName, isAppStore } from '../../modules/ad-environment';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

let AdsModule = null;
if (!isExpoGo) {
  try {
    AdsModule = require('react-native-google-mobile-ads');
  } catch (e) {
    AdsModule = null;
  }
}

// ── 광고 단위 ID ──
// 환경별 분기:
//   __DEV__ / Expo Go                          → 테스트 광고
//   ADS_MODE != 'production' (dev/preview/testflight 프로필) → 테스트 광고
//   ADS_MODE == 'production' + iOS TestFlight  → 테스트 광고 (네이티브 receipt 감지)
//   ADS_MODE == 'production' + iOS App Store   → 실제 광고
//   ADS_MODE == 'production' + Android         → 실제 광고
const TEST_BANNER = AdsModule?.TestIds?.BANNER;

const PROD_BANNER_ID = Platform.select({
  ios: 'ca-app-pub-2473584153798184/6094406727',     // iOS Banner
  android: 'ca-app-pub-2473584153798184/7215916703', // Android Banner
});

const wantsProductionAds = !__DEV__ && process.env.EXPO_PUBLIC_ADS_MODE === 'production';

function resolveBannerUnitId() {
  if (!wantsProductionAds) return TEST_BANNER;
  if (Platform.OS === 'android') return PROD_BANNER_ID;

  // iOS: Bundle.main.appStoreReceiptURL.lastPathComponent 로 판별
  //   "receipt"        → App Store (실제 광고)
  //   "sandboxReceipt" → TestFlight (테스트 광고)
  //   그 외 / null     → 안전하게 테스트 광고
  const receiptName = getReceiptName();
  console.log('[Banner] iOS receiptName=', receiptName);
  if (isAppStore()) return PROD_BANNER_ID;
  return TEST_BANNER;
}

const BANNER_UNIT_ID = resolveBannerUnitId();

export default function BannerAdSlot({ position = 'bottom' }) {
  // Expo Go 또는 모듈 없음 → placeholder
  if (!AdsModule || !AdsModule.BannerAd) {
    return (
      <View style={[styles.placeholder, position === 'top' && styles.placeholderTop]}>
        <Text style={styles.placeholderTitle}>📢 광고 영역</Text>
        <Text style={styles.placeholderSub}>AdMob 광고는 dev build / 프로덕션 빌드에서 노출됩니다</Text>
      </View>
    );
  }

  const { BannerAd, BannerAdSize } = AdsModule;

  return (
    <View style={[styles.wrap, position === 'top' && styles.wrapTop]}>
      <BannerAd
        unitId={BANNER_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        onAdFailedToLoad={(error) => console.log('[Banner] failed:', error?.message)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: theme.border,
    alignItems: 'center', paddingVertical: 4,
    minHeight: 50,
  },
  wrapTop: { borderTopWidth: 0, borderBottomWidth: 1, borderBottomColor: theme.border },
  placeholder: {
    backgroundColor: '#f3f4f6',
    borderTopWidth: 1, borderTopColor: theme.border,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, minHeight: 56,
  },
  placeholderTop: { borderTopWidth: 0, borderBottomWidth: 1, borderBottomColor: theme.border },
  placeholderTitle: { fontSize: 11, fontWeight: '700', color: theme.textSub },
  placeholderSub: { fontSize: 10, color: theme.textMuted, marginTop: 2 },
});
