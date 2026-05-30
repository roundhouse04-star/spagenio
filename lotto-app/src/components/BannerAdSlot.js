// AdMob Banner — Expo Go에선 native module이 없으므로 placeholder 표시
// 실기기 dev build / production에서만 실제 광고 노출
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';
import { theme } from '../lib/theme';
import { ADS_LIVE, AD_UNIT_IDS } from '../config/ads';

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
// ADS_LIVE=true (release 프로필) 에서만 실광고 ID 사용.
// 그 외 모든 빌드(production·TestFlight 포함)는 Google 데모(test) ID.
// → 본인/테스터가 클릭해도 무효 트래픽으로 안 잡힘 (AdMob 정지 방지)
const TEST_BANNER = AdsModule?.TestIds?.BANNER;

const PROD_BANNER_ID = Platform.select({
  ios: AD_UNIT_IDS.bannerIOS,
  android: AD_UNIT_IDS.bannerAndroid,
});

const BANNER_UNIT_ID = ADS_LIVE ? PROD_BANNER_ID : TEST_BANNER;

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
