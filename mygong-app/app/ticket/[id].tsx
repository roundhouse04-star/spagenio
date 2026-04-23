import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator, Image } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { Colors, Fonts, FontSizes, Spacing, Radius, chipBg } from '@/theme/theme';
import { Divider, CategoryChip, Stars } from '@/components/UI';
import { Field, TextField, DateField, CategoryPicker, RatingPicker, SelectRow } from '@/components/Form';
import { KeyboardAwareScroll } from '@/components/KeyboardAwareScroll';
import { getTicketById, updateTicket, deleteTicket } from '@/db/tickets';
import { getAllArtists } from '@/db/artists';
import { iconForCategory, CATEGORIES, getRatingItems } from '@/db/schema';
import { extractTicketInfo } from '@/services/ticketOCR';
import { savePhoto, resolvePhotoUri, deletePhoto } from '@/services/ticketPhoto';
import { DetailedRating } from '@/components/DetailedRating';
import type { Ticket, Artist, DetailedRatings } from '@/types';

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
      { text: '삭제', style: 'destructive', onPress: async () => {
        // 사진 파일도 같이 삭제
        if (ticket.photoUri) {
          await deletePhoto(ticket.photoUri).catch(() => {});
        }
        await deleteTicket(ticketId);
        router.back();
      }},
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

  // 표시용 절대 경로 변환
  const displayPhotoUri = resolvePhotoUri(ticket.photoUri);

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
        {displayPhotoUri && (
          <View style={styles.photoWrap}>
            <Image source={{ uri: displayPhotoUri }} style={styles.photo} resizeMode="contain" />
          </View>
        )}

        <View style={[styles.stub, { backgroundColor: chipBg(ticket.category) }]}>
          <Text style={{ fontSize: 56 }}>{ticket.catIcon ?? '🎟️'}</Text>
          <Text style={styles.stubTitle}>{ticket.title}</Text>
          <CategoryChip category={ticket.category} />
          <Text style={{ fontSize: FontSizes.caption, color: Colors.textSub, marginTop: 8 }}>
            {ticket.date}{ticket.venue ? ` · ${ticket.venue}` : ''}
          </Text>
          {ticket.seat && <Text style={{ fontSize: FontSizes.tiny, color: Colors.textSub }}>{ticket.seat}</Text>}
          {ticket.price != null && ticket.price > 0 && (
            <Text style={{ fontSize: FontSizes.caption, color: Colors.textSub, marginTop: 4 }}>
              💰 {ticket.price.toLocaleString()}원
            </Text>
          )}
          <View style={{ marginTop: 14 }}><Stars n={ticket.rating} size={22} /></View>
        </View>

        {/* v2: 항목별 별점 표시 */}
        {ticket.detailedRatings && Object.values(ticket.detailedRatings).some(v => v > 0) && (
          <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg }}>
            <Text style={{ fontSize: FontSizes.caption, color: Colors.textSub, marginBottom: 8 }}>항목별 평가</Text>
            <View style={styles.detailBox}>
              {getRatingItems(ticket.category).map(item => {
                const score = ticket.detailedRatings?.[item.key] ?? 0;
                if (score === 0) return null;
                return (
                  <View key={item.key} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{item.label}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Stars n={score} size={14} />
                      <Text style={styles.detailScore}>{score}.0</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {ticket.notes && (
          <View style={{ padding: Spacing.lg }}>
            <Text style={{ fontSize: FontSizes.caption, color: Colors.textSub, marginBottom: 6 }}>메모</Text>
            <Text style={{ fontSize: FontSizes.body, color: Colors.text, lineHeight: 22 }}>{ticket.notes}</Text>
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
  const [ocrLoading, setOcrLoading] = useState(false);

  const processImage = async (uri: string) => {
    setOcrLoading(true);
    try {
      // 1) ImagePicker uri (임시) → Documents 로 영구 저장
      let permanentRel: string;
      try {
        permanentRel = await savePhoto(uri);
      } catch (e: any) {
        console.warn('[photo] save failed, using original uri', e);
        permanentRel = uri; // 백업: 원본 uri 사용
      }

      // 2) 폼에 영구 경로 저장
      setForm({ ...form, photoUri: permanentRel });

      // 3) OCR 실행 (원본 임시 uri 로)
      const info = await extractTicketInfo(uri);
      console.log('[ocr] result:', info);

      setForm(prev => ({
        ...prev,
        photoUri: permanentRel,
        title:    prev.title    || info.title    || prev.title,
        date:     prev.date     || info.date     || prev.date,
        venue:    prev.venue    || info.venue    || prev.venue,
        seat:     prev.seat     || info.seat     || prev.seat,
        category: prev.category || info.category || prev.category,
      }));

      const filled = [info.title, info.date, info.venue, info.seat].filter(Boolean).length;
      if (filled === 0) {
        Alert.alert('OCR 결과', '텍스트를 인식하지 못했어요.\n다시 촬영하거나 직접 입력해주세요.');
      } else {
        Alert.alert('OCR 완료',
          `${filled}개 항목이 자동으로 채워졌어요.\n인식이 정확하지 않을 수 있으니 확인 후 저장하세요.`);
      }
    } catch (e: any) {
      console.warn('[ocr] failed:', e?.message ?? e);
      Alert.alert('OCR 실패', e?.message ?? '이미지 처리에 실패했어요.');
    } finally {
      setOcrLoading(false);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('카메라 권한 필요', '설정에서 카메라 권한을 허용해주세요.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      await processImage(result.assets[0].uri);
    }
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('사진 권한 필요', '설정에서 사진 접근 권한을 허용해주세요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      await processImage(result.assets[0].uri);
    }
  };

  const removePhoto = async () => {
    // 영구 저장 파일이면 삭제
    if (form.photoUri) {
      await deletePhoto(form.photoUri).catch(() => {});
    }
    setForm({ ...form, photoUri: undefined });
  };

  // 표시용 절대 경로
  const displayPhotoUri = resolvePhotoUri(form.photoUri);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable onPress={onCancel} hitSlop={8}><Text style={{ color: Colors.textSub }}>취소</Text></Pressable>
        <Text style={styles.navTitle}>{title}</Text>
        <Pressable onPress={onSave} hitSlop={8} disabled={ocrLoading}>
          <Text style={{ color: ocrLoading ? Colors.textSub : Colors.primary, fontFamily: Fonts.semibold }}>저장</Text>
        </Pressable>
      </View>
      <Divider />
      <KeyboardAwareScroll contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 120 }}>
        {displayPhotoUri ? (
          <View style={styles.photoPreviewWrap}>
            <Image source={{ uri: displayPhotoUri }} style={styles.photoPreview} resizeMode="contain" />
            {ocrLoading && (
              <View style={styles.ocrOverlay}>
                <ActivityIndicator color="#fff" size="large" />
                <Text style={{ color: '#fff', marginTop: 8, fontFamily: Fonts.semibold }}>
                  티켓 정보 읽는 중…
                </Text>
              </View>
            )}
            <View style={styles.photoActions}>
              <Pressable onPress={takePhoto} style={styles.photoActionBtn}>
                <Text style={styles.photoActionText}>📷 다시 촬영</Text>
              </Pressable>
              <Pressable onPress={pickFromLibrary} style={styles.photoActionBtn}>
                <Text style={styles.photoActionText}>🖼 다시 선택</Text>
              </Pressable>
              <Pressable onPress={removePhoto} style={[styles.photoActionBtn, styles.removeBtn]}>
                <Text style={[styles.photoActionText, { color: Colors.heart }]}>✕ 제거</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.photoButtonRow}>
            <Pressable onPress={takePhoto} style={styles.photoButton} disabled={ocrLoading}>
              <Text style={styles.photoButtonIcon}>📷</Text>
              <Text style={styles.photoButtonText}>티켓 촬영</Text>
              <Text style={styles.photoButtonHint}>자동 정보 추출</Text>
            </Pressable>
            <Pressable onPress={pickFromLibrary} style={styles.photoButton} disabled={ocrLoading}>
              <Text style={styles.photoButtonIcon}>🖼</Text>
              <Text style={styles.photoButtonText}>앨범에서 선택</Text>
              <Text style={styles.photoButtonHint}>자동 정보 추출</Text>
            </Pressable>
          </View>
        )}

        {/* 안내 배너 */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerIcon}>💡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoBannerText}>
              사진 촬영 또는 앨범 선택 시{'\n'}
              제목·날짜·장소·좌석이 자동 입력됩니다
            </Text>
            <Text style={styles.infoBannerWarning}>
              ⚠️ 티켓 디자인이나 사진 상태에 따라{'\n'}
              인식이 정확하지 않을 수 있어요. 저장 전 꼭 확인해주세요.
            </Text>
          </View>
        </View>

        <Field label="제목" required>
          <TextField value={form.title ?? ''} onChangeText={t => setForm({ ...form, title: t })} placeholder="예) 아이유 콘서트" />
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
          <TextField value={form.venue ?? ''} onChangeText={t => setForm({ ...form, venue: t })} placeholder="예) 고척 스카이돔" />
        </Field>
        <Field label="좌석">
          <TextField value={form.seat ?? ''} onChangeText={t => setForm({ ...form, seat: t })} placeholder="1층 A구역 12열 15번" />
        </Field>
        <Field label="가격 (원)">
          <TextField
            value={form.price != null ? String(form.price) : ''}
            onChangeText={t => {
              const num = parseInt(t.replace(/[^0-9]/g, ''), 10);
              setForm({ ...form, price: isNaN(num) ? undefined : num });
            }}
            placeholder="165000"
            keyboardType="numeric"
          />
        </Field>
        <Field label="별점">
          <RatingPicker value={form.rating ?? 0} onChange={n => setForm({ ...form, rating: n })} />
        </Field>
        <Field label="항목별 평가 (선택)">
          <DetailedRating
            category={form.category}
            value={form.detailedRatings}
            onChange={(v: DetailedRatings) => setForm({ ...form, detailedRatings: v })}
          />
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
      </KeyboardAwareScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: Spacing.lg, height: 48 },
  navTitle: { fontSize: FontSizes.title, fontFamily: Fonts.semibold },
  stub: { padding: Spacing.xxl, alignItems: 'center', margin: Spacing.lg, borderRadius: 14 },
  stubTitle: { fontSize: FontSizes.h2, fontFamily: Fonts.bold, marginTop: 12, marginBottom: 10, textAlign: 'center' },
  deleteBtn: { marginTop: Spacing.xl, padding: Spacing.md, alignItems: 'center',
               borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.heart, borderRadius: 6 },

  photoButtonRow: { flexDirection: 'row', gap: 12, marginBottom: Spacing.md },
  photoButton: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24,
    backgroundColor: Colors.bgAlt ?? '#f7f5ee',
    borderRadius: Radius.md ?? 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.divider,
  },
  photoButtonIcon: { fontSize: 32, marginBottom: 6 },
  photoButtonText: { fontSize: FontSizes.body, fontFamily: Fonts.semibold, color: Colors.text },
  photoButtonHint: { fontSize: FontSizes.tiny, color: Colors.textSub, marginTop: 2 },

  photoPreviewWrap: {
    marginBottom: Spacing.md, borderRadius: Radius.md ?? 12, overflow: 'hidden', backgroundColor: '#000',
  },
  photoPreview: { width: '100%', height: 260 },
  ocrOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  photoActions: {
    flexDirection: 'row', backgroundColor: '#fafafa',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.divider,
  },
  photoActionBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  photoActionText: { fontSize: FontSizes.caption, fontFamily: Fonts.medium, color: Colors.text },
  removeBtn: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: Colors.divider },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fff8e1', borderRadius: Radius.md ?? 12,
    paddingVertical: 14, paddingHorizontal: 14, marginBottom: Spacing.lg, gap: 10,
  },
  infoBannerIcon: { fontSize: 18, marginTop: 1 },
  infoBannerText: { fontSize: FontSizes.tiny, color: '#7a5e00', lineHeight: 17, fontFamily: Fonts.medium },
  infoBannerWarning: {
    fontSize: FontSizes.tiny, color: '#a06700', lineHeight: 16,
    marginTop: 8, paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(122, 94, 0, 0.2)',
  },

  photoWrap: { backgroundColor: '#000', padding: Spacing.md },
  photo: { width: '100%', height: 320 },

  // v2: 항목별 별점 표시
  detailBox: {
    backgroundColor: Colors.bgMuted,
    borderRadius: 10,
    padding: Spacing.md,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: FontSizes.body,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  detailScore: {
    fontSize: FontSizes.caption,
    fontFamily: Fonts.semibold,
    color: Colors.textSub,
    minWidth: 26,
  },
});
