/**
 * 부산 지하철 크롤링
 * - 부산교통공사: 1~4호선
 * - 부산김해경전철 (BGL)
 * - 동해선 (광역철도, 부산~울산)
 *
 * OSM 검색 키: '부산광역시' 또는 'Busan'
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'busan',
    cityName: '부산광역시',
    cityNameAlt: 'Busan',
    nameKo: '부산',
    nameEn: 'Busan',
    country: 'KR',
    timezone: 'Asia/Seoul',
    // 4호선은 OSM에서 'monorail' (반여 모노레일), BGL은 'light_rail'
    routeTypes: ['subway', 'light_rail', 'monorail'],
    // BGL 김해경전철 일부 역이 김해시 안 → 김해시 area 도 포함
    extraAreas: ['김해시', 'Gimhae'],
    stationMatchRadiusM: 400,
    linePrefix: 'busan',
    // 부산 공식 노선 색상
    defaultColors: {
      '1': '#F06A00', // 1호선 주황
      '2': '#81BF48', // 2호선 녹색
      '3': '#BB8C00', // 3호선 갈색
      '4': '#217DCB', // 4호선 청색
      'BGL': '#A085C7', // 김해경전철 보라
      '동해선': '#0070BB', // 동해선 진한 파랑
    },
    lineNameKo: (ref, name) => {
      if (ref === 'BGL') return '김해경전철';
      if (ref.includes('동해')) return '동해선';
      if (/^\d+$/.test(ref)) return `${ref}호선`;
      return name;
    },
  });
  
  const outPath = path.join(__dirname, '..', 'out', 'busan.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
