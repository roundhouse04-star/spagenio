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
  ActivityIndicator, Platform, Linking, Modal, TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { getDB } from '@/db/database';
import { getTripById } from '@/db/trips';
import { isProActive } from '@/utils/proStatus';
import { composeVideo, type VideoComposeResult } from '@/utils/video/composeVideo';
import type { Trip } from '@/types';

// 사진 + 자막
interface PhotoItem {
  uri: string;
  caption: string;    // 영상에 자막으로 들어감 (빈 문자열이면 자막 없음)
}

// 날짜별 사진 그룹
interface DayPhotos {
  day: number;        // 1, 2, 3, ...
  date: string;       // 'YYYY-MM-DD'
  photos: PhotoItem[];
}

type Mode = 'edit' | 'processing' | 'result';

// AsyncStorage 키 (트립별 사진/자막 저장)
const STORAGE_KEY = (tripId: number) => `make_video_v1_${tripId}`;

export default function MakeVideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = parseInt(id, 10);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [days, setDays] = useState<DayPhotos[]>([]);
  const [mode, setMode] = useState<Mode>('edit');
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);

  // 영상 합성 결과
  const [videoResult, setVideoResult] = useState<VideoComposeResult | null>(null);
  const [progressStep, setProgressStep] = useState('영상 만드는 중...');

  // 자막 편집 모달 상태
  const [captionTarget, setCaptionTarget] = useState<{ dayIdx: number; photoIdx: number } | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');

  // ─── 초기 로드: 트립 정보 + 사진 자동 임포트 + 저장된 편집 복원 ────
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

      // 1) AsyncStorage 에 이전 편집 상태 있으면 복원
      let resolvedDays: DayPhotos[] | null = null;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY(tripId));
        if (raw) {
          const saved = JSON.parse(raw) as { days: DayPhotos[] };
          if (saved.days && saved.days.length > 0) {
            resolvedDays = saved.days;
          }
        }
      } catch { /* 무시 — 자동 임포트로 fallback */ }

      // 2) 저장 없으면 trip_logs 에서 자동 임포트
      if (!resolvedDays) {
        resolvedDays = await importPhotosByDay(tripId, t);
      }
      setDays(resolvedDays);

      // PRO 상태 확인
      try {
        const pro = await isProActive();
        setIsPro(pro);
      } catch {
        setIsPro(false);
      }

      setLoading(false);
    })();
  }, [tripId]);

  // ─── days 변경 시 자동 저장 (debounce 없이 즉시) ─────────────────
  useEffect(() => {
    if (loading || !Number.isFinite(tripId)) return;
    AsyncStorage.setItem(STORAGE_KEY(tripId), JSON.stringify({ days })).catch(() => undefined);
  }, [days, loading, tripId]);

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
    const newPhotos: PhotoItem[] = res.assets.map((a) => ({ uri: a.uri, caption: '' }));
    setDays((prev) => prev.map((d, i) =>
      i === dayIdx ? { ...d, photos: [...d.photos, ...newPhotos] } : d,
    ));
  }, []);

  // ─── 액션: 사진 삭제 ──────────────────────────────────────────────
  const removePhoto = useCallback((dayIdx: number, photoIdx: number) => {
    haptic.tap();
    setDays((prev) => prev.map((d, i) =>
      i === dayIdx ? { ...d, photos: d.photos.filter((_, j) => j !== photoIdx) } : d,
    ));
  }, []);

  // ─── 액션: 자막 편집 시작 ─────────────────────────────────────────
  const openCaptionEditor = useCallback((dayIdx: number, photoIdx: number) => {
    haptic.tap();
    const current = days[dayIdx]?.photos[photoIdx]?.caption ?? '';
    setCaptionDraft(current);
    setCaptionTarget({ dayIdx, photoIdx });
  }, [days]);

  // ─── 액션: 자막 저장 ────────────────────────────────────────────
  const saveCaption = useCallback(() => {
    if (!captionTarget) return;
    haptic.medium();
    const { dayIdx, photoIdx } = captionTarget;
    setDays((prev) => prev.map((d, i) =>
      i === dayIdx
        ? {
            ...d,
            photos: d.photos.map((p, j) =>
              j === photoIdx ? { ...p, caption: captionDraft.trim().slice(0, 40) } : p,
            ),
          }
        : d,
    ));
    setCaptionTarget(null);
    setCaptionDraft('');
  }, [captionTarget, captionDraft]);

  const cancelCaption = useCallback(() => {
    setCaptionTarget(null);
    setCaptionDraft('');
  }, []);

  // ─── 액션: 영상 만들기 (실제 ffmpeg 합성) ───────────────────────
  const makeVideo = useCallback(async () => {
    if (!trip) return;
    const allPhotos = days.flatMap((d) => d.photos);
    if (allPhotos.length < 2) {
      Alert.alert('사진이 부족해요', '최소 2장 이상의 사진이 필요해요.');
      return;
    }

    // PRO 사용자 제한 안내
    const maxPhotos = isPro ? 20 : 10;
    if (allPhotos.length > maxPhotos && !isPro) {
      Alert.alert(
        'PRO 업그레이드',
        `무료는 사진 10장까지 영상에 포함됩니다 (현재 ${allPhotos.length}장).\nPRO 에서는 20장 + HD 1080p + 60초까지 가능해요.`,
        [
          { text: '취소', style: 'cancel' },
          { text: 'PRO 보기', onPress: () => router.push('/pro' as any) },
          { text: '10장으로 진행', onPress: () => startCompose() },
        ],
      );
      return;
    }
    startCompose();

    async function startCompose() {
      haptic.medium();
      setMode('processing');
      setProgressStep('사진 준비 중...');
      setVideoResult(null);

      // 작업 단계 시각화 (UX 용 — ffmpeg 실행 중)
      const stepTimer = setInterval(() => {
        setProgressStep((prev) => {
          if (prev.includes('사진')) return 'BGM 매칭 중...';
          if (prev.includes('BGM')) return '자막 추가 중...';
          if (prev.includes('자막')) return '영상 인코딩 중...';
          return '마무리 중...';
        });
      }, 4000);

      try {
        const result = await composeVideo({
          tripId: trip!.id,
          tripTitle: trip!.title,
          photos: allPhotos,
          isPro,
          watermark: !isPro,
        });
        clearInterval(stepTimer);

        if (result.ok) {
          haptic.heavy();
          setVideoResult(result);
          setMode('result');
        } else {
          setMode('edit');
          Alert.alert('영상 생성 실패', result.error ?? '잠시 후 다시 시도해주세요.');
          console.warn('[make-video] compose failed:', result.error, result.logs);
        }
      } catch (err) {
        clearInterval(stepTimer);
        setMode('edit');
        Alert.alert('영상 생성 실패', String(err));
      }
    }
  }, [trip, days, isPro]);

  // ─── 공유: 사진앱 저장 (expo-media-library) ─────────────────────
  const saveToPhotos = useCallback(async () => {
    if (!videoResult?.outputPath) return;
    haptic.tap();
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          '권한 필요',
          '사진앱에 저장하려면 사진 접근 권한이 필요해요. 설정에서 허용해주세요.',
        );
        return;
      }
      await MediaLibrary.saveToLibraryAsync(videoResult.outputPath);
      Alert.alert('저장 완료', '사진앱에 영상이 저장됐어요.');
    } catch (err) {
      Alert.alert('저장 실패', String(err));
    }
  }, [videoResult]);

  // ─── 공유: 카톡 / iOS Share Sheet ────────────────────────────────
  const shareKakao = useCallback(async () => {
    if (!videoResult?.outputPath) return;
    haptic.tap();
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('공유 불가', '이 기기에서는 공유 기능을 사용할 수 없어요.');
        return;
      }
      // iOS Share Sheet — 카톡 / 메시지 / 메일 등 사용자가 선택
      await Sharing.shareAsync(videoResult.outputPath, {
        mimeType: 'video/mp4',
        dialogTitle: '여행 영상 공유',
        UTI: 'public.mpeg-4',
      });
    } catch (err) {
      Alert.alert('공유 실패', String(err));
    }
  }, [videoResult]);

  // ─── 공유: 인스타 스토리 (deep link 실제 동작) ──────────────────
  const shareInstagram = useCallback(async () => {
    if (!videoResult?.outputPath) return;
    haptic.tap();
    try {
      // 1) 인스타 deep link 가 동작하려면 영상이 사진앱에 먼저 저장돼있어야 함
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          '권한 필요',
          '인스타 스토리 공유를 위해 사진 접근 권한이 필요해요.',
        );
        return;
      }
      await MediaLibrary.saveToLibraryAsync(videoResult.outputPath);

      // 2) 인스타 스토리 deep link
      const url = 'instagram-stories://share?source_application=com.triplive.app';
      const supported = await Linking.canOpenURL(url).catch(() => false);
      if (!supported) {
        Alert.alert(
          '인스타 미설치',
          '인스타그램 앱이 설치되어 있어야 스토리 공유가 가능해요.\n영상은 사진앱에 저장되었으니 직접 올릴 수 있어요.',
        );
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('공유 실패', String(err));
    }
  }, [videoResult]);

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
            isPro={isPro}
            onAddPhotos={addPhotos}
            onRemovePhoto={removePhoto}
            onOpenCaption={openCaptionEditor}
            onMakeVideo={makeVideo}
            styles={styles}
            colors={colors}
          />
        )}
        {mode === 'processing' && <ProcessingMode progressStep={progressStep} styles={styles} colors={colors} />}
        {mode === 'result' && videoResult?.outputPath && (
          <ResultMode
            trip={trip}
            days={days}
            videoUri={videoResult.outputPath}
            durationSec={videoResult.durationSec}
            onSaveToPhotos={saveToPhotos}
            onShareKakao={shareKakao}
            onShareInstagram={shareInstagram}
            onRemake={() => { setVideoResult(null); setMode('edit'); }}
            styles={styles}
            colors={colors}
          />
        )}

        {/* 자막 편집 모달 */}
        <Modal
          visible={!!captionTarget}
          transparent
          animationType="fade"
          onRequestClose={cancelCaption}
        >
          <KeyboardAvoidingView
            style={styles.modalBg}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.captionModal}>
              {captionTarget && (
                <Image
                  source={{ uri: days[captionTarget.dayIdx]?.photos[captionTarget.photoIdx]?.uri }}
                  style={styles.captionModalImg}
                />
              )}
              <Text style={styles.captionModalTitle}>📝 사진 자막</Text>
              <Text style={styles.captionModalDesc}>
                영상에 자막으로 들어갑니다 (최대 40자)
              </Text>
              <TextInput
                style={styles.captionInput}
                value={captionDraft}
                onChangeText={setCaptionDraft}
                placeholder="예: 신주쿠 야경, 이치란 라멘…"
                placeholderTextColor={colors.textTertiary}
                maxLength={40}
                autoFocus
                multiline={false}
                returnKeyType="done"
                onSubmitEditing={saveCaption}
              />
              <Text style={styles.captionCount}>{captionDraft.length} / 40</Text>
              <View style={styles.captionBtnRow}>
                <Pressable style={[styles.captionBtn, styles.captionBtnCancel]} onPress={cancelCaption}>
                  <Text style={styles.captionBtnTextCancel}>취소</Text>
                </Pressable>
                <Pressable style={[styles.captionBtn, styles.captionBtnSave]} onPress={saveCaption}>
                  <Text style={styles.captionBtnTextSave}>저장</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </>
  );
}

