/**
 * 베이징 지하철
 * - 1~17호선, 8호선 등
 * - 공항선 (机场线)
 * - 야좡선 (亦庄), 시자오선 (西郊) 등 경전철
 *
 * OSM 검색: '北京市' / 'Beijing'
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'beijing',
    cityName: '北京市',
    cityNameAlt: 'Beijing',
    nameKo: '베이징',
    nameEn: 'Beijing',
    country: 'CN',
    timezone: 'Asia/Shanghai',
    routeTypes: ['subway', 'light_rail'],
    linePrefix: 'beijing',
    defaultColors: {
      '1': '#A60022',
      '2': '#003795',
      '4': '#01A3DC',
      '5': '#A8005C',
      '6': '#B7A375',
      '7': '#F5C549',
      '8': '#04825D',
      '9': '#92246B',
      '10': '#009BC0',
      '11': '#84C7D5',
      '13': '#FBE100',
      '14': '#D49F94',
      '15': '#71275B',
      '16': '#7AC0AC',
      '17': '#005AAB',
      '机场': '#A29063', // 공항선
      'AP': '#A29063',
      '亦庄': '#7BA0CB', // 야좡선
      'YZ': '#7BA0CB',
      '西郊': '#9DBFA1', // 시자오 경전철
      'X': '#9DBFA1',
      '燕房': '#FF6900', // 옌팡선
      'YF': '#FF6900',
      '房山': '#F4007E', // 팡산선
      'FS': '#F4007E',
      '昌平': '#FFC0CB', // 창핑선
      'CP': '#FFC0CB',
      'S1': '#A6927E',  // S1선
    },
    lineNameKo: (ref, name) => {
      const map: Record<string, string> = {
        '机场': '공항선',
        'AP': '공항선',
        '亦庄': '야좡선',
        'YZ': '야좡선',
        '西郊': '시자오선',
        'X': '시자오선',
        '燕房': '옌팡선',
        'YF': '옌팡선',
        '房山': '팡산선',
        'FS': '팡산선',
        '昌平': '창핑선',
        'CP': '창핑선',
      };
      if (map[ref]) return map[ref];
      if (/^\d+$/.test(ref)) return `${ref}호선`;
      return name;
    },
  });
  
  const outPath = path.join(__dirname, '..', 'out', 'beijing.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
