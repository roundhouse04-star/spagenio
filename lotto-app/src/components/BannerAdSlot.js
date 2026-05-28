// AdMob Banner — Expo Go에선 native module이 없으므로 placeholder 표시
// 실기기 dev build / production에서만 실제 광고 노출
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import { theme } from '../lib/theme';

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
// 환경별 분기 (EAS 빌드 프로필의 EXPO_PUBLIC_ADS_MODE 환경변수로 결정):
//   __DEV__ (Expo Go / 로컬 개발)         → 테스트 광고
//   development / preview / testflight    → 테스트 광고
//   production 프로필 + iOS TestFlight    → 테스트 광고 (런타임 감지)
//   production 프로필 + iOS App Store     → 실제 광고
//   production 프로필 + Android           → 실제 광고
const TEST_BANNER = AdsModule?.TestIds?.BANNER;

const PROD_BANNER_ID = Platform.select({
  ios: 'ca-app-pub-2473584153798184/6094406727',     // iOS Banner
  android: 'ca-app-pub-2473584153798184/7215916703', // Android Banner
});

const wantsProductionAds = !__DEV__ && process.env.EXPO_PUBLIC_ADS_MODE === 'production';

// iOS는 production 프로필이라도 TestFlight일 수 있으므로 receipt 파일로 환경 판별:
//   <bundle>/StoreKit/sandboxReceipt → TestFlight (또는 Sandbox)
//   <bundle>/StoreKit/receipt        → App Store
async function detectIosEnvironment() {
  try {
    const bundle = FileSystem.bundleDirectory;
    if (!bundle) return 'unknown';
    const sandbox = await FileSystem.getInfoAsync(bundle + 'StoreKit/sandboxReceipt');
    if (sandbox.exists) return 'testflight';
    const prod = await FileSystem.getInfoAsync(bundle + 'StoreKit/receipt');
    if (prod.exists) return 'appstore';
    return 'unknown';
  } catch (e) {
    return 'error';
  }
}

// Android: production 환경변수면 바로 실제 광고
// iOS: App Store 확정될 때까지 안전하게 테스트 광고로 시작
function initialBannerUnitId() {
  if (!wantsProductionAds) return TEST_BANNER;
  if (Platform.OS === 'android') return PROD_BANNER_ID;
  return TEST_BANNER;
}

export default function BannerAdSlot({ position = 'bottom' }) {
  const [unitId, setUnitId] = useState(initialBannerUnitId);

  useEffect(() => {
    if (!wantsProductionAds) return;
    if (Platform.OS !== 'ios') return;
    let cancelled = false;
    detectIosEnvironment().then((env) => {
      if (cancelled) return;
      console.log('[Banner] iOS env:', env);
      if (env === 'appstore') setUnitId(PROD_BANNER_ID);
    });
    return () => { cancelled = true; };
  }, []);

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
        unitId={unitId}
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
