import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const API_BASE = 'https://travel.spagenio.com';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPush(userId) {
  if (!Device.isDevice) {
    console.log('Push requires physical device');
    return null;
  }
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
  const tokenData = await Notifications.getExpoPushTokenAsync();
  const pushToken = tokenData.data;
  try {
    await fetch(API_BASE + '/api/push/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, pushToken, pushConsent: true }),
    });
  } catch (e) {}
  return pushToken;
}

export async function updatePushConsent(userId, consent) {
  try {
    await fetch(API_BASE + '/api/push/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, pushConsent: consent }),
    });
  } catch (e) {}
}

export async function getPushStatus(userId) {
  try {
    const res = await fetch(API_BASE + '/api/users/' + userId + '/push-status');
    if (res.ok) return await res.json();
  } catch (e) {}
  return { pushToken: '', pushConsent: false };
}
