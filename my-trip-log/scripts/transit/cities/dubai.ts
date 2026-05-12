/**
 * 두바이 메트로 — Red·Green Line
 * OSM key: دبي / Dubai
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'dubai',
    cityName: 'Dubai',
    cityNameAlt: 'دبي',
    nameKo: '두바이',
    nameEn: 'Dubai',
    country: 'AE',
    timezone: 'Asia/Dubai',
    routeTypes: ['subway', 'light_rail', 'monorail'],
    linePrefix: 'dubai',
    preferEnglish: true,
    defaultColors: {
      Red: '#E21A23',
      Green: '#00A651',
    },
    lineNameKo: (ref, name) => {
      if (/red/i.test(ref) || /red/i.test(name)) return 'Red 라인';
      if (/green/i.test(ref) || /green/i.test(name)) return 'Green 라인';
      return name;
    },
  });
  const outPath = path.join(__dirname, '..', 'out', 'dubai.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
