import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, TextInput } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, FontSizes, Spacing } from '@/theme/theme';
import { Avatar, Empty, Divider, PrimaryButton } from '@/components/UI';
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
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>내 아티스트</Text>
        <Pressable onPress={() => router.push('/search')} hitSlop={8}>
          <Text style={{ fontSize: 22 }}>＋</Text>
        </Pressable>
      </View>
      <Divider />

      <View style={{ padding: Spacing.lg }}>
        <View style={styles.searchBox}>
          <Text style={{ color: Colors.textFaint, marginRight: 6 }}>🔍</Text>
          <TextInput
            placeholder="이름·역할로 찾기"
            placeholderTextColor={Colors.textFaint}
            value={q}
            onChangeText={setQ}
            style={{ flex: 1, fontFamily: Fonts.regular, fontSize: FontSizes.body, color: Colors.text }}
          />
        </View>
      </View>

      {artists.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Empty icon="👤" title="아직 아티스트가 없어요"
                 subtitle='"＋" 버튼으로 좋아하는 연예인을 검색해 등록하세요' />
          <View style={{ paddingHorizontal: Spacing.xxl, marginTop: Spacing.lg }}>
            <PrimaryButton title="연예인 검색" onPress={() => router.push('/search')} />
          </View>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={a => String(a.id)}
          ItemSeparatorComponent={() => <Divider />}
          renderItem={({ item }) => <ArtistItem artist={item} onPress={() => router.push(`/artist/${item.id}`)} />}
          ListEmptyComponent={<Empty icon="🤔" title={`"${q}" 결과 없음`} />}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}
    </SafeAreaView>
  );
}

function ArtistItem({ artist, onPress }: { artist: Artist; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <Avatar artist={artist} size={52} />
      <View style={{ flex: 1, marginLeft: Spacing.md }}>
        <Text style={{ fontFamily: Fonts.semibold, fontSize: FontSizes.body }}>
          {artist.name} {artist.isFollowing && <Text style={{ fontSize: 11, color: Colors.verified }}>●</Text>}
        </Text>
        <Text style={{ fontSize: FontSizes.caption, color: Colors.textSub, marginTop: 2 }}>
          {artist.role ?? artist.tag ?? ''}
        </Text>
      </View>
      <Text style={{ fontSize: 18, color: Colors.textFaint }}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: Spacing.lg, height: 48 },
  title: { fontSize: FontSizes.title, fontFamily: Fonts.semibold, color: Colors.text },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgMuted, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg },
});
