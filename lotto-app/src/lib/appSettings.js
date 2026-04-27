// 앱 토글 + 스케줄 설정 (자동 텔레그램 / 푸시 알림 / 당첨 자동확인)
import { getSetting, setSetting } from './db';

const KEYS = {
  AUTO_SEND_TELEGRAM: 'auto_send_telegram',
  AUTO_PUSH_NOTIFY: 'auto_push_notify',
  // 텔레그램 자동발송 스케줄
  TG_SCH_DAYS: 'tg_sch_days',         // '0,2,4' 형식 (0=일~6=토)
  TG_SCH_HOUR: 'tg_sch_hour',         // '0'~'23'
  TG_SCH_COUNT: 'tg_sch_count',       // '1'/'3'/'5'/'10'
  TG_SCH_LAST_SENT: 'tg_sch_last_sent', // ms
  // 당첨 자동확인 스케줄
  WIN_ALERT_ENABLED: 'win_alert_enabled', // '0'/'1'
  WIN_ALERT_HOUR: 'win_alert_hour',       // '0'~'23'
  WIN_ALERT_LAST_CHECK: 'win_alert_last_check', // ms
};

export async function loadAppSettings() {
  const [tg, push] = await Promise.all([
    getSetting(KEYS.AUTO_SEND_TELEGRAM, '0'),
    getSetting(KEYS.AUTO_PUSH_NOTIFY, '0'),
  ]);
  return {
    autoSendTelegram: tg === '1',
    autoPushNotify: push === '1',
  };
}

export async function setAutoSendTelegram(on) {
  await setSetting(KEYS.AUTO_SEND_TELEGRAM, on ? '1' : '0');
}

export async function setAutoPushNotify(on) {
  await setSetting(KEYS.AUTO_PUSH_NOTIFY, on ? '1' : '0');
}

// ── 텔레그램 스케줄 ──
export async function loadTelegramSchedule() {
  const [days, hour, count, lastSent] = await Promise.all([
    getSetting(KEYS.TG_SCH_DAYS, ''),
    getSetting(KEYS.TG_SCH_HOUR, '9'),
    getSetting(KEYS.TG_SCH_COUNT, '5'),
    getSetting(KEYS.TG_SCH_LAST_SENT, '0'),
  ]);
  return {
    days: days ? days.split(',').map((x) => parseInt(x, 10)).filter((n) => !isNaN(n) && n >= 0 && n <= 6) : [],
    hour: parseInt(hour, 10) || 9,
    count: parseInt(count, 10) || 5,
    lastSentAt: parseInt(lastSent, 10) || 0,
  };
}

export async function saveTelegramSchedule({ days, hour, count }) {
  await setSetting(KEYS.TG_SCH_DAYS, (days || []).join(','));
  await setSetting(KEYS.TG_SCH_HOUR, String(hour ?? 9));
  await setSetting(KEYS.TG_SCH_COUNT, String(count ?? 5));
}

export async function setTelegramScheduleLastSent(ts = Date.now()) {
  await setSetting(KEYS.TG_SCH_LAST_SENT, String(ts));
}

// ── 당첨 자동확인 스케줄 ──
export async function loadWinningAlertSchedule() {
  const [enabled, hour, lastCheck] = await Promise.all([
    getSetting(KEYS.WIN_ALERT_ENABLED, '0'),
    getSetting(KEYS.WIN_ALERT_HOUR, '21'),
    getSetting(KEYS.WIN_ALERT_LAST_CHECK, '0'),
  ]);
  return {
    enabled: enabled === '1',
    hour: parseInt(hour, 10) || 21,
    lastCheckAt: parseInt(lastCheck, 10) || 0,
  };
}

export async function saveWinningAlertSchedule({ enabled, hour }) {
  await setSetting(KEYS.WIN_ALERT_ENABLED, enabled ? '1' : '0');
  if (hour != null) await setSetting(KEYS.WIN_ALERT_HOUR, String(hour));
}

export async function setWinningAlertLastCheck(ts = Date.now()) {
  await setSetting(KEYS.WIN_ALERT_LAST_CHECK, String(ts));
}
