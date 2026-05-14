/**
 * transit.json 정합성 복구 스크립트
 *
 * 문제:
 *  - stationLines 테이블에 중복 항목 2,689개
 *  - connections 에는 있지만 stationLines 에 누락된 (역, 라인) 페어 1,005개
 *    → 일부 도시의 일부 라인 (예: 서울 5~9호선, NYC 20+개 라인) 이 화면에 빈 노선으로 표시됨
 *
 * 복구 로직:
 *  1) stationLines 중복 제거 — 동일 (stationId, lineId) 페어는 가장 작은 stationOrder 만 남김
 *  2) connections 그래프 순회로 누락 페어 생성
 *     - 각 라인별로 인접 그래프 구축 (양방향)
 *     - degree=1 인 노드 = 종점. 종점부터 BFS 로 1,2,3... order 할당
 *     - 루프 라인 (서울 2호선 등) 은 임의 노드를 1번으로 시작
 *  3) 새 stationLines 항목을 기존 항목과 합쳐서 정렬
 *
 * 백업:
 *  src/data/transit.json.backup-fix-YYYYMMDD.json
 *
 * 실행:
 *  cd scripts/transit && npx tsx fix-station-lines.ts
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const DATA_PATH = path.join(ROOT, 'src/data/transit.json');

interface Station { id: string; cityId: string; nameKo?: string; nameEn?: string; }
interface Line { id: string; cityId: string; nameKo?: string; nameEn?: string; }
interface StationLine { stationId: string; lineId: string; stationOrder: number; }
interface Connection { id?: number; fromStationId: string; toStationId: string; lineId: string; travelTime?: number; isTransfer?: number; }
interface TransitData {
  exportedAt: string;
  source?: string;
  cities: any[];
  lines: Line[];
  stations: Station[];
  stationLines: StationLine[];
  connections: Connection[];
}

const data: TransitData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

// 1) backup
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
const backupPath = path.join(ROOT, `src/data/transit.json.backup-fix-${stamp}.json`);
fs.writeFileSync(backupPath, JSON.stringify(data));
console.log(`✅ Backup → ${path.relative(ROOT, backupPath)}`);

const validLineIds = new Set(data.lines.map((l) => l.id));
const validStationIds = new Set(data.stations.map((s) => s.id));

// 2) 기존 stationLines 중복 제거 — (stationId, lineId) 키 기준
const before = data.stationLines.length;
const dedupedMap = new Map<string, StationLine>();
for (const sl of data.stationLines) {
  const key = `${sl.stationId}::${sl.lineId}`;
  const existing = dedupedMap.get(key);
  if (!existing || sl.stationOrder < existing.stationOrder) {
    dedupedMap.set(key, { ...sl });
  }
}
const dedupedCount = before - dedupedMap.size;
console.log(`✅ stationLines 중복 제거: ${before} → ${dedupedMap.size} (${dedupedCount} 개 제거)`);

// 3) 라인별 connections 그래프 구축 (transfer 라인 제외)
const adjacency: Record<string, Map<string, Set<string>>> = {}; // lineId → station → neighbors
for (const c of data.connections) {
  if (!validLineIds.has(c.lineId)) continue; // transfer 등
  if (!adjacency[c.lineId]) adjacency[c.lineId] = new Map();
  const adj = adjacency[c.lineId];
  if (!adj.has(c.fromStationId)) adj.set(c.fromStationId, new Set());
  if (!adj.has(c.toStationId)) adj.set(c.toStationId, new Set());
  adj.get(c.fromStationId)!.add(c.toStationId);
  adj.get(c.toStationId)!.add(c.fromStationId);
}

// 4) 라인별로 stationLines 누락 페어를 BFS 로 채움
const linesByStationLine: Record<string, Set<string>> = {}; // lineId → existing stationIds
for (const sl of dedupedMap.values()) {
  if (!linesByStationLine[sl.lineId]) linesByStationLine[sl.lineId] = new Set();
  linesByStationLine[sl.lineId].add(sl.stationId);
}

let addedPairs = 0;
let processedLines = 0;
const addedByCity: Record<string, number> = {};
const lineToCity: Record<string, string> = {};
for (const l of data.lines) lineToCity[l.id] = l.cityId;

for (const [lineId, adj] of Object.entries(adjacency)) {
  const existing = linesByStationLine[lineId] ?? new Set<string>();
  const allInGraph = new Set(adj.keys());
  const missing = [...allInGraph].filter((s) => !existing.has(s) && validStationIds.has(s));
  if (missing.length === 0) continue;

  processedLines++;

  // 시작점 선정: degree 1 (종점) 우선, 없으면 누락된 역 중 첫 번째
  let start: string | null = null;
  for (const s of allInGraph) {
    if (adj.get(s)!.size === 1) { start = s; break; }
  }
  if (!start) start = [...allInGraph][0];

  // 기존 stationOrder 최댓값 — 누락 페어의 시작점은 이 다음 번호부터
  let maxOrder = 0;
  for (const sl of dedupedMap.values()) {
    if (sl.lineId === lineId && sl.stationOrder > maxOrder) maxOrder = sl.stationOrder;
  }

  // BFS 로 순회하며 누락된 역에 order 할당
  // (기존 stationLines 에 있는 역은 그대로 두고, 누락된 역만 maxOrder+1, +2, ... 로 추가)
  const visited = new Set<string>();
  const queue: string[] = [start];
  visited.add(start);
  let order = maxOrder + 1;
  const newEntries: StationLine[] = [];

  while (queue.length) {
    const cur = queue.shift()!;
    if (!existing.has(cur) && validStationIds.has(cur)) {
      newEntries.push({ stationId: cur, lineId, stationOrder: order++ });
    }
    for (const nb of adj.get(cur)!) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }

  // 끊긴 컴포넌트가 남았다면 임의로 추가 (이상 케이스 — 거의 발생 안 함)
  for (const s of allInGraph) {
    if (!visited.has(s) && !existing.has(s) && validStationIds.has(s)) {
      newEntries.push({ stationId: s, lineId, stationOrder: order++ });
    }
  }

  if (newEntries.length) {
    for (const e of newEntries) {
      dedupedMap.set(`${e.stationId}::${e.lineId}`, e);
    }
    addedPairs += newEntries.length;
    const city = lineToCity[lineId] ?? '?';
    addedByCity[city] = (addedByCity[city] ?? 0) + newEntries.length;
  }
}

console.log(`✅ 누락 페어 추가: ${addedPairs} 개 (${processedLines} 라인)`);
console.log('   도시별:');
for (const [c, n] of Object.entries(addedByCity).sort((a, b) => b[1] - a[1])) {
  console.log(`     ${c}: +${n}`);
}

// 5) 최종 stationLines 만들기
data.stationLines = Array.from(dedupedMap.values()).sort((a, b) => {
  if (a.lineId !== b.lineId) return a.lineId.localeCompare(b.lineId);
  return a.stationOrder - b.stationOrder;
});

console.log(`\n📦 최종 stationLines: ${data.stationLines.length} 개 (이전 ${before})`);

// 6) 저장
data.exportedAt = new Date().toISOString();
fs.writeFileSync(DATA_PATH, JSON.stringify(data));
console.log(`✅ 저장 → ${path.relative(ROOT, DATA_PATH)}`);
console.log('\n🔍 검증을 위해 inspect.ts 또는 별도 검사 스크립트 실행 권장');
