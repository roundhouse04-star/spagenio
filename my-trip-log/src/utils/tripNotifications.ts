/**
 * 여행 D-Day / 출발 알림 — expo-notifications 로컬 알림
 *
 * - 외부 푸시 서버 사용 안 함 (완전 로컬)
 * - 사용자 동의 필요 (시스템 알림 권한)
 * - 여행 생성/수정 시 자동으로 알림 등록·갱신
 *
 * 정책:
 *  - D-1 09:00 (출발 전날) "내일 출발해요" 알림
 *  - 출발 당일 06:00 "오늘 출발이에요" 알림
 *  - 과거 일정엔 등록 안 함
 */
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Trip } from '@/types';

const KEY_NOTIF_PREFIX = 'trip_notif_v1_';

interface ScheduledIds {
  dayBefore?: string;
  dayOf?: string;
}

async function getScheduledIds(tripId: number): Promise<ScheduledIds> {
  try {
    const json = await AsyncStorage.getItem(KEY_NOTIF_PREFIX + tripId);
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

async function saveScheduledIds(tripId: number, ids: ScheduledIds): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_NOTIF_PREFIX + tripId, JSON.stringify(ids));
  } catch {/* ignore */}
}

/** 권한 요청 (사용자 거부 시 false). 알림 채널도 같이 설정. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status: requested } = await Notifications.requestPermissionsAsync();
    return requested === 'granted';
  } catch (err) {
    console.warn('[notif] permission failed:', err);
    return false;
  }
}

/** 기존 예약 모두 취소 + 새 일정으로 등록 */
export async function syncTripNotifications(trip: Trip): Promise<void> {
  // 기존 등록 취소
  const old = await getScheduledIds(trip.id);
  if (old.dayBefore) {
    await Notifications.cancelScheduledNotificationAsync(old.dayBefore).catch(() => undefined);
  }
  if (old.dayOf) {
    await Notifications.cancelScheduledNotificationAsync(old.dayOf).catch(() => undefined);
  }
  await saveScheduledIds(trip.id, {});

  if (!trip.startDate) return;
  if (trip.status === 'completed') return;

  // 권한 확인
  const granted = await ensureNotificationPermission();
  if (!granted) return;

  const start = new Date(trip.startDate + 'T00:00:00');
  if (isNaN(start.getTime())) return;

  const now = Date.now();
  const ids: ScheduledIds = {};

  // D-1 알림: 출발 전날 09:00
  const dayBefore = new Date(start);
  dayBefore.setDate(dayBefore.getDate() - 1);
  dayBefore.setHours(9, 0, 0, 0);
  if (dayBefore.getTime() > now) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '내일 출발이에요 ✈️',
          body: `"${trip.title}" — 짐은 다 챙기셨나요?`,
          sound: 'default',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dayBefore },
      });
      ids.dayBefore = id;
    } catch (err) {
      console.warn('[notif] dayBefore schedule failed:', err);
    }
  }

  // 출발 당일 06:00 알림
  const dayOf = new Date(start);
  dayOf.setHours(6, 0, 0, 0);
  if (dayOf.getTime() > now) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '오늘 출발이에요 🛫',
          body: `"${trip.title}" — 즐거운 여행 되세요!`,
          sound: 'default',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dayOf },
      });
      ids.dayOf = id;
    } catch (err) {
      console.warn('[notif] dayOf schedule failed:', err);
    }
  }

  await saveScheduledIds(trip.id, ids);
}

/** 여행 삭제 시 등록된 알림 모두 취소 */
export async function cancelTripNotifications(tripId: number): Promise<void> {
  const old = await getScheduledIds(tripId);
  if (old.dayBefore) {
    await Notifications.cancelScheduledNotificationAsync(old.dayBefore).catch(() => undefined);
  }
  if (old.dayOf) {
    await Notifications.cancelScheduledNotificationAsync(old.dayOf).catch(() => undefined);
  }
  try {
    await AsyncStorage.removeItem(KEY_NOTIF_PREFIX + tripId);
  } catch {/* ignore */}
}