// ─── 모드: 편집 ─────────────────────────────────────────────────
function EditMode({
  trip, days, isPro, onAddPhotos, onRemovePhoto, onOpenCaption, onMakeVideo,
  styles, colors,
}: any) {
  const totalPhotos = days.reduce((s: number, d: DayPhotos) => s + d.photos.length, 0);
  const canMake = totalPhotos >= 2;
  const maxPhotos = isPro ? 20 : 10;
  const overLimit = !isPro && totalPhotos > maxPhotos;

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

      {/* PRO 안내 (무료 사용자만) */}
      {!isPro && (
        <Pressable
          style={styles.proBanner}
          onPress={() => { haptic.tap(); router.push('/pro' as any); }}
        >
          <Text style={styles.proIcon}>✨</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.proTitle}>Triplive PRO 로 더 멋진 영상</Text>
            <Text style={styles.proDesc}>HD 1080p · 60초 · 사진 20장 · 워터마크 제거</Text>
          </View>
          <Text style={styles.proArrow}>›</Text>
        </Pressable>
      )}

      {/* 안내 */}
      <View style={styles.tipCard}>
        <Text style={styles.tipText}>
          📷 트립 기록의 사진들이 날짜별로 자동 추가됐어요.
          {'\n'}원하는 사진은 빼거나 [+]로 더 추가하세요. 사진을 탭하면 자막을 넣을 수 있어요.
        </Text>
      </View>

      {/* 사진 수 제한 안내 */}
      {overLimit && (
        <View style={styles.limitCard}>
          <Text style={styles.limitText}>
            ⚠️ 무료는 {maxPhotos}장까지 영상에 포함됩니다 (현재 {totalPhotos}장).
            나머지는 PRO 에서 가능해요.
          </Text>
        </View>
      )}

      {/* 날짜별 사진 */}
      {days.map((day: DayPhotos, idx: number) => (
        <View key={day.date} style={styles.daySection}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayLabel}>📅 Day {day.day}</Text>
            <Text style={styles.dayDate}>{day.date}</Text>
            <Text style={styles.dayCount}>{day.photos.length}장</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
            {day.photos.map((photo: PhotoItem, pIdx: number) => (
              <View key={`${photo.uri}-${pIdx}`} style={styles.photoCardWrap}>
                <Pressable
                  style={styles.photoCard}
                  onPress={() => onOpenCaption(idx, pIdx)}
                >
                  <Image source={{ uri: photo.uri }} style={styles.photoImg} />
                  <Pressable
                    style={styles.photoDelete}
                    onPress={() => onRemovePhoto(idx, pIdx)}
                    hitSlop={8}
                  >
                    <Text style={styles.photoDeleteX}>✕</Text>
                  </Pressable>
                  {/* 자막 오버레이 (있을 때) */}
                  {photo.caption.length > 0 && (
                    <View style={styles.captionOverlay}>
                      <Text style={styles.captionOverlayText} numberOfLines={2}>
                        📝 {photo.caption}
                      </Text>
                    </View>
                  )}
                </Pressable>
                {/* 자막 힌트 (없을 때) */}
                {photo.caption.length === 0 && (
                  <Text style={styles.captionHint} numberOfLines={1}>탭하여 자막</Text>
                )}
              </View>
            ))}
            <Pressable style={styles.photoAdd} onPress={() => onAddPhotos(idx)}>
              <Text style={styles.photoAddIcon}>＋</Text>
              <Text style={styles.photoAddText}>추가</Text>
            </Pressable>
          </ScrollView>
        </View>
      ))}

      <Text style={styles.note}>
        💡 영상은 무음으로 만들어져요. 인스타 스토리에 올릴 때 직접 음악을 추가할 수 있어요.
        {'\n'}생성에 1~2분 정도 걸립니다.
      </Text>

      {/* 만들기 버튼 */}
      <Pressable
        style={[styles.makeBtn, !canMake && styles.makeBtnDisabled]}
        onPress={onMakeVideo}
        disabled={!canMake}
      >
        <Text style={styles.makeBtnText}>
          {canMake ? `🎬 영상 만들기 (${Math.min(totalPhotos, maxPhotos)}장)` : '사진 2장 이상 필요'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── 모드: 처리 중 ─────────────────────────────────────────────
function ProcessingMode({ progressStep, styles, colors }: any) {
  return (
    <View style={[styles.scroll, styles.center, { flex: 1 }]}>
      <Text style={styles.processingEmoji}>🎬</Text>
      <Text style={styles.processingTitle}>영상 만드는 중…</Text>
      <Text style={styles.processingDesc}>1~2분 정도 걸려요</Text>
      <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: Spacing.lg }} />
      <Text style={styles.processingStep}>{progressStep}</Text>
    </View>
  );
}

