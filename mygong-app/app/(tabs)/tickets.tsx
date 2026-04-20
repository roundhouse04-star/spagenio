import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, FontSizes, Spacing, Radius, chipBg } from '@/theme/theme';
import { TicketRow, Empty, Divider } from '@/components/UI';
import { getAllTickets, getTicketStats } from '@/db/tickets';
import { CATEGORIES } from '@/db/schema';
import type { Ticket } from '@/types';

const FILTERS = [{ key: 'all', label: '전체' }, ...CATEGORIES.map(c => ({ key: c.value, label: c.value }))];

export default function TicketsScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState<any>({ total: 0, avgRating: 0, thisYear: 0 });

  const load = useCallback(async () => {
    setTickets(await getAllTickets());
    setStats(await getTicketStats());
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(
    () => filter === 'all' ? tickets : tickets.filter(t => t.category === filter),
    [tickets, filter]
  );

  const byMonth = useMemo(() => {
    const m = new Map<string, Ticket[]>();
    for (const t of filtered) {
      const key = t.month || t.date.slice(0, 7);
      (m.get(key) ?? m.set(key, []).get(key)!).push(t);
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>티켓 컬렉션</Text>
        <Pressable onPress={() => router.push('/ticket/new')} hitSlop={8}>
          <Text style={{ fontSize: 22 }}>＋</Text>
        </Pressable>
      </View>
      <Divider />

      {/* Stats banner */}
      <View style={styles.stats}>
        <Stat label="다녀온 공연" value={String(stats.total)} />
        <View style={styles.statDivider} />
        <Stat label="올해" value={String(stats.thisYear)} />
        <View style={styles.statDivider} />
        <Stat label="평균 별점" value={stats.avgRating ? Number(stats.avgRating).toFixed(1) : '-'} />
      </View>
      <Divider />

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {FILTERS.map(f => {
          const active = filter === f.key;
          const count = f.key === 'all' ? tickets.length : tickets.filter(t => t.category === f.key).length;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, { backgroundColor: active ? Colors.text : chipBg(f.key === 'all' ? undefined : f.key) }]}
            >
              <Text style={{
                fontSize: FontSizes.caption,
                fontFamily: active ? Fonts.semibold : Fonts.medium,
                color: active ? '#fff' : Colors.text,
              }}>
                {f.label} {count > 0 && `· ${count}`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Divider />

      {tickets.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Empty icon="🎟️" title="아직 티켓이 없어요" subtitle="다녀온 공연을 기록해 보세요" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingVertical: Spacing.sm, paddingBottom: 80 }}>
          {byMonth.map(([month, items]) => (
            <View key={month}>
              <Text style={styles.monthLabel}>{month}</Text>
              {items.map(t => (
                <TicketRow key={t.id} t={t} onPress={() => router.push(`/ticket/${t.id}`)} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: FontSizes.h2, fontFamily: Fonts.bold }}>{value}</Text>
      <Text style={{ fontSize: FontSizes.tiny, color: Colors.textSub, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: Spacing.lg, height: 48 },
  title: { fontSize: FontSizes.title, fontFamily: Fonts.semibold },
  stats: { flexDirection: 'row', paddingVertical: Spacing.lg },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.divider, marginVertical: Spacing.sm },
  chips: { paddingHorizontal: Spacing.lg, paddingVertical: 10, gap: 8, alignItems: 'center' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill },
  monthLabel: {
    fontSize: FontSizes.caption, fontFamily: Fonts.semibold, color: Colors.textSub,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 4,
  },
});
