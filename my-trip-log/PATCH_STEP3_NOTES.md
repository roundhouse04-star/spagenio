# 🔌 Step 3 — me.tsx 토글 연결

## 변경 파일 (1개)
- `app/(tabs)/me.tsx`

## 변경 사항

### Before (Phase 1-A)
```ts
const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
// ...
setThemeModeState(await getThemeMode()); // SecureStore에서 직접 읽음
// ...
await setThemeMode(mode);  // SecureStore에 직접 씀
Alert.alert('테마 변경됨', ...);  // 팝업
```

### After (Step 3)
```ts
const { mode: themeMode, setMode: setThemeProvider } = useTheme();
// ...
// load()에서 themeMode 읽기 코드 삭제 (ThemeProvider가 알아서)
// ...
await setThemeProvider(mode);  // ThemeProvider 통해 전역 적용
// Alert 제거 - 즉시 반영
```

## 동작 흐름

```
[사용자] 내정보 → 테마 → "다크" 탭
       ↓
[me.tsx] handleThemeChange('dark')
       ↓
[ThemeProvider] setMode('dark')
       ├─ React state 업데이트 → Context 값 변경
       ├─ theme.ts 전역 _userMode = 'dark'
       └─ SecureStore.setItem (영속화)
       ↓
[me.tsx] useTheme() 구독 → 리렌더 → themeMode 표시 갱신
```

## ⚠️ 이번 단계 한계 (Step 4에서 해결)

- **me.tsx 외 화면은 색상 안 바뀜**: 홈/탐색/여행 탭 등은 여전히 `Colors` 전역 Proxy 사용
- **me.tsx도 부분적**: useTheme().colors 안 쓰고 여전히 Colors 사용 → 시스템 다크모드 따라가는 약한 반응만
- **본격적 다크모드는 Step 4** (각 화면 useTheme 마이그레이션)

## 적용 후 테스트

1. **에러 없이 앱 정상 실행** ← 핵심
2. **내정보 탭 → 테마 → "다크" 탭**
   - Alert "테마 변경됨" 팝업 안 뜨는지 ✅
   - "테마" 옆에 "다크"라고 표시되는지 ✅
3. **앱 종료 후 재실행**
   - "테마" 옆 여전히 "다크"인지 (저장 확인) ✅
4. **시스템 모드 자동 따라가기**: "시스템" 선택 후 iOS 설정 → 디스플레이 → 다크 토글
   - me.tsx의 themeMode 표시가 "시스템" 그대로 (mode는 안 바뀜)

## 다음 (Step 4)
- 주요 화면 (홈, 탐색, 도구, 여행, me) 5개를 useTheme로 마이그레이션
- 다크 선택 시 진짜로 화면 색이 #1A1F2B로 변하기 시작!
