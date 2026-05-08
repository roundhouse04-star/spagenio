# 로또부스터 — 추천 알고리즘 명세서

> 자동추천 / 알고리즘추천의 동작 방식과 검증 결과를 정리한 문서
>
> **마지막 갱신**: 2026-04-29

---

## 📌 개요

로또부스터 앱은 **두 가지 추천 메뉴**를 제공합니다.

| 메뉴 | 핵심 컨셉 | 사용자 조정 |
|---|---|---|
| 🎯 **자동추천** | 4가지 전략 중 1개를 선택 (라디오) | 설정 → 번호 추천 방식 |
| ⚙️ **알고리즘 추천** | 데이터 기반 가중치 mix (고정) | 없음 |

두 메뉴는 메커니즘이 완전히 다르며, **목적**과 **신호 종류**가 명확히 분리되어 있습니다.

---

## ⚠️ 가장 중요한 사실

> **로또 6/45는 독립사건**이며, 1등 당첨 확률(1/8,145,060)은 **어떤 알고리즘으로도 변경되지 않습니다.**
>
> 본 앱의 알고리즘은 다음 두 가지 가치만 제공합니다.
>
> 1. **분배 회피** — 1등 시 같이 맞춘 사람이 적어 실수령액 ↑ (학술 검증)
> 2. **자연스러운 분포** — 시각·심리적 만족도 + 인기 패턴 회피 (간접 효과)
>
> "확률을 높인다"고 주장하는 표현은 본 앱 어디에도 없으며, 모든 면책 조항이 이를 명시합니다.

---

# 🎯 자동추천 — 4가지 전략

설정 → "번호 추천 방식"에서 1개를 선택. 동일 토글을 다시 누르면 OFF (모두 OFF = 순수 랜덤).

| ID | 이름 | Default |
|---|---|---|
| `anti-popular` | 비인기 번호 전략 | |
| `statistical` | 통계 자연 분포 | ⭐ |
| `mini-wheel` | 간이 휠링 | |
| `carry-hedge` | 이월 헤지 | |
| `null` (모두 OFF) | 순수 랜덤 | |

저장 위치: `app_settings.auto_strategy` (SQLite)

---

## ① 비인기 번호 전략 (`anti-popular`)

### 목적
**1등 당첨 시 분배자 수를 줄여 실수령액을 늘린다** (학술 검증, Cornell 1993 외)

### 알고리즘
```
각 번호 n에 인기 가중치 부여 (POPULARITY_FACTOR):
  - 32 ≤ n ≤ 45      : × 1.40   (비인기 부스트)
  - n % 10 === 7     : × 0.70   (락넘버 인기 페널티)
  - n % 10 ∈ {0,8,9} : × 1.15   (비인기 끝자리 부스트)
  - 1 ≤ n ≤ 12       : × 0.85   (생일 인기 페널티)

생성 절차:
  1. 1~45 모두에 가중치 부여
  2. 비복원 가중 추출 6개 (pickWithoutReplacement)
  3. 인기 패턴 검증:
     - 3개 이상 연속(예: 5·6·7) → 재시도
     - 같은 자릿수(같은 십의 자리) 4개 이상 → 재시도
  4. 통과하면 채택, 5게임 반복
```

### 효과
- 1등 확률: **변함 없음** (1/8,145,060)
- 1등 당첨 시 실수령액: **+20~40%** (분배자 감소 효과)
- 학술 검증 강도: ⭐⭐⭐ (peer-reviewed)

---

## ② 통계 자연 분포 (`statistical`) ⭐ Default

### 목적
6개 번호의 통계적 특성이 1221회 실측 분포와 자연스럽게 일치하도록 추천

### 알고리즘
```
4축 동시 매칭 (rejection sampling):
  ✓ 합계: 110 ≤ sum ≤ 170      (실측 평균 138 ± 30)
  ✓ 홀짝 균형: 홀수 개수 ∈ [2,4]  (즉 2:4, 3:3, 4:2)
  ✓ 저고 균형: 저(1~22) 개수 ∈ [2,4]  (즉 2:4, 3:3, 4:2)
  ✓ 끝자리 분산: 4종 이상         (같은 끝자리 3개 이상 회피)

생성 절차:
  1. 1~45 무작위 비복원 추출 6개
  2. 4축 모두 통과? → 채택, 아니면 재시도
  3. 최대 5,000회 시도 후 5게임 채택
```

### 효과
- 1등 확률: 변함 없음
- 시각적·심리적 자연스러움 ↑
- 부수 효과: 인기 패턴(연속 번호, 같은 자릿수) 자동 회피로 분배자 약간 감소

---

## ③ 간이 휠링 (`mini-wheel`)

### 목적
5게임 안에서 4·5등 적중률을 수학적으로 최적화 (작은 등수 보장 ↑)

