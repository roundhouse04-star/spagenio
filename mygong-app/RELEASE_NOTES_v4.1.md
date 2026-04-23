# v4.1 — Cloudflare Worker 프록시로 전환

## 한 줄 요약
KOPIS API 키를 앱 소스·기기 저장소에서 **완전히 제거**하고, Cloudflare Worker 에서만 관리하도록 구조 변경. 앱스토어 배포 시 키 노출 위험 제거 + 사용자가 키 발급받을 필요 없음.

## 핵심 변경

### 1. 아키텍처 변경

**Before (v4.0)**
```
[iPhone 앱]
   ↓ (사용자가 등록한 키 + 직접 호출)
[KOPIS API]
```
문제: 키가 앱 소스·SQLite 에 저장됨 → 앱스토어 배포 시 누구나 추출 가능

**After (v4.1)**
```
[iPhone 앱]  →  [mygong-api Cloudflare Worker]  →  [KOPIS API]
                       ↑
                 Secret: KOPIS_API_KEY
                 (Worker 에서만 접근 가능)
```
- 앱 소스에는 Worker URL 만 있음 (공개돼도 안전)
- 키는 Cloudflare 대시보드에서만 관리

### 2. 파일 변경 요약

**신규**
- `src/config/api.ts` — Worker URL 상수 (`MYGONG_API_KOPIS_LIST`, `MYGONG_API_KOPIS_DETAIL`)

**수정**
- `src/services/providers/kopisProvider.ts`
  - `getMeta(META_KEYS.KOPIS_API_KEY)` 호출 제거
  - `service=${apiKey}` 쿼리 파라미터 제거 (Worker 가 주입)
  - fetch URL: `http://www.kopis.or.kr/...` → `https://mygong-api.roundhouse04.workers.dev/...`
  - `hasKopisKey()` 는 호환성 위해 남겨둠 (항상 `true` 반환, `@deprecated`)
- `src/db/app-meta.ts`
  - `META_KEYS.KOPIS_API_KEY` 상수 제거
  - `getMeta`/`setMeta`/`deleteMeta` 함수는 유지 (다른 용도로 재사용 가능)

**제거됨 (자연히)**
- 설정 화면의 "외부 데이터 소스 > KOPIS API 키" 입력 모달 — 이 zip 의 `app/settings/index.tsx` 에는 원래 없음

### 3. Worker 구조

**베이스 URL**: `https://mygong-api.roundhouse04.workers.dev`

**엔드포인트**
| Path | 용도 | KOPIS 대응 |
|------|------|-----------|
| `GET /` | 헬스체크 | - |
| `GET /performances?...` | 공연 목록 | `pblprfr` |
| `GET /performance/{mt20id}` | 공연 상세 | `pblprfr/{mt20id}` |

**Worker Secret**: `KOPIS_API_KEY` (Cloudflare 대시보드에서만 관리)

### 4. 보안 · 운영 개선

- 키가 앱 바이너리에 없음 → APK/IPA 리버스 엔지니어링해도 노출 안 됨
- 키가 SQLite 에도 없음 → 기기 탈취·백업 복원 시에도 노출 안 됨
- Cloudflare 쪽에서 rate limit, 캐싱, 모니터링 추가 가능
- HTTPS 고정 → iOS `NSAppTransportSecurity` 예외 불필요

### 5. 호환성

- **기존 설치된 앱 사용자**: 재빌드/재설치 필요. SQLite 에 남은 이전 키는 자동으로 무시되며 해가 없음.
- **onboarding**: KOPIS 키 등록 단계 자체가 없어짐 → 온보딩 바로 통과
- **`hasKopisKey()` 호출부**: 그대로 동작 (항상 `true`)

## TODO (다음 버전)

1. ~~`parseData.ts` 의 `fetchEventsForArtist()` 연결~~ ✅ **완료 (v4.1)**
2. Worker 에 간단한 rate limit 추가 (IP 당 분당 60회 등)
3. Worker 에 KV 캐시 추가 (KOPIS 응답 1시간 캐싱 → 호출량 감소)
4. 중복 제거 로직 정교화 (현재 날짜+제목 20자 기준, false positive 가능성)

## parseData 연결 (v4.1 추가)

**변경**: `src/services/parseData.ts::fetchEventsForArtist()` 가 빈 배열 스텁 → 실제 구현으로 교체.

**동작**:
1. `artistExternalId` 에서 Wikipedia pageId 추출 (`wiki:1234` 형식)
2. `Promise.allSettled` 로 두 provider 병렬 호출
   - `fetchWikipediaEvents(pageId, artistName)` — 위키 본문 콘서트 섹션
   - `searchKopisEvents(artistName, artistTag)` — KOPIS 공연 DB (Worker 경유)
3. 각 raw → `Event` input 변환
   - Wikipedia: `externalId = 'wiki:{pageId}:{slug}:{date}'` 로 안정적 ID 생성
   - KOPIS: `externalId = 'kopis:{mt20id}'` (kopisToEventInput 그대로)
4. 중복 병합: 같은 날짜 + 유사 제목이면 KOPIS 우선
5. `syncManager` 가 받아서 events 테이블에 upsert + D-30 이내면 알림 생성

**syncManager 시그니처 변경**: `fetchEventsForArtist(externalId, name, tag)` 로 `tag` 추가 파라미터. KOPIS 가 `tag` 로 장르 코드 필터링.

## Cloudflare Worker 코드 (참고)

Worker 에 배포된 코드는 `/performances` 와 `/performance/{id}` 엔드포인트를 통해
KOPIS API 를 프록시하며, `KOPIS_API_KEY` Secret 을 자동 주입한다.
세부 코드는 Cloudflare 대시보드 > Workers > mygong-api > Edit code 에서 확인 가능.
