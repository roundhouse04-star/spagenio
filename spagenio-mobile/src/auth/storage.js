import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'spagenio_auth_token';
const USER_KEY = 'spagenio_user';

export async function saveToken(token) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function saveUser(user) {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getUser() {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
