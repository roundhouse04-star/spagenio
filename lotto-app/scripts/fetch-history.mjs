// 최근 100회차를 lotto.oot.kr 에서 받아서 assets/lotto-history.json 으로 저장
// 앱 빌드 시 번들링되어 첫 실행에서 즉시 로드됨
import fs from 'fs';
import path from 'path';

const ENDPOINT = 'https://lotto.oot.kr/api/lotto/';
const OUT_FILE = path.join(import.meta.dirname, '..', 'assets', 'lotto-history.json');
const COUNT = 100;

// 현재 최신 회차 탐지 (1회차: 2002-12-07 토)
function estimateLatestRound() {
  const start = new Date('2002-12-07T00:00:00+09:00');
  const weeks = Math.floor((Date.now() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return weeks + 1;
}

async function fetchOne(drwNo) {
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

// 최신 회차 probe (estimate ± 2)
async function detectLatest() {
  let probe = estimateLatestRound() + 1;
  for (let i = 0; i < 4; i++) {
    const r = await fetchOne(probe);
    if (r) return r.drwNo;
    probe -= 1;
  }
  return estimateLatestRound();
}

const latest = await detectLatest();
console.log(`최신 회차: ${latest}`);
console.log(`${latest - COUNT + 1} ~ ${latest} 까지 ${COUNT}회차 수집...`);

const out = {};
let success = 0;
for (let n = latest; n > Math.max(0, latest - COUNT); n--) {
  process.stdout.write(`  ${n}회... `);
  try {
    const r = await fetchOne(n);
    if (r) {
      out[n] = r;
      success += 1;
      process.stdout.write('✓\n');
    } else {
      process.stdout.write('✗\n');
    }
  } catch (e) {
    process.stdout.write(`✗ ${e.message}\n`);
  }
  // gentle rate-limit
  await new Promise((res) => setTimeout(res, 100));
}

const json = JSON.stringify(out);
fs.writeFileSync(OUT_FILE, json);
console.log(`\n✅ ${success}회차 저장 → ${OUT_FILE}`);
console.log(`📦 파일 크기: ${(json.length / 1024).toFixed(1)} KB`);
