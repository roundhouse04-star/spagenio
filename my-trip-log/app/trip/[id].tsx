import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect, Stack } from 'expo-router';
import { Colors, Typography, Spacing, Shadows } from '@/theme/theme';
import { getDB } from '@/db/database';
import { Trip } from '@/types';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [tab, setTab] = useState<'overview' | 'itinerary' | 'expenses' | 'logs'>('overview');
  const [summary, setSummary] = useState({ items: 0, logs: 0, expenses: 0, spent: 0 });

  const load = useCallback(async () => {
    const db = await getDB();
    const t = await db.getFirstAsync<any>('SELECT * FROM trips WHERE id = ?', [tripId]);
    if (t) {
      setTrip({
        id: t.id,
        title: t.title,
        country: t.country,
        countryCode: t.country_code,
        city: t.city,
        startDate: t.start_date,
        endDate: t.end_date,
        budget: t.budget,
        currency: t.currency,
        status: t.status,
        coverImage: t.cover_image,
        memo: t.memo,
        isFavorite: !!t.is_favorite,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      });
    }

    const items = await db.getFirstAsync<any>(
      'SELECT COUNT(*) as c FROM trip_items WHERE trip_id = ?', [tripId]
    );
    const logs = await db.getFirstAsync<any>(
      'SELECT COUNT(*) as c FROM trip_logs WHERE trip_id = ?', [tripId]
    );
    const exp = await db.getFirstAsync<any>(
      `SELECT COUNT(*) as c, COALESCE(SUM(amount_in_home_currency), 0) as total
       FROM expenses WHERE trip_id = ?`, [tripId]
    );
    setSummary({
      items: items?.c ?? 0,
      logs: logs?.c ?? 0,
      expenses: exp?.c ?? 0,
      spent: exp?.total ?? 0,
    });
  }, [tripId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = () => {
    Alert.alert('여행 삭제', '이 여행과 관련된 모든 기록이 삭제됩니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          const db = await getDB();
          await db.runAsync('DELETE FROM trips WHERE id = ?', [tripId]);
          router.back();
        },
      },
    ]);
  };

  if (!trip) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.loading}>로딩 중…</Text>
      </SafeAreaView>
    );
  }

  const statusLabel = {
    planning: '계획 중',
    ongoing: '진행 중',
    completed: '완료',
  }[trip.status];
  const statusColor = {
    planning: Colors.tripPlanning,
    ongoing: Colors.tripOngoing,
    completed: Colors.tripCompleted,
  }[trip.status];

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: trip.title,
          headerBackTitle: '뒤로',
          headerRight: () => (
            <Pressable onPress={handleDelete}>
              <Text style={{ color: Colors.error, fontSize: 16, paddingHorizontal: 12 }}>
                🗑️
              </Text>
            </Pressable>
          ),
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <Text style={styles.heroTitle}>{trip.title}</Text>
          <Text style={styles.heroLocation}>
            📍 {[trip.city, trip.country].filter(Boolean).join(', ') || '장소 미정'}
          </Text>
          {(trip.startDate || trip.endDate) && (
            <Text style={styles.heroDate}>
              🗓️ {trip.startDate}{trip.endDate ? ` ~ ${trip.endDate}` : ''}
            </Text>
          )}
          {trip.budget > 0 && (
            <Text style={styles.heroBudget}>
              💰 예산 {trip.budget.toLocaleString()} {trip.currency}
              {summary.spent > 0 && (
                <Text style={styles.spentText}> · 사용 {summary.spent.toLocaleString()}</Text>
              )}
            </Text>
          )}
        </View>

        <View style={styles.tabRow}>
          {[
            { key: 'overview', label: '개요' },
            { key: 'itinerary', label: `일정 ${summary.items}` },
            { key: 'logs', label: `기록 ${summary.logs}` },
            { key: 'expenses', label: `비용 ${summary.expenses}` },
          ].map((t) => (
            <Pressable
              key={t.key}
              style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
              onPress={() => setTab(t.key as any)}
            >
              <Text
                style={[styles.tabText, tab === t.key && styles.tabTextActive]}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {tab === 'overview' && <OverviewTab trip={trip} summary={summary} />}
          {tab === 'itinerary' && <EmptyTab icon="📅" title="일정 추가" desc="여행 일정을 추가해보세요" />}
          {tab === 'logs' && <EmptyTab icon="📝" title="기록 추가" desc="여행의 순간을 기록해보세요" />}
          {tab === 'expenses' && <EmptyTab icon="💰" title="비용 추가" desc="여행 비용을 관리하세요" />}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function OverviewTab({ trip, summary }: { trip: Trip; summary: any }) {
  return (
    <View style={styles.overview}>
      <View style={styles.statGrid}>
        <StatCard icon="📅" label="일정" value={summary.items} />
        <StatCard icon="📝" label="기록" value={summary.logs} />
        <StatCard icon="💰" label="비용" value={summary.expenses} />
        <StatCard icon="✅" label="체크" value="0" />
      </View>

      {trip.memo && (
        <View style={styles.memoCard}>
          <Text style={styles.memoTitle}>메모</Text>
          <Text style={styles.memoText}>{trip.memo}</Text>
        </View>
      )}
    </View>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: any }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyTab({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDesc}>{desc}</Text>
      <Pressable style={styles.emptyBtn}>
        <Text style={styles.emptyBtnText}>+ 추가하기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { textAlign: 'center', padding: Spacing.huge, color: Colors.textSecondary },
  heroCard: {
    backgroundColor: Colors.primary,
    padding: Spacing.xl,
    margin: Spacing.lg,
    marginBottom: 0,
    borderRadius: 16,
    ...Shadows.medium,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: {
    fontSize: Typography.labelSmall,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: Typography.headlineLarge,
    fontWeight: '700',
    color: Colors.textOnPrimary,
    marginBottom: Spacing.sm,
  },
  heroLocation: {
    fontSize: Typography.bodyMedium,
    color: 'rgba(250, 248, 243, 0.8)',
    marginBottom: Spacing.xs,
  },
  heroDate: {
    fontSize: Typography.bodySmall,
    color: 'rgba(250, 248, 243, 0.7)',
    marginBottom: Spacing.xs,
  },
  heroBudget: {
    fontSize: Typography.bodySmall,
    color: Colors.accent,
    fontWeight: '600',
  },
  spentText: {
    color: 'rgba(250, 248, 243, 0.6)',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: 999,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: Colors.surfaceAlt,
  },
  tabText: {
    fontSize: Typography.labelLarge,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },
  content: {
    padding: Spacing.lg,
    paddingTop: 0,
  },
  overview: { gap: Spacing.lg },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.soft,
  },
  statIcon: { fontSize: 28, marginBottom: Spacing.xs },
  statValue: {
    fontSize: Typography.displaySmall,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: Typography.labelSmall,
    color: Colors.textSecondary,
  },
  memoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.lg,
    ...Shadows.soft,
  },
  memoTitle: {
    fontSize: Typography.labelMedium,
    fontWeight: '700',
    color: Colors.accent,
    marginBottom: Spacing.xs,
    letterSpacing: 1,
  },
  memoText: {
    fontSize: Typography.bodyMedium,
    color: Colors.textPrimary,
    lineHeight: Typography.bodyMedium * 1.6,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.huge,
  },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
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
    fontWeight: '700',
  },
});
