/**
 * out/*.json 의 도시 데이터를 src/data/transit.json 에 병합
 *
 * 안전 조치:
 *   - 기존 transit.json 백업 (transit.json.backup-YYYYMMDD-HHMMSS)
 *   - 같은 cityId 있으면 기존 city/lines/stations/stationLines/connections 모두 제거 후 새 데이터로 대체
 *   - dry-run 모드 (--dry) 지원
 *
 * 사용법:
 *   npx tsx merge.ts            # 실제 병합
 *   npx tsx merge.ts --dry      # 변경사항만 출력
 *   npx tsx merge.ts busan      # 특정 도시만 병합
 */
import * as fs from 'fs';
import * as path from 'path';
import { CityResult, validateCityResult } from './lib/schema';

const TRANSIT_JSON = path.resolve(__dirname, '..', '..', 'src', 'data', 'transit.json');
const OUT_DIR = path.join(__dirname, 'out');

type TransitJson = {
  exportedAt?: string;
  source?: string;
  cities: any[];
  lines: any[];
  stations: any[];
  stationLines: any[];
  connections: any[];
};

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry');
  const cityFilter = args.filter((a) => !a.startsWith('--'));

  console.log(`🔧 Merge 시작 ${dryRun ? '(DRY RUN)' : ''}`);
  console.log(`  대상: ${TRANSIT_JSON}`);

  if (!fs.existsSync(TRANSIT_JSON)) {
    console.error(`❌ transit.json 없음: ${TRANSIT_JSON}`);
    process.exit(1);
  }

  const transit: TransitJson = JSON.parse(fs.readFileSync(TRANSIT_JSON, 'utf-8'));
  console.log(`  현재 도시: ${transit.cities.length}, 노선: ${transit.lines.length}, 역: ${transit.stations.length}`);

  // out/ 의 모든 도시 결과 로드
  const outFiles = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.json'));
  const cityResults: CityResult[] = [];
  for (const f of outFiles) {
    const cityId = f.replace(/\.json$/, '');
    if (cityFilter.length > 0 && !cityFilter.includes(cityId)) continue;
    try {
      const r: CityResult = JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf-8'));
      const v = validateCityResult(r);
      if (!v.ok) {
        console.warn(`⚠️ ${cityId}: 검증 경고 ${v.errors.length}건 (병합은 진행)`);
        v.errors.slice(0, 3).forEach((e) => console.warn(`   ${e}`));
      }
      cityResults.push(r);
    } catch (e) {
      console.error(`❌ ${f} 파싱 실패: ${(e as Error).message}`);
    }
  }

  if (cityResults.length === 0) {
    console.error('❌ 병합할 도시 데이터가 없습니다.');
    process.exit(1);
  }

  console.log(`\n📦 병합 대상 도시: ${cityResults.map((r) => r.city.id).join(', ')}\n`);

  // 백업
  if (!dryRun) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = `${TRANSIT_JSON}.backup-${ts}.json`;
    fs.copyFileSync(TRANSIT_JSON, backupPath);
    console.log(`💾 백업: ${backupPath}`);
  }

  // 각 도시별 병합
  for (const r of cityResults) {
    const cid = r.city.id;
    const beforeCity = transit.cities.find((c) => c.id === cid);
    const beforeLines = transit.lines.filter((l) => l.cityId === cid).length;
    const beforeStations = transit.stations.filter((s) => s.cityId === cid).length;

    // 기존 데이터 제거 (connections 는 fromStationId / toStationId 둘 다 체크)
    transit.cities = transit.cities.filter((c) => c.id !== cid);
    transit.lines = transit.lines.filter((l) => l.cityId !== cid);
    const removedStationIds = new Set(
      transit.stations.filter((s) => s.cityId === cid).map((s) => s.id)
    );
    transit.stations = transit.stations.filter((s) => s.cityId !== cid);
    transit.stationLines = transit.stationLines.filter((sl) => !removedStationIds.has(sl.stationId));
    transit.connections = transit.connections.filter(
      (c) => !removedStationIds.has(c.fromStationId ?? c.from) &&
             !removedStationIds.has(c.toStationId ?? c.to)
    );

    // 새 데이터 추가 — transit.json 기존 스키마에 맞춰 필드 변환
    transit.cities.push(r.city);
    transit.lines.push(...r.lines);

    // Station: lat/lon/nameLocal 은 제외, x/y/isTransfer 기본값 보정
    for (const s of r.stations) {
      transit.stations.push({
        id: s.id,
        cityId: s.cityId,
        nameKo: s.nameKo,
        nameEn: s.nameEn,
        x: s.x ?? 0,
        y: s.y ?? 0,
        isTransfer: s.isTransfer ?? 0,
      });
    }

    transit.stationLines.push(...r.stationLines);

    // Connection: from/to/duration(초) → fromStationId/toStationId/travelTime(분)
    const startId = transit.connections.length > 0
      ? Math.max(...transit.connections.map((c) => Number(c.id) || 0)) + 1
      : 1;
    let nextId = startId;
    for (const c of r.connections as any[]) {
      transit.connections.push({
        id: nextId++,
        fromStationId: c.fromStationId ?? c.from,
        toStationId: c.toStationId ?? c.to,
        lineId: c.lineId,
        travelTime: Math.max(1, Math.round((c.travelTime ?? (c.duration ?? 90) / 60))),
        isTransfer: 0,
      });
    }

    const action = beforeCity ? '교체' : '추가';
    console.log(
      `  ${cid}: ${action} (${beforeLines}→${r.lines.length} 노선, ${beforeStations}→${r.stations.length} 역)`
    );
  }

  console.log(`\n📊 병합 후 통계:`);
  console.log(`  도시: ${transit.cities.length}`);
  console.log(`  노선: ${transit.lines.length}`);
  console.log(`  역: ${transit.stations.length}`);
  console.log(`  연결: ${transit.connections.length}`);

  if (dryRun) {
    console.log('\n🔍 DRY RUN - 실제 저장 안 함');
    return;
  }

  transit.exportedAt = new Date().toISOString();
  fs.writeFileSync(TRANSIT_JSON, JSON.stringify(transit, null, 2));
  console.log(`\n✅ 저장 완료: ${TRANSIT_JSON}`);
  const sizeKb = (fs.statSync(TRANSIT_JSON).size / 1024).toFixed(0);
  console.log(`   파일 크기: ${sizeKb} KB`);
}

main();
