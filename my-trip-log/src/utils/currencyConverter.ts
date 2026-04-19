/**
 * 다중 통화 정산
 *
 * 각 지출은 원본 통화로 저장 (฿500, ¥25,000 등)
 * 표시할 때만 사용자 기본 통화로 변환
 *
 * 환율 전략 3가지:
 *   1. LIVE: 현재 환율 (매번 최신) - 일관성 ↓
 *   2. FIXED: 저장 시점의 환율 - 일관성 ↑
 *   3. TRIP_AVG: 여행 평균 환율 - 추천!
 *
 * 우리는 FIXED + LIVE fallback 전략 사용:
 *   - 저장 시 당일 환율 함께 기록
 *   - 과거 지출은 저장된 환율로 (정확)
 *   - 최신 지출은 LIVE 환율로 (실시간)
 */
import { getRates } from './exchange';

export interface ExpenseForSummary {
  amount: number;
  currency: string;
  // 저장 시점에 기록된 환율 (원본 → home_currency)
  exchangeRate?: number;
  // 이미 계산된 home currency 금액 (있으면 우선 사용)
  amountInHomeCurrency?: number;
}

export interface CurrencyBreakdown {
  currency: string;
  total: number;          // 해당 통화 총액
  count: number;          // 건수
  totalInHome: number;    // home 통화로 환산한 금액
}

export interface Summary {
  totalInHome: number;
  homeCurrency: string;
  byCurrency: CurrencyBreakdown[];
  missingRates: string[]; // 환율 못 구한 통화들
}

/**
 * 여러 통화의 지출을 합쳐서 home 통화로 정산
 */
export async function summarizeExpenses(
  expenses: ExpenseForSummary[],
  homeCurrency: string
): Promise<Summary> {
  // 통화별 그룹
  const groups: Record<string, ExpenseForSummary[]> = {};
  expenses.forEach((e) => {
    if (!groups[e.currency]) groups[e.currency] = [];
    groups[e.currency].push(e);
  });

  // home 통화 환율 조회 (1회만)
  let rates: Record<string, number> = {};
  try {
    rates = await getRates(homeCurrency);
  } catch {
    // 오프라인이면 저장된 환율 사용
  }

  const byCurrency: CurrencyBreakdown[] = [];
  const missingRates: string[] = [];
  let totalInHome = 0;

  for (const [currency, items] of Object.entries(groups)) {
    const total = items.reduce((sum, e) => sum + e.amount, 0);
    let totalInHome_ = 0;

    if (currency === homeCurrency) {
      // 같은 통화, 환산 불필요
      totalInHome_ = total;
    } else {
      for (const item of items) {
        let homeAmount = 0;

        // 1순위: 이미 계산된 값
        if (typeof item.amountInHomeCurrency === 'number') {
          homeAmount = item.amountInHomeCurrency;
        }
        // 2순위: 저장 시점 환율
        else if (typeof item.exchangeRate === 'number' && item.exchangeRate > 0) {
          homeAmount = item.amount * item.exchangeRate;
        }
        // 3순위: 현재 환율
        else {
          const rate = getConvertRate(item.currency, homeCurrency, rates);
          if (rate) {
            homeAmount = item.amount * rate;
          } else {
            // 환율 못 구함
            if (!missingRates.includes(currency)) missingRates.push(currency);
            homeAmount = 0;
          }
        }

        totalInHome_ += homeAmount;
      }
    }

    byCurrency.push({
      currency,
      total,
      count: items.length,
      totalInHome: Math.round(totalInHome_),
    });
    totalInHome += totalInHome_;
  }

  // 금액 많은 순
  byCurrency.sort((a, b) => b.totalInHome - a.totalInHome);

  return {
    totalInHome: Math.round(totalInHome),
    homeCurrency,
    byCurrency,
    missingRates,
  };
}

/**
 * 원본 통화 → 목표 통화 환율 계산
 *
 * rates는 "1 base = N 다른통화" 형태 (base가 homeCurrency)
 * 예: getRates('KRW')로 받으면 { JPY: 0.11, USD: 0.00072, ... }
 *
 * JPY → KRW 변환하려면 1/rates[JPY] 곱해야 함
 */
function getConvertRate(
  from: string,
  to: string,
  rates: Record<string, number>
): number | null {
  if (from === to) return 1;

  // rates의 base가 `to` (home 통화)인 경우
  // from → to 변환: 1 / rates[from]
  if (rates[from]) {
    return 1 / rates[from];
  }

  return null;
}

/**
 * 화면 표시용 포맷
 *
 * 예: "฿1,500 (≈ ₩52,500)"
 */
export function formatWithConversion(
  amount: number,
  currency: string,
  homeAmount: number | null,
  homeCurrency: string
): string {
  const symbol = getCurrencySymbol(currency);
  const main = `${symbol}${amount.toLocaleString()}`;

  if (currency === homeCurrency || homeAmount === null) {
    return main;
  }

  const homeSymbol = getCurrencySymbol(homeCurrency);
  const homeFormatted = `${homeSymbol}${Math.round(homeAmount).toLocaleString()}`;
  return `${main} (≈ ${homeFormatted})`;
}

export function getCurrencySymbol(code: string): string {
  const symbols: Record<string, string> = {
    KRW: '₩', JPY: '¥', USD: '$', EUR: '€', GBP: '£',
    CNY: '¥', HKD: 'HK$', TWD: 'NT$', SGD: 'S$',
    THB: '฿', VND: '₫', IDR: 'Rp', PHP: '₱',
    INR: '₹', AUD: 'A$', CAD: 'C$', CHF: 'Fr',
  };
  return symbols[code] || `${code} `;
}

/**
 * 저장 시점에 환율을 기록하기 위한 헬퍼
 */
export async function calculateExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> {
  if (fromCurrency === toCurrency) return 1;

  try {
    // toCurrency 기준 환율
    const rates = await getRates(toCurrency);
    if (rates[fromCurrency]) {
      return 1 / rates[fromCurrency];
    }
  } catch (err) {
    console.warn('[환율 조회 실패]', err);
  }

  return null;
}
