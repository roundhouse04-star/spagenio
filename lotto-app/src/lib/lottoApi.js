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

// 네이버 모바일 검색 결과에서 최신 회차 즉시 파싱 (SSR HTML)
//   - lotto.oot.kr 미러보다 빠르게 갱신됨 (추첨 후 약 2~5분)
//   - 동행복권 공식 데이터 그대로 (네이버가 1차 신뢰 소스)
//   - 단점: HTML 구조 변경 시 파싱 깨질 수 있음 → fallback으로 lotto.oot.kr 유지
async function fetchLatestFromNaver() {
  try {
    const res = await fetch(
      'https://m.search.naver.com/search.naver?query=%EB%A1%9C%EB%98%90',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        },
      },
    );
    if (!res.ok) return null;
    const html = await res.text();

    // 본번호 6개
    const winMatch = html.match(/<div class="winning_number">([\s\S]*?)<\/div>/);
    if (!winMatch) return null;
    const numbers = [...winMatch[1].matchAll(/>(\d+)</g)].map((m) => Number(m[1]));
    if (numbers.length !== 6 || numbers.some((n) => isNaN(n) || n < 1 || n > 45)) return null;

    // 보너스 1개
    const bonusMatch = html.match(/<div class="bonus_number">([\s\S]*?)<\/div>/);
    if (!bonusMatch) return null;
    const bonusNum = Number((bonusMatch[1].match(/>(\d+)</) || [])[1]);
    if (!bonusNum || bonusNum < 1 || bonusNum > 45) return null;

    // 회차 + 날짜 ("1222회차 (2026.05.02.)" 패턴)
    const drwMatch = html.match(/(\d{3,4})회차\s*\(([\d.]+)\)/);
    if (!drwMatch) return null;
    const drwNo = Number(drwMatch[1]);
    if (!drwNo) return null;
    const drwDate = drwMatch[2].replace(/\.$/, '').replace(/\./g, '-'); // 2026.05.02. → 2026-05-02

    return {
      drwNo,
      drwDate,
      numbers: numbers.sort((a, b) => a - b),
      bonus: bonusNum,
      // prizes는 lotto.oot.kr에서 보강 (네이버 HTML은 1등만 명시)
      prizes: null,
    };
  } catch (e) {
    return null;
  }
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
// 우선순위:
//   ① AsyncStorage 캐시(1h TTL, force=true 시 skip)
//   ② 네이버 모바일 검색 SSR (가장 빠름, 추첨 후 2~5분)
//   ③ lotto.oot.kr probe (네이버 실패 시 fallback)
//   ④ 번들 최대값 (오프라인)
//   ⑤ 시간 기반 추정
export async function detectLatestRound({ force = false } = {}) {
  if (!force) {
    try {
      const cached = await AsyncStorage.getItem(LATEST_KEY);
      if (cached) {
        const { round, ts } = JSON.parse(cached);
        if (Date.now() - ts < LATEST_TTL_MS) return round;
      }
    } catch (e) {}
  }

  // ② 네이버 우선 시도 (가장 빠른 갱신)
  const naverData = await fetchLatestFromNaver();
  if (naverData) {
    try {
      await AsyncStorage.setItem(LATEST_KEY, JSON.stringify({ round: naverData.drwNo, ts: Date.now() }));
      // 데이터까지 캐시 — fetchRound가 즉시 사용 가능
      const cache = await loadCache();
      // 기존에 lotto.oot.kr 데이터가 있으면 prizes 보존, 없으면 네이버 데이터 그대로
      if (!cache[naverData.drwNo]) {
        cache[naverData.drwNo] = naverData;
        await saveCache(cache);
      }
    } catch (e) {}
    return naverData.drwNo;
  }

  // ③ lotto.oot.kr probe (fallback)
  let probe = estimateLatestRound() + 2;
  for (let i = 0; i < 6; i++) {
    const r = await fetchOne(probe);
    if (r) {
      try { await AsyncStorage.setItem(LATEST_KEY, JSON.stringify({ round: r.drwNo, ts: Date.now() })); } catch (e) {}
      return r.drwNo;
    }
    probe -= 1;
  }
  // ④ 번들 최대값 (오프라인)
  if (BUNDLED_LATEST > 0) return BUNDLED_LATEST;
  // ⑤ 시간 기반 추정
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

// 병렬 batch fetch (서버 친화적 + 빠름)
async function fetchManyParallel(rounds, batchSize = 5) {
  const out = {};
  for (let i = 0; i < rounds.length; i += batchSize) {
    const batch = rounds.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((n) => fetchOne(n).catch(() => null)));
    results.forEach((r, j) => { if (r) out[batch[j]] = r; });
  }
  return out;
}

// 최근 N회차 가져오기 (캐시 우선) — 호환성 유지
export async function fetchRecentHistory(count = 50, onProgress) {
  const latest = await detectLatestRound();
  const cache = await loadCache();
  const missing = [];
  for (let drwNo = latest; drwNo > Math.max(0, latest - count); drwNo--) {
    if (!cache[drwNo]) missing.push(drwNo);
  }
  if (missing.length > 0) {
    const fetched = await fetchManyParallel(missing);
    Object.assign(cache, fetched);
    await saveCache(cache);
  }
  const results = [];
  for (let drwNo = latest; drwNo > Math.max(0, latest - count); drwNo--) {
    if (cache[drwNo]) results.push(cache[drwNo]);
  }
  if (onProgress) onProgress({ done: count, total: count, latest });
  results.sort((a, b) => a.drwNo - b.drwNo);
  return { latest, history: results };
}

// 1회 ~ 최신회차 전부 가져오기 (스마트 추천 분석용 — 모든 회차 분석)
// 번들에 거의 전부 들어있으므로 첫 호출도 즉시
export async function fetchAllHistory(onProgress) {
  const latest = await detectLatestRound();
  const cache = await loadCache();
  // 누락 회차만 fetch (보통 번들 이후 1~3회 추가)
  const missing = [];
  for (let n = 1; n <= latest; n++) {
    if (!cache[n]) missing.push(n);
  }
  if (missing.length > 0) {
    if (onProgress) onProgress({ stage: 'fetching', missing: missing.length });
    const fetched = await fetchManyParallel(missing);
    Object.assign(cache, fetched);
    await saveCache(cache);
  }
  const results = [];
  for (let n = 1; n <= latest; n++) {
    if (cache[n]) results.push(cache[n]);
  }
  if (onProgress) onProgress({ stage: 'done', total: results.length });
  return { latest, history: results };
}

export async function fetchRound(drwNo) {
  const cache = await loadCache();
  const cached = cache[drwNo];
  // 완전한 데이터(prizes 포함)면 그대로 반환
  if (cached && cached.prizes) return cached;
  // 부분 데이터(네이버에서 받은 prizes=null)면 lotto.oot.kr로 보강 시도
  const r = await fetchOne(drwNo);
  if (r) {
    cache[drwNo] = r;
    await saveCache(cache);
    return r;
  }
  // 네트워크 실패 시 캐시된 부분 데이터라도 반환
  return cached || null;
}
