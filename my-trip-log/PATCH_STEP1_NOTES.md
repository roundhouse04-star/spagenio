# 🎨 Step 1 — 온보딩 Spagenio 리브랜딩

## 변경 파일
- `app/(onboarding)/welcome.tsx` (1개만)

## 변경 사항

### Before (현재)
```
SPAGENIO PRESENTS
My Trip Log          ← 메인 타이틀 (44pt)
모든 여행은
한 권의 책이 됩니다
```

### After (Step 1)
```
TRAVEL JOURNAL
Spagenio             ← 메인 타이틀 (48pt) ✨
My Trip Log          ← 서브타이틀 (18pt)
모든 여행은
한 권의 책이 됩니다
```

## 안전성

- ✅ 어제 깨진 파일들 (theme.ts, ThemeProvider, _layout.tsx, me.tsx) **건드리지 않음**
- ✅ 기존 `Colors` import 그대로 사용
- ✅ ThemeProvider, useTheme 훅 도입 X
- ✅ 다크모드 인프라 변경 없음
- ✅ welcome.tsx 1개 파일만 수정 — 시각적 변화만

## 적용 후 기대

1. 앱 처음 켤 때 (또는 완전 종료 후 재실행)
2. 온보딩 화면에 **Spagenio**가 큼직하게 표시
3. 그 아래 작게 "My Trip Log"
4. 나머지 (서브타이틀, 시작하기 버튼 등) 동일

## 다음 (Step 2 — 다크모드 인프라 안전판)

Step 1 정상 작동 확인되면 → 어제 실패한 ThemeProvider 다시 시도.  
이번엔 SecureStore 로딩 중에도 null 반환하지 않도록 수정 (어제 스플래시 멈춤 원인).
