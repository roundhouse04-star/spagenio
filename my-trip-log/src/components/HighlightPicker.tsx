/**
 * 추천 장소 피커 모달
 *
 * 일정 추가(item-new) 화면에서 "🌟 추천 장소에서 고르기" 버튼으로 호출.
 * 도시 ID에 해당하는 하이라이트를 카테고리별로 보여주고, 탭하면 onPick 콜백.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal, SafeAreaView,
} from 'react-native';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import {
  getHighlightsByCity,
  getCityDisplayName,
  getCityFlag,
  HIGHLIGHT_CATEGORIES,
  type CityHighlight,
  type HighlightCategory,
} from '@/data/cityHighlights';
import { getAllFavorites, toggleFavorite } from '@/utils/highlightFavorites';

type CategoryFilter = HighlightCategory | 'all';

interface Props {
  visible: boolean;
  cityId: string | null;
  onClose: () => void;
  onPick: (h: CityHighlight) => void;
}

export function HighlightPicker({ visible, cityId, onClose, onPick }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const highlights = useMemo(() => {
    if (!cityId) return [];
    return getHighlightsByCity(cityId);
  }, [cityId]);

  // 모달 열릴 때마다 즐겨찾기 다시 로드 (다른 화면에서 변경됐을 수 있음)
  useEffect(() => {
    if (!visible) return;
    getAllFavorites().then(setFavorites).catch(() => setFavorites(new Set()));
  }, [visible]);

  const isFav = (h: CityHighlight) => favorites.has(`${h.cityId}::${h.name}`);

  const handleToggleFav = async (h: CityHighlight) => {
    haptic.tap();
    const newState = await toggleFavorite(h.cityId, h.name);
    setFavorites((prev) => {
      const next = new Set(prev);
      const k = `${h.cityId}::${h.name}`;
      if (newState) next.add(k);
      else next.delete(k);
      return next;
    });
  };

  // 카테고리 필터 적용 후, 즐겨찾기 우선 정렬
  const filtered = useMemo(() => {
    const base = filter === 'all' ? highlights : highlights.filter((h) => h.category === filter);
    return [...base].sort((a, b) => {
      const af = favorites.has(`${a.cityId}::${a.name}`) ? 0 : 1;
      const bf = favorites.has(`${b.cityId}::${b.name}`) ? 0 : 1;
      return af - bf;
    });
  }, [highlights, filter, favorites]);

  if (!cityId) return null;

  const cityName = getCityDisplayName(cityId);
  const cityFlag = getCityFlag(cityId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => { haptic.tap(); onClose(); }} hitSlop={10} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
          <Text style={styles.headerTitle}>
            {cityFlag} {cityName} 추천 장소
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* 카테고리 필터 칩 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}
        >
          <CatChip
            label="전체"
            active={filter === 'all'}
            count={highlights.length}
            onPress={() => { haptic.select(); setFilter('all'); }}
            styles={styles}
          />
          {HIGHLIGHT_CATEGORIES.map((c) => {
            const count = highlights.filter((h) => h.category === c.key).length;
            if (count === 0) return null; // 해당 카테고리 항목 없으면 칩도 숨김
            return (
              <CatChip
                key={c.key}
                label={`${c.icon} ${c.label}`}
                active={filter === c.key}
                count={count}
                onPress={() => { haptic.select(); setFilter(c.key); }}
                styles={styles}
              />
            );
          })}
        </ScrollView>

        {/* 하이라이트 리스트 */}
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🤷</Text>
            <Text style={styles.emptyText}>
              해당 카테고리에 추천 장소가 없어요
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {filtered.map((h, idx) => {
              const cat = HIGHLIGHT_CATEGORIES.find((c) => c.key === h.category);
              const fav = isFav(h);
              return (
                <Pressable
                  key={`${h.cityId}-${h.category}-${idx}`}
                  style={[styles.card, fav && styles.cardFav]}
                  onPress={() => { haptic.medium(); onPick(h); }}
                >
                  <View style={styles.cardLeft}>
                    <Text style={styles.catIcon}>{cat?.icon}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{h.name}</Text>
                      {h.nameLocal && (
                        <Text style={styles.cardLocal} numberOfLines={1}>· {h.nameLocal}</Text>
                      )}
                    </View>
                    {h.area && <Text style={styles.cardArea}>📍 {h.area}</Text>}
                    <Text style={styles.cardDesc} numberOfLines={2}>{h.description}</Text>
                    {h.tags.length > 0 && (
                      <View style={styles.tagRow}>
                        {h.tags.map((t) => (
                          <Text key={t} style={styles.tag}>#{t}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={styles.cardActions}>
                    <Pressable
                      onPress={(e) => { e.stopPropagation?.(); handleToggleFav(h); }}
                      hitSlop={8}
                      style={styles.starBtn}
                    >
                      <Text style={[styles.starText, fav && styles.starActive]}>
                        {fav ? '⭐' : '☆'}
                      </Text>
                    </Pressable>
                    <View style={styles.addBtn}>
                      <Text style={styles.addBtnText}>+</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
            <View style={{ height: Spacing.huge }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function CatChip({ label, active, count, onPress, styles }: {
  label: string;
  active: boolean;
  count: number;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label} <Text style={styles.chipCount}>{count}</Text>
      </Text>
    </Pressable>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    closeText: { fontSize: 20, color: c.textPrimary },
    headerTitle: {
      fontSize: Typography.bodyLarge,
      fontWeight: '700',
      color: c.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    chipScroll: { flexGrow: 0, flexShrink: 0 },
    chipRow: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      gap: Spacing.sm,
      alignItems: 'center',
    },
    chip: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignSelf: 'center',
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: Typography.labelSmall, color: c.textSecondary, fontWeight: '600' },
    chipTextActive: { color: c.textOnPrimary },
    chipCount: { opacity: 0.6, fontWeight: '400' },
    list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.md },
    card: {
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
    cardLeft: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catIcon: { fontSize: 22 },
    cardBody: { flex: 1, gap: 2 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
    cardTitle: {
      fontSize: Typography.bodyMedium,
      fontWeight: '700',
      color: c.textPrimary,
    },
    cardLocal: {
      fontSize: Typography.labelSmall,
      color: c.textTertiary,
      marginLeft: Spacing.xs,
    },
    cardArea: {
      fontSize: Typography.labelSmall,
      color: c.textSecondary,
    },
    cardDesc: {
      fontSize: Typography.labelSmall,
      color: c.textSecondary,
      lineHeight: Typography.labelSmall * 1.5,
    },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
    tag: {
      fontSize: 10,
      color: c.accent,
      fontWeight: '600',
    },
    cardFav: {
      borderColor: c.accent,
      backgroundColor: c.accent + '08',
    },
    cardActions: { alignItems: 'center', gap: Spacing.xs },
    starBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    starText: { fontSize: 22, color: c.textTertiary },
    starActive: { color: c.accent },
    addBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBtnText: { color: c.textOnPrimary, fontSize: 22, fontWeight: '700' },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
      padding: Spacing.xl,
    },
    emptyIcon: { fontSize: 48 },
    emptyText: { fontSize: Typography.bodyMedium, color: c.textSecondary, textAlign: 'center' },
  });
}
