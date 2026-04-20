import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, StyleSheet,
  ActivityIndicator, Image, Alert, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Colors, Fonts, FontSizes, Spacing, Radius } from '@/theme/theme';
import { Divider, Empty, PrimaryButton } from '@/components/UI';
import { searchCelebrity } from '@/services/searchCelebrity';
import { parseSearchHitToBundle } from '@/services/parseData';
import { upsertArtistByExternalId } from '@/db/artists';
import { createNotification } from '@/db/notifications';
import { syncOneArtist } from '@/services/syncManager';
import type { SearchHit } from '@/types';

export default function SearchModal() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState<string | null>(null);
  const debounceRef = useRef<any>(null);

  // 디바운스 검색
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setHits([]); setError(null); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const rs = await searchCelebrity(q);
        setHits(rs);
      } catch (e: any) {
        setError(e?.message ?? '검색 실패');
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q]);

  const registerHit = async (hit: SearchHit) => {
    try {
      setRegistering(hit.externalId);
      const bundle = parseSearchHitToBundle(hit);
      // 1) 아티스트 upsert
      const artistId = await upsertArtistByExternalId(bundle.artist.externalId, {
        ...bundle.artist,
        isFollowing: true,
        notifyEnabled: true,
      });
      // 2) 알림 생성
      for (const n of bundle.notifications ?? []) {
        await createNotification({ ...n, artistId });
      }
      // 3) (선택) 추가 이벤트 싱크 — 지금은 empty 반환이지만 구조 유지
      await syncOneArtist(artistId).catch(() => {});

      Keyboard.dismiss();
      // 성공 시 상세로 이동
      router.replace(`/artist/${artistId}`);
    } catch (e: any) {
      Alert.alert('등록 실패', e?.message ?? String(e));
    } finally {
      setRegistering(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={{ fontSize: 20 }}>✕</Text>
        </Pressable>
        <Text style={styles.title}>연예인 검색</Text>
        <View style={{ width: 20 }} />
      </View>
      <Divider />

      <View style={{ padding: Spacing.lg }}>
        <View style={styles.searchBox}>
          <Text style={{ color: Colors.textFaint, marginRight: 6 }}>🔍</Text>
          <TextInput
            placeholder="아이유, 조승우, 손흥민 등"
            placeholderTextColor={Colors.textFaint}
            value={q}
            onChangeText={setQ}
            autoFocus
            returnKeyType="search"
            style={{ flex: 1, fontFamily: Fonts.regular, fontSize: FontSizes.body, color: Colors.text }}
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Text style={{ color: Colors.textFaint, fontSize: 16 }}>✕</Text>
            </Pressable>
          )}
        </View>
        <Text style={{ fontSize: FontSizes.tiny, color: Colors.textSub, marginTop: 6, paddingHorizontal: 4 }}>
          한국어 위키백과에서 검색합니다. 탭하면 등록돼요.
        </Text>
      </View>

      {loading && <ActivityIndicator style={{ marginTop: Spacing.xl }} />}
      {error && <View style={{ padding: Spacing.lg }}>
        <Text style={{ color: Colors.heart }}>❌ {error}</Text>
      </View>}

      <FlatList
        data={hits}
        keyExtractor={h => `${h.source}:${h.externalId}`}
        ItemSeparatorComponent={() => <Divider />}
        renderItem={({ item }) => (
          <HitRow hit={item} onPress={() => registerHit(item)} loading={registering === item.externalId} />
        )}
        ListEmptyComponent={!loading && !error && q.length > 0
          ? <Empty icon="🔍" title={`"${q}" 결과 없음`} subtitle="다른 단어로 검색해 보세요" />
          : null}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 80 }}
      />
    </SafeAreaView>
  );
}

function HitRow({ hit, onPress, loading }: { hit: SearchHit; onPress: () => void; loading: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={loading}
               style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <View style={styles.thumb}>
        {hit.avatarUrl
          ? <Image source={{ uri: hit.avatarUrl }} style={{ width: '100%', height: '100%' }} />
          : <Text style={{ fontSize: 28 }}>👤</Text>}
      </View>
      <View style={{ flex: 1, marginHorizontal: Spacing.md, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: Fonts.semibold, fontSize: FontSizes.body }}>{hit.name}</Text>
        {hit.role && (
          <Text numberOfLines={1} style={{ fontSize: FontSizes.caption, color: Colors.textSub, marginTop: 2 }}>
            {hit.role}
          </Text>
        )}
        {hit.bio && (
          <Text numberOfLines={2} style={{ fontSize: FontSizes.tiny, color: Colors.textFaint, marginTop: 2 }}>
            {hit.bio}
          </Text>
        )}
      </View>
      {loading
        ? <ActivityIndicator size="small" />
        : <Text style={styles.addBtn}>등록</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: Spacing.lg, height: 48 },
  title: { fontSize: FontSizes.title, fontFamily: Fonts.semibold },
  searchBox: { flexDirection: 'row', alignItems: 'center',
               backgroundColor: Colors.bgMuted, borderRadius: Radius.md,
               paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: 0 },
  thumb: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.bgMuted,
           alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
           borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  addBtn: { color: Colors.primary, fontFamily: Fonts.semibold, fontSize: FontSizes.body },
});
