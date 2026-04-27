// 스케줄링 시스템
// - 정해진 요일/시각에 OS 레벨 weekly 알림을 등록 (앱 종료 상태에서도 알림은 정상 발사)
// - 알림이 포그라운드에서 발사되거나 사용자가 알림을 탭하면 → 자동 텔레그램 발송 / 당첨 확인 액션 실행
// - 앱 시작 시 catch-up: 마지막 실행 이후 지나간 스케줄이 있으면 자동 실행
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  loadTelegramSchedule, setTelegramScheduleLastSent,
  loadWinningAlertSchedule, setWinningAlertLastCheck,
} from './appSettings';
import { loadTelegramConfig, sendTelegramFromConfig, formatLottoMessage } from './telegram';
import { ensureNotificationReady } from './notifications';
import { generateGames, weightsSum, evaluateRank } from './lottoEngine';
import { fetchRecentHistory, fetchRound, detectLatestRound } from './lottoApi';
import { loadWeights, loadPurchases, updatePurchase, addPickEntry } from './storage';

const TG_PREFIX = 'lotto-tg-sch-';
const WIN_ID = 'lotto-win-alert';
const ANDROID_CHANNEL = 'lotto-numbers';

// 0=일, 1=월, ..., 6=토 (JS Date.getDay() 표준)
// expo-notifications WeeklyTrigger weekday: 1=일, 2=월, ..., 7=토 (iOS NSCalendar)
const dayIdxToWeekday = (d) => d + 1;

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// ── 텔레그램 자동발송 스케줄 등록/갱신 ──
export async function reapplyTelegramSchedule(active) {
  // 모든 기존 텔레그램 스케줄 알림 취소
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n.identifier?.startsWith(TG_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
      }
    }
  } catch (e) {}

  if (!active) return { scheduled: 0 };

  const sch = await loadTelegramSchedule();
  if (!sch.days?.length) return { scheduled: 0, reason: 'no-days' };

  const granted = await ensureNotificationReady();
  if (!granted) return { scheduled: 0, reason: 'no-permission' };

  let scheduled = 0;
  for (const d of sch.days) {
    const id = `${TG_PREFIX}d${d}`;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title: '🍀 자동추천 발송 시각',
          body: `매주 ${DAY_LABELS[d]}요일 ${sch.hour}시 · ${sch.count}게임 자동 발송`,
          sound: 'default',
          data: { kind: 'tg-schedule', day: d, hour: sch.hour, count: sch.count },
          ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: dayIdxToWeekday(d),
          hour: sch.hour,
          minute: 0,
        },
      });
      scheduled += 1;
    } catch (e) {
      console.warn('[tg-sch register]', e?.message);
    }
  }
  return { scheduled };
}

// ── 당첨 자동확인 스케줄 ──
export async function reapplyWinningAlertSchedule() {
  await Notifications.cancelScheduledNotificationAsync(WIN_ID).catch(() => {});

  const sch = await loadWinningAlertSchedule();
  if (!sch.enabled) return { scheduled: 0 };

  const granted = await ensureNotificationReady();
  if (!granted) return { scheduled: 0, reason: 'no-permission' };

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: WIN_ID,
      content: {
        title: '🎉 당첨 결과 확인',
        body: '이번 주 추첨 결과를 자동 확인합니다',
        sound: 'default',
        data: { kind: 'win-check', hour: sch.hour },
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 7, // 토요일
        hour: sch.hour,
        minute: 0,
      },
    });
    return { scheduled: 1 };
  } catch (e) {
    console.warn('[win-sch register]', e?.message);
    return { scheduled: 0, error: e?.message };
  }
}

// ── 액션: AI 자동추천 → 텔레그램 발송 ──
export async function performTelegramAutoSend() {
  const tgCfg = await loadTelegramConfig();
  if (!tgCfg.token || !tgCfg.chatId) {
    throw new Error('텔레그램 토큰/Chat ID가 설정되지 않았습니다');
  }

  const algos = await loadWeights();
  if (weightsSum(algos) === 0) throw new Error('알고리즘 가중치 합이 0입니다');

  const sch = await loadTelegramSchedule();
  const { latest, history } = await fetchRecentHistory(80);
  const games = generateGames({ algos, history: history.map((r) => r.numbers), count: sch.count });

  const text = formatLottoMessage(games, { round: latest, kind: '자동' });
  await sendTelegramFromConfig(text);

  // 자동발송된 게임을 picks DB에 저장 (source='auto-tg' 로 출처 구분)
  const ts = Date.now();
  for (let i = 0; i < games.length; i++) {
    await addPickEntry({
      id: `auto_${ts}_${i}`,
      createdAt: ts + i,
      baseRound: latest,
      numbers: games[i].numbers,
      meta: games[i].meta,
      source: 'auto-tg',
    });
  }

  await setTelegramScheduleLastSent(Date.now());
  return { round: latest, count: games.length, games };
}

