import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Colors, Typography, Spacing, Shadows } from '@/theme/theme';
import { getDB } from '@/db/database';
import { Trip, TripStatus } from '@/types';

type Filter = 'all' | TripStatus;

export default function TripsScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    const db = await getDB();
    const sql = filter === 'all'
      ? `SELECT * FROM trips ORDER BY start_date DESC, created_at DESC`
      : `SELECT * FROM trips WHERE status = ? ORDER BY start_date DESC, created_at DESC`;
    const params = filter === 'all' ? [] : [filter];
    const rows = await db.getAllAsync<any>(sql, params);
    setTrips(rows.map(rowToTrip));
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>내 여행</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => router.push('/trips/new')}
        >
          <Text style={styles.addButtonText}>+ 새 여행</Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {[
          { key: 'all', label: '전체' },
          { key: 'planning', label: '계획' },
          { key: 'ongoing', label: '진행 중' },
          { key: 'completed', label: '완료' },
        ].map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key as Filter)}
          >
            <Text
              style={[styles.filterText, filter === f.key && styles.filterTextActive]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {trips.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🧳</Text>
          <Text style={styles.emptyTitle}>아직 여행 기록이 없어요</Text>
          <Text style={styles.emptyDesc}>첫 번째 여행을 추가해보세요</Text>
          <Pressable
            style={styles.emptyBtn}
            onPress={() => router.push('/trips/new')}
          >
            <Text style={styles.emptyBtnText}>새 여행 만들기</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <TripCard trip={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const statusColor = {
    planning: Colors.tripPlanning,
    ongoing: Colors.tripOngoing,
    completed: Colors.tripCompleted,
  }[trip.status];
  const statusLabel = {
    planning: '계획 중',
    ongoing: '진행 중',
    completed: '완료',
  }[trip.status];

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/trip/${trip.id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.status, { color: statusColor }]}>{statusLabel}</Text>
        {trip.isFavorite && <Text style={styles.star}>⭐</Text>}
      </View>
      <Text style={styles.cardTitle}>{trip.title}</Text>
      <Text style={styles.cardLocation}>
        📍 {[trip.city, trip.country].filter(Boolean).join(', ') || '미정'}
      </Text>
      {(trip.startDate || trip.endDate) && (
        <Text style={styles.cardDate}>
          {trip.startDate}{trip.endDate ? ` ~ ${trip.endDate}` : ''}
        </Text>
      )}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.xxl,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.displaySmall,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  addButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
  },
  addButtonText: {
    color: Colors.textOnPrimary,
    fontSize: Typography.labelLarge,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  filterTextActive: { color: Colors.textOnPrimary },
  list: {
    padding: Spacing.xxl,
    paddingTop: 0,
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    ...Shadows.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  status: {
    fontSize: Typography.labelSmall,
    fontWeight: '700',
    letterSpacing: 1,
  },
  star: { marginLeft: 'auto', fontSize: 14 },
  cardTitle: {
    fontSize: Typography.headlineSmall,
    color: Colors.textPrimary,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  cardLocation: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  cardDate: {
    fontSize: Typography.labelMedium,
    color: Colors.textTertiary,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  emptyIcon: { fontSize: 56, marginBottom: Spacing.lg },
  emptyTitle: {
    fontSize: Typography.headlineSmall,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  emptyDesc: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  emptyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: 999,
  },
  emptyBtnText: {
    color: Colors.textOnPrimary,
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
  },
});
