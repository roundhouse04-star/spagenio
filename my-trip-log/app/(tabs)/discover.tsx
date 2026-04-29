/**
 * 탐색 탭 — 풍부한 시각 디자인 v2
 *
 * 구성:
 * 1. 검색 바 + 인기 키워드
 * 2. ✨ Today's Picks — 한국인 인기 톱 3 도시 (히어로 카드)
 * 3. 🔥 지금 뜨는 장소 — trending 태그 하이라이트 12개 (가로 스크롤)
 * 4. 🎯 카테고리로 둘러보기 — 6 카테고리 큰 버튼 → 전체 도시 통합 모달
 * 5. 🌍 지역별 도시 그리드 (7 지역)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, SafeAreaView,
} from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { Typography, Spacing, Shadows, Fonts } from '@/theme/theme';
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
import { getCityImageUrl } from '@/utils/cityImages';
import { openMapsBySearch } from '@/utils/maps';

/** 하이라이트 → 구글지도 검색어 만들기 */
function buildHighlightMapQuery(h: CityHighlight): string {
  return [h.nameLocal ?? h.name, h.area, getCityDisplayName(h.cityId)]
    .filter(Boolean)
    .join(' ');
}

/** 도시 → 도시 자체를 지도에서 보기 */
function openCityOnMap(cityId: string) {
  haptic.tap();
  const name = getCityDisplayName(cityId);
  // 영문도 함께 검색하면 정확도 향상
  const en = (CITY_ALIASES[cityId]?.aliases ?? []).find((a) => /^[a-z\s]+$/i.test(a));
  openMapsBySearch([name, en].filter(Boolean).join(' '));
}

/** 하이라이트 → 지도에서 검색 */
function openHighlightOnMap(h: CityHighlight) {
  haptic.tap();
  openMapsBySearch(buildHighlightMapQuery(h));
}

// 도시 이미지 URL React 훅 — 컴포넌트에서 useState 한 번에 처리
function useCityImage(cityId: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!cityId) { setUrl(null); return; }
    let cancelled = false;
    getCityImageUrl(cityId).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => { cancelled = true; };
  }, [cityId]);
  return url;
}

// ─── 데이터 (정적) ──────────────────────────────

interface CityRegion { label: string; cityIds: string[]; }

const REGIONS: CityRegion[] = [
  { label: '🇰🇷 한국', cityIds: ['seoul'] },
  { label: '🇯🇵 일본', cityIds: ['tokyo', 'osaka', 'fukuoka', 'okinawa', 'sapporo', 'kyoto'] },
  { label: '🇨🇳·🇹🇼·🇭🇰 중화권', cityIds: ['taipei', 'hongkong', 'shanghai', 'qingdao'] },
  { label: '🌴 동남아', cityIds: ['bangkok', 'phuket', 'chiangmai', 'danang', 'nhatrang', 'hochiminh', 'cebu', 'boracay', 'manila', 'bali', 'singapore', 'kualalumpur', 'kotakinabalu'] },
  { label: '🇪🇺 유럽', cityIds: ['paris', 'london', 'rome', 'barcelona', 'madrid', 'milan', 'berlin', 'vienna', 'prague', 'amsterdam', 'istanbul', 'antalya'] },
  { label: '🌎 미주·태평양', cityIds: ['newyork', 'losangeles', 'lasvegas', 'cancun', 'honolulu', 'guam', 'sydney'] },
  { label: '🌍 중동·아프리카', cityIds: ['dubai', 'cairo', 'mecca'] },
];

// 한국인 인기 톱 3 (히어로) — 도쿄 / 다낭 / 파리
const FEATURED_CITY_IDS = ['tokyo', 'danang', 'paris'];

const FEATURED_TAGLINES: Record<string, string> = {
  tokyo: '미식·트렌드·24시간 매력',
  danang: '신혼·가족 휴양 1순위',
  paris: '미술·미식·로맨스',
  bangkok: '음식·쇼핑·야시장 천국',
  bali: '서퍼·노마드·휴양 성지',
  newyork: '문화·재즈·끝없는 도시',
};