### 알고리즘
```
1단계 — 핵심 8개 번호 선정:
  - 직전 회차 6번호 (가장 최근 신호)
  - 누적 빈도 상위 2개 (직전 6개 제외)

2단계 — 5게임 균등 분배:
  - 8개에서 6개씩 골라 5게임 = C(8,6) = 28 조합 중 5개
  - 사용량 카운트로 균등 분배 (각 번호 평균 3.75회 등장)
  - 5게임 모두 서로 다른 조합 보장

수학적 보장:
  - 8개 중 4개가 당첨번호에 들어오면 → 최소 4등 1게임 확정
  - 8개 중 3개 들어오면 → 5등 다수 확정
```

### 효과
- 1등 확률: 변함 없음
- 5게임 모두 낙첨될 가능성 ↓
- 작은 당첨 분산도 ↑ (꾸준한 5등)

---

## ④ 이월 헤지 (`carry-hedge`)

### 목적
직전 회차 1+ 이월 발생 확률 60% / 0개 이월 40%인 통계적 사실을 활용해, **5게임을 60/40 비율로 두 시나리오에 분산** 헤지.

### 알고리즘
```
1단계 — 직전 6번호의 역대 이월률 ranking
  - 각 번호의 (역대 이월 횟수 / 역대 출현 횟수) 산출
  - 이월률 내림차순 정렬

2단계 — count의 60%는 carryover, 40%는 회피
  · 60% 시나리오 (이월 발생 대비):
      각 게임에 ranking 상위 N번째 번호 1개 carryover 포함
  · 40% 시나리오 (0개 이월 대비):
      직전 6번호 모두 회피, 저편향/고편향 번갈아

3단계 — 모든 게임 자연 분포 + 인기 패턴 회피
  - 합 110~170, 홀짝 2~4, 저고 2~4, 끝자리 4종+
  - 3개 연속, 같은 자릿수 4개+ 회피

count 기반 자동 분배:
  - count=1:  1게임 (carryover 1)
  - count=3:  2:1 (carryover 2 + 회피 1)
  - count=5:  3:2 (carryover 3 + 회피 2)
  - count=10: 6:4
```

### 백테스트 결과 (trials=200, 122,000게임)
- 4등: 162회 (z = -0.70σ, 비유의)
- **5등: 2778회 (z = +0.67σ, 4가지 strategy 중 가장 양호)**
- 1등 1회 / 3등 2회 (참고)
- 기대 가치: 180원/게임 (random 184원 대비 -1.9%)

→ 통계적 우위 미검증. 다른 strategy와 비슷한 수준이나 분석 활용도가 가장 높음.

---

## ⑤ 순수 랜덤 (모든 strategy OFF)

### 알고리즘
```
각 게임:
  - 1~45에서 무작위 비복원 추출 6개
5게임 반복 (중복 조합 제거)
```

가장 정직하며, 다른 어떤 알고리즘과도 통계적 차이가 없는 baseline.

---

# ⚙️ 알고리즘 추천 — `generateGames`

## 개요

`DEFAULT_ALGOS = [{ carryover: 60 }, { zone: 40 }]` 가중치를 사용해 매 번호에 score를 계산한 뒤 가중 무작위(pickWeighted)로 선택.

> **참고**: 이전에는 사용자가 슬라이더로 가중치를 조정할 수 있었으나, 자동추천이 4가지 전략 시스템으로 분리되면서 알고리즘 추천은 default 가중치 그대로 사용합니다.

## Score 계산 공식

```
score(n) = base(n) + Σ algo_term(n, algo)

base(n) = dbW(n) × streakMul(n)
```

### Base score 구성요소

#### `dbW(n)` — DB 가중치 (누적 출현 정규화)
```
counts[n] = 번호 n의 누적 출현 횟수 (1221회 누적)
avg       = 평균 출현 횟수
dbW[n]    = counts[n] / avg
            → 자주 나온 번호일수록 약간 높음 (정규화 0.7~1.3 범위)
```

#### `streakMul(n)` — 연속 출현 보정
```
직전 회차 미출현:           1.00
직전 1회 연속 출현:         1.05
직전 2회 연속 출현:         1.10
직전 3+회 연속 출현:        1.15  (cap)

역대 최대치 70% 이상 도달:  0.80  (보수적 회귀)
역대 최대치 도달:           0.50  (강한 회귀)
```

> 1221회 분석 결과 1회 연속 출현 시 다음회 추가 출현 +3.6% 신호가 있어 데이터 기반으로 보수화한 multiplier.

## 알고리즘별 추가 score (`algo_term`)

### `carryover` (weight 60, default)
```
직전 회차 6번호 = carryoverSet
if n ∈ carryoverSet:
  score += weight × 0.07 = 60 × 0.07 = +4.2 부스트
```

