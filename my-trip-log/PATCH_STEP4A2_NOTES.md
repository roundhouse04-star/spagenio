# 🌙 Step 4-A-2 — 홈/탐색/도구 다크모드 마이그레이션

## 변경 파일 (3개)
1. `app/(tabs)/index.tsx` — 홈 탭 (PlanningCard, StatBox, QuickButton 자식 컴포넌트 props로)
2. `app/(tabs)/discover.tsx` — 탐색 탭 (SeasonCard, PersonalCard, CategoryChip)
3. `app/(tabs)/tools.tsx` — 도구 탭 (CurrencyPicker)

## 마이그레이션 패턴 (Step 4-A-1과 동일)
```tsx
// useTheme + useMemo 도입
const { colors } = useTheme();
const styles = useMemo(() => createStyles(colors), [colors]);

// 자식 컴포넌트는 styles props 받음
<MyChildCard ... styles={styles} />
```

## 적용 후 기대

### 라이트 → 다크 토글:
- ✅ **홈 탭** 배경 #0F131B로 변환
- ✅ **탐색 탭** 배경 + 카드 모두 다크
- ✅ **도구 탭** 환율 계산기 다크
- ✅ **탭바** (Step 4-A-1) + 여행 탭 (Step 4-A-1) 함께 다크
- ✅ "AI 일정" 카드 (원래 다크였음) 그대로 어울림

### 안 바뀌는 화면 (Step 4-A-3 / 4-B/C 예정):
- ⚠️ **내정보 탭** — 자식 4개라 작업량 많아서 분리
- ⚠️ 모달/디테일 화면 (trip/[id], expense, log 등)
- ⚠️ 도구 탭 안에서 "교통" 들어가면 또 라이트

## 적용 후 테스트

1. **앱 정상 실행** ← 핵심
2. **라이트 모드** 모든 탭 정상 (변화 없음)
3. **내정보 → 다크 선택**
4. **5개 메인 탭 다 가서 확인**:
   - 🏠 홈 → 다크 ✅
   - ✈️ 여행 → 다크 ✅ (Step 4-A-1)
   - 🧰 도구 → 다크 ✅
   - 🌍 탐색 → 다크 ✅
   - 👤 내정보 → 라이트 (정상, Step 4-A-3 예정)

## 위험 신호
- ❌ 홈 탭 흰 화면 / 빈 화면
- ❌ 탐색 탭 카드 안 보임
- ❌ 환율 계산기 깨짐
→ 즉시 롤백:
```bash
git checkout -- 'app/(tabs)/index.tsx' 'app/(tabs)/discover.tsx' 'app/(tabs)/tools.tsx'
```

## 다음 (Step 4-A-3)
- `me.tsx` 내정보 탭 마이그레이션 (자식 4개)
- 메인 탭 5개 모두 다크모드 완성!
