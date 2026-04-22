import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Image } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, FontSizes, Spacing } from '@/theme/theme';
import { LabelCaps, Mono, Chip, Box, Placeholder, Avatar, Divider } from '@/components/UI';
import { getAllArtists } from '@/db/artists';
import { getAllEvents } from '@/db/events';
import type { Artist, Event } from '@/types';

export default function HomeScreen() {
  const router = useRouter();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const load = useCallback(async () => {
    const [a, e] = await Promise.all([
      getAllArtists('following'),
      getAllEvents({ upcoming: true }),
    ]);
    setArtists(a);
    setEvents(e);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const thisWeekCount = events.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date);
    const n = new Date();
    const diff = (d.getTime() - n.getTime()) / 86400000;
    return diff >= 0 && diff <= 7;
  }).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topbar}>
        <Text style={styles.title}>내공연관리</Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Pressable onPress={() => router.push('/search')} hitSlop={8}>
            <Text style={styles.topIc}>⌕</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
            <Text style={styles.topIc}>⋯</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 80 }}>
        {/* GREETING */}
        <LabelCaps>GREETING</LabelCaps>
        <Text style={styles.greeting}>
          이번주 공연 <Mono style={styles.greetingNum}>{thisWeekCount}</Mono>개
        </Text>

        {/* MY ARTISTS */}
        <LabelCaps style={{ marginTop: Spacing.xl }}>MY ARTISTS</LabelCaps>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    style={{ marginTop: 6 }}
                    contentContainerStyle={{ gap: 10, paddingRight: 10 }}>
          {artists.slice(0, 10).map(a => (
            <Pressable key={a.id} onPress={() => router.push(`/artist/${a.id}`)}
                       style={({ pressed }) => [styles.artistItem, pressed && { opacity: 0.6 }]}>
              <Avatar artist={a} size={44} />
              <Text numberOfLines={1} style={styles.artistName}>{a.name}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => router.push('/search')}
                     style={({ pressed }) => [styles.artistItem, pressed && { opacity: 0.6 }]}>
            <View style={styles.addCircle}>
              <Text style={{ fontSize: 20, color: Colors.ink }}>＋</Text>
            </View>
            <Text style={styles.artistName}>추가</Text>
          </Pressable>
        </ScrollView>

        {/* UPCOMING */}
        <LabelCaps style={{ marginTop: Spacing.xl }}>UPCOMING · {events.length}</LabelCaps>
        {events.length === 0 ? (
          <Box style={{ padding: Spacing.lg, marginTop: 6 }} soft>
            <Text style={{ fontSize: FontSizes.caption, color: Colors.ink3 }}>다가오는 공연이 없어요</Text>
          </Box>
        ) : (
          events.slice(0, 8).map(ev => <UpcomingRow key={ev.id} ev={ev} onPress={() => router.push(`/event/${ev.id}`)} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function UpcomingRow({ ev, onPress }: { ev: Event; onPress: () => void }) {
  const dday = daysUntil(ev.date);
  const ddayLabel = dday === 0 ? 'D-DAY' : dday > 0 ? `D-${dday}` : `D+${-dday}`;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <Box style={{ marginTop: 6, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Mono style={{ fontSize: 12, fontWeight: '600', minWidth: 48, color: Colors.ink }}>{ddayLabel}</Mono>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: Fonts.semibold, color: Colors.ink }}>{ev.title}</Text>
          {ev.venue && <Text numberOfLines={1} style={{ fontSize: 10, color: Colors.ink3, marginTop: 2 }}>{ev.venue}</Text>}
        </View>
        {ev.category && <Chip label={ev.category} />}
      </Box>
    </Pressable>
  );
}

function daysUntil(date?: string): number {
  if (!date) return -9999;
  const d = new Date(date);
  if (isNaN(d.getTime())) return -9999;
  const n = new Date(); n.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - n.getTime()) / 86400000);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.paper },
  topbar: {
    paddingHorizontal: Spacing.lg, height: 44,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: Colors.ink,
  },
  title: { fontFamily: Fonts.semibold, fontSize: FontSizes.subhead, color: Colors.ink },
  topIc: { fontSize: 16, color: Colors.ink3 },
  greeting: { fontSize: FontSizes.title, fontFamily: Fonts.semibold, color: Colors.ink, marginTop: 4 },
  greetingNum: { fontWeight: '600', color: Colors.ink },
  artistItem: { width: 52, alignItems: 'center' },
  artistName: { fontSize: 10, color: Colors.ink3, marginTop: 4, fontFamily: Fonts.regular },
  addCircle: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.ink, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.paper,
  },
});