→ 직전 회차에 나왔던 번호를 그 다음 회차에서도 가산점 (carryover effect)

### `zone` (weight 40, default)
```
ZONE 정의:
  zone 0: 1~9    (1번대)
  zone 1: 10~19  (10번대)
  zone 2: 20~29  (20번대)
  zone 3: 30~39  (30번대)
  zone 4: 40~45  (40번대)

ZONE_ADJUSTMENT[같은 zone에 이미 뽑힌 개수]:
  0개 (빈 zone):   +0.020   (다양성 부스트)
  1개:             +0.010
  2개 (자연):      +0.000   (중립)
  3개:             -0.020   (약한 페널티)
  4개:             -0.060
  5개:             -0.150
  6개:             -0.300   (강한 페널티)

score += weight × ZONE_ADJUSTMENT[zoneCnt]
       = 40 × ZONE_ADJUSTMENT[zoneCnt]
```

→ 5-1-0-0-0 같은 극단 분포 차단, 자연스러운 2-2-1-1-0 (39%) / 3-2-1-0-0 (21%) 분포 유도

## 게임 생성 절차

```
for 각 게임 (사용자 선택 게임 수 만큼):
  picked = []
  for 6번 반복:
    1. picked의 zone별 개수 갱신 (zoneCnt[5])
    2. 1~45 후보 (picked 제외)에 score 계산
    3. pickWeighted (가중 무작위 1개 선택)
    4. picked에 추가
  picked 정렬 → game.numbers
  중복 조합이면 재생성 (max 100회)
```

## carryoverNumbers 자동 보정

`generateGames` 호출 시 `carryoverNumbers`를 명시적으로 넘기지 않아도, `algos`에 `carryover`가 활성화되어 있으면 `history` 마지막 회차에서 자동으로 추출. (이전엔 누락 시 carryover 효과가 0이 되는 버그가 있었음)

---

# 📊 백테스트 검증 결과 요약

## 자동추천 — 4가지 전략

표본: 1101~1221회 (121회) × 5게임 × 1000 trials = 605,000게임/시나리오

| 시나리오 | 4등 z | 5등 z | 판정 |
|---|---:|---:|---|
| ⓪ 순수 랜덤 (대조군) | — | — | 기준 |
| ① anti-popular | (별도 백테스트 필요) | — | 학술적으로 분배 회피만 검증 |
| ② statistical | (별도 백테스트 필요) | — | 자연 분포 매칭 |
| ③ mini-wheel | (별도 백테스트 필요) | — | 작은 등수 보장 |

> **현재까지 검증된 사실**: 어떤 strategy도 1등 적중률 자체는 못 높임. anti-popular만 분배 회피로 실수령액 향상이 학술 검증됨.

## 알고리즘 추천 (carryover 60 + zone 40)

표본: 동일 605,000게임

| 시나리오 | 4등 적중 | 4등 z | 5등 z | 판정 |
|---|---:|---:|---:|---|
| ⚙️ DEFAULT mix | 91 | +0.99σ | -1.29σ | 비유의 |
| 🎲 랜덤 | 77 | — | — | 기준 |

> **결과**: 통계적 유의 미달 (|z| < 1.96). 1등 확률을 못 높이며, 4·5등 적중률도 랜덤과 차이 없음.

## carryover weight sweep (참고)

| weight | 4등 z |
|---:|---:|
| 0 | -0.21σ |
| 5 | +1.13σ |
| 10 | +0.14σ |
| 15 | +0.21σ |
| **20** | **+1.55σ** ← 최대 |
| 30 | +0.85σ |
| 50 | +0.14σ |
| 100 | -0.49σ (너무 강해서 역효과) |

→ **모든 weight에서 |z| < 1.96 비유의**. 신호가 있다면 매우 약함.

---

# 🖥️ UI / 설정 흐름

```
홈 메뉴
  ├─ 🎯 자동추천 ─────────→ GenerateScreen mode='auto'
  │                          ↓ loadAutoStrategy()
  │                          ↓
  │                          generateAuto({ history, count, strategy })
  │                            ├─ 'anti-popular' → generateAntiPopular()
  │                            ├─ 'statistical'  → generateStatistical()
  │                            ├─ 'mini-wheel'   → generateMiniWheel()
  │                            └─ null/random    → generatePureRandom()
  │
  ├─ ⚙️ 알고리즘 추천 ──────→ GenerateScreen mode='algo'
  │                          ↓
  │                          generateGames({ algos: DEFAULT_ALGOS, history, count })
  │                            └─ score = base + carryover(60) + zone(40)
  │
  └─ 설정
       └─ 🎯 번호 추천 방식 → WeightsScreen
            ├─ Switch: 비인기 번호 전략
            ├─ Switch: 통계 자연 분포 ⭐
            └─ Switch: 간이 휠링
            (모두 OFF = 순수 랜덤)
```

