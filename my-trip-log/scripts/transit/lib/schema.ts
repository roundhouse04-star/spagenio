/**
 * 출력 transit JSON 스키마 정의 및 검증
 * 기존 transit.json과 동일한 스키마
 */

export type City = {
  id: string;
  nameKo: string;
  nameEn: string;
  country: string; // ISO 2자리 (KR, JP, CN, TW)
  timezone: string;
};

export type Line = {
  id: string;
  cityId: string;
  nameKo: string;
  nameEn: string;
  color: string; // #RRGGBB
  textColor?: string; // 'white' or 'black'
  lineOrder?: number;
};

export type Station = {
  id: string;
  cityId: string;
  nameKo: string;
  nameEn: string;
  nameLocal?: string;
  x?: number; // 정규화된 0-100 좌표 (UI에서 안 쓰지만 호환성 유지)
  y?: number;
  lat?: number; // 실제 위경도 (선택)
  lon?: number;
  isTransfer?: number; // 0 or 1
};

export type StationLine = {
  stationId: string;
  lineId: string;
  stationOrder: number;
};

export type Connection = {
  from: string; // stationId
  to: string;
  lineId: string;
  duration?: number; // 초 단위, 기본 90
};

export type CityResult = {
  city: City;
  lines: Line[];
  stations: Station[];
  stationLines: StationLine[];
  connections: Connection[];
};

/**
 * 데이터 무결성 검증
 */
export function validateCityResult(r: CityResult): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  // 기본 검증
  if (!r.city.id) errors.push('city.id 누락');
  if (!r.city.nameKo) errors.push('city.nameKo 누락');
  if (r.lines.length === 0) errors.push('lines 비어있음');
  if (r.stations.length === 0) errors.push('stations 비어있음');

  // 모든 station이 city에 소속
  for (const s of r.stations) {
    if (s.cityId !== r.city.id) errors.push(`station ${s.id}: cityId mismatch`);
    if (!s.nameKo) errors.push(`station ${s.id}: nameKo 누락`);
  }

  // 모든 line이 city에 소속
  for (const l of r.lines) {
    if (l.cityId !== r.city.id) errors.push(`line ${l.id}: cityId mismatch`);
    if (!l.color || !/^#[0-9A-Fa-f]{6}$/.test(l.color)) {
      errors.push(`line ${l.id}: 색상 잘못됨 (${l.color})`);
    }
  }

  // stationLine 참조 검증
  const stationIds = new Set(r.stations.map((s) => s.id));
  const lineIds = new Set(r.lines.map((l) => l.id));
  for (const sl of r.stationLines) {
    if (!stationIds.has(sl.stationId)) errors.push(`stationLine: 없는 station ${sl.stationId}`);
    if (!lineIds.has(sl.lineId)) errors.push(`stationLine: 없는 line ${sl.lineId}`);
  }

  // connection 참조 검증
  for (const c of r.connections) {
    if (!stationIds.has(c.from)) errors.push(`connection: 없는 from ${c.from}`);
    if (!stationIds.has(c.to)) errors.push(`connection: 없는 to ${c.to}`);
    if (!lineIds.has(c.lineId)) errors.push(`connection: 없는 line ${c.lineId}`);
  }

  return { ok: errors.length === 0, errors };
}

/**
 * 환승역 자동 마킹 (2개 이상 노선 가진 역)
 */
export function markTransferStations(r: CityResult): CityResult {
  const stationLineCount = new Map<string, number>();
  for (const sl of r.stationLines) {
    stationLineCount.set(sl.stationId, (stationLineCount.get(sl.stationId) || 0) + 1);
  }
  const newStations = r.stations.map((s) => ({
    ...s,
    isTransfer: (stationLineCount.get(s.id) || 0) >= 2 ? 1 : 0,
  }));
  return { ...r, stations: newStations };
}
