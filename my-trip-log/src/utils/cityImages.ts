/**
 * 도시별 대표 이미지 가져오기 (Wikipedia REST API)
 *
 * - 비용: 0 (위키피디아 공개 API, 키 불필요)
 * - 라이선스: Wikipedia 이미지는 대부분 CC-BY-SA / Public Domain (상업·앱 사용 OK)
 * - 캐싱: AsyncStorage 영구 저장. 한 번 가져온 URL 은 재호출 안 함.
 *
 * 사용 예:
 *   const url = await getCityImageUrl('tokyo');
 *   // → "https://upload.wikimedia.org/wikipedia/commons/.../Tokyo_skyline.jpg"
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CITY_ALIASES } from '@/data/cityHighlights';

const CACHE_KEY = 'city_images_cache_v1';
const NULL_TTL_MS = 1000 * 60 * 60 * 24 * 7; // null(실패) 캐시는 7일 후 재시도

interface CacheEntry {
  url: string | null;
  fetchedAt: number;
}

let cacheLoaded = false;
const cache: Record<string, CacheEntry> = {};
let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function loadCache(): Promise<void> {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    const json = await AsyncStorage.getItem(CACHE_KEY);
    if (json) Object.assign(cache, JSON.parse(json));
  } catch {/* ignore */}
}

function scheduleSave() {
  // 디바운스: 짧은 간격 다중 저장 방지
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {/* ignore */}
  }, 500);
}

/** CITY_ALIASES alias 중 영문(Latin) 표기 추출. Wikipedia 영문판 검색에 사용. */
function getEnglishCityName(cityId: string): string {
  const info = CITY_ALIASES[cityId];
  if (!info) return cityId;
  const en = info.aliases.find((a) => /^[a-z\s]+$/i.test(a) && a.length > 2);
  if (!en) return info.name;
  // "new york" → "New York"
  return en.split(/\s+/).map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ');
}

/**
 * 위키피디아 페이지 요약 API → thumbnail 또는 originalimage URL 반환.
 * 실패 시 null. 캐시 활용으로 중복 요청 안 함.
 */
export async function getCityImageUrl(cityId: string): Promise<string | null> {
  await loadCache();
  const cached = cache[cityId];
  const now = Date.now();
  if (cached) {
    if (cached.url) return cached.url;
    if (now - cached.fetchedAt < NULL_TTL_MS) return null;
  }

  const name = getEnglishCityName(cityId);
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'my-trip-log-app/1.0 (https://github.com/roundhouse04-star/spagenio)',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      cache[cityId] = { url: null, fetchedAt: now };
      scheduleSave();
      return null;
    }
    const data = await res.json();
    // originalimage 가 thumbnail 보다 큼. 단 너무 크면 트래픽 부담이라 thumbnail 우선
    const imgUrl: string | null =
      (data.thumbnail?.source as string | undefined) ??
      (data.originalimage?.source as string | undefined) ??
      null;
    cache[cityId] = { url: imgUrl, fetchedAt: now };
    scheduleSave();
    return imgUrl;
  } catch (err) {
    console.warn('[cityImages] fetch fail:', cityId, err);
    cache[cityId] = { url: null, fetchedAt: now };
    scheduleSave();
    return null;
  }
}

/**
 * 캐시 초기화 (개발용 / 사용자 데이터 리셋 시 호출).
 */
export async function clearCityImageCache(): Promise<void> {
  Object.keys(cache).forEach((k) => delete cache[k]);
  try { await AsyncStorage.removeItem(CACHE_KEY); } catch {/* ignore */}
}
