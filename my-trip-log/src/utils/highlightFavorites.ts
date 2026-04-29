/**
 * 추천 장소 즐겨찾기 — AsyncStorage 기반
 *
 * 사용자가 자주 쓰는 하이라이트를 별표로 표시 → picker에서 상단 고정.
 * 디바이스 로컬 저장 (백업·동기화 없음, 출시 시 정책에 맞춰 변경 가능).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'highlight_favorites_v1';

/** key 형식: `${cityId}::${name}` (cityHighlights.name 은 도시 내 유일하다고 가정) */
function makeKey(cityId: string, name: string): string {
  return `${cityId}::${name}`;
}

export async function getAllFavorites(): Promise<Set<string>> {
  try {
    const json = await AsyncStorage.getItem(KEY);
    const arr: string[] = json ? JSON.parse(json) : [];
    return new Set(arr);
  } catch (err) {
    console.warn('[favorites] 로드 실패:', err);
    return new Set();
  }
}

export async function isFavorite(cityId: string, name: string): Promise<boolean> {
  const set = await getAllFavorites();
  return set.has(makeKey(cityId, name));
}

/**
 * 토글. 새 상태(true=즐겨찾기) 반환.
 */
export async function toggleFavorite(cityId: string, name: string): Promise<boolean> {
  const set = await getAllFavorites();
  const k = makeKey(cityId, name);
  const wasFav = set.has(k);
  if (wasFav) set.delete(k);
  else set.add(k);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.warn('[favorites] 저장 실패:', err);
  }
  return !wasFav;
}
