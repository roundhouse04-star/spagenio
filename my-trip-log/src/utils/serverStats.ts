/**
 * 서버 가입자 통계 등록/갱신
 *
 * 컨셉:
 * - 모든 데이터는 로컬 SQLite에 보관
 * - 사용자가 동의한 경우에만 익명 통계를 통계 서버에 전송
 * - 네트워크 오류는 조용히 무시 (다음 실행 시 재시도)
 */
import * as Application from 'expo-constants';
import { Platform } from 'react-native';
import * as Localization from 'expo-localization';
import { getDB } from '@/db/database';

const SERVER_BASE_URL = 'https://travel.spagenio.com';
// 로컬 개발 시 임시 변경 가능: const SERVER_BASE_URL = 'http://192.168.x.x:19080';

const TIMEOUT_MS = 5000;

/**
 * 사용자 정보 + 동의 정보 조회
 */
async function getUserInfo() {
  const db = await getDB();
  const u = await db.getFirstAsync<any>('SELECT * FROM user LIMIT 1');
  if (!u) return null;
  return {
    anonId: u.anon_id,
    nickname: u.nickname,
    nationality: u.nationality,
    agreeStats: !!u.agree_stats,
    agreeSnsAlert: !!u.agree_sns_alert,
    registered: !!u.server_registered,
  };
}

/**
 * 사용 통계 (여행 수, 기록 수)
 */
async function getUsageStats() {
  const db = await getDB();
  const trip = await db.getFirstAsync<any>('SELECT COUNT(*) as c FROM trips');
  const log = await db.getFirstAsync<any>('SELECT COUNT(*) as c FROM trip_logs');
  return {
    tripCount: trip?.c ?? 0,
    logCount: log?.c ?? 0,
  };
}

/**
 * 서버에 가입 등록 (최초 1회)
 * - 통계 동의자만 호출
 * - 성공 시 server_registered = 1로 표시
 */
export async function registerOnServer(): Promise<boolean> {
  try {
    const user = await getUserInfo();
    if (!user) return false;
    if (!user.agreeStats) return false;
    if (!user.anonId) return false;

    const stats = await getUsageStats();
    const appVersion = Application.default?.expoConfig?.version ?? '1.0.0';

    const body = {
      anonId: user.anonId,
      nickname: user.nickname,
      nationality: user.nationality,
      os: Platform.OS,
      osVersion: String(Platform.Version ?? ''),
      appVersion,
      deviceLocale: Localization.getLocales?.()[0]?.languageTag ?? 'ko-KR',
      agreeStats: user.agreeStats,
      agreeSnsAlert: user.agreeSnsAlert,
      tripCount: stats.tripCount,
      logCount: stats.logCount,
    };

    const res = await fetchWithTimeout(`${SERVER_BASE_URL}/api/app/mytriplog/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, TIMEOUT_MS);

    if (!res.ok) {
      console.warn('[stats] register failed', res.status);
      return false;
    }
    const json = await res.json();
    if (json?.ok && json?.registered) {
      // 등록 성공 표시
      const db = await getDB();
      await db.runAsync(
        `UPDATE user SET server_registered = 1 WHERE id = (SELECT id FROM user LIMIT 1)`
      );
      console.log('[stats] registered on server');
      return true;
    }
    return false;
  } catch (err) {
    // 네트워크 오류 등은 조용히 무시
    console.warn('[stats] register error:', String(err));
    return false;
  }
}

/**
 * 서버에 heartbeat (앱 실행 시마다)
 * - 등록되어 있으면 last_seen_at, 사용 통계 갱신
 * - 실패해도 무시
 */
export async function heartbeatToServer(): Promise<void> {
  try {
    const user = await getUserInfo();
    if (!user) return;
    if (!user.agreeStats) return;
    if (!user.anonId) return;

    const stats = await getUsageStats();
    const appVersion = Application.default?.expoConfig?.version ?? '1.0.0';

    const body = {
      anonId: user.anonId,
      appVersion,
      tripCount: stats.tripCount,
      logCount: stats.logCount,
    };

    const res = await fetchWithTimeout(`${SERVER_BASE_URL}/api/app/mytriplog/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, TIMEOUT_MS);

    if (!res.ok) {
      console.warn('[stats] heartbeat failed', res.status);
      return;
    }
    const json = await res.json();
    // 서버에 등록되어 있지 않으면 register 시도
    if (json?.registered === false) {
      console.log('[stats] not registered on server, retrying register');
      await registerOnServer();
    }
  } catch (err) {
    console.warn('[stats] heartbeat error:', String(err));
  }
}

/**
 * 앱 시작 시 한 번 호출
 * - 등록 안 됐으면 register
 * - 등록 됐으면 heartbeat
 */
export async function syncStatsOnAppStart(): Promise<void> {
  const user = await getUserInfo();
  if (!user || !user.agreeStats) return;

  if (!user.registered) {
    await registerOnServer();
  } else {
    await heartbeatToServer();
  }
}

/**
 * fetch with timeout
 */
function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    fetch(url, init)
      .then((res) => { clearTimeout(timeout); resolve(res); })
      .catch((err) => { clearTimeout(timeout); reject(err); });
  });
}
