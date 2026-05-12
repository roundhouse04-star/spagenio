/**
 * 삿포로 지하철 — 3 라인 (남북·동서·도자이/도호)
 * OSM key: 札幌市 / Sapporo
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'sapporo',
    cityName: '札幌市',
    cityNameAlt: 'Sapporo',
    nameKo: '삿포로',
    nameEn: 'Sapporo',
    country: 'JP',
    timezone: 'Asia/Tokyo',
    routeTypes: ['subway'],
    linePrefix: 'sapporo',
    defaultColors: {
      N: '#00B0E7',
      T: '#FFA200',
      H: '#9E4F9E',
    },
    lineNameKo: (ref, name) => {
      if (ref === 'N') return '남북선';
      if (ref === 'T') return '도자이선';
      if (ref === 'H') return '도호선';
      return name;
    },
  });
  const outPath = path.join(__dirname, '..', 'out', 'sapporo.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
