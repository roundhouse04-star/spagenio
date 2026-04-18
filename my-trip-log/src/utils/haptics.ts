/**
 * Haptic feedback wrapper
 *
 * - 안드로이드/iOS 모두에서 작동 (가능한 디바이스만)
 * - Expo Go에서도 동작
 * - 시뮬레이터/웹에서는 조용히 무시
 *
 * 사용:
 *   import { haptic } from '@/utils/haptics';
 *   haptic.tap();      // 일반 버튼
 *   haptic.select();   // 옵션 선택
 *   haptic.success();  // 저장/등록 성공
 *   haptic.warning();  // 주의
 *   haptic.error();    // 에러
 *   haptic.heavy();    // 중요한 액션 (삭제, 완료 등)
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// 웹에서는 동작 안 함
const isSupported = Platform.OS === 'ios' || Platform.OS === 'android';

function safe(fn: () => Promise<void>) {
  if (!isSupported) return;
  fn().catch(() => {
    // 디바이스가 햅틱을 지원하지 않으면 조용히 무시
  });
}

export const haptic = {
  /** 일반 탭 - 가벼운 피드백 (탭바, 일반 버튼) */
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),

  /** 옵션 선택 - 칩, 토글, 라디오 버튼 */
  select: () => safe(() => Haptics.selectionAsync()),

  /** 중간 강도 - 액션 버튼 */
  medium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),

  /** 강한 피드백 - 중요한 액션 (저장, 완료, 삭제 등) */
  heavy: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),

  /** 성공 알림 - 가입 완료, 저장 성공 */
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),

  /** 경고 알림 - 입력 누락 등 */
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),

  /** 에러 알림 - 저장 실패, 인증 실패 */
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
