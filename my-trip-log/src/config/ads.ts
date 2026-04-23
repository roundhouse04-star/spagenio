/**
 * AdMob 광고 설정 (Spagenio)
 *
 * 실제 출시 전에 아래 AD_UNIT_IDS 를 AdMob 콘솔에서 받은 값으로 교체하세요.
 *
 * ### 설정 방법
 * 1. https://admob.google.com 에서 앱 등록 (Spagenio)
 * 2. 광고 단위 생성 (배너 타입)
 * 3. 받은 광고 단위 ID를 아래에 입력
 * 4. app.json의 plugins 에 react-native-google-mobile-ads 도 등록
 *
 * ### 플레이스홀더 ↔ 실광고 전환
 * `ADS_ENABLED = false` 로 두면 플레이스홀더(PRO 홍보 배너)
 * `ADS_ENABLED = true` 로 바꾸면 실제 AdMob 광고 표시
 *
 * 개발 중에는 false 로 두는 것을 권장 (AdMob 정책 위반 방지)
 * 빌드 시 __DEV__ 에서는 TestIds 가 자동 사용됨
 */

// 광고 표시 여부 (출시 전에 true 로 변경)
export const ADS_ENABLED = false;

// 광고 단위 ID (AdMob 콘솔에서 받은 값으로 교체)
export const AD_UNIT_IDS = {
  bannerIOS: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  bannerAndroid: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
};

// AdMob 앱 ID (app.json 에도 같은 값 입력)
export const ADMOB_APP_IDS = {
  ios: 'ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX',
  android: 'ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX',
};
