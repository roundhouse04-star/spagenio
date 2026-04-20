import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, FontSizes, Spacing, Radius } from '@/theme/theme';
import { Avatar, EventRow, TicketRow, Empty, Divider, PrimaryButton, SecondaryButton } from '@/components/UI';
import { getArtistById, toggleFollowing, updateArtist, deleteArtist } from '@/db/artists';
import { getUpcomingEventsForArtist } from '@/db/events';
import { getTicketsByArtist } from '@/db/tickets';
import { getSyncState } from '@/db/sync-state';
import { syncOneArtist } from '@/services/syncManager';
import type { Artist, Event, Ticket, ArtistSyncState } from '@/types';

export default function ArtistDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const artistId = Number(id);

  const [artist, setArtist] = useState<Artist | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [syncState, setSyncStateObj] = useState<ArtistSyncState | null>(null);
  const [tab, setTab] = useState<'upcoming' | 'past' | 'info'>('upcoming');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [a, e, t, s] = await Promise.all([
      getArtistById(artistId),
      getUpcomingEventsForArtist(artistId, 20),
      getTicketsByArtist(artistId),
      getSyncState(artistId),
    ]);
    setArtist(a); setEvents(e); setTickets(t); setSyncStateObj(s);
  }, [artistId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!artist) return <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></SafeAreaView>;

  const onRefresh = async () => {
    setRefreshing(true);
    try { await syncOneArtist(artistId); await load(); } finally { setRefreshing(false); }
  };

  const toggleFollow = async () => { await toggleFollowing(artistId); await load(); };
  const toggleNotify = async () => { await updateArtist(artistId, { notifyEnabled: !artist.notifyEnabled }); await load(); };

  const onDelete = () => {
    Alert.alert('아티스트 삭제', `"${artist.name}"의 관련 공연·티켓·알림도 모두 삭제됩니다.`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { await deleteArtist(artistId); router.back(); } },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={{ fontSize: 22 }}>‹</Text></Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>{artist.name}</Text>
        <Pressable onPress={onDelete} hitSlop={8}><Text style={{ fontSize: 18 }}>⋯</Text></Pressable>
      </View>
      <Divider />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Profile header — IG style */}
        <View style={styles.profileHead}>
          <Avatar artist={artist} size={96} ring={artist.isFollowing} />
          <View style={{ flex: 1, marginLeft: Spacing.xl }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <Stat n={events.length} label="공연" />
              <Stat n={tickets.length} label="관람" />
              <Stat n={syncState?.eventsFound ?? 0} label="동기화" />
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.sm }}>
          <Text style={{ fontFamily: Fonts.bold, fontSize: FontSizes.bodyLg }}>{artist.name}</Text>
          {artist.role && <Text style={{ fontSize: FontSizes.caption, color: Colors.textSub, marginTop: 2 }}>{artist.role}</Text>}
          {artist.bio && <Text numberOfLines={3} style={{ fontSize: FontSizes.caption, color: Colors.text, marginTop: 8, lineHeight: 18 }}>{artist.bio}</Text>}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, padding: Spacing.lg }}>
          {artist.isFollowing
            ? <SecondaryButton title="팔로잉" onPress={toggleFollow} style={{ flex: 1 }} />
            : <PrimaryButton title="팔로우" onPress={toggleFollow} style={{ flex: 1 }} />}
          <SecondaryButton title={artist.notifyEnabled ? '🔔 알림 ON' : '🔕 알림 OFF'} onPress={toggleNotify} style={{ flex: 1 }} />
        </View>

        <Divider />

        {/* Tabs */}
        <View style={styles.tabs}>
          {[
            { k: 'upcoming', label: `다가오는 ${events.length}` },
            { k: 'past',     label: `다녀온 ${tickets.length}` },
            { k: 'info',     label: '정보' },
          ].map(t => (
            <Pressable key={t.k} onPress={() => setTab(t.k as any)} style={[styles.tab, tab === t.k && styles.tabActive]}>
              <Text style={{ fontFamily: tab === t.k ? Fonts.bold : Fonts.medium, color: tab === t.k ? Colors.text : Colors.textSub }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'upcoming' && (events.length === 0
          ? <Empty icon="🎫" title="다가오는 공연 없음" subtitle="캘린더에서 ＋ 버튼으로 추가하거나 동기화를 시도하세요" />
          : events.map(e => <EventRow key={e.id} ev={e} onPress={() => router.push(`/event/${e.id}`)} />))}

        {tab === 'past' && (tickets.length === 0
          ? <Empty icon="📖" title="아직 관람 기록 없음" />
          : tickets.map(t => <TicketRow key={t.id} t={t} onPress={() => router.push(`/ticket/${t.id}`)} />))}

        {tab === 'info' && (
          <View style={{ padding: Spacing.lg }}>
            <InfoRow label="ID" value={String(artist.id)} />
            <InfoRow label="외부 ID" value={artist.externalId ?? '-'} />
            <InfoRow label="마지막 동기화" value={artist.lastSyncedAt ? new Date(artist.lastSyncedAt).toLocaleString('ko-KR') : '-'} />
            <InfoRow label="등록일" value={new Date(artist.createdAt).toLocaleDateString('ko-KR')} />
            {syncState?.lastFetchError && (
              <Text style={{ fontSize: FontSizes.tiny, color: Colors.heart, marginTop: 12 }}>
                최근 동기화 오류: {syncState.lastFetchError}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontFamily: Fonts.bold, fontSize: FontSizes.h2 }}>{n}</Text>
      <Text style={{ fontSize: FontSizes.tiny, color: Colors.textSub, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider }}>
      <Text style={{ width: 100, fontSize: FontSizes.caption, color: Colors.textSub }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: FontSizes.caption, color: Colors.text }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: Spacing.lg, height: 48 },
  navTitle: { flex: 1, textAlign: 'center', fontFamily: Fonts.semibold, fontSize: FontSizes.title },
  profileHead: { flexDirection: 'row', padding: Spacing.lg, alignItems: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.text },
});
