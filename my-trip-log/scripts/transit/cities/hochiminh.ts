/**
 * 호치민 메트로 — 1호선 (2024 개통, 벤탄 ↔ 수오이띠엔)
 * OSM key: Thành phố Hồ Chí Minh / Ho Chi Minh City
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'hochiminh',
    cityName: 'Thành phố Hồ Chí Minh',
    cityNameAlt: 'Ho Chi Minh City',
    nameKo: '호치민',
    nameEn: 'Ho Chi Minh City',
    country: 'VN',
    timezone: 'Asia/Ho_Chi_Minh',
    routeTypes: ['subway', 'light_rail'],
    linePrefix: 'hcm',
    preferEnglish: true,
    lineNameKo: (ref) => /^\d+$/.test(ref) ? `${ref}호선` : '',
  });
  const outPath = path.join(__dirname, '..', 'out', 'hochiminh.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
