# Triplive PRO — IAP (인앱 결제) 등록 가이드

## 0. 코드 측 준비 완료 ✅

| 항목 | 위치 | 상태 |
|---|---|---|
| 라이브러리 | `react-native-iap` 15.x | ✅ |
| 결제 로직 | `src/utils/proStore.ts` | ✅ |
| PRO 상태 저장 | `src/utils/proStatus.ts` (AsyncStorage) | ✅ |
| 결제 화면 | `app/pro.tsx` | ✅ |
| AdBanner ✕ 버튼 | `src/components/AdBanner.tsx` | ✅ |
| 설정 메뉴 + 구매 복원 | `app/(tabs)/me.tsx` | ✅ |
| Expo plugin | `app.json` 에 자동 등록 | ✅ |

**상품 ID** (양쪽 스토어 동일하게 입력):
```
com.triplive.app.pro
```

권장 가격: **₩7,900** (Tier 5 / Pricing tier 5).

---

## 1. App Store Connect — iOS IAP 등록

### 1.1 앱 내 구입 추가

1. https://appstoreconnect.apple.com 로그인
2. 좌측 메뉴에서 **나의 앱 → Triplive** 선택
3. 상단 탭 **머니타이제이션 → 앱 내 구입** 클릭
4. **+ 버튼** → **비소모성 (Non-Consumable)** 선택
5. 다음 정보 입력:

| 항목 | 값 |
|---|---|
| 참조 이름 | `Triplive PRO` |
| 제품 ID | `com.triplive.app.pro` |
| 가격 | Tier 5 (₩7,900) — 또는 원하는 가격 |

### 1.2 현지화 (Localization)

**한국어 (기본)**:
- 표시 이름: `Triplive PRO`
- 설명: `광고 없이 깔끔하게 여행을 기록하세요. 한 번 결제하면 평생 사용할 수 있어요.`

**영어**:
- Display Name: `Triplive PRO`
- Description: `Remove ads and enjoy Triplive cleanly. One-time purchase, lifetime access.`

### 1.3 심사용 스크린샷

- 결제 화면 (`app/pro.tsx`) 캡처 1장 업로드 (640x920 이상)
- 시뮬레이터 또는 실기기에서 PRO 화면 띄운 채로 캡처

### 1.4 심사 정보 (Review Notes)

```
This is a non-consumable in-app purchase to remove banner ads
from the Triplive travel journal app. No subscription, one-time payment.

Test access:
- Banner ads visible by default in the app
- "Triplive PRO" menu in the "My Info" tab opens the purchase screen
- After purchase, all banner ads are removed across the app
```

### 1.5 제출

- 상품 상태를 **"심사 준비됨 (Ready to Submit)"** 으로 변경
- 다음 앱 빌드 심사 제출 시 함께 검토됨

---

## 2. Google Play Console — Android IAP 등록

### 2.1 앱 내 상품 추가

1. https://play.google.com/console 로그인
2. **모든 앱 → Triplive** 선택
3. 좌측 메뉴 **수익 창출 → 제품 → 인앱 상품** 클릭
4. **상품 만들기** 버튼
5. 다음 정보 입력:

| 항목 | 값 |
|---|---|
| 제품 ID | `com.triplive.app.pro` |
| 이름 | `Triplive PRO` |
| 설명 | `광고 없이 깔끔하게 여행을 기록하세요. 한 번 결제, 평생 사용.` |
| 가격 | ₩7,900 (한국 기준 — "가격 설정" 에서 다른 국가 자동 환산) |

### 2.2 상품 활성화

- 상품 생성 후 **"활성"** 상태로 변경 (기본은 비활성)
- 인앱 결제 라이센스 사용 권한 부여:
  - **설정 → 라이센스 → 라이센스 테스터** 에 본인 Google 계정 추가

### 2.3 결제 처리 (Billing Permission)

