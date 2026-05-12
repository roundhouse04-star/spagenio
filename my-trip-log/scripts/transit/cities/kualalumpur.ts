/**
 * 쿠알라룸푸르 — LRT / MRT / 모노레일
 * OSM key: Kuala Lumpur
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'kualalumpur',
    cityName: 'Kuala Lumpur',
    nameKo: '쿠알라룸푸르',
    nameEn: 'Kuala Lumpur',
    country: 'MY',
    timezone: 'Asia/Kuala_Lumpur',
    routeTypes: ['subway', 'light_rail', 'monorail'],
    linePrefix: 'kl',
    preferEnglish: true,
    extraAreas: ['Petaling Jaya', 'Selangor', 'Subang Jaya', 'Klang', 'Putrajaya'],
    stationMatchRadiusM: 800,
  });
  const outPath = path.join(__dirname, '..', 'out', 'kualalumpur.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
