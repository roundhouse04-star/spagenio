/**
 * 범용 도시 지하철 크롤러
 * - 도시 area 안의 모든 subway/metro relation 가져옴
 * - 각 노선의 stop 순서, 색상, 이름 추출
 * - 스키마에 맞춰 변환
 */

import {
  queryOverpass,
  extractStopsFromRelation,
  extractColor,
  getLineName,
  getStationName,
  sleep,
  OsmElement,
} from './osm';
import {
  CityResult,
  Line,
  Station,
  StationLine,
  Connection,
  validateCityResult,
  markTransferStations,
} from './schema';

export type CityCrawlerConfig = {
  cityId: string;
  cityName: string; // OSM area 검색용 (영어 또는 현지어)
  cityNameAlt?: string; // 대체 이름 (검색 실패시)
  nameKo: string;
  nameEn: string;
  country: string;
  timezone: string;

  /**
   * route relation 필터링 - subway만? metro? light_rail까지?
   * 기본값: ['subway', 'light_rail', 'monorail']
   */
  routeTypes?: string[];

  /**
   * 노선 ID prefix (예: 'busan' → 'busan_1', 'busan_2')
   */
  linePrefix?: string;

  /**
   * 노선 색상 fallback (OSM에 없을 때 ref 기반)
   */
  defaultColors?: Record<string, string>;

  /**
   * 노선 이름 정규화 함수 - OSM 이름 → 한국어 이름
   */
  lineNameKo?: (ref: string, name: string) => string;

  /**
   * 역 이름 한국어가 없을 때 fallback
   * (한국어 → 일본어/중국어/영어 순)
   */
  stationNameKoFallback?: (tags: Record<string, string>) => string;
};

