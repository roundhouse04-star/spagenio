/**
 * 내공연관리 — Instagram-style clean light theme.
 *
 * 디자인 원칙:
 *  1. 흰 배경 + 넓은 여백, 콘텐츠 우선
 *  2. 시스템 sans-serif (Inter + Noto Sans KR)
 *  3. 미세한 회색 구분선, 그림자 거의 없음
 *  4. 원형 아바타 + 스토리 링 그라디언트 (주황 → 핑크 → 보라)
 *  5. 하트(빨강), 북마크(검정), DM 버블 아이콘
 *  6. 라운드 4~14, 버튼은 filled/outlined 두 종만
 */

export const Colors = {
  // Surface
  bg:         '#ffffff',
  bgMuted:    '#fafafa',
  card:       '#ffffff',
  overlay:    'rgba(0,0,0,0.45)',

  // Text
  text:       '#000000',
  textSub:    '#737373',   // IG secondary
  textFaint:  '#8e8e8e',
  textInverse:'#ffffff',

  // Lines
  border:     '#dbdbdb',
  divider:    '#efefef',

  // Actions / Accents
  primary:    '#0095f6',   // IG blue — 버튼/링크
  primaryPressed: '#1877f2',
  heart:      '#ed4956',   // 좋아요 빨강
  badge:      '#ed4956',   // 알림 뱃지
  verified:   '#3897f0',   // 인증 마크
  success:    '#4caf50',

  // Category chip backgrounds (연하고 채도 낮음)
  catConcert:  '#ffe5ec',
  catMusical:  '#fff1d6',
  catPlay:     '#e8e3fd',
  catSports:   '#dbf5e8',
  catFestival: '#ffe9d6',
  catExhibit:  '#eeeeee',
} as const;

// IG 스토리 링 그라디언트 (주황 → 핑크 → 보라)
export const StoryGradient = ['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5'];

export const Fonts = {
  // 한글·영문 겸용 본문 (바로 시스템 ↔ Inter/Noto 둘 다 잘 어울림)
  regular:    'Inter_400Regular',
  medium:     'Inter_500Medium',
  semibold:   'Inter_600SemiBold',
  bold:       'Inter_700Bold',

  // 한글 (Noto Sans KR 계열이 IG 한글 UI와 가장 가까움)
  krRegular:  'NotoSansKR_400Regular',
  krMedium:   'NotoSansKR_500Medium',
  krBold:     'NotoSansKR_700Bold',

  // 앱 로고 — 필기체. 상단 로고 한 곳에서만 사용
  brand:      'Gaegu_700Bold',
} as const;

export const Radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const FontSizes = {
  tiny: 11,
  caption: 12,
  body: 14,
  bodyLg: 15,
  title: 17,
  h2: 20,
  h1: 26,
} as const;

export const Shadows = {
  // IG는 그림자 거의 안 씀. 필요할 때만 미세하게.
  sheet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 6,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
} as const;

// 카테고리별 칩 색 매핑
export function chipBg(category?: string): string {
  if (!category) return Colors.bgMuted;
  if (category.includes('콘서트')) return Colors.catConcert;
  if (category.includes('뮤지컬')) return Colors.catMusical;
  if (category.includes('연극'))   return Colors.catPlay;
  if (category.includes('야구') || category.includes('축구') || category.includes('농구')) return Colors.catSports;
  if (category.includes('페스티벌')) return Colors.catFestival;
  if (category.includes('전시'))   return Colors.catExhibit;
  return Colors.bgMuted;
}