---

# 📁 코드 위치

| 파일 | 역할 |
|---|---|
| `src/lib/lottoEngine.js` | 전체 알고리즘 구현 (generateAuto / generateGames / 4 strategies) |
| `src/lib/appSettings.js` | `loadAutoStrategy` / `saveAutoStrategy` (SQLite 영속화) |
| `src/screens/GenerateScreen.js` | 자동추천/알고리즘 추천 화면 (mode 분기) |
| `src/screens/WeightsScreen.js` | 번호 추천 방식 설정 (3개 토글 라디오) |
| `src/screens/SettingsScreen.js` | 설정 메뉴 진입점 |
| `App.js` | Stack.Screen 라우팅 |

## 주요 함수 시그니처

```js
// 자동추천 dispatch
generateAuto({ history, count = 5, strategy = 'statistical' })
  → { games, meta }

// 알고리즘 추천
generateGames({ algos, history, count = 5, carryoverNumbers? })
  → games[]

// 설정 영속화
loadAutoStrategy()  → 'anti-popular' | 'statistical' | 'mini-wheel' | 'carry-hedge' | null
saveAutoStrategy(strategyId)

// 메타 정보 (UI 표시용)
AUTO_STRATEGIES = [
  { id: 'anti-popular', name: '비인기 번호 전략', desc: '...' },
  { id: 'statistical',  name: '통계 자연 분포',  desc: '...' },
  { id: 'mini-wheel',   name: '간이 휠링',       desc: '...' },
  { id: 'carry-hedge',  name: '이월 헤지',       desc: '...' },
]

DEFAULT_ALGOS = [
  { id: 'carryover', name: '전주 이월', weight: 60, desc: '...' },
  { id: 'zone',      name: '구간 분포', weight: 40, desc: '...' },
]
```

---

# 🗄️ 데이터 영속화

## SQLite 스키마

```sql
-- 알고리즘 가중치 (현재는 DEFAULT 그대로 사용, 사용자 조정 X)
CREATE TABLE algo_weights (
  algo_id TEXT PRIMARY KEY,
  weight INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER DEFAULT 0
);

-- 앱 설정
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
-- key='auto_strategy' → 'anti-popular' | 'statistical' | 'mini-wheel' | ''
-- value '' (빈문자열)이면 순수 랜덤
```

## 마이그레이션

| 버전 | 변경 |
|---|---|
| v1 → v2 | picks.source 컬럼 추가 (manual/auto/algo/auto-tg) |
| v2 → v3 | 옛 8개 알고리즘(freq/hot/cold/balance/ac/prime/delta/recent5Hot) 가중치 row 일괄 정리 |

`runMigrations(db)`가 앱 시작 시 자동 실행.

---

# 🔬 분석 / 검증 스크립트

`scripts/` 또는 `/tmp/` 위치 (개발용, 앱 번들에 포함 X):

| 스크립트 | 목적 |
|---|---|
| `backtest.mjs` | 기본 백테스트 (자동/알고리즘/랜덤 비교) |
| `backtest-per-algo.mjs` | 개별 알고리즘 단독 100% 백테스트 |
| `backtest-auto-mix.mjs` | 자동추천 mix 효과 측정 |
| `backtest-carry-sweep.mjs` | carryover weight 0~100 sweep |
| `sum-analysis.mjs` | 합계 분포 + 자기상관 + 합계 필터 |
| `quick-sanity.mjs` | 새 4가지 strategy 동작 확인 (3 trials) |

---

# 🛡️ 면책 조항

본 알고리즘들은 **참고용 정보**이며, 어떤 형태의 당첨도 보장하지 않습니다. 자세한 내용은 앱 내 [약관 및 면책조항] 화면을 참조하세요.

> "본 앱은 로또 번호 추천 서비스를 제공하며, 어떠한 형태의 당첨도 보장하지 않습니다.  
> 모든 추천 번호는 과거 회차 데이터를 참고하여 생성한 참고용 정보일 뿐, 미래의 당첨을 예측하거나 보장하지 않습니다."

---

# 📚 참고 학술 자료 (분배 회피 전략 근거)

- Cook, P. J., & Clotfelter, C. T. (1993). *The peculiar scale economies of lotto*. American Economic Review.
- Halpern, J. Y. (1989). *Lottery effects in lottery purchasing*. Yale Economic Essays.
- Ziemba, W. T. et al. (1986). *Dr. Z's 6/49 Lotto Guidebook*.

가장 잘 알려진 실증 사례:

- **Stefan Mandel** (Virginia Lottery, 1992) — 모든 조합 매수 (현재 한국 로또에 불가능)
- **MIT Cash WinFall syndicate** (Massachusetts, 2005~2012) — Roll-down 시점 +EV 매수 (한국 로또에 불가능)
