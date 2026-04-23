# 🚇 Spagenio Transit Crawler

OSM Overpass API를 사용해 6개 도시 지하철 데이터를 가져와서
`src/data/transit.json`에 병합하는 스크립트.

## 📍 대상 도시

| 도시 | OSM area | 노선 |
|---|---|---|
| 부산 | 부산광역시 | 1~4호선, 김해경전철, 동해선 |
| 후쿠오카 | 福岡市 | 공항선, 하코자키선, 나나쿠마선 |
| 교토 | 京都市 | 카라스마선, 도자이선 |
| 타이페이 | 臺北市 | 6개 MRT 라인 + 환위안선 |
| 상하이 | 上海市 | 1~18호선 + 푸장선 |
| 베이징 | 北京市 | 1~17호선 + 공항/야좡/시자오선 |

## 🚀 빠른 시작 (맥미니에서)

```bash
cd ~/projects/spagenio/my-trip-log/scripts/transit
npm install   # tsx, typescript 설치 (1분)

# 🔍 1단계: 도시 1개 시험 (부산 추천 - 데이터 작아서 빠름)
npm run crawl-busan
cat out/busan.json | head -40

# 🌐 2단계: 6개 다 (약 5~10분, OSM 서버 부담 줄이려고 sleep 있음)
npm run crawl-all

# 또는 일부만:
npx tsx run-all.ts busan fukuoka kyoto

# 📊 3단계: 결과 확인
npx tsx inspect.ts busan      # 부산 자세히
npx tsx inspect.ts            # 전체 통계

# 🔍 4단계: 병합 시뮬레이션 (안전 확인)
npm run merge-dry

# 💾 5단계: 실제 병합 (자동 백업 포함)
npm run merge

# 🎯 6단계: 앱에서 확인
cd ../..
npx expo start --clear
# → 도구 → 교통 → 부산 지하철 클릭
```

## 📁 디렉토리 구조

```
scripts/transit/
├── README.md
├── package.json
├── tsconfig.json
├── lib/
│   ├── osm.ts              # OSM Overpass API 클라이언트 (3개 endpoint fallback)
│   ├── schema.ts           # 출력 스키마 + 검증
│   └── crawler.ts          # 범용 도시 크롤러
├── cities/
│   ├── busan.ts
│   ├── fukuoka.ts
│   ├── kyoto.ts
│   ├── taipei.ts
│   ├── shanghai.ts
│   └── beijing.ts
├── out/                    # 크롤링 결과 (gitignore 대상)
│   ├── busan.json
│   └── ...
├── run-all.ts              # 6개 순차 실행
├── merge.ts                # transit.json에 병합 (백업 포함)
└── inspect.ts              # 데이터 확인
```

## ⚠️ 주의사항

### Overpass API 제한
- **Rate limit**: 분당 ~3 요청 권장 → 스크립트가 자동으로 sleep
- **Timeout**: 도시당 60-90초 잡혀있음 (베이징 같은 큰 도시는 오래 걸림)
- **Endpoint fallback**: 3개 미러 자동 시도 (overpass-api.de → kumi → lz4)

### 데이터 품질
- **OSM 데이터는 사용자 기여**라 노선별 역 순서가 항상 완벽하진 않음
- 환승역은 자동 마킹 (2개 이상 노선 가진 역)
- 색상이 OSM에 없으면 `defaultColors` 폴백 사용

### 노선 이름 한글화
- `name:ko` 태그 우선
- 없으면 `lineNameKo` 함수로 ref 기반 변환 (예: `1` → `1호선`)
- 없으면 OSM 영어/현지어 이름 사용

### 역 이름 한글화
- `name:ko` 태그 우선
- 없으면 현지어 그대로 (일본어/중국어 한자 노출됨)
- 향후 별도 번역 스크립트로 보강 가능

## 🔧 트러블슈팅

### `Overpass query failed after 3 retries`
- OSM 서버 일시 다운 → 잠시 후 재시도
- 또는 `lib/osm.ts`의 `OVERPASS_ENDPOINTS`에 다른 미러 추가

### 노선 0개로 나옴
- `cityName` 검색이 잘못된 area 매치
- → 해당 도시 ts에서 `cityName` / `cityNameAlt` 변경
- 디버깅: OSM 사이트에서 직접 area 검색 https://nominatim.openstreetmap.org/

### 일부 노선 누락
- OSM에 등록 안 됐거나 `route_master`로만 묶여 있을 수 있음
- → `routeTypes`에 `light_rail`, `monorail` 추가

### 일본 도시 한글 역명 없음
- OSM 일본 데이터는 `name:ko` 비율 낮음
- 향후 위키피디아 번역 스크립트로 보강 가능 (TODO)

## 🛡️ 안전 장치

- **자동 백업**: `merge.ts` 실행 시 `transit.json.backup-{timestamp}.json` 생성
- **dry-run 모드**: `npm run merge-dry`로 변경사항만 확인
- **참조 무결성 검사**: `inspect.ts`로 깨진 참조 탐지
- **도시별 격리**: 1개 도시 망가져도 다른 도시 영향 없음
- **롤백**: 백업 파일을 transit.json으로 복사하면 즉시 복구

## 📊 예상 결과 규모

| 도시 | 노선 (예상) | 역 (예상) |
|---|---|---|
| 부산 | 5~6 | ~150 |
| 후쿠오카 | 3 | ~35 |
| 교토 | 2 | ~30 |
| 타이페이 | 6~7 | ~120 |
| 상하이 | 18~19 | ~400 |
| 베이징 | 20+ | ~400 |

## 🆘 문제 시 롤백

```bash
cd ~/projects/spagenio/my-trip-log/src/data
ls transit.json.backup-*    # 백업 목록
cp transit.json.backup-2026-04-21T08-00-00.json transit.json
```
