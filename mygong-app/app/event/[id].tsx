import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator, Image, Linking, Dimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, FontSizes, Spacing, Radius, chipBg } from '@/theme/theme';
import { Divider, CategoryChip, PrimaryButton, SecondaryButton } from '@/components/UI';
import { Field, TextField, DateField, TimeField, CategoryPicker, SelectRow } from '@/components/Form';
import { KeyboardAwareScroll } from '@/components/KeyboardAwareScroll';
import { getEventById, updateEvent, deleteEvent, toggleWishlist } from '@/db/events';
import { getAllArtists, getArtistById } from '@/db/artists';
import { iconForCategory, CATEGORIES } from '@/db/schema';
import { getPosterUri } from '@/utils/imageUtils';
import type { Event, Artist } from '@/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const POSTER_HEIGHT = SCREEN_WIDTH * 1.1;

function placeholderBg(category?: string): string {
  const cat = category ?? '';
  if (cat === '콘서트')   return '#ffe0e9';
  if (cat === '뮤지컬')   return '#e8e4ff';
  if (cat === '연극')     return '#fff4d6';
  if (cat === '팬미팅')   return '#ffdfe8';
  if (cat === '페스티벌') return '#ffeac9';
  if (cat === '전시')     return '#d8eefe';
  return '#eee';
}

function secureUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace(/^http:\/\//i, 'https://');
}

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const eventId = Number(id);

  const [ev, setEv] = useState<Event | null>(null);
  const [eventArtist, setEventArtist] = useState<Artist | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Event>>({});

  const load = useCallback(async () => {
    const [e, a] = await Promise.all([getEventById(eventId), getAllArtists('all')]);
    setEv(e); setArtists(a);
    if (e) {
      setForm(e);
      if (e.artistId) {
        const ea = await getArtistById(e.artistId);
        setEventArtist(ea);
      } else {
        setEventArtist(null);
      }
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!ev) return <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></SafeAreaView>;

  const dday = daysUntil(ev.date);
  const isPast = dday < 0;
  const label = dday === 0 ? 'D-DAY' : dday > 0 ? `D-${dday}` : `D+${-dday}`;
  const posterUri = getPosterUri(ev.posterUrl) || secureUrl(eventArtist?.avatarUrl);
  const hasPoster = !!posterUri;
  const isFallback = !ev.posterUrl && !!posterUri;

  const save = async () => {
    if (!form.title?.trim()) { Alert.alert('제목이 비어있어요'); return; }
    if (!form.date) { Alert.alert('날짜를 입력하세요'); return; }
    await updateEvent(eventId, { ...form, catIcon: iconForCategory(form.category) });
    setEditing(false);
    await load();
  };

  const onDelete = () => {
    Alert.alert('공연 삭제', '되돌릴 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { await deleteEvent(eventId); router.back(); } },
    ]);
  };

  const openTicket = () => {
    if (!ev.ticketUrl) return;
    const url = secureUrl(ev.ticketUrl) ?? ev.ticketUrl;
    Linking.openURL(url).catch(e => Alert.alert('링크를 열 수 없어요', e?.message ?? ''));
  };

  // v2: 네이버에서 티켓 오픈일 검색
  const openNaverSearch = () => {
    const query = encodeURIComponent(`${ev.title} 티켓 오픈`);
    const url = `https://search.naver.com/search.naver?query=${query}`;
    Linking.openURL(url).catch(e => Alert.alert('링크를 열 수 없어요', e?.message ?? ''));
  };

  // v2: 위시리스트 토글
  const onToggleWishlist = async () => {
    await toggleWishlist(eventId);
    await load();
  };

  if (editing) {
    return (
      <FormView
        title="공연 수정"
        form={form} setForm={setForm}
        artists={artists}
        onCancel={() => { setForm(ev); setEditing(false); }}
        onSave={save}
        onDelete={onDelete}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={{ fontSize: 22 }}>‹</Text></Pressable>
        <Text style={styles.navTitle}>공연 상세</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Pressable onPress={onToggleWishlist} hitSlop={8}>
            <Text style={{ fontSize: 22 }}>{ev.isWishlisted ? '💖' : '🤍'}</Text>
          </Pressable>
          <Pressable onPress={() => setEditing(true)} hitSlop={8}>
            <Text style={{ fontSize: 14, color: Colors.primary, fontFamily: Fonts.semibold }}>수정</Text>
          </Pressable>
        </View>
      </View>
      <Divider />

      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        {hasPoster ? (
          <View style={styles.posterWrap}>
            <Image source={{ uri: posterUri }} style={styles.poster} resizeMode="cover" />
            {isFallback && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeIcon}>{ev.catIcon ?? '🎤'}</Text>
                <Text style={styles.categoryBadgeText}>{ev.category ?? ''}</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.posterPlaceholder, { backgroundColor: placeholderBg(ev.category) }]}>
            <Text style={styles.placeholderIcon}>{ev.catIcon ?? '🎤'}</Text>
            <Text style={styles.placeholderText}>{ev.category ?? '이벤트'}</Text>
          </View>
        )}

        <View style={styles.titleBlock}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <CategoryChip category={ev.category} />
            <Text style={[styles.dday, { color: isPast ? Colors.textSub : (dday <= 7 ? Colors.heart : Colors.text) }]}>{label}</Text>
          </View>
          <Text style={styles.eventTitle}>{ev.title}</Text>
          <Text style={styles.eventSub}>
            {ev.date}{ev.weekday ? ` (${ev.weekday})` : ''}{ev.time ? ` · ${ev.time}` : ''}
          </Text>
        </View>

        <Divider />

        <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
          {ev.venue && <InfoRow icon="📍" label="장소" value={ev.venue} />}
          {ev.city && <InfoRow icon="🏙" label="도시" value={ev.city} />}
          {ev.price && <InfoRow icon="💰" label="가격·좌석" value={ev.price} />}
          {ev.ticketOpenAt && <InfoRow icon="⏰" label="티켓 오픈일" value={ev.ticketOpenAt} />}
          {ev.notes && <InfoRow icon="📝" label="메모" value={ev.notes} />}
          {ev.source && <InfoRow icon="🏷️" label="소스" value={ev.source} />}
        </View>

        {/* v2: 티켓 오픈일 없고 다가오는 공연이면 네이버 검색 */}
        {!ev.ticketOpenAt && !isPast && (
          <View style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.md }}>
            <Pressable onPress={openNaverSearch} style={styles.naverBtn}>
              <Text style={styles.naverBtnIcon}>🔍</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.naverBtnTitle}>네이버에서 티켓 오픈일 확인</Text>
                <Text style={styles.naverBtnSub}>확인 후 [수정]에서 입력하면 알림을 받아요</Text>
              </View>
              <Text style={{ fontSize: 18, color: Colors.textSub }}>›</Text>
            </Pressable>
          </View>
        )}

        {ev.ticketUrl && (
          <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg }}>
            <PrimaryButton title={isPast ? '🔗 공연 정보 보기' : '🎫 티켓 예매하기'} onPress={openTicket} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.md }}>
      <Text style={{ fontSize: 18, width: 22 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: FontSizes.tiny, color: Colors.textSub }}>{label}</Text>
        <Text style={{ fontSize: FontSizes.body, color: Colors.text, marginTop: 2 }}>{value}</Text>
      </View>
    </View>
  );
}

function daysUntil(date: string): number {
  if (!date) return -9999;
  const d = new Date(date);
  if (isNaN(d.getTime())) return -9999;
  const n = new Date(); n.setHours(0,0,0,0); d.setHours(0,0,0,0);
  return Math.round((d.getTime() - n.getTime()) / 86400000);
}

