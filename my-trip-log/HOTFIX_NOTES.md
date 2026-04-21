# 🩹 Hotfix-4b1 — 다크모드에서 베이지 카드 위 텍스트 가독성 수정

## 문제
다크 모드에서 헤더 카드의 텍스트가 안 보임:
- 여행 상세 (도쿄여행 카드의 위치/날짜/탭하여변경)
- 홈 화면 진행 중 여행 카드 (제목/위치/날짜)

## 원인
카드 배경 = `c.primary` (다크 모드에선 베이지 #E8E2D4)
텍스트 색 = `'rgba(250, 248, 243, X)'` 하드코딩 (밝은 베이지)
→ **베이지 위에 베이지 = 안 보임**

## 수정 (2개 파일)
1. `app/trip/[id]/index.tsx` — 영향: heroLocation, heroDate, statusHint, spentText
2. `app/(tabs)/index.tsx` — 영향: ongoingTitle, ongoingLocation, ongoingDates, ongoingDate, editIconWrap

## 패턴
```diff
- color: 'rgba(250, 248, 243, 0.8)'
+ color: c.textOnPrimary,
+ opacity: 0.85
```

`c.textOnPrimary`가 라이트/다크 자동 전환:
- 라이트 모드: `#FAF8F3` (밝은 베이지) — 어두운 네이비 카드 위에서 잘 보임
- 다크 모드: `#1E2A3A` (어두운 네이비) — 베이지 카드 위에서 잘 보임

## 적용
```bash
cd ~/projects/spagenio && unzip -o ~/Downloads/hotfix4b1.zip
```

라이트 모드는 여전히 잘 보이고, 다크 모드에서 텍스트 가독성 향상됨.
