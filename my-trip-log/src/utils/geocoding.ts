/**
 * 무료 지오코딩 (OpenStreetMap Nominatim)
 *
 * 추천 장소 선택 시 백그라운드로 좌표 조회하여 일정 폼에 자동 입력.
 * Nominatim 정책: 1초당 1회 미만, User-Agent 헤더 필수.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const HEADERS = { 'User-Agent': 'my-trip-log-app/1.0' };

export interface GeoResult {
  lat: number;
  lng: number;
  displayName: string;
}

/**
 * 자유 텍스트 → 좌표 1건 조회.
 * 못 찾으면 null. 네트워크 오류도 null (호출 측에서 폴백 처리).
 */
export async function geocode(query: string, lang = 'ko'): Promise<GeoResult | null> {
  if (!query.trim()) return null;
  try {
    const url = `${NOMINATIM}?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=${lang}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const data: { lat: string; lon: string; display_name: string }[] = await res.json();
    if (!data.length) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch (err) {
    console.warn('[geocode] 실패:', err);
    return null;
  }
}
