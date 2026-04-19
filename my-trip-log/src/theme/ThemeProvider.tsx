/**
 * 실시간 다크모드 지원 ThemeProvider
 *
 * 사용법 (각 화면에서):
 *   import { useTheme } from '@/theme/ThemeProvider';
 *
 *   const { colors, isDark, mode, setMode } = useTheme();
 *   const styles = useMemo(() => createStyles(colors), [colors]);
 *   // 또는
 *   <View style={{ backgroundColor: colors.background }}>
 *
 * 자동 반응:
 *   - 사용자가 앱에서 테마 변경 → 즉시 반영
 *   - 시스템 설정 변경 (iOS 설정 앱) → 즉시 반영
 */
import React, {
  createContext, useContext, useEffect, useState, useMemo,
} from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// ============ LIGHT PALETTE ============
export const LightColors = {
  primary: '#1E2A3A',
  primaryLight: '#2D3E54',
  primaryDark: '#141E2B',

  accent: '#C9A96A',
  accentLight: '#D9BD85',
  accentDark: '#A88B4F',

  background: '#FAF8F3',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F2EA',

  textPrimary: '#1E2A3A',
  textSecondary: '#5A6478',
  textTertiary: '#8E96A6',
  textOnPrimary: '#FAF8F3',
  textOnAccent: '#1E2A3A',

  success: '#5B8266',
  warning: '#C9A96A',
  error: '#B5564B',
  info: '#5C7A8E',

  tripPlanning: '#7B8FAA',
  tripOngoing: '#C9A96A',
  tripCompleted: '#5B8266',

  border: '#E8E2D4',
  borderLight: '#F0EBE0',
  divider: '#EFEAE0',

  overlay: 'rgba(30, 42, 58, 0.6)',
  overlayLight: 'rgba(30, 42, 58, 0.3)',
};

// ============ DARK PALETTE ============
export const DarkColors = {
  primary: '#E8E2D4',
  primaryLight: '#FAF8F3',
  primaryDark: '#C9A96A',

  accent: '#C9A96A',
  accentLight: '#D9BD85',
  accentDark: '#A88B4F',

  background: '#0F1620',
  surface: '#1A2333',
  surfaceAlt: '#243144',

  textPrimary: '#FAF8F3',
  textSecondary: '#B8B5AC',
  textTertiary: '#7A8090',
  textOnPrimary: '#1E2A3A',
  textOnAccent: '#1E2A3A',

  success: '#7BA68B',
  warning: '#D9BD85',
  error: '#D8847A',
  info: '#8FA8BC',

  tripPlanning: '#9DAEC2',
  tripOngoing: '#D9BD85',
  tripCompleted: '#7BA68B',

  border: '#3A4658',
  borderLight: '#2D3E54',
  divider: '#2D3E54',

  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.4)',
};

export type ColorPalette = typeof LightColors;
export type ThemeMode = 'system' | 'light' | 'dark';

// ============ CONTEXT ============
interface ThemeContextValue {
  colors: ColorPalette;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: LightColors,
  isDark: false,
  mode: 'system',
  setMode: async () => {},
});

const STORAGE_KEY = 'theme_mode';

// ============ PROVIDER ============
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // 시스템 변경 시 자동 리렌더
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [loaded, setLoaded] = useState(false);

  // 저장된 모드 불러오기
  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setModeState(saved);
        }
      } catch {
        // 무시
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode); // 즉시 반영
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, newMode);
    } catch {
      // 무시
    }
  };

  // 현재 isDark 계산
  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const colors = isDark ? DarkColors : LightColors;

  const value = useMemo<ThemeContextValue>(() => ({
    colors, isDark, mode, setMode,
  }), [colors, isDark, mode]);

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============ HOOK ============
export function useTheme() {
  return useContext(ThemeContext);
}

// ============ 편의 export ============
// 기존 Colors import 코드와 호환 (주의: 동적이 아님, 다크 전환 시 작동 안함)
// 새 코드에선 useTheme().colors 사용 권장
export const Colors = LightColors;

// ============ Typography / Spacing / Radii / Shadows / Fonts ============
// 다크모드와 무관한 디자인 토큰
export const Fonts = {
  display: 'PlayfairDisplay_700Bold',
  displayMedium: 'PlayfairDisplay_500Medium',
  displayRegular: 'PlayfairDisplay_400Regular',
  bodyEn: 'Inter_400Regular',
  bodyEnMedium: 'Inter_500Medium',
  bodyEnSemiBold: 'Inter_600SemiBold',
  bodyEnBold: 'Inter_700Bold',
  bodyKr: 'NotoSansKR_400Regular',
  bodyKrMedium: 'NotoSansKR_500Medium',
  bodyKrBold: 'NotoSansKR_700Bold',
};

export const Typography = {
  displayLarge: 36,
  displayMedium: 30,
  displaySmall: 26,
  titleLarge: 22,
  titleMedium: 18,
  titleSmall: 16,
  bodyLarge: 16,
  bodyMedium: 14,
  bodySmall: 12,
  labelLarge: 14,
  labelMedium: 12,
  labelSmall: 11,
  letterSpacingTight: -0.5,
  letterSpacingNormal: 0,
  letterSpacingWide: 0.5,
  letterSpacingExtraWide: 1.5,
};

export const Spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20,
  xxl: 24, xxxl: 32, huge: 48, giant: 64,
};

export const Radii = {
  sm: 6, md: 10, lg: 14, xl: 20, pill: 999,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
};
