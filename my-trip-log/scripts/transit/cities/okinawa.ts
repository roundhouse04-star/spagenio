/**
 * 오키나와 도시 모노레일 (유이레일) — 나하시 운영
 * OSM key: 那覇市 / Naha
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'okinawa',
    cityName: '那覇市',
    cityNameAlt: 'Naha',
    nameKo: '오키나와',
    nameEn: 'Okinawa',
    country: 'JP',
    timezone: 'Asia/Tokyo',
    routeTypes: ['monorail'],
    linePrefix: 'okinawa',
    extraAreas: ['浦添市', 'Urasoe'], // 유이레일이 우라소에까지 연장
    defaultColors: {
      'ゆいレール': '#0093C8',
      'Yui Rail': '#0093C8',
    },
    lineNameKo: () => '유이레일',
  });
  const outPath = path.join(__dirname, '..', 'out', 'okinawa.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
