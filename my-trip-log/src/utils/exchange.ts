/**
 * 환율 API + 캐시
 *
 * 데이터 소스: frankfurter.dev (무료, API key 불필요, EU 중앙은행 데이터)
 * 캐시 정책: SQLite에 24시간 보관, 만료 시 재요청
 * 오프라인 폴백: 캐시 데이터 있으면 만료돼도 사용
 *
 * 사용:
 *   const rates = await getRates('KRW');
 *   // { JPY: 9.12, USD: 1380.5, ... }
 *
 *   const won = await convert(100, 'USD', 'KRW');
 *   // 138050
 */
import { getDB } from '@/db/database';

const API_BASE = 'https://api.frankfurter.dev/v1';
const CACHE_HOURS = 24;
const SUPPORTED = ['KRW', 'JPY', 'USD', 'EUR', 'GBP', 'CNY', 'THB', 'VND', 'AUD', 'SGD', 'HKD', 'CAD', 'TWD', 'MYR', 'PHP', 'IDR'];

type RateMap = Record<string, number>;

/** 캐시에서 환율 가져오기 (만료 체크 포함) */
async function getCachedRates(base: string): Promise<{ rates: RateMap; staleAt: number } | null> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT target_currency, rate, updated_at
     FROM exchange_rates_cache
     WHERE base_currency = ?`,
    [base]
  );
  if (rows.length === 0) return null;

  const rates: RateMap = {};
  let oldestUpdate = Date.now();
  for (const r of rows) {
    rates[r.target_currency] = r.rate;
    const t = new Date(r.updated_at).getTime();
    if (t < oldestUpdate) oldestUpdate = t;
  }
  return { rates, staleAt: oldestUpdate + CACHE_HOURS * 3600 * 1000 };
}

/** 캐시에 환율 저장 */
async function saveCachedRates(base: string, rates: RateMap): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();
  for (const [target, rate] of Object.entries(rates)) {
    await db.runAsync(
      `INSERT INTO exchange_rates_cache (base_currency, target_currency, rate, source, updated_at)
       VALUES (?, ?, ?, 'frankfurter', ?)
       ON CONFLICT(base_currency, target_currency) DO UPDATE SET
         rate = excluded.rate,
         updated_at = excluded.updated_at`,
      [base, target, rate, now]
    );
  }
}

/** API에서 환율 fetch */
async function fetchRates(base: string): Promise<RateMap> {
  const symbols = SUPPORTED.filter((c) => c !== base).join(',');
  const url = `${API_BASE}/latest?base=${base}&symbols=${symbols}`;

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 8000);

  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    if (!data?.rates) throw new Error('no rates');

    // base 통화는 자기 자신 = 1
    return { ...data.rates, [base]: 1 };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 환율 가져오기 (메인 API)
 * 1. 캐시 보고 → 신선하면 그대로
 * 2. 만료/없음 → API 호출 → 캐시 저장
 * 3. API 실패 → 캐시라도 있으면 그거 사용
 */
export async function getRates(base: string = 'KRW'): Promise<RateMap> {
  base = base.toUpperCase();
  const cached = await getCachedRates(base);

  // 신선한 캐시 있음
  if (cached && Date.now() < cached.staleAt) {
    return cached.rates;
  }

  // API 호출 시도
  try {
    const fresh = await fetchRates(base);
    await saveCachedRates(base, fresh);
    return fresh;
  } catch (err) {
    console.warn('[exchange] API failed, using cache:', String(err));
    if (cached) {
      return cached.rates;
    }
    // 캐시도 없으면 폴백
    return FALLBACK_RATES[base] || FALLBACK_RATES.KRW;
  }
}

/**
 * 통화 환산 한 번에
 *   amount * (rate from→to)
 */
export async function convert(amount: number, from: string, to: string): Promise<number> {
  if (from === to) return amount;
  const rates = await getRates(from);
  const rate = rates[to];
  if (!rate || isNaN(rate)) return amount;
  return amount * rate;
}

/** 캐시 갱신 시각 (UI 표시용) */
export async function getLastUpdated(base: string = 'KRW'): Promise<Date | null> {
  const cached = await getCachedRates(base);
  if (!cached) return null;
  return new Date(cached.staleAt - CACHE_HOURS * 3600 * 1000);
}

/** 강제 새로고침 (사용자가 새로고침 버튼 눌렀을 때) */
export async function refreshRates(base: string = 'KRW'): Promise<RateMap> {
  base = base.toUpperCase();
  const fresh = await fetchRates(base);
  await saveCachedRates(base, fresh);
  return fresh;
}

/**
 * API/캐시 모두 실패 시 폴백 (오프라인 + 첫 실행)
 * 대략적인 환율, 실제 사용 시 API에서 갱신됨
 */
const FALLBACK_RATES: Record<string, RateMap> = {
  KRW: {
    KRW: 1, JPY: 0.110, USD: 0.000725, EUR: 0.000667, GBP: 0.000571,
    CNY: 0.00526, THB: 0.025, VND: 17.86, AUD: 0.00111, SGD: 0.000980,
    HKD: 0.00567, CAD: 0.000990, TWD: 0.0235, MYR: 0.00339, PHP: 0.0418, IDR: 11.36,
  },
  USD: {
    USD: 1, KRW: 1380, JPY: 152, EUR: 0.92, GBP: 0.79, CNY: 7.25,
    THB: 34.5, VND: 24640, AUD: 1.53, SGD: 1.35, HKD: 7.82, CAD: 1.37,
    TWD: 32.4, MYR: 4.68, PHP: 57.7, IDR: 15670,
  },
};

export const SUPPORTED_CURRENCIES = SUPPORTED;