// ── 액션: 당첨 자동확인 → 푸시 알림 ──
export async function performWinningCheck() {
  const purchases = await loadPurchases();
  if (!purchases.length) {
    await setWinningAlertLastCheck(Date.now());
    return { checked: 0, won: 0, message: '구입번호 없음' };
  }

  const cache = {};
  let totalGames = 0, totalWon = 0, ranksFound = [];
  const updates = [];

  for (const p of purchases) {
    if (p.results) continue; // 이미 확인된 건 스킵
    if (!cache[p.round]) cache[p.round] = await fetchRound(p.round);
    const round = cache[p.round];
    if (!round) continue;

    const results = p.games.map((nums) => ({
      numbers: nums,
      ...evaluateRank(nums, round.numbers, round.bonus),
    }));
    const winCount = results.filter((r) => r.rank > 0).length;
    totalGames += p.games.length;
    totalWon += winCount;
    results.forEach((r) => { if (r.rank > 0) ranksFound.push(r.rank); });

    updates.push({ id: p.id, patch: { results, drawDate: round.drwDate, winning: round.numbers, bonus: round.bonus } });
  }

  for (const u of updates) await updatePurchase(u.id, u.patch);

  // 결과 푸시
  if (updates.length > 0) {
    const bestRank = ranksFound.length ? Math.min(...ranksFound) : 0;
    const title = totalWon > 0
      ? `🎉 ${totalWon}게임 당첨!${bestRank ? ` (최고 ${bestRank}등)` : ''}`
      : '😅 이번 주는 낙첨';
    const body = `${updates.length}회차 · ${totalGames}게임 자동 확인 완료`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title, body, sound: 'default',
        data: { kind: 'win-check-result', won: totalWon, checked: totalGames },
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : {}),
      },
      trigger: null,
    });
  }

  await setWinningAlertLastCheck(Date.now());
  return { checked: totalGames, won: totalWon, updated: updates.length };
}

// ── 앱 시작 시 catch-up: 놓친 스케줄 자동 실행 ──
export async function runCatchup() {
  const now = new Date();
  const todayDay = now.getDay();
  const nowHour = now.getHours();
  const nowMs = now.getTime();

  const out = {};

  // (1) 텔레그램 스케줄 catch-up
  try {
    const tgSch = await loadTelegramSchedule();
    const tgCfg = await loadTelegramConfig();
    if (tgSch.days.includes(todayDay) && nowHour >= tgSch.hour && tgCfg.token && tgCfg.chatId) {
      // 오늘 스케줄 시각이 지났는데 마지막 발송이 24h 전보다 오래됐다면 발송
      const dayStartMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), tgSch.hour, 0, 0).getTime();
      if (tgSch.lastSentAt < dayStartMs) {
        const r = await performTelegramAutoSend();
        out.tgSent = r;
      }
    }
  } catch (e) { out.tgError = e.message; }

  // (2) 당첨 확인 catch-up (토요일 H시 이후 첫 진입)
  try {
    const winSch = await loadWinningAlertSchedule();
    if (winSch.enabled) {
      // 가장 최근 토요일 H시 이후인지 체크
      const lastSat = new Date(now);
      const daysSinceSat = (todayDay - 6 + 7) % 7;
      lastSat.setDate(lastSat.getDate() - daysSinceSat);
      lastSat.setHours(winSch.hour, 0, 0, 0);
      // 만약 오늘이 토요일이고 H시 전이라면 더 이전 토요일을 봐야 함
      if (todayDay === 6 && nowHour < winSch.hour) {
        lastSat.setDate(lastSat.getDate() - 7);
      }
      if (winSch.lastCheckAt < lastSat.getTime() && nowMs >= lastSat.getTime()) {
        const r = await performWinningCheck();
        out.winChecked = r;
      }
    }
  } catch (e) { out.winError = e.message; }

  return out;
}

// ── 알림 리스너 등록 (App.js에서 호출) ──
// 포그라운드에서 알림 수신 시 자동 실행 + 사용자가 알림 탭 시에도 동일 처리
export function setupSchedulerListeners() {
  const subs = [];

  // 알림이 도착했을 때 (foreground)
  subs.push(
    Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.kind === 'tg-schedule') {
        performTelegramAutoSend().catch((e) => console.warn('[tg-schedule fg]', e?.message));
      } else if (data?.kind === 'win-check') {
        performWinningCheck().catch((e) => console.warn('[win-check fg]', e?.message));
      }
    }),
  );

  // 사용자가 알림을 탭했을 때 (background → foreground)
  subs.push(
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.kind === 'tg-schedule') {
        performTelegramAutoSend().catch((e) => console.warn('[tg-schedule tap]', e?.message));
      } else if (data?.kind === 'win-check') {
        performWinningCheck().catch((e) => console.warn('[win-check tap]', e?.message));
      }
    }),
  );

  return () => subs.forEach((s) => s.remove?.());
}

// 디버그용: 현재 등록된 스케줄 조회
export async function listScheduledNotifications() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.map((n) => ({ id: n.identifier, trigger: n.trigger, content: n.content }));
}
