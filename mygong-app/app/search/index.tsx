import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, StyleSheet,
  ActivityIndicator, Image, Alert, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Colors, Fonts, FontSizes, Spacing, Radius } from '@/theme/theme';
import { Divider, Empty } from '@/components/UI';
import { searchCelebrity } from '@/services/searchCelebrity';
import { parseSearchHitToBundle } from '@/services/parseData';
import { upsertArtistByExternalId, getAllArtists } from '@/db/artists';
import { createNotification } from '@/db/notifications';
import { syncOneArtist } from '@/services/syncManager';
import type { SearchHit, Artist } from '@/types';

export default function SearchModal() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<string>('');
  const [existingArtists, setExistingArtists] = useState<Artist[]>([]);
  const debounceRef = useRef<any>(null);
  const reqSeqRef = useRef(0);

  // 기존 아티스트 목록 로드
  useEffect(() => {
    loadArtists();
  }, []);

  async function loadArtists() {
    try {
      const artists = await getAllArtists('all');
      setExistingArtists(artists);
    } catch (e) {
      console.warn('[search] failed to load artists:', e);
    }
  }

  // 등록 여부 확인
  function isRegistered(externalId: string): boolean {
    return existingArtists.some(a => a.externalId === externalId);
  }

  // 디바운스 검색 — 400ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setHits([]); setError(null); setLastStatus('');
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(q), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q]);

  async function runSearch(query: string) {
    const seq = ++reqSeqRef.current;
    setLoading(true); setError(null); setLastStatus('검색 중…');
    console.log('[search-ui] querying:', query, 'seq', seq);
    try {
      const rs = await searchCelebrity(query);
      if (seq !== reqSeqRef.current) {
        console.log('[search-ui] discarded stale result for seq', seq);
        return;
      }
      console.log('[search-ui] got hits:', rs.length);
      setHits(rs);
      setLastStatus(`${rs.length}개 결과`);
    } catch (e: any) {
      if (seq !== reqSeqRef.current) return;
      const msg = e?.message ?? String(e);
      console.warn('[search-ui] error:', msg);
      setError(msg);
      setHits([]);
      setLastStatus('실패');
    } finally {
      if (seq === reqSeqRef.current) setLoading(false);
    }
  }

  const registerHit = async (hit: SearchHit) => {
    try {
      setRegistering(hit.externalId);
      const bundle = parseSearchHitToBundle(hit);
      const artistId = await upsertArtistByExternalId(bundle.artist.externalId, {
        ...bundle.artist,
        isFollowing: true,
        notifyEnabled: true,
      });
      for (const n of bundle.notifications ?? []) {
        await createNotification({ ...n, artistId });
      }
      await syncOneArtist(artistId).catch(() => {});

      // 목록 갱신
      await loadArtists();

      Keyboard.dismiss();
      // 모달 닫고 → artist 상세로 push (stack 꼬임 방지)
      router.back();
      setTimeout(() => router.push(`/artist/${artistId}`), 80);
    } catch (e: any) {
      Alert.alert('등록 실패', e?.message ?? String(e));
    } finally {
      setRegistering(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={{ fontSize: 20 }}>✕</Text>
        </Pressable>
        <Text style={styles.title}>연예인 검색</Text>
        <View style={{ width: 20 }} />
      </View>
      <Divider />

      {/* 검색창 */}
      <View style={{ padding: Spacing.lg }}>
        <View style={styles.searchBox}>
          <Text style={{ color: Colors.textFaint, marginRight: 6 }}>🔍</Text>
          <TextInput
            placeholder="아이유, 조승우, 손흥민 등"
            placeholderTextColor={Colors.textFaint}
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => q.trim() && runSearch(q)}
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

      {/* 상태 배너 — 항상 보이는 영역 */}
      <View style={styles.statusWrap}>
        {loading && (
          <View style={styles.statusPill}>
            <ActivityIndicator size="small" />
            <Text style={styles.statusText}>검색 중…</Text>
          </View>
        )}
        {error && !loading && (
          <View style={[styles.errorBox]}>
            <Text style={styles.errorTitle}>❌ 검색 실패</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable onPress={() => runSearch(q)} style={styles.retryBtn}>
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        )}
        {!loading && !error && !!q.trim() && hits.length > 0 && (
          <Text style={styles.statusText}>{lastStatus}</Text>
        )}
      </View>

      {/* 결과 리스트 */}
      <FlatList
        style={{ flex: 1 }}
        data={hits}
        keyExtractor={h => `${h.source}:${h.externalId}`}
        ItemSeparatorComponent={() => <Divider />}
        renderItem={({ item }) => (
          <HitRow 
            hit={item} 
            onPress={() => registerHit(item)} 
            loading={registering === item.externalId}
            isRegistered={isRegistered(item.externalId)}
          />
        )}
        ListEmptyComponent={
          !loading && !error && q.length > 0
            ? <Empty icon="🔍" title={`"${q}" 결과 없음`} subtitle="다른 단어로 검색해 보세요" />
            : null
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: 80 }}
      />
    </SafeAreaView>
  );
}

function HitRow({ hit, onPress, loading, isRegistered }: { 
  hit: SearchHit; 
  onPress: () => void; 
  loading: boolean;
  isRegistered: boolean;
}) {
  return (
    <Pressable 
      onPress={isRegistered ? undefined : onPress} 
      disabled={loading || isRegistered}
      style={({ pressed }) => [
        styles.row, 
        pressed && !isRegistered && { opacity: 0.7 },
        isRegistered && { opacity: 0.5 }
      ]}
    >
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
      {loading ? (
        <ActivityIndicator size="small" />
      ) : isRegistered ? (
        <View style={styles.registeredBadge}>
          <Text style={styles.registeredText}>✓ 등록됨</Text>
        </View>
      ) : (
        <Text style={styles.addBtn}>등록</Text>
      )}
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
  statusWrap: { paddingHorizontal: Spacing.lg, minHeight: 8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingVertical: 6 },
  statusText: { fontSize: FontSizes.caption, color: Colors.textSub },
  errorBox: { backgroundColor: '#fff7cc', borderColor: '#e6c200', borderWidth: 1,
              borderRadius: Radius.md, padding: 12, marginVertical: 6 },
  errorTitle: { fontFamily: Fonts.semibold, fontSize: FontSizes.body, color: '#8a6d00' },
  errorBody:  { fontSize: FontSizes.caption, color: '#6a5200', marginTop: 4 },
  retryBtn:   { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 12, paddingVertical: 6,
                backgroundColor: '#e6c200', borderRadius: 6 },
  retryText:  { fontFamily: Fonts.semibold, color: '#3d2f00', fontSize: FontSizes.caption },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg },
  thumb: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.bgMuted,
           alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
           borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  addBtn: { color: Colors.primary, fontFamily: Fonts.semibold, fontSize: FontSizes.body },
  registeredBadge: { 
    backgroundColor: Colors.bgMuted, 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: Radius.sm 
  },
  registeredText: { 
    fontSize: FontSizes.caption, 
    color: Colors.textSub, 
    fontFamily: Fonts.medium 
  },
});
