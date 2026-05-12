/**
 * 프라하 메트로 — A·B·C 3 라인
 * OSM key: Praha / Prague
 */
import * as fs from 'fs';
import * as path from 'path';
import { crawlCity } from '../lib/crawler';

async function main() {
  const result = await crawlCity({
    cityId: 'prague',
    cityName: 'Praha',
    cityNameAlt: 'Prague',
    nameKo: '프라하',
    nameEn: 'Prague',
    country: 'CZ',
    timezone: 'Europe/Prague',
    routeTypes: ['subway'],
    linePrefix: 'prague',
    preferEnglish: true,
    defaultColors: {
      A: '#00A14B',
      B: '#FECC00',
      C: '#E2231A',
    },
    lineNameKo: (ref) => /^[A-Z]$/.test(ref) ? `${ref}선` : '',
  });
  const outPath = path.join(__dirname, '..', 'out', 'prague.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ 저장: ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
