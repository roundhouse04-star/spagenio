/**
 * Triplive - Design System (with auto Dark Mode)
 *
 * iOS/Android 시스템 다크모드 설정에 따라 자동으로 색상 전환
 * import 하는 쪽 코드 변경 불필요 - Colors 그대로 사용
 */
import { Appearance } from 'react-native';

// ============ FONTS ============
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

// ============ LIGHT PALETTE ============
const LightColors = {
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
// 사용자 지정: 카드/테이블 배경 #1A1F2B (Deep Navy)
const DarkColors = {
  primary: '#E8E2D4',
  primaryLight: '#FAF8F3',
  primaryDark: '#C9A96A',

  accent: '#C9A96A',
  accentLight: '#D9BD85',
  accentDark: '#A88B4F',

  background: '#0F131B',      // 가장 짙은 베이스
  surface: '#1A1F2B',         // ← 사용자 지정 Deep Navy (카드/테이블)
  surfaceAlt: '#242A38',      // 강조 변형

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

  border: '#3A4355',
  borderLight: '#2D3544',
  divider: '#2D3544',

  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.4)',
};

// ============ GLOBAL MODE STATE ============
// ThemeProvider가 이 변수를 업데이트합니다.
// system | light | dark
type ThemeMode = 'system' | 'light' | 'dark';
let _userMode: ThemeMode = 'system';

/**
 * ThemeProvider가 mode 변경 시 호출.
 * Colors Proxy가 이 값을 참조하여 동적으로 색상을 결정합니다.
 */
export function setGlobalThemeMode(mode: ThemeMode): void {
  _userMode = mode;
}

export function getGlobalThemeMode(): ThemeMode {
  return _userMode;
}

// ============ COLORS - dynamic getter ============
// import { Colors } 하면 사용자 모드 + 시스템 모드에 따라 자동 반환
function getColors() {
  if (_userMode === 'dark') return DarkColors;
  if (_userMode === 'light') return LightColors;
  // system
  const scheme = Appearance.getColorScheme();
  return scheme === 'dark' ? DarkColors : LightColors;
}

// Proxy로 동적 색상 (모든 접근 시마다 시스템 체크)
export const Colors = new Proxy({} as typeof LightColors, {
  get(_, key: string) {
    const colors = getColors();
    return colors[key as keyof typeof LightColors];
  },
});

// 명시적으로 사용 시
export const ColorsLight = LightColors;
export const ColorsDark = DarkColors;

// ============ TYPOGRAPHY ============
export const Typography = {
  displayLarge: 36,
  displayMedium: 30,
  displaySmall: 26,
  // headline은 title과 display 사이 - 카드 타이틀, 섹션 헤더 등에 사용
  headlineLarge: 28,
  headlineMedium: 24,
  headlineSmall: 20,
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

export const TextStyles = {
  displayLarge: {
    fontFamily: Fonts.display,
    fontSize: Typography.displayLarge,
    letterSpacing: Typography.letterSpacingTight,
  },
  displayMedium: {
    fontFamily: Fonts.display,
    fontSize: Typography.displayMedium,
    letterSpacing: Typography.letterSpacingTight,
  },
  displaySmall: {
    fontFamily: Fonts.displayMedium,
    fontSize: Typography.displaySmall,
  },
  titleKr: {
    fontFamily: Fonts.bodyKrBold,
    fontSize: Typography.titleMedium,
  },
  bodyDefault: {
    fontFamily: Fonts.bodyKr,
    fontSize: Typography.bodyMedium,
  },
  bodyMedium: {
    fontFamily: Fonts.bodyKrMedium,
    fontSize: Typography.bodyMedium,
  },
  bodyBold: {
    fontFamily: Fonts.bodyKrBold,
    fontSize: Typography.bodyMedium,
  },
  labelEyebrow: {
    fontFamily: Fonts.bodyEnSemiBold,
    fontSize: Typography.labelSmall,
    letterSpacing: Typography.letterSpacingExtraWide,
  },
  labelButton: {
    fontFamily: Fonts.bodyEnBold,
    fontSize: Typography.bodyLarge,
    letterSpacing: Typography.letterSpacingWide,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  giant: 64,
};

export const Radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
};

// ============ SHADOWS ============
// sm/md/lg = 숫자 기반 (원래 이름)
// soft/medium/strong = 의미 기반 (alias - 기존 코드 호환)
const _shadowSm = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.04,
  shadowRadius: 2,
  elevation: 1,
};

const _shadowMd = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 6,
  elevation: 3,
};

const _shadowLg = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 12,
  elevation: 6,
};

// soft는 sm과 md 중간 정도의 부드러운 그림자 (카드용)
const _shadowSoft = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 4,
  elevation: 2,
};

export const Shadows = {
  sm: _shadowSm,
  md: _shadowMd,
  lg: _shadowLg,
  // 의미 기반 alias
  soft: _shadowSoft,
  medium: _shadowMd,
  strong: _shadowLg,
};
