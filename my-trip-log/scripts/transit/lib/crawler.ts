/**
 * 범용 도시 지하철 크롤러 (v2 — named-station proximity 매칭)
 *
 * OSM 지하철 데이터 구조의 함정:
 *  - route relation 의 role=stop 멤버는 `public_transport=stop_position` 노드
 *    → 좌표만 있고 보통 이름이 비어있음
 *  - 진짜 이름은 별도의 `railway=station` 또는 `public_transport=station` 노드에 있음
 *
 * 해결책:
 *  1) 도시 area 안의 모든 railway=station / public_transport=station 노드를 별도로 받음
 *  2) 각 route 의 stop_position 좌표에서 가장 가까운 named-station 을 찾음 (≤300m)
 *  3) 그 named-station 의 name / name:ko / name:en 사용
 *
 * 추가 개선:
 *  - route_master relation 으로 같은 노선의 여러 방향을 정확히 묶음 (ref 기반 fallback 유지)
 *  - 환승역은 좌표 거의 같은 (≤50m) 다른 노선 역을 같은 역으로 통합
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
  cityName: string;
  cityNameAlt?: string;
  nameKo: string;
  nameEn: string;
  country: string;
  timezone: string;

  routeTypes?: string[];
  linePrefix?: string;
  defaultColors?: Record<string, string>;
  lineNameKo?: (ref: string, name: string) => string;
  stationNameKoFallback?: (tags: Record<string, string>) => string;

  /**
   * named-station 매칭 최대 거리 (m). 기본 300m.
   * 도시가 작거나 역 간격이 좁으면 작게, 크면 크게.
   */
  stationMatchRadiusM?: number;

  /**
   * 환승역 통합 거리 (m). 같은 좌표에 있는 다른 노선 역을 같은 역으로 묶기.
   * 기본 80m.
   */
  transferMergeRadiusM?: number;

  /**
   * 인접 도시 area — 노선이 도시 경계를 넘는 경우 추가
   * 예: 부산 BGL → 김해시, 도쿄 → 사이타마/카나가와
   */
  extraAreas?: string[];

  /**
   * 한글 name:ko 가 없을 때 영어를 우선 사용
   * (한국·일본·중국 외 도시는 true 권장 — 현지어 한자/아랍어보다 영어가 가독성 좋음)
   */
  preferEnglish?: boolean;
};

