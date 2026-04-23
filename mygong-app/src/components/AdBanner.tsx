/**
 * 광고 배너 컴포넌트.
 *
 * 현재(v1.0): 그라데이션 placeholder + PRO 홍보 텍스트
 * 추후(v1.1): AdMob 실광고로 교체 (이 파일만 수정)
 *
 * 위치: 탭바 바로 위 (모든 탭 화면에서 동일)
 * 높이: 60pt (AdMob ANCHORED_ADAPTIVE_BANNER 와 비슷한 사이즈)
 *
 * AdMob 교체 가이드 (v1.1 출시 시):
 *   1. npm install react-native-google-mobile-ads
 *   2. 아래 'AdMob 모드' 섹션 주석 해제
 *   3. 'Placeholder 모드' 섹션 주석 처리
 *   4. unitId를 AdMob 콘솔에서 받은 ID로 교체
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Image, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, FontSizes } from '@/theme/theme';

// ─── AdMob 모드 (v1.1) ──────────────────────────────────────
// import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
//
// const AD_UNIT_ID = __DEV__
//   ? TestIds.BANNER
//   : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX'; // ← AdMob 광고 단위 ID

type Props = {
  /** placeholder 위에 띄울 이미지 (선택). 없으면 그라데이션 + 텍스트만. */
  image?: ImageSourcePropType;
  /** 탭 시 동작 (선택). 예: PRO 안내 화면으로 이동. */
  onPress?: () => void;
};

export function AdBanner({ image, onPress }: Props) {
  // ─── AdMob 모드 (주석 해제 시 실광고) ──────────────────────
  // return (
  //   <View style={styles.container}>
  //     <BannerAd
  //       unitId={AD_UNIT_ID}
  //       size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
  //       requestOptions={{ requestNonPersonalizedAdsOnly: true }}
  //     />
  //   </View>
  // );

  // ─── Placeholder 모드 (현재 v1.0) ──────────────────────────
  const Inner = (
    <View style={styles.container}>
      {image ? (
        <Image source={image} style={styles.bgImage} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={['#fff5d6', '#ffe8b3', '#ffd98a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
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
    backgroundColor: '#fff5d6', // 그라데이션 로딩 전 fallback
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
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
