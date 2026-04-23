import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, FontSizes, Spacing } from '@/theme/theme';
import { Avatar, EventRow, Empty, Divider } from '@/components/UI';
import { getAllArtists } from '@/db/artists';
import { getAllEvents, getWishlistedEvents } from '@/db/events';
import { getAllTickets } from '@/db/tickets';
import { syncStaleArtists } from '@/services/syncManager';
import type { Artist, Event, Ticket } from '@/types';

export default function HomeScreen() {
  const router = useRouter();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [wishlist, setWishlist] = useState<Event[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [a, e, t, w] = await Promise.all([
      getAllArtists('following'),
      getAllEvents({ upcoming: true }),
      getAllTickets(),
      getWishlistedEvents(5),
    ]);
    setArtists(a);
    setEvents(e);
    setTickets(t.slice(0, 5));
    setWishlist(w);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await syncStaleArtists(0);
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const soon = events.filter(e => daysUntil(e.date) <= 7 && daysUntil(e.date) >= 0).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      {/* Header — IG logo style */}
      <View style={styles.header}>
        <Text style={styles.brand}>내공연</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Pressable onPress={() => router.push('/search')} hitSlop={8}>
            <Text style={styles.headerIcon}>🔍</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
            <Text style={styles.headerIcon}>⚙️</Text>
          </Pressable>
        </View>
      </View>
      <Divider />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 80 }}
      >
        {/* Story-ring row */}
        <View style={styles.storyRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 14 }}>
            <Pressable style={styles.storyItem} onPress={() => router.push('/search')}>
              <View style={styles.addCircle}><Text style={{ fontSize: 28, color: Colors.textSub }}>＋</Text></View>
              <Text numberOfLines={1} style={styles.storyName}>추가</Text>
            </Pressable>

            {artists.map(a => (
              <Pressable key={a.id} style={styles.storyItem} onPress={() => router.push(`/artist/${a.id}`)}>
                <Avatar artist={a} size={62} ring />
                <Text numberOfLines={1} style={styles.storyName}>{a.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <Divider />

        {/* This week summary */}
        <View style={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg }}>
          <Text style={{ fontSize: FontSizes.h1, fontFamily: Fonts.bold, color: Colors.text }}>
            이번주 공연 <Text style={{ color: Colors.heart }}>{soon}개</Text>
          </Text>
          <Text style={{ fontSize: FontSizes.caption, color: Colors.textSub, marginTop: 4 }}>
            팔로잉 {artists.length}명 · 다가오는 공연 {events.length}개 · 기록한 공연 {tickets.length}개
          </Text>
        </View>

        {/* v2: 리포트·뱃지 바로가기 */}
        <View style={styles.quickRow}>
          <Pressable style={styles.quickCard} onPress={() => router.push('/report')}>
            <Text style={styles.quickIcon}>📊</Text>
            <Text style={styles.quickTitle}>관극 리포트</Text>
            <Text style={styles.quickSub}>나의 공연 통계</Text>
          </Pressable>
          <Pressable style={styles.quickCard} onPress={() => router.push('/badges')}>
            <Text style={styles.quickIcon}>🏆</Text>
            <Text style={styles.quickTitle}>내 뱃지</Text>
            <Text style={styles.quickSub}>업적 확인하기</Text>
          </Pressable>
        </View>

        {/* v2: 위시리스트 */}
        {wishlist.length > 0 && (
          <>
            <SectionTitle
              label={`💖 위시리스트 ${wishlist.length}건`}
              more={wishlist.length >= 5 ? () => router.push('/calendar') : undefined}
            />
            {wishlist.map(ev => (
              <EventRow key={ev.id} ev={ev} onPress={() => router.push(`/event/${ev.id}`)} />
            ))}
          </>
        )}

        {/* Upcoming events feed */}
        <SectionTitle label="다가오는 공연" more={events.length > 5 ? () => router.push('/calendar') : undefined} />
        {events.length === 0
          ? <Empty icon="🎫" title="다가오는 공연이 없어요" subtitle="아티스트를 추가하거나 직접 공연을 등록해 보세요" />
          : events.slice(0, 5).map(ev => <EventRow key={ev.id} ev={ev} onPress={() => router.push(`/event/${ev.id}`)} />)
        }

        {tickets.length > 0 && (
          <>
            <SectionTitle label="최근 다녀온 공연" more={() => router.push('/tickets')} />
            {tickets.map(t => (
              <Pressable key={t.id} onPress={() => router.push(`/ticket/${t.id}`)} style={styles.ticketCard}>
                <Text numberOfLines={1} style={{ fontFamily: Fonts.semibold }}>
                  {t.catIcon ?? '🎟️'} {t.title}
                </Text>
                <Text style={{ fontSize: FontSizes.tiny, color: Colors.textSub, marginTop: 2 }}>
                  {t.date} · {t.venue ?? ''}
                </Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ label, more }: { label: string; more?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                   paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm }}>
      <Text style={{ fontSize: FontSizes.title, fontFamily: Fonts.semibold }}>{label}</Text>
      {more && <Pressable onPress={more}><Text style={{ color: Colors.primary, fontFamily: Fonts.medium }}>모두 보기</Text></Pressable>}
    </View>
  );
}

function daysUntil(date: string): number {
  const d = new Date(date);
  if (isNaN(d.getTime())) return -9999;
  const n = new Date(); n.setHours(0,0,0,0); d.setHours(0,0,0,0);
  return Math.round((d.getTime() - n.getTime()) / 86400000);
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, height: 48,
  },
  brand: { fontSize: 26, fontFamily: Fonts.brand, color: Colors.text },
  headerIcon: { fontSize: 22 },
  storyRow: { paddingVertical: Spacing.md },
  storyItem: { alignItems: 'center', width: 70, gap: 4 },
  storyName: { fontSize: FontSizes.tiny, color: Colors.text, maxWidth: 66, fontFamily: Fonts.medium },
  addCircle: {
    width: 62, height: 62, borderRadius: 31,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  ticketCard: {
    paddingHorizontal: Spacing.lg, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.divider,
  },

  // v2: quick access cards (report + badges)
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  quickCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: Colors.bgMuted,
    borderRadius: 12,
  },
  quickIcon: { fontSize: 28, marginBottom: 4 },
  quickTitle: {
    fontSize: FontSizes.body,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  },
  quickSub: {
    fontSize: FontSizes.tiny,
    color: Colors.textSub,
    marginTop: 2,
  },
});
