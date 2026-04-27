// 로컬 SQLite DB — 모든 영구 데이터의 단일 진실 공급원
// AsyncStorage v1 → SQLite v2 마이그레이션 자동 처리
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_ALGOS } from './lottoEngine';

const DB_NAME = 'spagenio_lotto.db';
const SCHEMA_VERSION = 2;

let _dbPromise = null;

function getDb() {
  if (!_dbPromise) _dbPromise = openAndInit();
  return _dbPromise;
}

async function openAndInit() {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  // 스키마 (CREATE IF NOT EXISTS — 재실행 안전)
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS algo_weights (
      algo_id TEXT PRIMARY KEY,
      weight INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS picks (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      base_round INTEGER,
      numbers TEXT NOT NULL,
      meta TEXT,
      source TEXT DEFAULT 'manual'
    );
    CREATE INDEX IF NOT EXISTS idx_picks_created ON picks(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_picks_round ON picks(base_round DESC);

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      round INTEGER NOT NULL,
      source TEXT,
      games TEXT NOT NULL,
      note TEXT,
      results TEXT,
      draw_date TEXT,
      winning TEXT,
      bonus INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_purchases_created ON purchases(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_purchases_round ON purchases(round);
  `);

  await runMigrations(db);
  return db;
}

async function runMigrations(db) {
  const row = await db.getFirstAsync(`SELECT value FROM app_settings WHERE key='schema_version'`);
  const current = row ? parseInt(row.value, 10) : 0;

  if (current < 1) {
    // v0 → v1: AsyncStorage v1 데이터를 SQLite로 이관
    await migrateFromAsyncStorage(db);
  }

  if (current < 2) {
    // v1 → v2: picks.source 컬럼 추가 ('manual' | 'auto-tg')
    try {
      await db.execAsync(`ALTER TABLE picks ADD COLUMN source TEXT DEFAULT 'manual'`);
    } catch (e) { /* 이미 존재할 수 있음 */ }
  }

  if (current < SCHEMA_VERSION) {
    await db.runAsync(
      `INSERT OR REPLACE INTO app_settings (key, value) VALUES ('schema_version', ?)`,
      String(SCHEMA_VERSION),
    );
  }
}

async function migrateFromAsyncStorage(db) {
  try {
    // 알고리즘 가중치
    const wRaw = await AsyncStorage.getItem('lotto_weights_v1');
    if (wRaw) {
      try {
        const arr = JSON.parse(wRaw);
        if (Array.isArray(arr)) {
          for (const a of arr) {
            await db.runAsync(
              `INSERT OR REPLACE INTO algo_weights (algo_id, weight, updated_at) VALUES (?,?,?)`,
              a.id, Math.max(0, Math.min(100, Number(a.weight) || 0)), Date.now(),
            );
          }
        }
      } catch (e) {}
    }

    // 추천번호 (생성번호 목록)
    const pRaw = await AsyncStorage.getItem('lotto_picks_v1');
    if (pRaw) {
      try {
        const arr = JSON.parse(pRaw) || [];
        for (const p of arr) {
          await db.runAsync(
            `INSERT OR REPLACE INTO picks (id, created_at, base_round, numbers, meta, source) VALUES (?,?,?,?,?,?)`,
            String(p.id), Number(p.createdAt) || Date.now(), p.baseRound ?? null,
            JSON.stringify(p.numbers || []), JSON.stringify(p.meta || {}),
            'manual',
          );
        }
      } catch (e) {}
    }

    // 구입번호
    const buyRaw = await AsyncStorage.getItem('lotto_purchases_v1');
    if (buyRaw) {
      try {
        const arr = JSON.parse(buyRaw) || [];
        for (const p of arr) {
          await db.runAsync(
            `INSERT OR REPLACE INTO purchases (id, created_at, round, source, games, note, results, draw_date, winning, bonus) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            String(p.id), Number(p.createdAt) || Date.now(),
            Number(p.round) || 0, p.source || null,
            JSON.stringify(p.games || []), p.note || null,
            p.results ? JSON.stringify(p.results) : null,
            p.drawDate || null,
            p.winning ? JSON.stringify(p.winning) : null,
            p.bonus ?? null,
          );
        }
      } catch (e) {}
    }

    // 텔레그램 설정
    const tg = await AsyncStorage.getItem('lotto_tg_token_v1');
    const tgChat = await AsyncStorage.getItem('lotto_tg_chatid_v1');
    if (tg) await db.runAsync(`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('tg_token', ?)`, tg);
    if (tgChat) await db.runAsync(`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('tg_chat_id', ?)`, tgChat);

    // (마이그레이션 후 AsyncStorage는 보존 — 데이터 안전을 위해 삭제하지 않음)
  } catch (e) {
    console.log('[migrate] error:', e.message);
  }
}