const POPULAR_KEYWORDS = ['미슐랭', '야경', '해변', '시장', '박물관', '카페', '신상', '한국인'];

// ─── 본 화면 ──────────────────────────────────

export default function DiscoverScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [search, setSearch] = useState('');
  const [activeCityId, setActiveCityId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<HighlightCategory | null>(null);

  useFocusEffect(useCallback(() => {
    return () => {
      setSearch('');
      setActiveCityId(null);
      setActiveCategory(null);
    };
  }, []));

  const norm = search.trim().toLowerCase();

  // 검색 결과 — 도시 + 하이라이트 통합
  const cityMatches = useMemo(() => {
    if (!norm) return [];
    return Object.entries(CITY_ALIASES)
      .filter(([, info]) => info.aliases.some((a) => a.toLowerCase().includes(norm)))
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

  // 트렌딩 하이라이트 (trending 태그 — 12개로 제한, 카테고리 다양성 위해 시드 셔플)
  const trendingHighlights = useMemo(() => {
    return CITY_HIGHLIGHTS.filter((h) => h.tags.includes('trending')).slice(0, 12);
  }, []);

  const showResults = norm.length > 0;
  const hasResults = cityMatches.length > 0 || highlightMatches.length > 0;

  return (
    <RNSafeAreaView style={styles.container} edges={['top']}>
      {/* ── 헤더: 타이틀 + 검색 ── */}
      <View style={styles.headerWrap}>
        <Text style={styles.brandEyebrow}>DISCOVER</Text>
        <Text style={styles.brandTitle}>탐색</Text>
      </View>

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

      {/* 인기 키워드 */}
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

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {showResults ? (
          // ============ 검색 결과 ============
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
                <SectionHeader label="도시" count={cityMatches.length} styles={styles} />
                <View style={styles.cityRow}>
                  {cityMatches.map((c) => (
                    <Pressable
                      key={c.cityId}
                      style={styles.cityChip}
                      onPress={() => { haptic.tap(); setActiveCityId(c.cityId); }}
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
                <SectionHeader label="장소" count={highlightMatches.length} styles={styles} />
                <View style={{ gap: Spacing.sm }}>
                  {highlightMatches.map((h, idx) => (
                    <HighlightRow
                      key={`${h.cityId}-${h.category}-${idx}`}
                      h={h}
                      onPress={() => openHighlightOnMap(h)}
                      styles={styles}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        ) : (
          // ============ 빈 상태 (메인 디스커버) ============
          <>
            {/* ── ✨ Today's Picks ── */}
            <SectionTitle eyebrow="TODAY'S PICKS" title="한국인 인기 도시" styles={styles} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.heroScroll}
              decelerationRate="fast"
            >
              {FEATURED_CITY_IDS.map((cid, idx) => (
                <FeaturedCard
                  key={cid}
                  cityId={cid}
                  index={idx}
                  onPress={() => { haptic.tap(); setActiveCityId(cid); }}
                  styles={styles}
                />
              ))}
            </ScrollView>

            {/* ── 🔥 Trending ── */}
            <SectionTitle eyebrow="TRENDING NOW" title="🔥 지금 뜨는 장소" styles={styles} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trendScroll}
            >
              {trendingHighlights.map((h, idx) => (
                <TrendingCard
                  key={`${h.cityId}-${h.category}-${idx}`}
                  h={h}
                  onPress={() => openHighlightOnMap(h)}
                  styles={styles}
                />
              ))}
            </ScrollView>

            {/* ── 🎯 카테고리로 둘러보기 ── */}
            <SectionTitle eyebrow="BROWSE" title="🎯 카테고리로 보기" styles={styles} />
            <View style={styles.catGrid}>
              {HIGHLIGHT_CATEGORIES.map((c) => {
                const count = CITY_HIGHLIGHTS.filter((h) => h.category === c.key).length;
                return (
                  <Pressable
                    key={c.key}
                    style={[styles.catBtn, { backgroundColor: catColor(c.key, colors) }]}
                    onPress={() => { haptic.tap(); setActiveCategory(c.key); }}
                  >
                    <Text style={styles.catBtnIcon}>{c.icon}</Text>
                    <Text style={styles.catBtnLabel}>{c.label}</Text>
                    <Text style={styles.catBtnCount}>{count}곳</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* ── 🌍 지역별 ── */}
            <SectionTitle eyebrow="REGIONS" title="🌍 지역별 도시" styles={styles} />
            {REGIONS.map((region) => (
              <View key={region.label} style={{ marginBottom: Spacing.xl }}>
                <Text style={styles.regionTitle}>
                  {region.label}{' '}
                  <Text style={styles.regionCount}>({region.cityIds.length})</Text>
                </Text>
                <View style={styles.cityGrid}>
                  {region.cityIds.map((cid) => (
                    <CityCard
                      key={cid}
                      cityId={cid}
                      onPress={() => { haptic.tap(); setActiveCityId(cid); }}
                      styles={styles}
                    />
                  ))}
                </View>
              </View>
            ))}

            <View style={{ height: Spacing.huge }} />
          </>
        )}
      </ScrollView>

      {/* ── 모달들 ── */}
      <CityHighlightsModal
        visible={!!activeCityId}
        cityId={activeCityId}
        onClose={() => setActiveCityId(null)}
        styles={styles}
        colors={colors}
      />
      <CategoryBrowseModal
        visible={!!activeCategory}
        category={activeCategory}
        onClose={() => setActiveCategory(null)}
        onPickCity={(cityId) => { setActiveCategory(null); setActiveCityId(cityId); }}
        styles={styles}
        colors={colors}
      />
    </RNSafeAreaView>
  );
}

// ─── 색상 유틸 ────────────────────────────────

function catColor(key: HighlightCategory, c: ColorPalette): string {
  // 카테고리별 살짝 톤 다른 surfaceAlt
  const map: Record<HighlightCategory, string> = {
    attraction: c.primary + '15',
    food: '#F4A47615',           // 주황 톤
    museum: '#9B7FBF15',         // 보라 톤
    shopping: '#E68FB315',       // 핑크 톤
    experience: '#7FB39B15',     // 청록 톤
    nature: '#94B8631F',         // 연두 톤
  };
  return map[key];
}

// ─── 작은 컴포넌트들 ──────────────────────────

function SectionTitle({ eyebrow, title, styles }: {
  eyebrow: string;
  title: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionMainTitle}>{title}</Text>
    </View>
  );
}

function SectionHeader({ label, count, styles }: {
  label: string;
  count: number;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Text style={styles.searchSectionTitle}>{label} <Text style={styles.searchSectionCount}>({count})</Text></Text>
  );
}

function FeaturedCard({ cityId, index, onPress, styles }: {
  cityId: string;
  index: number;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const flag = getCityFlag(cityId);
  const name = getCityDisplayName(cityId);
  const all = getHighlightsByCity(cityId);
  const previewNames = all.slice(0, 2).map((h) => h.name).join(' · ');
  const tagline = FEATURED_TAGLINES[cityId] ?? '';
  const imageUrl = useCityImage(cityId);

  return (
    <Pressable style={styles.heroCard} onPress={onPress}>
      {/* 배경 이미지 */}
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={300}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.heroFallback]} />
      )}
      {/* 어두운 그라디언트 (텍스트 가독성) */}
      <LinearGradient
        colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      {/* 콘텐츠 */}
      <View style={styles.heroContent}>
        <View style={styles.heroBadgeRow}>
          <Text style={styles.heroFlag}>{flag}</Text>
          <View style={styles.heroRankBadge}>
            <Text style={styles.heroRankText}>#{index + 1}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={styles.heroName}>{name}</Text>
        <Text style={styles.heroNameEn}>{getCityNameEn(cityId)}</Text>
        {tagline ? <Text style={styles.heroTagline}>{tagline}</Text> : null}
        <View style={styles.heroFooter}>
          <Text style={styles.heroCount}>📍 {all.length}곳</Text>
          <Text style={styles.heroPreview} numberOfLines={1}>{previewNames}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function getCityNameEn(cityId: string): string {
  // CITY_ALIASES 의 alias 중 영문(Latin) 표기 우선 추출
  const info = CITY_ALIASES[cityId];
  if (!info) return '';
  const en = info.aliases.find((a) => /^[a-z\s]+$/i.test(a) && a.length > 2);
  return en
    ? en.split(/\s+/).map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ')
    : '';
}

function TrendingCard({ h, onPress, styles }: {
  h: CityHighlight;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const cat = HIGHLIGHT_CATEGORIES.find((c) => c.key === h.category);
  const cityName = getCityDisplayName(h.cityId);
  const cityFlag = getCityFlag(h.cityId);
  const imageUrl = useCityImage(h.cityId);

  return (
    <Pressable style={styles.trendCard} onPress={onPress}>
      {/* 상단 이미지 영역 */}
      <View style={styles.trendImageWrap}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.trendFallback]} />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.45)']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.trendCatBadge}>
          <Text style={styles.trendCatIcon}>{cat?.icon}</Text>
        </View>
      </View>
      {/* 텍스트 영역 */}
      <View style={styles.trendBody}>
        <Text style={styles.trendCity}>{cityFlag} {cityName}</Text>
        <Text style={styles.trendName} numberOfLines={2}>{h.name}</Text>
        <Text style={styles.trendDesc} numberOfLines={2}>{h.description}</Text>
      </View>
    </Pressable>
  );
}

function CityCard({ cityId, onPress, styles }: {
  cityId: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const flag = getCityFlag(cityId);
  const name = getCityDisplayName(cityId);
  const all = getHighlightsByCity(cityId);
  const sample = all[0]?.name;
  const imageUrl = useCityImage(cityId);

  return (
    <Pressable style={styles.cityCard} onPress={onPress}>
      {/* 배경 이미지 */}
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.cityCardFallback]} />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)']}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.cityCardContent}>
        <Text style={styles.cityCardFlag}>{flag}</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.cityCardName}>{name}</Text>
        <Text style={styles.cityCardCount}>{all.length}곳</Text>
        {sample && <Text style={styles.cityCardSample} numberOfLines={1}>{sample}</Text>}
      </View>
    </Pressable>
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

// ─── 모달들 ──────────────────────────────────

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
          <Pressable onPress={() => openCityOnMap(cityId)} hitSlop={10} style={styles.modalMapBtn}>
            <Text style={styles.modalMapBtnText}>🗺</Text>
          </Pressable>
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
              <Pressable
                key={`${h.cityId}-${h.category}-${idx}`}
                style={styles.modalCard}
                onPress={() => openHighlightOnMap(h)}
              >
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
                <Text style={styles.modalCardMap}>🗺</Text>
              </Pressable>
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

interface CategoryBrowseModalProps {
  visible: boolean;
  category: HighlightCategory | null;
  onClose: () => void;
  onPickCity: (cityId: string) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ColorPalette;
}

function CategoryBrowseModal({ visible, category, onClose, onPickCity, styles, colors }: CategoryBrowseModalProps) {
  const list = useMemo(() => {
    if (!category) return [];
    return CITY_HIGHLIGHTS.filter((h) => h.category === category).slice(0, 100);
  }, [category]);

  if (!category) return null;
  const catInfo = HIGHLIGHT_CATEGORIES.find((c) => c.key === category);

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
            {catInfo?.icon} {catInfo?.label} · 전체 도시
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.sm }}>
          <Text style={styles.modalSub}>{list.length}개 장소 (최대 100)</Text>
          {list.map((h, idx) => (
            <Pressable
              key={`${h.cityId}-${h.category}-${idx}`}
              style={styles.modalRow}
              onPress={() => openHighlightOnMap(h)}
            >
              {/* 좌측 도시 뱃지 — 탭 시 도시 모달로 (지도 X) */}
              <Pressable
                style={styles.modalRowLeft}
                onPress={(e) => { e.stopPropagation?.(); haptic.tap(); onPickCity(h.cityId); }}
                hitSlop={6}
              >
                <Text style={styles.modalRowFlag}>{getCityFlag(h.cityId)}</Text>
                <Text style={styles.modalRowCity}>{getCityDisplayName(h.cityId)}</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalRowName} numberOfLines={1}>{h.name}</Text>
                <Text style={styles.modalRowDesc} numberOfLines={1}>{h.description}</Text>
              </View>
              <Text style={styles.modalRowArrow}>🗺</Text>
            </Pressable>
          ))}
          <View style={{ height: Spacing.huge }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── 스타일 ───────────────────────────────────

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },

    // 헤더
    headerWrap: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    brandEyebrow: {
      fontFamily: Fonts.bodyEnSemiBold,
      fontSize: Typography.labelSmall,
      color: c.accent,
      letterSpacing: Typography.letterSpacingExtraWide,
    },
    brandTitle: {
      fontFamily: Fonts.bodyKrBold,
      fontSize: Typography.displayMedium,
      color: c.textPrimary,
      marginTop: 2,
    },

    // 검색
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.sm,
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

    scroll: { paddingTop: Spacing.lg, paddingBottom: 0 },

    // 섹션 타이틀
    sectionTitleWrap: {
      paddingHorizontal: Spacing.lg,
      marginTop: Spacing.xl,
      marginBottom: Spacing.md,
    },
    sectionEyebrow: {
      fontFamily: Fonts.bodyEnSemiBold,
      fontSize: 11,
      color: c.accent,
      letterSpacing: 2,
      marginBottom: 4,
    },
    sectionMainTitle: {
      fontFamily: Fonts.bodyKrBold,
      fontSize: Typography.titleMedium,
      color: c.textPrimary,
    },

    // 검색 결과 헤더
    searchSectionTitle: {
      fontSize: Typography.bodyLarge,
      fontWeight: '700',
      color: c.textPrimary,
      paddingHorizontal: Spacing.lg,
      marginTop: Spacing.lg,
      marginBottom: Spacing.md,
    },
    searchSectionCount: {
      fontSize: Typography.bodyMedium,
      color: c.textTertiary,
      fontWeight: '400',
    },

    // ✨ Hero featured cards
    heroScroll: {
      paddingLeft: Spacing.lg,
      paddingRight: Spacing.md,
      gap: Spacing.md,
    },
    heroCard: {
      width: 260,
      height: 320,
      backgroundColor: c.surfaceAlt,
      borderRadius: 18,
      overflow: 'hidden',
      ...Shadows.medium,
    },
    heroFallback: { backgroundColor: c.primary },
    heroContent: {
      flex: 1,
      padding: Spacing.lg,
      justifyContent: 'space-between',
    },
    heroBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroFlag: { fontSize: 36 },
    heroRankBadge: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.9)',
    },
    heroRankText: {
      fontFamily: Fonts.bodyEnBold,
      fontSize: 13,
      color: c.textPrimary,
      letterSpacing: 0.5,
    },
    heroName: {
      fontFamily: Fonts.bodyKrBold,
      fontSize: Typography.displaySmall,
      color: '#FFFFFF',
      lineHeight: Typography.displaySmall * 1.1,
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowRadius: 4,
    },
    heroNameEn: {
      fontFamily: Fonts.bodyEnMedium,
      fontSize: Typography.labelSmall,
      color: 'rgba(255,255,255,0.85)',
      letterSpacing: 1.5,
      marginTop: 2,
    },
    heroTagline: {
      fontSize: Typography.bodySmall,
      color: 'rgba(255,255,255,0.95)',
      fontStyle: 'italic',
      marginTop: Spacing.xs,
    },
    heroFooter: {
      marginTop: Spacing.sm,
      gap: 2,
    },
    heroCount: {
      fontSize: Typography.labelSmall,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    heroPreview: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.75)',
    },

    // 🔥 Trending cards
    trendScroll: {
      paddingLeft: Spacing.lg,
      paddingRight: Spacing.md,
      gap: Spacing.md,
    },
    trendCard: {
      width: 180,
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
      ...Shadows.soft,
    },
    trendImageWrap: {
      width: '100%',
      height: 110,
      position: 'relative',
    },
    trendFallback: { backgroundColor: c.primary },
    trendCatBadge: {
      position: 'absolute',
      bottom: Spacing.xs,
      left: Spacing.xs,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.95)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    trendCatIcon: { fontSize: 18 },
    trendBody: {
      padding: Spacing.md,
      gap: 3,
    },
    trendCity: {
      fontSize: 11,
      color: c.accent,
      fontWeight: '700',
    },
    trendName: {
      fontSize: Typography.bodyMedium,
      fontWeight: '700',
      color: c.textPrimary,
      lineHeight: Typography.bodyMedium * 1.2,
    },
    trendDesc: {
      fontSize: 11,
      color: c.textSecondary,
      lineHeight: 14,
    },

    // 🎯 카테고리 그리드
    catGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
    },
    catBtn: {
      width: '31.5%',
      aspectRatio: 1,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    catBtnIcon: { fontSize: 32 },
    catBtnLabel: {
      fontFamily: Fonts.bodyKrMedium,
      fontSize: Typography.bodyMedium,
      color: c.textPrimary,
      fontWeight: '700',
    },
    catBtnCount: {
      fontSize: 11,
      color: c.textTertiary,
    },

    // 지역
    regionTitle: {
      fontFamily: Fonts.bodyKrBold,
      fontSize: Typography.bodyLarge,
      color: c.textPrimary,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    regionCount: {
      fontSize: Typography.labelSmall,
      color: c.textTertiary,
      fontWeight: '400',
    },
    cityGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
    },
    cityCard: {
      width: '31%',
      aspectRatio: 0.95,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: c.surfaceAlt,
      ...Shadows.soft,
    },
    cityCardFallback: { backgroundColor: c.primary },
    cityCardContent: {
      flex: 1,
      padding: Spacing.sm,
      justifyContent: 'flex-end',
    },
    cityCardFlag: {
      fontSize: 22,
      position: 'absolute',
      top: Spacing.sm,
      left: Spacing.sm,
    },
    cityCardName: {
      fontFamily: Fonts.bodyKrBold,
      fontSize: Typography.bodyMedium,
      color: '#FFFFFF',
      fontWeight: '700',
      textShadowColor: 'rgba(0,0,0,0.6)',
      textShadowRadius: 3,
    },
    cityCardCount: {
      fontSize: 10,
      color: 'rgba(255,255,255,0.95)',
      fontWeight: '700',
    },
    cityCardSample: {
      fontSize: 10,
      color: 'rgba(255,255,255,0.8)',
    },

    // 검색 결과
    cityRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
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
      marginHorizontal: Spacing.lg,
    },
    hCatIcon: { fontSize: 24 },
    hCity: { fontSize: 11, color: c.accent, fontWeight: '700', marginBottom: 2 },
    hName: { fontSize: Typography.bodyMedium, color: c.textPrimary, fontWeight: '700' },
    hDesc: { fontSize: Typography.labelSmall, color: c.textSecondary, marginTop: 2 },
    hArrow: { fontSize: 20, color: c.textTertiary },

    // empty
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

    // 모달 공통
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
    modalMapBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalMapBtnText: { fontSize: 16 },
    modalCardMap: {
      fontSize: 18,
      color: c.textTertiary,
      paddingHorizontal: Spacing.xs,
    },
    modalTitle: {
      fontSize: Typography.bodyLarge,
      fontWeight: '700',
      color: c.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    modalSub: {
      fontSize: Typography.labelSmall,
      color: c.textTertiary,
      marginBottom: Spacing.sm,
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

    // 카테고리 브라우즈 모달 — 행 스타일
    modalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    modalRowLeft: {
      width: 60,
      alignItems: 'center',
    },
    modalRowFlag: { fontSize: 22 },
    modalRowCity: { fontSize: 10, color: c.textTertiary, fontWeight: '600', marginTop: 2 },
    modalRowName: { fontSize: Typography.bodyMedium, color: c.textPrimary, fontWeight: '700' },
    modalRowDesc: { fontSize: Typography.labelSmall, color: c.textSecondary, marginTop: 2 },
    modalRowArrow: { fontSize: 20, color: c.textTertiary },
  });
}
