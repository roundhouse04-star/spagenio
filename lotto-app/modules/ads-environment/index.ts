import { requireOptionalNativeModule } from 'expo';

// Expo Go / web 등 네이티브 모듈이 없는 환경에서는 null → 안전하게 false 폴백.
const AdsEnvironment = requireOptionalNativeModule<{ isTestFlight: boolean }>('AdsEnvironment');

// iOS: TestFlight(샌드박스 영수증) 설치본이면 true. App Store 정식 설치본은 false.
// Android: 항상 false (런타임 트랙 판별 불가).
export const isTestFlight: boolean = AdsEnvironment?.isTestFlight ?? false;