export async function crawlCity(config: CityCrawlerConfig): Promise<CityResult> {
  const cityId = config.cityId;
  const linePrefix = config.linePrefix || cityId;
  const routeTypes = config.routeTypes || ['subway', 'light_rail', 'monorail'];
  const routeFilter = routeTypes.map((t) => `route="${t}"`).join('|');

  console.log(`\n========== ${config.cityName} 크롤링 시작 ==========`);

  // 1) 도시 area 안의 모든 subway/light_rail/monorail relation
  // area 검색 - city 또는 admin_level 기준
  const query = `
[out:json][timeout:90];
(
  area[name="${config.cityName}"];
  area[name:en="${config.cityName}"];
  ${config.cityNameAlt ? `area[name="${config.cityNameAlt}"];` : ''}
)->.cityArea;
(
  ${routeTypes.map((t) => `relation[route="${t}"](area.cityArea);`).join('\n  ')}
);
out body;
>;
out skel qt;
`.trim();

  const data = await queryOverpass(query);

  // 2) elements 분류
  const relations: OsmElement[] = [];
  const nodesById = new Map<number, OsmElement>();

  for (const el of data.elements) {
    if (el.type === 'relation') relations.push(el);
    else if (el.type === 'node') nodesById.set(el.id, el);
  }

  console.log(`[${cityId}] ${relations.length}개 노선, ${nodesById.size}개 node`);

  if (relations.length === 0) {
    throw new Error(`도시 ${config.cityName}에서 노선을 찾을 수 없습니다.`);
  }

  // 3) 노선 정렬 (ref 숫자 우선)
  relations.sort((a, b) => {
    const aRef = a.tags?.ref || a.tags?.name || '';
    const bRef = b.tags?.ref || b.tags?.name || '';
    const aNum = parseInt(aRef.match(/\d+/)?.[0] || '999');
    const bNum = parseInt(bRef.match(/\d+/)?.[0] || '999');
    if (aNum !== bNum) return aNum - bNum;
    return aRef.localeCompare(bRef);
  });

  // 4) 노선별 처리
  const lines: Line[] = [];
  const stations: Station[] = [];
  const stationLines: StationLine[] = [];
  const connections: Connection[] = [];
  const stationIdByOsm = new Map<number, string>(); // OSM node id → station id

  // 같은 도시에서 같은 노선이 여러 방향으로 나뉘어 있을 수 있음 (route_master 통합 안 된 경우)
  // ref 기준으로 노선 통합
  const linesByRef = new Map<string, OsmElement[]>();
  for (const rel of relations) {
    const ref = rel.tags?.ref || rel.tags?.name || '';
    if (!linesByRef.has(ref)) linesByRef.set(ref, []);
    linesByRef.get(ref)!.push(rel);
  }

  let lineOrder = 0;
  for (const [ref, rels] of linesByRef.entries()) {
    lineOrder++;
    const firstRel = rels[0];
    const tags = firstRel.tags || {};
    const lineId = `${linePrefix}_${ref || lineOrder}`.replace(/\s+/g, '_').toLowerCase();
    const nameInfo = getLineName(tags);

    // 색상: tag 우선 → defaultColors fallback
    const color = config.defaultColors?.[ref] ||
                   extractColor(tags, '#888888');

    lines.push({
      id: lineId,
      cityId,
      nameKo: config.lineNameKo
        ? config.lineNameKo(ref, nameInfo.name)
        : (nameInfo.nameLocal || nameInfo.name),
      nameEn: nameInfo.nameEn || nameInfo.name,
      color,
      textColor: isDarkColor(color) ? 'white' : 'black',
      lineOrder,
    });

    // 모든 방향 relation의 정거장 모으기 (중복 제거하면서 순서 유지)
    const stopsOrdered: number[] = [];
    for (const rel of rels) {
      const stops = extractStopsFromRelation(rel);
      for (const s of stops) {
        if (!stopsOrdered.includes(s)) stopsOrdered.push(s);
      }
    }

    let stationOrder = 0;
    let prevStationId: string | null = null;
    for (const osmNodeId of stopsOrdered) {
      const node = nodesById.get(osmNodeId);
      if (!node) continue;
      stationOrder++;

      // 역 ID - osm node id 기반
      let stationId = stationIdByOsm.get(osmNodeId);
      if (!stationId) {
        stationId = `${cityId.slice(0, 2)}_${String(osmNodeId).slice(-7)}`;
        stationIdByOsm.set(osmNodeId, stationId);

        const stTags = node.tags || {};
        const stNameInfo = getStationName(stTags);
        const nameKo = stNameInfo.nameKo ||
                       (config.stationNameKoFallback && config.stationNameKoFallback(stTags)) ||
                       stNameInfo.nameLocal ||
                       stNameInfo.name;

        stations.push({
          id: stationId,
          cityId,
          nameKo,
          nameEn: stNameInfo.nameEn || stNameInfo.name,
          nameLocal: stNameInfo.nameLocal,
          lat: node.lat,
          lon: node.lon,
        });
      }

      stationLines.push({
        stationId,
        lineId,
        stationOrder,
      });

      if (prevStationId) {
        connections.push({
          from: prevStationId,
          to: stationId,
          lineId,
          duration: 90,
        });
      }
      prevStationId = stationId;
    }

    console.log(`  [${ref || lineOrder}] ${stationOrder}개 역`);
  }

  // 5) 좌표 정규화 (0-100 x,y) - 옛 UI 호환
  if (stations.length > 0 && stations[0].lat !== undefined) {
    const lats = stations.map((s) => s.lat!).filter((v) => v !== undefined);
    const lons = stations.map((s) => s.lon!).filter((v) => v !== undefined);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const latRange = maxLat - minLat || 1;
    const lonRange = maxLon - minLon || 1;
    for (const s of stations) {
      if (s.lat !== undefined && s.lon !== undefined) {
        s.x = Math.round(((s.lon - minLon) / lonRange) * 100 * 10) / 10;
        s.y = Math.round((1 - (s.lat - minLat) / latRange) * 100 * 10) / 10; // y는 위→아래
      }
    }
  }

  // 6) 결과 조립
  let result: CityResult = {
    city: {
      id: cityId,
      nameKo: config.nameKo,
      nameEn: config.nameEn,
      country: config.country,
      timezone: config.timezone,
    },
    lines,
    stations,
    stationLines,
    connections,
  };

  // 7) 환승역 마킹
  result = markTransferStations(result);

  // 8) 검증
  const v = validateCityResult(result);
  if (!v.ok) {
    console.warn(`[${cityId}] ⚠️ 검증 경고:`);
    v.errors.slice(0, 10).forEach((e) => console.warn(`  ${e}`));
    if (v.errors.length > 10) console.warn(`  ... and ${v.errors.length - 10} more`);
  }

  console.log(`[${cityId}] ✓ 완료: ${lines.length}개 노선, ${stations.length}개 역, ${connections.length}개 연결`);

  // OSM API 부담 줄이기 위해 잠깐 쉼
  await sleep(2000);
  return result;
}

function isDarkColor(hex: string): boolean {
  const m = hex.match(/^#?([0-9A-Fa-f]{6})$/);
  if (!m) return false;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  // YIQ luminance
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq < 128;
}
