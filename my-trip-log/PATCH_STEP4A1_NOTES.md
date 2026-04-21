# 🎨 Step 4-A-1 — 탭바 + 여행 탭 다크모드 마이그레이션

## 변경 파일 (2개)
1. `app/(tabs)/_layout.tsx` — 탭바 (가장 단순)
2. `app/(tabs)/trips.tsx` — 여행 목록 탭

## 마이그레이션 패턴

### Before
```tsx
import { Colors, Typography } from '@/theme/theme';

export default function Screen() {
  return <View style={styles.container}>...</View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.background },
});
```

### After
```tsx
import { Typography } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';

export default function Screen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.container}>...</View>;
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { backgroundColor: c.background },
  });
}
```

## 자식 컴포넌트 처리 (trips.tsx의 TripCard)
- styles + colors를 props로 넘김
- 외부 styles 객체 참조 제거

## 적용 후 기대 (드디어 시각적 변화!)

### 라이트 모드 → 다크 선택:
- ✅ **탭바**: 흰색 #FFFFFF → 검은색 #1A1F2B
- ✅ **여행 탭 배경**: 베이지 → 검은 #0F131B
- ✅ **여행 카드**: 흰색 → Deep Navy #1A1F2B
- ✅ **텍스트**: 짙은 회색 → 밝은 베이지

### 다크 → 라이트:
- ✅ 즉시 원래대로 복귀

### 안 바뀌는 화면 (아직):
- ⚠️ 홈 탭, 도구 탭, 탐색 탭, 내정보 탭 — Step 4-A-2/3에서 처리
- ⚠️ 다른 모달/디테일 화면 — Step 4-B/C에서

## 적용 후 테스트

1. **앱 정상 실행** ← 핵심
2. **여행 탭 가서 새 여행 만들기** → 정상 작동하는지
3. **내정보 → 테마 → 다크 선택**
4. **탭바 색이 어두워지는지** ✨
5. **여행 탭에 가면 배경이 다크인지** ✨
6. **다른 탭은 여전히 라이트** (이게 정상, Step 4-A-2에서 처리 예정)

## 위험 신호
- ❌ 탭바 사라짐
- ❌ 여행 탭 들어가면 흰 화면
- ❌ 카드 텍스트 안 보임
→ 즉시 롤백:
```bash
git checkout -- app/\(tabs\)/_layout.tsx app/\(tabs\)/trips.tsx
```