// ── KV 설정 ──
export async function getSetting(key, fallback = null) {
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT value FROM app_settings WHERE key = ?`, key);
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  const db = await getDb();
  if (value == null) {
    await db.runAsync(`DELETE FROM app_settings WHERE key = ?`, key);
  } else {
    await db.runAsync(`INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`, key, String(value));
  }
}

// ── 가중치 ──
export async function dbLoadWeights() {
  const db = await getDb();
  const rows = await db.getAllAsync(`SELECT algo_id, weight FROM algo_weights`);
  const map = {};
  rows.forEach((r) => { map[r.algo_id] = r.weight; });
  return DEFAULT_ALGOS.map((def) => ({
    ...def,
    weight: map[def.id] !== undefined
      ? Math.max(0, Math.min(100, Number(map[def.id])))
      : def.weight,
  }));
}

export async function dbSaveWeights(algos) {
  const db = await getDb();
  const ts = Date.now();
  await db.execAsync('BEGIN');
  try {
    for (const a of algos) {
      await db.runAsync(
        `INSERT OR REPLACE INTO algo_weights (algo_id, weight, updated_at) VALUES (?,?,?)`,
        a.id, Math.max(0, Math.min(100, Number(a.weight) || 0)), ts,
      );
    }
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

// ── 추천번호 ──
function rowToPick(r) {
  return {
    id: r.id,
    createdAt: r.created_at,
    baseRound: r.base_round,
    numbers: JSON.parse(r.numbers || '[]'),
    meta: r.meta ? JSON.parse(r.meta) : {},
    source: r.source || 'manual',
  };
}

export async function dbLoadPicks() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM picks ORDER BY base_round DESC, created_at DESC LIMIT 1000`,
  );
  return rows.map(rowToPick);
}

export async function dbAddPick(entry) {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO picks (id, created_at, base_round, numbers, meta, source) VALUES (?,?,?,?,?,?)`,
    String(entry.id), Number(entry.createdAt) || Date.now(),
    entry.baseRound ?? null,
    JSON.stringify(entry.numbers || []),
    JSON.stringify(entry.meta || {}),
    entry.source || 'manual',
  );
}

export async function dbRemovePick(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM picks WHERE id = ?`, String(id));
}

export async function dbClearPicks() {
  const db = await getDb();
  await db.runAsync(`DELETE FROM picks`);
}

// ── 구입번호 ──
function rowToPurchase(r) {
  return {
    id: r.id,
    createdAt: r.created_at,
    round: r.round,
    source: r.source,
    games: JSON.parse(r.games || '[]'),
    note: r.note || '',
    results: r.results ? JSON.parse(r.results) : null,
    drawDate: r.draw_date || null,
    winning: r.winning ? JSON.parse(r.winning) : null,
    bonus: r.bonus,
  };
}

export async function dbLoadPurchases() {
  const db = await getDb();
  const rows = await db.getAllAsync(`SELECT * FROM purchases ORDER BY created_at DESC LIMIT 1000`);
  return rows.map(rowToPurchase);
}

export async function dbAddPurchase(entry) {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO purchases (id, created_at, round, source, games, note, results, draw_date, winning, bonus) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    String(entry.id), Number(entry.createdAt) || Date.now(),
    Number(entry.round) || 0, entry.source || null,
    JSON.stringify(entry.games || []), entry.note || null,
    entry.results ? JSON.stringify(entry.results) : null,
    entry.drawDate || null,
    entry.winning ? JSON.stringify(entry.winning) : null,
    entry.bonus ?? null,
  );
}

export async function dbUpdatePurchase(id, patch) {
  const db = await getDb();
  const cur = await db.getFirstAsync(`SELECT * FROM purchases WHERE id = ?`, String(id));
  if (!cur) return;
  const merged = { ...rowToPurchase(cur), ...patch };
  await dbAddPurchase(merged);
}

export async function dbRemovePurchase(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM purchases WHERE id = ?`, String(id));
}

export async function dbClearPurchases() {
  const db = await getDb();
  await db.runAsync(`DELETE FROM purchases`);
}

// ── 백업/복원 ──
export async function exportAllData() {
  const db = await getDb();
  const settings = await db.getAllAsync(`SELECT key, value FROM app_settings`);
  const weights = await db.getAllAsync(`SELECT algo_id, weight FROM algo_weights`);
  const picks = await db.getAllAsync(`SELECT * FROM picks`);
  const purchases = await db.getAllAsync(`SELECT * FROM purchases`);
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    appName: 'spagenio-lotto',
    settings, weights, picks, purchases,
  };
}

export async function importAllData(payload, { merge = false } = {}) {
  if (!payload || payload.appName !== 'spagenio-lotto') {
    throw new Error('백업 파일 형식이 올바르지 않습니다.');
  }
  const db = await getDb();
  await db.execAsync('BEGIN');
  try {
    if (!merge) {
      await db.execAsync(`
        DELETE FROM app_settings WHERE key NOT IN ('schema_version');
        DELETE FROM algo_weights;
        DELETE FROM picks;
        DELETE FROM purchases;
      `);
    }

    for (const s of (payload.settings || [])) {
      if (s.key === 'schema_version') continue;
      await db.runAsync(`INSERT OR REPLACE INTO app_settings (key, value) VALUES (?,?)`, s.key, s.value);
    }
    for (const w of (payload.weights || [])) {
      await db.runAsync(
        `INSERT OR REPLACE INTO algo_weights (algo_id, weight, updated_at) VALUES (?,?,?)`,
        w.algo_id, Number(w.weight) || 0, Date.now(),
      );
    }
    for (const p of (payload.picks || [])) {
      await db.runAsync(
        `INSERT OR REPLACE INTO picks (id, created_at, base_round, numbers, meta, source) VALUES (?,?,?,?,?,?)`,
        p.id, Number(p.created_at) || Date.now(), p.base_round ?? null, p.numbers, p.meta || null,
        p.source || 'manual',
      );
    }
    for (const p of (payload.purchases || [])) {
      await db.runAsync(
        `INSERT OR REPLACE INTO purchases (id, created_at, round, source, games, note, results, draw_date, winning, bonus) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        p.id, Number(p.created_at) || Date.now(), Number(p.round) || 0, p.source, p.games,
        p.note, p.results, p.draw_date, p.winning, p.bonus ?? null,
      );
    }
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

// 앱 시작 시 호출 — DB 미리 오픈해서 마이그레이션 트리거
export async function initDb() {
  await getDb();
}
