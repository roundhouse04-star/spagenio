import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { getAllTickets, type TicketFilter } from '@/db/tickets';
import { getAllTrips } from '@/db/trips';
import { Ticket, TicketCategory, Trip } from '@/types';
import { TICKET_CATEGORIES } from '@/db/schema';

type CategoryKey = TicketCategory | 'all';
type SortKey = NonNullable<TicketFilter['sort']>;
type TripFilterKey = number | 'all' | 'none';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: '최신순' },
  { key: 'oldest', label: '오래된순' },
  { key: 'use_date_desc', label: '사용일 ↓' },
  { key: 'use_date_asc', label: '사용일 ↑' },
];

const screenWidth = Dimensions.get('window').width;
const cardSize = (screenWidth - Spacing.lg * 2 - Spacing.md) / 2;

export default function TicketsListScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryKey>('all');
  const [tripFilter, setTripFilter] = useState<TripFilterKey>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [tripPickerOpen, setTripPickerOpen] = useState(false);
  const [sortPickerOpen, setSortPickerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filter: TicketFilter = {
        search: search.trim() || undefined,
        sort,
      };
      if (category !== 'all') filter.category = category;
      if (tripFilter !== 'all') filter.tripId = tripFilter;
      const [list, allTrips] = await Promise.all([getAllTickets(filter), getAllTrips()]);
      setTickets(list);
      setTrips(allTrips);
    } catch (err) {
      console.error('[티켓 로드 실패]', err);
    } finally {
      setLoading(false);
    }
  }, [search, category, tripFilter, sort]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const tripById = useMemo(() => {
    const m = new Map<number, Trip>();
    trips.forEach((t) => m.set(t.id, t));
    return m;
  }, [trips]);

  const tripFilterLabel =
    tripFilter === 'all' ? '전체 여행'
    : tripFilter === 'none' ? '미연결'
    : tripById.get(tripFilter)?.title ?? '여행 선택';

  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? '정렬';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🎫 내 티켓 ({tickets.length})</Text>
        <Pressable
          onPress={() => { haptic.medium(); router.push('/tickets/new'); }}
          hitSlop={10}
          style={styles.addBtn}
        >
          <Text style={styles.addBtnText}>+ 추가</Text>
        </Pressable>
      </View>

      {/* 검색 */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="제목·메모 검색"
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={10}>
            <Text style={styles.searchClear}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* 카테고리 칩 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <CategoryChip
          active={category === 'all'}
          label="전체"
          onPress={() => { haptic.select(); setCategory('all'); }}
          styles={styles}
        />
        {TICKET_CATEGORIES.map((c) => (
          <CategoryChip
            key={c.key}
            active={category === c.key}
            label={`${c.icon} ${c.label}`}
            onPress={() => { haptic.select(); setCategory(c.key); }}
            styles={styles}
          />
        ))}
      </ScrollView>

      {/* 정렬·여행 필터 */}
      <View style={styles.dropdownRow}>
        <Pressable
          style={styles.dropdownBtn}
          onPress={() => { haptic.tap(); setTripPickerOpen((v) => !v); setSortPickerOpen(false); }}
        >
          <Text style={styles.dropdownText}>🧳 {tripFilterLabel} ▾</Text>
        </Pressable>
        <Pressable
          style={styles.dropdownBtn}
          onPress={() => { haptic.tap(); setSortPickerOpen((v) => !v); setTripPickerOpen(false); }}
        >
          <Text style={styles.dropdownText}>↕ {sortLabel} ▾</Text>
        </Pressable>
      </View>

      {tripPickerOpen && (
        <View style={styles.dropdown}>
          <DropdownItem
            label="전체 여행"
            active={tripFilter === 'all'}
            onPress={() => { setTripFilter('all'); setTripPickerOpen(false); }}
            styles={styles}
          />
          <DropdownItem
            label="여행 미연결"
            active={tripFilter === 'none'}
            onPress={() => { setTripFilter('none'); setTripPickerOpen(false); }}
            styles={styles}
          />
          {trips.map((t) => (
            <DropdownItem
              key={t.id}
              label={t.title}
              active={tripFilter === t.id}
              onPress={() => { setTripFilter(t.id); setTripPickerOpen(false); }}
              styles={styles}
            />
          ))}
        </View>
      )}

      {sortPickerOpen && (
        <View style={styles.dropdown}>
          {SORT_OPTIONS.map((o) => (
            <DropdownItem
              key={o.key}
              label={o.label}
              active={sort === o.key}
              onPress={() => { setSort(o.key); setSortPickerOpen(false); }}
              styles={styles}
            />
          ))}
        </View>
      )}

      {/* 본문 */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : tickets.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🎫</Text>
          <Text style={styles.emptyTitle}>아직 티켓이 없어요</Text>
          <Text style={styles.emptyDesc}>
            비행기 보딩패스, 입장권, 공연 티켓을{'\n'}사진으로 모아보세요
          </Text>
          <Pressable
            style={styles.emptyButton}
            onPress={() => { haptic.medium(); router.push('/tickets/new'); }}
          >
            <Text style={styles.emptyButtonText}>+ 첫 티켓 추가</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {tickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              tripTitle={t.tripId ? tripById.get(t.tripId)?.title ?? null : null}
              onPress={() => { haptic.tap(); router.push({ pathname: '/tickets/[id]', params: { id: String(t.id) } }); }}
              styles={styles}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function CategoryChip({ active, label, onPress, styles }: {
  active: boolean;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function DropdownItem({ label, active, onPress, styles }: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      style={[styles.dropdownItem, active && styles.dropdownItemActive]}
      onPress={() => { haptic.select(); onPress(); }}
    >
      <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>
        {active ? '✓ ' : '   '}{label}
      </Text>
    </Pressable>
  );
}

function TicketCard({ ticket, tripTitle, onPress, styles }: {
  ticket: Ticket;
  tripTitle: string | null;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const cat = TICKET_CATEGORIES.find((c) => c.key === ticket.category);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Image source={{ uri: ticket.imageUri }} style={styles.cardImage} resizeMode="cover" />
      <View style={styles.cardBody}>
        <Text style={styles.cardCategory}>{cat?.icon} {cat?.label}</Text>
        <Text style={styles.cardTitle} numberOfLines={2}>{ticket.title}</Text>
        {ticket.useDate && (
          <Text style={styles.cardDate}>📅 {ticket.useDate}</Text>
        )}
        {tripTitle && (
          <Text style={styles.cardTrip} numberOfLines={1}>🧳 {tripTitle}</Text>
        )}
      </View>
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
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backText: { fontSize: 24, color: c.textPrimary },
    headerTitle: {
      fontSize: Typography.bodyLarge,
      fontWeight: '700',
      color: c.textPrimary,
    },
    addBtn: {
      backgroundColor: c.primary,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: 999,
    },
    addBtnText: {
      color: c.textOnPrimary,
      fontSize: Typography.labelSmall,
      fontWeight: '700',
    },
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
    searchClear: { fontSize: 16, color: c.textTertiary, paddingHorizontal: Spacing.xs },
    chipRow: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xs,
      gap: Spacing.sm,
    },
    chip: {
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.md,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: Typography.labelSmall, color: c.textSecondary },
    chipTextActive: { color: c.textOnPrimary, fontWeight: '700' },
    dropdownRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    dropdownBtn: {
      flex: 1,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
    },
    dropdownText: {
      fontSize: Typography.labelSmall,
      color: c.textSecondary,
      fontWeight: '500',
    },
    dropdown: {
      marginHorizontal: Spacing.lg,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      ...Shadows.medium,
      maxHeight: 240,
    },
    dropdownItem: {
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    dropdownItemActive: {
      backgroundColor: c.primary + '15',
    },
    dropdownItemText: {
      fontSize: Typography.bodyMedium,
      color: c.textPrimary,
    },
    dropdownItemTextActive: {
      color: c.primary,
      fontWeight: '700',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
      padding: Spacing.lg,
      paddingBottom: Spacing.xxl,
    },
    card: {
      width: cardSize,
      backgroundColor: c.surface,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.border,
      ...Shadows.soft,
    },
    cardImage: { width: '100%', height: cardSize, backgroundColor: c.surfaceAlt },
    cardBody: { padding: Spacing.md, gap: Spacing.xs },
    cardCategory: {
      fontSize: Typography.labelSmall,
      color: c.accent,
      fontWeight: '600',
    },
    cardTitle: {
      fontSize: Typography.bodyMedium,
      color: c.textPrimary,
      fontWeight: '700',
      lineHeight: Typography.bodyMedium * 1.3,
    },
    cardDate: {
      fontSize: Typography.labelSmall,
      color: c.textSecondary,
    },
    cardTrip: {
      fontSize: Typography.labelSmall,
      color: c.textTertiary,
    },
    loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
    },
    emptyIcon: { fontSize: 56, marginBottom: Spacing.md },
    emptyTitle: {
      fontSize: Typography.titleMedium,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: Spacing.xs,
    },
    emptyDesc: {
      fontSize: Typography.bodySmall,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: Typography.bodySmall * 1.6,
      marginBottom: Spacing.xl,
    },
    emptyButton: {
      backgroundColor: c.primary,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xl,
      borderRadius: 999,
    },
    emptyButtonText: {
      color: c.textOnPrimary,
      fontWeight: '700',
      fontSize: Typography.bodyMedium,
    },
  });
}
