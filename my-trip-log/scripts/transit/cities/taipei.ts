/**
 * 타이페이 MRT
 * - 문호선/판난선/송산신뎬선/중허신루선/단수이신이선
 * - 환위안선 등
 *
 * OSM 검색: '臺北市' / '台北市' / 'Taipei'
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'taipei',
    cityName: '臺北市',
    cityNameAlt: 'Taipei',
    nameKo: '타이페이',
    nameEn: 'Taipei',
    country: 'TW',
    timezone: 'Asia/Taipei',
    routeTypes: ['subway', 'light_rail'],
    linePrefix: 'taipei',
    // 타이페이 MRT 공식 라인 색상
    defaultColors: {
      'BR': '#C48C31', // 문호선 brown
      '1': '#C48C31',
      'R': '#E3002C',  // 단수이신이선 red
      '2': '#E3002C',
      'G': '#008659',  // 송산신뎬선 green
      '3': '#008659',
      'O': '#F8B61C',  // 중허신루선 orange
      '4': '#F8B61C',
      'BL': '#0070BD', // 판난선 blue
      '5': '#0070BD',
      'Y': '#FFDB00',  // 환위안선 yellow
    },
    lineNameKo: (ref, name) => {
      const map: Record<string, string> = {
        'BR': '문호선',
        'R': '단수이신이선',
        'G': '송산신뎬선',
        'O': '중허신루선',
        'BL': '판난선',
        'Y': '환위안선',
      };
      return map[ref] || name;
    },
  });
  
  const outPath = path.join(__dirname, '..', 'out', 'taipei.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
