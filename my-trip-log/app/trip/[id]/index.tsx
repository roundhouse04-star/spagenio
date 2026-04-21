import { useMemo, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect, Stack } from 'expo-router';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { getDB } from '@/db/database';
import { Trip } from '@/types';
import { ItineraryTab } from '@/components/ItineraryTab';
import { LogsTab } from '@/components/LogsTab';
import { ExpensesTab } from '@/components/ExpensesTab';
import { ChecklistTab } from '@/components/ChecklistTab';

type Tab = 'overview' | 'itinerary' | 'logs' | 'expenses' | 'checklist';

export default function TripDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [summary, setSummary] = useState({
    items: 0, logs: 0, expenses: 0, checklist: 0, spent: 0,
  });

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
    const checklist = await db.getFirstAsync<any>(
      'SELECT COUNT(*) as c FROM checklists WHERE trip_id = ?', [tripId]
    );
    setSummary({
      items: items?.c ?? 0,
      logs: logs?.c ?? 0,
      expenses: exp?.c ?? 0,
      checklist: checklist?.c ?? 0,
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

  const cycleStatus = async () => {
    if (!trip) return;
    const next = {
      planning: 'ongoing',
      ongoing: 'completed',
      completed: 'planning',
    }[trip.status] as Trip['status'];
    const db = await getDB();
    await db.runAsync('UPDATE trips SET status = ?, updated_at = ? WHERE id = ?',
      [next, new Date().toISOString(), tripId]);
    load();
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
    planning: colors.tripPlanning,
    ongoing: colors.tripOngoing,
    completed: colors.tripCompleted,
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
              <Text style={{ fontSize: 18, paddingHorizontal: 12 }}>🗑️</Text>
            </Pressable>
          ),
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <Pressable onPress={cycleStatus} style={styles.heroHeader}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusLabel}
              </Text>
              <Text style={styles.statusHint}>탭하여 변경</Text>
            </Pressable>
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
                  <Text style={styles.spentText}>
                    {' · '}사용 {summary.spent.toLocaleString()}
                  </Text>
                )}
              </Text>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}
          >
            {[
              { key: 'overview', label: '개요' },
              { key: 'itinerary', label: `일정 ${summary.items || ''}`.trim() },
              { key: 'logs', label: `기록 ${summary.logs || ''}`.trim() },
              { key: 'expenses', label: `비용 ${summary.expenses || ''}`.trim() },
              { key: 'checklist', label: `체크 ${summary.checklist || ''}`.trim() },
            ].map((t) => (
              <Pressable
                key={t.key}
                style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
                onPress={() => setTab(t.key as Tab)}
              >
                <Text
                  style={[styles.tabText, tab === t.key && styles.tabTextActive]}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.content}>
            {tab === 'overview' && <OverviewTab trip={trip} summary={summary} styles={styles} />}
            {tab === 'itinerary' && <ItineraryTab trip={trip} />}
            {tab === 'logs' && <LogsTab trip={trip} />}
            {tab === 'expenses' && <ExpensesTab trip={trip} />}
            {tab === 'checklist' && <ChecklistTab trip={trip} />}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function OverviewTab({ trip, summary, styles }: {
  trip: Trip;
  summary: any;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.overview}>
      <View style={styles.statGrid}>
        <StatCard icon="📅" label="일정" value={summary.items} styles={styles} />
        <StatCard icon="📝" label="기록" value={summary.logs} styles={styles} />
        <StatCard icon="💰" label="비용" value={summary.expenses} styles={styles} />
        <StatCard icon="✅" label="체크" value={summary.checklist} styles={styles} />
      </View>

      {trip.memo && (
        <View style={styles.memoCard}>
          <Text style={styles.memoTitle}>메모</Text>
          <Text style={styles.memoText}>{trip.memo}</Text>
        </View>
      )}

      <View style={styles.memoCard}>
        <Text style={styles.memoTitle}>정보</Text>
        <InfoRow label="생성일" value={trip.createdAt?.slice(0, 10)} styles={styles} />
        <InfoRow label="최종 수정" value={trip.updatedAt?.slice(0, 10)} styles={styles} />
      </View>
    </View>
  );
}

function StatCard({ icon, label, value, styles }: {
  icon: string;
  label: string;
  value: any;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value, styles }: {
  label: string;
  value?: string | null;
  styles: ReturnType<typeof createStyles>;
}) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scrollContent: { paddingBottom: Spacing.huge },
  loading: { textAlign: 'center', padding: Spacing.huge, color: c.textSecondary },
  heroCard: {
    backgroundColor: c.primary,
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
  statusHint: {
    fontSize: Typography.labelSmall,
    color: 'rgba(250, 248, 243, 0.4)',
    marginLeft: 'auto',
  },
  heroTitle: {
    fontSize: Typography.headlineLarge,
    fontWeight: '700',
    color: c.textOnPrimary,
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
    color: c.accent,
    fontWeight: '600',
  },
  spentText: { color: 'rgba(250, 248, 243, 0.6)' },
  tabRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  tabBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 999,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  tabBtnActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  tabText: {
    fontSize: Typography.labelLarge,
    color: c.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: { color: c.textOnPrimary },
  content: { paddingHorizontal: Spacing.lg },
  overview: { gap: Spacing.lg },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statCard: {
    width: '48%',
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.soft,
  },
  statIcon: { fontSize: 28, marginBottom: Spacing.xs },
  statValue: {
    fontSize: Typography.displaySmall,
    fontWeight: '700',
    color: c.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: Typography.labelSmall,
    color: c.textSecondary,
  },
  memoCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: Spacing.lg,
    ...Shadows.soft,
  },
  memoTitle: {
    fontSize: Typography.labelMedium,
    fontWeight: '700',
    color: c.accent,
    marginBottom: Spacing.sm,
    letterSpacing: 1,
  },
  memoText: {
    fontSize: Typography.bodyMedium,
    color: c.textPrimary,
    lineHeight: Typography.bodyMedium * 1.6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  infoLabel: {
    fontSize: Typography.bodySmall,
    color: c.textSecondary,
  },
  infoValue: {
    fontSize: Typography.bodySmall,
    color: c.textPrimary,
    fontWeight: '500',
  },
});
}

