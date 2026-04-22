import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, FontSizes, Spacing, Radius } from '@/theme/theme';
import { Divider, EventRow, Empty } from '@/components/UI';
import { getAllEvents } from '@/db/events';
import type { Event } from '@/types';

export default function CalendarScreen() {
  const router = useRouter();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [selected, setSelected] = useState<number | null>(now.getDate());
  const [events, setEvents] = useState<Event[]>([]);

  const load = useCallback(async () => { setEvents(await getAllEvents()); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { cells, eventsByDay } = useMemo(() => buildMonthGrid(ym.y, ym.m, events), [ym, events]);
  const selectedDate = selected ? `${ym.y}-${String(ym.m).padStart(2, '0')}-${String(selected).padStart(2, '0')}` : null;
  const selectedEvents = selectedDate ? events.filter(e => e.date === selectedDate) : [];

  const changeMonth = (delta: number) => {
    const d = new Date(ym.y, ym.m - 1 + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() + 1 });
    setSelected(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>캘린더</Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Pressable onPress={() => { setYm({ y: now.getFullYear(), m: now.getMonth() + 1 }); setSelected(now.getDate()); }} hitSlop={8}>
            <Text style={{ fontSize: 15, color: Colors.primary, fontFamily: Fonts.semibold }}>오늘</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/event/new')} hitSlop={8}>
            <Text style={{ fontSize: 22 }}>＋</Text>
          </Pressable>
        </View>
      </View>
      <Divider />

      <View style={styles.monthHeader}>
        <Pressable onPress={() => changeMonth(-1)} hitSlop={10}>
          <Text style={{ fontSize: 18, color: Colors.textSub }}>‹</Text>
        </Pressable>
        <Text style={{ fontFamily: Fonts.bold, fontSize: FontSizes.h2 }}>
          {ym.y}.{String(ym.m).padStart(2, '0')}
        </Text>
        <Pressable onPress={() => changeMonth(1)} hitSlop={10}>
          <Text style={{ fontSize: 18, color: Colors.textSub }}>›</Text>
        </Pressable>
      </View>

      {/* Weekday header */}
      <View style={styles.weekdays}>
        {['일','월','화','수','목','금','토'].map((w, i) => (
          <Text key={w} style={[styles.weekdayLabel, i === 0 && { color: Colors.heart }, i === 6 && { color: Colors.primary }]}>
            {w}
          </Text>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {cells.map((c, i) => {
          const day = c.day;
          const dayEvents = day ? eventsByDay[day] ?? [] : [];
          const isSelected = !!(day && selected === day);
          const isToday = c.isToday;
          return (
            <Pressable
              key={i}
              disabled={!day}
              onPress={() => setSelected(day)}
              style={[styles.cell, isSelected && styles.cellSelected]}
            >
              {day && (
                <>
                  <Text style={[
                    styles.cellDay,
                    isToday && !isSelected && { color: Colors.primary, fontFamily: Fonts.bold },
                    isSelected && { color: '#fff', fontFamily: Fonts.bold },
                    c.weekday === 0 && !isSelected && { color: Colors.heart },
                  ]}>
                    {day}
                  </Text>
                  {dayEvents.length > 0 && (
                    <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
                      {dayEvents.slice(0, 3).map((_, idx) => (
                        <View key={idx} style={[styles.dot, isSelected && { backgroundColor: '#fff' }]} />
                      ))}
                    </View>
                  )}
                </>
              )}
            </Pressable>
          );
        })}
      </View>

      <Divider />

      <ScrollView contentContainerStyle={{ paddingVertical: Spacing.md, paddingBottom: 80 }}>
        {selected ? (
          selectedEvents.length === 0
            ? <Empty icon="🗓" title={`${ym.m}.${selected} 공연 없음`} subtitle="＋ 버튼으로 공연을 추가하세요" />
            : selectedEvents.map(ev => <EventRow key={ev.id} ev={ev} onPress={() => router.push(`/event/${ev.id}`)} />)
        ) : (
          <Empty icon="📅" title="날짜를 선택하세요" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function buildMonthGrid(y: number, m: number, events: Event[]) {
  const firstDay = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startWeekday = firstDay.getDay(); // 0=Sun
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m;

  const cells: { day: number | null; weekday: number; isToday: boolean }[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ day: null, weekday: i, isToday: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const wd = new Date(y, m - 1, d).getDay();
    cells.push({ day: d, weekday: wd, isToday: isCurrentMonth && today.getDate() === d });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, weekday: cells.length % 7, isToday: false });

  const eventsByDay: Record<number, Event[]> = {};
  const monthPrefix = `${y}-${String(m).padStart(2, '0')}-`;
  for (const ev of events) {
    if (ev.date?.startsWith(monthPrefix)) {
      const d = parseInt(ev.date.slice(-2), 10);
      (eventsByDay[d] = eventsByDay[d] ?? []).push(ev);
    }
  }
  return { cells, eventsByDay };
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: Spacing.lg, height: 48 },
  title: { fontSize: FontSizes.title, fontFamily: Fonts.semibold },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                 paddingVertical: Spacing.md, gap: 20 },
  weekdays: { flexDirection: 'row', paddingHorizontal: Spacing.sm },
  weekdayLabel: { flex: 1, textAlign: 'center', fontSize: FontSizes.tiny,
                  color: Colors.textSub, fontFamily: Fonts.medium, paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'flex-start',
          paddingTop: 8, borderRadius: Radius.sm },
  cellSelected: { backgroundColor: Colors.text },
  cellDay: { fontSize: FontSizes.body, fontFamily: Fonts.medium, color: Colors.text },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.heart },
});
