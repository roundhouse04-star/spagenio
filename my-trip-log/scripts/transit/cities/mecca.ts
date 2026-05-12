/**
 * 메카 메트로 — Mashaer (성지 순례 노선)
 * OSM key: مكة المكرمة / Mecca / Makkah
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'mecca',
    cityName: 'مكة المكرمة',
    cityNameAlt: 'Mecca',
    nameKo: '메카',
    nameEn: 'Mecca',
    country: 'SA',
    timezone: 'Asia/Riyadh',
    routeTypes: ['subway', 'light_rail', 'monorail'],
    linePrefix: 'mecca',
    preferEnglish: true,
    extraAreas: ['Makkah', 'Makkah Region', 'Makkah Province'],
    stationMatchRadiusM: 1000,
  });
  const outPath = path.join(__dirname, '..', 'out', 'mecca.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
