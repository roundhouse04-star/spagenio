import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Colors, Typography, Spacing, Shadows } from '@/theme/theme';
import { getDB } from '@/db/database';
import { User, Trip } from '@/types';

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [ongoingTrip, setOngoingTrip] = useState<Trip | null>(null);
  const [upcomingTrip, setUpcomingTrip] = useState<Trip | null>(null);
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

    const upcoming = await db.getFirstAsync<any>(
      `SELECT * FROM trips WHERE status = 'planning' AND start_date >= date('now')
       ORDER BY start_date ASC LIMIT 1`
    );
    setUpcomingTrip(upcoming ? rowToTrip(upcoming) : null);

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.name}>{user?.nickname ?? '여행자'}님</Text>
        </View>

        {ongoingTrip && (
          <Pressable
            style={styles.ongoingCard}
            onPress={() => router.push(`/trip/${ongoingTrip.id}`)}
          >
            <Text style={styles.ongoingBadge}>진행 중</Text>
            <Text style={styles.ongoingTitle}>{ongoingTrip.title}</Text>
            <Text style={styles.ongoingLocation}>
              📍 {ongoingTrip.city ?? ''} {ongoingTrip.country ?? ''}
            </Text>
            <View style={styles.ongoingDates}>
              <Text style={styles.ongoingDate}>
                {ongoingTrip.startDate} ~ {ongoingTrip.endDate}
              </Text>
            </View>
          </Pressable>
        )}

        {upcomingTrip && !ongoingTrip && (
          <Pressable
            style={styles.upcomingCard}
            onPress={() => router.push(`/trip/${upcomingTrip.id}`)}
          >
            <Text style={styles.upcomingLabel}>다가오는 여행</Text>
            <Text style={styles.upcomingTitle}>{upcomingTrip.title}</Text>
            <Text style={styles.upcomingDate}>
              {upcomingTrip.startDate} 출발
            </Text>
          </Pressable>
        )}

        {!ongoingTrip && !upcomingTrip && (
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
          <StatBox label="전체" value={stats.total} />
          <StatBox label="계획 중" value={stats.planning} />
          <StatBox label="완료" value={stats.completed} />
        </View>

        <Text style={styles.sectionTitle}>빠른 메뉴</Text>
        <View style={styles.quickGrid}>
          <QuickButton icon="💱" label="환율" onPress={() => router.push('/(tabs)/tools')} />
          <QuickButton icon="🚇" label="교통" onPress={() => router.push('/(tabs)/tools')} />
          <QuickButton icon="📝" label="새 기록" onPress={() => router.push('/trips/new')} />
          <QuickButton icon="📋" label="체크리스트" onPress={() => router.push('/(tabs)/trips')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.quickBtn} onPress={onPress}>
      <Text style={styles.quickIcon}>{icon}</Text>
      <Text style={styles.quickLabel}>{label}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.xxl, paddingBottom: Spacing.huge },
  header: { marginBottom: Spacing.xl },
  greeting: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  name: {
    fontSize: Typography.displaySmall,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  ongoingCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.medium,
  },
  ongoingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent,
    color: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: Typography.labelSmall,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  ongoingTitle: {
    fontSize: Typography.headlineLarge,
    color: Colors.textOnPrimary,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  ongoingLocation: {
    fontSize: Typography.bodyMedium,
    color: 'rgba(250, 248, 243, 0.8)',
    marginBottom: Spacing.md,
  },
  ongoingDates: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(250, 248, 243, 0.2)',
    paddingTop: Spacing.md,
  },
  ongoingDate: {
    fontSize: Typography.bodySmall,
    color: 'rgba(250, 248, 243, 0.7)',
  },
  upcomingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent,
    ...Shadows.soft,
  },
  upcomingLabel: {
    fontSize: Typography.labelSmall,
    color: Colors.accent,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  upcomingTitle: {
    fontSize: Typography.headlineMedium,
    color: Colors.textPrimary,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  upcomingDate: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.xxxl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  emptyIcon: { fontSize: 40, marginBottom: Spacing.md },
  emptyTitle: {
    fontSize: Typography.headlineSmall,
    color: Colors.textPrimary,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  emptyDesc: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.soft,
  },
  statValue: {
    fontSize: Typography.displaySmall,
    color: Colors.primary,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  statLabel: {
    fontSize: Typography.labelMedium,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontSize: Typography.headlineSmall,
    color: Colors.textPrimary,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  quickBtn: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.soft,
  },
  quickIcon: { fontSize: 28, marginBottom: Spacing.sm },
  quickLabel: {
    fontSize: Typography.bodyMedium,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
});
