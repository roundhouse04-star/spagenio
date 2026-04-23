# v2 변경사항 요약

## 🎯 추가된 5개 핵심 기능

### 1. 💖 위시리스트
- 공연 상세에서 하트 버튼으로 토글
- 홈화면 전용 섹션 ("💖 위시리스트 N건")
- 캘린더 셀에 💖 마커

**영향 파일**: `schema.ts` (is_wishlisted), `events.ts` (toggleWishlist, getWishlistedEvents), `event/[id].tsx`, `(tabs)/index.tsx`, `(tabs)/calendar.tsx`

### 2. ⭐ 세부 별점
- 카테고리별로 4개 평가 항목 자동 표시
  - 콘서트: 음향/무대/좌석/세트리스트
  - 뮤지컬: 스토리/캐스팅/음악/연출
  - 연극: 스토리/연기/연출/무대
  - 팬미팅: 진행/소통/굿즈/좌석
  - 페스티벌: 라인업/음향/장소/운영
  - 전시: 내용/공간/체험/해설
- JSON으로 저장 (기존 전체 rating 필드는 호환성 유지)

**영향 파일**: `schema.ts` (RATING_ITEMS), `tickets.ts` (ratings_json), `DetailedRating.tsx` (신규), `ticket/[id].tsx`

### 3. 📊 관극 리포트
- **전체/연도별** 전환 가능
- 총 관람 수, 평균 별점, 총 지출 (가격 입력 시)
- 카테고리 분포 (바 차트 + 퍼센트)
- 월별 관람 (vertical bar chart)
- 최애 아티스트 TOP 5
- 자주 간 장소 TOP 3
- 역대 합계 (모든 연도 통합)

**영향 파일**: `stats.ts` (신규), `report.tsx` (신규), `tickets.ts` (price 컬럼), `(tabs)/index.tsx` (바로가기)

### 4. 🏆 뱃지 (30개)
**첫 걸음 5개**: 첫 기록, 첫 콘서트, 첫 뮤지컬, 첫 연극, 첫 팬미팅
**카테고리 마스터 6개**: 콘서트 마니아(5)/킹(10), 뮤지컬 러버(5)/마스터(10), 페스티벌러(3), 전시 애호가(5)
**티켓 개수 4개**: 컬렉터(5/10/30/100)
**팬심 3개**: 한 아티스트 3/5/10회 관람
**기록 충실도 4개**: 사진가(5/20), 꼼꼼한 기록자(메모 10), 평가자(세부별점 5)
**별점 3개**: 평론가(10), 최고의 순간(5점 5회), 냉정한 평가자(3점이하 5회)
**다양성 3개**: 장르 탐험가(3개 카테고리), 문화 마스터(6개), 다양한 덕질(5명)
**스페셜 2개**: 통 큰 팬(20만원 이상), 올해의 팬(10회)

- 티어: 브론즈/실버/골드/스페셜
- 티켓 추가/수정 시 자동 체크
- 획득 시 알림 뱃지 생성

**영향 파일**: `badges.ts` (신규), `badgeChecker.ts` (신규), `BadgeCard.tsx` (신규), `badges.tsx` (신규 화면), `schema.ts` (badges 테이블), `database.ts` (시작 훅)

### 5. 🔔 알림
**D-day 알림** (공연 notifyEnabled=true 경우 자동):
- D-7 오전 10시
- D-1 오후 8시
- 당일 오전 9시

**티켓 오픈 알림** (수동 입력 시):
- 오픈 1일 전 같은 시간 (무음)
- 오픈 1시간 전 (소리 O)
- 공연 상세에서 네이버 검색 버튼으로 오픈일 확인 후 수동 입력

**영향 파일**: `eventNotifications.ts` (신규), `schema.ts` (ticket_open_at), `events.ts` (getUpcomingTicketOpens), `database.ts` (시작 스케줄링), `event/[id].tsx` (네이버 버튼 + 필드)

---

## 🗄️ 스키마 변경

### v1 → v2 (자동 마이그레이션)
```sql
ALTER TABLE events ADD COLUMN is_wishlisted INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN ticket_open_at TEXT;
ALTER TABLE tickets ADD COLUMN ratings_json TEXT;
ALTER TABLE tickets ADD COLUMN price INTEGER;
CREATE INDEX idx_events_wishlist ON events(is_wishlisted);
CREATE TABLE badges (badge_id TEXT PRIMARY KEY, unlocked_at TEXT NOT NULL);
```

---

## ⚠️ 하위 호환성

- 기존 티켓/이벤트는 모두 그대로 유지 (photo_uri 상대경로, rating 0~5 등)
- 뱃지는 **처음 앱 실행 시 소급 적용** (기존 데이터 기준 조건 만족분 자동 unlock)
- `rating` 필드(전체 별점)는 유지 — `detailedRatings`는 추가 항목일 뿐
- 알림은 `notifyEnabled=true`인 이벤트만 스케줄링 (기본값 true)

---

## 📦 의존성
기존 `expo-notifications@~0.32.0` 를 사용. **신규 설치 불필요**.

---

## 🧹 정리된 것
- `resetDatabase()` 에 `badges` 테이블 DROP 추가
- 마이그레이션 실패 시 "duplicate column" 에러는 silent
- 뱃지 체크는 500ms 지연 (트랜잭션 충돌 방지)
- 알림 ID prefix `mygong-event-` 로 통일 (재스케줄링 시 기존 것만 정리)
