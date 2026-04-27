import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@mygong/consent_v1';

export const CONSENT_VERSION = '2026-04-28';

export type ConsentRecord = {
  version: string;
  acceptedAt: string;
};

export async function getConsent(): Promise<ConsentRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function hasAcceptedConsent(): Promise<boolean> {
  return (await getConsent()) !== null;
}

export async function acceptConsent(): Promise<void> {
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(record));
}

export async function resetConsent(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
