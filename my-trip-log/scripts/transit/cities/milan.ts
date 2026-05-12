/**
 * 밀라노 메트로 — M1~M5
 * OSM key: Milano / Milan
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'milan',
    cityName: 'Milano',
    cityNameAlt: 'Milan',
    nameKo: '밀라노',
    nameEn: 'Milan',
    country: 'IT',
    timezone: 'Europe/Rome',
    routeTypes: ['subway', 'light_rail'],
    linePrefix: 'milan',
    preferEnglish: true,
    lineNameKo: (ref) => /^M?\d+$/.test(ref) ? `${ref.replace(/^M/, '')}호선` : '',
  });
  const outPath = path.join(__dirname, '..', 'out', 'milan.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
