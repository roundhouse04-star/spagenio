/**
 * 마드리드 메트로 — 13 라인
 * OSM key: Madrid
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'madrid',
    cityName: 'Madrid',
    nameKo: '마드리드',
    nameEn: 'Madrid',
    country: 'ES',
    timezone: 'Europe/Madrid',
    routeTypes: ['subway', 'light_rail'],
    linePrefix: 'madrid',
    preferEnglish: true,
    lineNameKo: (ref) => /^\d+$/.test(ref) ? `${ref}호선` : '',
  });
  const outPath = path.join(__dirname, '..', 'out', 'madrid.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
