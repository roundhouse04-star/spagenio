/**
 * 1.1.0 → 1.2.0 백필: 기존 트립의 country_code 채우기
 *
 * 배경:
 *  - 1.1 까지 trips/new.tsx 가 country_code 컬럼을 저장하지 않았음
 *  - 1.2 안전 기능 (외교부 매칭, Geofencing) 은 country_code 가 핵심
 *  - 기존 사용자 데이터를 손상시키지 않고 country/city 텍스트에서 ISO 추론
 *
 * 호출 시점:
 *  - 앱 시작 시 app_meta.country_code_backfill_needed = '1' 이면 1회 실행
 *  - 완료 후 플래그 0 으로 변경 → 다음 부팅에는 skip
 *
 * 멱등성:
 *  - 이미 country_code 있는 트립은 건너뜀
 *  - 추론 실패한 트립은 NULL 유지 → 사용자가 다음 편집 시 자동 추론됨
 */
import { getDB } from '@/db/database';
import { inferCountryCode } from './countryCodeLookup';

const FLAG_KEY = 'country_code_backfill_needed';

export async function maybeBackfillCountryCodes(): Promise<void> {
  try {
    const db = await getDB();

    // 플래그 확인 — '1' 이면 백필 필요
    const flag = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM app_meta WHERE key = ?1`,
      [FLAG_KEY],
    );
    if (flag?.value !== '1') return; // 백필 완료 또는 불필요

    // 빈 country_code 트립만 조회
    const rows = await db.getAllAsync<{
      id: number;
      country: string | null;
      city: string | null;
      city_id: string | null;
    }>(
      `SELECT id, country, city, city_id FROM trips
       WHERE country_code IS NULL OR country_code = ''`,
    );

    let updated = 0;
    let unresolved = 0;
    for (const r of rows) {
      const iso = inferCountryCode({
        cityId: r.city_id,
        city: r.city,
        country: r.country,
      });
      if (iso) {
        await db.runAsync(
          `UPDATE trips SET country_code = ?1, updated_at = ?2 WHERE id = ?3`,
          [iso, new Date().toISOString(), r.id],
        );
        updated += 1;
      } else {
        unresolved += 1;
      }
    }

    // 백필 완료 플래그 변경
    await db.runAsync(
      `INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?1, ?2, datetime('now'))`,
      [FLAG_KEY, '0'],
    );

    console.log(`[backfill] country_code: ${updated} 채움, ${unresolved} 추론 실패 (사용자 편집 시 재시도)`);
  } catch (err) {
    console.warn('[backfill] failed:', err);
    // 실패 시 플래그 그대로 → 다음 부팅에 재시도
  }
}
