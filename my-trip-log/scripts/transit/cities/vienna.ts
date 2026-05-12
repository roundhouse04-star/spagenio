/**
 * 비엔나 U-Bahn — U1~U6
 * OSM key: Wien / Vienna
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'vienna',
    cityName: 'Wien',
    cityNameAlt: 'Vienna',
    nameKo: '비엔나',
    nameEn: 'Vienna',
    country: 'AT',
    timezone: 'Europe/Vienna',
    routeTypes: ['subway'],
    linePrefix: 'vienna',
    preferEnglish: true,
    defaultColors: {
      U1: '#E2231A',
      U2: '#9D63A8',
      U3: '#F39200',
      U4: '#00A651',
      U5: '#0C8E97',
      U6: '#B58C5A',
    },
    lineNameKo: (ref) => /^U\d+$/.test(ref) ? `${ref}호선` : '',
  });
  const outPath = path.join(__dirname, '..', 'out', 'vienna.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
