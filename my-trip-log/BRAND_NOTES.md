# 🎨 Spagenio 브랜딩 적용

## ✨ 변경 내용

### 1. 홈 화면 헤더 (app/(tabs)/index.tsx)
"편안한 새벽이에요" 위에 브랜드 영역 추가:
```
✈️ Spagenio          (26pt, bold)
   My Trip Log       (13pt, 회색)
─────────────────── (구분선)
편안한 새벽이에요
이태호님
```

### 2. 스플래시 화면 (app/_layout.tsx)
앱 시작 시 로딩 화면을 커스텀 브랜드 스플래시로:
- 배경: 밝은 베이지 (#F5EFE4)
- 텍스트: 다크 네이비 (#1E2A3A)
- "Spa" (위) / "Trip Log" (아래) 두 줄
- 하단에 ✈️ 아이콘 + 로딩 스피너

### 3. app.json 네이티브 스플래시 배경색
네이티브 빌드(EAS) 시 사용되는 배경색을 베이지로:
- 기존: #1E2A3A (다크 네이비)
- 변경: #F5EFE4 (밝은 베이지)

※ splash.png 이미지는 그대로 유지 (교체 권장 - 추후)

## 📋 적용 방법

```bash
cd ~/projects/spagenio && \
unzip -o ~/Downloads/brand.zip && \
cd my-trip-log && \
pkill -f expo; pkill -f metro && \
npx expo start --clear
```

## 🧪 확인할 것

1. **스플래시** (앱 시작 시)
   - 밝은 베이지 배경
   - "Spa / Trip Log" 두 줄 표시
   - 하단에 ✈️ + 스피너

2. **홈 헤더**
   - "✈️ Spagenio" 큰 글씨
   - "My Trip Log" 작은 부제
   - 구분선 아래에 기존 인사말

## 🎯 향후 (선택)

### splash.png 이미지 교체
현재 이미지는 구 브랜드 기준. 새 브랜드(베이지+네이비)로 제작하려면:
1. Figma/Photoshop 등에서 1242x2436 (iPhone) 크기로 생성
2. 베이지 배경 + Spa/Trip Log 텍스트 + ✈️ 아이콘
3. `assets/splash.png` 교체
4. EAS Build 할 때 적용됨

현재 상태로도 동작에 문제없음 (커스텀 BrandSplash가 화면 전체 덮음).
