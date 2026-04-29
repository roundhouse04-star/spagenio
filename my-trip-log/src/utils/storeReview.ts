/**
 * 앱 별점 요청 — expo-store-review
 *
 * 정책:
 * - 5번 이상 앱 진입 후 한 번만 표시 (사용자 피로도 방지)
 * - 표시 후 1년 내 재표시 안 함 (Apple 가이드 준수)
 * - 사용자가 거부해도 앱 정상 동작
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_LAUNCH_COUNT = 'app_launch_count_v1';
const KEY_LAST_PROMPT_AT = 'review_prompted_at_v1';
const MIN_LAUNCHES_BEFORE_PROMPT = 5;
const REPROMPT_INTERVAL_MS = 1000 * 60 * 60 * 24 * 365; // 1년

export async function incrementLaunchCount(): Promise<number> {
  try {
    const cur = parseInt((await AsyncStorage.getItem(KEY_LAUNCH_COUNT)) ?? '0', 10);
    const next = cur + 1;
    await AsyncStorage.setItem(KEY_LAUNCH_COUNT, String(next));
    return next;
  } catch {
    return 0;
  }
}

export async function maybePromptReview(): Promise<boolean> {
  try {
    const launches = parseInt((await AsyncStorage.getItem(KEY_LAUNCH_COUNT)) ?? '0', 10);
    if (launches < MIN_LAUNCHES_BEFORE_PROMPT) return false;

    const lastAt = parseInt((await AsyncStorage.getItem(KEY_LAST_PROMPT_AT)) ?? '0', 10);
    if (lastAt && Date.now() - lastAt < REPROMPT_INTERVAL_MS) return false;

    const mod = await import('expo-store-review');
    const isAvail = await mod.isAvailableAsync();
    if (!isAvail) return false;
    await mod.requestReview();
    await AsyncStorage.setItem(KEY_LAST_PROMPT_AT, String(Date.now()));
    return true;
  } catch (err) {
    console.warn('[review] prompt failed:', err);
    return false;
  }
}