export function FormView({ title, form, setForm, artists, onSave, onCancel, onDelete }: {
  title: string;
  form: Partial<Event>;
  setForm: (f: Partial<Event>) => void;
  artists: Artist[];
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable onPress={onCancel} hitSlop={8}><Text style={{ color: Colors.textSub }}>취소</Text></Pressable>
        <Text style={styles.navTitle}>{title}</Text>
        <Pressable onPress={onSave} hitSlop={8}>
          <Text style={{ color: Colors.primary, fontFamily: Fonts.semibold }}>저장</Text>
        </Pressable>
      </View>
      <Divider />
      <KeyboardAwareScroll contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 120 }}>
        <Field label="제목" required>
          <TextField value={form.title ?? ''} onChangeText={t => setForm({ ...form, title: t })} placeholder="예) HEREH WORLD TOUR" />
        </Field>
        <Field label="카테고리">
          <CategoryPicker
            value={form.category ?? '콘서트'}
            onChange={v => setForm({ ...form, category: v })}
            options={CATEGORIES as any}
          />
        </Field>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1.4 }}>
            <Field label="날짜" required>
              <DateField value={form.date ?? ''} onChangeText={t => setForm({ ...form, date: t })} />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="시간">
              <TimeField value={form.time ?? ''} onChangeText={t => setForm({ ...form, time: t })} />
            </Field>
          </View>
        </View>
        <Field label="장소">
          <TextField value={form.venue ?? ''} onChangeText={t => setForm({ ...form, venue: t })} placeholder="예) 고척 스카이돔" />
        </Field>
        <Field label="가격·좌석">
          <TextField value={form.price ?? ''} onChangeText={t => setForm({ ...form, price: t })} placeholder="VIP 165,000원" />
        </Field>
        <Field label="티켓 오픈일 (선택)">
          <TextField
            value={form.ticketOpenAt ?? ''}
            onChangeText={t => setForm({ ...form, ticketOpenAt: t })}
            placeholder="예) 2026-04-15 14:00"
          />
        </Field>
        <Field label="메모">
          <TextField value={form.notes ?? ''} onChangeText={t => setForm({ ...form, notes: t })} placeholder="준비물, 기억할 점 등" multiline />
        </Field>
        <SelectRow
          label="아티스트"
          value={form.artistId}
          options={artists.map(a => ({ value: a.id, label: `${a.emoji ?? ''} ${a.name}` }))}
          onChange={(v) => setForm({ ...form, artistId: v as number | undefined })}
        />

        {onDelete && (
          <Pressable onPress={onDelete}
                     style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}>
            <Text style={{ color: Colors.heart, fontFamily: Fonts.semibold }}>🗑 공연 삭제</Text>
          </Pressable>
        )}
      </KeyboardAwareScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: Spacing.lg, height: 48 },
  navTitle: { fontSize: FontSizes.title, fontFamily: Fonts.semibold },
  posterWrap: {
    position: 'relative',
  },
  poster: {
    width: SCREEN_WIDTH,
    height: POSTER_HEIGHT,
    backgroundColor: '#f0f0f0',
  },
  posterPlaceholder: {
    width: SCREEN_WIDTH,
    height: POSTER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 80,
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: FontSizes.body,
    color: Colors.textSub,
    fontFamily: Fonts.medium,
  },
  categoryBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  categoryBadgeIcon: {
    fontSize: 18,
  },
  categoryBadgeText: {
    fontSize: FontSizes.caption,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  },
  titleBlock: {
    padding: Spacing.lg,
  },
  dday: {
    fontSize: FontSizes.caption,
    fontFamily: Fonts.bold,
  },
  eventTitle: {
    fontSize: FontSizes.h2,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginTop: 4,
  },
  eventSub: {
    fontSize: FontSizes.body,
    color: Colors.textSub,
    marginTop: 6,
  },
  deleteBtn: { marginTop: Spacing.xl, padding: Spacing.md, alignItems: 'center',
               borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.heart, borderRadius: 6 },
  naverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.md,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  naverBtnIcon: {
    fontSize: 24,
  },
  naverBtnTitle: {
    fontSize: FontSizes.body,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  },
  naverBtnSub: {
    fontSize: FontSizes.caption,
    color: Colors.textSub,
    marginTop: 2,
  },
});
