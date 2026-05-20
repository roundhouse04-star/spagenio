# 로또부스터 — 앱스토어 배포 가이드

> iOS App Store + Google Play Store 출시 절차

---

## 📋 배포 전 체크리스트

| 항목 | 상태 | 비고 |
|---|---|---|
| 앱 이름/Bundle ID | ✅ | `com.spagenio.lotto`, name="로또부스터" |
| 아이콘/스플래시 | ✅ | 1024×1024, adaptive icon 준비됨 |
| 권한 설명문 | ✅ | 카메라/갤러리 한국어 명시 |
| 면책조항 + 약관 | ✅ | 만 19세 이상 + 사행성 문구 정비 완료 |
| eas.json | ✅ | 본 가이드와 함께 생성 |
| Apple Developer 계정 | ❌ | $99/년, 사용자가 직접 가입 |
| Google Play Console 계정 | ❌ | $25 일회성, 사용자가 직접 가입 |
| AdMob 프로덕션 광고 단위 ID | ❌ | 현재 테스트 ID 사용 중, 발급 필요 |
| 개인정보 처리방침 공개 URL | ❌ | GitHub Pages 무료 호스팅 권장 |
| 앱 스크린샷 (스토어 listing) | ❌ | iPhone 6.7" / Android 다양한 사이즈 |
| 앱 설명문 (스토어 listing) | ❌ | 한국어 + 영어 |

---

## 1️⃣ EAS Build 초기 설정

### Expo 계정 + EAS 프로젝트 연결
```bash
cd lotto-app
eas login                    # Expo 계정 로그인 (없으면 expo.dev에서 가입)
eas init                     # 프로젝트를 EAS에 등록 → app.json에 projectId 자동 추가
```

### 첫 빌드 (테스트)
```bash
# 개발 빌드 (Expo Go 대체용 — 시뮬레이터/디바이스 즉시 설치)
eas build --platform ios --profile development
eas build --platform android --profile development

# 내부 배포 빌드 (TestFlight / 내부 테스터용)
eas build --platform all --profile preview
```

빌드는 **EAS 클라우드**에서 진행 (무료 플랜 월 30회). 약 10~20분 소요.

---

## 2️⃣ Apple Developer 가입 + iOS 인증서

### 가입
1. https://developer.apple.com/programs/ 가입 (Apple ID 필요)
2. **연 $99 결제** (개인/회사 선택)
3. 승인까지 1~2일

### 인증서/프로파일 (EAS가 자동 처리)
```bash
eas build --platform ios --profile production
# → 첫 빌드 시 Apple ID 로그인 후 EAS가 자동으로 인증서/프로비저닝 생성
```

### App Store Connect 앱 등록
1. https://appstoreconnect.apple.com → "내 앱" → "+" 새 앱
2. 입력 정보:
   - 이름: **로또부스터**
   - 기본 언어: 한국어
   - Bundle ID: `com.spagenio.lotto`
   - SKU: `LOTTO_BOOSTER_001` (임의)
3. **App Store 메타데이터** (아래 §6 참조)

---

## 3️⃣ Google Play Console 가입 + Android 인증

### 가입
1. https://play.google.com/console/ 가입
2. **$25 일회성 결제**
3. 본인 인증 + 1~2일 승인

### Service Account (자동 배포용)
1. Google Play Console → 설정 → API 액세스
2. Google Cloud Project 연동 → Service Account 생성
3. 키 파일(JSON) 다운로드 → `lotto-app/play-store-service-account.json` 으로 저장
4. **이 파일을 git에 commit하면 안 됨** — .gitignore 확인

### 첫 업로드
```bash
eas build --platform android --profile production
# → AAB 파일 생성됨 → Play Console에 수동 업로드 또는
eas submit --platform android
# → service account로 자동 업로드
```

---

## 4️⃣ AdMob 프로덕션 키 발급

현재 `app.json`의 광고 ID는 **Google 테스트 ID**입니다:
```
androidAppId: "ca-app-pub-3940256099942544~3347511713"  # 테스트
iosAppId: "ca-app-pub-3940256099942544~1458002511"      # 테스트
```

