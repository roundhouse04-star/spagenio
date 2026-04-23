# v2 features 적용 가이드

## 적용할 5개 기능
1. ✅ 위시리스트
2. ✅ 세부 별점 (카테고리별 항목 평가)
3. ✅ 관극 리포트 (연도별 통계)
4. ✅ 30개 뱃지 시스템
5. ✅ 티켓 오픈 + D-day 푸시 알림

---

## 🔥 적용 순서

### 1단계: 기존 파일 백업 (중요!)
```bash
cd ~/projects/spagenio/mygong-app
git add -A && git commit -m "before v2 features"
# 또는
cp -r . ../mygong-app-backup-$(date +%Y%m%d)
```

### 2단계: 파일 덮어쓰기
압축 파일 내 `src/` 와 `app/` 디렉토리를 그대로 프로젝트 루트에 복사하면 됨.

| 경로 | 처리 | 설명 |
|---|---|---|
| `src/db/schema.ts` | **덮어쓰기** | SCHEMA_VERSION=2, RATING_ITEMS 추가 |
| `src/db/database.ts` | **덮어쓰기** | 마이그레이션 + 뱃지/알림 시작 훅 |
| `src/db/events.ts` | **덮어쓰기** | wishlist, ticketOpenAt 지원 |
| `src/db/tickets.ts` | **덮어쓰기** | detailedRatings, price + 뱃지 트리거 |
| `src/db/badges.ts` | **신규** | 뱃지 DB 헬퍼 |
| `src/db/stats.ts` | **신규** | 리포트 쿼리 |
| `src/types/index.ts` | **덮어쓰기** | 새 필드 |
| `src/services/badgeChecker.ts` | **신규** | 30개 뱃지 정의 + 자동 체크 |
| `src/services/eventNotifications.ts` | **신규** | D-day/티켓오픈 알림 |
| `src/components/DetailedRating.tsx` | **신규** | 항목별 별점 UI |
| `src/components/BadgeCard.tsx` | **신규** | 뱃지 카드 |
| `app/badges.tsx` | **신규** | 내 뱃지 화면 |
| `app/report.tsx` | **신규** | 관극 리포트 화면 |
| `app/event/[id].tsx` | **덮어쓰기** | 위시리스트 버튼 + 티켓오픈일 + 네이버 검색 |
| `app/ticket/[id].tsx` | **덮어쓰기** | 항목별 별점 + 가격 |
| `app/(tabs)/index.tsx` | **덮어쓰기** | 리포트/뱃지 바로가기 + 위시리스트 섹션 |
| `app/(tabs)/calendar.tsx` | **덮어쓰기** | 위시리스트 마커(💖) |

### 3단계: 설정 화면에 뱃지/리포트 메뉴 추가 (수동 1줄)

`app/settings/index.tsx` 에서 라인 258 근처 `<SectionLabel>ℹ️ 정보</SectionLabel>` **바로 위에** 다음 블록 추가:

```tsx
{/* ─── 나의 기록 ─────────────────────────── */}
<SectionLabel>🏆 나의 기록</SectionLabel>
<Row icon="📊" label="관극 리포트" sub="연도별 통계·지출·최애"
     onPress={() => router.push('/report')} />
<Row icon="🏆" label="내 뱃지" sub="30개 업적 확인"
     onPress={() => router.push('/badges')} />

{/* ─── 정보 ─────────────────────────────────────── */}
<SectionLabel>ℹ️ 정보</SectionLabel>
```

### 4단계: 빌드 & 실행

```bash
# 네이티브 재빌드 (필요 시)
npx expo prebuild --clean
cd ios && pod install && cd ..

# Metro 실행
npx expo start --clear

# Xcode 에서 "mygong" 스킴으로 실제 아이폰에 빌드
```

---

## ✨ 첫 실행 시 자동으로 일어나는 일

