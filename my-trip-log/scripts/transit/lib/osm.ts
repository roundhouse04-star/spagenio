/**
 * OpenStreetMap Overpass API 클라이언트
 * 무료 공공 API, rate limit 있음 (분당 ~3 요청 권장)
 */

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
];

export type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  members?: Array<{ type: string; ref: number; role: string }>;
  nodes?: number[];
  center?: { lat: number; lon: number };
};

export type OverpassResponse = {
  version: number;
  generator: string;
  elements: OsmElement[];
};

/**
 * Overpass query 실행 - endpoint 자동 fallback + 재시도
 */
export async function queryOverpass(query: string, retries = 3): Promise<OverpassResponse> {
  let lastErr: any = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        console.log(`[OSM] try ${endpoint} (attempt ${attempt + 1}/${retries})`);
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(query),
        });
        if (!res.ok) {
          console.warn(`[OSM] ${endpoint} returned ${res.status}`);
          continue;
        }
        const json = (await res.json()) as OverpassResponse;
        console.log(`[OSM] ✓ got ${json.elements?.length ?? 0} elements`);
        return json;
      } catch (e) {
        lastErr = e;
        console.warn(`[OSM] ${endpoint} failed:`, (e as Error).message);
      }
    }
    // wait before retry
    await sleep(5000 * (attempt + 1));
  }
  throw new Error(`Overpass query failed after ${retries} retries: ${lastErr?.message}`);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 노선 relation에서 정거장 순서 추출
 * - members 중 role='stop' 또는 'stop_entry_only' 등 가져옴
 * - role 비어있고 type=node 면 station일 수 있음
 */
export function extractStopsFromRelation(rel: OsmElement): number[] {
  if (!rel.members) return [];
  const stops: number[] = [];
  for (const m of rel.members) {
    if (m.type !== 'node') continue;
    // stop, stop_entry_only, stop_exit_only 모두 정거장 후보
    if (m.role === 'stop' || m.role === 'stop_entry_only' || m.role === 'stop_exit_only' || m.role === '') {
      // 중복 제거 (같은 역이 entry/exit 따로 있을 수 있음)
      if (!stops.includes(m.ref)) stops.push(m.ref);
    }
  }
  return stops;
}

/**
 * tag에서 색상 추출 - colour, color 두 키 다 시도, 없으면 기본값
 */
export function extractColor(tags: Record<string, string> | undefined, fallback = '#888888'): string {
  if (!tags) return fallback;
  const c = tags.colour || tags.color;
  if (!c) return fallback;
  // # 없으면 추가
  return c.startsWith('#') ? c : `#${c}`;
}

/**
 * 노선 이름 정리 - 'Subway Line 1' → '1' 같은 정규화는 도시별로
 */
export function getLineName(tags: Record<string, string> | undefined): {
  ref: string;
  name: string;
  nameLocal?: string;
  nameEn?: string;
} {
  if (!tags) return { ref: '', name: '' };
  return {
    ref: tags.ref || '',
    name: tags.name || tags.ref || '',
    nameLocal: tags['name:ko'] || tags['name:ja'] || tags['name:zh'] || tags['name:zh-Hant'],
    nameEn: tags['name:en'] || tags.name,
  };
}

/**
 * 역 이름 정리 - 한글/영어/현지어 추출
 */
export function getStationName(tags: Record<string, string> | undefined): {
  name: string;
  nameKo?: string;
  nameEn?: string;
  nameLocal?: string;
} {
  if (!tags) return { name: '' };
  return {
    name: tags.name || '',
    nameKo: tags['name:ko'],
    nameEn: tags['name:en'],
    nameLocal: tags['name:ja'] || tags['name:zh'] || tags['name:zh-Hant'] || tags['name:th'],
  };
}
