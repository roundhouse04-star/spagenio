/**
 * 시드니 메트로 + 라이트레일
 * OSM key: Sydney
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'sydney',
    cityName: 'Sydney',
    nameKo: '시드니',
    nameEn: 'Sydney',
    country: 'AU',
    timezone: 'Australia/Sydney',
    routeTypes: ['subway', 'light_rail'],
    linePrefix: 'sydney',
    preferEnglish: true,
    extraAreas: ['Parramatta', 'North Sydney'],
    stationMatchRadiusM: 500,
  });
  const outPath = path.join(__dirname, '..', 'out', 'sydney.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
