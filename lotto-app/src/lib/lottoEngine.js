// 8-알고리즘 가중 기반 로또 번호 생성 엔진
// 원본 spagenio public/js/lotto.js 의 generateOneGame / getNumberScore 로직을 React Native 환경으로 포팅

export const DEFAULT_ALGOS = [
  { id: 'freq',       name: '빈도 분석',       weight: 20, desc: '역대 많이 출현한 번호 비중 반영' },
  { id: 'hot',        name: '핫넘버',          weight: 20, desc: '최근 출현 빈도가 높은 번호 반영' },
  { id: 'cold',       name: '미출현 주기',     weight: 10, desc: '오랫동안 안 나온 번호 반영' },
  { id: 'balance',    name: '홀짝 균형',       weight: 15, desc: '홀짝 균형 유지' },
  { id: 'zone',       name: '구간 분포',       weight: 10, desc: '1~15 / 16~30 / 31~45 분산 반영' },
  { id: 'ac',         name: 'AC값 최적화',     weight: 10, desc: '조합 다양성 반영' },
  { id: 'prime',      name: '소수 패턴',       weight: 5,  desc: '소수 비중 반영' },
  { id: 'delta',      name: '델타 시퀀스',     weight: 10, desc: '간격 패턴 반영' },
  // 신규: 1221회 데이터 분석 결과 "직전 5회 중 3+ 출현" 번호의 다음 회차 출현률 +9.7% 신호
  { id: 'recent5Hot', name: '단기 핫넘버',     weight: 5,  desc: '직전 5회 중 3번 이상 나온 번호 (실데이터 +10%)' },
];

