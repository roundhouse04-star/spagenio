// AdMob Banner — Expo Go에선 native module이 없으므로 placeholder 표시
// 실기기 dev build / production에서만 실제 광고 노출
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';
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
// 개발/Expo Go: Google 공식 테스트 ID (항상 테스트 광고 노출)
// 프로덕션: AdMob 콘솔에서 발급받은 실제 단위 ID로 교체 (.env 또는 EAS Secret 권장)
const TEST_BANNER = AdsModule?.TestIds?.BANNER;

const PROD_BANNER_ID = Platform.select({
  ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY',     // TODO: 실제 iOS 배너 단위 ID
  android: 'ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ', // TODO: 실제 Android 배너 단위 ID
});

const BANNER_UNIT_ID = __DEV__ || !PROD_BANNER_ID || PROD_BANNER_ID.includes('XXXXX')
  ? TEST_BANNER
  : PROD_BANNER_ID;

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
