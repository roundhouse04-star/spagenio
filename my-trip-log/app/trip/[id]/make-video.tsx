/**
 * 여행 영상 만들기 화면 — 1.3 alpha (UI 흐름 + 영상 생성 stub)
 *
 * 흐름:
 *  1. mode='edit' — 날짜별 사진 등록 (trip_logs 자동 임포트) + BGM 선택
 *  2. mode='processing' — 영상 생성 진행 상황 (stub, 3초)
 *  3. mode='result' — 미리보기 + 3가지 공유 (사진앱/카톡/인스타)
 *
 * 1.3 beta 에서 실제 영상 생성 (ffmpeg-kit 또는 Skia) 통합.
 * alpha 는 UI/UX 검증 우선.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, Alert,
  ActivityIndicator, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { getDB } from '@/db/database';
import { getTripById } from '@/db/trips';
import type { Trip } from '@/types';

// ─── BGM 카테고리 (3개, 각 5곡 — alpha 에선 메타데이터만) ─────────────
interface BgmCategory {
  id: 'upbeat' | 'calm' | 'cinematic';
  label: string;
  emoji: string;
  desc: string;
}

const BGM_CATEGORIES: BgmCategory[] = [
  { id: 'upbeat',    label: '경쾌',  emoji: '🎉', desc: '출국·도시·액티비티' },
  { id: 'calm',      label: '잔잔',  emoji: '🌿', desc: '자연·풍경·휴양' },
  { id: 'cinematic', label: '세련',  emoji: '✨', desc: '야경·음식·도시' },
];

// 날짜별 사진 그룹
interface DayPhotos {
  day: number;        // 1, 2, 3, ...
  date: string;       // 'YYYY-MM-DD'
  photos: string[];   // 이미지 URI 배열
}

type Mode = 'edit' | 'processing' | 'result';

export default function MakeVideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = parseInt(id, 10);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [days, setDays] = useState<DayPhotos[]>([]);
  const [bgm, setBgm] = useState<BgmCategory['id']>('upbeat');
  const [mode, setMode] = useState<Mode>('edit');
  const [loading, setLoading] = useState(true);

  // ─── 초기 로드: 트립 정보 + 사진 자동 임포트 ─────────────────────────
  useEffect(() => {
    (async () => {
      if (!Number.isFinite(tripId)) return;
      const t = await getTripById(tripId);
      if (!t) {
        Alert.alert('트립을 찾을 수 없어요');
        router.back();
        return;
      }
      setTrip(t);

      // 날짜별 사진 자동 임포트 (trip_logs 에서)
      const importedDays = await importPhotosByDay(tripId, t);
      setDays(importedDays);
      setLoading(false);
    })();
  }, [tripId]);

  // ─── 액션: 사진 추가 ──────────────────────────────────────────────
  const addPhotos = useCallback(async (dayIdx: number) => {
    haptic.tap();
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.85,
    });
    if (res.canceled || !res.assets?.length) return;
    setDays((prev) => prev.map((d, i) =>
      i === dayIdx ? { ...d, photos: [...d.photos, ...res.assets.map((a) => a.uri)] } : d,
    ));
  }, []);

  // ─── 액션: 사진 삭제 ──────────────────────────────────────────────
  const removePhoto = useCallback((dayIdx: number, photoIdx: number) => {
    haptic.tap();
    setDays((prev) => prev.map((d, i) =>
      i === dayIdx ? { ...d, photos: d.photos.filter((_, j) => j !== photoIdx) } : d,
    ));
  }, []);

  // ─── 액션: 영상 만들기 (stub) ────────────────────────────────────
  const makeVideo = useCallback(async () => {
    const total = days.reduce((s, d) => s + d.photos.length, 0);
    if (total < 2) {
      Alert.alert('사진이 부족해요', '최소 2장 이상의 사진이 필요해요.');
      return;
    }
    haptic.medium();
    setMode('processing');

    // 1.3 alpha: stub — 실제 ffmpeg 영상 생성은 beta 에서
    // 3초 시뮬레이션 (실제로는 30초~1분)
    setTimeout(() => {
      haptic.heavy();
      setMode('result');
    }, 3000);
  }, [days]);

  // ─── 공유: 사진앱 저장 (stub, expo-sharing 사용) ──────────────────
  const saveToPhotos = useCallback(() => {
    haptic.tap();
    Alert.alert(
      '저장됨 (Demo)',
      '실제 1.3 beta 에서 영상 파일이 사진앱에 저장됩니다.',
    );
  }, []);

  // ─── 공유: 카톡 ────────────────────────────────────────────────
  const shareKakao = useCallback(async () => {
    haptic.tap();
    // 실제 1.3 beta: Kakao Sharing SDK
    // 지금은 iOS Share Sheet 로 대체
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        Alert.alert(
          '카톡 공유 (Demo)',
          '실제 1.3 beta 에서 영상 파일이 카톡으로 공유됩니다.',
        );
      } else {
        Alert.alert('공유 불가', '이 기기에서는 공유 기능을 사용할 수 없어요.');
      }
    } catch (err) {
      Alert.alert('공유 실패', String(err));
    }
  }, []);

  // ─── 공유: 인스타 스토리 (deep link, alpha 에선 안내) ──────────
  const shareInstagram = useCallback(async () => {
    haptic.tap();
    const url = 'instagram-stories://share?source_application=com.triplive.app';
    const supported = await Linking.canOpenURL(url).catch(() => false);
    if (supported) {
      Alert.alert(
        '인스타 스토리 공유 (Demo)',
        '실제 1.3 beta 에서 영상이 인스타 스토리로 자동 전송됩니다.',
      );
    } else {
      Alert.alert('인스타 미설치', '인스타그램 앱을 먼저 설치해주세요.');
    }
  }, []);

  // ─── 렌더 ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['top', 'bottom']}>
        <Stack.Screen options={{ title: '영상 만들기' }} />
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>사진 불러오는 중…</Text>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: mode === 'result' ? '완성!' : '여행 영상 만들기',
          headerBackTitle: '뒤로',
        }}
      />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {mode === 'edit' && (
          <EditMode
            trip={trip}
            days={days}
            bgm={bgm}
            onBgmChange={setBgm}
            onAddPhotos={addPhotos}
            onRemovePhoto={removePhoto}
            onMakeVideo={makeVideo}
            styles={styles}
            colors={colors}
          />
        )}
        {mode === 'processing' && <ProcessingMode styles={styles} colors={colors} />}
        {mode === 'result' && (
          <ResultMode
            trip={trip}
            days={days}
            bgm={bgm}
            onSaveToPhotos={saveToPhotos}
            onShareKakao={shareKakao}
            onShareInstagram={shareInstagram}
            onRemake={() => setMode('edit')}
            styles={styles}
            colors={colors}
          />
        )}
      </SafeAreaView>
    </>
  );
}

// ─── 모드: 편집 ─────────────────────────────────────────────────
function EditMode({
  trip, days, bgm, onBgmChange, onAddPhotos, onRemovePhoto, onMakeVideo,
  styles, colors,
}: any) {
  const totalPhotos = days.reduce((s: number, d: DayPhotos) => s + d.photos.length, 0);
  const canMake = totalPhotos >= 2;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* 트립 헤더 */}
      <View style={styles.tripHeader}>
        <Text style={styles.tripTitle}>{trip?.title}</Text>
        <Text style={styles.tripMeta}>
          📍 {[trip?.city, trip?.country].filter(Boolean).join(', ')}
        </Text>
        <Text style={styles.tripMeta}>
          🗓 {trip?.startDate}{trip?.endDate ? ` ~ ${trip.endDate}` : ''}
        </Text>
      </View>

      {/* 안내 */}
      <View style={styles.tipCard}>
        <Text style={styles.tipText}>
          📷 트립 기록의 사진들이 날짜별로 자동 추가됐어요.
          {'\n'}원하는 사진은 빼거나 [+]로 더 추가하세요.
        </Text>
      </View>

      {/* 날짜별 사진 */}
      {days.map((day: DayPhotos, idx: number) => (
        <View key={day.date} style={styles.daySection}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayLabel}>📅 Day {day.day}</Text>
            <Text style={styles.dayDate}>{day.date}</Text>
            <Text style={styles.dayCount}>{day.photos.length}장</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
            {day.photos.map((uri: string, pIdx: number) => (
              <View key={`${uri}-${pIdx}`} style={styles.photoCard}>
                <Image source={{ uri }} style={styles.photoImg} />
                <Pressable
                  style={styles.photoDelete}
                  onPress={() => onRemovePhoto(idx, pIdx)}
                  hitSlop={8}
                >
                  <Text style={styles.photoDeleteX}>✕</Text>
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.photoAdd} onPress={() => onAddPhotos(idx)}>
              <Text style={styles.photoAddIcon}>＋</Text>
              <Text style={styles.photoAddText}>추가</Text>
            </Pressable>
          </ScrollView>
        </View>
      ))}

      {/* BGM */}
      <Text style={styles.sectionTitle}>🎵 BGM 분위기</Text>
      <View style={styles.bgmRow}>
        {BGM_CATEGORIES.map((c) => (
          <Pressable
            key={c.id}
            style={[styles.bgmCard, bgm === c.id && styles.bgmCardActive]}
            onPress={() => { haptic.select(); onBgmChange(c.id); }}
          >
            <Text style={styles.bgmEmoji}>{c.emoji}</Text>
            <Text style={[styles.bgmLabel, bgm === c.id && { color: colors.textOnPrimary }]}>
              {c.label}
            </Text>
            <Text style={[styles.bgmDesc, bgm === c.id && { color: colors.textOnPrimary, opacity: 0.85 }]}>
              {c.desc}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.note}>
        💡 1.3 alpha — 영상 생성은 데모입니다. 실제 영상 생성은 다음 빌드에서!
      </Text>

      {/* 만들기 버튼 */}
      <Pressable
        style={[styles.makeBtn, !canMake && styles.makeBtnDisabled]}
        onPress={onMakeVideo}
        disabled={!canMake}
      >
        <Text style={styles.makeBtnText}>
          {canMake ? `🎬 영상 만들기 (${totalPhotos}장)` : '사진 2장 이상 필요'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── 모드: 처리 중 ─────────────────────────────────────────────
function ProcessingMode({ styles, colors }: any) {
  return (
    <View style={[styles.scroll, styles.center, { flex: 1 }]}>
      <Text style={styles.processingEmoji}>🎬</Text>
      <Text style={styles.processingTitle}>영상 만드는 중…</Text>
      <Text style={styles.processingDesc}>잠시만 기다려주세요</Text>
      <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: Spacing.lg }} />
      <Text style={styles.processingStep}>사진 합성 → BGM 매칭 → 자막 → 인코딩</Text>
    </View>
  );
}

// ─── 모드: 결과 ────────────────────────────────────────────────
function ResultMode({
  trip, days, bgm,
  onSaveToPhotos, onShareKakao, onShareInstagram, onRemake,
  styles, colors,
}: any) {
  const totalPhotos = days.reduce((s: number, d: DayPhotos) => s + d.photos.length, 0);
  const cat = BGM_CATEGORIES.find((c) => c.id === bgm);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* 미리보기 (alpha — 영상 대신 첫 사진 또는 placeholder) */}
      <View style={styles.previewBox}>
        {days.find((d: DayPhotos) => d.photos.length > 0)?.photos[0] ? (
          <Image
            source={{ uri: days.find((d: DayPhotos) => d.photos.length > 0)!.photos[0] }}
            style={styles.previewImg}
          />
        ) : (
          <View style={[styles.previewImg, { backgroundColor: colors.surfaceAlt }]} />
        )}
        <View style={styles.previewOverlay}>
          <Text style={styles.previewPlay}>▶</Text>
        </View>
      </View>

      <View style={styles.resultMeta}>
        <Text style={styles.resultTitle}>🎬 {trip?.title}</Text>
        <Text style={styles.resultStat}>{cat?.emoji} {cat?.label} · {totalPhotos}장</Text>
      </View>

      <Text style={styles.note}>
        💡 1.3 alpha — 영상 미리보기는 데모입니다. 실제 영상은 다음 빌드에서 생성됩니다.
      </Text>

      {/* 공유 버튼 3개 */}
      <Pressable style={[styles.shareBtn, styles.shareSave]} onPress={onSaveToPhotos}>
        <Text style={styles.shareEmoji}>💾</Text>
        <Text style={styles.shareLabel}>사진앱에 저장</Text>
      </Pressable>

      <Pressable style={[styles.shareBtn, styles.shareKakao]} onPress={onShareKakao}>
        <Text style={styles.shareEmoji}>💛</Text>
        <Text style={styles.shareLabel}>카톡으로 공유</Text>
      </Pressable>

      <Pressable style={[styles.shareBtn, styles.shareInsta]} onPress={onShareInstagram}>
        <Text style={styles.shareEmoji}>📷</Text>
        <Text style={styles.shareLabelLight}>인스타 스토리</Text>
      </Pressable>

      {/* 다시 만들기 */}
      <Pressable style={styles.remakeBtn} onPress={onRemake}>
        <Text style={styles.remakeText}>🔄 다시 만들기</Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── 헬퍼: 사진 자동 임포트 (trip_logs → 날짜별 그룹) ─────────────
async function importPhotosByDay(tripId: number, trip: Trip): Promise<DayPhotos[]> {
  // 1) 트립 일자별 빈 슬롯 만들기 (start_date ~ end_date)
  const days: DayPhotos[] = [];
  if (!trip.startDate) {
    return [{ day: 1, date: '날짜 미정', photos: [] }];
  }
  const start = new Date(trip.startDate);
  const end = trip.endDate ? new Date(trip.endDate) : start;
  const dayCount = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);

  for (let i = 0; i < Math.min(dayCount, 14); i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const isoDate = d.toISOString().slice(0, 10);
    days.push({ day: i + 1, date: isoDate, photos: [] });
  }

  // 2) trip_logs.images 에서 사진 임포트
  try {
    const db = await getDB();
    const rows = await db.getAllAsync<{ log_date: string; images: string | null }>(
      `SELECT log_date, images FROM trip_logs WHERE trip_id = ?1`,
      [tripId],
    );
    for (const row of rows) {
      if (!row.images) continue;
      let imgs: string[] = [];
      try { imgs = JSON.parse(row.images); } catch { continue; }
      if (!Array.isArray(imgs) || imgs.length === 0) continue;
      const dayIdx = days.findIndex((d) => d.date === row.log_date);
      if (dayIdx >= 0) {
        days[dayIdx].photos.push(...imgs);
      } else {
        // 트립 일자 밖이면 마지막 날에 추가
        days[days.length - 1].photos.push(...imgs);
      }
    }
  } catch (err) {
    console.warn('[make-video] importPhotosByDay failed:', err);
  }

  return days;
}

// ─── 스타일 ────────────────────────────────────────────────────
function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: Spacing.lg, paddingBottom: Spacing.huge },
    loadingText: { marginTop: Spacing.md, color: c.textSecondary },

    tripHeader: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      ...Shadows.sm,
    },
    tripTitle: {
      fontSize: Typography.titleLarge, fontWeight: '800',
      color: c.textPrimary, marginBottom: Spacing.sm,
    },
    tripMeta: { fontSize: Typography.bodyMedium, color: c.textSecondary, marginTop: 2 },

    tipCard: {
      backgroundColor: c.accent + '15',
      borderRadius: 12,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: c.accent,
    },
    tipText: { fontSize: Typography.labelMedium, color: c.textSecondary, lineHeight: 18 },

    daySection: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      ...Shadows.sm,
    },
    dayHeader: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm,
    },
    dayLabel: { fontSize: Typography.bodyMedium, fontWeight: '700', color: c.textPrimary },
    dayDate: { flex: 1, fontSize: Typography.labelMedium, color: c.textTertiary },
    dayCount: {
      backgroundColor: c.primary, color: c.textOnPrimary, fontSize: 11, fontWeight: '700',
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden',
    },
    photoRow: { gap: Spacing.sm, paddingVertical: Spacing.xs },
    photoCard: {
      width: 96, height: 96, borderRadius: 8, overflow: 'hidden', position: 'relative',
    },
    photoImg: { width: '100%', height: '100%', backgroundColor: c.surfaceAlt },
    photoDelete: {
      position: 'absolute', top: 4, right: 4,
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: 'rgba(0,0,0,0.7)',
      alignItems: 'center', justifyContent: 'center',
    },
    photoDeleteX: { color: '#fff', fontSize: 13, fontWeight: '700' },
    photoAdd: {
      width: 96, height: 96, borderRadius: 8, borderWidth: 2,
      borderColor: c.border, borderStyle: 'dashed',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.surfaceAlt,
    },
    photoAddIcon: { fontSize: 28, color: c.textTertiary },
    photoAddText: { fontSize: 11, color: c.textTertiary, marginTop: 2 },

    sectionTitle: {
      fontSize: Typography.bodyMedium, fontWeight: '700',
      color: c.textPrimary, marginTop: Spacing.lg, marginBottom: Spacing.md,
    },
    bgmRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    bgmCard: {
      flex: 1, backgroundColor: c.surface, borderRadius: 12,
      padding: Spacing.md, alignItems: 'center',
      borderWidth: 2, borderColor: c.border,
    },
    bgmCardActive: { backgroundColor: c.primary, borderColor: c.primary },
    bgmEmoji: { fontSize: 28, marginBottom: 4 },
    bgmLabel: { fontSize: Typography.bodyMedium, fontWeight: '700', color: c.textPrimary },
    bgmDesc: { fontSize: 10, color: c.textTertiary, marginTop: 2, textAlign: 'center' },

    note: {
      fontSize: Typography.labelSmall, color: c.textTertiary,
      fontStyle: 'italic', textAlign: 'center',
      marginVertical: Spacing.md,
    },

    makeBtn: {
      backgroundColor: c.primary,
      borderRadius: 16,
      padding: Spacing.lg,
      alignItems: 'center',
      marginTop: Spacing.md,
      ...Shadows.md,
    },
    makeBtnDisabled: { backgroundColor: c.surfaceAlt, opacity: 0.6 },
    makeBtnText: { color: c.textOnPrimary, fontSize: Typography.bodyLarge, fontWeight: '800' },

    processingEmoji: { fontSize: 64, marginBottom: Spacing.md },
    processingTitle: {
      fontSize: Typography.titleLarge, fontWeight: '800',
      color: c.textPrimary, marginBottom: Spacing.xs,
    },
    processingDesc: { fontSize: Typography.bodyMedium, color: c.textSecondary },
    processingStep: {
      marginTop: Spacing.lg,
      fontSize: Typography.labelSmall, color: c.textTertiary, fontStyle: 'italic',
    },

    previewBox: {
      aspectRatio: 9 / 16, maxHeight: 480,
      borderRadius: 16, overflow: 'hidden',
      backgroundColor: c.surface,
      marginBottom: Spacing.md,
      ...Shadows.md,
      position: 'relative',
    },
    previewImg: { width: '100%', height: '100%' },
    previewOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center', justifyContent: 'center',
    },
    previewPlay: { color: '#fff', fontSize: 80, opacity: 0.9 },

    resultMeta: { alignItems: 'center', marginBottom: Spacing.lg },
    resultTitle: {
      fontSize: Typography.titleMedium, fontWeight: '800',
      color: c.textPrimary, marginBottom: Spacing.xs,
    },
    resultStat: { fontSize: Typography.bodyMedium, color: c.textSecondary },

    shareBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: Spacing.md, padding: Spacing.lg, borderRadius: 12,
      marginBottom: Spacing.sm, ...Shadows.sm,
    },
    shareSave:  { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    shareKakao: { backgroundColor: '#FEE500' },
    shareInsta: { backgroundColor: '#E1306C' },
    shareEmoji: { fontSize: 24 },
    shareLabel: { fontSize: Typography.bodyLarge, fontWeight: '700', color: '#000' },
    shareLabelLight: { fontSize: Typography.bodyLarge, fontWeight: '700', color: '#fff' },

    remakeBtn: {
      paddingVertical: Spacing.md, alignItems: 'center',
      marginTop: Spacing.md,
    },
    remakeText: { color: c.textTertiary, fontSize: Typography.bodyMedium },
  });
}
