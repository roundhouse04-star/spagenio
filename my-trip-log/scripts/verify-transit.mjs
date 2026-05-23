#!/usr/bin/env node
/**
 * transit.json 무결성 검증 — 빌드 전 자동 실행 (npm run verify:transit)
 *
 * 배경: 2026-05-12 에 transit.json 크롤러 스크립트 버그로 데이터가
 *       1.6MB / 일부 도시 누락 상태로 손상된 적 있음. 이후 v1.1-stable
 *       에서 복구. 같은 사고 방지를 위해 빌드 전 자동 검증.
 *
 * 임계값: 현재 v1.1 stable 값의 ~80% 수준에서 cut-off.
 *  - 데이터 변경 시 의도적으로 줄이는 경우엔 이 값도 같이 낮춰야 함.
 *
 * 종료 코드:
 *   0 — 통과
 *   1 — 손상 의심 (빌드 중단)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FILE_PATH = path.resolve(__dirname, '../src/data/transit.json');

// v1.1 stable 기준의 80% 임계값
const MIN = {
  bytes: 2_000_000, // 2.0 MB (실제 2.46MB)
  cities: 30,        // 실제 35
  lines: 230,        // 실제 285
  stations: 4000,    // 실제 5,092
  stationLines: 4800, // 실제 5,946
};

function bail(msg) {
  console.error(`\n❌ transit.json 무결성 검증 실패\n${msg}\n`);
  console.error('빌드를 중단합니다. transit.json 을 git history 또는');
  console.error('src/data/transit.json.v1.1-stable 에서 복구 후 다시 시도하세요.\n');
  process.exit(1);
}

if (!fs.existsSync(FILE_PATH)) {
  bail(`파일이 없음: ${FILE_PATH}`);
}

const stat = fs.statSync(FILE_PATH);
if (stat.size < MIN.bytes) {
  bail(`파일 크기 ${stat.size} bytes < 임계값 ${MIN.bytes} bytes (이전 손상 시 1.6MB)`);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
} catch (err) {
  bail(`JSON 파싱 실패: ${err.message}`);
}

const cities = data.cities?.length ?? 0;
const lines = data.lines?.length ?? 0;
const stations = data.stations?.length ?? 0;
const stationLines = data.stationLines?.length ?? 0;

const failures = [];
if (cities < MIN.cities) failures.push(`cities ${cities} < ${MIN.cities}`);
if (lines < MIN.lines) failures.push(`lines ${lines} < ${MIN.lines}`);
if (stations < MIN.stations) failures.push(`stations ${stations} < ${MIN.stations}`);
if (stationLines < MIN.stationLines) failures.push(`stationLines ${stationLines} < ${MIN.stationLines}`);

if (failures.length > 0) {
  bail(`임계값 미달:\n  - ${failures.join('\n  - ')}`);
}

// 도시별 station=0 인 것 (이전 손상 패턴 — 도시는 있는데 역이 사라짐)
const cityStations = new Map();
for (const s of data.stations ?? []) {
  cityStations.set(s.cityId, (cityStations.get(s.cityId) ?? 0) + 1);
}
const emptyCities = (data.cities ?? []).filter((c) => (cityStations.get(c.id) ?? 0) === 0);
if (emptyCities.length > 0) {
  bail(`역이 0개인 도시 발견: ${emptyCities.map((c) => c.nameKo ?? c.id).join(', ')}`);
}

console.log('✅ transit.json 무결성 OK');
console.log(`   ${(stat.size / 1024 / 1024).toFixed(2)} MB | ${cities} cities | ${lines} lines | ${stations} stations | ${stationLines} stationLines`);
