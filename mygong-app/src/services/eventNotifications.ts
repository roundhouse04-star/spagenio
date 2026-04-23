/**
 * 공연 알림 스케줄러.
 *
 * - D-day 알림: 공연 7일 전 / 1일 전 / 당일 아침 9시
 * - 티켓 오픈 알림: 1일 전 같은 시간 / 1시간 전
 *
 * 앱 시작 시 한 번 실행 — 기존 예약 취소 후 재등록.
 */
import * as Notifications from 'expo-notifications';
import { getAllEvents } from '@/db/events';
import type { Event } from '@/types';

const NOTIF_PREFIX = 'mygong-event-';

// 앱 foreground 에서도 표시
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) return true;
    const result = await Notifications.requestPermissionsAsync();
    return result.granted;
  } catch (e: any) {
    console.warn('[notif] permission request failed:', e?.message ?? e);
    return false;
  }
}

export async function scheduleUpcomingEventNotifications(): Promise<number> {
  const granted = await requestNotificationPermission();
  if (!granted) {
    console.log('[notif] permission not granted, skipping');
    return 0;
  }

  // 기존 우리 예약만 취소
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of existing) {
      const id = (n.identifier ?? '') as string;
      if (id.startsWith(NOTIF_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
    }
  } catch (e: any) {
    console.warn('[notif] cancel existing failed:', e?.message ?? e);
  }

  const events = await getAllEvents({ upcoming: true });
  const notifyEvents = events.filter(e => e.notifyEnabled !== false);

  let scheduled = 0;
  for (const ev of notifyEvents) {
    scheduled += await scheduleDDayNotifications(ev);
    if (ev.ticketOpenAt) {
      scheduled += await scheduleTicketOpenNotifications(ev);
    }
  }

  console.log(`[notif] scheduled ${scheduled} for ${notifyEvents.length} events`);
  return scheduled;
}

async function scheduleDDayNotifications(ev: Event): Promise<number> {
  if (!ev.date) return 0;
  const eventDate = new Date(ev.date + 'T' + (ev.time ?? '19:00') + ':00');
  if (isNaN(eventDate.getTime())) return 0;

  const now = new Date();
  let count = 0;

  const triggers: { label: string; at: Date; daysBefore: number }[] = [];

  // D-7 오전 10시
  const d7 = new Date(eventDate);
  d7.setDate(d7.getDate() - 7);
  d7.setHours(10, 0, 0, 0);
  if (d7 > now) triggers.push({ label: 'D-7', at: d7, daysBefore: 7 });

  // D-1 오후 8시
  const d1 = new Date(eventDate);
  d1.setDate(d1.getDate() - 1);
  d1.setHours(20, 0, 0, 0);
  if (d1 > now) triggers.push({ label: 'D-1', at: d1, daysBefore: 1 });

  // 당일 오전 9시
  const dDay = new Date(eventDate);
  dDay.setHours(9, 0, 0, 0);
  if (dDay > now && dDay < eventDate) triggers.push({ label: 'D-DAY', at: dDay, daysBefore: 0 });

  for (const t of triggers) {
    try {
      const id = `${NOTIF_PREFIX}dday-${ev.id}-${t.daysBefore}`;
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title: t.daysBefore === 0
            ? `🎉 오늘은 ${ev.title}!`
            : `⏰ ${ev.title} ${t.label}`,
          body: ev.venue
            ? `${ev.date}${ev.time ? ` ${ev.time}` : ''} · ${ev.venue}`
            : `${ev.date}${ev.time ? ` ${ev.time}` : ''}`,
          sound: false,
          data: { eventId: ev.id, kind: 'dday' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: t.at } as any,
      });
      count++;
    } catch (e: any) {
      console.warn(`[notif] schedule d-day failed for event ${ev.id}:`, e?.message ?? e);
    }
  }

  return count;
}

async function scheduleTicketOpenNotifications(ev: Event): Promise<number> {
  if (!ev.ticketOpenAt) return 0;

  // "2026-04-15 14:00" 또는 "2026-04-15" 파싱
  let openDate: Date;
  if (ev.ticketOpenAt.includes(' ') || ev.ticketOpenAt.includes('T')) {
    openDate = new Date(ev.ticketOpenAt.replace(' ', 'T'));
  } else {
    openDate = new Date(ev.ticketOpenAt + 'T10:00:00');
  }
  if (isNaN(openDate.getTime())) return 0;

  const now = new Date();
  let count = 0;

  // 1일 전 같은 시간
  const d1 = new Date(openDate);
  d1.setDate(d1.getDate() - 1);
  if (d1 > now) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `${NOTIF_PREFIX}open-${ev.id}-day`,
        content: {
          title: `⏰ 내일 티켓 오픈!`,
          body: `${ev.title} · ${formatTime(openDate)} 오픈`,
          sound: false,
          data: { eventId: ev.id, kind: 'ticket_open' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: d1 } as any,
      });
      count++;
    } catch (e: any) {
      console.warn('[notif] open-day failed:', e?.message ?? e);
    }
  }

  // 1시간 전 (소리 O)
  const h1 = new Date(openDate.getTime() - 60 * 60 * 1000);
  if (h1 > now) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `${NOTIF_PREFIX}open-${ev.id}-hour`,
        content: {
          title: `🎟️ 1시간 후 티켓 오픈!`,
          body: `${ev.title} · 준비하세요!`,
          sound: true,
          data: { eventId: ev.id, kind: 'ticket_open' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: h1 } as any,
      });
      count++;
    } catch (e: any) {
      console.warn('[notif] open-hour failed:', e?.message ?? e);
    }
  }

  return count;
}

function formatTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const mStr = m < 10 ? `0${m}` : String(m);
  return h >= 12
    ? `오후 ${h > 12 ? h - 12 : h}:${mStr}`
    : `오전 ${h === 0 ? 12 : h}:${mStr}`;
}

export async function cancelEventNotifications(eventId: number): Promise<void> {
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of existing) {
      const id = (n.identifier ?? '') as string;
      if (id.startsWith(`${NOTIF_PREFIX}dday-${eventId}-`) ||
          id.startsWith(`${NOTIF_PREFIX}open-${eventId}-`)) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
    }
  } catch (e: any) {
    console.warn('[notif] cancel event failed:', e?.message ?? e);
  }
}
