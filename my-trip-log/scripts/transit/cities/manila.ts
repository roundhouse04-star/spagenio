/**
 * 마닐라 LRT / MRT
 * OSM key: Manila / City of Manila
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'manila',
    cityName: 'Manila',
    cityNameAlt: 'City of Manila',
    nameKo: '마닐라',
    nameEn: 'Manila',
    country: 'PH',
    timezone: 'Asia/Manila',
    routeTypes: ['subway', 'light_rail'],
    linePrefix: 'manila',
    preferEnglish: true,
    // LRT-1, LRT-2 는 Pasay/Quezon 까지 / MRT-3 는 EDSA 라인
    extraAreas: ['Pasay', 'Quezon City', 'Makati', 'Mandaluyong', 'San Juan', 'Caloocan', 'Marikina'],
    stationMatchRadiusM: 800,
  });
  const outPath = path.join(__dirname, '..', 'out', 'manila.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
