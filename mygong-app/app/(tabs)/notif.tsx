import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, FontSizes, Spacing, Radius } from '@/theme/theme';
import { Divider, Empty } from '@/components/UI';
import { getAllNotifications, markAsRead, markAllRead, clearAll } from '@/db/notifications';
import type { Notification } from '@/types';

export default function NotifScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);

  const load = useCallback(async () => setItems(await getAllNotifications()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleTap = async (n: Notification) => {
    if (n.isNew) await markAsRead(n.id);
    if (n.eventId) router.push(`/event/${n.eventId}`);
    else if (n.artistId) router.push(`/artist/${n.artistId}`);
    else if (n.ticketId) router.push(`/ticket/${n.ticketId}`);
    await load();
  };

  const handleMarkAll = async () => { await markAllRead(); await load(); };
  const handleClear = () => {
    Alert.alert('알림 전체 삭제', '되돌릴 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { await clearAll(); await load(); } },
    ]);
  };

  const groups = group(items);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>알림</Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Pressable onPress={handleMarkAll} hitSlop={8}>
            <Text style={{ fontSize: 14, color: Colors.primary, fontFamily: Fonts.semibold }}>모두 읽음</Text>
          </Pressable>
          <Pressable onPress={handleClear} hitSlop={8}>
            <Text style={{ fontSize: 14, color: Colors.heart, fontFamily: Fonts.semibold }}>비우기</Text>
          </Pressable>
        </View>
      </View>
      <Divider />

      {items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Empty icon="🔔" title="알림이 없어요" subtitle="공연 D-day 임박 · 새로운 공연 등록 시 여기 쌓입니다" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
          {groups.map(g => (
            <View key={g.label}>
              <Text style={styles.groupLabel}>{g.label}</Text>
              {g.items.map(n => (
                <Pressable key={n.id} onPress={() => handleTap(n)} style={({ pressed }) => [
                  styles.row, n.isNew && styles.rowNew, pressed && { opacity: 0.8 },
                ]}>
                  <Text style={{ fontSize: 24 }}>{n.icon ?? '🔔'}</Text>
                  <View style={{ flex: 1, marginHorizontal: Spacing.md, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontFamily: Fonts.semibold, fontSize: FontSizes.body }}>
                      {n.title}
                      {n.isNew && <Text style={{ color: Colors.badge }}> ●</Text>}
                    </Text>
                    {n.subtitle && (
                      <Text numberOfLines={1} style={{ fontSize: FontSizes.caption, color: Colors.textSub, marginTop: 2 }}>
                        {n.subtitle}
                      </Text>
                    )}
                    <Text style={{ fontSize: FontSizes.tiny, color: Colors.textFaint, marginTop: 2 }}>
                      {timeAgo(n.createdAt)}
                    </Text>
                  </View>
                  {(n.eventId || n.artistId || n.ticketId) && (
                    <Text style={{ fontSize: 16, color: Colors.textFaint }}>›</Text>
                  )}
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function group(items: Notification[]) {
  const out: { label: string; items: Notification[] }[] = [];
  const order = ['오늘', '어제', '이번주', '이전', '오래전'];
  for (const label of order) {
    const arr = items.filter(i => i.dateGroup === label);
    if (arr.length > 0) out.push({ label, items: arr });
  }
  return out;
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.round(hours / 24);
  return `${days}일 전`;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: Spacing.lg, height: 48 },
  title: { fontSize: FontSizes.title, fontFamily: Fonts.semibold },
  groupLabel: { fontSize: FontSizes.caption, color: Colors.textSub, fontFamily: Fonts.semibold,
                paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg,
         borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider },
  rowNew: { backgroundColor: '#fffaf0' },
});
