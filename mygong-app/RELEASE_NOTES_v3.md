# v3 — 아티스트 공연 이력 자동 수집

## 한 줄 요약
아티스트 등록 시 위키피디아 본문에서 콘서트·투어를 자동 추출하고, KOPIS 키를 등록하면 한국 공연 공식 DB 까지 함께 가져옵니다.

## 핵심 변경

### 1. 멀티 프로바이더 아키텍처
`src/services/providers/` 폴더 신설. 각 데이터 소스가 독립 모듈:
- `wikipediaProvider.ts` — 한국어 위키 본문 파싱 (키 불필요, 항상 동작)
- `kopisProvider.ts` — KOPIS 공연정보 API (키 필요, 키 없으면 자동 스킵)

`parseData.ts` 의 `fetchEventsForArtist()` 가 `Promise.allSettled` 로 둘 다 호출,
중복 제거 후 최신순 정렬해서 반환. 한 쪽이 실패해도 나머지는 살아남음.

### 2. Wikipedia 본문 파서
- `action=parse&prop=wikitext` 로 페이지 원문 가져옴
- 섹션 헤딩에서 "콘서트 / 투어 / 공연 / 라이브 / 뮤직 / 음악회 / 리사이틀 / 팬미팅 / 팬콘 / 페스티벌 / 쇼케이스 / 뮤지컬 / 연극" 키워드 매칭
- 매칭된 섹션의 wikitable 과 글머리(`*`) 모두 파싱
- 컬럼 헤더 자동 추정 (연도/날짜, 공연/제목, 장소, 도시)
- `[[link|text]]`, `<ref>...</ref>`, `'''bold'''` 같은 마크업 제거
- 날짜 포맷 4종 지원 (YYYY년 M월 D일 / YYYY.MM.DD / YYYY-MM-DD / YYYY)

### 3. KOPIS API
- 공공데이터포털 무료 키 (즉시 승인)
- 응답이 XML 이라 정규식 기반 단순 파서 (외부 라이브러리 X)
- 최근 5년 + 향후 1년 = 6개 연도 병렬 조회
- 카테고리 자동 매핑 (대중음악→콘서트, 뮤지컬→뮤지컬, 연극→연극 등)
- 공연 제목에 아티스트 이름이 들어간 것만 필터 (false positive 방지)
- 키 없으면 조용히 스킵, 401/SERVICE_KEY 오류는 명확히 안내

### 4. 설정 화면 — 외부 데이터 소스 섹션
- Wikipedia: "활성" 배지 항상 표시
- KOPIS: 키 등록 상태에 따라 "활성" / "미설정" 토글
- 키 등록된 경우 마스킹 표시 (앞 6자리 + 뒤 4자리)
- "🔑 KOPIS API 키 발급 받기" 링크 → 공공데이터포털 페이지
- 모달로 키 입력/수정/삭제

### 5. SyncManager 버그 수정
이전엔 fetch 결과의 `source` 를 `'sync-auto'` 로 덮어써서 wikipedia/kopis 출처 구분이 사라졌었음.
이제는 각 provider 의 source 를 보존하고, 청소 시 모든 자동 출처(wikipedia/kopis/sync-auto)를 함께 청소.
수동 입력 이벤트는 안전하게 보존됨.

## 사용 흐름

### 키 없이 (위키만)
1. 검색 → "아이유" 등록
2. 자동 백그라운드 sync → 위키 본문에서 콘서트 추출
3. 아티스트 상세에 공연 이력 표시

### 키 등록 후
1. 설정 → 🔌 외부 데이터 소스 → KOPIS 행 탭
2. 모달에 키 붙여넣기 → 저장
3. 다음 동기화부터 KOPIS 결과도 합쳐짐
4. 설정 → 🔄 전체 동기화 누르면 즉시 갱신

## KOPIS 키 발급 방법
1. https://www.data.go.kr/ 회원가입
2. 검색창에 "공연예술통합전산망 공연정보"
3. 결과에서 [활용신청] → 즉시 자동 승인
4. 마이페이지 → 인증키 (일반 인증키, Decoding 또는 Encoding 둘 다 가능)
5. 앱 설정 화면에 붙여넣기

## Metro 콘솔 로그 (디버깅)
공연 이력 수집 시 이런 로그가 찍힙니다:

```
[fetchEvents] start 아이유 wiki:1234
[wiki-events] fetching for pageId 1234 name 아이유
[wiki-events] wikitext length: 87654
[wiki-events] performance sections found: 3
[wiki-events] parsed events: 12
[kopis] searching for: 아이유
[kopis] GET 20210101 ~ 20211231
[kopis] GET 20220101 ~ 20221231
...
[kopis] total unique events: 8
[fetchEvents] total: 18 (wiki+kopis combined)
```

키 없을 때:
```
[kopis] no API key configured, skipping
```

## 알려진 한계

1. **Wikipedia 파싱은 페이지 형식에 의존** — 위키 편집자마다 표 형식이 달라서 100% 정확하진 않음. 자주 등장하는 패턴은 잡지만 특이 케이스는 누락 가능
2. **KOPIS 의 "출연진" 매칭** — 현재는 공연 제목 키워드 매칭만 사용. 출연진 필드 매칭은 공연 상세조회가 추가 필요해서 다음 버전에 (예: "지킬앤하이드"에 조승우 출연한 회차)
3. **스포츠 (야구/축구/농구)** — 위키도 KOPIS 도 경기 일정은 안 줘서 별도 작업 필요. 다음 단계.

## 파일 변경 요약
- 신규: `src/db/app-meta.ts`, `src/services/providers/wikipediaProvider.ts`, `src/services/providers/kopisProvider.ts`
- 수정: `src/services/parseData.ts`, `src/services/syncManager.ts`, `app/settings/index.tsx`
- TypeScript 0 에러 ✅
