/**
 * 교통 - 도시별 상세 화면
 *
 * - 노선 목록 (색상 배지)
 * - 역 검색
 * - 노선별 역 펼침
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
  id: string | number;
  city: string;
  name?: string;
  nameKo?: string;
  nameEn?: string;
  color?: string;
  textColor?: string;
}

interface Station {
  id: string | number;
  city: string;
  lineId?: string | number;
  name?: string;
  nameKo?: string;
  nameEn?: string;
  isTransfer?: number;
}

interface Connection {
  fromStationId: string | number;
  toStationId: string | number;
  lineId: string | number;
}

const CITY_INFO: Record<string, { name: string; flag: string }> = {
  seoul: { name: '서울', flag: '🇰🇷' },
  tokyo: { name: '도쿄', flag: '🇯🇵' },
  osaka: { name: '오사카', flag: '🇯🇵' },
  bangkok: { name: '방콕', flag: '🇹🇭' },
  singapore: { name: '싱가포르', flag: '🇸🇬' },
  hongkong: { name: '홍콩', flag: '🇭🇰' },
  paris: { name: '파리', flag: '🇫🇷' },
  london: { name: '런던', flag: '🇬🇧' },
};

export default function TransitCityScreen() {
  const { city } = useLocalSearchParams<{ city: string }>();
  const cityId = city as string;
  const cityInfo = CITY_INFO[cityId] || { name: cityId, flag: '🌍' };

  const [search, setSearch] = useState('');
  const [openLine, setOpenLine] = useState<string | number | null>(null);

  const data = transitData as any;
  const lines: Line[] = (data.lines || []).filter((l: Line) => l.city === cityId);
  const stations: Station[] = (data.stations || []).filter((s: Station) => s.city === cityId);

  const filteredStations = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return stations.filter((s) => {
      const ko = (s.nameKo || s.name || '').toLowerCase();
      const en = (s.nameEn || '').toLowerCase();
      return ko.includes(q) || en.includes(q);
    }).slice(0, 30);
  }, [search, stations]);

  const stationsByLine = (lineId: string | number) =>
    stations.filter((s) => s.lineId === lineId);

  const toggleLine = (lineId: string | number) => {
    haptic.tap();
    setOpenLine(openLine === lineId ? null : lineId);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{cityInfo.flag} {cityInfo.name}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="역 이름 검색"
          placeholderTextColor={Colors.textTertiary}
        />
        {search ? (
          <Pressable onPress={() => { haptic.tap(); setSearch(''); }}>
            <Text style={styles.clearIcon}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 검색 결과 */}
        {search ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              검색 결과 ({filteredStations.length})
            </Text>
            {filteredStations.length === 0 ? (
              <Text style={styles.emptyText}>일치하는 역이 없어요</Text>
            ) : (
              filteredStations.map((s) => {
                const line = lines.find((l) => l.id === s.lineId);
                return (
                  <View key={s.id} style={styles.stationItem}>
                    <View style={styles.stationDot}>
                      {line && <View style={[styles.dotColor, { backgroundColor: line.color || '#888' }]} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stationName}>{s.nameKo || s.name}</Text>
                      {s.nameEn && <Text style={styles.stationNameEn}>{s.nameEn}</Text>}
                    </View>
                    {line && (
                      <View style={[styles.lineBadge, { backgroundColor: line.color || '#888' }]}>
                        <Text style={[styles.lineBadgeText, { color: line.textColor || '#fff' }]}>
                          {line.nameKo || line.name}
                        </Text>
                      </View>
                    )}
                    {s.isTransfer ? (
                      <Text style={styles.transferIcon}>🔄</Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        ) : (
          <>
            {/* 노선 목록 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>노선 ({lines.length})</Text>
              {lines.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyIcon}>🚧</Text>
                  <Text style={styles.emptyText}>노선 데이터를 준비 중이에요</Text>
                  <Text style={styles.emptyDesc}>곧 추가될 예정입니다</Text>
                </View>
              ) : (
                lines.map((line) => {
                  const isOpen = openLine === line.id;
                  const stationsOnLine = stationsByLine(line.id);
                  return (
                    <View key={line.id} style={styles.lineWrap}>
                      <Pressable
                        style={[
                          styles.lineCard,
                          { backgroundColor: line.color || '#888' },
                        ]}
                        onPress={() => toggleLine(line.id)}
                      >
                        <Text style={[styles.lineCardText, { color: line.textColor || '#fff' }]}>
                          {line.nameKo || line.name}
                        </Text>
                        <Text style={[styles.lineCardCount, { color: line.textColor || '#fff' }]}>
                          {stationsOnLine.length}개 역 {isOpen ? '▲' : '▼'}
                        </Text>
                      </Pressable>
                      {isOpen && stationsOnLine.length > 0 && (
                        <View style={styles.stationList}>
                          {stationsOnLine.map((s, idx) => (
                            <View key={s.id} style={styles.stationRow}>
                              <View style={styles.stationDotMini}>
                                <View style={[styles.dotColorMini, { backgroundColor: line.color || '#888' }]} />
                                {idx < stationsOnLine.length - 1 && (
                                  <View style={[styles.dotLine, { backgroundColor: line.color || '#888' }]} />
                                )}
                              </View>
                              <View style={{ flex: 1, paddingVertical: 6 }}>
                                <Text style={styles.stationName}>{s.nameKo || s.name}</Text>
                                {s.nameEn && <Text style={styles.stationNameEn}>{s.nameEn}</Text>}
                              </View>
                              {s.isTransfer ? <Text style={styles.transferIcon}>🔄</Text> : null}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </>
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
    justifyContent: 'space-between',
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
    padding: Spacing.xxxl,
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
  emptyDesc: {
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  lineWrap: {
    marginBottom: Spacing.sm,
    borderRadius: 12,
    overflow: 'hidden',
  },
  lineCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  lineCardText: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
  },
  lineCardCount: {
    fontSize: Typography.labelSmall,
    fontWeight: '600',
    opacity: 0.85,
  },
  stationList: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stationDotMini: {
    width: 16,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dotColorMini: {
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 2,
  },
  dotLine: {
    position: 'absolute',
    width: 2,
    top: 14,
    bottom: -10,
    left: 7,
  },
  stationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 10,
    marginBottom: Spacing.xs,
  },
  stationDot: {
    width: 16,
    alignItems: 'center',
  },
  dotColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
  lineBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
  },
  lineBadgeText: {
    fontSize: Typography.labelSmall,
    fontWeight: '700',
  },
  transferIcon: {
    fontSize: 14,
  },
});
