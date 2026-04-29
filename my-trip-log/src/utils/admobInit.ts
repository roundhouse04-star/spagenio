/**
 * AdMob 초기화 + ATT 권한 요청
 *
 * 호출 시점: 앱 시작 직후 (_layout.tsx)
 * - iOS 14.5+: ATT 다이얼로그 표시 → 사용자 동의 시 개인화 광고
 * - SDK 초기화로 첫 광고 로딩 시간 단축
 *
 * 사용자 거부해도 앱 정상 동작 (비개인화 광고로 자동 전환).
 */
import { Platform } from 'react-native';
import { ADS_ENABLED } from '@/config/ads';

let initialized = false;

export async function initializeAdMob(): Promise<void> {
  if (!ADS_ENABLED || initialized) return;
  initialized = true;

  try {
    // iOS: ATT 권한 요청 → AdMob SDK 초기화 순서
    if (Platform.OS === 'ios') {
      try {
        const att = await import('expo-tracking-transparency');
        const { status } = await att.getTrackingPermissionsAsync();
        if (status === 'undetermined') {
          await att.requestTrackingPermissionsAsync();
        }
      } catch (err) {
        console.warn('[ads] ATT request failed (non-fatal):', err);
      }
    }

    // AdMob SDK 초기화
    const mod = await import('react-native-google-mobile-ads');
    if (mod.default) {
      await mod.default().initialize();
    }
  } catch (err) {
    // SDK 미포함 환경 (Expo Go 등) — silent fail
    console.warn('[ads] AdMob init failed (Expo Go에선 정상):', err);
  }
}
