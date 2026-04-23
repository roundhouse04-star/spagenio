/**
 * 상하이 지하철
 * - 1호선 ~ 18호선 + 푸장선 (浦江線)
 *
 * OSM 검색: '上海市' / 'Shanghai'
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'shanghai',
    cityName: '上海市',
    cityNameAlt: 'Shanghai',
    nameKo: '상하이',
    nameEn: 'Shanghai',
    country: 'CN',
    timezone: 'Asia/Shanghai',
    routeTypes: ['subway', 'light_rail'],
    linePrefix: 'shanghai',
    // 상하이 지하철 공식 노선색
    defaultColors: {
      '1': '#E3002C',
      '2': '#8DC044',
      '3': '#FCD000',
      '4': '#5F2E83',
      '5': '#A659A0',
      '6': '#D40068',
      '7': '#ED6F00',
      '8': '#0095D8',
      '9': '#86CEED',
      '10': '#C7AFD3',
      '11': '#871332',
      '12': '#007360',
      '13': '#EF95C4',
      '14': '#7B7C19',
      '15': '#BBAD8E',
      '16': '#33CCCC',
      '17': '#BB7A47',
      '18': '#D3A24F',
      '浦江': '#807F86',
    },
    lineNameKo: (ref, name) => {
      if (ref === '浦江' || ref === 'P') return '푸장선';
      if (/^\d+$/.test(ref)) return `${ref}호선`;
      return name;
    },
  });
  
  const outPath = path.join(__dirname, '..', 'out', 'shanghai.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
