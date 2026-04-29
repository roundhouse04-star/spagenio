/**
 * 가고 싶은 도시 위시리스트 — AsyncStorage
 * 별도 DB 테이블 없이 가벼운 클라이언트 저장.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'wishlist_cities_v1';

export async function getWishlist(): Promise<string[]> {
  try {
    const json = await AsyncStorage.getItem(KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function isInWishlist(cityId: string): Promise<boolean> {
  const list = await getWishlist();
  return list.includes(cityId);
}

export async function toggleWishlist(cityId: string): Promise<boolean> {
  const list = await getWishlist();
  const idx = list.indexOf(cityId);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(cityId);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {/* ignore */}
  return idx < 0; // true = 새로 추가됨
}