export async function crawlCity(config: CityCrawlerConfig): Promise<CityResult> {
  const cityId = config.cityId;
  const linePrefix = config.linePrefix || cityId;
  const routeTypes = config.routeTypes || ['subway', 'light_rail', 'monorail'];
  const matchRadiusM = config.stationMatchRadiusM ?? 300;
  const mergeRadiusM = config.transferMergeRadiusM ?? 80;

  console.log(`\n========== ${config.cityName} 크롤링 시작 ==========`);

  // ── 1) Overpass 쿼리 ───────────────────────────────
  // routes + route_masters + named station nodes
  // (cityName 또는 cityNameAlt 둘 다 area 검색에 시도)
  const altQuery = config.cityNameAlt
    ? `area["name"="${config.cityNameAlt}"];\n  area["name:en"="${config.cityNameAlt}"];`
    : '';

  // 정규식 안에서 사용 — 따옴표 없이 OR 패턴
  const routeTypeFilter = routeTypes.join('|');

  // 인접 도시 area 까지 포함 (노선이 도시 경계를 넘는 경우)
  const extraAreaQs = (config.extraAreas || [])
    .map((n) => `area["name"="${n}"];\n  area["name:en"="${n}"];`)
    .join('\n  ');

  // 단일 union 쿼리로 routes + route_masters + named-stations + 모든 멤버 노드를 한 번에
  const query = `
[out:json][timeout:180];
(
  area["name"="${config.cityName}"];
  area["name:en"="${config.cityName}"];
  ${altQuery}
  ${extraAreaQs}
)->.cityArea;
(
  relation["type"="route"]["route"~"^(${routeTypeFilter})$"](area.cityArea);
  relation["type"="route_master"]["route_master"~"^(${routeTypeFilter})$"](area.cityArea);
  node["railway"="station"](area.cityArea);
  node["public_transport"="station"](area.cityArea);
  node["railway"="halt"](area.cityArea);
);
out body;
>;
out body qt;
`.trim();

  const data = await queryOverpass(query);

  // ── 2) 분류 ───────────────────────────────────────
  const routeRels: OsmElement[] = [];
  const routeMasterRels: OsmElement[] = [];
  const nodesById = new Map<number, OsmElement>();
  const namedStations: OsmElement[] = [];

  for (const el of data.elements) {
    if (el.type === 'relation') {
      const typ = el.tags?.type;
      if (typ === 'route_master') routeMasterRels.push(el);
      else if (typ === 'route' || routeTypes.includes(el.tags?.route || '')) routeRels.push(el);
    } else if (el.type === 'node') {
      nodesById.set(el.id, el);
      const t = el.tags || {};
      if (
        t.railway === 'station' ||
        t.public_transport === 'station' ||
        t.railway === 'halt'
      ) {
        namedStations.push(el);
      }
    }
  }

  console.log(
    `[${cityId}] route=${routeRels.length}, route_master=${routeMasterRels.length}, ` +
    `node=${nodesById.size}, named=${namedStations.length}`,
  );

  if (routeRels.length === 0) {
    throw new Error(`도시 ${config.cityName} 에서 route 를 찾지 못함.`);
  }

  // ── 3) 노선 그룹핑: route_master 기반 (있으면) + ref fallback ─────
  const routeIdToMasterRef = new Map<number, string>();
  for (const master of routeMasterRels) {
    const masterRef = master.tags?.ref || master.tags?.name || `master_${master.id}`;
    for (const m of master.members || []) {
      if (m.type === 'relation') {
        routeIdToMasterRef.set(m.ref, masterRef);
      }
    }
  }

  const linesByKey = new Map<string, OsmElement[]>();
  for (const rel of routeRels) {
    const masterRef = routeIdToMasterRef.get(rel.id);
    const ref = masterRef || rel.tags?.ref || rel.tags?.name || `unknown_${rel.id}`;
    if (!linesByKey.has(ref)) linesByKey.set(ref, []);
    linesByKey.get(ref)!.push(rel);
  }

  // 노선 정렬 (ref 숫자 우선)
  const sortedLineKeys = Array.from(linesByKey.keys()).sort((a, b) => {
    const aNum = parseInt(a.match(/\d+/)?.[0] || '999');
    const bNum = parseInt(b.match(/\d+/)?.[0] || '999');
    if (aNum !== bNum) return aNum - bNum;
    return a.localeCompare(b);
  });

  // ── 4) named-station 공간 인덱스 (단순 grid) ────────
  // 1° lat ≒ 111km. 0.005° grid ≒ 555m 셀 → 인접 셀까지 보면 OK.
  const GRID = 0.005;
  const stationGrid = new Map<string, OsmElement[]>();
  for (const ns of namedStations) {
    if (ns.lat === undefined || ns.lon === undefined) continue;
    const key = `${Math.floor(ns.lat / GRID)}_${Math.floor(ns.lon / GRID)}`;
    if (!stationGrid.has(key)) stationGrid.set(key, []);
    stationGrid.get(key)!.push(ns);
  }

  function findNearestNamed(lat: number, lon: number, maxM: number): OsmElement | null {
    const gx = Math.floor(lat / GRID);
    const gy = Math.floor(lon / GRID);
    let best: OsmElement | null = null;
    let bestD = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const list = stationGrid.get(`${gx + dx}_${gy + dy}`);
        if (!list) continue;
        for (const ns of list) {
          if (ns.lat === undefined || ns.lon === undefined) continue;
          const d = haversineM(lat, lon, ns.lat, ns.lon);
          if (d < bestD && d <= maxM) {
            bestD = d;
            best = ns;
          }
        }
      }
    }
    return best;
  }

  // ── 5) 노선별 처리 ─────────────────────────────────
  const lines: Line[] = [];
  type StationDraft = {
    id: string;
    osmNamedId?: number;
    cityId: string;
    nameKo: string;
    nameEn: string;
    nameLocal?: string;
    lat: number;
    lon: number;
  };
  const stationDrafts: StationDraft[] = [];
  const stationIdByNamedOsm = new Map<number, string>();
  const stationIdByStopOsm = new Map<number, string>();
  const stationLines: StationLine[] = [];
  const connections: Connection[] = [];

  let lineOrder = 0;
  for (const refKey of sortedLineKeys) {
    lineOrder++;
    const rels = linesByKey.get(refKey)!;
    const firstRel = rels[0];
    const tags = firstRel.tags || {};
    // ref / name 정제 — route_master 키가 들어왔으면 그대로 사용
    const refForId = (firstRel.tags?.ref || refKey)
      .toString()
      .replace(/\s+/g, '_')
      .toLowerCase();
    const lineId = `${linePrefix}_${refForId || lineOrder}`;
    const nameInfo = getLineName(tags);
    const color =
      config.defaultColors?.[firstRel.tags?.ref || refKey] ||
      extractColor(tags, '#888888');

    lines.push({
      id: lineId,
      cityId,
      nameKo: config.lineNameKo
        ? config.lineNameKo(firstRel.tags?.ref || refKey, nameInfo.name)
        : config.preferEnglish
          ? (nameInfo.nameEn || nameInfo.name)
          : (nameInfo.nameLocal || nameInfo.name),
      nameEn: nameInfo.nameEn || nameInfo.name,
      color,
      textColor: isDarkColor(color) ? 'white' : 'black',
      lineOrder,
    });

    // 모든 방향 relation 의 stop 노드 모으기 (중복 제거, 순서 유지)
    const stopsOrdered: number[] = [];
    for (const rel of rels) {
      const stops = extractStopsFromRelation(rel);
      for (const s of stops) {
        if (!stopsOrdered.includes(s)) stopsOrdered.push(s);
      }
    }

    let stationOrder = 0;
    let prevStationId: string | null = null;
    let matched = 0;
    let unmatched = 0;

    for (const osmStopId of stopsOrdered) {
      const stopNode = nodesById.get(osmStopId);
      if (!stopNode || stopNode.lat === undefined || stopNode.lon === undefined) continue;

      // 이미 본 stop 이면 그대로 (라우트가 같은 stop 을 두 번 참조한 경우)
      let stationId = stationIdByStopOsm.get(osmStopId);

      if (!stationId) {
        // 이 stop 근처의 named-station 찾기
        const named = findNearestNamed(stopNode.lat, stopNode.lon, matchRadiusM);

        if (named) {
          stationId = stationIdByNamedOsm.get(named.id);
          if (!stationId) {
            // 새 named-station — Draft 생성
            stationId = `${cityId.slice(0, 2)}_${String(named.id).slice(-7)}`;
            stationIdByNamedOsm.set(named.id, stationId);
            const stTags = named.tags || {};
            const stNameInfo = getStationName(stTags);
            // 우선순위:
            //   1) name:ko (명시적 한글)
            //   2) 사용자 fallback
            //   3) preferEnglish=true 이면 name:en 우선 (유럽/미국/중동/동남아 권장)
            //   4) name (현지어 — 한국/일본/중국에선 한글/일본어/중국어, 그 외엔 아랍어/베트남어 등)
            //   5) name:en
            //   6) nameLocal
            const nameKo =
              stNameInfo.nameKo ||
              (config.stationNameKoFallback && config.stationNameKoFallback(stTags)) ||
              (config.preferEnglish ? stNameInfo.nameEn : undefined) ||
              stNameInfo.name ||
              stNameInfo.nameEn ||
              stNameInfo.nameLocal;
            stationDrafts.push({
              id: stationId,
              osmNamedId: named.id,
              cityId,
              nameKo,
              nameEn: stNameInfo.nameEn || stNameInfo.name,
              nameLocal: stNameInfo.nameLocal,
              lat: named.lat!,
              lon: named.lon!,
            });
            matched++;
          } else {
            matched++;
          }
        } else {
          // named 없음 — 좌표만 있는 fallback
          stationId = `${cityId.slice(0, 2)}_x${String(osmStopId).slice(-7)}`;
          stationDrafts.push({
            id: stationId,
            cityId,
            nameKo: '',
            nameEn: '',
            lat: stopNode.lat,
            lon: stopNode.lon,
          });
          unmatched++;
        }
        stationIdByStopOsm.set(osmStopId, stationId);
      }

      stationOrder++;
      stationLines.push({ stationId, lineId, stationOrder });

      if (prevStationId && prevStationId !== stationId) {
        connections.push({
          from: prevStationId,
          to: stationId,
          lineId,
          duration: 90,
        });
      }
      prevStationId = stationId;
    }

    console.log(
      `  [${refKey}] ${stationOrder} 정거장 (named ${matched}, 좌표만 ${unmatched})`,
    );
  }

  // ── 6) 환승역 통합 — 같은 좌표 (≤mergeRadiusM) 에 있는 named 역끼리 한 ID 로 ─────
  // (OSM 에서 같은 환승역이 노선마다 다른 node 로 나뉘어 있는 경우 처리)
  const drafts = stationDrafts;
  const idAlias = new Map<string, string>();
  for (let i = 0; i < drafts.length; i++) {
    const a = drafts[i];
    if (idAlias.has(a.id)) continue;
    for (let j = i + 1; j < drafts.length; j++) {
      const b = drafts[j];
      if (idAlias.has(b.id)) continue;
      if (a.nameKo && b.nameKo && a.nameKo === b.nameKo) {
        // 같은 이름 → 같은 역 (좌표 ≤500m 일 때만)
        if (haversineM(a.lat, a.lon, b.lat, b.lon) <= 500) {
          idAlias.set(b.id, a.id);
        }
      } else if (haversineM(a.lat, a.lon, b.lat, b.lon) <= mergeRadiusM) {
        // 이름 다르지만 좌표 매우 가까움 → 환승역으로 통합
        idAlias.set(b.id, a.id);
      }
    }
  }

  // 별칭 적용
  const aliasResolve = (id: string) => {
    let cur = id;
    while (idAlias.has(cur)) cur = idAlias.get(cur)!;
    return cur;
  };

  // stations 배열 — alias 적용 후 unique
  const uniqStations = new Map<string, Station>();
  for (const d of drafts) {
    const finalId = aliasResolve(d.id);
    if (!uniqStations.has(finalId)) {
      uniqStations.set(finalId, {
        id: finalId,
        cityId,
        nameKo: d.nameKo,
        nameEn: d.nameEn,
        nameLocal: d.nameLocal,
        lat: d.lat,
        lon: d.lon,
      });
    } else {
      // 기존에 이름 비어있고 새로 들어온 게 이름 있으면 갈아끼움
      const existing = uniqStations.get(finalId)!;
      if (!existing.nameKo && d.nameKo) {
        existing.nameKo = d.nameKo;
        existing.nameEn = d.nameEn;
        existing.nameLocal = d.nameLocal;
      }
    }
  }
  const stations = Array.from(uniqStations.values());

  // stationLines / connections 에도 alias 적용
  const aliasedStationLines: StationLine[] = stationLines.map((sl) => ({
    ...sl,
    stationId: aliasResolve(sl.stationId),
  }));
  const aliasedConnections: Connection[] = [];
  for (const c of connections) {
    const from = aliasResolve(c.from);
    const to = aliasResolve(c.to);
    if (from !== to) aliasedConnections.push({ ...c, from, to });
  }

  // ── 7) 좌표 정규화 (0-100 x,y) — 옛 UI 호환 ────────
  if (stations.length > 0) {
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
        s.y = Math.round((1 - (s.lat - minLat) / latRange) * 100 * 10) / 10;
      }
    }
  }

  // ── 8) 결과 조립 + 환승역 마킹 + 검증 ───────────────
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
    stationLines: aliasedStationLines,
    connections: aliasedConnections,
  };

  result = markTransferStations(result);

  const v = validateCityResult(result);
  if (!v.ok) {
    console.warn(`[${cityId}] ⚠️ 검증 경고:`);
    v.errors.slice(0, 10).forEach((e) => console.warn(`  ${e}`));
    if (v.errors.length > 10) console.warn(`  ... and ${v.errors.length - 10} more`);
  }

  // 이름 보강율
  const named = stations.filter((s) => s.nameKo || s.nameEn).length;
  console.log(
    `[${cityId}] ✓ 완료: ${lines.length} 노선 / ${stations.length} 역 ` +
    `(이름있음 ${named}, ${Math.round((named / Math.max(stations.length, 1)) * 100)}%) ` +
    `/ ${aliasedConnections.length} 연결`,
  );

  await sleep(2000);
  return result;
}

// ── helpers ─────────────────────────────────────────

function isDarkColor(hex: string): boolean {
  const m = hex.match(/^#?([0-9A-Fa-f]{6})$/);
  if (!m) return false;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq < 128;
}

/** Haversine 거리 (m) */
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const dφ = ((lat2 - lat1) * Math.PI) / 180;
  const dλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
