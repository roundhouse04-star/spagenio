/**
 * 교토 지하철
 * - 카라스마선 (烏丸線, K)
 * - 도자이선 (東西線, T)
 * + 케이한, 한큐 등 사철은 제외 (subway만)
 *
 * OSM 검색: '京都市' 또는 'Kyoto'
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'kyoto',
    cityName: '京都市',
    cityNameAlt: 'Kyoto',
    nameKo: '교토',
    nameEn: 'Kyoto',
    country: 'JP',
    timezone: 'Asia/Tokyo',
    routeTypes: ['subway'],
    linePrefix: 'kyoto',
    defaultColors: {
      'K': '#1B964F', // 카라스마선 녹색
      'T': '#D9402B', // 도자이선 주황
      '1': '#1B964F',
      '2': '#D9402B',
    },
    lineNameKo: (ref, name) => {
      const map: Record<string, string> = {
        'K': '카라스마선',
        'T': '도자이선',
        '1': '카라스마선',
        '2': '도자이선',
      };
      return map[ref] || name;
    },
  });
  
  const outPath = path.join(__dirname, '..', 'out', 'kyoto.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
