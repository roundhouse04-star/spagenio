# 🎨 D1 폰트 적용 가이드

## 📦 1단계: 폰트 라이브러리 설치 (3종)

```bash
cd ~/projects/spagenio/my-trip-log
npx expo install @expo-google-fonts/playfair-display @expo-google-fonts/inter @expo-google-fonts/noto-sans-kr expo-font expo-splash-screen
```

설치 시간: 약 30초 ~ 1분

## 📁 2단계: 파일 덮어쓰기

zip 풀면 다음 파일이 교체됨:
- `app/_layout.tsx` - 폰트 로딩 + splash 처리
- `src/theme/theme.ts` - Fonts 상수 추가
- `app/(onboarding)/welcome.tsx`
- `app/(onboarding)/nickname.tsx`
- `app/(onboarding)/terms.tsx`

## 🚀 3단계: 재시작

```bash
# Ctrl+C로 expo 끄고
npx expo start --clear
```

⚠️ **첫 실행은 느림** — 폰트 다운로드 (Google Fonts CDN)

## 🎯 변화

### Before
- 시스템 기본 폰트 (모든 화면 동일)

### After
- **영문 헤드라인**: Playfair Display (잡지 제목 느낌)
- **한글 본문**: Noto Sans KR (깔끔한 한글)
- **버튼/UI 라벨**: Inter (모던 산세리프, 영문)

## 📐 다른 화면에도 적용하려면

각 파일 상단에:
```typescript
import { Colors, Typography, Spacing, Fonts } from '@/theme/theme';
```

스타일에 fontFamily 추가:
```typescript
title: {
  fontFamily: Fonts.bodyKrBold,  // ← 한글 제목
  fontSize: Typography.titleMedium,
  // ...
},
englishTitle: {
  fontFamily: Fonts.display,     // ← 영문 잡지 제목
  fontSize: Typography.displayMedium,
  // ...
},
button: {
  fontFamily: Fonts.bodyEnBold,  // ← 영문 버튼
  // ...
},
```

### 폰트 매핑 표

| 용도 | Fonts 상수 | 실제 폰트 |
|------|-----------|----------|
| 영문 큰 제목 | `Fonts.display` | Playfair Bold |
| 한글 큰 제목 | `Fonts.bodyKrBold` | Noto Sans KR Bold |
| 한글 본문 | `Fonts.bodyKr` | Noto Sans KR Regular |
| 한글 강조 본문 | `Fonts.bodyKrMedium` | Noto Sans KR Medium |
| 영문 라벨/버튼 | `Fonts.bodyEnBold` | Inter Bold |
| 영문 EYEBROW | `Fonts.bodyEnSemiBold` | Inter SemiBold |
