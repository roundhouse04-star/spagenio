#!/usr/bin/env node
// 로또 관련 테이블/컬럼을 stock.db 에서 제거.
// 코드(commit 97999b2e)에서 이미 lotto 기능 전면 제거됨 — DB 잔재만 정리.
//
// 사용법:
//   node scripts/drop-lotto-tables.mjs           # 드라이런 (행수만 출력)
//   node scripts/drop-lotto-tables.mjs --apply   # 백업 후 실제 DROP/ALTER
//
// ⚠️ 운영 중인 stock.db 에 직접 작업합니다. --apply 전 PM2 stop 권장:
//   pm2 stop spagenio && node scripts/drop-lotto-tables.mjs --apply && pm2 start spagenio

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'stock.db');
const APPLY = process.argv.includes('--apply');

const LOTTO_TABLES = [
  'lotto_picks',
  'lotto_history',
  'lotto_schedule',
  'lotto_schedule_log',
  'lotto_weights',
  'lotto_algorithm_weights',
  'lotto_algorithm_config',
  'lotto_predictions',
  'lotto_auto_send_log',
  'user_algorithm_weights',
];
const LOTTO_USER_COLUMN = 'lotto_auto_send';
const LOTTO_SCHEDULER_KEYS = ['lotto_send', 'lotto_history'];

if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ DB 파일 없음: ${DB_PATH}`);
  process.exit(1);
}

const db = new Database(DB_PATH);

function tableExists(name) {
  return !!db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?"
  ).get(name);
}
function columnExists(table, col) {
  if (!tableExists(table)) return false;
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col);
}
function rowCount(table) {
  try { return db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c; }
  catch { return 0; }
}

console.log(`📂 DB: ${DB_PATH}`);
console.log(`🔧 모드: ${APPLY ? 'APPLY (실제 변경)' : 'DRY-RUN (미적용)'}\n`);

// 점검
const present = [];
const missing = [];
for (const t of LOTTO_TABLES) {
  if (tableExists(t)) present.push({ table: t, rows: rowCount(t) });
  else missing.push(t);
}

console.log('── 테이블 잔재 ─────────────────');
if (present.length === 0) console.log('  (없음 — 이미 정리됨)');
else present.forEach(p => console.log(`  • ${p.table.padEnd(28)} ${p.rows} rows`));
if (missing.length > 0) console.log(`  · 이미 없음: ${missing.join(', ')}`);

const hasUserCol = columnExists('users', LOTTO_USER_COLUMN);
console.log(`\n── users.${LOTTO_USER_COLUMN} ────────────────`);
console.log(`  ${hasUserCol ? '존재함 → DROP COLUMN 예정' : '없음 (이미 정리됨)'}`);

const schedRows = tableExists('schedulers')
  ? db.prepare(`SELECT key FROM schedulers WHERE key IN (${LOTTO_SCHEDULER_KEYS.map(()=>'?').join(',')})`).all(...LOTTO_SCHEDULER_KEYS)
  : [];
console.log(`\n── schedulers seed ───────────────`);
if (schedRows.length === 0) console.log('  (없음)');
else schedRows.forEach(r => console.log(`  • ${r.key} → DELETE 예정`));

if (!APPLY) {
  console.log('\nℹ️  실제 적용하려면 --apply 옵션을 붙이세요.');
  console.log('   먼저 pm2 stop spagenio 권장.');
  process.exit(0);
}

// 백업
const backupPath = `${DB_PATH}.bak-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
fs.copyFileSync(DB_PATH, backupPath);
console.log(`\n💾 백업 완료: ${backupPath}`);

// 적용
const tx = db.transaction(() => {
  for (const { table } of present) {
    db.exec(`DROP TABLE IF EXISTS ${table}`);
    console.log(`  ✂ DROP ${table}`);
  }
  if (schedRows.length > 0) {
    const stmt = db.prepare('DELETE FROM schedulers WHERE key=?');
    schedRows.forEach(r => { stmt.run(r.key); console.log(`  ✂ DELETE scheduler ${r.key}`); });
  }
  if (hasUserCol) {
    // SQLite 3.35+ 지원
    db.exec(`ALTER TABLE users DROP COLUMN ${LOTTO_USER_COLUMN}`);
    console.log(`  ✂ ALTER users DROP COLUMN ${LOTTO_USER_COLUMN}`);
  }
});

tx();
db.exec('VACUUM');
console.log('\n✅ 완료. VACUUM 실행됨.');
console.log(`   롤백: cp "${backupPath}" "${DB_PATH}"`);
