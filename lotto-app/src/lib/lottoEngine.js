// 로또 번호 생성 엔진
// 알고리즘: carryover(전주 이월) + zone(구간 분포)
// 통계적으로 유의미한 우위는 미검증 — 사용자 참고용 가중치 시스템

export const DEFAULT_ALGOS = [
  { id: 'carryover', name: '전주 이월',  weight: 60, desc: '직전 회차 6번호 강조' },
  { id: 'zone',      name: '구간 분포',  weight: 40, desc: '같은 번호대 몰림 방지' },
];

// 번호 → zone 인덱스 (0=1번대, 1=10번대, 2=20번대, 3=30번대, 4=40번대)
function zoneOf(n) {
  if (n <= 9) return 0;
  if (n <= 19) return 1;
  if (n <= 29) return 2;
  if (n <= 39) return 3;
  return 4;
}

// zone 가중치 조정표 — 같은 zone에 N개 이미 뽑힌 상태에서 추가 후보 점수 보정
// 1221회 분석 결과 가장 흔한 패턴(2-2-1-1-0 39%, 3-2-1-0-0 21%)에 가깝게 유도
const ZONE_ADJUSTMENT = [0.020, 0.010, 0.000, -0.020, -0.060, -0.150, -0.300];

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

// 연속 출현(streak) 캐시 — base score 보정용 (알고리즘 가중치와 무관)
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
  // 1221회 분석: 1회 연속 출현 시 다음회 추가 출현 +3.6% → +5%/streak (max +15%)로 보수화
  const mul = {};
  for (let x = 1; x <= 45; x++) {
    const cs = curStreak[x] || 0;
    const ms = maxStreak[x] || 0;
    if (cs === 0) mul[x] = 1.0;
    else if (ms > 0 && cs >= ms) mul[x] = 0.5;
    else if (ms > 0 && cs >= ms * 0.7) mul[x] = 0.8;
    else mul[x] = 1.0 + Math.min(cs * 0.05, 0.15);
  }
  return mul;
}

// 동반출현 매트릭스 — m[a][b] = a, b가 같은 회차에 함께 나온 횟수 (45×45)
// cooccur 알고리즘에서만 사용 (자동추천 mix용)
function buildCooccurMatrix(history) {
  const m = Array.from({ length: 46 }, () => new Array(46).fill(0));
  for (const draw of history) {
    for (let i = 0; i < draw.length; i++) {
      for (let j = i + 1; j < draw.length; j++) {
        const a = draw[i], b = draw[j];
        m[a][b]++;
        m[b][a]++;
      }
    }
  }
  return m;
}

// 번호별 DB 가중치 — 출현 빈도 기반 정규화 (base score)
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

function getNumberScore(n, ctx, pickedZones) {
  const { algos, dbWeights, streakCache, carryoverSet, cooccurMatrix, cooccurAvg } = ctx;
  const dbW = dbWeights[n] || 1.0;
  const streakMul = streakCache ? (streakCache[n] || 1.0) : 1.0;
  let score = dbW * streakMul;

  const isCarryover = carryoverSet?.has(n) || false;
  const zoneCnt = pickedZones?.[zoneOf(n)] || 0;

  for (const algo of algos) {
    if (algo.weight <= 0) continue;
    switch (algo.id) {
      case 'carryover':
        // 직전 회차 6번호에 가산
        if (isCarryover) score += algo.weight * 0.07;
        break;
      case 'zone':
        // zone-balanced: 같은 zone 개수에 따라 차등 점수 → 자연 분포 유도
        score += algo.weight * ZONE_ADJUSTMENT[Math.min(zoneCnt, 6)];
        break;
      case 'cooccur':
        // 동반출현: 직전 회차 6번호와 같은 회차에 자주 등장한 번호 가산
        if (cooccurMatrix && carryoverSet && cooccurAvg > 0) {
          let cs = 0;
          for (const p of carryoverSet) cs += cooccurMatrix[n][p] || 0;
          score += algo.weight * (cs / cooccurAvg) * 0.05;
        }
        break;
      // DB에 옛 알고리즘 row가 잔존하더라도 무시됨
    }
  }
  return score;
}

