/**
 * 데이터 백업/복원
 *
 * - exportData: 모든 DB 데이터를 JSON으로 export, 파일로 공유
 * - importData: JSON 파일을 읽어서 DB에 복원
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDB } from '@/db/database';

interface BackupData {
  version: number;
  exportedAt: string;
  trips: any[];
  tripItems: any[];
  tripLogs: any[];
  expenses: any[];
  checklists: any[];
  bookmarks: any[];
}

/** 모든 데이터를 JSON으로 내보내기 + 파일 공유 */
export async function exportData(): Promise<{ ok: boolean; message: string }> {
  try {
    const db = await getDB();

    const trips = await db.getAllAsync<any>('SELECT * FROM trips');
    const tripItems = await db.getAllAsync<any>('SELECT * FROM trip_items');
    const tripLogs = await db.getAllAsync<any>('SELECT * FROM trip_logs');
    const expenses = await db.getAllAsync<any>('SELECT * FROM expenses');
    const checklists = await db.getAllAsync<any>('SELECT * FROM checklists');
    const bookmarks = await db.getAllAsync<any>('SELECT * FROM bookmarks');

    const data: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      trips,
      tripItems,
      tripLogs,
      expenses,
      checklists,
      bookmarks,
    };

    const json = JSON.stringify(data, null, 2);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `triplive-backup-${timestamp}.json`;
    const fileUri = FileSystem.cacheDirectory + filename;

    await FileSystem.writeAsStringAsync(fileUri, json);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Triplive 백업',
      });
    }

    const totalCount = trips.length + tripItems.length + tripLogs.length +
                       expenses.length + checklists.length + bookmarks.length;

    return {
      ok: true,
      message: `${totalCount}개 데이터를 백업했어요`,
    };
  } catch (err) {
    console.error('[exportData]', err);
    return {
      ok: false,
      message: `백업 실패: ${String(err)}`,
    };
  }
}

/** JSON 파일 선택해서 복원 */
export async function importData(): Promise<{ ok: boolean; message: string }> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return { ok: false, message: '취소됨' };
    }

    const fileUri = result.assets[0].uri;
    const json = await FileSystem.readAsStringAsync(fileUri);
    const data: BackupData = JSON.parse(json);

    if (!data.version || !data.trips) {
      return { ok: false, message: '올바른 백업 파일이 아니에요' };
    }

    const db = await getDB();

    // 트랜잭션으로 안전하게
    await db.execAsync('BEGIN TRANSACTION');

    try {
      // 기존 데이터 삭제 (user 테이블은 유지)
      await db.execAsync(`
        DELETE FROM trip_items;
        DELETE FROM trip_logs;
        DELETE FROM expenses;
        DELETE FROM checklists;
        DELETE FROM bookmarks;
        DELETE FROM trips;
      `);

      // 복원
      for (const t of data.trips || []) {
        await db.runAsync(
          `INSERT INTO trips (id, title, country, country_code, city, start_date, end_date, budget, currency, status, cover_image, memo, is_favorite, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [t.id, t.title, t.country, t.country_code, t.city, t.start_date, t.end_date, t.budget, t.currency, t.status, t.cover_image, t.memo, t.is_favorite, t.created_at, t.updated_at]
        );
      }

      for (const it of data.tripItems || []) {
        await db.runAsync(
          `INSERT INTO trip_items (id, trip_id, day, start_time, end_time, title, location, latitude, longitude, memo, cost, currency, category, is_done, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [it.id, it.trip_id, it.day, it.start_time, it.end_time, it.title, it.location, it.latitude, it.longitude, it.memo, it.cost, it.currency, it.category, it.is_done, it.sort_order, it.created_at]
        );
      }

      for (const l of data.tripLogs || []) {
        await db.runAsync(
          `INSERT INTO trip_logs (id, trip_id, log_date, title, content, images, location, latitude, longitude, weather, mood, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [l.id, l.trip_id, l.log_date, l.title, l.content, l.images, l.location, l.latitude, l.longitude, l.weather, l.mood, l.created_at, l.updated_at]
        );
      }

      for (const e of data.expenses || []) {
        await db.runAsync(
          `INSERT INTO expenses (id, trip_id, expense_date, category, title, amount, currency, amount_in_home_currency, exchange_rate, payment_method, memo, receipt_image, receipt_ocr_text, receipt_confidence, ocr_engine, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [e.id, e.trip_id, e.expense_date, e.category, e.title, e.amount, e.currency, e.amount_in_home_currency, e.exchange_rate, e.payment_method, e.memo, e.receipt_image ?? null, e.receipt_ocr_text ?? null, e.receipt_confidence ?? null, e.ocr_engine ?? null, e.created_at]
        );
      }

      for (const c of data.checklists || []) {
        await db.runAsync(
          `INSERT INTO checklists (id, trip_id, title, category, is_checked, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [c.id, c.trip_id, c.title, c.category, c.is_checked, c.sort_order, c.created_at]
        );
      }

      for (const b of data.bookmarks || []) {
        await db.runAsync(
          `INSERT INTO bookmarks (id, title, description, country, city, address, latitude, longitude, category, image, url, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [b.id, b.title, b.description, b.country, b.city, b.address, b.latitude, b.longitude, b.category, b.image, b.url, b.created_at]
        );
      }

      await db.execAsync('COMMIT');

      const totalCount = (data.trips?.length ?? 0) +
                         (data.tripItems?.length ?? 0) +
                         (data.tripLogs?.length ?? 0) +
                         (data.expenses?.length ?? 0) +
                         (data.checklists?.length ?? 0) +
                         (data.bookmarks?.length ?? 0);

      return {
        ok: true,
        message: `${totalCount}개 데이터를 복원했어요`,
      };
    } catch (err) {
      await db.execAsync('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('[importData]', err);
    return {
      ok: false,
      message: `복원 실패: ${String(err)}`,
    };
  }
}
