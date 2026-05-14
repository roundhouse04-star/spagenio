/**
 * transit.json 무결성 검증 스크립트
 *
 * 사용 시점:
 *  - 코드 작업 후 데이터가 실수로 바뀌지 않았는지 확인
 *  - 빌드 전 정합성 sanity check
 *  - 정기 점검
 *
 * 검증 항목:
 *  1. transit.json == transit.json.v1.1-stable (MD5 비교)
 *  2. 카운트: 35 도시 / 285 라인 / 5,092 역 / 11,071 connections
 *  3. 정합성: 고립역 0개, 중복 stationLines 0개, 빈 라인 0개
 *
 * 실행:
 *  cd scripts/transit && npx tsx verify-integrity.ts
 *
 * 종료 코드:
 *  0 = 모든 검증 통과
 *  1 = 무결성 실패 (CI/빌드 시 차단 가능)
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT = path.resolve(__dirname, '../..');
const DATA = path.join(ROOT, 'src/data/transit.json');
const STABLE = path.join(ROOT, 'src/data/transit.json.v1.1-stable');

const EXPECTED = {
  cities: 35,
  lines: 285,
  stations: 5092,
  connections: 11071,
  md5: 'c01435f33aa470593478886d4e2faaa6',
};

function md5(file: string): string {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
    pass++;
  } else {
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
    fail++;
  }
}

console.log('🔍 transit.json 무결성 검증\n');

// 1) 파일 존재
console.log('[1] 파일 존재');
const hasData = fs.existsSync(DATA);
const hasStable = fs.existsSync(STABLE);
check('transit.json 존재', hasData);
check('transit.json.v1.1-stable 존재', hasStable);
if (!hasData || !hasStable) {
  console.log('\n❌ 필수 파일 누락 — 검증 중단');
  process.exit(1);
}

// 2) MD5 비교
console.log('\n[2] MD5 체크섬');
const m1 = md5(DATA);
const m2 = md5(STABLE);
check('transit.json MD5 == 예상값', m1 === EXPECTED.md5, m1);
check('transit.json == transit.json.v1.1-stable', m1 === m2);

// 3) 데이터 구조 검증
console.log('\n[3] 데이터 카운트');
const d = JSON.parse(fs.readFileSync(DATA, 'utf8'));
check(`cities: ${EXPECTED.cities}`, d.cities?.length === EXPECTED.cities, `현재 ${d.cities?.length}`);
check(`lines: ${EXPECTED.lines}`, d.lines?.length === EXPECTED.lines, `현재 ${d.lines?.length}`);
check(`stations: ${EXPECTED.stations}`, d.stations?.length === EXPECTED.stations, `현재 ${d.stations?.length}`);
check(`connections: ${EXPECTED.connections}`, d.connections?.length === EXPECTED.connections, `현재 ${d.connections?.length}`);

// 4) 정합성 검증
console.log('\n[4] 정합성');
const lineIds = new Set(d.lines.map((l: any) => l.id));
const stationIds = new Set(d.stations.map((s: any) => s.id));

// 4-1) 고립역
const stationLineCount: Record<string, number> = {};
for (const sl of d.stationLines) {
  stationLineCount[sl.stationId] = (stationLineCount[sl.stationId] ?? 0) + 1;
}
const orphans = d.stations.filter((s: any) => !stationLineCount[s.id]);
check('고립역 0개', orphans.length === 0, `${orphans.length} 개`);

// 4-2) 빈 라인
const lineStationCount: Record<string, number> = {};
for (const sl of d.stationLines) {
  lineStationCount[sl.lineId] = (lineStationCount[sl.lineId] ?? 0) + 1;
}
const emptyLines = d.lines.filter((l: any) => !lineStationCount[l.id]);
check('빈 라인 0개', emptyLines.length === 0, `${emptyLines.length} 개`);

// 4-3) 중복 stationLines
const pairs = new Set<string>();
let dupes = 0;
for (const sl of d.stationLines) {
  const key = `${sl.stationId}::${sl.lineId}`;
  if (pairs.has(key)) dupes++;
  pairs.add(key);
}
check('중복 stationLines 0개', dupes === 0, `${dupes} 개`);

// 4-4) connections 의 lineId 가 lines 에 존재 (transfer 제외)
const phantomConns = d.connections.filter(
  (c: any) => c.lineId !== 'transfer' && !lineIds.has(c.lineId),
);
check(
  'connections lineId 모두 유효',
  phantomConns.length === 0,
  `phantom: ${phantomConns.length}`,
);

// 4-5) connections 의 stationId 가 stations 에 존재
const phantomStations = d.connections.filter(
  (c: any) => !stationIds.has(c.fromStationId) || !stationIds.has(c.toStationId),
);
check(
  'connections stationId 모두 유효',
  phantomStations.length === 0,
  `phantom: ${phantomStations.length}`,
);

// 결과 요약
console.log(`\n📊 결과: ${pass} 통과 / ${fail} 실패`);
if (fail > 0) {
  console.log(
    `\n❌ 무결성 깨짐!\n` +
      `   transit.json 이 1.1-stable 에서 변경됐어요.\n` +
      `   의도된 변경이 아니면 복원:\n` +
      `   cp src/data/transit.json.v1.1-stable src/data/transit.json\n`,
  );
  process.exit(1);
}
console.log('\n✅ 모든 검증 통과 — transit.json 안전\n');
