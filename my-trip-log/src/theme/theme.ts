/**
 * My Trip Log - Design System
 * Ink Navy + Warm Gold + Cream
 */

// ============ COLORS ============
export const Colors = {
  // Primary palette
  primary: '#1E2A3A',         // Ink Navy
  primaryLight: '#2D3E54',
  primaryDark: '#141E2B',

  // Accent
  accent: '#C9A96A',          // Warm Gold
  accentLight: '#D9BD85',
  accentDark: '#A88B4F',

  // Background
  background: '#FAF8F3',      // Cream
  surface: '#FFFFFF',
  surfaceAlt: '#F5F2EA',

  // Text
  textPrimary: '#1E2A3A',
  textSecondary: '#5A6478',
  textTertiary: '#8E96A6',
  textOnPrimary: '#FAF8F3',
  textOnAccent: '#1E2A3A',

  // Status
  success: '#5B8266',
  warning: '#C9A96A',
  error: '#B5564B',
  info: '#5C7A8E',

  // Trip status
  tripPlanning: '#7B8FAA',
  tripOngoing: '#C9A96A',
  tripCompleted: '#5B8266',

  // Borders
  border: '#E8E2D4',
  borderLight: '#F0EBE0',
  divider: '#EFEAE0',

  // Overlay
  overlay: 'rgba(30, 42, 58, 0.6)',
  overlayLight: 'rgba(30, 42, 58, 0.3)',
};

// ============ FONTS ============
export const Fonts = {
  // 영문/숫자 디스플레이 (제목, 헤드라인)
  display: 'PlayfairDisplay_700Bold',
  displayMedium: 'PlayfairDisplay_500Medium',
  displayRegular: 'PlayfairDisplay_400Regular',

  // 영문 본문 / UI
  bodyEn: 'Inter_400Regular',
  bodyEnMedium: 'Inter_500Medium',
  bodyEnSemiBold: 'Inter_600SemiBold',
  bodyEnBold: 'Inter_700Bold',

  // 한글 본문
  bodyKr: 'NotoSansKR_400Regular',
  bodyKrMedium: 'NotoSansKR_500Medium',
  bodyKrBold: 'NotoSansKR_700Bold',
};

// ============ TYPOGRAPHY ============
// fontSize는 숫자만 그대로 유지 (StyleSheet에서 fontFamily 같이 쓸 수 있게)
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

// ============ TEXT STYLES (편의용 헬퍼) ============
// 사용: <Text style={[TextStyles.displayMedium, { color: Colors.primary }]}>...</Text>
export const TextStyles = {
  // 디스플레이 (영문 제목용 - 잡지 스타일)
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

  // 한글 제목
  titleKr: {
    fontFamily: Fonts.bodyKrBold,
    fontSize: Typography.titleMedium,
  },

  // 본문
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

  // 라벨 (영문 작은 글자)
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

// ============ SPACING ============
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

// ============ RADII ============
export const Radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
};

// ============ SHADOWS ============
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
