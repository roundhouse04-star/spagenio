/**
 * transit.json 무결성 검사 + 도시별 통계
 *
 * 사용법:
 *   npx tsx inspect.ts                # 전체 통계
 *   npx tsx inspect.ts busan          # 부산만 자세히
 */
import * as fs from 'fs';
import * as path from 'path';

const TRANSIT_JSON = path.resolve(__dirname, '..', '..', 'src', 'data', 'transit.json');

function main() {
  const args = process.argv.slice(2);
  const cityFilter = args[0];

  if (!fs.existsSync(TRANSIT_JSON)) {
    console.error(`❌ ${TRANSIT_JSON} 없음`);
    process.exit(1);
  }

  const transit = JSON.parse(fs.readFileSync(TRANSIT_JSON, 'utf-8'));

  console.log(`📂 ${TRANSIT_JSON}`);
  console.log(`📅 exportedAt: ${transit.exportedAt || '(unknown)'}`);
  console.log(`📊 총 도시 ${transit.cities.length}, 노선 ${transit.lines.length}, 역 ${transit.stations.length}\n`);

  for (const city of transit.cities) {
    if (cityFilter && city.id !== cityFilter) continue;

    const lines = transit.lines.filter((l: any) => l.cityId === city.id);
    const stations = transit.stations.filter((s: any) => s.cityId === city.id);
    const stationIds = new Set(stations.map((s: any) => s.id));
    const stationLines = transit.stationLines.filter((sl: any) => stationIds.has(sl.stationId));
    const connections = transit.connections.filter(
      (c: any) => stationIds.has(c.from) && stationIds.has(c.to)
    );
    const transferStations = stations.filter((s: any) => s.isTransfer === 1).length;

    console.log(`🏙️  ${city.id} - ${city.nameKo} (${city.country})`);
    console.log(`    노선 ${lines.length}, 역 ${stations.length} (환승 ${transferStations}), 연결 ${connections.length}`);

    if (cityFilter) {
      // 자세히
      console.log('\n    [노선 목록]');
      for (const l of lines) {
        const lineStations = stationLines.filter((sl: any) => sl.lineId === l.id).length;
        console.log(`      ${l.color} ${l.nameKo.padEnd(15)} ${lineStations}개 역`);
      }
    }
  }

  // 무결성 검사
  console.log('\n🔍 무결성 검사');
  const allStationIds = new Set(transit.stations.map((s: any) => s.id));
  const allLineIds = new Set(transit.lines.map((l: any) => l.id));
  let issues = 0;
  for (const sl of transit.stationLines) {
    if (!allStationIds.has(sl.stationId)) {
      console.warn(`  ❌ stationLine: 없는 station ${sl.stationId}`);
      issues++;
    }
    if (!allLineIds.has(sl.lineId)) {
      console.warn(`  ❌ stationLine: 없는 line ${sl.lineId}`);
      issues++;
    }
    if (issues > 10) {
      console.warn(`  ... (이외 다수)`);
      break;
    }
  }
  if (issues === 0) console.log('  ✅ 모든 참조 무결');
}

main();