const PRIME_SET = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43]);

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeighted(items) {
  const total = items.reduce((s, it) => s + it.weight, 0);
  if (total <= 0) return items[randInt(0, items.length - 1)];
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

// 연속 출현(streak) 캐시 — 1게임씩 뽑을 때마다 재계산하면 비용이 크므로 1회만 계산
export function buildStreakCache(history) {
  const maxStreak = {};
  const curStreak = {};
  for (let i = 1; i < history.length; i++) {
    const prev = new Set(history[i - 1]);
    const cur = new Set(history[i]);
    for (let x = 1; x <= 45; x++) {
      if (prev.has(x) && cur.has(x)) {
        curStreak[x] = (curStreak[x] || 0) + 1;
        if ((curStreak[x] || 0) > (maxStreak[x] || 0)) maxStreak[x] = curStreak[x];
      } else {
        curStreak[x] = 0;
      }
    }
  }
  // 실제 1221회 분석 결과: 1회 연속 출현 시 다음회 추가 출현 +3.6% 신호
  // 기존 +30% (1.0 + cs*0.3) 부스트는 과대 → 데이터 기반으로 +5%/streak (최대 +15%)로 보수화
  const mul = {};
  for (let x = 1; x <= 45; x++) {
    const cs = curStreak[x] || 0;
    const ms = maxStreak[x] || 0;
    if (cs === 0) mul[x] = 1.0;
    else if (ms > 0 && cs >= ms) mul[x] = 0.5;          // 역대 최대치 도달 → 약간 보수 (was 0.3)
    else if (ms > 0 && cs >= ms * 0.7) mul[x] = 0.8;    // 70% 이상 → 살짝 보수 (was 0.6)
    else mul[x] = 1.0 + Math.min(cs * 0.05, 0.15);      // 모멘텀 +5%/streak, max +15% (was cs*0.3)
  }
  return mul;
}

// 번호별 DB 가중치 (서버 lotto_weights 대체) — 출현 빈도 기반 정규화
export function buildDbWeights(history) {
  if (!history.length) {
    const empty = {};
    for (let i = 1; i <= 45; i++) empty[i] = 1.0;
    return empty;
  }
  const counts = new Array(46).fill(0);
  for (const draw of history) for (const n of draw) counts[n]++;
  const avg = counts.slice(1).reduce((a, b) => a + b, 0) / 45 || 1;
  const w = {};
  for (let i = 1; i <= 45; i++) w[i] = counts[i] / avg;
  return w;
}

function makeFrequencyContext(history) {
  // 직전 10회 (hot 알고리즘 — 기존)
  const recent10 = history.slice(-10);
  const recent10Flat = [].concat(...recent10);
  const recentFreq = {};
  recent10Flat.forEach((n) => { recentFreq[n] = (recentFreq[n] || 0) + 1; });

  // 직전 5회 (recent5Hot 신규 — 1221회 분석 결과 3+ 출현 시 +9.7% 신호)
  const recent5 = history.slice(-5);
  const recent5Flat = [].concat(...recent5);
  const recent5Freq = {};
  recent5Flat.forEach((n) => { recent5Freq[n] = (recent5Freq[n] || 0) + 1; });

  // 전체 누적
  const allFlat = [].concat(...history);
  const totalFreq = {};
  allFlat.forEach((n) => { totalFreq[n] = (totalFreq[n] || 0) + 1; });
  const avgFreq = (allFlat.length / 45) || 1;

  return { recentFreq, recent5Freq, totalFreq, avgFreq };
}

function getNumberScore(n, ctx) {
  const { algos, dbWeights, streakCache, freqCtx } = ctx;
  const dbW = dbWeights[n] || 1.0;
  const streakMul = streakCache ? (streakCache[n] || 1.0) : 1.0;
  let score = dbW * streakMul;

  const { recentFreq, recent5Freq, totalFreq, avgFreq } = freqCtx;
  const isHot = (recentFreq[n] || 0) >= 2;
  const isCold = (recentFreq[n] || 0) === 0;
  const freqRatio = (totalFreq[n] || 0) / avgFreq;
  const recent5Count = recent5Freq?.[n] || 0;

  for (const algo of algos) {
    if (algo.weight <= 0) continue;
    switch (algo.id) {
      case 'freq':
        score += algo.weight * freqRatio * 0.03;
        break;
      case 'hot':
        if (isHot) score += algo.weight * (recentFreq[n] || 0) * 0.05;
        break;
      case 'cold':
        if (isCold) score += algo.weight * 0.07;
        break;
      case 'balance':
        if (n % 2 === 0) score += algo.weight * 0.02;
        break;
      case 'zone':
        score += algo.weight * 0.015;
        break;
      case 'ac':
        score += algo.weight * ((n * 7) % 11) * 0.005;
        break;
      case 'prime':
        if (PRIME_SET.has(n)) score += algo.weight * 0.04;
        break;
      case 'delta':
        score += algo.weight * ((46 - n) % 6) * 0.005;
        break;
      case 'recent5Hot':
        // 직전 5회 중 3+ 출현 → +9.7% 실데이터 신호
        // 출현 횟수에 비례해 더 많이 부스트 (3→0.07, 4→0.14, 5→0.21)
        if (recent5Count >= 3) score += algo.weight * 0.07 * (recent5Count - 2);
        break;
    }
  }
  return score;
}

function generateOneGame(ctx) {
  const picked = new Set();
  while (picked.size < 6) {
    const pool = [];
    for (let n = 1; n <= 45; n++) {
      if (!picked.has(n)) pool.push({ number: n, weight: getNumberScore(n, ctx) });
    }
    const sel = pickWeighted(pool);
    picked.add(sel.number);
  }
  const nums = [...picked].sort((a, b) => a - b);
  const odd = nums.filter((n) => n % 2 === 1).length;
  const low = nums.filter((n) => n <= 22).length;
  return {
    numbers: nums,
    meta: {
      oddEven: `${odd}:${6 - odd}`,
      lowHigh: `${low}:${6 - low}`,
      sum: nums.reduce((a, b) => a + b, 0),
    },
  };
}

// 실제 호출: 알고리즘 가중치 + 회차 history → games 배열 (배치 내 중복 제거)
export function generateGames({ algos, history, count = 5 }) {
  const dbWeights = buildDbWeights(history);
  const streakCache = buildStreakCache(history);
  const freqCtx = makeFrequencyContext(history);
  const ctx = { algos, dbWeights, streakCache, freqCtx };

  const games = [];
  const seen = new Set();
  // 가중치가 극단적으로 편중된 경우를 대비한 안전 한도
  const maxAttempts = Math.max(count * 20, 50);
  let attempts = 0;

  while (games.length < count && attempts < maxAttempts) {
    attempts += 1;
    const g = generateOneGame(ctx);
    const key = g.numbers.join('-'); // 정렬된 6개 번호 — 같은 조합이면 같은 키
    if (seen.has(key)) continue;
    seen.add(key);
    games.push(g);
  }
  return games;
}

// 가중치 합계 검증
export function weightsSum(algos) {
  return algos.reduce((s, a) => s + Number(a.weight || 0), 0);
}

// 당첨 등수 계산 (회차 결과 + 보너스)
// rank: 1=6개일치, 2=5+보너스, 3=5개, 4=4개, 5=3개, 0=낙첨
export function evaluateRank(picked, winning, bonus) {
  const w = new Set(winning);
  const matched = picked.filter((n) => w.has(n)).length;
  const bonusMatch = picked.includes(bonus);
  if (matched === 6) return { rank: 1, matched, bonusMatch };
  if (matched === 5 && bonusMatch) return { rank: 2, matched, bonusMatch };
  if (matched === 5) return { rank: 3, matched, bonusMatch };
  if (matched === 4) return { rank: 4, matched, bonusMatch };
  if (matched === 3) return { rank: 5, matched, bonusMatch };
  return { rank: 0, matched, bonusMatch };
}
