# 🌙 Step 4-Final — 전체 앱 다크모드 완성 (21개 파일 일괄)

## 변경 파일 (21개)

### 모달/디테일 (5개)
- `app/trip/[id]/log-new.tsx` - 일기 쓰기
- `app/trip/[id]/expense-new.tsx` - 가계부 입력
- `app/trip/[id]/item-new.tsx` - 일정 추가 ← 사용자 스크린샷에서 라이트로 보였던 화면
- `app/trip/[id]/receipt-scan.tsx` - 영수증 스캔
- `app/trip/[id]/receipts.tsx` - 영수증 목록

### 가계부 (2개)
- `app/expenses/index.tsx` - 가계부 메인
- `app/expenses/[id].tsx` - 가계부 상세

### 탐색/도구 (3개)
- `app/explore/[cityId].tsx` - 도시 탐색
- `app/explore/tip/[tipId].tsx` - 팁 상세
- `app/transit/[city]/index.tsx` - 지하철 노선도

### AI (1개)
- `app/ai-itinerary.tsx` - AI 일정

### 온보딩 (2개)
- `app/(onboarding)/nickname.tsx`
- `app/(onboarding)/terms.tsx`

### 설정 (3개)
- `app/settings/profile.tsx`
- `app/settings/privacy.tsx`
- `app/settings/terms.tsx`

### 컴포넌트 (5개)
- `src/components/ChecklistTab.tsx`
- `src/components/ItineraryTab.tsx`
- `src/components/LogsTab.tsx`
- `src/components/ExpensesTab.tsx`
- `src/components/DatePickerModal.tsx`

## 추가 개선 (가독성)
다크 모드에서 `c.primary` 베이지 카드 위 텍스트가 안 보이던 문제도
hotfix4b1과 동일 패턴으로 모두 수정:
- `'rgba(250, 248, 243, 0.X)'` → `c.textOnPrimary` + `opacity`

## 적용 방법
```bash
cd ~/projects/spagenio && unzip -o ~/Downloads/step4final.zip
```

## 적용 후 테스트 체크리스트

### 라이트 모드 (회귀 없는지)
- [ ] 모든 화면 정상 색상
- [ ] 텍스트 잘 보임

### 다크 모드 (새로)
- [ ] 일정 추가 화면 (`+ 일정` 버튼) ← 가장 큰 변화
- [ ] 일기 쓰기 화면
- [ ] 가계부 입력
- [ ] 영수증 스캔
- [ ] 영수증 목록
- [ ] AI 일정 만들기 (`AI 일정` 빠른 메뉴)
- [ ] 가계부 메인 (`💰 비용관리` 빠른 메뉴)
- [ ] 도시 탐색 상세 (탐색 탭 → 도시 클릭)
- [ ] 지하철 노선도 (`🚇 교통` 빠른 메뉴 → 도시 선택)
- [ ] 설정 (내정보 → 프로필 수정/이용약관/개인정보)
- [ ] 신규 가입 시 온보딩 화면

## 위험 신호
- ❌ 어떤 화면이라도 흰 배경/검은 텍스트 깨짐
- ❌ 자식 컴포넌트 prop 누락 에러
→ 즉시 롤백:
```bash
cd ~/projects/spagenio/my-trip-log
git checkout -- app src
```

## 마이그레이션 패턴 (참고)
```tsx
// Before
import { Colors } from '@/theme/theme';
const styles = StyleSheet.create({ ... Colors.X ... });

// After
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { useMemo } from 'react';

export default function Screen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // ...
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({ ... c.X ... });
}

// 자식 컴포넌트는 styles + colors props 받음
function ChildCard({ data, styles, colors }: { ... }) { ... }
```
