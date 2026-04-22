import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator, Image } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, FontSizes, Spacing, chipBg } from '@/theme/theme';
import { Divider, CategoryChip, Stars } from '@/components/UI';
import { Field, TextField, DateField, CategoryPicker, RatingPicker, SelectRow, PhotoField } from '@/components/Form';
import { parseTicketText } from '@/services/ticketParser';
import { getTicketById, updateTicket, deleteTicket } from '@/db/tickets';
import { getAllArtists } from '@/db/artists';
import { iconForCategory, CATEGORIES } from '@/db/schema';
import type { Ticket, Artist } from '@/types';

export default function TicketDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const ticketId = Number(id);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Ticket>>({});

  const load = useCallback(async () => {
    const [t, a] = await Promise.all([getTicketById(ticketId), getAllArtists('all')]);
    setTicket(t); setArtists(a);
    if (t) setForm(t);
  }, [ticketId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!ticket) return <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></SafeAreaView>;

  const save = async () => {
    if (!form.title?.trim()) { Alert.alert('제목이 비어있어요'); return; }
    if (!form.date) { Alert.alert('날짜를 입력하세요'); return; }
    await updateTicket(ticketId, {
      ...form,
      catIcon: iconForCategory(form.category),
      month: form.date?.slice(0, 7),
    });
    setEditing(false);
    await load();
  };

  const onDelete = () => {
    Alert.alert('티켓 삭제', '되돌릴 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { await deleteTicket(ticketId); router.back(); } },
    ]);
  };

  if (editing) {
    return (
      <TicketFormView
        title="티켓 수정"
        form={form} setForm={setForm}
        artists={artists}
        onCancel={() => { setForm(ticket); setEditing(false); }}
        onSave={save}
        onDelete={onDelete}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={{ fontSize: 22 }}>‹</Text></Pressable>
        <Text style={styles.navTitle}>공연 기록</Text>
        <Pressable onPress={() => setEditing(true)} hitSlop={8}>
          <Text style={{ color: Colors.primary, fontFamily: Fonts.semibold }}>수정</Text>
        </Pressable>
      </View>
      <Divider />

      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        {/* 사진이 있으면 크게, 없으면 이모지 스텁 */}
        {ticket.photoUri ? (
          <Image source={{ uri: ticket.photoUri }} style={styles.heroPhoto} />
        ) : (
          <View style={[styles.stub, { backgroundColor: Colors.fill }]}>
            <Text style={{ fontSize: 56 }}>{ticket.catIcon ?? '▦'}</Text>
          </View>
        )}
        <View style={{ padding: Spacing.lg }}>
          <Text style={styles.stubTitle}>{ticket.title}</Text>
          <CategoryChip category={ticket.category} />
          <Text style={{ fontSize: FontSizes.caption, color: Colors.ink3, marginTop: 8, fontFamily: Fonts.mono }}>
            {ticket.date}{ticket.venue ? ` · ${ticket.venue}` : ''}
          </Text>
          {ticket.seat && <Text style={{ fontSize: FontSizes.tiny, color: Colors.ink3 }}>{ticket.seat}</Text>}
          <View style={{ marginTop: 14 }}><Stars value={ticket.rating} size={22} /></View>
        </View>

        {ticket.notes && (
          <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg }}>
            <Text style={{ fontSize: FontSizes.caption, color: Colors.ink3, marginBottom: 6 }}>메모</Text>
            <Text style={{ fontSize: FontSizes.body, color: Colors.ink, lineHeight: 22 }}>{ticket.notes}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function TicketFormView({ title, form, setForm, artists, onSave, onCancel, onDelete }: {
  title: string;
  form: Partial<Ticket>;
  setForm: (f: Partial<Ticket>) => void;
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
        <Field label="티켓 사진">
          <PhotoField
            value={form.photoUri}
            onChange={(uri) => setForm({ ...form, photoUri: uri })}
            onExtractRequest={(_uri, text) => {
              if (!text) return;
              const parsed = parseTicketText(text);
              const next: Partial<Ticket> = { ...form };
              // 기존 값이 비어있는 필드만 채움 (덮어쓰지 않음)
              if (parsed.title && !form.title?.trim())   next.title = parsed.title;
              if (parsed.date && !form.date)             next.date = parsed.date;
              if (parsed.venue && !form.venue?.trim())   next.venue = parsed.venue;
              if (parsed.seat && !form.seat?.trim())     next.seat = parsed.seat;
              if (parsed.category && form.category === '콘서트') next.category = parsed.category;
              setForm(next);
              Alert.alert(
                '자동 추출 완료',
                [
                  parsed.title && `제목: ${parsed.title}`,
                  parsed.date && `날짜: ${parsed.date}`,
                  parsed.time && `시간: ${parsed.time}`,
                  parsed.venue && `장소: ${parsed.venue}`,
                  parsed.seat && `좌석: ${parsed.seat}`,
                  parsed.category && `카테고리: ${parsed.category}`,
                ].filter(Boolean).join('\n') || '추출된 정보가 없어요. 수동으로 입력해주세요.'
              );
            }}
          />
        </Field>
        <Field label="제목" required>
          <TextField value={form.title ?? ''} onChangeText={t => setForm({ ...form, title: t })} placeholder="예) 두산 vs LG 직관" />
        </Field>
        <Field label="카테고리">
          <CategoryPicker
            value={form.category ?? '콘서트'}
            onChange={v => setForm({ ...form, category: v })}
            options={CATEGORIES as any}
          />
        </Field>
        <Field label="관람 날짜" required>
          <DateField value={form.date ?? ''} onChangeText={t => setForm({ ...form, date: t })} />
        </Field>
        <Field label="장소">
          <TextField value={form.venue ?? ''} onChangeText={t => setForm({ ...form, venue: t })} placeholder="예) 잠실 종합운동장" />
        </Field>
        <Field label="좌석">
          <TextField value={form.seat ?? ''} onChangeText={t => setForm({ ...form, seat: t })} placeholder="1루 124블록 12번" />
        </Field>
        <Field label="별점">
          <RatingPicker value={form.rating ?? 0} onChange={n => setForm({ ...form, rating: n })} />
        </Field>
        <Field label="메모">
          <TextField value={form.notes ?? ''} onChangeText={t => setForm({ ...form, notes: t })} placeholder="기억에 남는 순간" multiline />
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
            <Text style={{ color: Colors.heart, fontFamily: Fonts.semibold }}>🗑 티켓 삭제</Text>
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
  stub: { padding: Spacing.xxl, alignItems: 'center', margin: Spacing.lg, borderRadius: 14 },
  stubTitle: { fontSize: FontSizes.h2, fontFamily: Fonts.bold, marginTop: 12, marginBottom: 10, textAlign: 'center' },
  heroPhoto: { width: '100%', aspectRatio: 3 / 4, resizeMode: 'cover' },
  deleteBtn: { marginTop: Spacing.xl, padding: Spacing.md, alignItems: 'center',
               borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.heart, borderRadius: 6 },
});
