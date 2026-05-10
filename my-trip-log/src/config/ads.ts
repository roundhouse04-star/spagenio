/**
 * AdMob 광고 설정 (Triplive)
 *
 * ## 출시 단계 — 현재 ⚠️ 테스트 ID 사용 중
 *
 * 실제 출시 전에 아래 4가지 ID를 AdMob 콘솔(https://admob.google.com)에서
 * 받은 실제 값으로 교체하세요.
 *
 * ### 출시 체크리스트
 *
 * - [ ] AdMob 가입 및 결제 정보 입력
 * - [ ] 앱 등록 (iOS / Android 따로) → AdMob App ID 발급
 * - [ ] 광고 단위 생성 (배너 타입) → Ad Unit ID 발급
 * - [ ] 아래 ADMOB_APP_IDS / AD_UNIT_IDS 실제 값 교체
 * - [ ] app.json 의 androidAppId / iosAppId 도 실제 값 교체
 * - [ ] 약관·개인정보처리방침 갱신 안내 (이미 광고 표시 명시됨)
 * - [ ] App Store Connect / Play Console 의 Privacy/Data Safety 폼 광고 추적 활성
 *
 * ### __DEV__ 자동 처리
 * - 개발 빌드(__DEV__=true) 에서는 AdBanner 가 자동으로 TestIds 사용
 * - EAS production 빌드에서만 실광고 노출 (코드에 이미 처리됨)
 */

// ⚠️ 출시 전 false → true 였음. 광고 활성화됨.
//
// __DEV__=true (Expo Go 또는 dev 빌드)에서는 강제로 false:
//   - Expo Go 는 네이티브 모듈 미포함 → require 시 RNGoogleMobileAdsModule not found 크래시
//   - 개발 중엔 광고가 필요 없으니 자동으로 플레이스홀더만 표시
// production 빌드 (eas build --profile production) 에서만 실광고 노출
export const ADS_ENABLED = !__DEV__;

// 실광고 단위 ID — AdMob 콘솔에서 발급받은 값으로 교체
// 현재 값은 Google 공식 테스트 ID (실광고 미노출)
export const AD_UNIT_IDS = {
  bannerIOS: 'ca-app-pub-3940256099942544/2934735716',     // ⚠️ 테스트 ID — 실 ID로 교체
  bannerAndroid: 'ca-app-pub-3940256099942544/6300978111', // ⚠️ 테스트 ID — 실 ID로 교체
};

// AdMob 앱 ID (app.json 의 plugin 설정과 같은 값을 유지)
export const ADMOB_APP_IDS = {
  ios: 'ca-app-pub-3940256099942544~1458002511',           // ⚠️ 테스트 ID
  android: 'ca-app-pub-3940256099942544~3347511713',       // ⚠️ 테스트 ID
};
