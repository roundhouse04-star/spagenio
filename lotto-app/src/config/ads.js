/**
 * AdMob 광고 설정 (로또부스터)
 *
 * my-trip-log / mygong-app 과 동일한 방식.
 *
 * ┌─ 안전 장치 ───────────────────────────────────────────
 * │ 본인/테스터가 실광고를 클릭하면 무효 트래픽으로 잡혀
 * │ AdMob 계정 정지 위험. 그래서 빌드 프로필로 분리:
 * │
 * │   1. Expo Go / dev (__DEV__)   → 광고 미노출 (placeholder)
 * │   2. production 빌드            → Google 데모(test) 광고
 * │      (TestFlight / internal 모두 여기 해당)
 * │   3. release 빌드              → 실광고
 * │      (App Store 출시 전용 — 명시적으로 따로 빌드)
 * └────────────────────────────────────────────────────────
 *
 * ## 빌드 명령
 *   # TestFlight 용 — 테스트 광고만 (안전)
 *   eas build --platform ios --profile production
 *
 *   # App Store 출시 전용 — 실광고 활성화
 *   eas build --platform ios --profile release
 *
 * ## EXPO_PUBLIC_ADS_LIVE
 * - eas.json 의 release 프로필에서만 "true".
 * - 그 외 모든 빌드는 "false"/미설정 → 자동으로 테스트 광고.
 * - Expo 가 빌드 시 EXPO_PUBLIC_* 환경변수를 JS 번들에 inline.
 */

// 1) 광고 모듈 로드 가능 여부 (Expo Go / 로컬 dev 에선 native module 없음)
export const ADS_ENABLED = !__DEV__;

// 2) 실광고 vs 테스트 광고 — release 프로필에서만 실광고
//    → production(TestFlight 포함) 에선 절대 실광고 안 나옴
export const ADS_LIVE = process.env.EXPO_PUBLIC_ADS_LIVE === 'true';

// 실광고 단위 ID — App Store(release) 빌드에만 사용
export const AD_UNIT_IDS = {
  bannerIOS: 'ca-app-pub-2473584153798184/6094406727',
  bannerAndroid: 'ca-app-pub-2473584153798184/7215916703',
};
