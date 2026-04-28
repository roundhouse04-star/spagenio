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
// carryover (40) + zone (30) + cooccur 동반출현 (30) 고정 프리셋 — 사용자 가중치 무시
// carryoverNumbers는 generateGames가 history 마지막 회차에서 자동 보정
export function generateAuto({ history, count = 5 }) {
  const presetAlgos = [
    { id: 'carryover', weight: 40 },
    { id: 'zone',      weight: 30 },
    { id: 'cooccur',   weight: 30 },
  ];
  return {
    games: generateGames({ algos: presetAlgos, history, count }),
    meta: { mode: 'auto-mix' },
  };
}

// 하위 호환 alias
export const generateAutoCarryover = generateAuto;

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
