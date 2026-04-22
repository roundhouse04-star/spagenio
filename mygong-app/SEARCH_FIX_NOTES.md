# 검색 버그 수정 내역 (v2)

## 증상
- 연예인 검색 시 로딩 스피너도 안 뜨고 빈 화면
- 에러 메시지도 안 보임 → 어디서 실패했는지 블랙박스

## 원인 (4가지 복합)
1. **2회 fetch 체인의 불안정성**
   - 기존: `opensearch` → `query` 두 번 호출
   - Expo Go 환경에서 간헐적으로 2번째 요청이 누락
2. **title 매칭 실패**
   - `Object.values(pages).find(p => p.title === title)` 로 페이지 찾는 로직
   - 위키가 리다이렉트/정규화 하면 title 이 바뀌어서 매칭 실패 → 빈 hits 반환
3. **User-Agent 미설정**
   - 위키미디어는 UA 없으면 간헐적으로 429/빈 응답
4. **타임아웃 없음 + 로그 없음**
   - 느린 네트워크에서 무한대기, 실패해도 이유 안 보임

## 수정 내용

### src/services/searchCelebrity.ts — 전면 재작성
- `generator=search` 로 **단일 요청** 변환 (한 번에 검색 + 썸네일 + 요약)
- `formatversion=2` 로 응답 구조 안정화 (pages 가 객체 → 배열)
- `User-Agent` 와 `Api-User-Agent` 헤더 추가
- `AbortController` 로 10초 타임아웃
- 단계별 `console.log`:
  ```
  [search] start: 아이유
  [wiki] GET https://ko.wikipedia.org/w/api.php?action=query&generator=search&...
  [wiki] status=200 ok=true
  [wiki] pages count: 8
  [wiki] final: 아이유(가수), 아이유의 팔레트(?), ...
  [search] total hits: 8
  ```

### app/search/index.tsx — 디버깅 UI 추가
- 검색 상태 배너 (검색 중… / N개 결과 / 실패)
- **노란색 에러 박스** + 재시도 버튼 (항상 보이게)
- `reqSeqRef` 로 stale response 방어
- `onSubmitEditing` 폴백 (엔터키로도 검색 가능)
- `router.replace` → `router.back() + push` 패턴 (stack 꼬임 방지)

### app.json — 네트워크 권한 명시
- `android.permission.INTERNET`
- `android.permission.ACCESS_NETWORK_STATE`
- iOS `NSAppTransportSecurity` 로 wikipedia.org 명시적 허용

### 기타 (기존에 있던 TS 에러도 같이 잡음)
- `@expo-google-fonts/inter` 패키지 추가 (누락)
- `calendar.tsx` 의 `isSelected = !!(day && ...)` falsy 0 버그
- `settings/index.tsx` 의 `expo-file-system` → `expo-file-system/legacy`

## 검증 결과
```
$ npx tsc --noEmit
# 0 에러 ✅

$ npx expo export --platform web
# 번들링 정상 진행 (57% 까지 확인, 에러 없음)
```

## 설치 & 테스트
```bash
cd mygong-app
npm install
npx expo start
# Expo Go 에서 QR 스캔
```

## Metro 콘솔 로그 확인법
검색창에 "아이유" 입력 → 터미널(Metro 돌아가는 창)에 이런 로그가 차례로 나옵니다:

**정상 케이스:**
```
[search-ui] querying: 아이유 seq 1
[search] start: 아이유
[wiki] GET https://ko.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=...
[wiki] status=200 ok=true
[wiki] pages count: 10
[wiki] final: 아이유(가수), 아이유의 팔레트(?), ...
[search] total hits: 10
[search-ui] got hits: 10
```

**실패 케이스별 로그:**

| 로그가 여기서 멈추면 | 원인 |
|---|---|
| `[wiki] GET ...` 뒤로 안 나옴 | 네트워크 차단 (회사 WiFi, VPN, 프록시) |
| `[wiki] status=429` | 요청 제한 (잠시 후 재시도) |
| `[wiki] status=200 ok=true` 다음에 JSON parse failed | 프록시가 HTML 주입 |
| `[wiki] pages count: 0` | 검색어 매치 없음 (정상) |
| `타임아웃 (10초 초과)` | 네트워크 느림 |

로그 중 하나가 빠지면 그 단계가 범인. 복사해서 보내주시면 바로 잡아드릴게요.
