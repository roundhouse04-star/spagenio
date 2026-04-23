# 📊 가계부 메인 파이차트 추가 + 데이터 보존 설명

## ✨ 추가된 것

### 1. 전체 가계부 메인 (`app/expenses/index.tsx`) 카테고리 차트
- 모든 여행을 합산한 **카테고리별 파이차트** + 범례
- 도넛 형태, 가운데 총액 표시
- 카테고리별: 금액, 건수, 비율

### 2. 재사용 가능한 차트 컴포넌트 (`src/components/CategoryPieChart.tsx`)
- WebView + SVG 기반 도넛 차트
- 범례 클릭 시 onCategoryToggle 콜백 → 필터링 가능 (선택)
- 카테고리 100% 한 종류일 때 SVG arc 안 그려지는 버그 fallback 처리

### 3. DB 함수 추가 (`src/db/expenses.ts`)
- `getAllExpensesByCategory()` — 모든 여행 합산 카테고리별 집계

---

## 🛡️ 데이터 보존 — 진단 결과

**결론: 코드에는 문제 없습니다.** Expo Go의 정상 동작이에요.

### Expo Go 환경의 한계

| 동작 | 데이터 |
|---|---|
| Metro 끊고 다시 연결 | ✅ 유지 |
| Expo Go 앱 종료/재실행 | ✅ 유지 |
| **Expo Go 앱 자체 삭제 후 재설치** | ❌ 사라짐 |
| Expo Go 업데이트 | ⚠️ 가끔 사라짐 |
| 다른 Expo 프로젝트 열었다가 돌아옴 | ⚠️ 가끔 사라짐 |

Expo Go는 여러 프로젝트가 한 컨테이너에서 도는 **개발용 샌드박스**라 영속성 보장이 안 돼요.

### 진짜 출시 환경에서는 안전

| 동작 | 데이터 |
|---|---|
| App Store 업데이트 | ✅ 보존 (iOS 보장) |
| TestFlight 새 빌드 | ✅ 보존 |
| OTA 업데이트 (코드만 푸시) | ✅ 보존 |
| 사용자가 직접 앱 삭제 후 재설치 | ❌ 사라짐 (정상 OS 동작) |

### 검증 방법

1. **EAS Preview 빌드** → 실제 앱 환경에서 데이터 보존 확인:
```bash
cd ~/projects/spagenio/my-trip-log
eas build --profile preview --platform ios
# 빌드 완료 후 TestFlight에 올리기
# → 데이터 입력 → 코드 수정 → OTA 푸시 → 데이터 그대로인지 확인
```

2. **DB 마이그레이션 시스템 확인**:
- `SCHEMA_VERSION = 3`
- `MIGRATIONS` 배열로 기존 데이터 보존하면서 컬럼만 추가
- `CREATE TABLE IF NOT EXISTS`로 기존 테이블 안 건드림
- → 안전

---

## 🚀 적용

```bash
cd ~/projects/spagenio && \
unzip -o ~/Downloads/missing-screens-v2.zip && \
cd my-trip-log && \
pkill -f expo; pkill -f metro && \
npx expo start --clear
```

## ✅ 테스트
- 가계부 (탭 → 도구 → 가계부) → 전체 카테고리별 파이차트 표시 확인
- 지출이 없으면 차트 안 나옴 (정상)

---

## 🤔 데이터 백업/복원 기능 (선택)

만약 사용자가 폰을 바꾸거나 앱을 재설치하는 경우에도 데이터를 유지하고 싶다면 별도 기능이 필요합니다:

- **JSON 내보내기/가져오기** (가장 간단, 1~2시간)
- **iCloud 자동 백업** (iOS만, 코드 1줄)
- **사용자 계정 + 클라우드 동기화** (출시 후, 시간 듬)

선택하시면 다음 패치로 추가하겠습니다.