### 프로덕션 키 발급
1. https://admob.google.com/ 가입 (Gmail 필요)
2. **앱 추가** (iOS / Android 각각)
   - 패키지명: `com.spagenio.lotto`
   - 앱 이름: 로또부스터
3. 발급된 App ID로 app.json 갱신 → 빌드 다시
4. 광고 단위 ID는 src/components/BannerAdSlot.js에 적용

⚠️ **수익 발생까지 1~2주의 트래픽/검토 기간**

---

## 5️⃣ 개인정보 처리방침 공개 URL

앱스토어 listing 필수 항목. **GitHub Pages로 무료 호스팅 가능.**

### 방법 (추천)
1. `lotto-app/docs/privacy.html` 작성 (LegalScreen 내용을 정적 HTML로)
2. spagenio repo → Settings → Pages → Source: main, /docs
3. 공개 URL: `https://roundhouse04-star.github.io/spagenio/lotto-app/docs/privacy.html`

### 또는 대안
- Notion 공개 페이지
- Google Docs 공유 링크 (단, 도메인이 google.com이라 일부 스토어가 거부할 수 있음)

---

## 6️⃣ 스토어 메타데이터 (Listing)

### 앱 설명 (한국어 권장 초안)

**제목**: 로또부스터 — 로또 6/45 추천·당첨 확인

**부제**: 통계 분석 기반 번호 추천 + QR 당첨 확인

**키워드** (Apple): `로또,로또추천,번호생성,당첨확인,QR,복권,로또6/45,동행복권`

**설명**:
```
로또부스터는 과거 회차 데이터를 분석한 참고용 정보를 제공하는
로또 번호 추천 및 당첨 확인 도구입니다.

🎯 주요 기능
- 번호 추천: 4가지 자동 전략 (비인기 번호 / 통계 자연 분포 /
  간이 휠링 / 이월 헤지) + 사용자 가중치 알고리즘 추천
- QR 당첨 확인: 카메라로 복권 QR 즉시 스캔
- 구입번호 등록: 갤러리 QR 이미지 자동 등록
- 회차 정보: 1회 ~ 최신 회차 당첨번호 + 1~5등 당첨금
- 패턴 분석표: 7×7 그리드로 당첨번호 시각화
- 텔레그램 자동 발송: 매주 자동 추천 번호 전송 (선택)
- 데이터 백업: JSON 내보내기/복원

⚠️ 면책 안내
본 앱은 로또 번호 추천 서비스를 제공하며, 어떠한 형태의 당첨도
보장하지 않습니다. 추천 번호는 과거 회차 데이터를 참고하여 생성한
참고용 정보일 뿐, 미래의 당첨을 예측하지 않습니다. 로또 구매는
사용자 본인의 판단과 책임이며, 본 앱은 어떠한 법적 책임도 지지 않습니다.

🔞 만 19세 이상만 이용 가능
도박 중독 의심 시 한국도박문제예방치유원(1336)
```

### 스크린샷 사양

#### iOS (App Store Connect)
- **iPhone 6.7"** (1290×2796) — iPhone 14/15/16 Pro Max — 필수
- **iPhone 6.5"** (1242×2688) — iPhone 11 Pro Max/XS Max — 권장
- **iPhone 5.5"** (1242×2208) — iPhone 8 Plus — 권장
- **iPad 12.9"** (2048×2732) — supportsTablet=true 이면 필수

권장 화면 5~6장:
1. 홈 (1221회 당첨번호 + 메뉴)
2. 자동추천 결과 (5게임)
3. QR 당첨 확인 결과
4. 패턴분석표
5. 회차 정보 (1~5등 당첨금)
6. 알림 설정 (선택)

#### Android (Play Console)
- **폰**: 1080×1920 ~ 1080×2340 (최소 2장, 최대 8장)
- **7" 태블릿**: 권장 (없어도 됨)
- **10" 태블릿**: 권장 (없어도 됨)
- **피처 그래픽**: 1024×500 (필수)

