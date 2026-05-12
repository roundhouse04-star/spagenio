/**
 * 이스탄불 메트로 — M1~M11 + 트램 + 마르마라이
 * OSM key: İstanbul / Istanbul
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'istanbul',
    cityName: 'İstanbul',
    cityNameAlt: 'Istanbul',
    nameKo: '이스탄불',
    nameEn: 'Istanbul',
    country: 'TR',
    timezone: 'Europe/Istanbul',
    routeTypes: ['subway', 'light_rail'],
    linePrefix: 'istanbul',
    preferEnglish: true,
    lineNameKo: (ref) => /^M\d+[A-Z]?$/.test(ref) ? `${ref}` : '',
  });
  const outPath = path.join(__dirname, '..', 'out', 'istanbul.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