1. **스키마 v2 마이그레이션**: `events`에 `is_wishlisted`/`ticket_open_at` 컬럼 추가, `tickets`에 `ratings_json`/`price` 추가, `badges` 테이블 생성. 기존 데이터는 그대로 유지.
2. **뱃지 소급 적용**: 기존 티켓을 기반으로 조건 충족하는 뱃지 자동 unlock. (예: 권진아 꽃밭콘서트 티켓이 있으면 "첫 티켓", "첫 콘서트", "콘서트 마니아 진행 중" 등)
3. **알림 권한 요청**: 다가오는 공연이 있으면 처음으로 알림 허용 팝업이 뜸. 허용하면 D-day/티켓 오픈 알림 자동 예약.

---

## 🎯 기능별 사용법

### 위시리스트
- 공연 상세에서 우측 상단의 🤍 아이콘 탭 → 💖로 변함
- 홈화면에 "💖 위시리스트 N건" 섹션이 보임
- 캘린더의 해당 날짜에 💖 표시

### 세부 별점
- 티켓 수정 화면에서 "항목별 평가" 섹션에서 설정
- 카테고리에 따라 4개 항목이 자동으로 달라짐 (콘서트=음향/무대/좌석/세트리스트)
- 별점 5 → 5점, 같은 별점 누르면 0점으로 취소

### 관극 리포트
- 홈 → 📊 관극 리포트 카드 탭 (또는 설정에서도 진입)
- 연도별 총관람 수, 카테고리 분포, 월별 차트, 최애 아티스트, 지출 확인

### 뱃지
- 홈 → 🏆 내 뱃지 카드 탭
- 30개 뱃지 표시 (획득한 것 + 잠금 상태)
- 티켓 추가할 때마다 자동 체크 → 알림으로 표시됨

### 티켓 오픈 알림
- 공연 상세 → "네이버에서 티켓 오픈일 확인" 버튼으로 검색
- 수정 화면에서 "티켓 오픈일" 필드에 `2026-04-15 14:00` 형식으로 입력
- 자동으로 1일 전 + 1시간 전 알림 예약됨

### D-day 알림
- 공연이 등록되면 자동으로 D-7(오전 10시), D-1(오후 8시), 당일(오전 9시) 푸시 예약
- `notifyEnabled = false` 인 이벤트는 제외

---

## 🧪 테스트 체크리스트

- [ ] 앱 실행 → 첫 로그에 `[DB] Migrating to v2...` 확인
- [ ] 기존 티켓 (권진아 등) 그대로 있는지 확인
- [ ] 홈화면 상단에 📊 관극 리포트 / 🏆 내 뱃지 카드 보임
- [ ] 뱃지 화면 → "첫 티켓", "첫 콘서트" 자동 획득됨
- [ ] 공연 상세에서 🤍 → 💖 토글 동작
- [ ] 홈화면에 "💖 위시리스트 N건" 섹션 보임
- [ ] 캘린더에서 위시리스트 날짜에 💖 마커 보임
- [ ] 티켓 수정 → "항목별 평가" 입력 후 저장 → 상세에서 표시됨
- [ ] 가격 입력 후 저장 → 상세와 리포트에 반영
- [ ] 리포트 → 연도 선택 / 카테고리 바 / 월별 차트 동작
- [ ] 공연 수정에서 "티켓 오픈일" 입력 후 저장 → 콘솔에 `[notif] scheduled N notifications` 로그

---

## ⚠️ 트러블슈팅

### "duplicate column" 에러 로그
→ **정상**. 마이그레이션이 이미 적용되면 무시됨 (데이터 영향 X).

### 알림이 안 뜸
- iOS 설정 > 내공연 > 알림 활성화 확인
- 앱 완전 종료 후 재실행 (시작 시 스케줄링)
- 콘솔 `[notif] scheduled N notifications` 로그 확인

### 뱃지가 안 뜸
- `[DB] Unlocked N badges on startup` 로그 확인
- 티켓을 한 번 수정(저장) 해보면 재체크 됨

### 빌드 에러
```bash
rm -rf node_modules ios/Pods
npm install
cd ios && pod install && cd ..
npx expo prebuild --clean
```
