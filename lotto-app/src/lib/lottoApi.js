// 회차 데이터 조회 + AsyncStorage 캐시
// 1회차 추첨일: 2002-12-07 (토), 매주 토요일 추첨
// lotto.oot.kr 는 동행복권 공식 데이터를 JSON으로 미러링 (원본 spagenio 서버에서도 동일 엔드포인트 사용)
import AsyncStorage from '@react-native-async-storage/async-storage';

const ENDPOINT = 'https://lotto.oot.kr/api/lotto/';
const FIRST_DRAW_DATE = new Date('2002-12-07T00:00:00+09:00');
const HISTORY_KEY = 'lotto_history_v1';
const LATEST_KEY = 'lotto_latest_round_v1';
const LATEST_TTL_MS = 60 * 60 * 1000; // 1시간

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

// 최신 회차 탐지(예상치에서 한두 번 성공할 때까지 내려감)
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
  return estimateLatestRound();
}

async function loadCache() {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch (e) { return {}; }
}

async function saveCache(map) {
  try { await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(map)); } catch (e) {}
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
