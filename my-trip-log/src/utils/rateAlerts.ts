/**
 * 환율 목표가 알림 — 단순 버전
 *
 * 작동:
 *  - 사용자가 "1 외화 = N KRW 이하일 때 알림" 설정
 *  - 앱 시작 시 환율 fetch (이미 frankfurter 사용 중) → 비교
 *  - 도달 시 expo-notifications 로컬 알림 + AsyncStorage에 알림 보낸 시각 기록
 *  - 동일 알림 24시간 내 재발송 안 함 (도달했다 빠졌다 반복 방지)
 *
 * 외부 호출: frankfurter (이미 사용 중) + expo-notifications (로컬)
 * 외부 푸시 서버 X.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { getRates } from '@/utils/exchange';

const KEY_ALERTS = 'rate_alerts_v1';
const KEY_LAST_NOTIF = 'rate_alerts_last_notif_v1';
const NOTIF_COOLDOWN_MS = 1000 * 60 * 60 * 24; // 24h

export interface RateAlert {
  id: string;             // uuid 비슷한 id
  fromCurrency: string;   // 'JPY'
  toCurrency: string;     // 'KRW'
  /** "1 fromCurrency = X toCurrency" 의 X. 이 값 이하 도달 시 알림 (강세) */
  targetRate: number;
  /** 'below' = 목표 이하, 'above' = 목표 이상 */
  direction: 'below' | 'above';
  createdAt: string;
}

export async function getAlerts(): Promise<RateAlert[]> {
  try {
    const json = await AsyncStorage.getItem(KEY_ALERTS);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function addAlert(a: Omit<RateAlert, 'id' | 'createdAt'>): Promise<RateAlert> {
  const all = await getAlerts();
  const alert: RateAlert = {
    ...a,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  all.push(alert);
  await AsyncStorage.setItem(KEY_ALERTS, JSON.stringify(all));
  return alert;
}

export async function removeAlert(id: string): Promise<void> {
  const all = await getAlerts();
  const next = all.filter((a) => a.id !== id);
  await AsyncStorage.setItem(KEY_ALERTS, JSON.stringify(next));
}

async function getLastNotifMap(): Promise<Record<string, number>> {
  try {
    const json = await AsyncStorage.getItem(KEY_LAST_NOTIF);
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

async function setLastNotif(id: string): Promise<void> {
  const map = await getLastNotifMap();
  map[id] = Date.now();
  await AsyncStorage.setItem(KEY_LAST_NOTIF, JSON.stringify(map));
}

/**
 * 앱 시작 시 호출. 등록된 alert 모두 평가 → 도달 시 로컬 알림.
 */
export async function checkRateAlerts(): Promise<void> {
  const alerts = await getAlerts();
  if (alerts.length === 0) return;

  const lastMap = await getLastNotifMap();
  const now = Date.now();

  // from currency 별로 fetch (대부분 KRW 기준 다양한 통화)
  const ratesByFrom = new Map<string, Record<string, number>>();
  const uniqueFroms = Array.from(new Set(alerts.map((a) => a.fromCurrency)));
  for (const from of uniqueFroms) {
    try {
      const r = await getRates(from);
      ratesByFrom.set(from, r);
    } catch {/* skip */}
  }

  for (const a of alerts) {
    const lastAt = lastMap[a.id] ?? 0;
    if (now - lastAt < NOTIF_COOLDOWN_MS) continue;
    const rates = ratesByFrom.get(a.fromCurrency);
    if (!rates) continue;
    const current = rates[a.toCurrency];
    if (typeof current !== 'number') continue;

    const reached =
      (a.direction === 'below' && current <= a.targetRate) ||
      (a.direction === 'above' && current >= a.targetRate);

    if (!reached) continue;

    try {
      const granted = await ensurePermission();
      if (!granted) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎯 환율 목표 도달',
          body: `1 ${a.fromCurrency} = ${current.toFixed(2)} ${a.toCurrency} (목표 ${a.direction === 'below' ? '이하' : '이상'} ${a.targetRate})`,
          sound: 'default',
        },
        trigger: null, // 즉시
      });
      await setLastNotif(a.id);
    } catch (err) {
      console.warn('[rateAlerts] notify failed:', err);
    }
  }
}

async function ensurePermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.status === 'granted') return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === 'granted';
}
