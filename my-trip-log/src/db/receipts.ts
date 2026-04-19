/**
 * 영수증 DB - 다중 통화 + 저장 시점 환율 기록
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { calculateExchangeRate } from '@/utils/currencyConverter';

export async function addReceiptFields(db: SQLiteDatabase) {
  const columns = await db.getAllAsync<any>(`PRAGMA table_info(expenses)`);
  const columnNames = columns.map((c: any) => c.name);

  if (!columnNames.includes('receipt_image')) {
    await db.execAsync(`ALTER TABLE expenses ADD COLUMN receipt_image TEXT`);
  }
  if (!columnNames.includes('receipt_ocr_text')) {
    await db.execAsync(`ALTER TABLE expenses ADD COLUMN receipt_ocr_text TEXT`);
  }
  if (!columnNames.includes('receipt_confidence')) {
    await db.execAsync(`ALTER TABLE expenses ADD COLUMN receipt_confidence REAL`);
  }
  if (!columnNames.includes('ocr_engine')) {
    await db.execAsync(`ALTER TABLE expenses ADD COLUMN ocr_engine TEXT`);
  }

  // exchange_rate 컬럼이 이미 있을 수도 있으니 체크
  if (!columnNames.includes('exchange_rate')) {
    await db.execAsync(`ALTER TABLE expenses ADD COLUMN exchange_rate REAL`);
  }
  if (!columnNames.includes('amount_in_home_currency')) {
    await db.execAsync(`ALTER TABLE expenses ADD COLUMN amount_in_home_currency REAL`);
  }

  console.log('[receipt] DB 필드 추가 완료');
}

export interface ExpenseInput {
  tripId: string;
  expenseDate: string;
  category: string;
  title: string;
  amount: number;          // 원본 통화 금액 (฿500)
  currency: string;        // 원본 통화 코드 (THB)
  homeCurrency?: string;   // 사용자 기본 통화 (KRW) - 환율 계산용
  paymentMethod?: string;
  memo?: string;

  // 영수증
  receiptImage?: string;
  receiptOcrText?: string;
  receiptConfidence?: number;
  ocrEngine?: string;
}

/**
 * 영수증 포함 지출 저장
 * 저장 시점의 환율을 자동으로 계산해서 함께 기록
 */
export async function insertExpenseWithReceipt(
  db: SQLiteDatabase,
  input: ExpenseInput
): Promise<string> {
  const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  // 저장 시점의 환율 계산
  let exchangeRate: number | null = null;
  let amountInHome: number | null = null;

  if (input.homeCurrency && input.homeCurrency !== input.currency) {
    exchangeRate = await calculateExchangeRate(input.currency, input.homeCurrency);
    if (exchangeRate) {
      amountInHome = input.amount * exchangeRate;
    }
  } else if (input.currency === input.homeCurrency) {
    exchangeRate = 1;
    amountInHome = input.amount;
  }

  await db.runAsync(
    `INSERT INTO expenses (
      id, trip_id, expense_date, category, title, amount, currency,
      amount_in_home_currency, exchange_rate, payment_method, memo,
      receipt_image, receipt_ocr_text, receipt_confidence, ocr_engine, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.tripId, input.expenseDate, input.category, input.title,
      input.amount, input.currency,
      amountInHome, exchangeRate,
      input.paymentMethod ?? null, input.memo ?? null,
      input.receiptImage ?? null,
      input.receiptOcrText ?? null,
      input.receiptConfidence ?? null,
      input.ocrEngine ?? null,
      now,
    ]
  );

  return id;
}

/** 영수증 있는 expense만 */
export async function getExpensesWithReceipts(db: SQLiteDatabase, tripId: string) {
  return await db.getAllAsync<any>(
    `SELECT * FROM expenses
     WHERE trip_id = ? AND receipt_image IS NOT NULL
     ORDER BY expense_date DESC, created_at DESC`,
    [tripId]
  );
}

/** 여행의 모든 expense (정산용) */
export async function getAllExpenses(db: SQLiteDatabase, tripId: string) {
  return await db.getAllAsync<any>(
    `SELECT * FROM expenses WHERE trip_id = ? ORDER BY expense_date DESC, created_at DESC`,
    [tripId]
  );
}
