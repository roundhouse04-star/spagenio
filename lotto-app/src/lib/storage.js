// storage 외관 — 내부적으로 SQLite를 사용
// 기존 호출 시그니처는 그대로 유지
import {
  dbLoadWeights, dbSaveWeights,
  dbLoadPicks, dbAddPick, dbRemovePick, dbClearPicks,
  dbLoadPurchases, dbAddPurchase, dbUpdatePurchase, dbRemovePurchase, dbClearPurchases,
} from './db';

export async function loadWeights() { return dbLoadWeights(); }
export async function saveWeights(algos) { return dbSaveWeights(algos); }

export async function loadPicks() { return dbLoadPicks(); }
export async function savePicks() {
  // 더 이상 일괄 저장이 필요 없음 (개별 entry는 addPickEntry/removePick 사용)
}

export async function addPickEntry(entry) {
  await dbAddPick(entry);
  return await dbLoadPicks();
}

export async function removePick(id) {
  await dbRemovePick(id);
  return await dbLoadPicks();
}

export async function clearAllPicks() { await dbClearPicks(); }

// ── 구입번호 ──
export async function loadPurchases() { return dbLoadPurchases(); }

export async function savePurchases() {
  // 더 이상 사용하지 않음 (개별 처리)
}

export async function addPurchase(entry) {
  await dbAddPurchase(entry);
  return await dbLoadPurchases();
}

export async function updatePurchase(id, patch) {
  await dbUpdatePurchase(id, patch);
  return await dbLoadPurchases();
}

export async function removePurchase(id) {
  await dbRemovePurchase(id);
  return await dbLoadPurchases();
}

export async function clearAllPurchases() { await dbClearPurchases(); }
