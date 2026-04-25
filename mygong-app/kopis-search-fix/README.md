# KOPIS 검색 개선 패치

## 📊 현재 상황
- **KOPIS 웹사이트**: "권진아" 검색 시 **33개** 공연
- **앱**: "권진아" 검색 시 **17개** 공연

## 🔍 원인 분석

### KOPIS API 제약
- API `shprfnm` 파라미터: **공연명만** 검색
- 웹사이트: **통합 검색** (공연명 + 출연진 + 기획사)

### Cast Matching의 문제
```
[kopis] fetched 17 raw → 17 after dedup
[kopis] 17 → 17 after cast verification  ← 추가 발견 못함
```

**Cast Matching**은 이미 받은 17개를 필터링할 뿐, 새로운 공연을 찾지 못합니다.
오히려 일부를 걸러낼 수 있습니다:
```
[kopis] Aespa: 13 → 7 after cast verification  ← 6개 손실!
```

---

## ✅ 해결 방법

### **옵션 A: 빠른 수정** (추천)
**Cast Matching 끄기** 
- ✅ 속도: 그대로 (~40초)
- ✅ 결과: 17개 (현재와 동일, 손실 방지)
- 📁 파일: `kopisProvider-option-a.ts`

### **옵션 B: 정확한 검색**
**장르별 전수 조회 + 출연진 필터링**
- ⚠️ 속도: 2-3배 느림 (~90-120초)
- ✅ 결과: ~33개 (목표 달성)
- 📁 파일: 직접 구현 필요 (복잡도 높음)

**옵션 B 전략:**
1. 공연명으로 검색 (기존 방식)
2. 장르별 전수 조회 (CCCA, GGGA 등)
3. 출연진 필터링 (상세 조회로 prfcast 확인)

---

## 🚀 적용 방법

### 옵션 A 적용 (추천)

```bash
cp kopisProvider-option-a.ts ~/projects/spagenio/mygong-app/src/services/providers/kopisProvider.ts
```

### 결과 확인

앱 실행 후 권진아 전체 동기화:
```
[kopis] fetched 17 raw → 17 after dedup
[fetchEvents] 권진아: kopis=17  ← Cast Matching 로그 사라짐
```

Aespa도 손실 없이:
```
[kopis] Aespa: 13 → 13  ← 이전: 13→7 손실
```

---

## 🤔 옵션 B를 원한다면?

**trade-off 고려:**
- ⚡ 속도 vs 💯 완성도

**필요한 작업:**
1. `searchKopisEvents` 함수 전체 교체
2. `getGenresForTag` 함수 추가
3. `verifyCastMatchingEnhanced` 함수 추가
4. 테스트 및 최적화

---

## 📌 결론

**KOPIS API의 근본적인 제한** 때문에:
- 공연명 검색만으로는 33개 모두 불가능
- 완전한 해결은 장르별 전수 조회 + 출연진 필터링 필요

**추천:**
- 옵션 A 먼저 적용 (Cast Matching 끄기)
- 속도 유지하면서 손실 방지
- 필요시 옵션 B 구현
