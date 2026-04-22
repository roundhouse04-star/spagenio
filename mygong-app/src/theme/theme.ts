/**
 * 내공연관리 — 모노크롬 와이어프레임 테마.
 * minimal.css 의 디자인 토큰을 React Native 에 맞게 이식.
 */
import { Platform } from 'react-native';

// 시스템 기본 monospace — iOS 는 Menlo, Android 는 monospace
const SYSTEM_MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'Menlo',
}) as string;

export const Colors = {
  // Inks (본문·헤드)
  ink:      '#111',
  ink2:     '#333',
  ink3:     '#666',
  ink4:     '#999',

  // Lines
  line:     '#111',    // 주요 테두리
  lineSoft: '#ddd',    // 보조 divider

  // Fills
  paper:    '#ffffff', // 기본 배경 (폰 화면)
  fill:     '#f2f2f2', // 강조 박스 배경
  fill2:    '#e8e8e8',
  fill3:    '#fafafa',
  bgMuted:  '#f6f6f6', // 앱 외곽 배경

  // 텍스트 표시용 (호환)
  text:     '#111',
  textSub:  '#666',
  textFaint:'#999',
  bg:       '#ffffff',
  border:   '#111',
  divider:  '#ddd',

  // 액센트 유지 (하트·검증 등 최소한만)
  heart:    '#111',    // 모노크롬이라 강조색도 ink
  primary:  '#111',
  verified: '#111',

  // 카테고리 (와이어프레임에선 fill 톤만 씀)
  catConcert: '#f2f2f2',
  catMusical: '#f2f2f2',
  catPlay:    '#f2f2f2',
  catSports:  '#f2f2f2',
  catFestival:'#f2f2f2',
  catExhibit: '#f2f2f2',
} as const;

export const Fonts = {
  regular:  'Inter_400Regular',
  medium:   'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold:     'Inter_700Bold',

  // 숫자·라벨·코드용 — 시스템 모노스페이스 (외부 패키지 불필요)
  mono:         SYSTEM_MONO,
  monoMedium:   SYSTEM_MONO,

  // 한국어 fallback
  ko:         'NotoSansKR_400Regular',
  koMedium:   'NotoSansKR_500Medium',
  koSemibold: 'NotoSansKR_700Bold',
} as const;

export const FontSizes = {
  micro:   9,    // mono 라벨캡
  tiny:    10,
  caption: 11,
  body:    13,   // 본문 기본
  subhead: 14,
  title:   16,
  h2:      20,
  h1:      24,
  hero:    28,
} as const;

export const Spacing = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
} as const;

export const Radius = {
  none: 0,      // 기본 — 직각
  sm:   4,
  md:   8,
  lg:   12,
  pill: 999,
} as const;

export const BorderWidth = {
  hair: 0.5,
  thin: 1,      // 기본
  bold: 2,      // 강조
} as const;

/** 카테고리별 배경색 — 모노크롬에선 전부 fill */
export function chipBg(_category?: string): string {
  return Colors.fill;
}
