/**
 * LA 메트로 — B/D 라인 (subway) + A/C/E/K (light rail)
 * OSM key: Los Angeles
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'losangeles',
    cityName: 'Los Angeles',
    nameKo: 'LA',
    nameEn: 'Los Angeles',
    country: 'US',
    timezone: 'America/Los_Angeles',
    routeTypes: ['subway', 'light_rail'],
    linePrefix: 'la',
    preferEnglish: true,
    extraAreas: ['Long Beach', 'Pasadena', 'Santa Monica'],
    stationMatchRadiusM: 500,
  });
  const outPath = path.join(__dirname, '..', 'out', 'losangeles.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
