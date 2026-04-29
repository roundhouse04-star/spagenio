/**
 * 탐색 탭 — 검색 중심 리뉴얼
 *
 * 460개 하이라이트 + 46개 도시 통합 검색.
 * 결과 탭 → 도시 정보 카드(아래 도시 모든 하이라이트 보기) 또는 하이라이트 상세.
 * 빈 검색 상태에서는 지역별 도시 그리드 + 인기 키워드 칩 노출.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, SafeAreaView,
} from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import {
  CITY_HIGHLIGHTS,
  CITY_ALIASES,
  HIGHLIGHT_CATEGORIES,
  getHighlightsByCity,
  getCityDisplayName,
  getCityFlag,
  type CityHighlight,
  type HighlightCategory,
} from '@/data/cityHighlights';

interface CityRegion {
  label: string;
  cityIds: string[];
}

const REGIONS: CityRegion[] = [
  { label: '🇰🇷 한국', cityIds: ['seoul'] },
  { label: '🇯🇵 일본', cityIds: ['tokyo', 'osaka', 'fukuoka', 'okinawa', 'sapporo', 'kyoto'] },
  { label: '🇨🇳·🇹🇼·🇭🇰 중화권', cityIds: ['taipei', 'hongkong', 'shanghai', 'qingdao'] },
  { label: '🌴 동남아', cityIds: ['bangkok', 'phuket', 'chiangmai', 'danang', 'nhatrang', 'hochiminh', 'cebu', 'boracay', 'manila', 'bali', 'singapore', 'kualalumpur', 'kotakinabalu'] },
  { label: '🇪🇺 유럽', cityIds: ['paris', 'london', 'rome', 'barcelona', 'madrid', 'milan', 'berlin', 'vienna', 'prague', 'amsterdam', 'istanbul', 'antalya'] },
  { label: '🌎 미주·태평양', cityIds: ['newyork', 'losangeles', 'lasvegas', 'cancun', 'honolulu', 'guam', 'sydney'] },
  { label: '🌍 중동·아프리카', cityIds: ['dubai', 'cairo', 'mecca'] },
];

const POPULAR_KEYWORDS = ['미슐랭', '야경', '해변', '시장', '박물관', '카페', '신상', '한국인'];

export default function DiscoverScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [search, setSearch] = useState('');
  const [activeCityId, setActiveCityId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    // 화면 다시 진입 시 검색·모달 초기화
    return () => {
      setSearch('');
      setActiveCityId(null);
    };
  }, []));

  const norm = search.trim().toLowerCase();

  // 검색 결과: 도시 + 하이라이트 통합
  const cityMatches = useMemo(() => {
    if (!norm) return [];
    return Object.entries(CITY_ALIASES)
      .filter(([, info]) =>
        info.aliases.some((a) => a.toLowerCase().includes(norm)),
      )
      .map(([id, info]) => ({ cityId: id, name: info.name, flag: info.flag }))
      .slice(0, 10);
  }, [norm]);

  const highlightMatches = useMemo(() => {
    if (!norm) return [];
    return CITY_HIGHLIGHTS.filter((h) => {
      const fields = [h.name, h.nameLocal, h.area, h.description, ...h.tags].filter(Boolean);
      return fields.some((f) => f && f.toLowerCase().includes(norm));
    }).slice(0, 50);
  }, [norm]);

  const showResults = norm.length > 0;
  const hasResults = cityMatches.length > 0 || highlightMatches.length > 0;

  const openCityHighlights = (cityId: string) => {
    haptic.tap();
    setActiveCityId(cityId);
  };

  return (
    <RNSafeAreaView style={styles.container} edges={['top']}>
      {/* 검색 바 */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="도시·장소·음식 검색"
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={10}>
            <Text style={styles.clearText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* 인기 키워드 (검색 없을 때) */}
      {!showResults && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.keywordScroll}
          contentContainerStyle={styles.keywordRow}
        >
          {POPULAR_KEYWORDS.map((k) => (
            <Pressable
              key={k}
              style={styles.keyword}
              onPress={() => { haptic.select(); setSearch(k); }}
            >
              <Text style={styles.keywordText}>#{k}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {showResults ? (
          // ===== 검색 결과 =====
          <>
            {!hasResults && (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🤷</Text>
                <Text style={styles.emptyTitle}>검색 결과가 없어요</Text>
                <Text style={styles.emptyDesc}>
                  도시명·장소·태그로 검색해보세요{'\n'}
                  예: 도쿄, 미슐랭, 야경, 해변
                </Text>
              </View>
            )}

            {cityMatches.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>도시 ({cityMatches.length})</Text>
                <View style={styles.cityRow}>
                  {cityMatches.map((c) => (
                    <Pressable
                      key={c.cityId}
                      style={styles.cityChip}
                      onPress={() => openCityHighlights(c.cityId)}
                    >
                      <Text style={styles.cityChipFlag}>{c.flag}</Text>
                      <Text style={styles.cityChipName}>{c.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {highlightMatches.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>장소 ({highlightMatches.length})</Text>
                <View style={{ gap: Spacing.sm }}>
                  {highlightMatches.map((h, idx) => (
                    <HighlightRow
                      key={`${h.cityId}-${h.category}-${idx}`}
                      h={h}
                      onPress={() => openCityHighlights(h.cityId)}
                      styles={styles}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        ) : (
          // ===== 빈 상태: 지역별 도시 그리드 =====
          <>
            <Text style={styles.heroTitle}>어디로 떠나볼까요?</Text>
            <Text style={styles.heroSub}>
              46개 도시 · 460+ 인기 장소
            </Text>

            {REGIONS.map((region) => (
              <View key={region.label} style={{ marginTop: Spacing.xl }}>
                <Text style={styles.regionTitle}>{region.label}</Text>
                <View style={styles.cityGrid}>
                  {region.cityIds.map((cid) => {
                    const flag = getCityFlag(cid);
                    const name = getCityDisplayName(cid);
                    const count = getHighlightsByCity(cid).length;
                    return (
                      <Pressable
                        key={cid}
                        style={styles.cityCard}
                        onPress={() => openCityHighlights(cid)}
                      >
                        <Text style={styles.cityFlag}>{flag}</Text>
                        <Text style={styles.cityName}>{name}</Text>
                        <Text style={styles.cityCount}>{count}곳</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            <View style={{ height: Spacing.huge }} />
          </>
        )}
      </ScrollView>

      {/* 도시 하이라이트 모달 */}
      <CityHighlightsModal
        visible={!!activeCityId}
        cityId={activeCityId}
        onClose={() => setActiveCityId(null)}
        styles={styles}
        colors={colors}
      />
    </RNSafeAreaView>
  );
}

function HighlightRow({ h, onPress, styles }: {
  h: CityHighlight;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const cat = HIGHLIGHT_CATEGORIES.find((c) => c.key === h.category);
  const cityName = getCityDisplayName(h.cityId);
  const cityFlag = getCityFlag(h.cityId);
  return (
    <Pressable style={styles.hRow} onPress={onPress}>
      <Text style={styles.hCatIcon}>{cat?.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.hCity}>{cityFlag} {cityName}</Text>
        <Text style={styles.hName} numberOfLines={1}>
          {h.name}{h.nameLocal ? ` · ${h.nameLocal}` : ''}
        </Text>
        <Text style={styles.hDesc} numberOfLines={1}>{h.description}</Text>
      </View>
      <Text style={styles.hArrow}>›</Text>
    </Pressable>
  );
}

interface CityHighlightsModalProps {
  visible: boolean;
  cityId: string | null;
  onClose: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ColorPalette;
}

function CityHighlightsModal({ visible, cityId, onClose, styles, colors }: CityHighlightsModalProps) {
  const [filter, setFilter] = useState<HighlightCategory | 'all'>('all');
  const highlights = cityId ? getHighlightsByCity(cityId) : [];
  const filtered = filter === 'all' ? highlights : highlights.filter((h) => h.category === filter);

  if (!cityId) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.modalHeader}>
          <Pressable onPress={() => { haptic.tap(); onClose(); }} hitSlop={10}>
            <Text style={styles.modalClose}>✕</Text>
          </Pressable>
          <Text style={styles.modalTitle}>
            {getCityFlag(cityId)} {getCityDisplayName(cityId)}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={styles.modalChipRow}
        >
          <Pressable
            style={[styles.modalChip, filter === 'all' && styles.modalChipActive]}
            onPress={() => { haptic.select(); setFilter('all'); }}
          >
            <Text style={[styles.modalChipText, filter === 'all' && styles.modalChipTextActive]}>
              전체 {highlights.length}
            </Text>
          </Pressable>
          {HIGHLIGHT_CATEGORIES.map((c) => {
            const cnt = highlights.filter((h) => h.category === c.key).length;
            if (cnt === 0) return null;
            return (
              <Pressable
                key={c.key}
                style={[styles.modalChip, filter === c.key && styles.modalChipActive]}
                onPress={() => { haptic.select(); setFilter(c.key); }}
              >
                <Text style={[styles.modalChipText, filter === c.key && styles.modalChipTextActive]}>
                  {c.icon} {c.label} {cnt}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}>
          {filtered.map((h, idx) => {
            const cat = HIGHLIGHT_CATEGORIES.find((c) => c.key === h.category);
            return (
              <View key={`${h.cityId}-${h.category}-${idx}`} style={styles.modalCard}>
                <View style={styles.modalCardLeft}>
                  <Text style={styles.modalCardIcon}>{cat?.icon}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.modalCardTitle}>{h.name}{h.nameLocal ? ` · ${h.nameLocal}` : ''}</Text>
                  {h.area && <Text style={styles.modalCardArea}>📍 {h.area}</Text>}
                  <Text style={styles.modalCardDesc}>{h.description}</Text>
                  {h.tags.length > 0 && (
                    <View style={styles.modalTagRow}>
                      {h.tags.map((t) => (
                        <Text key={t} style={styles.modalTag}>#{t}</Text>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          <Pressable
            style={styles.modalCta}
            onPress={() => {
              haptic.medium();
              onClose();
              router.push('/trips/new');
            }}
          >
            <Text style={styles.modalCtaText}>+ 여기로 여행 만들기</Text>
          </Pressable>
          <View style={{ height: Spacing.huge }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.md,
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
      paddingVertical: 0,
    },
    clearText: { fontSize: 14, color: c.textTertiary, paddingHorizontal: Spacing.xs },
    keywordScroll: { flexGrow: 0, flexShrink: 0 },
    keywordRow: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      gap: Spacing.sm,
      alignItems: 'center',
    },
    keyword: {
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.md,
      borderRadius: 999,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignSelf: 'center',
    },
    keywordText: {
      fontSize: Typography.labelSmall,
      color: c.textSecondary,
      fontWeight: '600',
    },
    scroll: { padding: Spacing.lg },
    heroTitle: {
      fontSize: Typography.displaySmall,
      fontWeight: '800',
      color: c.textPrimary,
    },
    heroSub: {
      fontSize: Typography.bodyMedium,
      color: c.textSecondary,
      marginTop: 4,
    },
    regionTitle: {
      fontSize: Typography.bodyLarge,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: Spacing.md,
    },
    cityGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    cityCard: {
      width: '30%',
      aspectRatio: 1,
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      ...Shadows.soft,
    },
    cityFlag: { fontSize: 32 },
    cityName: {
      fontSize: Typography.bodyMedium,
      color: c.textPrimary,
      fontWeight: '700',
    },
    cityCount: {
      fontSize: 11,
      color: c.textTertiary,
    },
    sectionTitle: {
      fontSize: Typography.bodyLarge,
      fontWeight: '700',
      color: c.textPrimary,
      marginTop: Spacing.lg,
      marginBottom: Spacing.md,
    },
    cityRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    cityChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: 999,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    cityChipFlag: { fontSize: 18 },
    cityChipName: {
      fontSize: Typography.bodyMedium,
      color: c.textPrimary,
      fontWeight: '700',
    },
    hRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.md,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    hCatIcon: { fontSize: 24 },
    hCity: { fontSize: 11, color: c.accent, fontWeight: '700', marginBottom: 2 },
    hName: { fontSize: Typography.bodyMedium, color: c.textPrimary, fontWeight: '700' },
    hDesc: { fontSize: Typography.labelSmall, color: c.textSecondary, marginTop: 2 },
    hArrow: { fontSize: 20, color: c.textTertiary },
    empty: {
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.xxl,
    },
    emptyIcon: { fontSize: 48 },
    emptyTitle: { fontSize: Typography.titleMedium, fontWeight: '700', color: c.textPrimary },
    emptyDesc: {
      fontSize: Typography.bodySmall,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: Typography.bodySmall * 1.6,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    modalClose: { fontSize: 20, color: c.textPrimary, width: 24 },
    modalTitle: {
      fontSize: Typography.bodyLarge,
      fontWeight: '700',
      color: c.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    modalChipRow: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      gap: Spacing.sm,
      alignItems: 'center',
    },
    modalChip: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: 999,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignSelf: 'center',
    },
    modalChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    modalChipText: { fontSize: Typography.labelSmall, color: c.textSecondary, fontWeight: '600' },
    modalChipTextActive: { color: c.textOnPrimary },
    modalCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.md,
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      ...Shadows.soft,
    },
    modalCardLeft: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCardIcon: { fontSize: 22 },
    modalCardTitle: { fontSize: Typography.bodyMedium, color: c.textPrimary, fontWeight: '700' },
    modalCardArea: { fontSize: Typography.labelSmall, color: c.textSecondary },
    modalCardDesc: { fontSize: Typography.labelSmall, color: c.textSecondary, lineHeight: Typography.labelSmall * 1.5 },
    modalTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
    modalTag: { fontSize: 10, color: c.accent, fontWeight: '600' },
    modalCta: {
      marginTop: Spacing.lg,
      paddingVertical: Spacing.lg,
      borderRadius: 14,
      backgroundColor: c.primary,
      alignItems: 'center',
    },
    modalCtaText: {
      color: c.textOnPrimary,
      fontWeight: '700',
      fontSize: Typography.bodyMedium,
    },
  });
}
