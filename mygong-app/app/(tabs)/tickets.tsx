import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, FontSizes, Spacing } from '@/theme/theme';
import { Chip, Empty, LabelCaps, Mono, Box, Placeholder, Stars } from '@/components/UI';
import { getAllTickets } from '@/db/tickets';
import type { Ticket } from '@/types';

const CATEGORIES = ['전체', '연극', '뮤지컬', '콘서트', '야구', '축구', '농구', '페스티벌'];

export default function TicketsScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState('전체');

  const load = useCallback(async () => {
    setTickets(await getAllTickets());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = filter === '전체' ? tickets : tickets.filter(t => t.category === filter);

  // 카테고리별 카운트
  const counts = useMemo(() => {
    const m: Record<string, number> = { '전체': tickets.length };
    for (const t of tickets) m[t.category] = (m[t.category] ?? 0) + 1;
    return m;
  }, [tickets]);

  // 월별 그룹
  const grouped = useMemo(() => {
    const g: Record<string, Ticket[]> = {};
    for (const t of filtered) {
      const key = (t.month || t.date.slice(0, 7)).replace('-', '.');
      (g[key] ||= []).push(t);
    }
    return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Text style={styles.title}>티켓함</Text>
        <Pressable onPress={() => router.push('/ticket/new')} hitSlop={8}>
          <Text style={styles.topIc}>＋</Text>
        </Pressable>
      </View>

      {/* 카테고리 칩 가로 스크롤 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0, maxHeight: 44 }}
                  contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 6, paddingVertical: Spacing.sm }}>
        {CATEGORIES.filter(c => c === '전체' || (counts[c] ?? 0) > 0).map(c => (
          <Chip key={c}
                label={`${c} ${counts[c] ?? 0}`}
                on={filter === c}
                onPress={() => setFilter(c)} />
        ))}
      </ScrollView>

      {tickets.length === 0 ? (
        <Empty icon="▦" title="아직 티켓이 없어요" subtitle="＋ 버튼으로 다녀온 공연을 기록해보세요" />
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={([m]) => m}
          renderItem={({ item: [month, list] }) => (
            <View style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.md }}>
              <LabelCaps>{month}</LabelCaps>
              {list.map(t => <TicketItem key={t.id} ticket={t} onPress={() => router.push(`/ticket/${t.id}`)} />)}
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 80 }}
          ListEmptyComponent={<Empty icon="·" title={`"${filter}" 결과 없음`} />}
        />
      )}
    </SafeAreaView>
  );
}

function TicketItem({ ticket, onPress }: { ticket: Ticket; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <Box style={styles.ticketBox}>
        <Placeholder w={44} h={44} />
        <View style={{ flex: 1, marginLeft: Spacing.md, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: FontSizes.body, fontFamily: Fonts.semibold, color: Colors.ink }}>
            {ticket.title}
          </Text>
          <Mono style={{ fontSize: FontSizes.tiny, color: Colors.ink3, marginTop: 2 }}>
            {formatDate(ticket.date)}{ticket.venue ? ` · ${ticket.venue}` : ''}
          </Mono>
          {ticket.rating > 0 && <Stars value={ticket.rating} size={11} />}
        </View>
        <Chip label={ticket.category} style={{ alignSelf: 'flex-start' }} />
      </Box>
    </Pressable>
  );
}

function formatDate(iso: string): string {
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})/);
  return m ? `${Number(m[1])}.${Number(m[2])}` : iso;
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
  ticketBox: {
    marginTop: 6, padding: 6,
    flexDirection: 'row', alignItems: 'center',
  },
});
