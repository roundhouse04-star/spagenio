# 로또부스터 랜딩 페이지 (lotto.spagenio.com)

앱스토어 listing에 필수인 공개 페이지(개인정보 처리방침, 이용약관).

## 📁 파일
- `index.html` — 메인 랜딩 (앱 소개 + 다운로드 링크)
- `privacy.html` — 개인정보 처리방침
- `terms.html` — 이용약관 및 면책조항
- `CNAME` — lotto.spagenio.com (호스팅 도메인 매핑)

## 🚀 배포 방법

### 옵션 A: Cloudflare Pages (권장)

spagenio.com이 Cloudflare DNS를 쓰고 있다면 가장 간편합니다.

1. https://dash.cloudflare.com/ → Workers & Pages → **Create application** → **Pages** → **Connect to Git**
2. 저장소 선택: `roundhouse04-star/spagenio`
3. 프로젝트 설정:
   - **Project name**: `lotto-spagenio` (자유)
   - **Production branch**: `main`
   - **Build command**: (비워둠 — 정적 파일이라 빌드 없음)
   - **Build output directory**: `lotto-app/landing`
   - **Root directory**: (비워둠)
4. **Save and Deploy**
5. 배포 완료 후 → **Custom domains** → **Set up a custom domain** → `lotto.spagenio.com` 입력
6. Cloudflare가 DNS에 CNAME 레코드 자동 추가
7. **완료** — 보통 1~2분 내 https://lotto.spagenio.com 접속 가능

### 옵션 B: GitHub Pages (서브 repo 분리 필요)

GitHub Pages는 repo당 단일 도메인만 지원하므로, 별도 repo로 분리해야 합니다.

1. 새 repo 생성: `roundhouse04-star/lotto-landing`
2. 본 폴더 내용 push
3. repo Settings → Pages → Source: `main` 브랜치
4. Custom domain: `lotto.spagenio.com` 입력
5. DNS 설정: `lotto.spagenio.com` → CNAME → `roundhouse04-star.github.io`

→ Cloudflare Pages 권장 (단일 repo 유지 + 더 빠름).

## 🔄 업데이트
landing/ 내 파일을 수정하고 push하면 Cloudflare Pages가 자동 재배포합니다.

## 📱 앱스토어 등록 시 사용할 URL
- **개인정보 처리방침**: https://lotto.spagenio.com/privacy.html
- **이용약관**: https://lotto.spagenio.com/terms.html
- **지원 URL** (App Store): https://lotto.spagenio.com
- **마케팅 URL**: https://lotto.spagenio.com
