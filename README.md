# spagenio 모노레포

여러 프로젝트를 통합 관리하는 모노레포입니다.

## 폴더 구조

```
spagenio/
├── travel-platform/          ← 여행 SNS 웹 플랫폼 (travel.spagenio.com)
│   ├── frontend/             ← React + Vite (Vite preview)
│   ├── backend/              ← Spring Boot (Java 17, port 19080)
│   │   └── python-service/   ← FastAPI (인증/알림/DM, port 9001)
│   └── data/                 ← SQLite DB + OpenFlights
├── ai-router-dashboard/      ← AI 라우팅 관리자 대시보드
├── travellog-app/            ← 여행 SNS 모바일 앱 (Expo, 개발 중)
├── my-trip-log/              ← 개인 여행 기록 앱 (Expo + 로컬 DB, 신규)
├── nginx.conf
├── start-all.sh
├── stop-all.sh
└── README.md
```

## 프로젝트별 설명

### 🌍 travel-platform
여행 SNS 플랫폼. 사용자가 여행 기록을 공유하고 서로 팔로우할 수 있는 웹 서비스.
- **Frontend**: React + Vite, Ink Navy 디자인
- **Backend**: Spring Boot + SQLite (메인 비즈니스 로직)
- **Python 서비스**: FastAPI (인증, 알림, DM, 이미지 업로드)
- **특징**: 교통 노선도 (서울/도쿄/오사카/방콕 등), OpenFlights 항공 데이터, 광고/비즈니스 계정

### 🤖 ai-router-dashboard
AI API 라우팅/관리 대시보드.

### 📱 travellog-app (SNS용)
travel-platform의 모바일 앱 버전. 향후 SNS 기능을 모바일에서 그대로 이용 가능.
- React Native + Expo

### 📖 my-trip-log (개인 기록용)
**서버 없이 로컬에서만 동작하는 개인 여행 기록 앱.** SNS 요소 없이 순수하게 자기만의 여행 기록을 남기는 용도.
- **Stack**: Expo SDK 52 + TypeScript + expo-router
- **DB**: expo-sqlite (기기 로컬)
- **빌드**: EAS Build (iOS + Android)
- **특징**: 첫 실행 시 가입 1회, 이후 로그인 불필요. 모든 데이터는 기기에만 저장.

상세 문서: [`my-trip-log/README.md`](./my-trip-log/README.md)

---

## 설치 및 실행

### 웹 플랫폼 (travel-platform + ai-router-dashboard)

#### 1. 프로젝트 파일 배치
기존 두 프로젝트를 이 폴더 안에 복사합니다.
```bash
cp -r ~/프로젝트/travel-platform     ./travel-platform
cp -r ~/프로젝트/ai-router-dashboard ./ai-router-dashboard
```

#### 2. vite.config.js 교체
```bash
# travel-platform 용
cp travel-platform/frontend/vite.config.js travel-platform/frontend/vite.config.js.bak
cp <이 폴더의 vite.config.js (travel)> travel-platform/frontend/vite.config.js

# ai-router-dashboard 용
cp ai-router-dashboard/vite.config.js ai-router-dashboard/vite.config.js.bak
cp <이 폴더의 vite.config.js (ai)> ai-router-dashboard/vite.config.js
```

#### 3. 서버에서 실행
```bash
./start-all.sh   # 전체 시작
./stop-all.sh    # 전체 종료
```

#### 4. Nginx 설정 (서버에서 1회)
```bash
sudo cp nginx.conf /etc/nginx/sites-available/spagenio
sudo ln -s /etc/nginx/sites-available/spagenio /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

#### 5. SSL 인증서 (최초 1회)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d spagenio.com -d www.spagenio.com
```

---

### 모바일 앱

#### my-trip-log (개인 기록용)

```bash
cd my-trip-log
bash setup.sh      # 의존성 설치 + 환경 체크
npm start          # Expo Dev Server 시작
```

빌드 (EAS Build 필요):
```bash
npm run build:ios        # iOS 시뮬레이터용
npm run build:android    # Android APK
```

자세한 내용은 [`my-trip-log/README.md`](./my-trip-log/README.md) 참조.

#### travellog-app (SNS 모바일 앱)
travel-platform과 연동되는 모바일 앱. 별도 서버(travel.spagenio.com) 필요.

---

## 포트 정리

| 서비스 | 포트 | URL |
|--------|------|-----|
| travel 프론트엔드 | 4173 | travel.spagenio.com |
| travel Java 백엔드 | 19080 | /api |
| travel Python | 9001 | /api (일부) |
| ai 프론트엔드 | 5174 | /ai |
| ai 백엔드 | 8002 | /ai/api |
| my-trip-log | - | 모바일 앱 (서버 없음) |
| travellog-app | 8081 | Expo Dev Server |

---

## 개발 가이드

### Git 전략
- `main` 브랜치에 직접 커밋 (작은 팀)
- 커밋 메시지: 한국어 OK, prefix 사용 (feat:, fix:, chore: 등)

### 배포
- **travel-platform**: `cd travel-platform && bash deploy.sh "메시지"` (맥미니로 자동 반영)
- **ai-router-dashboard**: `cd ai-router-dashboard && bash deploy.sh "메시지"`
- **travellog-app**: `cd travellog-app && bash deploy.sh "메시지"`
- **my-trip-log**: EAS Build로 스토어 배포 (서버 배포 없음)
