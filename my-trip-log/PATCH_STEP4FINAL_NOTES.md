# 🌙 Step 4-Final v2 — 전체 앱 다크모드 완성 (21개 파일 일괄)

## v2 변경 (이전 zip 폐기)
- ❌ v1: ItineraryTab/LogsTab/ExpensesTab/ChecklistTab의 `export function` 케이스 처리 못 함 → 런타임 에러
- ✅ v2: named export 함수도 useTheme/useMemo 자동 추가
- ✅ v2: 자식 컴포넌트 시그니처 깨진 거 정상화
- ✅ v2: useMemo import 누락 3개 수정

## 변경 파일 (21개)

### 모달/디테일 (5개)
- `app/trip/[id]/log-new.tsx` - 일기 쓰기
- `app/trip/[id]/expense-new.tsx` - 가계부 입력
- `app/trip/[id]/item-new.tsx` - 일정 추가
- `app/trip/[id]/receipt-scan.tsx` - 영수증 스캔
- `app/trip/[id]/receipts.tsx` - 영수증 목록

### 가계부 (2개)
- `app/expenses/index.tsx` - 가계부 메인
- `app/expenses/[id].tsx` - 가계부 상세

### 탐색/도구 (3개)
- `app/explore/[cityId].tsx` - 도시 탐색 (InfoItem 자식 props 추가)
- `app/explore/tip/[tipId].tsx` - 팁 상세
- `app/transit/[city]/index.tsx` - 지하철 노선도

### AI (1개)
- `app/ai-itinerary.tsx`

### 온보딩 (2개)
- `app/(onboarding)/nickname.tsx`
- `app/(onboarding)/terms.tsx`

### 설정 (3개)
- `app/settings/profile.tsx`
- `app/settings/privacy.tsx`
- `app/settings/terms.tsx`

### 컴포넌트 (5개) ⭐ named export 케이스
- `src/components/ChecklistTab.tsx` (자식: ChecklistRow)
- `src/components/ItineraryTab.tsx` (자식: ItemCard)
- `src/components/LogsTab.tsx` (자식: LogCard)
- `src/components/ExpensesTab.tsx` (자식: ExpenseCard)
- `src/components/DatePickerModal.tsx`

## 검증 통과
- ✅ 21/21 문법 OK
- ✅ Colors 직접 참조: 0
- ✅ rgba(250,248,243) 잔존: 0 (다크모드 가독성 자동 수정)
- ✅ 자식 컴포넌트 styles props 누락: 0

## 적용
```bash
cd ~/projects/spagenio && unzip -o ~/Downloads/step4final.zip
pkill -f expo; pkill -f metro
cd my-trip-log
npx expo start --clear
```

## 테스트 체크리스트

### 다크 모드 - 모든 화면 확인
- [ ] 일정 추가 (★ 이전 라이트였음)
- [ ] 일기 쓰기, 가계부 입력
- [ ] 영수증 스캔/목록
- [ ] 가계부 메인/상세
- [ ] AI 일정 만들기
- [ ] 도시 탐색 상세
- [ ] 팁 상세
- [ ] 지하철 노선도
- [ ] 신규 가입 온보딩
- [ ] 프로필 수정 / 약관 / 개인정보
- [ ] 여행 상세의 일정/기록/비용/체크 탭

### 라이트 모드 회귀
- [ ] 모든 화면이 이전과 동일하게 보이는지

## 위험 시 롤백
```bash
cd ~/projects/spagenio/my-trip-log
git checkout -- app src
npx expo start --clear
```
