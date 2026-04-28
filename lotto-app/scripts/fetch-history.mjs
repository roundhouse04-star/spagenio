// 1회부터 최신 회차까지 전부 받아서 assets/lotto-history.json 으로 저장
// - 병렬 batch (10개 동시) 로 ~1~2분 내 완료
// - 기존 JSON 이 있으면 누락분만 재요청 (resumable)
// - 빌드 시 번들링되어 첫 실행에서 즉시 로드 + 모든 분석에 활용
import fs from 'fs';
import path from 'path';

const ENDPOINT = 'https://lotto.oot.kr/api/lotto/';
const OUT_FILE = path.join(import.meta.dirname, '..', 'assets', 'lotto-history.json');
const BATCH_SIZE = 10;       // 동시 요청 수 (서버 부담 vs 속도 균형)
const RETRIES = 3;
const DELAY_BETWEEN_BATCH = 50; // ms

function estimateLatestRound() {
  const start = new Date('2002-12-07T00:00:00+09:00');
  const weeks = Math.floor((Date.now() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return weeks + 1;
}

async function fetchOneRaw(drwNo) {
  const res = await fetch(ENDPOINT + drwNo);
  if (!res.ok) return null;
  const d = await res.json();
  if (!d || !d.drwtNo1) return null;
  return {
    drwNo: d.drwNo,
    drwDate: d.drwNoDate,
    numbers: [d.drwtNo1, d.drwtNo2, d.drwtNo3, d.drwtNo4, d.drwtNo5, d.drwtNo6].sort((a, b) => a - b),
    bonus: d.bnusNo,
    prizes: {
      1: { count: d.firstPrzwnerCo, amount: d.firstWinamnt, auto: d.firstAutoPrzwnerCo, manual: d.firstManualPrzwnerCo, semi: d.firstSemiAutoPrzwnerCo },
      2: { count: d.secondPrzwnerCo, amount: d.secondWinamnt },
      3: { count: d.thirdPrzwnerCo, amount: d.thirdWinamnt },
      4: { count: d.fourthPrzwnerCo, amount: d.fourthWinamnt },
      5: { count: d.fifthPrzwnerCo, amount: d.fifthWinamnt },
    },
  };
}

async function fetchOneRetry(drwNo) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const r = await fetchOneRaw(drwNo);
      if (r) return r;
    } catch (e) {
      if (attempt === RETRIES) throw e;
    }
    await new Promise((res) => setTimeout(res, 200 * attempt));
  }
  return null;
}

async function detectLatest() {
  let probe = estimateLatestRound() + 1;
  for (let i = 0; i < 4; i++) {
    const r = await fetchOneRaw(probe);
    if (r) return r.drwNo;
    probe -= 1;
  }
  return estimateLatestRound();
}

// 기존 데이터 로드 (resumable)
let existing = {};
try {
  if (fs.existsSync(OUT_FILE)) {
    existing = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
    console.log(`📂 기존 ${Object.keys(existing).length}회차 로드됨 (재시작)`);
  }
} catch (e) { console.log('기존 파일 무시:', e.message); }

const latest = await detectLatest();
console.log(`📅 최신 회차: ${latest}`);

// 누락된 회차만 추출
const missing = [];
for (let n = 1; n <= latest; n++) {
  if (!existing[n]) missing.push(n);
}
console.log(`🔍 받아올 회차: ${missing.length}개 (총 ${latest}회 중 ${latest - missing.length}회 보유)`);

if (missing.length === 0) {
  console.log('✅ 누락 없음, 갱신 불필요');
  process.exit(0);
}

const out = { ...existing };
let success = 0, failed = 0;
const t0 = Date.now();

// 병렬 batch 처리
for (let i = 0; i < missing.length; i += BATCH_SIZE) {
  const batch = missing.slice(i, i + BATCH_SIZE);
  const results = await Promise.all(
    batch.map((n) => fetchOneRetry(n).catch(() => null).then((r) => ({ n, r })))
  );
  for (const { n, r } of results) {
    if (r) { out[n] = r; success += 1; }
    else { failed += 1; }
  }
  // 진행률
  const done = i + batch.length;
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  process.stdout.write(`\r  진행: ${done}/${missing.length} (${(done / missing.length * 100).toFixed(0)}%) · 성공 ${success} · 실패 ${failed} · ${elapsed}s`);
  // 100개마다 중간 저장 (장시간 작업 안전망)
  if (done % 100 === 0) {
    fs.writeFileSync(OUT_FILE, JSON.stringify(out));
  }
  await new Promise((res) => setTimeout(res, DELAY_BETWEEN_BATCH));
}
console.log();

// 최종 저장
const json = JSON.stringify(out);
fs.writeFileSync(OUT_FILE, json);

console.log();
console.log(`✅ 완료: ${Object.keys(out).length}회차 저장`);
console.log(`📦 파일 크기: ${(json.length / 1024).toFixed(1)} KB`);
console.log(`⏱️  소요 시간: ${((Date.now() - t0) / 1000).toFixed(1)}초`);
if (failed > 0) console.log(`⚠️  실패 ${failed}건 — 다시 실행하면 재시도됨`);
