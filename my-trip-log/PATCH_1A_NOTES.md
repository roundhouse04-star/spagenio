# 🔧 Phase 1-A 패치 (2026-04-21)

## 포함 파일 (4개)

### 1. `src/data/destinations.ts`
탐색 탭에 🇰🇷 **서울/부산 추가** (맨 앞 두 자리)
- 한국 앱에 한국 도시가 없던 황당 상황 해결
- 각 도시별 하이라이트/꿀팁/시즌/통화 전부 채움

### 2. `src/utils/receiptParser.ts`
**금액 파싱 개선** — OCR에서 2,300원이 300으로 잡히던 문제
- 공백 포함 숫자 (2 300) 처리
- "신용카드" 키워드 추가 (GS25 영수증 대응)
- 라인 단위 탐색 + 우선순위 기반 선택
- 합리적 범위 필터 (100원 이상)

### 3-4. `app/trip/[id]/receipt-scan.tsx`, `log-new.tsx`
**MediaTypeOptions deprecated 경고** 수정
```diff
- mediaTypes: ImagePicker.MediaTypeOptions.Images
+ mediaTypes: ['images']
```

## 별도 포함: `scripts/cleanup.sh`
- `.bak` / `.DS_Store` / `__MACOSX` 일괄 제거
- deploy.sh에도 있지만 별도 스크립트로 관리 용이

## 적용 후 기대 효과
- ✅ 영수증 금액이 "2,300"으로 정확히 인식
- ✅ Warning 메시지 사라짐
- ✅ 탐색 탭에 서울/부산 도시 카드 표시

## 다음 단계 (Phase 1-B)
- 다크모드 인프라 (ThemeProvider + useTheme)
- 주요 화면 3개 다크모드 적용
- Spagenio 리브랜딩 (app.json)

## 다음 단계 (Phase 1-C)
- 크롤링 스크립트 (OSM/Wikipedia)
- 6도시 자동 데이터 생성 (부산/후쿠오카/교토/타이페이/상하이/베이징)
