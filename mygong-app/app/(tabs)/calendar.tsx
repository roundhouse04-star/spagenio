import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, FontSizes, Spacing, Radius, chipBg } from '@/theme/theme';
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

  const { cells, eventsByDay, monthEvents } = useMemo(
    () => buildMonthGrid(ym.y, ym.m, events),
    [ym, events]
  );
  const selectedDate = selected
    ? `${ym.y}-${String(ym.m).padStart(2, '0')}-${String(selected).padStart(2, '0')}`
    : null;
  const selectedEvents = selectedDate ? events.filter(e => e.date === selectedDate) : [];

  const changeMonth = (delta: number) => {
    const d = new Date(ym.y, ym.m - 1 + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() + 1 });
    setSelected(null);
  };

  const goToday = () => {
    setYm({ y: now.getFullYear(), m: now.getMonth() + 1 });
    setSelected(now.getDate());
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>캘린더</Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Pressable onPress={goToday} hitSlop={8}>
            <Text style={{ fontSize: 15, color: Colors.primary, fontFamily: Fonts.semibold }}>오늘</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/event/new')} hitSlop={8}>
            <Text style={{ fontSize: 22 }}>＋</Text>
          </Pressable>
        </View>
      </View>
      <Divider />

      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        {/* ─── 월 헤더 ─────────────────────────── */}
        <View style={styles.monthHeader}>
          <Pressable onPress={() => changeMonth(-1)} hitSlop={10} style={styles.monthNav}>
            <Text style={styles.monthNavIcon}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>
            {ym.y}.{String(ym.m).padStart(2, '0')}
          </Text>
          <Pressable onPress={() => changeMonth(1)} hitSlop={10} style={styles.monthNav}>
            <Text style={styles.monthNavIcon}>›</Text>
          </Pressable>
        </View>

        {/* ─── 요일 ────────────────────────────── */}
        <View style={styles.weekdays}>
          {['일','월','화','수','목','금','토'].map((w, i) => (
            <Text key={w} style={[
              styles.weekdayLabel,
              i === 0 && { color: Colors.heart },
              i === 6 && { color: Colors.primary },
            ]}>
              {w}
            </Text>
          ))}
        </View>

        {/* ─── 그리드 (큰 셀) ───────────────────── */}
        <View style={styles.grid}>
          {cells.map((c, i) => {
            const day = c.day;
            const dayEvents = day ? eventsByDay[day] ?? [] : [];
            const isSelected = !!(day && selected === day);
            const isToday = c.isToday;
            const hasWishlist = dayEvents.some(ev => ev.isWishlisted);  // v2
            return (
              <Pressable
                key={i}
                disabled={!day}
                onPress={() => setSelected(day)}
                style={styles.cell}
              >
                {day && (
                  <>
                    <View style={styles.dayWrap}>
                      <View style={[
                        styles.dayNumberWrap,
                        isSelected && styles.dayNumberSelected,
                        isToday && !isSelected && styles.dayNumberToday,
                      ]}>
                        <Text style={[
                          styles.cellDay,
                          c.weekday === 0 && !isSelected && !isToday && { color: Colors.heart },
                          c.weekday === 6 && !isSelected && !isToday && { color: Colors.primary },
                          isToday && !isSelected && { color: Colors.primary, fontFamily: Fonts.bold },
                          isSelected && { color: '#fff', fontFamily: Fonts.bold },
                        ]}>
                          {day}
                        </Text>
                      </View>
                      {hasWishlist && <Text style={styles.wishMarker}>💖</Text>}
                    </View>
                    {dayEvents.length > 0 && (
                      <View style={styles.dotsRow}>
                        {dayEvents.slice(0, 3).map((ev, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.dot,
                              { backgroundColor: dotColor(ev.category) },
                            ]}
                          />
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

        {/* ─── 선택한 날 이벤트 ───────────────── */}
        {selected && selectedEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {ym.m}.{selected} · {selectedEvents.length}건
            </Text>
            {selectedEvents.map(ev => (
              <EventRow key={ev.id} ev={ev} onPress={() => router.push(`/event/${ev.id}`)} />
            ))}
          </View>
        )}

        {/* ─── 월 전체 공연 리스트 ───────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            📅 {ym.m}월 전체 공연 ({monthEvents.length}건)
          </Text>

          {monthEvents.length === 0 ? (
            <Empty
              icon="🗓"
              title={`${ym.m}월 공연 없음`}
              subtitle="＋ 버튼으로 공연을 추가하세요"
            />
          ) : (
            monthEvents.map(ev => (
              <EventRow key={ev.id} ev={ev} onPress={() => router.push(`/event/${ev.id}`)} />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** 카테고리별 점 색상 */
function dotColor(category?: string): string {
  switch (category) {
    case '콘서트':   return '#ff6b9d';   // 핑크
    case '뮤지컬':   return '#9b8aff';   // 보라
    case '연극':     return '#ffb547';   // 주황
    case '팬미팅':   return '#ff8aa3';   // 연핑크
    case '페스티벌': return '#ffa040';   // 진한 주황
    case '전시':     return '#5ab4f5';   // 파랑
    default:         return Colors.heart;
  }
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

  // 일별 이벤트 + 월 전체 (날짜순)
  const eventsByDay: Record<number, Event[]> = {};
  const monthEvents: Event[] = [];
  const monthPrefix = `${y}-${String(m).padStart(2, '0')}-`;
  for (const ev of events) {
    if (ev.date?.startsWith(monthPrefix)) {
      const d = parseInt(ev.date.slice(-2), 10);
      (eventsByDay[d] = eventsByDay[d] ?? []).push(ev);
      monthEvents.push(ev);
    }
  }
  monthEvents.sort((a, b) => a.date.localeCompare(b.date));

  return { cells, eventsByDay, monthEvents };
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    height: 48,
  },
  title: { fontSize: FontSizes.title, fontFamily: Fonts.semibold },

  // 월 헤더 — 더 큼직하게
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 24,
  },
  monthNav: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavIcon: {
    fontSize: 22,
    color: Colors.textSub,
  },
  monthTitle: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    color: Colors.text,
  },

  // 요일
  weekdays: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingBottom: 4,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSizes.tiny,
    color: Colors.textSub,
    fontFamily: Fonts.semibold,
    paddingVertical: 8,
  },

  // 그리드 — 더 큰 셀
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 6,
    paddingBottom: 12,
  },
  cell: {
    width: '14.28%',
    height: 56,                // aspectRatio 대신 명시 높이로 더 크게
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 6,
  },
  dayNumberWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wishMarker: {
    position: 'absolute',
    top: -3,
    right: -4,
    fontSize: 10,
  },
  dayNumberSelected: {
    backgroundColor: Colors.text,
  },
  dayNumberToday: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',  // 옅은 파랑
  },
  cellDay: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },

  // 점 (이벤트 표시)
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  // 섹션
  section: {
    paddingTop: Spacing.md,
  },
  sectionLabel: {
    fontSize: FontSizes.caption,
    fontFamily: Fonts.semibold,
    color: Colors.textSub,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
});
