/**
 * 위험 지역 진입 알림 — iOS / Android 백그라운드 Geofencing
 *
 * 동작:
 *  1. 진행중 트립 (status='ongoing') 의 국가 위험 region 들을 OS Geofencing 에 등록
 *  2. 사용자가 region 진입 시 OS 가 앱을 깨움 → defineTask 콜백 실행
 *  3. 24h 안에 같은 region 알림은 중복 안 보냄 (AsyncStorage 기록)
 *  4. 트립 완료 / 삭제 시 모두 해제
 *
 * 권한 흐름:
 *  - WhenInUse 권한만 있어도 동작은 함 (앱 포어그라운드 + 잠깐 백그라운드)
 *  - Always 권한 있어야 앱이 꺼져있어도 알림 가능 (이상적)
 *  - 사용자가 Always 거부해도 WhenInUse 만으로 부분적 동작
 *
 * 제약:
 *  - iOS: 앱당 최대 20개 region 동시 모니터링 (pickRegionsForCountries 에서 cap)
 *  - Android: 최대 100개 — 충분
 *
 * 데이터 흐름:
 *  defineTask 콜백은 모듈 import 시점에 등록되어야 함 (앱 꺼져있을 때도 OS 가 호출).
 *  → _layout.tsx 에서 이 모듈을 import 만 해두면 자동 등록됨.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getDangerRegionById, pickRegionsForCountries } from '@/data/safety/dangerRegions';

const TASK_NAME = 'triplive-geofence-task';
const DEDUPE_KEY = 'safety_geofence_dedupe_v1';
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

// ──────────────────────────────────────────────────────────
// 백그라운드 Task — 모듈 import 시점에 등록 (이 import 자체로 등록됨)
// ──────────────────────────────────────────────────────────

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn('[geofence] task error:', error);
    return;
  }
  try {
    const body = data as { eventType?: Location.GeofencingEventType; region?: Location.LocationRegion };
    if (!body?.region || body.eventType !== Location.GeofencingEventType.Enter) {
      // Exit 는 무시 (1.2 에선 진입만 알림)
      return;
    }

    const regionId = body.region.identifier;
    if (!regionId) return;

    // 중복 알림 차단 (24h 윈도우)
    if (await wasRecentlyNotified(regionId)) {
      console.log(`[geofence] skip — ${regionId} notified within 24h`);
      return;
    }

    const region = getDangerRegionById(regionId);
    if (!region) {
      console.warn(`[geofence] unknown region: ${regionId}`);
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⚠️ ${region.nameKo} 진입`,
        body: region.message,
        data: {
          type: 'danger_region',
          regionId,
          countryCode: region.countryCode,
          level: region.level,
        },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null, // 즉시
    });

    await markNotified(regionId);
    console.log(`[geofence] notified: ${region.nameKo}`);
  } catch (err) {
    console.warn('[geofence] task body error:', err);
  }
});

// ──────────────────────────────────────────────────────────
// 등록 / 해제 API
// ──────────────────────────────────────────────────────────

/**
 * 진행중 트립 국가들의 위험 region 등록 (전체 재등록 — idempotent).
 *
 * @returns 등록된 region 수 (0 이면 권한 X 또는 region 없음)
 */
export async function syncDangerRegions(countryCodes: string[]): Promise<number> {
  // 권한 확인 — Always 권장이지만 WhenInUse 도 OK
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') {
    console.log('[geofence] no foreground permission');
    return 0;
  }

  const regions = pickRegionsForCountries(countryCodes, 20);
  if (regions.length === 0) {
    // 해당 국가들에 위험 region 없음 → 기존 등록 모두 해제
    await stopAllGeofencing();
    return 0;
  }

  const locationRegions: Location.LocationRegion[] = regions.map((r) => ({
    identifier: r.id,
    latitude: r.latitude,
    longitude: r.longitude,
    radius: r.radiusMeters,
    notifyOnEnter: true,
    notifyOnExit: false,
  }));

  try {
    // 기존 등록 해제 후 새로 등록 (idempotent)
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (isRegistered) {
      await Location.stopGeofencingAsync(TASK_NAME).catch(() => undefined);
    }
    await Location.startGeofencingAsync(TASK_NAME, locationRegions);
    console.log(`[geofence] 등록 ${regions.length}개:`, regions.map((r) => r.id).join(', '));
    return regions.length;
  } catch (err) {
    console.warn('[geofence] startGeofencingAsync 실패:', err);
    return 0;
  }
}

/** 모든 region 모니터링 중지 (트립 완료 시) */
export async function stopAllGeofencing(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (isRegistered) {
      await Location.stopGeofencingAsync(TASK_NAME);
      console.log('[geofence] 모든 region 모니터링 중지');
    }
  } catch (err) {
    console.warn('[geofence] stopGeofencingAsync 실패:', err);
  }
}

/**
 * 현재 OS 에 등록된 region 목록 (디버깅용).
 * iOS / Android 모두 LocationRegion[] 반환.
 */
export async function getActiveRegions(): Promise<Location.LocationRegion[]> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (!isRegistered) return [];
    // expo-location 은 직접 조회 API 없음 → 대신 task option 으로 추정
    // (디버깅 용도 - 실제 region 검증은 native 측 필요)
    return [];
  } catch {
    return [];
  }
}

/**
 * Always 권한 요청 — 트립 시작 시점에 사용자에게 한 번 권유.
 * 거부해도 WhenInUse 만으로 부분 동작.
 */
export async function requestAlwaysPermissionIfNeeded(): Promise<boolean> {
  try {
    // 먼저 WhenInUse 확보
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      const req = await Location.requestForegroundPermissionsAsync();
      if (req.status !== 'granted') return false;
    }

    if (Platform.OS === 'ios') {
      // iOS — Always 요청
      const bg = await Location.getBackgroundPermissionsAsync();
      if (bg.status === 'granted') return true;
      const req = await Location.requestBackgroundPermissionsAsync();
      return req.status === 'granted';
    }

    // Android — ACCESS_BACKGROUND_LOCATION 별도
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status === 'granted') return true;
    const req = await Location.requestBackgroundPermissionsAsync();
    return req.status === 'granted';
  } catch (err) {
    console.warn('[geofence] permission request failed:', err);
    return false;
  }
}

// ──────────────────────────────────────────────────────────
// 24h dedupe (AsyncStorage)
// ──────────────────────────────────────────────────────────

type DedupeMap = Record<string, number>; // regionId → last notified ms

async function loadDedupe(): Promise<DedupeMap> {
  try {
    const raw = await AsyncStorage.getItem(DEDUPE_KEY);
    return raw ? (JSON.parse(raw) as DedupeMap) : {};
  } catch {
    return {};
  }
}

async function wasRecentlyNotified(regionId: string): Promise<boolean> {
  const map = await loadDedupe();
  const last = map[regionId];
  if (!last) return false;
  return Date.now() - last < DEDUPE_WINDOW_MS;
}

async function markNotified(regionId: string): Promise<void> {
  try {
    const map = await loadDedupe();
    map[regionId] = Date.now();

    // 오래된 entry 정리 (48h 이전)
    const cutoff = Date.now() - 2 * DEDUPE_WINDOW_MS;
    for (const id of Object.keys(map)) {
      if (map[id] < cutoff) delete map[id];
    }
    await AsyncStorage.setItem(DEDUPE_KEY, JSON.stringify(map));
  } catch {
    /* silent */
  }
}

/** 디버그/설정 화면용 — dedupe 캐시 모두 삭제 */
export async function clearDedupeCache(): Promise<void> {
  await AsyncStorage.removeItem(DEDUPE_KEY);
}
