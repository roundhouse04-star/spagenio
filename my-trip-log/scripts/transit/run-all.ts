/**
 * 모든 도시 순차 크롤링
 * 1개 실패해도 다음 도시 계속 진행
 *
 * 사용법:
 *   npx tsx run-all.ts
 *   npx tsx run-all.ts busan fukuoka  # 특정 도시만
 */
import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const ALL_CITIES = [
  // 1차 (2026-05-12)
  'busan', 'fukuoka', 'kyoto', 'taipei', 'shanghai', 'beijing',
  // 2차 (2026-05-13) — 한국인 인기 + 주요 메트로 도시
  'sapporo', 'okinawa', 'qingdao',
  'kualalumpur', 'manila', 'hochiminh',
  'madrid', 'milan', 'prague', 'vienna',
  'losangeles', 'sydney',
  'dubai', 'istanbul', 'cairo', 'mecca',
];

async function main() {
  const args = process.argv.slice(2);
  const targets = args.length > 0 ? args : ALL_CITIES;

  console.log(`🚇 크롤링 대상: ${targets.join(', ')}\n`);

  const results: Array<{ city: string; ok: boolean; error?: string }> = [];

  for (const city of targets) {
    const scriptPath = path.join(__dirname, 'cities', `${city}.ts`);
    if (!fs.existsSync(scriptPath)) {
      console.error(`❌ 스크립트 없음: ${scriptPath}`);
      results.push({ city, ok: false, error: 'script not found' });
      continue;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏙️  ${city.toUpperCase()}`);
    console.log(`${'='.repeat(60)}`);

    const start = Date.now();
    const proc = spawnSync('npx', ['tsx', scriptPath], {
      stdio: 'inherit',
      cwd: __dirname,
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    if (proc.status === 0) {
      console.log(`✅ ${city}: 성공 (${elapsed}s)`);
      results.push({ city, ok: true });
    } else {
      console.log(`❌ ${city}: 실패 (${elapsed}s)`);
      results.push({ city, ok: false, error: `exit code ${proc.status}` });
    }
  }

  // 요약
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 결과 요약');
  console.log(`${'='.repeat(60)}`);
  for (const r of results) {
    console.log(`  ${r.ok ? '✅' : '❌'} ${r.city}${r.error ? ' - ' + r.error : ''}`);
  }

  const okCount = results.filter((r) => r.ok).length;
  console.log(`\n총 ${okCount}/${results.length} 성공`);

  if (okCount === results.length) {
    console.log('\n다음 단계:');
    console.log('  npx tsx merge.ts            # 기존 transit.json에 병합');
  }
}

main().catch((e) => {
  console.error('❌ 실행 오류:', e);
  process.exit(1);
});
