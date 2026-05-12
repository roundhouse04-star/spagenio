/**
 * 카이로 메트로 — 3 라인
 * OSM key: القاهرة / Cairo
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'cairo',
    cityName: 'Cairo',
    cityNameAlt: 'القاهرة',
    nameKo: '카이로',
    nameEn: 'Cairo',
    country: 'EG',
    timezone: 'Africa/Cairo',
    routeTypes: ['subway'],
    linePrefix: 'cairo',
    preferEnglish: true,
    lineNameKo: (ref) => /^\d+$/.test(ref) ? `${ref}호선` : '',
  });
  const outPath = path.join(__dirname, '..', 'out', 'cairo.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
