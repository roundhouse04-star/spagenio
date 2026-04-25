import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator, RefreshControl,
  Linking, Image, FlatList, Modal, TextInput,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { Colors, Fonts, FontSizes, Spacing, Radius } from '@/theme/theme';
import { Avatar, EventRow, TicketRow, Empty, Divider, PrimaryButton, SecondaryButton } from '@/components/UI';
import { EventGridItem, EventGridContainer } from '@/components/EventGridItem';
import { getArtistById, toggleFollowing, updateArtist, deleteArtist } from '@/db/artists';
import { getUpcomingEventsForArtist, getPastEventsForArtist } from '@/db/events';
import { getTicketsByArtist } from '@/db/tickets';
import { getSyncState } from '@/db/sync-state';
import { getPhotosByArtist, createPhoto, updatePhoto, deletePhoto, type Photo } from '@/db/photos';
import { syncOneArtist } from '@/services/syncManager';
import { parseArtistBio } from '@/services/artistInfoParser';
import type { Artist, Event, Ticket, ArtistSyncState } from '@/types';

export default function ArtistDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const artistId = Number(id);

  const [artist, setArtist] = useState<Artist | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [syncState, setSyncStateObj] = useState<ArtistSyncState | null>(null);
  const [tab, setTab] = useState<'upcoming' | 'attended' | 'history' | 'photos' | 'info'>('upcoming');
  const [refreshing, setRefreshing] = useState(false);
  
  // 사진 상세보기 모달
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [editingCaption, setEditingCaption] = useState('');

  const load = useCallback(async () => {
    const [a, e, past, t, p, s] = await Promise.all([
      getArtistById(artistId),
      getUpcomingEventsForArtist(artistId, 20),
      getPastEventsForArtist(artistId, 50),
      getTicketsByArtist(artistId),
      getPhotosByArtist(artistId),
      getSyncState(artistId),
    ]);
    setArtist(a); setEvents(e); setPastEvents(past); setTickets(t); setPhotos(p); setSyncStateObj(s);
  }, [artistId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // bio 파싱 — 본명/생년월일/국적/직업 등 구조화 정보 추출
  const parsedInfo = useMemo(() => parseArtistBio(artist?.bio), [artist?.bio]);

  if (!artist) return <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></SafeAreaView>;

  const onRefresh = async () => {
    setRefreshing(true);
    try { await syncOneArtist(artistId); await load(); } finally { setRefreshing(false); }
  };

  const toggleFollow = async () => {
    const wasFollowing = artist.isFollowing;
    await toggleFollowing(artistId);
    await load();
    if (!wasFollowing) {
      console.log('[artist] follow started → auto sync:', artist.name);
      syncOneArtist(artistId)
        .then(() => load())
        .catch(e => console.warn('[artist] auto sync failed:', e?.message ?? e));
    }
  };
  const toggleNotify = async () => { await updateArtist(artistId, { notifyEnabled: !artist.notifyEnabled }); await load(); };

  const onDelete = () => {
    Alert.alert('아티스트 삭제', `"${artist.name}"의 관련 공연·티켓·알림·사진도 모두 삭제됩니다.`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { await deleteArtist(artistId); router.back(); } },
    ]);
  };

  const openWikipedia = () => {
    const pageId = artist.externalId?.replace(/^wiki:/, '');
    if (!pageId) return;
    const url = `https://ko.wikipedia.org/?curid=${pageId}`;
    Linking.openURL(url).catch(e => Alert.alert('링크를 열 수 없어요', e?.message ?? ''));
  };

  // 사진 추가
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진첩 접근 권한이 필요해요');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await savePhoto(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요해요');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await savePhoto(result.assets[0].uri);
    }
  };

  const savePhoto = async (uri: string) => {
    try {
      // 파일 저장
      const filename = `${Date.now()}.jpg`;
      const directory = `${FileSystem.documentDirectory}artist-photos/`;
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      const newPath = `${directory}${filename}`;
      await FileSystem.copyAsync({ from: uri, to: newPath });

      // DB에 저장 (파일명만)
      await createPhoto({
        artistId,
        photoUri: filename,
        takenAt: new Date().toISOString(),
      });

      await load();
      Alert.alert('✅ 사진 추가 완료!');
    } catch (e: any) {
      Alert.alert('사진 저장 실패', e?.message ?? String(e));
    }
  };

  const showPhotoOptions = () => {
    Alert.alert(
      '사진 추가',
      '공연 사진을 추가하세요',
      [
        { text: '📷 카메라', onPress: takePhoto },
        { text: '🖼️ 갤러리', onPress: pickImage },
        { text: '취소', style: 'cancel' },
      ]
    );
  };

  const openPhotoDetail = (photo: Photo) => {
    setSelectedPhoto(photo);
    setEditingCaption(photo.caption || '');
  };

  const closePhotoDetail = () => {
    setSelectedPhoto(null);
    setEditingCaption('');
  };

  const saveCaption = async () => {
    if (!selectedPhoto) return;
    await updatePhoto(selectedPhoto.id, { caption: editingCaption });
    await load();
    closePhotoDetail();
  };

  const deleteSelectedPhoto = async () => {
    if (!selectedPhoto) return;
    Alert.alert(
      '사진 삭제',
      '이 사진을 삭제할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            // 파일 삭제
            const photoPath = `${FileSystem.documentDirectory}artist-photos/${selectedPhoto.photoUri}`;
            try {
              await FileSystem.deleteAsync(photoPath, { idempotent: true });
            } catch (e) {
              console.warn('[photo] file delete failed:', e);
            }
            // DB 삭제
            await deletePhoto(selectedPhoto.id);
            await load();
            closePhotoDetail();
          },
        },
      ]
    );
  };

  const getPhotoFullUri = (photoUri: string) => {
    return `${FileSystem.documentDirectory}artist-photos/${photoUri}`;
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
              <Stat n={photos.length} label="사진" />
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.sm }}>
          <Text style={{ fontFamily: Fonts.bold, fontSize: FontSizes.bodyLg }}>{artist.name}</Text>
          {artist.role && <Text style={{ fontSize: FontSizes.caption, color: Colors.textSub, marginTop: 2 }}>{artist.role}</Text>}
          {artist.bio && <Text numberOfLines={3} style={{ fontSize: FontSizes.caption, color: Colors.text, marginTop: 8, lineHeight: 18 }}>{artist.bio}</Text>}
          {artist.bio && artist.externalId?.startsWith('wiki:') && (
            <Text style={{ fontSize: 10, color: Colors.textFaint, marginTop: 6 }}>
              출처: 위키백과 · CC BY-SA 4.0
            </Text>
          )}
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
            { k: 'attended', label: `다녀온 ${tickets.length}` },
            { k: 'history',  label: `지난공연 ${pastEvents.length}` },
            { k: 'photos',   label: `사진첩 ${photos.length}` },
            { k: 'info',     label: '정보' },
          ].map(t => (
            <Pressable key={t.k} onPress={() => setTab(t.k as any)} style={[styles.tab, tab === t.k && styles.tabActive]}>
              <Text style={{ fontFamily: tab === t.k ? Fonts.bold : Fonts.medium, color: tab === t.k ? Colors.text : Colors.textSub, fontSize: FontSizes.tiny }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'upcoming' && (events.length === 0
          ? <Empty icon="🎫" title="다가오는 공연 없음" subtitle="캘린더에서 ＋ 버튼으로 추가하거나 동기화를 시도하세요" />
          : events.map(e => <EventRow key={e.id} ev={e} onPress={() => router.push(`/event/${e.id}`)} />))}

        {tab === 'attended' && (tickets.length === 0
          ? <Empty icon="📖" title="아직 관람 기록 없음" />
          : tickets.map(t => <TicketRow key={t.id} t={t} onPress={() => router.push(`/ticket/${t.id}`)} />))}

        {tab === 'history' && (pastEvents.length === 0
          ? <Empty icon="📼" title="지난 공연 없음" subtitle="위키백과·KOPIS에서 수집된 과거 공연이 여기 표시됩니다" />
          : (
            <View style={{ paddingTop: Spacing.sm }}>
              <EventGridContainer>
                {pastEvents.map(e => (
                  <EventGridItem
                    key={e.id}
                    ev={e}
                    artist={artist}
                    onPress={() => router.push(`/event/${e.id}`)}
                  />
                ))}
              </EventGridContainer>
            </View>
          ))}

        {tab === 'photos' && (
          <View style={{ padding: Spacing.lg }}>
            <PrimaryButton title="📸 사진 추가" onPress={showPhotoOptions} />
            {photos.length === 0 ? (
              <Empty icon="📷" title="사진이 없어요" subtitle="공연 중 찍은 사진을 추가해보세요!" />
            ) : (
              <View style={{ marginTop: Spacing.lg }}>
                <FlatList
                  data={photos}
                  numColumns={3}
                  scrollEnabled={false}
                  keyExtractor={p => String(p.id)}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => openPhotoDetail(item)}
                      style={{ width: '33.33%', aspectRatio: 1, padding: 2 }}
                    >
                      <Image
                        source={{ uri: getPhotoFullUri(item.photoUri) }}
                        style={{ width: '100%', height: '100%', borderRadius: 4 }}
                      />
                    </Pressable>
                  )}
                />
              </View>
            )}
          </View>
        )}

        {tab === 'info' && (
          <View style={{ padding: Spacing.lg }}>
            {/* 프로필 정보 */}
            <Text style={styles.sectionTitle}>프로필</Text>
            {parsedInfo.realName && <InfoRow icon="🪪" label="본명" value={parsedInfo.realName} />}
            {parsedInfo.aliases && parsedInfo.aliases.length > 0 && (
              <InfoRow icon="✨" label="별칭" value={parsedInfo.aliases.join(', ')} />
            )}
            {parsedInfo.birthDate && (
              <InfoRow
                icon="🎂"
                label={parsedInfo.deathDate ? '생몰' : '생년월일'}
                value={parsedInfo.deathDate
                  ? `${parsedInfo.birthDate} ~ ${parsedInfo.deathDate}`
                  : parsedInfo.birthDate}
              />
            )}
            {parsedInfo.nationality && <InfoRow icon="🌏" label="국적" value={parsedInfo.nationality} />}
            {parsedInfo.occupations && parsedInfo.occupations.length > 0 && (
              <InfoRow icon="💼" label="직업" value={parsedInfo.occupations.join(' · ')} />
            )}
            {artist.role && !parsedInfo.occupations?.length && (
              <InfoRow icon="💼" label="직업" value={artist.role} />
            )}

            {/* 위키백과 원문 보기 */}
            {artist.externalId?.startsWith('wiki:') && (
              <View style={{ marginTop: Spacing.lg }}>
                <SecondaryButton title="📖 위키백과에서 더 보기" onPress={openWikipedia} />
              </View>
            )}

            {/* bio 원문 전문 */}
            {artist.bio && (
              <View style={{ marginTop: Spacing.xl }}>
                <Text style={styles.sectionTitle}>소개</Text>
                <Text style={styles.bioFull}>{artist.bio}</Text>
                <Text style={{ fontSize: 10, color: Colors.textFaint, marginTop: 8 }}>
                  출처: 위키백과 · CC BY-SA 4.0
                </Text>
              </View>
            )}

            {/* 동기화 상태 — 작게 */}
            <View style={{ marginTop: Spacing.xl }}>
              <Text style={styles.sectionTitle}>동기화</Text>
              <MetaRow label="마지막 동기화" value={artist.lastSyncedAt ? new Date(artist.lastSyncedAt).toLocaleString('ko-KR') : '-'} />
              <MetaRow label="등록일" value={new Date(artist.createdAt).toLocaleDateString('ko-KR')} />
              {syncState?.lastFetchError && (
                <Text style={{ fontSize: FontSizes.tiny, color: Colors.heart, marginTop: 8 }}>
                  최근 오류: {syncState.lastFetchError}
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* 사진 상세 모달 */}
      <Modal visible={!!selectedPhoto} transparent animationType="fade">
        <Pressable onPress={closePhotoDetail} style={styles.modalOverlay}>
          <Pressable onPress={e => e.stopPropagation()} style={styles.photoModal}>
            {selectedPhoto && (
              <>
                <Image
                  source={{ uri: getPhotoFullUri(selectedPhoto.photoUri) }}
                  style={{ width: '100%', aspectRatio: 1, borderRadius: Radius.md }}
                  resizeMode="cover"
                />
                <View style={{ padding: Spacing.lg }}>
                  <Text style={{ fontSize: FontSizes.caption, color: Colors.textSub, marginBottom: 8 }}>
                    사진 설명
                  </Text>
                  <TextInput
                    value={editingCaption}
                    onChangeText={setEditingCaption}
                    placeholder="어떤 공연이었나요?"
                    placeholderTextColor={Colors.textFaint}
                    multiline
                    style={{
                      backgroundColor: Colors.bgMuted,
                      borderRadius: Radius.sm,
                      padding: 12,
                      fontSize: FontSizes.body,
                      color: Colors.text,
                      minHeight: 80,
                    }}
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: Spacing.lg }}>
                    <SecondaryButton title="삭제" onPress={deleteSelectedPhoto} style={{ flex: 1 }} />
                    <PrimaryButton title="저장" onPress={saveCaption} style={{ flex: 1 }} />
                  </View>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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

/** 프로필 정보 한 줄 — 아이콘 + 레이블 + 값 */
function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

/** 메타 정보 (동기화 시각 등) — 작은 글씨 */
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
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
  sectionTitle: {
    fontSize: FontSizes.caption,
    fontFamily: Fonts.bold,
    color: Colors.textSub,
    marginBottom: Spacing.sm,
    letterSpacing: 0.3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  infoIcon: {
    fontSize: 20,
    width: 32,
  },
  infoLabel: {
    fontSize: FontSizes.tiny,
    color: Colors.textSub,
  },
  infoValue: {
    fontSize: FontSizes.body,
    color: Colors.text,
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  bioFull: {
    fontSize: FontSizes.body,
    color: Colors.text,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  metaLabel: {
    width: 110,
    fontSize: FontSizes.tiny,
    color: Colors.textSub,
  },
  metaValue: {
    flex: 1,
    fontSize: FontSizes.tiny,
    color: Colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModal: {
    width: '90%',
    backgroundColor: Colors.bg,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
});
