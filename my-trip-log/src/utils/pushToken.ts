/**
 * Expo Push Token 발급 + 로컬 DB 저장
 *
 * Phase 2 안전 알림용:
 *  - 외교부 안전공지 수신 시 Cloudflare Workers 가 이 토큰으로 푸시 전송
 *  - 토큰은 디바이스마다 1개만 유지 (push_tokens 테이블 PK=1)
 *  - 매 부팅마다 토큰 갱신 시도 (Apple 이 가끔 토큰을 재발급함)
 *  - 변경 감지 시 synced_to_server=0 으로 마킹 → 다음 sync 때 Cloudflare 로 재전송
 *
 * 의존성:
 *  - expo-notifications: 토큰 발급 + 알림 권한
 *  - expo-device: 시뮬레이터 차단 (시뮬레이터는 토큰 발급 안 됨)
 *  - app.json extra.eas.projectId 필수
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getDB } from '@/db/database';

export interface PushTokenRow {
  expoToken: string;
  platform: 'ios' | 'android';
  deviceId: string | null;
  syncedToServer: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 알림 권한 요청 — 기존 권한 그대로면 prompt 없음. */
export async function ensurePushPermission(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status: requested } = await Notifications.requestPermissionsAsync();
    return requested === 'granted';
  } catch (err) {
    console.warn('[push] permission failed:', err);
    return false;
  }
}

/**
 * Expo Push Token 발급 — EAS projectId 기반.
 * 시뮬레이터/Expo Go 에서는 발급 불가 → null 반환.
 */
async function fetchExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[push] simulator — token skip');
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn('[push] missing EAS projectId in app.json');
    return null;
  }

  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    return result.data; // "ExponentPushToken[xxxxx]"
  } catch (err) {
    console.warn('[push] getExpoPushTokenAsync failed:', err);
    return null;
  }
}

/**
 * Push Token 등록 / 갱신 — 앱 시작 시 한 번 호출.
 * 1) 권한 확인 (없으면 요청)
 * 2) Expo Push Token 발급
 * 3) DB push_tokens (PK=1) 에 저장 / 토큰 변경 시 synced=0 으로 마킹
 *
 * 반환: 현재 디바이스 토큰 (없으면 null)
 */
export async function registerExpoPushToken(): Promise<string | null> {
  const granted = await ensurePushPermission();
  if (!granted) {
    console.log('[push] permission denied — skip token register');
    return null;
  }

  const token = await fetchExpoPushToken();
  if (!token) return null;

  try {
    const db = await getDB();
    const now = new Date().toISOString();
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const deviceId =
      (Device.osInternalBuildId as string | null) ??
      (Device.modelId as string | null) ??
      null;

    const existing = await db.getFirstAsync<{
      expo_token: string;
    }>(`SELECT expo_token FROM push_tokens WHERE id = 1`);

    if (!existing) {
      // 최초 등록
      await db.runAsync(
        `INSERT INTO push_tokens
         (id, expo_token, platform, device_id, synced_to_server, created_at, updated_at)
         VALUES (1, ?, ?, ?, 0, ?, ?)`,
        [token, platform, deviceId, now, now],
      );
      console.log('[push] token registered (first time)');
    } else if (existing.expo_token !== token) {
      // 토큰 갱신 — 서버 재전송 필요
      await db.runAsync(
        `UPDATE push_tokens
         SET expo_token = ?, platform = ?, device_id = ?,
             synced_to_server = 0, updated_at = ?
         WHERE id = 1`,
        [token, platform, deviceId, now],
      );
      console.log('[push] token updated — sync required');
    }
    // 토큰 동일 → 아무 작업 없음
    return token;
  } catch (err) {
    console.warn('[push] DB save failed:', err);
    return token;
  }
}

/** 현재 저장된 토큰 조회 (Cloudflare Workers 등록용). */
export async function getStoredPushToken(): Promise<PushTokenRow | null> {
  try {
    const db = await getDB();
    const row = await db.getFirstAsync<{
      expo_token: string;
      platform: 'ios' | 'android';
      device_id: string | null;
      synced_to_server: number;
      created_at: string;
      updated_at: string;
    }>(`SELECT * FROM push_tokens WHERE id = 1`);
    if (!row) return null;
    return {
      expoToken: row.expo_token,
      platform: row.platform,
      deviceId: row.device_id,
      syncedToServer: row.synced_to_server === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (err) {
    console.warn('[push] getStoredPushToken failed:', err);
    return null;
  }
}

/** Cloudflare Workers 에 등록 성공 → synced 플래그 ON */
export async function markTokenSynced(): Promise<void> {
  try {
    const db = await getDB();
    await db.runAsync(
      `UPDATE push_tokens SET synced_to_server = 1, updated_at = ? WHERE id = 1`,
      [new Date().toISOString()],
    );
  } catch (err) {
    console.warn('[push] markTokenSynced failed:', err);
  }
}

/**
 * 동기화 필요 여부 — Cloudflare Workers 호출 전에 체크.
 * synced_to_server=0 이거나 row 없으면 true.
 */
export async function needsServerSync(): Promise<boolean> {
  const row = await getStoredPushToken();
  if (!row) return false; // 토큰 없으면 동기화 불가
  return !row.syncedToServer;
}
