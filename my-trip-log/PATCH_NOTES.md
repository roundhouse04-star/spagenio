# 🔧 my-trip-log 긴급 패치 (2026-04-21)

## 🚨 수정된 버그 (7개 파일)

### 1. 카메라(영수증 스캔)가 동작 안 하던 문제 — CRITICAL
**파일:** `src/db/schema.ts`
- SCHEMA_VERSION: 2 → 3
- `expenses` 테이블에 영수증 컬럼 4개 추가: `receipt_image`, `receipt_ocr_text`, `receipt_confidence`, `ocr_engine`
- v3 마이그레이션 추가 (기존 사용자용)
- `EXPENSE_CATEGORIES`에 `entertainment` 추가

### 2. 앱 전체 그림자·헤드라인 깨져 보이던 문제 — CRITICAL
**파일:** `src/theme/theme.ts`
- `Shadows.soft`, `Shadows.medium` 정의 추가 (19번+7번 참조됐지만 undefined였음)
- `Typography.headlineLarge`, `headlineSmall` 정의 추가 (12번 참조됐지만 undefined였음)
- 기존 카드·타이틀이 이제 의도한 크기/그림자로 렌더됨

### 3. 영수증 모달이 카드로 열리던 문제
**파일:** `app/_layout.tsx`
- `trip/[id]/receipt-scan` → modal + slide_from_bottom 등록
- `trip/[id]/receipts` → card + slide_from_right 등록

### 4. 앱 버전이 항상 '1.0.0'으로 표시되던 문제
**파일:** `app/(tabs)/me.tsx`
- `Application.default?.expoConfig?.version` (undefined) → `Constants.expoConfig?.version` (제대로 동작)
- import 변경: expo-application → expo-constants

### 5. ExpenseCategory 타입 불일치
**파일:** `src/types/index.ts`
- `ExpenseCategory`에 `entertainment` 추가 (receiptParser와 일치)
- `Expense` 인터페이스에 영수증 필드 4개 추가

### 6. 교통 메뉴에서 접근 못 하던 3개 도시 추가
**파일:** `app/(tabs)/tools.tsx`
- transit.json엔 데이터 있지만 메뉴 없었던 3곳 추가:
  - 🇳🇱 암스테르담 (5노선/61역)
  - 🇪🇸 바르셀로나 (7노선/120역)
  - 🇮🇹 로마 (3노선/65역)

### 7. 국기 아이콘 누락
**파일:** `app/transit/[city]/index.tsx`
- busan/fukuoka/shanghai/beijing 국기 추가
- 모든 19개 도시 완벽 매칭

## ⚠️ 알아두실 점

### 데이터 없는 도시들
- 부산/교토/후쿠오카/타이베이/상하이/베이징 → 탭 시 "🚧 노선 데이터 없음" 표시됨 (크래시 X)
- 나중에 transit.json에 데이터 추가하면 자동 활성화

### 삭제 대상 파일 (맥미니에서 수동으로)
```
app/transit/[city]/index.tsx.bak-20260419-1730
app/transit/[city]/index.tsx.bak-20260419-1908
.DS_Store (있으면)
```

### ⏳ 이번 패치에 포함 안 된 이슈 (향후 과제)
- 테마 모드 설정(me.tsx의 라이트/다크/시스템)이 저장되지만 color.ts Proxy가 무시함
- StyleSheet.create 캡처 문제 → 다크모드 부분적으로만 동작
- destinations.ts에 서울이 빠져 있음
- ThemeProvider.tsx 데드 코드 (사용 안 됨)
