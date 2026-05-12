/**
 * 칭다오 지하철
 * OSM key: 青岛市 / Qingdao
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'qingdao',
    cityName: '青岛市',
    cityNameAlt: 'Qingdao',
    nameKo: '칭다오',
    nameEn: 'Qingdao',
    country: 'CN',
    timezone: 'Asia/Shanghai',
    routeTypes: ['subway', 'light_rail'],
    linePrefix: 'qingdao',
    lineNameKo: (ref, name) => {
      if (/^\d+$/.test(ref)) return `${ref}호선`;
      return name;
    },
  });
  const outPath = path.join(__dirname, '..', 'out', 'qingdao.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
