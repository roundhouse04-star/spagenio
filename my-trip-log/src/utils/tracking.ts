/**
 * App Tracking Transparency (iOS 14.5+)
 *
 * 본 앱은 광고/추적을 사용하지 않지만, App Store 정책상
 * 추적 동의 다이얼로그를 표시할 수 있도록 인프라만 갖춰둔다.
 * 현재는 호출하지 않음 (실제 추적이 없으므로 다이얼로그 불필요).
 *
 * 향후 광고/Analytics 추가 시 앱 시작 시점에 requestTrackingPermission() 호출.
 */
import { Platform } from 'react-native';

export type TrackingStatus = 'authorized' | 'denied' | 'restricted' | 'not-determined' | 'unavailable';

/**
 * 현재 추적 권한 상태 조회.
 * 광고·Analytics 추가 시 사용.
 */
export async function getTrackingStatus(): Promise<TrackingStatus> {
  if (Platform.OS !== 'ios') return 'unavailable';
  try {
    const mod = await import('expo-tracking-transparency');
    const { status } = await mod.getTrackingPermissionsAsync();
    return status as TrackingStatus;
  } catch {
    return 'unavailable';
  }
}

/**
 * 추적 권한 요청 다이얼로그 표시.
 * 광고/Analytics 도입 시 한 번 호출.
 */
export async function requestTrackingPermission(): Promise<TrackingStatus> {
  if (Platform.OS !== 'ios') return 'unavailable';
  try {
    const mod = await import('expo-tracking-transparency');
    const { status } = await mod.requestTrackingPermissionsAsync();
    return status as TrackingStatus;
  } catch (err) {
    console.warn('[tracking] permission request failed:', err);
    return 'unavailable';
  }
}
