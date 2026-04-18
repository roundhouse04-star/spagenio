/**
 * 교통 - 도시별 상세
 *
 * - 노선 목록 (transit_lines, 색상)
 * - 노선 클릭 → station_lines를 통해 역 펼침 (station_order 정렬)
 * - 상단 검색 → transit_stations에서 역 검색
 */
import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors, Typography, Spacing, Shadows } from '@/theme/theme';
import { haptic } from '@/utils/haptics';
import transitData from '@/data/transit.json';

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

const CITY_FLAGS: Record<string, string> = {
  seoul: '🇰🇷', tokyo: '🇯🇵', osaka: '🇯🇵', kyoto: '🇯🇵',
  bangkok: '🇹🇭', singapore: '🇸🇬', hongkong: '🇭🇰', taipei: '🇹🇼',
  paris: '🇫🇷', london: '🇬🇧', newyork: '🇺🇸', berlin: '🇩🇪',
  barcelona: '🇪🇸', rome: '🇮🇹', amsterdam: '🇳🇱',
};

export default function TransitCityScreen() {
  const { city } = useLocalSearchParams<{ city: string }>();
  const cityId = city as string;

  const data = transitData as any;
  const cityInfo = (data.cities || []).find((c: any) => c.id === cityId);
  const flag = CITY_FLAGS[cityId] || '🌍';

  const lines: Line[] = (data.lines || []).filter((l: Line) => l.cityId === cityId)
    .sort((a: Line, b: Line) => a.lineOrder - b.lineOrder);

  const stations: Station[] = (data.stations || []).filter((s: Station) => s.cityId === cityId);

  const stationLines: StationLine[] = data.stationLines || [];

  // station_id로 빠르게 lookup
  const stationsById = useMemo(() => {
    const map: Record<string, Station> = {};
    stations.forEach((s) => { map[s.id] = s; });
    return map;
  }, [stations]);

  // 노선별 역 목록 (station_order 정렬)
  const stationsByLine = useMemo(() => {
    const map: Record<string, Station[]> = {};
    lines.forEach((line) => {
      const ids = stationLines
        .filter((sl) => sl.lineId === line.id)
        .sort((a, b) => a.stationOrder - b.stationOrder)
        .map((sl) => sl.stationId);
      map[line.id] = ids.map((id) => stationsById[id]).filter(Boolean);
    });
    return map;
  }, [lines, stationLines, stationsById]);

  // 역마다 어떤 노선에 속하는지 (환승역 표시용)
  const linesByStation = useMemo(() => {
    const map: Record<string, Line[]> = {};
    stationLines.forEach((sl) => {
      const line = lines.find((l) => l.id === sl.lineId);
      if (!line) return;
      if (!map[sl.stationId]) map[sl.stationId] = [];
      map[sl.stationId].push(line);
    });
    return map;
  }, [stationLines, lines]);

  const [search, setSearch] = useState('');
  const [openLineId, setOpenLineId] = useState<string | null>(null);

  const filteredStations = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return stations.filter((s) => {
      return (s.nameKo || '').toLowerCase().includes(q) ||
             (s.nameEn || '').toLowerCase().includes(q);
    }).slice(0, 50);
  }, [search, stations]);

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

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="역 이름 검색 (한글/영문)"
          placeholderTextColor={Colors.textTertiary}
        />
        {search ? (
          <Pressable onPress={() => { haptic.tap(); setSearch(''); }}>
            <Text style={styles.clearIcon}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
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
                          style={[styles.lineBadge, { backgroundColor: l.color }]}
                        >
                          <Text style={[styles.lineBadgeText, { color: l.textColor || '#fff' }]}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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
  backText: { fontSize: 22, color: Colors.textPrimary },
  headerTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSub: {
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontSize: Typography.bodyMedium,
    color: Colors.textPrimary,
    paddingVertical: 4,
  },
  clearIcon: { fontSize: 14, color: Colors.textTertiary, paddingHorizontal: 4 },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.huge },
  section: { marginBottom: Spacing.xl },
  sectionLabel: {
    fontSize: Typography.labelMedium,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  emptyBox: {
    backgroundColor: Colors.surface,
    padding: Spacing.huge,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  emptyIcon: { fontSize: 36, marginBottom: Spacing.md },
  emptyText: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  lineWrap: {
    marginBottom: Spacing.sm,
    borderRadius: 12,
    overflow: 'hidden',
  },
  lineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  lineCardText: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
  },
  lineCardSub: {
    fontSize: Typography.labelSmall,
    opacity: 0.85,
    marginTop: 1,
  },
  lineCardCount: {
    fontSize: Typography.labelMedium,
    fontWeight: '700',
    opacity: 0.9,
  },
  stationList: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  stationDotMini: {
    width: 18,
    alignItems: 'center',
    paddingTop: 14,
    position: 'relative',
  },
  dotColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 2,
  },
  dotLine: {
    position: 'absolute',
    width: 3,
    top: 22,
    bottom: -10,
    left: 7.5,
  },
  stationNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  stationName: {
    fontSize: Typography.bodyMedium,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  stationNameEn: {
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  transferBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  stationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 10,
    marginBottom: Spacing.xs,
  },
  lineBadges: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: 140,
  },
  lineBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lineBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
