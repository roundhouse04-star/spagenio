/**
 * 관극 리포트 통계 쿼리.
 */
import { getDB } from './database';

export type YearlyReport = {
  year: number;
  total: number;
  byCategory: { category: string; count: number; percent: number }[];
  byMonth: { month: number; count: number }[];
  topArtists: { artistId: number; name: string; count: number }[];
  avgRating: number;
  totalSpent: number;
  maxPrice: number;
  topVenues: { venue: string; count: number }[];
};

export type AllTimeStats = {
  totalTickets: number;
  totalSpent: number;
  avgRating: number;
  firstDate?: string;
  availableYears: number[];
};

export async function getAllTimeStats(): Promise<AllTimeStats> {
  const db = await getDB();
  const totalRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM tickets`
  );
  const spentRow = await db.getFirstAsync<{ s: number }>(
    `SELECT SUM(price) as s FROM tickets WHERE price IS NOT NULL`
  );
  const avgRow = await db.getFirstAsync<{ a: number }>(
    `SELECT AVG(rating) as a FROM tickets WHERE rating > 0`
  );
  const firstRow = await db.getFirstAsync<{ d: string }>(
    `SELECT MIN(date) as d FROM tickets`
  );
  const yearRows = await db.getAllAsync<{ y: string }>(
    `SELECT DISTINCT substr(date, 1, 4) as y FROM tickets ORDER BY y DESC`
  );
  const availableYears = yearRows
    .map(r => parseInt(r.y, 10))
    .filter(n => !isNaN(n));

  return {
    totalTickets: totalRow?.c ?? 0,
    totalSpent: spentRow?.s ?? 0,
    avgRating: avgRow?.a ?? 0,
    firstDate: firstRow?.d ?? undefined,
    availableYears,
  };
}

export async function getYearlyReport(year: number): Promise<YearlyReport> {
  const db = await getDB();
  const yearStr = String(year);

  const totalRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM tickets WHERE substr(date, 1, 4) = ?`, [yearStr]
  );
  const total = totalRow?.c ?? 0;

  const catRows = await db.getAllAsync<{ category: string; c: number }>(
    `SELECT category, COUNT(*) as c FROM tickets
     WHERE substr(date, 1, 4) = ?
     GROUP BY category ORDER BY c DESC`, [yearStr]
  );
  const byCategory = catRows.map(r => ({
    category: r.category,
    count: r.c,
    percent: total > 0 ? Math.round((r.c / total) * 100) : 0,
  }));

  const monthRows = await db.getAllAsync<{ m: string; c: number }>(
    `SELECT substr(date, 6, 2) as m, COUNT(*) as c FROM tickets
     WHERE substr(date, 1, 4) = ?
     GROUP BY m ORDER BY m`, [yearStr]
  );
  const byMonth: { month: number; count: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const row = monthRows.find(r => parseInt(r.m, 10) === m);
    byMonth.push({ month: m, count: row?.c ?? 0 });
  }

  const artistRows = await db.getAllAsync<{ artist_id: number; name: string; c: number }>(
    `SELECT t.artist_id, a.name, COUNT(*) as c FROM tickets t
     JOIN artists a ON a.id = t.artist_id
     WHERE substr(t.date, 1, 4) = ? AND t.artist_id IS NOT NULL
     GROUP BY t.artist_id ORDER BY c DESC LIMIT 5`, [yearStr]
  );
  const topArtists = artistRows.map(r => ({
    artistId: r.artist_id,
    name: r.name,
    count: r.c,
  }));

  const avgRow = await db.getFirstAsync<{ a: number }>(
    `SELECT AVG(rating) as a FROM tickets
     WHERE substr(date, 1, 4) = ? AND rating > 0`, [yearStr]
  );
  const spentRow = await db.getFirstAsync<{ s: number; m: number }>(
    `SELECT SUM(price) as s, MAX(price) as m FROM tickets
     WHERE substr(date, 1, 4) = ? AND price IS NOT NULL`, [yearStr]
  );
  const venueRows = await db.getAllAsync<{ venue: string; c: number }>(
    `SELECT venue, COUNT(*) as c FROM tickets
     WHERE substr(date, 1, 4) = ? AND venue IS NOT NULL AND venue != ''
     GROUP BY venue ORDER BY c DESC LIMIT 3`, [yearStr]
  );
  const topVenues = venueRows.map(r => ({ venue: r.venue, count: r.c }));

  return {
    year,
    total,
    byCategory,
    byMonth,
    topArtists,
    avgRating: avgRow?.a ?? 0,
    totalSpent: spentRow?.s ?? 0,
    maxPrice: spentRow?.m ?? 0,
    topVenues,
  };
}
