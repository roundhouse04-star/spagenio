# 🆕 누락 화면 4개 추가 + 관련 버그 수정

## 🎯 추가된 화면

### 1. 일기 편집 (`app/trip/[id]/log/[logId].tsx`)
- LogsTab에서 일기 카드 탭 → 편집 화면 이동
- 모든 필드 (제목, 내용, 날짜, 장소, 날씨, 기분, 사진) 편집 가능
- "이 기록 삭제" 버튼 포함

### 2. 비용 편집 (`app/trip/[id]/expense/[expenseId].tsx`)
- ExpensesTab / 가계부에서 지출 카드 탭 → 편집 화면 이동
- 모든 필드 (날짜, 카테고리, 내용, 금액, 통화, 환산, 메모) 편집 가능
- **영수증 이미지가 있으면 화면 상단에 표시** (OCR 신뢰도 + 엔진 정보 포함)
- 영수증 모달 → "비용 정보 편집" 버튼으로 이동
- "이 비용 삭제" 버튼 포함

### 3. 여행 편집 (이미 trips/new가 지원!)
- `trips/new`는 이미 `?id=N` 쿼리로 편집 모드를 지원하고 있었음
- trip 상세 화면 헤더에 ✏️ 버튼만 추가 → 자연스럽게 편집 가능
- 완료된 여행은 편집 차단 (기존 로직)

### 4. 영수증 개별 상세
- 별도 화면 만들지 않고 비용 편집 화면을 재활용
- 영수증 모달의 "비용 정보 편집" 버튼이 비용 편집 화면으로 이동

## 🐛 함께 잡힌 버그

### `expense-new.tsx`의 잘못된 import
- `addExpense`를 import하는데 db에는 `createExpense`만 있어 **호출 시 크래시 위험**
- → `createExpense`로 수정

### `expenses.ts`의 영수증 필드 누락
- `rowToExpense`에서 receipt_image, receipt_ocr_text 등 4개 필드 매핑 누락
  - → 영수증 정보가 저장돼도 조회 시 사라지는 버그 가능성
- `updateExpense`의 필드 매핑에도 영수증 컬럼 누락
  - → 비용 편집 시 영수증 정보 보존 못함
- 둘 다 수정함

## 📝 변경된 파일 (9개)

**신규**
- `app/trip/[id]/log/[logId].tsx` (일기 편집)
- `app/trip/[id]/expense/[expenseId].tsx` (비용 편집)

**수정**
- `app/trip/[id]/index.tsx` (헤더에 ✏️ 편집 버튼)
- `app/trip/[id]/expense-new.tsx` (import 버그 수정)
- `app/trip/[id]/receipts.tsx` (영수증 모달에 편집 버튼)
- `app/expenses/[id].tsx` (지출 항목 탭하면 편집)
- `src/components/LogsTab.tsx` (LogCard 탭하면 편집)
- `src/components/ExpensesTab.tsx` (ExpenseCard 탭하면 편집)
- `src/db/expenses.ts` (`getExpense` 추가, 영수증 필드 매핑 보강)

## 🚀 적용

```bash
cd ~/projects/spagenio && \
unzip -o ~/Downloads/missing-screens.zip && \
cd my-trip-log

# Metro 캐시 클리어
pkill -f expo; pkill -f metro
npx expo start --clear
```

## ✅ 테스트

1. **일기 편집**: 여행 → 기록 탭 → 일기 카드 탭 → 편집 화면 → 저장
2. **지출 편집**: 여행 → 비용 탭 → 지출 카드 탭 → 편집 화면 → 저장
3. **여행 편집**: 여행 상세 → 우상단 ✏️ → trips/new가 편집 모드로 열림
4. **영수증 → 비용 편집**: 영수증 목록 → 영수증 탭 → 모달 → "✏️ 비용 정보 편집"

## ⚠️ 주의

- 일기 편집의 사진은 기존 사진들과 새로 추가된 사진이 합쳐져 저장됨 (× 버튼으로 제거 가능)
- 비용 편집 시 영수증 이미지/OCR 데이터는 그대로 보존됨 (편집 화면에서 변경 불가, 표시만)
- 여행 편집은 완료된 여행에는 사용 불가 (기존 정책 유지)
