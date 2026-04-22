import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, FontSizes, Spacing } from '@/theme/theme';
import { Chip, Empty, LabelCaps, Mono } from '@/components/UI';
import { getAllNotifications, markAllRead } from '@/db/notifications';
import type { Notification } from '@/types';

export default function NotifScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'전체' | 'NEW' | '오늘'>('전체');

  const load = useCallback(async () => {
    setItems(await getAllNotifications());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = filter === 'NEW'
    ? items.filter(n => n.isNew)
    : filter === '오늘'
      ? items.filter(n => n.dateGroup === '오늘')
      : items;

  const counts = useMemo(() => ({
    전체: items.length,
    NEW: items.filter(n => n.isNew).length,
    오늘: items.filter(n => n.dateGroup === '오늘').length,
  }), [items]);

  const handleMarkAll = async () => {
    await markAllRead();
    await load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Text style={styles.title}>알림</Text>
        <Pressable onPress={handleMarkAll} hitSlop={8}>
          <Text style={styles.topIc}>✓</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0, maxHeight: 44 }}
                  contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 6, paddingVertical: Spacing.sm }}>
        <Chip label={`전체 ${counts.전체}`} on={filter === '전체'} onPress={() => setFilter('전체')} />
        <Chip label={`NEW ${counts.NEW}`}  on={filter === 'NEW'}  onPress={() => setFilter('NEW')} />
        <Chip label={`오늘 ${counts.오늘}`} on={filter === '오늘'} onPress={() => setFilter('오늘')} />
      </ScrollView>

      {items.length === 0 ? (
        <Empty icon="◔" title="알림이 없어요" subtitle="새 공연이 등록되면 여기에 표시됩니다" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={n => String(n.id)}
          renderItem={({ item }) => <NotifRow n={item} onPress={() => {
            if (item.eventId)  router.push(`/event/${item.eventId}`);
            else if (item.artistId) router.push(`/artist/${item.artistId}`);
            else if (item.ticketId) router.push(`/ticket/${item.ticketId}`);
          }} />}
          ListEmptyComponent={<Empty icon="·" title="결과 없음" />}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}
    </SafeAreaView>
  );
}

function NotifRow({ n, onPress }: { n: Notification; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}
               style={({ pressed }) => [styles.row, { backgroundColor: n.isNew ? Colors.fill3 : Colors.paper }, pressed && { opacity: 0.6 }]}>
      <Text style={styles.icon}>{n.icon ?? '◔'}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <LabelCaps>{`${n.kind}${n.isNew ? ' · NEW' : ''}`}</LabelCaps>
        <Text style={{ fontSize: FontSizes.caption, color: Colors.ink, marginTop: 2 }}>{n.title}</Text>
        {n.subtitle && (
          <Text numberOfLines={2} style={{ fontSize: FontSizes.tiny, color: Colors.ink3, marginTop: 2 }}>
            {n.subtitle}
          </Text>
        )}
        <Mono style={{ fontSize: 9, color: Colors.ink4, marginTop: 3 }}>
          {n.dateGroup ?? ''}
        </Mono>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.paper },
  topbar: {
    paddingHorizontal: Spacing.lg, height: 44,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: Colors.ink,
  },
  title: { fontFamily: Fonts.semibold, fontSize: FontSizes.subhead, color: Colors.ink },
  topIc: { fontSize: 18, color: Colors.ink2 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.lineSoft,
  },
  icon: { fontSize: 14, color: Colors.ink, marginTop: 2 },
});
