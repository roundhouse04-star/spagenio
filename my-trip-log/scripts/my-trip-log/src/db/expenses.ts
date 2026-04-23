/**
 * Expenses (비용/가계부) DB 쿼리 헬퍼
 */
import { getDB } from './database';
import { Expense, ExpenseCategory } from '@/types';

function rowToExpense(r: any): Expense {
  return {
    id: r.id,
    tripId: r.trip_id,
    expenseDate: r.expense_date,
    category: r.category as ExpenseCategory,
    title: r.title,
    amount: r.amount,
    currency: r.currency,
    amountInHomeCurrency: r.amount_in_home_currency,
    exchangeRate: r.exchange_rate,
    paymentMethod: r.payment_method,
    memo: r.memo,
    receiptImage: r.receipt_image ?? null,
    receiptOcrText: r.receipt_ocr_text ?? null,
    receiptConfidence: r.receipt_confidence ?? null,
    ocrEngine: r.ocr_engine ?? null,
    createdAt: r.created_at,
  };
}

export async function getExpenses(tripId: number): Promise<Expense[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM expenses WHERE trip_id = ? ORDER BY expense_date DESC, created_at DESC`,
    [tripId]
  );
  return rows.map(rowToExpense);
}

export async function getExpense(id: number): Promise<Expense | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>(
    `SELECT * FROM expenses WHERE id = ?`,
    [id]
  );
  return row ? rowToExpense(row) : null;
}

export async function createExpense(data: Partial<Expense>): Promise<number> {
  const db = await getDB();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO expenses
      (trip_id, expense_date, category, title, amount, currency,
       amount_in_home_currency, exchange_rate, payment_method, memo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.tripId!,
      data.expenseDate ?? new Date().toISOString().slice(0, 10),
      data.category ?? 'other',
      data.title ?? null,
      data.amount ?? 0,
      data.currency ?? 'KRW',
      data.amountInHomeCurrency ?? null,
      data.exchangeRate ?? null,
      data.paymentMethod ?? null,
      data.memo ?? null,
      now,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateExpense(id: number, data: Partial<Expense>): Promise<void> {
  const db = await getDB();
  const fields: string[] = [];
  const values: any[] = [];

  const map: Record<string, string> = {
    expenseDate: 'expense_date',
    category: 'category',
    title: 'title',
    amount: 'amount',
    currency: 'currency',
    amountInHomeCurrency: 'amount_in_home_currency',
    exchangeRate: 'exchange_rate',
    paymentMethod: 'payment_method',
    memo: 'memo',
    receiptImage: 'receipt_image',
    receiptOcrText: 'receipt_ocr_text',
    receiptConfidence: 'receipt_confidence',
    ocrEngine: 'ocr_engine',
  };

  for (const [key, col] of Object.entries(map)) {
    if (key in data) {
      fields.push(`${col} = ?`);
      values.push((data as any)[key]);
    }
  }
  if (fields.length === 0) return;

  values.push(id);
  await db.runAsync(`UPDATE expenses SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
}

/**
 * 카테고리별 집계
 */
export async function getExpensesByCategory(tripId: number): Promise<
  { category: ExpenseCategory; total: number; count: number }[]
> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT category, COUNT(*) as count,
            COALESCE(SUM(amount_in_home_currency), SUM(amount)) as total
     FROM expenses
     WHERE trip_id = ?
     GROUP BY category
     ORDER BY total DESC`,
    [tripId]
  );
  return rows.map((r) => ({
    category: r.category,
    total: r.total ?? 0,
    count: r.count ?? 0,
  }));
}

/**
 * 모든 여행 기준 카테고리별 집계 (전체 가계부 화면용)
 */
export async function getAllExpensesByCategory(): Promise<
  { category: ExpenseCategory; total: number; count: number }[]
> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT category, COUNT(*) as count,
            COALESCE(SUM(amount_in_home_currency), SUM(amount)) as total
     FROM expenses
     GROUP BY category
     ORDER BY total DESC`
  );
  return rows.map((r) => ({
    category: r.category,
    total: r.total ?? 0,
    count: r.count ?? 0,
  }));
}

/**
 * 여행 전체 지출 합계 (자국 통화 기준)
 */
export async function getTripTotalSpent(tripId: number): Promise<number> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>(
    `SELECT COALESCE(SUM(amount_in_home_currency), 0) as total
     FROM expenses WHERE trip_id = ?`,
    [tripId]
  );
  return row?.total ?? 0;
}
