import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, TextInput } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, FontSizes, Spacing } from '@/theme/theme';
import { Avatar, Empty, Divider, PrimaryButton, LabelCaps, Chip } from '@/components/UI';
import { getAllArtists } from '@/db/artists';
import type { Artist } from '@/types';

export default function ArtistsScreen() {
  const router = useRouter();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setArtists(await getAllArtists('all'));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = q
    ? artists.filter(a =>
        a.name.includes(q) ||
        (a.role ?? '').includes(q) ||
        (a.tag ?? '').includes(q))
    : artists;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Text style={styles.title}>내 아티스트</Text>
        <Pressable onPress={() => router.push('/search')} hitSlop={8}>
          <Text style={styles.topIc}>＋</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIc}>⌕</Text>
          <TextInput
            placeholder="이름·역할로 찾기"
            placeholderTextColor={Colors.ink4}
            value={q}
            onChangeText={setQ}
            style={styles.searchInput}
          />
        </View>
      </View>

      <LabelCaps style={{ paddingHorizontal: Spacing.lg, paddingBottom: 6 }}>
        ALL · {filtered.length}
      </LabelCaps>

      {artists.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Empty icon="♡" title="아직 아티스트가 없어요"
                 subtitle="＋ 버튼으로 좋아하는 연예인을 검색해 등록하세요" />
          <View style={{ paddingHorizontal: Spacing.xxl, marginTop: Spacing.lg }}>
            <PrimaryButton title="연예인 검색" onPress={() => router.push('/search')} />
          </View>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={a => String(a.id)}
          ItemSeparatorComponent={() => <Divider />}
          renderItem={({ item }) => <ArtistRow artist={item} onPress={() => router.push(`/artist/${item.id}`)} />}
          ListEmptyComponent={<Empty icon="·" title={`"${q}" 결과 없음`} />}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}
    </SafeAreaView>
  );
}

function ArtistRow({ artist, onPress }: { artist: Artist; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <Avatar artist={artist} size={44} />
      <View style={{ flex: 1, marginLeft: Spacing.md, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: FontSizes.body, fontFamily: Fonts.semibold, color: Colors.ink }}>
          {artist.name}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: FontSizes.caption, color: Colors.ink3, marginTop: 2 }}>
          {artist.role ?? artist.tag ?? ''}
        </Text>
      </View>
      {artist.isFollowing && <Chip label="팔로잉" />}
      <Text style={styles.chev}>›</Text>
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
  topIc: { fontSize: 20, color: Colors.ink },

  searchWrap: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.paper,
    borderWidth: 1, borderColor: Colors.ink,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  searchIc: { color: Colors.ink3, marginRight: 6, fontSize: 14 },
  searchInput: { flex: 1, fontFamily: Fonts.regular, fontSize: FontSizes.body, color: Colors.ink, padding: 0 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    gap: 4,
  },
  chev: { fontSize: 18, color: Colors.ink4, marginLeft: 6 },
});
