/**
 * 후쿠오카 지하철
 * - 공항선 (空港線, K)
 * - 하코자키선 (箱崎線, H)
 * - 나나쿠마선 (七隈線, N)
 *
 * OSM 검색: '福岡市' 또는 'Fukuoka'
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'fukuoka',
    cityName: '福岡市',
    cityNameAlt: 'Fukuoka',
    nameKo: '후쿠오카',
    nameEn: 'Fukuoka',
    country: 'JP',
    timezone: 'Asia/Tokyo',
    routeTypes: ['subway'],
    linePrefix: 'fukuoka',
    defaultColors: {
      'K': '#F8B500', // 공항선 노랑
      'H': '#0072BC', // 하코자키선 파랑
      'N': '#B8B6CB', // 나나쿠마선 라일락
      '1': '#F8B500',
      '2': '#0072BC',
      '3': '#B8B6CB',
    },
    lineNameKo: (ref, name) => {
      const map: Record<string, string> = {
        'K': '공항선',
        'H': '하코자키선',
        'N': '나나쿠마선',
        '1': '공항선',
        '2': '하코자키선',
        '3': '나나쿠마선',
      };
      return map[ref] || name;
    },
  });
  
  const outPath = path.join(__dirname, '..', 'out', 'fukuoka.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
