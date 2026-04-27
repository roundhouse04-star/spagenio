// 로컬 푸시 알림 (서버 없이 디바이스 자체 알림)
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let _initialized = false;

// 포그라운드에서도 배너로 표시
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationReady() {
  if (_initialized) return true;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('lotto-numbers', {
      name: '번호 생성 알림',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366f1',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  _initialized = finalStatus === 'granted';
  return _initialized;
}

export async function sendLocalLottoNotification({ games, round }) {
  const ok = await ensureNotificationReady();
  if (!ok) throw new Error('알림 권한이 없습니다');

  const lines = games.slice(0, 5).map(
    (g, i) => `${i + 1}게임  ${g.numbers.map((n) => String(n).padStart(2, '0')).join(' · ')}`,
  );
  const more = games.length > 5 ? `\n외 ${games.length - 5}게임` : '';

  const title = round
    ? `🍀 ${round}회 추천번호 (${games.length}게임)`
    : `🍀 로또 추천번호 (${games.length}게임)`;
  const body = lines.join('\n') + more;

  const content = {
    title,
    body,
    sound: 'default',
    data: { kind: 'lotto-recommendation', round, count: games.length },
  };
  if (Platform.OS === 'android') {
    content.channelId = 'lotto-numbers';
  }

  await Notifications.scheduleNotificationAsync({
    identifier: `lotto_${Date.now()}`,
    content,
    trigger: null,
  });
}
