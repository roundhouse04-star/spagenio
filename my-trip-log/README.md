# 🧾 영수증 v2 - 듀얼 엔진 OCR + 다중 통화 정산

## 📦 들어있는 것 (8개 파일)

### 🤖 듀얼 엔진 OCR
- **`src/utils/ocr.ts`** ⭐
   - ML Kit (온디바이스, 빠름) → OCR.space (서버, 80+ 언어) 자동 폴백
   - 여행 도시에 따라 OCR 언어 자동 선택
- **`src/utils/ocrSpace.ts`**
   - OCR.space API (월 25,000회 무료!)
- **`src/utils/receiptParser.ts`**
   - OCR 텍스트 → 가게/날짜/금액/카테고리 파싱

### 💱 다중 통화 정산
- **`src/utils/currencyConverter.ts`** ⭐
   - 여러 통화 지출 → 사용자 기본 통화로 환산
   - 저장 시점 환율 기록 (나중에 시세 변해도 정확)
   - `summarizeExpenses()`, `formatWithConversion()`

### 💾 DB
- **`src/db/receipts.ts`**
   - 저장 시점 환율 자동 계산 + 기록
   - receipt_image, receipt_ocr_text, receipt_confidence, ocr_engine, exchange_rate, amount_in_home_currency

### 📸 화면
- **`app/trip/[id]/receipt-scan.tsx`** ⭐
   - 카메라/갤러리, 듀얼 OCR, 환율 실시간 미리보기
- **`app/trip/[id]/receipts.tsx`** ⭐
   - 영수증 갤러리 + **통화별 정산**
   - "총 지출 ₩523,400 (JPY ¥25,000 + THB ฿1,500 + KRW ₩300,000)"

---

## 💰 다중 통화 어떻게 동작?

### 저장 시
```
사용자가 ฿500 (태국 바트) 저장
  ↓
1. THB → KRW 환율 조회 (현재: 38.5)
2. DB에 저장:
   - amount: 500
   - currency: THB
   - exchange_rate: 38.5        ← 저장 시점 환율
   - amount_in_home_currency: 19,250  ← 미리 계산
```

### 정산 시
```
모든 지출 로드
  ↓
각 expense의 amount_in_home_currency 사용
(없으면 exchange_rate * amount)
(그것도 없으면 현재 환율로 계산)
  ↓
총합: ₩523,400 (KRW)
```

**장점:**
- ✅ 환율이 매일 변해도 지출 기록은 정확
- ✅ 오프라인에서도 정산 가능 (저장된 환율 사용)
- ✅ 원본 통화도 그대로 보여줌

---

## 🌍 OCR 언어 자동 선택

여행 도시에 따라 자동:

| 여행지 | OCR 언어 |
|--------|---------|
| 한국 | kor (한글) |
| 도쿄/오사카/교토/후쿠오카 | jpn (일본어) |
| 방콕 | tha (태국어) ⭐ |
| 홍콩/타이페이/상하이 | chs (중국어) |
| 유럽/미국/기타 | eng (영어) |

---

## 📥 적용 순서 (맥미니)

### 1️⃣ 라이브러리 설치

```bash
cd ~/projects/spagenio/my-trip-log
npx expo install expo-image-picker expo-file-system
npx expo install @react-native-ml-kit/text-recognition
```

### 2️⃣ OCR.space API 키 발급 (선택)

공용 키 `helloworld`가 이미 들어있어서 바로 작동해요.
개인 키를 받으려면: https://ocr.space/ocrapi/freekey

### 3️⃣ zip 풀기

```bash
unzip -o ~/Downloads/receipt-v2.zip -d ~/projects/spagenio/my-trip-log/
```

### 4️⃣ DB 마이그레이션

`src/db/database.ts`의 `initializeDatabase()` 맨 마지막에:

```typescript
import { addReceiptFields } from './receipts';

export async function initializeDatabase() {
  // ... 기존 코드 ...

  // 마지막에 추가
  await addReceiptFields(db);
}
```

### 5️⃣ _layout.tsx 라우트 추가

```tsx
<Stack.Screen
  name="trip/[id]/receipt-scan"
  options={{
    presentation: 'modal',
    animation: 'slide_from_bottom',
    animationDuration: 300,
  }}
/>
<Stack.Screen
  name="trip/[id]/receipts"
  options={{
    animation: 'slide_from_right',
    animationDuration: 280,
  }}
/>
```

### 6️⃣ 여행 상세 화면에 메뉴 추가

`app/trip/[id]/index.tsx`에:

```tsx
<Pressable onPress={() => router.push(`/trip/${tripId}/receipts`)}>
  <Text>🧾 영수증 & 정산</Text>
</Pressable>
```

### 7️⃣ Expo 재시작

```bash
cd ~/projects/spagenio/my-trip-log
lsof -ti:8081 | xargs kill -9 2>/dev/null
rm -rf .expo node_modules/.cache
npx expo start --clear
```

---

## 🧪 테스트 시나리오

### Expo Go에서 (ML Kit 없음)
- 카메라/갤러리에서 영수증 선택
- 자동으로 OCR.space로 폴백 (3~5초)
- 실제 인식 결과 확인 가능! ✨
- 태국어, 영어, 한국어 영수증 모두 테스트 가능

### 개발 빌드 후 (ML Kit 있음)
- 1차 ML Kit (1~2초)
- 신뢰도 낮으면 OCR.space 재시도
- 오프라인에서도 작동

---

## 📊 정산 화면 예시

```
총 지출
₩1,523,400
KRW 환산

통화별 지출
----------
🇰🇷 KRW: ₩300,000 (5건)
🇯🇵 JPY: ¥100,000 ≈ ₩900,000 (8건)
🇹🇭 THB: ฿5,000 ≈ ₩192,500 (3건)
🇺🇸 USD: $100 ≈ ₩130,900 (2건)
```

---

## 🚀 git 반영

```bash
cd ~/projects/spagenio
git add my-trip-log/
git commit -m "feat: 영수증 OCR 듀얼 엔진 + 다중 통화 자동 정산"
git push
```

---

## 💡 알아둘 것

### 🚀 강점
- **태국어/베트남어 등도 OCR 가능** (OCR.space 덕분)
- Expo Go에서도 **실제 인식 동작** (OCR.space 폴백)
- 여행 중에도 정확한 정산 (여러 나라, 여러 통화)
- 환율 변동에도 과거 지출 금액 불변

### ⚠️ 주의
- OCR.space 무료는 이미지 **1MB 이하** (자동 압축 있음)
- 서버 OCR은 **인터넷 필요** (ML Kit은 오프라인)
- 공용 API 키 `helloworld`는 **전 세계가 공유**해서 가끔 느릴 수 있음 → 개인 키 발급 추천

### 🔒 프라이버시
- ML Kit: 이미지가 기기 밖을 절대 안 나감
- OCR.space: 이미지가 서버로 전송됨 (HTTPS) → 민감한 영수증은 ML Kit 빌드 후 사용

---

**운동 후 집 오시면 테스트 해보세요!** 🏠
