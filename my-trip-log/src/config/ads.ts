/**
 * AdMob 광고 설정 (Triplive)
 *
 * ┌─ 안전 장치 ───────────────────────────────────────────
 * │ 본인이 실수로 실광고를 클릭하면 무효 트래픽으로 잡혀서
 * │ AdMob 계정 정지 위험이 있음. 그래서 3단계로 분리:
 * │
 * │   1. Expo Go / dev 빌드      → 광고 자체 미노출 (placeholder)
 * │   2. EAS production 빌드      → Google 데모(test) 광고
 * │      (TestFlight, internal 빌드 모두 여기에 해당)
 * │   3. EAS release 빌드         → 실광고
 * │      (App Store 출시 전용 — 매뉴얼하게 명시적으로 선택)
 * │
 * │ 즉 평소 빌드(production)는 안전하게 테스트 광고만 나오고,
 * │ "App Store 에 보낼 빌드" 만 release profile 로 따로 굽는다.
 * └────────────────────────────────────────────────────────
 *
 * ## 빌드 명령
 *
 *   # TestFlight 용 — 테스트 광고만 표시 (안전)
 *   EAS_NO_VCS=1 eas build --platform ios --profile production \
 *     --auto-submit --non-interactive --no-wait
 *
 *   # App Store 출시 전용 — 실광고 활성화
 *   EAS_NO_VCS=1 eas build --platform ios --profile release \
 *     --auto-submit --non-interactive --no-wait
 *
 * ## EXPO_PUBLIC_ADS_LIVE 환경 변수
 * - eas.json 의 release profile 에서만 "true" 로 설정됨.
 * - 그 외 모든 빌드는 환경변수 없음 → 자동으로 테스트 광고.
 * - Expo 가 빌드 시 EXPO_PUBLIC_* prefix 환경 변수를 JS bundle 에 inline.
 *
 * AdMob 콘솔 (https://admob.google.com) Publisher ID: pub-2473584153798184
 */

// 1) 광고 모듈 로드 가능 여부 (Expo Go 에선 native module 없음)
//    __DEV__=true 면 native module 미포함 → require 자체를 차단
export const ADS_ENABLED = !__DEV__;

// 2) 실광고 vs 테스트 광고 선택
//    EXPO_PUBLIC_ADS_LIVE="true" 일 때만 실 ID 사용
//    이 값은 eas.json 의 "release" profile 에서만 set 됨
//    → TestFlight (production profile) 에선 절대 실광고 안 나옴
export const ADS_LIVE = process.env.EXPO_PUBLIC_ADS_LIVE === 'true';

// 실광고 단위 ID — App Store 출시 빌드에만 사용됨
export const AD_UNIT_IDS = {
  bannerIOS: 'ca-app-pub-2473584153798184/5107892024',
  bannerAndroid: 'ca-app-pub-2473584153798184/3804373045',
};

// AdMob 앱 ID (app.json 의 plugin 설정과 동일한 값)
export const ADMOB_APP_IDS = {
  ios: 'ca-app-pub-2473584153798184~4114374557',
  android: 'ca-app-pub-2473584153798184~7284453056',
};
