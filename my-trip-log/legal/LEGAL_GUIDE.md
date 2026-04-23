# 📜 법적 문서 가이드 (Spagenio)

## 📁 이번 패치로 생긴 파일들

### 앱 내 화면 (업데이트)
- `app/settings/privacy.tsx` — 개인정보처리방침 (9개 섹션)
- `app/settings/terms.tsx` — 이용약관 (13개 조항)

### 웹 호스팅용 (신규)
- `legal/privacy.html` — 웹용 개인정보처리방침
- `legal/terms.html` — 웹용 이용약관
- `legal/PRIVACY_POLICY.md` — 마크다운 원본 (참고용)
- `legal/TERMS_OF_SERVICE.md` — 마크다운 원본 (참고용)

## 🌐 웹 호스팅 방법 (GitHub Pages 추천 — 무료)

App Store / Google Play 심사 시 **개인정보처리방침 URL이 필수**입니다.
아래 중 하나로 공개 URL 만드세요.

### 옵션 A: GitHub Pages (추천)
1. GitHub 새 레포지토리 생성 — 이름: `spagenio-legal` 등
2. `legal/privacy.html`, `legal/terms.html` 파일 업로드
3. 레포 설정 → Pages → main 브랜치 설정
4. 약 1분 후 접속 가능:
   ```
   https://roundhouse04-star.github.io/spagenio-legal/privacy.html
   https://roundhouse04-star.github.io/spagenio-legal/terms.html
   ```

### 옵션 B: 기존 spagenio repo 의 서브패스
- 현재 repo 가 이미 GitHub Pages로 설정되어 있다면:
   ```
   https://roundhouse04-star.github.io/spagenio/my-trip-log/legal/privacy.html
   ```
- 단, repo 전체가 공개되어야 함

### 옵션 C: 별도 정적 호스팅
- Netlify / Vercel / Cloudflare Pages 등 (모두 무료)
- 드래그&드롭으로 업로드 가능

## 📋 App Store Connect 제출 정보

### 필수 URL
- **개인정보처리방침 URL**: 위에서 받은 privacy.html 주소
- **서비스 약관 URL**: 위에서 받은 terms.html 주소 (선택)
- **지원 URL**: `mailto:roundhouse04@gmail.com` 또는 간단한 지원 페이지

### App Privacy (개인정보 보고) 설문
Apple 심사에서 묻는 질문에 대한 답변 가이드:

**데이터 수집 여부**
- "이 앱은 사용자 데이터를 수집하지 않습니다" → ❌ (익명 통계, 광고 ID 수집)
- "수집합니다" → ✅

**수집 항목 체크**
- Identifiers → Device ID (익명 UUID), User ID (익명)
- Diagnostics → Crash Data, Performance Data
- Usage Data → Product Interaction (선택 동의 시)

**용도**
- Analytics: 앱 개선
- App Functionality: 서비스 제공
- **광고 쓰면 추가**: Third-Party Advertising (AdMob)

**사용자 연결 여부**
- 모두 "Not Linked to User" (익명 UUID 쓰니까)

## 🔐 iOS 특별 요구사항

### App Tracking Transparency (ATT)
광고 쓸 때 필수! iOS 14.5+ 정책.
현재는 AdMob 비활성화 상태라 ATT 프롬프트 안 뜸. AdMob 활성화 시 추가 필요.

### Info.plist 설정 (app.json에 이미 있음)
```json
"ITSAppUsesNonExemptEncryption": false
```
→ ✅ 이번 icloud-backup 패치로 이미 추가됨

## 📋 Google Play 요구사항

### Data Safety 설문
- 수집 데이터: 익명 식별자, 광고 ID
- 공유 데이터: 없음 (개발자 서버로만 익명 전송)
- 보안: 전송 중 암호화 (HTTPS)

### 대상 연령대
- "13세 이상" 선택 (Android 정책, 한국은 만 14세 이상)

## ✅ 출시 전 체크리스트

- [ ] 웹 호스팅 (GitHub Pages 등) 설정
- [ ] 개인정보처리방침 URL 확보
- [ ] 이용약관 URL 확보
- [ ] 앱 내 화면 최신 반영 확인 (설정 → 개인정보처리방침 / 이용약관)
- [ ] 시행일 날짜 확인 (2026년 4월 24일로 되어 있음 - 실제 출시일로 수정 가능)
- [ ] 연락 이메일 최종 확인 (`roundhouse04@gmail.com`)
- [ ] App Store Connect 에 URL 입력
- [ ] Google Play Console 에 URL 입력

## 🚀 향후 업데이트 시

법적 문서 변경할 때:
1. `legal/*.md` 파일을 먼저 수정 (원본 관리)
2. `app/settings/*.tsx` 와 `legal/*.html` 동기화
3. **시행일 날짜 업데이트**
4. 중대 변경이면 앱 내 공지 + 재동의 받기

## 📝 앞으로 확인/보완 필요한 것

### 시급
- [ ] **앱 이름**: 현재 `app.json`에 `"name": "My Trip Log"` → `"Spagenio"` 로 변경 필요
- [ ] **슬러그**: `"slug": "my-trip-log"` → `"spagenio"` 로 변경 (또는 유지)

### 선택
- [ ] 영문 버전 약관 (글로벌 출시 시)
- [ ] 약관 동의 이력 저장 기능 (선택 — 동의 받은 일자 기록)
- [ ] 약관 변경 시 사용자 알림 기능
