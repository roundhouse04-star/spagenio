/**
 * My Trip Log - 디자인 시스템
 *
 * Ink Navy 테마 베이스:
 * - 차분한 감성 (짙은 네이비 + 크림 + 포인트 골드)
 * - 여행의 낭만과 정돈된 기록을 표현
 */

export const Colors = {
  // Primary - Ink Navy
  primary: '#1E2A3A',
  primaryLight: '#2C3E50',
  primaryDark: '#14202E',

  // Accent - Warm Gold (여행의 따뜻함)
  accent: '#C9A96A',
  accentLight: '#E0C38A',
  accentDark: '#A88848',

  // Semantic
  success: '#5B8C5A',
  warning: '#D4A04A',
  error: '#C25B5B',
  info: '#6B8CA8',

  // Neutrals (Light Mode)
  background: '#FAF8F3',      // 크림색 배경
  surface: '#FFFFFF',
  surfaceAlt: '#F2EFE8',
  border: '#E5E0D5',

  // Text
  textPrimary: '#1E2A3A',
  textSecondary: '#5A6578',
  textTertiary: '#8B94A3',
  textOnPrimary: '#FAF8F3',
  textOnAccent: '#1E2A3A',

  // Status
  tripPlanning: '#6B8CA8',    // 계획 중 - 푸른빛
  tripOngoing: '#C9A96A',     // 진행 중 - 골드
  tripCompleted: '#5A6578',   // 완료 - 차분한 회색
} as const;

export const Typography = {
  // Font Families
  fontSerif: 'PlayfairDisplay_700Bold',   // 제목용
  fontSans: 'Inter_400Regular',            // 본문
  fontSansMedium: 'Inter_500Medium',
  fontSansBold: 'Inter_700Bold',

  // Sizes
  displayLarge: 40,
  displayMedium: 32,
  displaySmall: 28,

  headlineLarge: 24,
  headlineMedium: 20,
  headlineSmall: 18,

  bodyLarge: 16,
  bodyMedium: 14,
  bodySmall: 12,

  labelLarge: 14,
  labelMedium: 12,
  labelSmall: 11,

  // Line Heights
  lineHeightTight: 1.2,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.75,

  // Letter Spacing
  letterSpacingTight: -0.5,
  letterSpacingNormal: 0,
  letterSpacingWide: 1,
  letterSpacingExtraWide: 2,
} as const;

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,
} as const;

export const Radii = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const Shadows = {
  soft: {
    shadowColor: '#1E2A3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  medium: {
    shadowColor: '#1E2A3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  strong: {
    shadowColor: '#1E2A3A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

// 테마 전체
export const Theme = {
  colors: Colors,
  typography: Typography,
  spacing: Spacing,
  radii: Radii,
  shadows: Shadows,
} as const;

export type ThemeType = typeof Theme;
