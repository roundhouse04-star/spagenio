import { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { getDB } from '@/db/database';
import {
  DESTINATIONS, TRAVEL_TIPS, CATEGORIES, TIP_CATEGORIES,
  SEASON_INFO, getCurrentSeason,
  DestinationCity, Category,
} from '@/data/destinations';

export default function DiscoverScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [userCountries, setUserCountries] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [tipCategoryFilter, setTipCategoryFilter] = useState<string | null>(null);

  const currentSeason = getCurrentSeason();
  const currentMonth = new Date().getMonth() + 1;

  // 사용자가 가본 국가 로드
  const loadUserTrips = useCallback(async () => {
    try {
      const db = await getDB();
      const rows = await db.getAllAsync<any>(
        `SELECT DISTINCT country, country_code FROM trips WHERE country IS NOT NULL OR country_code IS NOT NULL`
      );
      const set = new Set<string>();
      rows.forEach(r => {
        if (r.country) set.add(r.country);
        if (r.country_code) set.add(r.country_code);
      });
      setUserCountries(set);
    } catch {
      // 무시
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUserTrips();
    }, [loadUserTrips])
  );

  // 계절 추천 도시
  const seasonRecommendations = useMemo(() => {
    return DESTINATIONS.filter(d => d.bestMonths.includes(currentMonth));
  }, [currentMonth]);

  // 카테고리 필터
  const filteredCities = useMemo(() => {
    if (!selectedCategory) return DESTINATIONS;
    return DESTINATIONS.filter(d => d.categories.includes(selectedCategory));
  }, [selectedCategory]);

  // 개인화 추천 (가본 곳 기반)
  const personalizedSuggestions = useMemo(() => {
    if (userCountries.size === 0) return [];
    // 사용자가 가본 국가의 인접 국가 또는 비슷한 카테고리
    const visited = DESTINATIONS.filter(d =>
      userCountries.has(d.country) || userCountries.has(d.countryCode)
    );
    if (visited.length === 0) return [];

    // 가본 도시가 좋아하는 카테고리 추출
    const prefCategories = new Set<Category>();
    visited.forEach(v => v.categories.forEach(c => prefCategories.add(c)));

    // 안 가본 도시 중 비슷한 카테고리
    return DESTINATIONS.filter(d => {
      if (userCountries.has(d.country) || userCountries.has(d.countryCode)) return false;
      return d.categories.some(c => prefCategories.has(c));
    }).slice(0, 5);
  }, [userCountries]);

  // 꿀팁 필터
  const filteredTips = useMemo(() => {
    if (!tipCategoryFilter) return TRAVEL_TIPS;
    return TRAVEL_TIPS.filter(t => t.category === tipCategoryFilter);
  }, [tipCategoryFilter]);

  const openCity = (cityId: string) => {
    haptic.tap();
    router.push(`/explore/${cityId}`);
  };

  const openTip = (tipId: string) => {
    haptic.tap();
    router.push(`/explore/tip/${tipId}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>탐색</Text>
        <Text style={styles.subtitle}>어디로 떠나볼까요?</Text>

        {/* 계절 추천 */}
        {seasonRecommendations.length > 0 && (
          <>
            <View style={styles.seasonBanner}>
              <Text style={styles.seasonIcon}>{SEASON_INFO[currentSeason].icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.seasonLabel}>지금 이 계절에</Text>
                <Text style={styles.seasonTitle}>
                  {currentMonth}월의 추천 여행지
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {seasonRecommendations.map(d => (
                <SeasonCard key={d.id} city={d} onPress={() => openCity(d.id)} styles={styles} />
              ))}
            </ScrollView>
          </>
        )}

        {/* 개인화 추천 */}
        {personalizedSuggestions.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>✨ 당신을 위한 추천</Text>
            <Text style={styles.sectionSub}>
              {userCountries.size}개 국가를 방문하셨네요. 비슷한 취향의 여행지예요
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {personalizedSuggestions.map(d => (
                <PersonalCard key={d.id} city={d} onPress={() => openCity(d.id)} styles={styles} />
              ))}
            </ScrollView>
          </>
        )}

        {/* 카테고리 필터 */}
        <Text style={styles.sectionTitle}>카테고리별</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <CategoryChip
            label="🌍 전체"
            active={selectedCategory === null}
            onPress={() => { haptic.select(); setSelectedCategory(null); }}
            styles={styles}
          />
          {CATEGORIES.map(c => (
            <CategoryChip
              key={c.key}
              label={`${c.icon} ${c.label}`}
              active={selectedCategory === c.key}
              onPress={() => { haptic.select(); setSelectedCategory(c.key); }}
            styles={styles}
          />
          ))}
        </ScrollView>

        {/* 도시 그리드 */}
        <View style={styles.grid}>
          {filteredCities.map(d => {
            const visited = userCountries.has(d.country) || userCountries.has(d.countryCode);
            return (
              <Pressable
                key={d.id}
                style={styles.cityCard}
                onPress={() => openCity(d.id)}
              >
                <Text style={styles.cityIcon}>{d.icon}</Text>
                <Text style={styles.cityFlag}>{d.flag}</Text>
                <Text style={styles.cityName}>{d.name}</Text>
                <Text style={styles.cityCountry}>{d.country}</Text>
                {visited && (
                  <View style={styles.visitedBadge}>
                    <Text style={styles.visitedText}>✓ 방문</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {filteredCities.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>해당 카테고리의 도시가 없어요</Text>
          </View>
        )}

        {/* 꿀팁 섹션 */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.huge }]}>여행 꿀팁</Text>
        <Text style={styles.sectionSub}>여행 전 꼭 알아두세요</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <CategoryChip
            label="📚 전체"
            active={tipCategoryFilter === null}
            onPress={() => { haptic.select(); setTipCategoryFilter(null); }}
            styles={styles}
          />
          {TIP_CATEGORIES.map(c => (
            <CategoryChip
              key={c.key}
              label={`${c.icon} ${c.label}`}
              active={tipCategoryFilter === c.key}
              onPress={() => { haptic.select(); setTipCategoryFilter(c.key); }}
            styles={styles}
          />
          ))}
        </ScrollView>

        <View style={{ gap: Spacing.sm }}>
          {filteredTips.map(tip => (
            <Pressable
              key={tip.id}
              style={styles.tipCard}
              onPress={() => openTip(tip.id)}
            >
              <Text style={styles.tipIcon}>{tip.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipSummary}>{tip.summary}</Text>
              </View>
              <Text style={styles.tipArrow}>›</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: Spacing.huge }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SeasonCard({ city, onPress, styles }: {
  city: DestinationCity;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable style={styles.seasonCard} onPress={onPress}>
      <Text style={styles.seasonCardIcon}>{city.icon}</Text>
      <Text style={styles.seasonCardFlag}>{city.flag}</Text>
      <Text style={styles.seasonCardName}>{city.name}</Text>
      <Text style={styles.seasonCardCountry}>{city.country}</Text>
      <View style={styles.seasonCardBadge}>
        <Text style={styles.seasonCardBadgeText}>지금이 최적!</Text>
      </View>
    </Pressable>
  );
}

function PersonalCard({ city, onPress, styles }: {
  city: DestinationCity;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable style={styles.personalCard} onPress={onPress}>
      <Text style={styles.personalIcon}>{city.icon}</Text>
      <Text style={styles.personalFlag}>{city.flag}</Text>
      <Text style={styles.personalName}>{city.name}</Text>
      <Text style={styles.personalCategory}>
        {city.categories.slice(0, 2).map(c => {
          const cat = CATEGORIES.find(cc => cc.key === c);
          return cat ? `${cat.icon} ${cat.label}` : '';
        }).join(' · ')}
      </Text>
    </Pressable>
  );
}

function CategoryChip({
  label, active, onPress, styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scroll: { padding: Spacing.xl, paddingBottom: Spacing.huge },

  title: {
    fontSize: Typography.displaySmall,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.bodyMedium,
    color: c.textTertiary,
    marginBottom: Spacing.xl,
  },

  seasonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: c.primary,
    padding: Spacing.lg,
    borderRadius: 16,
    marginBottom: Spacing.md,
  },
  seasonIcon: { fontSize: 36 },
  seasonLabel: {
    fontSize: Typography.labelSmall,
    color: c.accent,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 2,
  },
  seasonTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '700',
    color: c.textOnPrimary,
  },

  horizontalList: { gap: Spacing.sm, paddingVertical: Spacing.sm },

  seasonCard: {
    width: 140,
    backgroundColor: c.surface,
    padding: Spacing.md,
    borderRadius: 14,
    alignItems: 'center',
    ...Shadows.sm,
  },
  seasonCardIcon: { fontSize: 40, marginBottom: Spacing.xs },
  seasonCardFlag: { fontSize: 16, marginBottom: Spacing.xs },
  seasonCardName: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: c.textPrimary,
  },
  seasonCardCountry: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    marginBottom: Spacing.sm,
  },
  seasonCardBadge: {
    backgroundColor: c.accent,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  seasonCardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: c.textOnAccent,
  },

  personalCard: {
    width: 130,
    backgroundColor: c.surfaceAlt,
    padding: Spacing.md,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.accent,
  },
  personalIcon: { fontSize: 32, marginBottom: Spacing.xs },
  personalFlag: { fontSize: 14, marginBottom: 2 },
  personalName: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: c.textPrimary,
  },
  personalCategory: {
    fontSize: 10,
    color: c.textTertiary,
    marginTop: 2,
    textAlign: 'center',
  },

  sectionTitle: {
    fontSize: Typography.titleSmall,
    fontWeight: '700',
    color: c.textPrimary,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xs,
  },
  sectionSub: {
    fontSize: Typography.labelMedium,
    color: c.textTertiary,
    marginBottom: Spacing.md,
  },

  chipRow: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  chipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  chipText: {
    fontSize: Typography.labelMedium,
    color: c.textSecondary,
  },
  chipTextActive: {
    color: c.textOnPrimary,
    fontWeight: '600',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  cityCard: {
    flexBasis: '47%',
    backgroundColor: c.surface,
    padding: Spacing.md,
    borderRadius: 14,
    alignItems: 'center',
    ...Shadows.sm,
  },
  cityIcon: { fontSize: 40, marginBottom: Spacing.xs },
  cityFlag: { fontSize: 16, marginBottom: Spacing.xs },
  cityName: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: c.textPrimary,
  },
  cityCountry: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    marginTop: 2,
  },
  visitedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: c.success,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 6,
  },
  visitedText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },

  emptyBox: {
    padding: Spacing.huge,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: Typography.bodyMedium,
    color: c.textTertiary,
  },

  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: c.surface,
    padding: Spacing.md,
    borderRadius: 12,
    ...Shadows.sm,
  },
  tipIcon: { fontSize: 28 },
  tipTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: c.textPrimary,
  },
  tipSummary: {
    fontSize: Typography.labelMedium,
    color: c.textTertiary,
    marginTop: 2,
  },
  tipArrow: {
    fontSize: 20,
    color: c.textTertiary,
  },
});
}

