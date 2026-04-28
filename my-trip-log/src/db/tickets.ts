/**
 * Tickets (여행 티켓) DB 쿼리 헬퍼
 * 비행기 보딩패스, 기차표, 입장권, 공연 티켓 등을 사진과 함께 보관
 */
import { getDB } from './database';
import { Ticket, TicketCategory } from '@/types';
import { deleteTicketImage } from '@/utils/ticketStorage';

function rowToTicket(r: any): Ticket {
  return {
    id: r.id,
    tripId: r.trip_id ?? null,
    category: r.category as TicketCategory,
    title: r.title,
    useDate: r.use_date ?? null,
    origin: r.origin ?? null,
    destination: r.destination ?? null,
    seat: r.seat ?? null,
    amount: r.amount ?? null,
    currency: r.currency ?? null,
    imageUri: r.image_uri,
    ocrText: r.ocr_text ?? null,
    memo: r.memo ?? null,
    createdAt: r.created_at,
  };
}

export interface TicketFilter {
  category?: TicketCategory;
  tripId?: number | 'all' | 'none';
  search?: string; // title/memo 부분 일치
  sort?: 'newest' | 'oldest' | 'use_date_desc' | 'use_date_asc';
}

export async function getAllTickets(filter: TicketFilter = {}): Promise<Ticket[]> {
  const db = await getDB();
  const conds: string[] = [];
  const params: (string | number)[] = [];

  if (filter.category) {
    conds.push('category = ?');
    params.push(filter.category);
  }
  if (filter.tripId === 'none') {
    conds.push('trip_id IS NULL');
  } else if (typeof filter.tripId === 'number') {
    conds.push('trip_id = ?');
    params.push(filter.tripId);
  }
  if (filter.search && filter.search.trim()) {
    conds.push('(title LIKE ? OR memo LIKE ?)');
    const like = `%${filter.search.trim()}%`;
    params.push(like, like);
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
  const orderBy = (() => {
    switch (filter.sort) {
      case 'oldest': return 'ORDER BY created_at ASC';
      case 'use_date_desc': return 'ORDER BY use_date DESC NULLS LAST, created_at DESC';
      case 'use_date_asc': return 'ORDER BY use_date ASC NULLS LAST, created_at ASC';
      case 'newest':
      default: return 'ORDER BY created_at DESC';
    }
  })();

  const rows = await db.getAllAsync<any>(
    `SELECT * FROM tickets ${where} ${orderBy}`,
    params,
  );
  return rows.map(rowToTicket);
}

export async function getTicketsByTrip(tripId: number): Promise<Ticket[]> {
  return getAllTickets({ tripId, sort: 'use_date_asc' });
}

export async function getTicket(id: number): Promise<Ticket | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>('SELECT * FROM tickets WHERE id = ?', [id]);
  return row ? rowToTicket(row) : null;
}

/** 인접 티켓 (preview 좌우 스와이프용). 현재 정렬과 동일하게 작동 */
export async function getTicketIdsForNavigation(filter: TicketFilter = {}): Promise<number[]> {
  const tickets = await getAllTickets(filter);
  return tickets.map((t) => t.id);
}

export async function createTicket(
  data: Omit<Ticket, 'id' | 'createdAt'>,
): Promise<number> {
  const db = await getDB();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO tickets
      (trip_id, category, title, use_date, origin, destination,
       seat, amount, currency, image_uri, ocr_text, memo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.tripId,
      data.category,
      data.title,
      data.useDate,
      data.origin,
      data.destination,
      data.seat,
      data.amount,
      data.currency,
      data.imageUri,
      data.ocrText,
      data.memo,
      now,
    ],
  );
  return result.lastInsertRowId;
}

export async function updateTicket(id: number, data: Partial<Ticket>): Promise<void> {
  const db = await getDB();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  const map: Record<string, string> = {
    tripId: 'trip_id',
    category: 'category',
    title: 'title',
    useDate: 'use_date',
    origin: 'origin',
    destination: 'destination',
    seat: 'seat',
    amount: 'amount',
    currency: 'currency',
    imageUri: 'image_uri',
    ocrText: 'ocr_text',
    memo: 'memo',
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in data) {
      fields.push(`${col} = ?`);
      const v = data[key as keyof Ticket];
      values.push(v as string | number | null);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  await db.runAsync(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`, values);
}

/** 티켓 삭제 — 이미지 파일도 같이 unlink */
export async function deleteTicket(id: number): Promise<void> {
  const db = await getDB();
  const t = await getTicket(id);
  if (!t) return;
  await db.runAsync('DELETE FROM tickets WHERE id = ?', [id]);
  await deleteTicketImage(t.imageUri).catch(() => {/* 이미 없으면 무시 */});
}

export async function getTicketCount(): Promise<number> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM tickets');
  return row?.c ?? 0;
}
