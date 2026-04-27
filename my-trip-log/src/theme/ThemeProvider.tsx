/**
 * Spagenio - ThemeProvider (Step 2 안전판)
 *
 * 🛡️ 안전 설계:
 *   - SecureStore 로딩 중에도 LightColors로 즉시 children 렌더 (null 반환 X)
 *   - SecureStore 결과가 오면 setMode로 업데이트 → Context 값 갱신
 *   - 어제처럼 스플래시 멈춤 발생 안 함
 *
 * 사용법:
 *   const { colors, isDark, mode, setMode } = useTheme();
 *   const styles = useMemo(() => createStyles(colors), [colors]);
 *
 * ⚠️ 주의: Step 2에서는 인프라만 깐다. 각 화면은 아직 Colors (전역 Proxy) 사용.
 *         Step 3, 4에서 점진적으로 useTheme 마이그레이션.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { setGlobalThemeMode, ColorsLight, ColorsDark } from './theme';

// ============ TYPES ============
export type ThemeMode = 'system' | 'light' | 'dark';

export type ColorPalette = typeof ColorsLight;

// ============ CONTEXT ============
interface ThemeContextValue {
  colors: ColorPalette;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: ColorsLight,
  isDark: false,
  mode: 'system',
  setMode: async () => {},
});

const STORAGE_KEY = 'theme_mode';

// ============ PROVIDER ============
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // useColorScheme은 시스템 테마 변경 시 자동 리렌더 트리거
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // 저장된 모드 불러오기 - 비동기지만 children 렌더는 막지 않음
  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setModeState(saved);
          setGlobalThemeMode(saved); // theme.ts의 Colors Proxy 동기화
        }
      } catch {
        // 무시 - 기본값 system 유지
      }
    })();
  }, []);

  // mode 또는 systemScheme 변경 시 전역 Colors 동기화
  useEffect(() => {
    setGlobalThemeMode(mode);
  }, [mode, systemScheme]);

  const setMode = useCallback(async (newMode: ThemeMode) => {
    setModeState(newMode);
    setGlobalThemeMode(newMode);
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, newMode);
    } catch {
      // 무시
    }
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const colors = isDark ? ColorsDark : ColorsLight;

  const value = useMemo<ThemeContextValue>(() => ({
    colors, isDark, mode, setMode,
  }), [colors, isDark, mode, setMode]);

  // 🛡️ 절대 null 반환하지 않음 - children 즉시 렌더
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * 현재 테마를 반환하는 훅.
 *
 * @example
 * const { colors, isDark } = useTheme();
 * const styles = useMemo(() => createStyles(colors), [colors]);
 */
export function useTheme() {
  return useContext(ThemeContext);
}

// 레거시 호환 export
export { ColorsLight, ColorsDark };
