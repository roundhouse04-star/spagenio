/**
 * AdMob 광고 설정 (Triplive)
 *
 * ## 출시 단계 — ✅ 실제 ID 적용 완료 (2026-05)
 *
 * AdMob 콘솔 (https://admob.google.com) Publisher ID:
 *   pub-2473584153798184
 *
 * ### __DEV__ 자동 처리
 * - 개발 빌드(__DEV__=true) 에서는 AdBanner 가 자동으로 TestIds 사용
 * - EAS production 빌드에서만 실광고 노출 (코드에 이미 처리됨)
 *
 * ### 출시 후 체크
 * - [ ] App Store / Play Store 실 출시 후 AdMob 콘솔에서 "스토어 추가" 클릭
 *       → "광고 게재가 제한됨" 상태 해제
 * - [ ] 첫 광고 노출까지 1~24시간 소요 (정상)
 */

// __DEV__=true (Expo Go 또는 dev 빌드)에서는 강제로 false:
//   - Expo Go 는 네이티브 모듈 미포함 → require 시 RNGoogleMobileAdsModule not found 크래시
//   - 개발 중엔 광고가 필요 없으니 자동으로 플레이스홀더만 표시
// production 빌드 (eas build --profile production) 에서만 실광고 노출
export const ADS_ENABLED = !__DEV__;

// 실광고 단위 ID — AdMob 콘솔에서 발급받은 값
export const AD_UNIT_IDS = {
  bannerIOS: 'ca-app-pub-2473584153798184/5107892024',
  bannerAndroid: 'ca-app-pub-2473584153798184/3804373045',
};

// AdMob 앱 ID (app.json 의 plugin 설정과 동일한 값)
export const ADMOB_APP_IDS = {
  ios: 'ca-app-pub-2473584153798184~4114374557',
  android: 'ca-app-pub-2473584153798184~7284453056',
};
