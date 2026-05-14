# 🔒 지하철 노선도 데이터 — 수정 금지

## ⚠️ 중요: `transit.json` 을 직접 수정하지 마세요

`src/data/transit.json` 은 **35개 도시 / 285 라인 / 5,092 역 / 11,071 connections** 의 정합성이 검증된 상태입니다. 1.1 출시 직전 OSM 크롤링 + 정합성 복구 (e6fc0f39) 를 거쳐서 안정화된 데이터예요.

직접 수정하면 다음 문제가 발생할 수 있습니다:
- 라인-역 매핑 (stationLines) 깨짐 → 화면에서 라인 클릭 시 빈 화면
- connections 끊김 → 경로 검색 (Dijkstra) 실패
- stationOrder 불일치 → 역 정렬 어긋남

## 📦 안정 백업

| 파일 | 용도 |
|---|---|
| `transit.json` | 실제 사용 파일 (수정 금지) |
| `transit.json.v1.1-stable` | **잠금 백업** — 1.1 출시 시점 검증된 데이터 |

## 🔍 무결성 검증

코드 변경 후 데이터가 실수로 바뀌지 않았는지 확인:

```bash
cd scripts/transit
npx tsx verify-integrity.ts
```

기대 결과:
```
✅ transit.json == transit.json.v1.1-stable (MD5 일치)
✅ 도시: 35, 라인: 285, 역: 5,092, connections: 11,071
✅ 고립역: 0, 중복 stationLines: 0, 빈 라인: 0
```

하나라도 ❌ 가 뜨면 `transit.json` 이 손상된 것 → `transit.json.v1.1-stable` 에서 복원.

## 🚨 데이터를 진짜 수정해야 할 때 (1.2+)

OSM 재크롤이나 수동 데이터 추가가 필요하면:

1. **반드시 새 백업 먼저**:
   ```bash
   cp src/data/transit.json src/data/transit.json.backup-$(date +%Y%m%d-%H%M).json
   ```
2. `scripts/transit/cities/` 에서 도시별 데이터 수정
3. `scripts/transit/merge.ts` 로 통합 빌드
4. `scripts/transit/fix-station-lines.ts` 로 정합성 검증/복구
5. `verify-integrity.ts` 실행 → 새 v1.x-stable 백업 갱신

## 📅 최종 안정화

- **날짜**: 2026-05-14
- **버전**: 1.1
- **커밋**: e6fc0f39 (fix: PRO OCR 문구 제거 + 지하철 데이터 정합성 복구)
- **MD5**: `c01435f33aa470593478886d4e2faaa6`