---

## 7️⃣ 도박 카테고리 정책 검토

### Apple App Store
- **가이드라인 5.3.4**: "Gambling apps must comply with all applicable local laws."
- 로또 **번호 추천 + 결과 확인**은 OK
- 단, 실제 베팅/결제 기능 X → 우리 앱은 안전
- **카테고리**: `엔터테인먼트` 또는 `유틸리티`로 분류
- **17+ 등급** (도박 시뮬레이션 또는 추천)

### Google Play
- **Real Money Gambling Policy**: 한국에서 실제 도박 앱은 라이센스 필요
- 로또 정보 제공 앱은 정책 외 (실제 베팅 X)
- **콘텐츠 등급**: IARC 설문 시 "도박 시뮬레이션 없음" 명시
- **카테고리**: `생활`/`엔터테인먼트`

### ⚠️ 심사 시 자주 문제되는 표현 (이미 정비됨)
- "당첨 확률 높여드립니다" → ❌ 절대 금지
- "1등 보장" → ❌
- "통계적으로 우위" → ⚠️ 검증 미달 시 위험 → ✅ 이미 제거

---

## 8️⃣ 빌드 → 제출 흐름 요약

```bash
# 1. 빌드 (EAS 클라우드)
cd lotto-app
eas build --platform all --profile production

# 2. iOS 자동 제출 (TestFlight → App Store)
eas submit --platform ios

# 3. Android 자동 제출 (Internal track → Production)
eas submit --platform android

# 또는 빌드 후 다운로드해서 수동 업로드
# - iOS: Transporter.app 으로 .ipa 업로드
# - Android: Play Console "App bundles" 페이지에 .aab 드래그
```

### 심사 기간
- Apple App Store: 평균 24~48시간
- Google Play Store: 평균 1~7일 (첫 출시는 더 오래)

---

## 9️⃣ 출시 후 운영

### 모니터링
- App Store Connect → Sales and Trends (다운로드/매출)
- Play Console → 통계, ANR/Crash, 사용자 리뷰
- AdMob → 광고 수익 + eCPM

### 업데이트
```bash
# 코드 변경 후
eas build --platform all --profile production --auto-submit
# 또는 EAS Update (over-the-air) — 네이티브 변경 없을 때
eas update --branch production --message "버그 수정"
```

### 응급 패치
- EAS Update로 JavaScript 즉시 배포 가능 (네이티브 코드 변경 시엔 새 빌드 필요)

---

## ❓ 자주 묻는 질문

### Q. 무료로 출시 가능한가?
**A. iOS는 $99/년 필수. Android는 $25 일회성.**
- Expo EAS 빌드: 무료 플랜 월 30회 (충분)
- AdMob: 무료 (수익 발생 시 70% 분배)
- GitHub Pages 호스팅: 무료

### Q. 광고 없이 출시 가능한가?
**A. 네.** AdMob 플러그인을 app.json에서 제거하면 됨. 그 경우 무료 앱 또는 유료 앱(₩1,200~)으로 출시.

### Q. 한국 사행성 라이센스가 필요한가?
**A. 아니요.** 우리 앱은 실제 도박/베팅 기능이 없으니 사행산업감독위 라이센스 대상이 아님. 단, 면책조항에 명시한 19세 이상 + 1336 안내는 유지해야 안전.

### Q. 심사에서 거부될 가능성?
**A. 다음 항목만 주의하면 통과 잘 됨**
- "당첨 보장" 같은 과대광고 표현 X (이미 정비)
- 개인정보 처리방침 공개 URL 명시
- 17+/만 19세 이상 등급 정확히 표시
- IAP(In-App Purchase) 없으면 별도 심사 항목 X

---

## 📞 문제 발생 시

- Expo EAS: https://expo.dev/help
- Apple Developer: developer.apple.com/contact/
- Google Play Console: support.google.com/googleplay/android-developer
- AdMob: support.google.com/admob

---

**최종 업데이트**: 2026-05-09
**대상 버전**: 로또부스터 v1.0.0
