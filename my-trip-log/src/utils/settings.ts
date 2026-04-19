/**
 * 로컬 알림 설정
 *
 * SecureStore에 on/off 저장
 * 나중에 expo-notifications로 실제 알림 보낼 때 사용
 */
import * as SecureStore from 'expo-secure-store';

const KEY = 'notifications_enabled';

export async function getNotificationEnabled(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(KEY);
    return v === 'true';
  } catch {
    return false;
  }
}

export async function setNotificationEnabled(enabled: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, enabled ? 'true' : 'false');
  } catch {
    // 무시
  }
}

// 테마 모드 (system/light/dark)
const THEME_KEY = 'theme_mode';

export type ThemeMode = 'system' | 'light' | 'dark';

export async function getThemeMode(): Promise<ThemeMode> {
  try {
    const v = await SecureStore.getItemAsync(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
    return 'system';
  } catch {
    return 'system';
  }
}

export async function setThemeMode(mode: ThemeMode): Promise<void> {
  try {
    await SecureStore.setItemAsync(THEME_KEY, mode);
  } catch {
    // 무시
  }
}
