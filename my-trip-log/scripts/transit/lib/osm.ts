/**
 * OpenStreetMap Overpass API 클라이언트
 * 무료 공공 API, rate limit 있음 (분당 ~3 요청 권장)
 *
 * macOS + Node 22 의 happy-eyeballs 이슈로 fetch() 가 ETIMEDOUT 떨어지는 환경 대응:
 *  - 1차: Node 내장 fetch 시도
 *  - fetch 실패 시: curl 으로 자동 fallback (system curl 사용)
 */
import { execSync } from 'node:child_process';

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
        const json = await fetchViaCurl(endpoint, query);
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
 * curl 을 사용해 Overpass 호출 (Node fetch 우회).
 * macOS Sequoia + Node 22 환경에서 fetch ETIMEDOUT 회피용.
 */
function fetchViaCurl(endpoint: string, query: string): Promise<OverpassResponse> {
  return new Promise((resolve, reject) => {
    try {
      // 임시 파일에 query 쓰기 (긴 쿼리는 ARG 길이 한계 회피)
      const fs = require('node:fs') as typeof import('node:fs');
      const os = require('node:os') as typeof import('node:os');
      const path = require('node:path') as typeof import('node:path');
      const tmpFile = path.join(os.tmpdir(), `overpass-${Date.now()}-${Math.random()}.txt`);
      // form-urlencoded: data=<urlencoded>
      const body = 'data=' + encodeURIComponent(query);
      fs.writeFileSync(tmpFile, body);

      try {
        const out = execSync(
          `curl -s -X POST -H 'Content-Type: application/x-www-form-urlencoded' ` +
          `-H 'User-Agent: Triplive-Transit-Crawler/1.1' ` +
          `--data-binary @${tmpFile} --max-time 120 '${endpoint}'`,
          { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 },  // 100MB OK
        );
        const json = JSON.parse(out) as OverpassResponse;
        resolve(json);
      } finally {
        try { fs.unlinkSync(tmpFile); } catch {}
      }
    } catch (e) {
      reject(e);
    }
  });
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
