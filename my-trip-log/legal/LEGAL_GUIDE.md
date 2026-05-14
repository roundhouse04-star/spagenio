# 📜 법적 문서 가이드 (Spagenio)

## 📁 파일 구조

### 앱 내 화면
- `app/settings/privacy.tsx` — 개인정보처리방침 (9개 섹션)
- `app/settings/terms.tsx` — 이용약관 (13개 조항)

### 마크다운 원본 (개발자 참고용)
- `PRIVACY_POLICY.md` — 개인정보처리방침 원본
- `TERMS_OF_SERVICE.md` — 이용약관 원본

## 🌐 공개 URL (App Store / Google Play 심사용)

법적 문서는 별도 레포 `spagenio-legal` 에서 호스팅됩니다:

- **메인**: https://roundhouse04-star.github.io/spagenio-legal/
- **개인정보처리방침**: https://roundhouse04-star.github.io/spagenio-legal/privacy.html
- **이용약관**: https://roundhouse04-star.github.io/spagenio-legal/terms.html

별도 레포: https://github.com/roundhouse04-star/spagenio-legal

## 📋 App Store Connect 제출 정보

### 필수 URL
- **개인정보처리방침 URL**: 위 privacy.html 주소
- **서비스 약관 URL**: 위 terms.html 주소 (선택)
- **지원 URL**: `mailto:spagenio.official@gmail.com` 또는 메인 페이지 URL

### App Privacy 설문 답변 가이드

**데이터 수집 여부**: ✅ 수집함 (익명 통계, 광고 ID)

**수집 항목**:
- Identifiers → Device ID (익명 UUID)
- Diagnostics → Crash Data, Performance Data
- Usage Data → Product Interaction (선택 동의 시)
- 광고 쓰면: Third-Party Advertising (AdMob)

**용도**:
- Analytics, App Functionality
- (광고 시) Third-Party Advertising

**사용자 연결 여부**: 모두 "Not Linked to User" (익명 UUID)

## 🔐 iOS 특별 요구사항

### App Tracking Transparency (ATT)
광고 쓸 때 필수 (iOS 14.5+).
현재는 AdMob 비활성화 상태라 ATT 프롬프트 안 뜸.

### Info.plist 설정 (app.json에 이미 있음)
```json
"ITSAppUsesNonExemptEncryption": false
```
→ ✅ icloud-backup 패치로 추가 완료

## 📋 Google Play 요구사항

### Data Safety 설문
- 수집 데이터: 익명 식별자, 광고 ID
- 공유 데이터: 없음
- 보안: 전송 중 암호화 (HTTPS)

### 대상 연령대
- "13세 이상" (한국은 만 14세 이상)

## ✅ 출시 전 체크리스트

- [x] 별도 레포 spagenio-legal 생성
- [x] 공개 URL 확보 (GitHub Pages)
- [ ] 앱 내 화면 최신 반영 확인 (설정 → 개인정보처리방침 / 이용약관)
- [ ] 시행일 날짜 확인 (실제 출시일로 수정 가능)
- [ ] 연락 이메일 최종 확인 (`spagenio.official@gmail.com`)
- [ ] App Store Connect 에 URL 입력
- [ ] Google Play Console 에 URL 입력

## 🚀 향후 업데이트 시

1. **이 폴더의 .md 파일을 먼저 수정** (원본 관리)
2. **앱 내 화면 동기화** (`app/settings/*.tsx`)
3. **별도 레포 spagenio-legal 의 html 파일 동기화**
4. **시행일 날짜 업데이트**
5. 중대 변경이면 앱 내 공지 + 재동의 받기

## 📝 앞으로 보완 필요

### 시급
- [ ] **앱 이름**: `app.json`의 `"name": "My Trip Log"` → `"Spagenio"` 로 변경
- [ ] **슬러그**: `"slug": "my-trip-log"` → `"spagenio"` 로 변경 (또는 유지)

### 선택
- [ ] 영문 버전 약관 (글로벌 출시 시)
- [ ] 약관 동의 이력 저장 기능
- [ ] 약관 변경 시 사용자 알림 기능
