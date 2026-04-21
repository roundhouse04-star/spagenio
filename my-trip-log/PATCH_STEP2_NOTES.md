# 🛡️ Step 2 — 다크모드 인프라 (안전판)

## 변경 파일 (3개)
1. `src/theme/theme.ts` — DarkColors.surface를 `#1A1F2B` (Deep Navy)로 변경 + setGlobalThemeMode 추가
2. `src/theme/ThemeProvider.tsx` — 안전판 (null 반환 안 함)
3. `app/_layout.tsx` — `<ThemeProvider>` 주입

## 어제 실패 vs 오늘 안전판

| 위험 요소 | 어제 (실패) | 오늘 (안전) |
|---|---|---|
| ThemeProvider 로딩 중 null 반환 | ❌ `if (!loaded) return null` | ✅ 즉시 children 렌더 (LightColors로 시작) |
| Stack 강제 리마운트 | ❌ `key={isDark ? 'dark' : 'light'}` | ✅ 사용 안 함 |
| ThemeProvider 위치 | ❌ if (!isReady) 다음 (조건부) | ✅ 항상 최상위 wrapping |

## 작동 원리

```
앱 시작
  ↓
RootLayout 마운트
  ↓
<ThemeProvider> 즉시 마운트 (LightColors로 시작)
  ↓
SecureStore.getItemAsync 비동기 호출
  (children은 이미 렌더 중 - 막지 않음)
  ↓
저장된 mode 발견 → setMode(saved)
  ↓
Context 값 갱신 → useTheme 사용 화면만 리렌더
```

## ⚠️ Step 2의 한계

- Step 2에서 **다크모드 토글 UI는 아직 동작하지 않음** (me.tsx 변경 X)
- 모든 화면은 여전히 `Colors` 전역 Proxy 사용 → 시스템 다크모드만 약하게 반영
- **본격적인 다크모드는 Step 3 (me.tsx 토글 연결) 이후 작동**

## 적용 후 기대

✅ 앱이 정상 작동 (스플래시 멈춤 X)  
✅ 시각적으로 변화 없음 (Step 2는 인프라만)  
✅ 콘솔 에러 없음

만약 **앱이 정상 작동하면** → Step 3 진행  
만약 **이상 있으면** → 즉시 롤백:
```bash
git checkout -- app/_layout.tsx src/theme/theme.ts src/theme/ThemeProvider.tsx
```

## 다음 (Step 3)
- `me.tsx`의 테마 토글을 useTheme().setMode와 연결
- 다크 선택 시 즉시 반영 (visual change!)
