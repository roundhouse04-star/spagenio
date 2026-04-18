# My Trip Log 📖✈️

개인 여행 기록 앱 — **서버 없이, 로그인 없이, 오로지 당신의 기기에서만**

## 🎯 컨셉

- **로컬 퍼스트**: 모든 데이터는 기기의 SQLite에만 저장
- **가입 1회**: 첫 실행 시 닉네임/국적 등록 후 로그인 불필요
- **오프라인 우선**: 비행 중에도, 해외에서도 완벽 동작
- **SNS 요소 없음**: 나만의 조용한 여행 기록장

---

## 🛠 기술 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | Expo SDK 52 + React Native 0.76 |
| 언어 | TypeScript |
| 라우팅 | expo-router v4 (파일 기반) |
| DB | expo-sqlite (로컬 SQLite) |
| 상태관리 | zustand |
| 빌드 | EAS Build |
| 플랫폼 | iOS + Android |

---

## 📁 프로젝트 구조

```
my-trip-log/
├── app/                          # expo-router 라우트
│   ├── _layout.tsx              # 루트 레이아웃 (DB 초기화 + 온보딩 라우팅)
│   ├── (onboarding)/            # 최초 가입 플로우
│   │   ├── welcome.tsx          # 환영 화면
│   │   ├── nickname.tsx         # 닉네임/국적
│   │   └── terms.tsx            # 약관 동의
│   ├── (tabs)/                  # 메인 하단 탭
│   │   ├── index.tsx            # 🏠 홈 (대시보드)
│   │   ├── trips.tsx            # ✈️ 여행 목록
│   │   ├── tools.tsx            # 🧰 도구 (환율, 교통 등)
│   │   ├── discover.tsx         # 🌍 탐색 (도시 가이드)
│   │   └── me.tsx               # 👤 내 정보
│   ├── trip/[id].tsx            # 여행 상세
│   └── trips/new.tsx            # 새 여행 만들기 (모달)
├── src/
│   ├── theme/theme.ts           # 디자인 시스템 (Ink Navy)
│   ├── db/
│   │   ├── database.ts          # DB 연결/초기화
│   │   ├── schema.ts            # SQL 스키마
│   │   └── trips.ts             # Trip CRUD 헬퍼
│   └── types/index.ts           # TypeScript 타입 정의
├── assets/                      # 이미지, 폰트
├── app.json                     # Expo 설정
├── eas.json                     # EAS Build 설정
├── tsconfig.json
└── package.json
```

---

## 🗄️ DB 스키마 요약

| 테이블 | 역할 |
|---|---|
| `user` | 앱 소유자 정보 (1 row) |
| `trips` | 여행 목록 |
| `trip_items` | 일정 항목 (Day 1, Day 2...) |
| `trip_logs` | 여행 일기 (사진+글) |
| `expenses` | 가계부 |
| `checklists` | 체크리스트 |
| `bookmarks` | 저장한 장소 |
| `exchange_rates_cache` | 환율 캐시 |
| `app_meta` | 앱 메타정보 (스키마 버전 등) |

---

## 🎨 디자인 시스템

- **Primary**: `#1E2A3A` (Ink Navy) — 차분한 짙은 네이비
- **Accent**: `#C9A96A` (Warm Gold) — 여행의 따뜻함
- **Background**: `#FAF8F3` (Cream) — 편안한 크림색
- **Font**: Playfair Display (제목) + Inter (본문)

---

## 🚀 개발 시작하기

### 1. 의존성 설치

```bash
cd ~/projects/spagenio/my-trip-log
npm install
```

### 2. 아이콘/스플래시 임시 이미지 준비

`assets/` 폴더에 필요:
- `icon.png` (1024×1024)
- `adaptive-icon.png` (1024×1024)
- `splash.png` (1284×2778)
- `favicon.png` (48×48)

임시로 단색 이미지 생성:
```bash
# 어디에든 1024x1024 png 파일만 있으면 시작 가능
# 나중에 AI 디자인 툴(Figma, Midjourney 등)로 교체
```

### 3. 개발 서버 실행

```bash
npm start
```

Expo Go 앱에서 QR 스캔하거나 iOS 시뮬레이터/Android 에뮬레이터 실행.

### 4. EAS 빌드 (배포용)

**EAS CLI 설치 (최초 1회):**
```bash
npm install -g eas-cli
eas login
```

**프로젝트 설정 (최초 1회):**
```bash
eas init
eas build:configure
```

**빌드:**
```bash
# 개발용 (시뮬레이터)
npm run build:ios      # iOS 시뮬레이터 빌드
npm run build:android  # Android APK

# 스토어 제출용
eas build --platform ios --profile production
eas build --platform android --profile production
```

---

## 📋 개발 로드맵

### ✅ Phase 1 — 기본 구조 (완료)
- [x] Expo + TypeScript 프로젝트
- [x] 디자인 시스템 (Ink Navy)
- [x] SQLite 스키마 + 초기화
- [x] 온보딩 플로우 (환영 → 닉네임 → 약관)
- [x] 5개 메인 탭 (홈/여행/도구/탐색/내정보)
- [x] 여행 CRUD (생성/목록/상세)

### 🚧 Phase 2 — 핵심 기능 (진행 중)
- [ ] 여행 일정 관리 (trip_items CRUD)
- [ ] 여행 기록 작성 (사진 업로드 + 일기)
- [ ] 비용 관리 (expenses CRUD + 집계)
- [ ] 체크리스트

### 📌 Phase 3 — 도구
- [ ] 환율 API 연동 (실시간 업데이트)
- [ ] 교통 데이터 내장 (기존 웹 DB 마이그레이션)
- [ ] 긴급 연락처 / 전압 정보
- [ ] 여행 회화

### 🎨 Phase 4 — 품질
- [ ] 커스텀 폰트 로딩 (Playfair, Inter)
- [ ] 아이콘/스플래시 디자인 교체
- [ ] 다크 모드
- [ ] 애니메이션 (Reanimated)
- [ ] 햅틱 피드백

### 📦 Phase 5 — 배포
- [ ] 데이터 내보내기/가져오기 (JSON)
- [ ] iCloud / Google Drive 백업
- [ ] 푸시 알림 (여행 D-day 등)
- [ ] App Store / Play Store 제출

---

## 🔒 프라이버시 정책

- **외부 서버 없음**: 모든 데이터는 기기의 SQLite DB 파일에만 저장됩니다
- **인터넷 사용**: 환율 조회(선택), 지도 API(선택) 등 제한적으로만 사용
- **데이터 수집 없음**: 사용 통계, 광고 ID, 크래시 리포트 등 수집 안 함
- **앱 삭제 = 완전 삭제**: 기기에서 앱을 삭제하면 모든 데이터도 함께 사라짐

---

## 📝 라이선스

Private / Personal Use

Made with ♥ for travelers.