// ─── 모드: 결과 ────────────────────────────────────────────────
function ResultMode({
  trip, days, videoUri, durationSec,
  onSaveToPhotos, onShareKakao, onShareInstagram, onRemake,
  styles, colors,
}: any) {
  const totalPhotos = days.reduce((s: number, d: DayPhotos) => s + d.photos.length, 0);

  // expo-video — 사용자가 만든 영상 자동 재생 + 반복
  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
    p.play();
  });

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* 영상 재생기 (실제 합성된 영상) */}
      <View style={styles.previewBox}>
        <VideoView
          player={player}
          style={styles.previewImg}
          contentFit="cover"
          nativeControls={true}
        />
      </View>

      <View style={styles.resultMeta}>
        <Text style={styles.resultTitle}>🎬 {trip?.title}</Text>
        <Text style={styles.resultStat}>
          {totalPhotos}장 · {Math.round(durationSec)}초 · 무음
        </Text>
      </View>

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
      const items: PhotoItem[] = imgs.map((uri) => ({ uri, caption: '' }));
      const dayIdx = days.findIndex((d) => d.date === row.log_date);
      if (dayIdx >= 0) {
        days[dayIdx].photos.push(...items);
      } else {
        // 트립 일자 밖이면 마지막 날에 추가
        days[days.length - 1].photos.push(...items);
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

    // PRO 안내 배너
    proBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: c.primary,
      borderRadius: 14,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      ...Shadows.sm,
    },
    proIcon: { fontSize: 28 },
    proTitle: { color: c.textOnPrimary, fontSize: Typography.bodyMedium, fontWeight: '800' },
    proDesc:  { color: c.textOnPrimary, fontSize: Typography.labelSmall, opacity: 0.9, marginTop: 2 },
    proArrow: { color: c.textOnPrimary, fontSize: 22, fontWeight: '800' },

    // 사진 수 제한 경고
    limitCard: {
      backgroundColor: '#FEF3C7',
      borderRadius: 10,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    limitText: { color: '#92400E', fontSize: Typography.labelMedium, lineHeight: 18 },

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
    photoRow: { gap: Spacing.sm, paddingVertical: Spacing.xs, alignItems: 'flex-start' },
    photoCardWrap: { width: 96, alignItems: 'center' },
    photoCard: {
      width: 96, height: 96, borderRadius: 8, overflow: 'hidden', position: 'relative',
    },
    photoImg: { width: '100%', height: '100%', backgroundColor: c.surfaceAlt },
    photoDelete: {
      position: 'absolute', top: 4, right: 4,
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: 'rgba(0,0,0,0.7)',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 2,
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

    // 자막 (사진 카드 위 오버레이)
    captionOverlay: {
      position: 'absolute', left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.65)',
      paddingHorizontal: 6, paddingVertical: 4,
    },
    captionOverlayText: {
      color: '#fff', fontSize: 10, fontWeight: '700', lineHeight: 12,
    },
    captionHint: {
      width: 96, fontSize: 10, color: c.accent,
      marginTop: 4, textAlign: 'center', fontWeight: '600',
    },

    // 자막 편집 모달
    modalBg: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center', justifyContent: 'center',
      padding: Spacing.lg,
    },
    captionModal: {
      width: '100%', maxWidth: 380,
      backgroundColor: c.surface, borderRadius: 20,
      padding: Spacing.xl, alignItems: 'center',
      ...Shadows.md,
    },
    captionModalImg: {
      width: 160, height: 160, borderRadius: 12,
      backgroundColor: c.surfaceAlt, marginBottom: Spacing.md,
    },
    captionModalTitle: {
      fontSize: Typography.titleSmall, fontWeight: '800',
      color: c.textPrimary, marginBottom: 4,
    },
    captionModalDesc: {
      fontSize: Typography.labelMedium, color: c.textTertiary,
      marginBottom: Spacing.md, textAlign: 'center',
    },
    captionInput: {
      width: '100%', borderWidth: 1.5, borderColor: c.border,
      borderRadius: 12, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
      fontSize: Typography.bodyMedium, color: c.textPrimary,
      backgroundColor: c.background,
    },
    captionCount: {
      alignSelf: 'flex-end', fontSize: Typography.labelSmall,
      color: c.textTertiary, marginTop: 4, marginBottom: Spacing.lg,
    },
    captionBtnRow: { flexDirection: 'row', gap: Spacing.md, width: '100%' },
    captionBtn: {
      flex: 1, paddingVertical: Spacing.md, borderRadius: 12,
      alignItems: 'center',
    },
    captionBtnCancel: { backgroundColor: c.surfaceAlt },
    captionBtnSave:   { backgroundColor: c.primary },
    captionBtnTextCancel: { color: c.textSecondary, fontWeight: '700', fontSize: Typography.bodyMedium },
    captionBtnTextSave:   { color: c.textOnPrimary, fontWeight: '800', fontSize: Typography.bodyMedium },

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
