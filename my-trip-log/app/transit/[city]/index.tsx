/**
 * 교통 - 도시별 상세 (ROUTE 검색 + LINES 노선 목록)
 *
 * - ROUTE 탭: 경로 검색 (Dijkstra + 세그먼트 + 환승 표시)
 * - LINES 탭: 노선 목록 + 역 펼침
 */
import { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator,
  Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import transitData from '@/data/transit.json';
import { getOfficialTransitInfo } from '@/data/transitOfficial';

interface CityInfo {
  id: string;
  nameKo: string;
  nameEn: string;
  country: string;
  timezone: string;
}

// 컴포넌트 밖에서 한 번만 파싱 (리렌더 시 참조 안정)
const DATA = transitData as {
  cities?: CityInfo[];
  lines?: Line[];
  stations?: Station[];
  stationLines?: StationLine[];
  connections?: Connection[];
};
const ALL_CITIES: CityInfo[] = DATA.cities ?? [];
const ALL_LINES: Line[] = DATA.lines ?? [];
const ALL_STATIONS: Station[] = DATA.stations ?? [];
const ALL_STATION_LINES: StationLine[] = DATA.stationLines ?? [];
const ALL_CONNECTIONS: Connection[] = DATA.connections ?? [];

interface Line {
  id: string;
  cityId: string;
  nameKo: string;
  nameEn: string;
  color: string;
  textColor: string;
  lineOrder: number;
}
interface Station {
  id: string;
  cityId: string;
  nameKo: string;
  nameEn: string;
  x: number;
  y: number;
  isTransfer: number;
}
interface StationLine {
  stationId: string;
  lineId: string;
  stationOrder: number;
}
interface Connection {
  id: number;
  fromStationId: string;
  toStationId: string;
  lineId: string;
  travelTime: number;
  isTransfer: number;
}
interface Segment {
  lineId: string;
  stations: string[];
}
interface RouteResult {
  error?: string;
  totalTime: number;
  path: { stationId: string; lineId?: string }[];
  segments: Segment[];
  stationMap: Record<string, Station>;
  lineMap: Record<string, Line>;
  from: Station;
  to: Station;
  transfers: number;
}

const CITY_FLAGS: Record<string, string> = {
  seoul: '🇰🇷', busan: '🇰🇷',
  tokyo: '🇯🇵', osaka: '🇯🇵', kyoto: '🇯🇵', fukuoka: '🇯🇵',
  bangkok: '🇹🇭', singapore: '🇸🇬', hongkong: '🇭🇰', taipei: '🇹🇼',
  shanghai: '🇨🇳', beijing: '🇨🇳',
  paris: '🇫🇷', london: '🇬🇧', newyork: '🇺🇸', berlin: '🇩🇪',
  barcelona: '🇪🇸', rome: '🇮🇹', amsterdam: '🇳🇱',
};

export default function TransitCityScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { city } = useLocalSearchParams<{ city: string }>();
  const cityId = city as string;
  const cityInfo = ALL_CITIES.find((c) => c.id === cityId);
  const flag = CITY_FLAGS[cityId] || '🌍';

  const lines: Line[] = useMemo(
    () => ALL_LINES.filter((l: Line) => l.cityId === cityId)
      .sort((a: Line, b: Line) => a.lineOrder - b.lineOrder),
    [cityId]
  );

  const stations: Station[] = useMemo(
    () => ALL_STATIONS.filter((s: Station) => s.cityId === cityId),
    [cityId]
  );

  const stationLines: StationLine[] = ALL_STATION_LINES;

  // 이 도시의 station ID set
  const cityStationIds = useMemo(() => {
    const set = new Set<string>();
    stations.forEach(s => set.add(s.id));
    return set;
  }, [stations]);

  const connections: Connection[] = useMemo(
    () => ALL_CONNECTIONS.filter(
      (c: Connection) => cityStationIds.has(c.fromStationId) && cityStationIds.has(c.toStationId)
    ),
    [cityStationIds]
  );

  // ── 탭 ──
  const [tab, setTab] = useState<'route' | 'lines'>('route');

  // ── 경로 검색 (ROUTE 탭) ──
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [searching, setSearching] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteResult | { error: string } | null>(null);

  // ── 노선/검색 (LINES 탭) ──
  const [openLineId, setOpenLineId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const stationsByLine = useMemo(() => {
    const map: Record<string, Station[]> = {};
    const stationMap: Record<string, Station> = {};
    stations.forEach((s) => { stationMap[s.id] = s; });
    stationLines.forEach((sl) => {
      if (!cityStationIds.has(sl.stationId)) return;
      if (!map[sl.lineId]) map[sl.lineId] = [];
      const st = stationMap[sl.stationId];
      if (st) map[sl.lineId].push(st);
    });
    Object.keys(map).forEach((lineId) => {
      map[lineId].sort((a, b) => {
        const slA = stationLines.find((sl) => sl.stationId === a.id && sl.lineId === lineId);
        const slB = stationLines.find((sl) => sl.stationId === b.id && sl.lineId === lineId);
        return (slA?.stationOrder || 0) - (slB?.stationOrder || 0);
      });
    });
    return map;
  }, [stations, stationLines, cityStationIds]);

  const linesByStation = useMemo(() => {
    const map: Record<string, Line[]> = {};
    const lineMap: Record<string, Line> = {};
    lines.forEach((l) => { lineMap[l.id] = l; });
    stationLines.forEach((sl) => {
      if (!cityStationIds.has(sl.stationId)) return;
      if (!map[sl.stationId]) map[sl.stationId] = [];
      const ln = lineMap[sl.lineId];
      if (ln) map[sl.stationId].push(ln);
    });
    return map;
  }, [lines, stationLines, cityStationIds]);

  const filteredStations = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    return stations.filter((s) => {
      return (s.nameKo || '').toLowerCase().includes(q) ||
             (s.nameEn || '').toLowerCase().includes(q);
    }).slice(0, 50);
  }, [search, stations]);

  // ── Dijkstra 경로 탐색 ──
  const searchRoute = () => {
    if (!fromText.trim() || !toText.trim()) return;
    setSearching(true);
    setRouteResult(null);

    const stationMap: Record<string, Station> = {};
    stations.forEach((s) => { stationMap[s.id] = s; });
    const lineMap: Record<string, Line> = {};
    lines.forEach((l) => { lineMap[l.id] = l; });

    const fromStation = stations.find((s) =>
      (s.nameKo || '').includes(fromText.trim()) ||
      (s.nameEn || '').toLowerCase().includes(fromText.trim().toLowerCase())
    );
    const toStation = stations.find((s) =>
      (s.nameKo || '').includes(toText.trim()) ||
      (s.nameEn || '').toLowerCase().includes(toText.trim().toLowerCase())
    );

    if (!fromStation || !toStation) {
      setRouteResult({ error: '역을 찾을 수 없어요' });
      setSearching(false);
      haptic.warning();
      return;
    }

    // 인접 그래프
    const graph: Record<string, { to: string; lineId: string; time: number }[]> = {};
    connections.forEach((c) => {
      if (!graph[c.fromStationId]) graph[c.fromStationId] = [];
      if (!graph[c.toStationId]) graph[c.toStationId] = [];
      graph[c.fromStationId].push({ to: c.toStationId, lineId: c.lineId, time: c.travelTime || 2 });
      graph[c.toStationId].push({ to: c.fromStationId, lineId: c.lineId, time: c.travelTime || 2 });
    });

    // Dijkstra (visited 체크 + 반복 제한)
    const distances: Record<string, number> = { [fromStation.id]: 0 };
    const prev: Record<string, { from: string; lineId: string }> = {};
    const visited = new Set<string>();
    const pq: { station: string; dist: number }[] = [{ station: fromStation.id, dist: 0 }];
    let iterations = 0;

    while (pq.length > 0 && iterations++ < 100000) {
      pq.sort((a, b) => a.dist - b.dist);
      const current = pq.shift()!;
      if (visited.has(current.station)) continue;
      visited.add(current.station);
      if (current.station === toStation.id) break;
      (graph[current.station] || []).forEach((neighbor) => {
        if (visited.has(neighbor.to)) return;
        const newDist = current.dist + neighbor.time;
        if (distances[neighbor.to] === undefined || newDist < distances[neighbor.to]) {
          distances[neighbor.to] = newDist;
          prev[neighbor.to] = { from: current.station, lineId: neighbor.lineId };
          pq.push({ station: neighbor.to, dist: newDist });
        }
      });
    }

    if (distances[toStation.id] === undefined) {
      setRouteResult({ error: '경로를 찾을 수 없어요' });
      setSearching(false);
      haptic.warning();
      return;
    }

    // 경로 재구성
    const path: { stationId: string; lineId?: string }[] = [];
    let curr: string | undefined = toStation.id;
    while (curr) {
      path.unshift({ stationId: curr, ...(prev[curr] || {}) });
      curr = prev[curr]?.from;
    }

    // 세그먼트 생성 (엣지 기반)
    const segments: Segment[] = [];
    let curLine: string | null = null;
    let curSegment: string[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const fromId = path[i].stationId;
      const toId = path[i + 1].stationId;
      const lineId = path[i + 1].lineId || null;
      if (lineId !== curLine) {
        if (curSegment.length > 0) {
          segments.push({ lineId: curLine as string, stations: curSegment });
        }
        curLine = lineId;
        curSegment = [fromId];
      }
      curSegment.push(toId);
    }
    if (curSegment.length > 0) {
      segments.push({ lineId: curLine as string, stations: curSegment });
    }

    // "transfer" 세그먼트는 환승 표시일 뿐 - 제거
    const cleanSegments = segments.filter((s) =>
      s.lineId && s.lineId !== 'transfer' && s.stations.length >= 2
    );

    setRouteResult({
      totalTime: distances[toStation.id],
      path,
      segments: cleanSegments,
      stationMap,
      lineMap,
      from: fromStation,
      to: toStation,
      transfers: Math.max(0, cleanSegments.length - 1),
    });
    setSearching(false);
    haptic.success();

    // 검색 후 입력란 초기화
    setFromText('');
    setToText('');
  };

  const officialInfo = getOfficialTransitInfo(cityId);
  const handleOpenOfficial = () => {
    if (!officialInfo) return;
    haptic.tap();
    Linking.openURL(officialInfo.url).catch(() => {
      Alert.alert('링크 열기 실패', '인터넷 연결을 확인해주세요.');
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {flag} {cityInfo?.nameKo || cityId}
          </Text>
          <Text style={styles.headerSub}>
            {lines.length}개 노선 · {stations.length}개 역
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* 공식 노선도 링크 — 인앱 데이터가 부정확할 수 있으니 항상 공식 페이지 안내 */}
      {officialInfo && (
        <Pressable style={styles.officialBox} onPress={handleOpenOfficial}>
          <View style={styles.officialIconWrap}>
            <Text style={styles.officialIcon}>🌐</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.officialEyebrow}>OFFICIAL MAP</Text>
            <Text style={styles.officialAgency} numberOfLines={1}>
              {officialInfo.agency} 공식 노선도
            </Text>
            <Text style={styles.officialDesc}>
              운행 시간·요금·역명 최신 정보
            </Text>
          </View>
          <Text style={styles.officialArrow}>↗</Text>
        </Pressable>
      )}

      {/* 탭 */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabBtn, tab === 'route' && styles.tabBtnActive]}
          onPress={() => { haptic.tap(); setTab('route'); }}
        >
          <Text style={[styles.tabText, tab === 'route' && styles.tabTextActive]}>
            ROUTE
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, tab === 'lines' && styles.tabBtnActive]}
          onPress={() => { haptic.tap(); setTab('lines'); }}
        >
          <Text style={[styles.tabText, tab === 'lines' && styles.tabTextActive]}>
            LINES
          </Text>
        </Pressable>
      </View>

      {tab === 'route' ? (
        <ScrollView 
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
        >
          {/* 경로 검색 입력 */}
          <View style={styles.routeInputBox}>
            <Text style={styles.fieldLabel}>FROM</Text>
            <TextInput
              style={styles.input}
              value={fromText}
              onChangeText={setFromText}
              placeholder="출발역"
              placeholderTextColor={colors.textTertiary}
            />
            <View style={styles.divider} />
            <Text style={styles.fieldLabel}>TO</Text>
            <TextInput
              style={styles.input}
              value={toText}
              onChangeText={setToText}
              placeholder="도착역"
              placeholderTextColor={colors.textTertiary}
            />
            <Pressable
              style={[styles.searchBtn, searching && { opacity: 0.5 }]}
              onPress={searchRoute}
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.searchBtnText}>FIND ROUTE</Text>
              )}
            </Pressable>
          </View>

          {/* 에러 표시 */}
          {routeResult && 'error' in routeResult && (
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>😢</Text>
              <Text style={styles.errorText}>{routeResult.error}</Text>
            </View>
          )}

          {/* 결과 표시 */}
          {routeResult && !('error' in routeResult) && (
            <View style={styles.resultWrap}>
              {/* 출발 → 도착 */}
              <View style={styles.routeHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeHeaderLabel}>FROM</Text>
                  <Text style={styles.routeHeaderStation}>
                    {routeResult.from?.nameKo || routeResult.from?.nameEn}
                  </Text>
                  {routeResult.from?.nameEn && routeResult.from?.nameKo && (
                    <Text style={styles.routeHeaderEn}>{routeResult.from.nameEn}</Text>
                  )}
                </View>
                <Text style={styles.routeArrow}>→</Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={styles.routeHeaderLabel}>TO</Text>
                  <Text style={styles.routeHeaderStation}>
                    {routeResult.to?.nameKo || routeResult.to?.nameEn}
                  </Text>
                  {routeResult.to?.nameEn && routeResult.to?.nameKo && (
                    <Text style={styles.routeHeaderEn}>{routeResult.to.nameEn}</Text>
                  )}
                </View>
              </View>

              {/* 요약 카드 */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNum}>{routeResult.totalTime}분</Text>
                  <Text style={styles.summaryLabel}>예상 시간</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNum}>{routeResult.path.length - 1}</Text>
                  <Text style={styles.summaryLabel}>정거장</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNum}>{routeResult.transfers}</Text>
                  <Text style={styles.summaryLabel}>환승</Text>
                </View>
              </View>

              <Text style={styles.detailsLabel}>상세 경로</Text>

              {/* 세그먼트별 렌더링 */}
              {routeResult.segments.map((seg, si) => {
                const line = routeResult.lineMap[seg.lineId];
                const lineColor = line?.color || '#888';
                const lineName = line?.nameKo || line?.nameEn || '노선';
                const nextSeg = routeResult.segments[si + 1];
                const nextLine = nextSeg ? routeResult.lineMap[nextSeg.lineId] : null;
                return (
                  <View key={si} style={{ marginBottom: Spacing.lg }}>
                    {/* 라인 헤더 */}
                    <View style={styles.segHeader}>
                      <View style={[styles.lineBadge, { backgroundColor: lineColor }]}>
                        <Text style={styles.lineBadgeText}>{lineName}</Text>
                      </View>
                      <Text style={styles.segStops}>{seg.stations.length - 1}정거장</Text>
                    </View>
                    {/* 세그먼트 역들 */}
                    <View style={[styles.segBody, { borderLeftColor: lineColor }]}>
                      {seg.stations.map((sid, idx) => {
                        const st = routeResult.stationMap[sid];
                        if (!st) return null;
                        const isFirst = idx === 0;
                        const isLast = idx === seg.stations.length - 1;
                        const faded = !isFirst && !isLast && seg.stations.length > 3;
                        return (
                          <View key={sid} style={[styles.segStation, faded && { opacity: 0.5 }]}>
                            <View style={[
                              styles.segDot,
                              { borderColor: lineColor },
                              (isFirst || isLast) && { backgroundColor: lineColor, width: 12, height: 12 },
                            ]} />
                            <Text style={[
                              styles.segStationName,
                              (isFirst || isLast) && { fontWeight: '700' },
                            ]}>
                              {st.nameKo || st.nameEn}
                            </Text>
                            {(isFirst || isLast) && st.nameEn && st.nameKo && (
                              <Text style={styles.segStationEn}>{st.nameEn}</Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                    {/* 환승 표시 */}
                    {nextLine && (
                      <View style={styles.transferBar}>
                        <Text style={styles.transferText}>
                          🔄 환승 — {nextLine.nameKo || nextLine.nameEn} 탑승
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* 빈 상태 */}
          {!routeResult && (
            <View style={styles.emptyRouteBox}>
              <Text style={styles.emptyIcon}>🚇</Text>
              <Text style={styles.emptyTitle}>출발/도착역을 입력하세요</Text>
              <Text style={styles.emptyDesc}>최단 경로와 소요 시간을 알려드려요</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        // LINES 탭 (기존 UI)
        <>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="역 이름 검색 (한글/영문)"
              placeholderTextColor={colors.textTertiary}
            />
            {search ? (
              <Pressable onPress={() => { haptic.tap(); setSearch(''); }}>
                <Text style={styles.clearIcon}>✕</Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView 
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
          >
            {search ? (
              // 검색 결과
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  검색 결과 ({filteredStations.length})
                </Text>
                {filteredStations.length === 0 ? (
                  <Text style={styles.emptyText}>일치하는 역이 없어요</Text>
                ) : (
                  filteredStations.map((s) => {
                    const linesForStation = linesByStation[s.id] || [];
                    return (
                      <View key={s.id} style={styles.stationItem}>
                        <View style={{ flex: 1 }}>
                          <View style={styles.stationNameRow}>
                            <Text style={styles.stationName}>{s.nameKo}</Text>
                            {s.isTransfer ? (
                              <Text style={styles.transferBadge}>환승</Text>
                            ) : null}
                          </View>
                          <Text style={styles.stationNameEn}>{s.nameEn}</Text>
                        </View>
                        <View style={styles.lineBadges}>
                          {linesForStation.slice(0, 3).map((l) => (
                            <View
                              key={l.id}
                              style={[styles.lineBadgeMini, { backgroundColor: l.color }]}
                            >
                              <Text style={[styles.lineBadgeMiniText, { color: l.textColor || '#fff' }]}>
                                {l.nameKo}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            ) : (
              // 노선 목록
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>노선</Text>
                {lines.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyIcon}>🚧</Text>
                    <Text style={styles.emptyText}>이 도시의 노선 데이터가 없어요</Text>
                  </View>
                ) : (
                  lines.map((line) => {
                    const isOpen = openLineId === line.id;
                    const stationsOnLine = stationsByLine[line.id] || [];
                    return (
                      <View key={line.id} style={styles.lineWrap}>
                        <Pressable
                          style={[styles.lineCard, { backgroundColor: line.color }]}
                          onPress={() => {
                            haptic.tap();
                            setOpenLineId(isOpen ? null : line.id);
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.lineCardText, { color: line.textColor || '#fff' }]}>
                              {line.nameKo}
                            </Text>
                            <Text style={[styles.lineCardSub, { color: line.textColor || '#fff' }]}>
                              {line.nameEn}
                            </Text>
                          </View>
                          <Text style={[styles.lineCardCount, { color: line.textColor || '#fff' }]}>
                            {stationsOnLine.length}역 {isOpen ? '▲' : '▼'}
                          </Text>
                        </Pressable>
                        {isOpen && (
                          <View style={styles.stationList}>
                            {stationsOnLine.map((s, idx) => {
                              const isLast = idx === stationsOnLine.length - 1;
                              return (
                                <View key={s.id} style={styles.stationRow}>
                                  <View style={styles.stationDotMini}>
                                    <View style={[styles.dotColor, { backgroundColor: line.color }]} />
                                    {!isLast && (
                                      <View style={[styles.dotLine, { backgroundColor: line.color }]} />
                                    )}
                                  </View>
                                  <View style={{ flex: 1, paddingVertical: 8 }}>
                                    <View style={styles.stationNameRow}>
                                      <Text style={styles.stationName}>{s.nameKo}</Text>
                                      {s.isTransfer ? (
                                        <Text style={styles.transferBadge}>환승</Text>
                                      ) : null}
                                    </View>
                                    <Text style={styles.stationNameEn}>{s.nameEn}</Text>
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  backText: { fontSize: 22, color: c.textPrimary },
  headerTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '700',
    color: c.textPrimary,
  },
  headerSub: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    marginTop: 2,
  },

  // 공식 노선도 박스
  officialBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: c.primary + '10',
    borderWidth: 1,
    borderColor: c.primary + '40',
    borderRadius: 12,
  },
  officialIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  officialIcon: { fontSize: 20 },
  officialEyebrow: {
    fontSize: 10,
    color: c.accent,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  officialAgency: {
    fontSize: Typography.bodyMedium,
    color: c.textPrimary,
    fontWeight: '700',
  },
  officialDesc: {
    fontSize: Typography.labelSmall,
    color: c.textSecondary,
    marginTop: 2,
  },
  officialArrow: {
    fontSize: 20,
    color: c.primary,
    fontWeight: '700',
    paddingHorizontal: Spacing.xs,
  },

  // 탭
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: c.primary,
  },
  tabText: {
    fontSize: Typography.labelMedium,
    fontWeight: '600',
    color: c.textTertiary,
    letterSpacing: 1,
  },
  tabTextActive: {
    color: c.primary,
    fontWeight: '700',
  },

  // 공통
  scroll: {
    padding: Spacing.xl,
    paddingBottom: Spacing.huge,
  },
  section: { marginBottom: Spacing.xxl },
  sectionLabel: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
  },

  // ROUTE 탭 - 입력
  routeInputBox: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  fieldLabel: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  input: {
    fontSize: Typography.bodyLarge,
    color: c.textPrimary,
    paddingVertical: Spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: c.borderLight,
    marginVertical: Spacing.sm,
  },
  searchBtn: {
    backgroundColor: c.primary,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  searchBtnText: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: c.textOnPrimary,
    letterSpacing: 1,
  },

  // 에러
  errorBox: {
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  errorIcon: { fontSize: 40, marginBottom: Spacing.sm },
  errorText: {
    fontSize: Typography.bodyMedium,
    color: c.textSecondary,
  },

  // 빈 상태
  emptyRouteBox: {
    alignItems: 'center',
    padding: Spacing.huge,
  },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: Typography.labelMedium,
    color: c.textTertiary,
  },

  // 결과
  resultWrap: {},
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  routeHeaderLabel: {
    fontSize: 10,
    color: c.textTertiary,
    letterSpacing: 1.5,
    marginBottom: 4,
    fontWeight: '600',
  },
  routeHeaderStation: {
    fontSize: 18,
    fontWeight: '700',
    color: c.textPrimary,
  },
  routeHeaderEn: {
    fontSize: 11,
    color: c.textTertiary,
    marginTop: 2,
  },
  routeArrow: {
    fontSize: 20,
    color: c.textTertiary,
  },

  summaryCard: {
    flexDirection: 'row',
    backgroundColor: c.surfaceAlt,
    borderRadius: 10,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: {
    fontSize: 22,
    fontWeight: '700',
    color: c.textPrimary,
  },
  summaryLabel: {
    fontSize: 11,
    color: c.textTertiary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: c.borderLight,
  },

  detailsLabel: {
    fontSize: Typography.labelMedium,
    fontWeight: '700',
    color: c.textSecondary,
    marginBottom: Spacing.md,
  },

  segHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  lineBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: Spacing.sm,
  },
  lineBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  segStops: {
    fontSize: 12,
    color: c.textTertiary,
  },
  segBody: {
    borderLeftWidth: 3,
    paddingLeft: 18,
    paddingVertical: 4,
    marginLeft: 10,
  },
  segStation: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    gap: Spacing.sm,
  },
  segDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
    borderWidth: 2,
    marginLeft: -24,
  },
  segStationName: {
    fontSize: 14,
    color: c.textPrimary,
  },
  segStationEn: {
    fontSize: 11,
    color: c.textTertiary,
  },
  transferBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingLeft: Spacing.md,
  },
  transferText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f59e0b',
  },

  // LINES 탭 - 기존 스타일
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: c.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontSize: Typography.bodyMedium,
    color: c.textPrimary,
    padding: 0,
  },
  clearIcon: { fontSize: 16, color: c.textTertiary },

  stationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  stationNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  stationName: {
    fontSize: Typography.bodyMedium,
    color: c.textPrimary,
    fontWeight: '500',
  },
  stationNameEn: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    marginTop: 2,
  },
  transferBadge: {
    fontSize: 9,
    color: '#fff',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '700',
  },
  lineBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  lineBadgeMini: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lineBadgeMiniText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },

  // 노선 카드
  lineWrap: { marginBottom: Spacing.md },
  lineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: 12,
    ...Shadows.sm,
  },
  lineCardText: {
    fontSize: Typography.titleSmall,
    fontWeight: '700',
  },
  lineCardSub: {
    fontSize: Typography.labelSmall,
    opacity: 0.85,
    marginTop: 2,
  },
  lineCardCount: {
    fontSize: Typography.labelMedium,
    fontWeight: '700',
  },
  stationList: {
    marginTop: Spacing.sm,
    marginLeft: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.md,
  },
  stationDotMini: {
    width: 20,
    alignItems: 'center',
  },
  dotColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 12,
  },
  dotLine: {
    width: 2,
    flex: 1,
    opacity: 0.5,
  },

  emptyBox: {
    alignItems: 'center',
    padding: Spacing.huge,
  },
  emptyText: {
    fontSize: Typography.bodyMedium,
    color: c.textSecondary,
    textAlign: 'center',
  },
});
}
