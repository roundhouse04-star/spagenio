// 회차 데이터 조회 + AsyncStorage 캐시
// 1회차 추첨일: 2002-12-07 (토), 매주 토요일 추첨
// lotto.oot.kr 는 동행복권 공식 데이터를 JSON으로 미러링 (원본 spagenio 서버에서도 동일 엔드포인트 사용)
//
// 첫 실행 즉시 로딩을 위해 빌드 시점의 최근 100회차를 assets/lotto-history.json 으로 번들링.
// (scripts/fetch-history.mjs 로 갱신; 빌드 전 재실행 권장)
import AsyncStorage from '@react-native-async-storage/async-storage';
import bundledHistory from '../../assets/lotto-history.json';

const ENDPOINT = 'https://lotto.oot.kr/api/lotto/';
const FIRST_DRAW_DATE = new Date('2002-12-07T00:00:00+09:00');
const HISTORY_KEY = 'lotto_history_v1';
const LATEST_KEY = 'lotto_latest_round_v1';
const LATEST_TTL_MS = 60 * 60 * 1000; // 1시간

// 번들된 회차 중 최대 회차 — detectLatestRound() 의 빠른 fallback
const BUNDLED_LATEST = Math.max(0, ...Object.keys(bundledHistory).map(Number));

export function estimateLatestRound() {
  const now = new Date();
  const diff = now.getTime() - FIRST_DRAW_DATE.getTime();
  const weeks = Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, weeks + 1);
}

async function fetchOne(drwNo) {
  try {
    const res = await fetch(ENDPOINT + drwNo);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.drwtNo1) return null;
    return {
      drwNo: data.drwNo,
      drwDate: data.drwNoDate,
      numbers: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6].sort((a, b) => a - b),
      bonus: data.bnusNo,
      prizes: {
        1: { count: data.firstPrzwnerCo, amount: data.firstWinamnt, auto: data.firstAutoPrzwnerCo, manual: data.firstManualPrzwnerCo, semi: data.firstSemiAutoPrzwnerCo },
        2: { count: data.secondPrzwnerCo, amount: data.secondWinamnt },
        3: { count: data.thirdPrzwnerCo, amount: data.thirdWinamnt },
        4: { count: data.fourthPrzwnerCo, amount: data.fourthWinamnt },
        5: { count: data.fifthPrzwnerCo, amount: data.fifthWinamnt },
      },
    };
  } catch (e) {
    return null;
  }
}

// 최신 회차 탐지
// 우선순위: ① AsyncStorage 캐시(1h TTL) → ② 네트워크 probe → ③ 번들 최대값 → ④ 시간 기반 추정
export async function detectLatestRound() {
  try {
    const cached = await AsyncStorage.getItem(LATEST_KEY);
    if (cached) {
      const { round, ts } = JSON.parse(cached);
      if (Date.now() - ts < LATEST_TTL_MS) return round;
    }
  } catch (e) {}

  let probe = estimateLatestRound() + 1;
  for (let i = 0; i < 4; i++) {
    const r = await fetchOne(probe);
    if (r) {
      try { await AsyncStorage.setItem(LATEST_KEY, JSON.stringify({ round: r.drwNo, ts: Date.now() })); } catch (e) {}
      return r.drwNo;
    }
    probe -= 1;
  }
  // 네트워크 실패 시 번들된 최신 회차로 graceful fallback (오프라인 대응)
  if (BUNDLED_LATEST > 0) return BUNDLED_LATEST;
  return estimateLatestRound();
}

// 번들 JSON + AsyncStorage 캐시 병합
// - 번들: 빌드 시점 100회차 (첫 실행 즉시 사용 가능)
// - AsyncStorage: 사용자가 추가로 받은 회차 (병합 시 우선)
async function loadCache() {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const stored = raw ? JSON.parse(raw) || {} : {};
    return { ...bundledHistory, ...stored };
  } catch (e) {
    return { ...bundledHistory };
  }
}

// 번들에 이미 있는 회차는 다시 저장하지 않음 (저장공간 절약)
async function saveCache(map) {
  try {
    const onlyExtra = {};
    for (const k of Object.keys(map)) {
      if (!bundledHistory[k]) onlyExtra[k] = map[k];
    }
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(onlyExtra));
  } catch (e) {}
}

// 최근 N회차 가져오기 (캐시 우선)
export async function fetchRecentHistory(count = 50, onProgress) {
  const latest = await detectLatestRound();
  const cache = await loadCache();
  const results = [];
  let fetched = 0;

  for (let drwNo = latest; drwNo > Math.max(0, latest - count); drwNo--) {
    if (cache[drwNo]) {
      results.push(cache[drwNo]);
    } else {
      const r = await fetchOne(drwNo);
      if (r) {
        cache[drwNo] = r;
        results.push(r);
        fetched += 1;
      }
    }
    if (onProgress) onProgress({ done: latest - drwNo + 1, total: count, latest });
  }

  if (fetched > 0) await saveCache(cache);
  results.sort((a, b) => a.drwNo - b.drwNo);
  return { latest, history: results };
}

export async function fetchRound(drwNo) {
  const cache = await loadCache();
  if (cache[drwNo]) return cache[drwNo];
  const r = await fetchOne(drwNo);
  if (r) {
    cache[drwNo] = r;
    await saveCache(cache);
  }
  return r;
}
