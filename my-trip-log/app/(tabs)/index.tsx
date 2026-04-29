import { useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { getDB } from '@/db/database';
import { User, Trip } from '@/types';

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [user, setUser] = useState<User | null>(null);
  const [ongoingTrip, setOngoingTrip] = useState<Trip | null>(null);
  const [planningTrips, setPlanningTrips] = useState<Trip[]>([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, planning: 0 });

  const loadData = useCallback(async () => {
    const db = await getDB();

    const u = await db.getFirstAsync<any>('SELECT * FROM user LIMIT 1');
    if (u) {
      setUser({
        id: u.id,
        nickname: u.nickname,
        email: u.email,
        nationality: u.nationality,
        profileImage: u.profile_image,
        homeCurrency: u.home_currency,
        agreeTerms: !!u.agree_terms,
        agreePrivacy: !!u.agree_privacy,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      });
    }

    const ongoing = await db.getFirstAsync<any>(
      `SELECT * FROM trips WHERE status = 'ongoing' ORDER BY start_date DESC LIMIT 1`
    );
    setOngoingTrip(ongoing ? rowToTrip(ongoing) : null);

    // 계획 중인 여행 전부 가져오기 (최신순)
    const plans = await db.getAllAsync<any>(
      `SELECT * FROM trips WHERE status = 'planning'
       ORDER BY
         CASE WHEN start_date IS NULL THEN 1 ELSE 0 END,
         start_date ASC,
         created_at DESC`
    );
    setPlanningTrips(plans.map(rowToTrip));

    const total = await db.getFirstAsync<any>('SELECT COUNT(*) as c FROM trips');
    const completed = await db.getFirstAsync<any>(
      `SELECT COUNT(*) as c FROM trips WHERE status = 'completed'`
    );
    const planning = await db.getFirstAsync<any>(
      `SELECT COUNT(*) as c FROM trips WHERE status = 'planning'`
    );
    setStats({
      total: total?.c ?? 0,
      completed: completed?.c ?? 0,
      planning: planning?.c ?? 0,
    });
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const greeting = getGreeting();
  const hasAnyPlan = ongoingTrip || planningTrips.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topRow}>
          <Text style={styles.pageTitle}>✈️ Travel Diary</Text>
          <View style={styles.greetBlock}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.name}>{user?.nickname ?? '여행자'}님</Text>
          </View>
        </View>

        {/* 진행 중인 여행 */}
        {ongoingTrip && (
          <Pressable
            style={styles.ongoingCard}
            onPress={() => router.push(`/trip/${ongoingTrip.id}`)}
          >
            <View style={styles.ongoingHead}>
              <Text style={styles.ongoingBadge}>진행 중</Text>
              <Pressable
                onPress={() => router.push(`/trips/new?id=${ongoingTrip.id}`)}
                hitSlop={10}
                style={styles.editIconWrap}
              >
                <Text style={styles.editIconLight}>✏️</Text>
              </Pressable>
            </View>
            <Text style={styles.ongoingTitle}>{ongoingTrip.title}</Text>
            <Text style={styles.ongoingLocation}>
              📍 {ongoingTrip.city ?? ''} {ongoingTrip.country ?? ''}
            </Text>
            {(ongoingTrip.startDate || ongoingTrip.endDate) && (
              <View style={styles.ongoingDates}>
                <Text style={styles.ongoingDate}>
                  {ongoingTrip.startDate} ~ {ongoingTrip.endDate}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        {/* 계획 중인 여행 리스트 */}
        {planningTrips.length > 0 && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>계획 중인 여행</Text>
              <Text style={styles.sectionCount}>{planningTrips.length}</Text>
            </View>
            {planningTrips.map((trip) => (
              <PlanningCard
                key={trip.id}
                trip={trip}
                onOpen={() => router.push(`/trip/${trip.id}`)}
                onEdit={() => router.push(`/trips/new?id=${trip.id}`)}
               styles={styles} />
            ))}
            <Pressable
              style={styles.addMoreBtn}
              onPress={() => router.push('/trips/new')}
            >
              <Text style={styles.addMoreText}>+ 여행 계획 추가</Text>
            </Pressable>
          </View>
        )}

        {/* 계획도 진행도 없는 경우만 빈 카드 */}
        {!hasAnyPlan && (
          <Pressable
            style={styles.emptyCard}
            onPress={() => router.push('/trips/new')}
          >
            <Text style={styles.emptyIcon}>✈️</Text>
            <Text style={styles.emptyTitle}>새 여행 계획하기</Text>
            <Text style={styles.emptyDesc}>첫 여행을 추가해보세요</Text>
          </Pressable>
        )}

        <View style={styles.statsRow}>
          <StatBox label="전체" value={stats.total} styles={styles} />
          <StatBox label="계획 중" value={stats.planning} styles={styles} />
          <StatBox label="완료" value={stats.completed} styles={styles} />
        </View>

        <Text style={styles.sectionTitleSmall}>빠른 메뉴</Text>
        <View style={styles.quickGrid}>
          <QuickButton icon="🤖" label="AI 일정" highlight onPress={() => router.push('/ai-itinerary')} styles={styles} />
          <QuickButton icon="💰" label="비용관리" onPress={() => router.push('/expenses')} styles={styles} />
          <QuickButton icon="💱" label="환율" onPress={() => router.push('/(tabs)/tools')} styles={styles} />
          <QuickButton icon="🚇" label="교통" onPress={() => router.push('/(tabs)/tools')} styles={styles} />
          <QuickButton icon="📝" label="새 기록" onPress={() => router.push('/trips/new')} styles={styles} />
          <QuickButton icon="📋" label="체크리스트" onPress={() => router.push('/(tabs)/trips')} styles={styles} />
          <QuickButton icon="🎫" label="티켓관리" onPress={() => router.push('/tickets')} styles={styles} />
          <QuickButton icon="📊" label="여행 통계" onPress={() => router.push('/stats')} styles={styles} />
          <QuickButton icon="❤️" label="위시리스트" onPress={() => router.push('/wishlist')} styles={styles} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanningCard({
  trip, onOpen, onEdit, styles,
}: {
  trip: Trip;
  onOpen: () => void;
  onEdit: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable style={styles.planCard} onPress={onOpen}>
      <View style={styles.planContent}>
        <View style={styles.planBadgeRow}>
          <Text style={styles.planBadge}>계획 중</Text>
        </View>
        <Text style={styles.planTitle} numberOfLines={1}>{trip.title}</Text>
        {(trip.city || trip.country) && (
          <Text style={styles.planLocation} numberOfLines={1}>
            📍 {[trip.city, trip.country].filter(Boolean).join(', ')}
          </Text>
        )}
        {trip.startDate && (
          <Text style={styles.planDate}>
            🗓️ {trip.startDate}{trip.endDate ? ` ~ ${trip.endDate}` : ' 출발'}
          </Text>
        )}
      </View>
      <Pressable
        onPress={onEdit}
        hitSlop={10}
        style={styles.editBtn}
      >
        <Text style={styles.editIcon}>✏️</Text>
      </Pressable>
    </Pressable>
  );
}

function StatBox({ label, value, styles }: {
  label: string;
  value: number;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickButton({ icon, label, onPress, highlight, styles }: {
  icon: string;
  label: string;
  onPress: () => void;
  highlight?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable style={[styles.quickBtn, highlight && styles.quickBtnHighlight]} onPress={onPress}>
      <Text style={styles.quickIcon}>{icon}</Text>
      <Text style={[styles.quickLabel, highlight && styles.quickLabelHighlight]}>{label}</Text>
      {highlight && <View style={styles.quickBadge}><Text style={styles.quickBadgeText}>NEW</Text></View>}
    </Pressable>
  );
}

function rowToTrip(r: any): Trip {
  return {
    id: r.id,
    title: r.title,
    country: r.country,
    countryCode: r.country_code,
    city: r.city,
    cityId: r.city_id ?? null,
    startDate: r.start_date,
    endDate: r.end_date,
    budget: r.budget,
    currency: r.currency,
    status: r.status,
    coverImage: r.cover_image,
    memo: r.memo,
    isFavorite: !!r.is_favorite,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return '편안한 새벽이에요';
  if (h < 12) return '상쾌한 아침이에요';
  if (h < 18) return '좋은 오후에요';
  return '편안한 저녁이에요';
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scroll: { padding: Spacing.xxl, paddingBottom: Spacing.huge },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#C9A961',
    letterSpacing: -0.5,
  },
  greetBlock: {
    alignItems: 'flex-end',
  },
  header: { marginBottom: Spacing.xl },
  greeting: {
    fontSize: Typography.labelSmall,
    color: c.textSecondary,
    marginBottom: 2,
  },
  name: {
    fontSize: Typography.bodyLarge,
    color: c.textPrimary,
    fontWeight: '700',
  },

  // 진행 중 카드
  ongoingCard: {
    backgroundColor: c.primary,
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.medium,
  },
  ongoingHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  ongoingBadge: {
    backgroundColor: c.accent,
    color: c.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: Typography.labelSmall,
    fontWeight: '700',
    letterSpacing: 1,
    overflow: 'hidden',
  },
  editIconWrap: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
  editIconLight: {
    fontSize: 14,
  },
  ongoingTitle: {
    fontSize: Typography.headlineLarge,
    color: c.textOnPrimary,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  ongoingLocation: {
    fontSize: Typography.bodyMedium,
    color: c.textOnPrimary,
    opacity: 0.85,
    marginBottom: Spacing.md,
  },
  ongoingDates: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.textOnPrimary,
    paddingTop: Spacing.md,
  },
  ongoingDate: {
    fontSize: Typography.bodySmall,
    color: c.textOnPrimary,
    opacity: 0.75,
  },

  // 계획 중 섹션
  sectionWrap: {
    marginBottom: Spacing.xxl,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.headlineSmall,
    color: c.textPrimary,
    fontWeight: '700',
  },
  sectionCount: {
    fontSize: Typography.labelSmall,
    color: c.textOnPrimary,
    fontWeight: '700',
    backgroundColor: c.primary,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  sectionTitleSmall: {
    fontSize: Typography.headlineSmall,
    color: c.textPrimary,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },

  // 계획 카드
  planCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: c.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.soft,
  },
  planContent: {
    flex: 1,
  },
  planBadgeRow: {
    marginBottom: Spacing.xs,
  },
  planBadge: {
    alignSelf: 'flex-start',
    fontSize: 10,
    color: c.tripPlanning,
    fontWeight: '700',
    letterSpacing: 1,
  },
  planTitle: {
    fontSize: Typography.bodyLarge,
    color: c.textPrimary,
    fontWeight: '700',
    marginBottom: 2,
  },
  planLocation: {
    fontSize: Typography.bodySmall,
    color: c.textSecondary,
    marginTop: 2,
  },
  planDate: {
    fontSize: Typography.bodySmall,
    color: c.textSecondary,
    marginTop: 2,
  },
  editBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
  editIcon: {
    fontSize: 16,
  },

  // 계획 추가 버튼
  addMoreBtn: {
    paddingVertical: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: c.border,
    borderStyle: 'dashed',
    marginTop: Spacing.xs,
  },
  addMoreText: {
    fontSize: Typography.bodyMedium,
    color: c.textSecondary,
    fontWeight: '600',
  },

  // 빈 카드
  emptyCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: Spacing.xxxl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1.5,
    borderColor: c.border,
    borderStyle: 'dashed',
  },
  emptyIcon: { fontSize: 40, marginBottom: Spacing.md },
  emptyTitle: {
    fontSize: Typography.headlineSmall,
    color: c.textPrimary,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  emptyDesc: {
    fontSize: Typography.bodySmall,
    color: c.textSecondary,
  },

  // 통계
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  statBox: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.soft,
  },
  statValue: {
    fontSize: Typography.displaySmall,
    color: c.primary,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  statLabel: {
    fontSize: Typography.labelMedium,
    color: c.textSecondary,
  },

  // 빠른 메뉴
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  quickBtn: {
    width: '47%',
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.soft,
  },
  quickBtnHighlight: {
    backgroundColor: c.primary,
    borderWidth: 2,
    borderColor: c.accent,
    position: 'relative',
  },
  quickIcon: { fontSize: 28, marginBottom: Spacing.sm },
  quickLabel: {
    fontSize: Typography.bodyMedium,
    color: c.textPrimary,
    fontWeight: '600',
  },
  quickLabelHighlight: {
    color: c.textOnPrimary,
    fontWeight: '700',
  },
  quickBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: c.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  quickBadgeText: {
    fontSize: 9,
    color: c.primary,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
}