function generateOneGame(ctx) {
  const picked = new Set();
  while (picked.size < 6) {
    const pickedZones = [0, 0, 0, 0, 0];
    for (const p of picked) pickedZones[zoneOf(p)] += 1;

    const pool = [];
    for (let n = 1; n <= 45; n++) {
      if (!picked.has(n)) pool.push({ number: n, weight: getNumberScore(n, ctx, pickedZones) });
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

// 메인 생성 함수 — 알고리즘 가중치 + 회차 history → games 배열
// carryoverNumbers를 명시하지 않으면 history 마지막 회차를 자동 사용 (carryover/cooccur 알고리즘 동작 보장)
export function generateGames({ algos, history, count = 5, carryoverNumbers }) {
  const dbWeights = buildDbWeights(history);
  const streakCache = buildStreakCache(history);

  // carryover/cooccur 가중치가 있고 carryoverNumbers를 안 넘긴 경우 → history 마지막 회차로 자동 보정
  const wantsCarry = algos.some(
    (a) => (a.id === 'carryover' || a.id === 'cooccur') && Number(a.weight) > 0,
  );
  const carrySrc = carryoverNumbers
    || (wantsCarry && history.length > 0 ? history[history.length - 1] : null);
  const carryoverSet = carrySrc ? new Set(carrySrc) : null;

  // cooccur 가중치 활성 시 동반출현 매트릭스 빌드
  const wantsCooccur = algos.some((a) => a.id === 'cooccur' && Number(a.weight) > 0);
  const cooccurMatrix = wantsCooccur ? buildCooccurMatrix(history) : null;
  // 정규화: 한 번호의 6번호와의 평균 동반출현 횟수 ≈ history.length × 6 × 5 / (45×44/2) = history.length × 6/45 × 5/44 합계
  // 단순화: 평균값 ≈ history.length × 36/45 (한 번호가 다른 6번호와 함께 나온 평균 합)
  const cooccurAvg = wantsCooccur ? (history.length * 36) / 45 : 0;

  const ctx = { algos, dbWeights, streakCache, carryoverSet, cooccurMatrix, cooccurAvg };

  const games = [];
  const seen = new Set();
  const maxAttempts = Math.max(count * 20, 50);
  let attempts = 0;

  while (games.length < count && attempts < maxAttempts) {
    attempts += 1;
    const g = generateOneGame(ctx);
    const key = g.numbers.join('-');
    if (seen.has(key)) continue;
    seen.add(key);
    games.push(g);
  }
  return games;
}

// ── 자동추천 모드 ──
// 사용자가 설정한 strategy에 따라 다른 알고리즘 적용
//   'anti-popular' → 비인기 번호 전략 (분배 시 실수령액 ↑)
//   'statistical'  → 통계 자연 분포 매칭 (default)
//   'mini-wheel'   → 간이 휠링 (작은 등수 보장)
//   null/undefined → 순수 랜덤 (전체 OFF 시)

const POPULARITY_FACTOR = {};
for (let n = 1; n <= 45; n++) {
  let w = 1.0;
  // 32+ 비인기 번호 부스트 (사람들은 생일 1~31에 몰림)
  if (n >= 32) w *= 1.4;
  // 끝자리 7 인기 (대중적 락넘버) → 페널티
  if (n % 10 === 7) w *= 0.7;
  // 끝자리 0/8/9 비인기 → 부스트
  if (n % 10 === 0 || n % 10 === 8 || n % 10 === 9) w *= 1.15;
  // 1~12 (월) 인기 → 약한 페널티
  if (n <= 12) w *= 0.85;
  POPULARITY_FACTOR[n] = w;
}

function pickWithoutReplacement(weighted, k) {
  const pool = weighted.map((it) => ({ ...it }));
  const out = [];
  for (let i = 0; i < k; i++) {
    if (!pool.length) break;
    const sel = pickWeighted(pool);
    out.push(sel.number);
    const idx = pool.findIndex((p) => p.number === sel.number);
    if (idx >= 0) pool.splice(idx, 1);
  }
  return out.sort((a, b) => a - b);
}

function makeMeta(numbers) {
  const odd = numbers.filter((n) => n % 2 === 1).length;
  const low = numbers.filter((n) => n <= 22).length;
  return {
    oddEven: `${odd}:${6 - odd}`,
    lowHigh: `${low}:${6 - low}`,
    sum: numbers.reduce((a, b) => a + b, 0),
  };
}

// 인기 패턴 회피 검사 (3개 연속 / 같은 자릿수 3개 / 끝자리 같은 3개)
function hasPopularPattern(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  // 3개 이상 연속 (예: 5, 6, 7)
  for (let i = 0; i < sorted.length - 2; i++) {
    if (sorted[i + 1] === sorted[i] + 1 && sorted[i + 2] === sorted[i] + 2) return true;
  }
  // 같은 자릿수 (1의 자리) 3개 이상
  const tens = {};
  sorted.forEach((n) => { const t = Math.floor(n / 10); tens[t] = (tens[t] || 0) + 1; });
  if (Math.max(...Object.values(tens)) >= 4) return true;
  return false;
}

// ① 비인기 번호 전략 — 분배 시 실수령액 ↑
function generateAntiPopular(history, count) {
  const games = [];
  const seen = new Set();
  let attempts = 0;
  while (games.length < count && attempts < count * 50) {
    attempts++;
    const pool = [];
    for (let n = 1; n <= 45; n++) pool.push({ number: n, weight: POPULARITY_FACTOR[n] });
    const numbers = pickWithoutReplacement(pool, 6);
    if (hasPopularPattern(numbers)) continue;
    const key = numbers.join('-');
    if (seen.has(key)) continue;
    seen.add(key);
    games.push({ numbers, meta: makeMeta(numbers) });
  }
  return games;
}

// ② 통계 자연 분포 — 합/홀짝/저고/끝자리 4축 매칭
function matchesNaturalDistribution(nums) {
  const sum = nums.reduce((a, b) => a + b, 0);
  if (sum < 110 || sum > 170) return false;
  const odd = nums.filter((n) => n % 2 === 1).length;
  if (odd < 2 || odd > 4) return false;          // 2:4 / 3:3 / 4:2
  const low = nums.filter((n) => n <= 22).length;
  if (low < 2 || low > 4) return false;
  const lastDigits = new Set(nums.map((n) => n % 10));
  if (lastDigits.size < 4) return false;          // 끝자리 4종 이상
  return true;
}

function generateStatistical(history, count) {
  const games = [];
  const seen = new Set();
  let attempts = 0;
  while (games.length < count && attempts < 5000) {
    attempts++;
    const set = new Set();
    while (set.size < 6) set.add(1 + Math.floor(Math.random() * 45));
    const numbers = [...set].sort((a, b) => a - b);
    if (!matchesNaturalDistribution(numbers)) continue;
    const key = numbers.join('-');
    if (seen.has(key)) continue;
    seen.add(key);
    games.push({ numbers, meta: makeMeta(numbers) });
  }
  return games;
}

// ③ 간이 휠링 — 8개 핵심 번호 → 5게임 균등 커버리지 (작은 등수 보장 ↑)
function generateMiniWheel(history, count) {
  // 핵심 8개 번호 선정: 직전 회차 6개 + 누적 빈도 상위 2개
  const recent = (history.length > 0 ? history[history.length - 1] : []).slice(0, 6);
  const totalFreq = {};
  for (const draw of history) for (const n of draw) totalFreq[n] = (totalFreq[n] || 0) + 1;
  const candidates = [];
  for (let n = 1; n <= 45; n++) {
    if (recent.includes(n)) continue;
    candidates.push({ n, f: totalFreq[n] || 0 });
  }
  candidates.sort((a, b) => b.f - a.f);
  const extra = candidates.slice(0, 8 - recent.length).map((c) => c.n);
  let core = [...recent, ...extra];
  // 부족하면 랜덤 보충
  while (core.length < 8) {
    const r = 1 + Math.floor(Math.random() * 45);
    if (!core.includes(r)) core.push(r);
  }
  core = core.slice(0, 8).sort((a, b) => a - b);

  // 5게임에 8개 번호 균등 분배 (각 번호가 평균 3.75회 등장하게)
  const games = [];
  const seen = new Set();
  const usage = new Array(8).fill(0);
  let safety = 0;
  while (games.length < count && safety < count * 30) {
    safety++;
    // 가장 적게 사용된 6개 인덱스 우선 선택
    const indices = Array.from({ length: 8 }, (_, i) => i);
    indices.sort((a, b) => usage[a] - usage[b] || Math.random() - 0.5);
    const picked = indices.slice(0, 6);
    const numbers = picked.map((i) => core[i]).sort((a, b) => a - b);
    const key = numbers.join('-');
    if (seen.has(key)) {
      // 중복이면 무작위 셔플 후 재시도
      indices.sort(() => Math.random() - 0.5);
      const picked2 = indices.slice(0, 6);
      const numbers2 = picked2.map((i) => core[i]).sort((a, b) => a - b);
      const key2 = numbers2.join('-');
      if (seen.has(key2)) continue;
      seen.add(key2);
      picked2.forEach((i) => usage[i]++);
      games.push({ numbers: numbers2, meta: makeMeta(numbers2) });
    } else {
      seen.add(key);
      picked.forEach((i) => usage[i]++);
      games.push({ numbers, meta: makeMeta(numbers) });
    }
  }
  return games;
}

// ④ 이월 헤지 (carry-hedge) — 60% 이월 시나리오 + 40% 비이월 시나리오 분산
//   - 직전 6번호의 역대 이월률 계산해 ranking
//   - count의 60%는 ranking 상위 번호 1개씩 carryover, 40%는 직전 6번호 모두 회피
//   - 모든 게임 자연 분포 + 인기 패턴 회피
function generateCarryHedge(history, count) {
  if (history.length === 0) return generatePureRandom(count);

  const recent = history[history.length - 1];

  // 직전 6번호의 역대 이월률 계산
  const carryRates = recent.map((n) => {
    let totalAppear = 0, carryEvent = 0;
    for (let i = 1; i < history.length; i++) {
      if (history[i].includes(n)) {
        totalAppear++;
        if (history[i - 1].includes(n)) carryEvent++;
      }
    }
    return { n, rate: totalAppear > 0 ? carryEvent / totalAppear : 0 };
  });
  carryRates.sort((a, b) => b.rate - a.rate);

  // 60:40 비율 분배 (count 따라)
  const carryGames = Math.max(1, Math.round(count * 0.6));
  const noCarryGames = count - carryGames;
  const recentSet = new Set(recent);

  const games = [];
  const seen = new Set();

  function buildGame({ forceInclude = [], avoidRecent = false, lowBias = null }) {
    for (let attempt = 0; attempt < 5000; attempt++) {
      const picked = new Set(forceInclude);
      let safety = 0;
      while (picked.size < 6 && safety++ < 200) {
        const r = 1 + Math.floor(Math.random() * 45);
        if (avoidRecent && recentSet.has(r)) continue;
        picked.add(r);
      }
      if (picked.size < 6) continue;
      const numbers = [...picked].sort((a, b) => a - b);
      if (!matchesNaturalDistribution(numbers)) continue;
      if (hasPopularPattern(numbers)) continue;
      const lowCnt = numbers.filter((x) => x <= 22).length;
      if (lowBias === 'low' && lowCnt < 4) continue;
      if (lowBias === 'high' && lowCnt > 2) continue;
      const key = numbers.join('-');
      if (seen.has(key)) continue;
      seen.add(key);
      return { numbers, meta: makeMeta(numbers) };
    }
    return null;
  }

  // 60% 시나리오 — carryover 1개씩 포함
  for (let i = 0; i < carryGames; i++) {
    const carry = carryRates[i % carryRates.length].n;
    const g = buildGame({ forceInclude: [carry] });
    if (g) games.push(g);
  }
  // 40% 시나리오 — 직전 6번호 모두 회피, 저/고 편향 번갈아
  for (let i = 0; i < noCarryGames; i++) {
    const bias = i % 2 === 0 ? 'low' : 'high';
    const g = buildGame({ avoidRecent: true, lowBias: bias });
    if (g) games.push(g);
  }
  // 부족분 자유 자연 분포로 보충
  while (games.length < count) {
    const g = buildGame({});
    if (!g) break;
    games.push(g);
  }
  return games;
}

// 순수 랜덤 (모든 strategy OFF)
function generatePureRandom(count) {
  const games = [];
  const seen = new Set();
  let safety = 0;
  while (games.length < count && safety < count * 20) {
    safety++;
    const set = new Set();
    while (set.size < 6) set.add(1 + Math.floor(Math.random() * 45));
    const numbers = [...set].sort((a, b) => a - b);
    const key = numbers.join('-');
    if (seen.has(key)) continue;
    seen.add(key);
    games.push({ numbers, meta: makeMeta(numbers) });
  }
  return games;
}

// 자동추천 dispatch — strategy 따라 다른 알고리즘
export function generateAuto({ history = [], count = 5, strategy = 'statistical' } = {}) {
  let games;
  switch (strategy) {
    case 'anti-popular': games = generateAntiPopular(history, count); break;
    case 'mini-wheel':   games = generateMiniWheel(history, count); break;
    case 'carry-hedge':  games = generateCarryHedge(history, count); break;
    case null:
    case 'random':       games = generatePureRandom(count); break;
    case 'statistical':
    default:             games = generateStatistical(history, count); break;
  }
  return { games, meta: { mode: `auto-${strategy || 'random'}` } };
}

// 하위 호환 alias
export const generateAutoCarryover = generateAuto;

// 자동추천 strategy 메타 (UI 표시용)
export const AUTO_STRATEGIES = [
  {
    id: 'anti-popular',
    name: '비인기 번호 전략',
    desc: '인기 패턴 회피 — 1등 시 분배자 ↓ 실수령액 ↑',
  },
  {
    id: 'statistical',
    name: '통계 자연 분포',
    desc: '합·홀짝·저고·끝자리 4축이 자연스러운 분포 (default)',
  },
  {
    id: 'mini-wheel',
    name: '간이 휠링',
    desc: '8개 핵심 번호로 5게임 균등 분배 — 작은 등수 보장 ↑',
  },
  {
    id: 'carry-hedge',
    name: '이월 헤지',
    desc: '직전 6번호 이월률 분석 + 60/40 시나리오 분산 (참고용)',
  },
];

// 가중치 합계 검증
export function weightsSum(algos) {
  return algos.reduce((s, a) => s + Number(a.weight || 0), 0);
}

// 당첨 등수 계산
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