- `app.json` plugins 에 `react-native-iap` 이미 등록됨
- AndroidManifest 에 `com.android.vending.BILLING` 자동 포함

---

## 3. TestFlight / 내부 테스트 결제

### 3.1 iOS — Sandbox 테스트 계정

1. App Store Connect → **사용자 및 액세스 → Sandbox** 탭
2. **+ 버튼** → Sandbox 테스트 계정 생성:
   - 이메일 (실제 사용 안 함)
   - 한국 지역 선택
   - 비밀번호
3. iPhone 설정 → App Store → **Sandbox 계정** 에 위 계정으로 로그인
4. TestFlight 빌드에서 PRO 구매 시도 → Sandbox 결제 (실제 청구 X)
5. **테스트 후 반드시 "구매 항목 삭제" 가능** (Sandbox 계정 관리 페이지)

⚠️ Sandbox 계정으로 실제 App Store / iCloud 에 로그인하면 안 됨 (계정 잠김).

### 3.2 Android — 라이센스 테스터

1. Google Play Console → **설정 → 라이센스 테스트** 에 본인 Gmail 추가
2. 앱 내 결제 시 자동으로 "테스트 결제" 표시
3. 실제 청구 안 됨

---

## 4. 코드와 매칭 확인

상품 ID 가 코드와 정확히 일치해야 함:

```typescript
// src/utils/proStore.ts
export const PRO_PRODUCT_ID = 'com.triplive.app.pro';
```

스토어에 다른 ID 로 등록했다면 위 상수 변경.

---

## 5. 출시 체크리스트

- [ ] App Store Connect 에 IAP 상품 등록 (`com.triplive.app.pro`)
- [ ] Play Console 에 인앱 상품 등록 (동일 ID)
- [ ] Sandbox / 라이센스 테스터 계정으로 TestFlight 결제 검증
- [ ] 구매 직후 광고 즉시 사라지는지 확인
- [ ] 앱 강제 종료 → 재시작 후에도 PRO 유지되는지 확인
- [ ] "구매 복원" 버튼이 정상 작동하는지 확인
- [ ] 환불 후 PRO 자동 해제 (Apple/Google 알림 처리) — 향후 추가

---

## 6. 가격 변경 / 프로모션

### 가격 조정
- App Store Connect / Play Console 에서 "가격 변경" 만 누르면 적용
- 코드 변경 불필요 (현지화 가격 자동)
- `PRO_DISPLAY_PRICE` 는 스토어 fetch 실패 시 fallback 으로만 사용

### 출시 프로모션 (선택)
- App Store: "도입 가격 (Introductory Offer)" — Non-consumable 은 지원 안 함
- 대신 한정 기간 가격 인하로 운영 → 며칠 후 정상가 복귀
- Play Console: "스토어 일시 인하" 기능 사용 가능

---

## 7. 알려진 한계 (v1.1 기준)

- **영수증 서버 검증 없음** — 로컬 영수증만 신뢰. 환불·구독 정확 추적 어려움.
  → Non-consumable 일회성 결제만 다루므로 큰 문제 없음.
  → 추후 PRO 구독 모델 도입 시 cloud function 추가 필요.
- **가족 공유 (Family Sharing)** — Apple 측은 자동 지원, Google 측은 별도 설정.
- **iOS 환불 자동 감지 없음** — 환불 후에도 로컬 PRO 상태가 유지될 수 있음.
  → `restorePurchases()` 호출 시 환불된 영수증은 제외돼서 자연스럽게 해제됨.

---

## 8. 출시 후 모니터링

- App Store Connect → **판매 및 동향** → IAP 매출 일별 추이
- Play Console → **수익화 → 수익 보고서**
- 일반적인 무료앱 PRO 결제 전환율: **0.5~3%**
- 광고 매출 (AdMob) vs PRO 매출 (IAP) 비교 분석 (보통 PRO 가 5~10배 ARPU)

---

문의: spagenio.official@gmail.com
