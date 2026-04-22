import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, FontSizes, Spacing, chipBg } from '@/theme/theme';
import { Divider, CategoryChip, PrimaryButton, SecondaryButton } from '@/components/UI';
import { Field, TextField, DateField, TimeField, CategoryPicker, SelectRow } from '@/components/Form';
import { getEventById, updateEvent, deleteEvent } from '@/db/events';
import { getAllArtists } from '@/db/artists';
import { iconForCategory, CATEGORIES } from '@/db/schema';
import type { Event, Artist } from '@/types';

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const eventId = Number(id);

  const [ev, setEv] = useState<Event | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Event>>({});

  const load = useCallback(async () => {
    const [e, a] = await Promise.all([getEventById(eventId), getAllArtists('all')]);
    setEv(e); setArtists(a);
    if (e) setForm(e);
  }, [eventId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!ev) return <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></SafeAreaView>;

  const dday = daysUntil(ev.date);
  const label = dday === 0 ? 'D-DAY' : dday > 0 ? `D-${dday}` : `D+${-dday}`;

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
        <Pressable onPress={() => setEditing(true)} hitSlop={8}>
          <Text style={{ fontSize: 14, color: Colors.primary, fontFamily: Fonts.semibold }}>수정</Text>
        </Pressable>
      </View>
      <Divider />

      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: dday <= 7 && dday >= 0 ? '#ffe5ec' : chipBg(ev.category) }]}>
          <Text style={[styles.dday, { color: dday <= 7 && dday >= 0 ? Colors.heart : Colors.text }]}>{label}</Text>
          <Text style={styles.eventTitle}>{ev.catIcon ?? '🎵'} {ev.title}</Text>
          <Text style={styles.eventSub}>
            {ev.date}{ev.weekday ? ` (${ev.weekday})` : ''}{ev.time ? ` · ${ev.time}` : ''}
          </Text>
          <View style={{ marginTop: 10 }}>
            <CategoryChip category={ev.category} />
          </View>
        </View>

        <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
          {ev.venue && <InfoRow icon="📍" label="장소" value={ev.venue} />}
          {ev.city && <InfoRow icon="🏙" label="도시" value={ev.city} />}
          {ev.price && <InfoRow icon="💰" label="가격·좌석" value={ev.price} />}
          {ev.notes && <InfoRow icon="📝" label="메모" value={ev.notes} />}
          {ev.ticketUrl && <InfoRow icon="🔗" label="티켓" value={ev.ticketUrl} />}
        </View>

        {/* 출처 표기 — 데이터 원천에 따라 자동 표시 */}
        {ev.source && ev.source !== 'manual' && (
          <View style={styles.attributionBox}>
            <Text style={styles.attributionLabel}>데이터 출처</Text>
            <Text style={styles.attributionValue}>
              {attributionText(ev.source)}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function attributionText(source: string): string {
  switch (source) {
    case 'kopis':      return '공연예술통합전산망 (KOPIS) · www.kopis.or.kr';
    case 'wikipedia':  return '한국어 위키백과 · ko.wikipedia.org';
    case 'sync-auto':  return '자동 동기화';
    default:           return source;
  }
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
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: Spacing.lg, height: 48 },
  navTitle: { fontSize: FontSizes.title, fontFamily: Fonts.semibold },
  hero: { padding: Spacing.xl, gap: 6 },
  dday: { fontSize: 40, fontFamily: Fonts.bold },
  eventTitle: { fontSize: FontSizes.h2, fontFamily: Fonts.bold, marginTop: 8 },
  eventSub: { fontSize: FontSizes.body, color: Colors.textSub, marginTop: 4 },
  deleteBtn: { marginTop: Spacing.xl, padding: Spacing.md, alignItems: 'center',
               borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.heart, borderRadius: 6 },
  attributionBox: { marginHorizontal: Spacing.lg, marginBottom: Spacing.xl,
                    padding: Spacing.md, borderRadius: 6,
                    backgroundColor: Colors.bgMuted,
                    borderLeftWidth: 3, borderLeftColor: Colors.textFaint },
  attributionLabel: { fontSize: FontSizes.tiny, color: Colors.textSub,
                      fontFamily: Fonts.semibold, marginBottom: 2 },
  attributionValue: { fontSize: FontSizes.caption, color: Colors.textSub },
});
