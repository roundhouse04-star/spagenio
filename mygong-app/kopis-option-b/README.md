# 🔥 옵션 B: 장르별 전수 조회 + 출연진 필터링

## 📊 목표
- 권진아: **17개 → ~33개**
- 모든 아티스트: 빠짐없는 검색

## ⚡ Trade-off
- **속도**: 2-3배 느림 (40초 → 90-120초)
- **정확도**: 💯 (KOPIS에 있는 모든 공연 검색)

---

## 🔧 작동 방식

### 3단계 전략

**1단계: 공연명 검색** (기존 방식)
```
shprfnm=권진아 → 17개
```

**2단계: 장르별 전수 조회** (새로 추가!)
```
가수 → CCCA (대중음악) 전체 조회
뮤지컬 배우 → GGGA (뮤지컬) 전체 조회
연극 배우 → AAAA (연극) 전체 조회
```

**3단계: 출연진 필터링**
```
각 공연의 prfcast(출연진)에 "권진아" 포함 여부 확인
공연명에 이미 포함된 경우 상세 조회 생략 (최적화)
```

---

## 📝 예상 로그

```log
[kopis] 권진아 mode=full range=20100101~20270424 chunks=204 aliases=[]
[kopis] genre search enabled for tag="가수" genres=[CCCA]
[kopis] fetched 2847 raw → 1234 after dedup (removed 1613 duplicates)
[kopis] 1234 → 33 after cast verification
[fetchEvents] 권진아: kopis=33 (mode=full)
```

**설명:**
- `2847 raw`: 공연명 검색(17) + 대중음악 전체(2830)
- `1234 after dedup`: 중복 제거
- `33 after cast verification`: 출연진 필터링 결과 ✅

---

## 🚀 적용 방법

```bash
cp kopisProvider.ts ~/projects/spagenio/mygong-app/src/services/providers/kopisProvider.ts
```

Metro 재시작 후 권진아 **전체 동기화** 실행.

---

## ⚠️ 주의사항

1. **속도**: 처음 동기화는 매우 느림 (2-3분)
2. **API 호출**: KOPIS API에 부하 증가
3. **장르별**: full 모드일 때만 활성화 (incremental은 빠름 유지)

---

## 🎯 최적화 포인트

- `getGenresForTag`: 아티스트 태그에 따라 필요한 장르만 검색
- `verifyCastMatchingEnhanced`: 공연명에 이미 있으면 상세 조회 생략
- `mode === 'full'` 조건: 빠른 동기화는 영향 없음

---

## 🔄 롤백 방법

옵션 A로 되돌리려면:
```bash
# ENABLE_CAST_MATCHING = false만 유지하고
# 장르 검색 로직 제거
```
