import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, FontSizes, Spacing } from '@/theme/theme';
import { Chip, Empty, LabelCaps, Mono, Box } from '@/components/UI';
import { getAllEvents } from '@/db/events';
import type { Event } from '@/types';

export default function CalendarScreen() {
  const router = useRouter();
  const today = new Date();
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() + 1 });
  const [selected, setSelected] = useState<number | null>(today.getDate());
  const [events, setEvents] = useState<Event[]>([]);

  const load = useCallback(async () => {
    const from = `${ym.y}-${String(ym.m).padStart(2, '0')}-01`;
    const to   = `${ym.y}-${String(ym.m).padStart(2, '0')}-31`;
    setEvents(await getAllEvents({ from, to }));
  }, [ym]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cells = useMemo(() => buildCells(ym.y, ym.m, today), [ym]);

  const eventsByDay: Record<number, Event[]> = {};
  for (const ev of events) {
    const d = Number(ev.date?.slice(8, 10));
    if (d) (eventsByDay[d] ||= []).push(ev);
  }

  const selectedEvents = selected ? (eventsByDay[selected] ?? []) : [];

  const prev = () => setYm(ym.m === 1 ? { y: ym.y - 1, m: 12 } : { y: ym.y, m: ym.m - 1 });
  const next = () => setYm(ym.m === 12 ? { y: ym.y + 1, m: 1 } : { y: ym.y, m: ym.m + 1 });
  const goToday = () => {
    setYm({ y: today.getFullYear(), m: today.getMonth() + 1 });
    setSelected(today.getDate());
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Text style={styles.title}>일정</Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Pressable onPress={() => router.push('/event/new')} hitSlop={8}>
            <Text style={styles.topIc}>＋</Text>
          </Pressable>
        </View>
      </View>

      {/* 월 네비 */}
      <View style={styles.monthBar}>
        <Pressable onPress={prev} hitSlop={8}><Text style={styles.navArrow}>◂</Text></Pressable>
        <Mono style={styles.monthText}>{ym.y}.{String(ym.m).padStart(2, '0')}</Mono>
        <Pressable onPress={next} hitSlop={8}><Text style={styles.navArrow}>▸</Text></Pressable>
        <View style={{ flex: 1 }} />
        <Chip label="오늘" onPress={goToday} />
      </View>

      {/* 요일 헤더 */}
      <View style={styles.weekHeader}>
        {['일','월','화','수','목','금','토'].map(d => (
          <Mono key={d} style={styles.weekday}>{d}</Mono>
        ))}
      </View>

      {/* 캘린더 그리드 */}
      <View style={styles.grid}>
        {cells.map((c, i) => {
          const day = c.day;
          const dayEvents = day ? eventsByDay[day] ?? [] : [];
          const isSelected = !!(day && selected === day);
          const isToday = c.isToday;
          return (
            <Pressable key={i} disabled={!day} onPress={() => setSelected(day)}
                       style={[styles.cell, isSelected && { backgroundColor: Colors.fill }]}>
              {day ? (
                <>
                  <Mono style={[
                    styles.cellDay,
                    isToday && { fontWeight: '700', color: Colors.ink },
                    c.weekday === 0 && !isToday && { color: Colors.ink3 },
                  ]}>
                    {day}
                  </Mono>
                  {dayEvents.length > 0 && (
                    <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
                      {dayEvents.slice(0, 3).map((_, idx) => (
                        <View key={idx} style={styles.dot} />
                      ))}
                    </View>
                  )}
                </>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* 선택일 이벤트 목록 */}
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 80 }}>
        {selected && (
          <>
            <LabelCaps>
              {ym.m}.{selected} {['일','월','화','수','목','금','토'][new Date(ym.y, ym.m - 1, selected).getDay()]}
            </LabelCaps>
            {selectedEvents.length === 0 ? (
              <Text style={{ fontSize: FontSizes.caption, color: Colors.ink3, marginTop: 8 }}>
                공연 없음
              </Text>
            ) : (
              selectedEvents.map(ev => (
                <Pressable key={ev.id} onPress={() => router.push(`/event/${ev.id}`)}
                           style={({ pressed }) => pressed && { opacity: 0.6 }}>
                  <Box style={{ marginTop: 6, padding: 10 }}>
                    <Text style={{ fontSize: 12, fontFamily: Fonts.semibold, color: Colors.ink }}>{ev.title}</Text>
                    <Text style={{ fontSize: 10, color: Colors.ink3, marginTop: 2 }}>
                      {ev.time ?? ''} {ev.venue ?? ''}
                    </Text>
                  </Box>
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type Cell = { day: number | null; weekday: number; isToday: boolean };
function buildCells(y: number, m: number, today: Date): Cell[] {
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0).getDate();
  const startWeekday = first.getDay();
  const cells: Cell[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ day: null, weekday: i, isToday: false });
  for (let d = 1; d <= last; d++) {
    cells.push({
      day: d,
      weekday: (startWeekday + d - 1) % 7,
      isToday: today.getFullYear() === y && today.getMonth() + 1 === m && today.getDate() === d,
    });
  }
  // 6줄 고정
  while (cells.length < 42) cells.push({ day: null, weekday: cells.length % 7, isToday: false });
  return cells;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.paper },
  topbar: {
    paddingHorizontal: Spacing.lg, height: 44,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: Colors.ink,
  },
  title: { fontFamily: Fonts.semibold, fontSize: FontSizes.subhead, color: Colors.ink },
  topIc: { fontSize: 20, color: Colors.ink },

  monthBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  navArrow: { fontSize: 20, color: Colors.ink2, paddingHorizontal: 4 },
  monthText: { fontSize: 15, color: Colors.ink, fontWeight: '600' },

  weekHeader: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingBottom: 4,
  },
  weekday: { flex: 1, textAlign: 'center', fontSize: 10, color: Colors.ink3 },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
  },
  cell: {
    width: `${100 / 7}%`, aspectRatio: 1,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.lineSoft,
    padding: 2,
    justifyContent: 'flex-start',
  },
  cellDay: { fontSize: 10, color: Colors.ink, fontWeight: '500' },
  dot: { width: 4, height: 4, backgroundColor: Colors.ink },
});
