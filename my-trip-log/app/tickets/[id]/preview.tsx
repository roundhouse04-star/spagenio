import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image, Dimensions, ActivityIndicator,
  StatusBar as RNStatusBar, Alert, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Typography, Spacing } from '@/theme/theme';
import { haptic } from '@/utils/haptics';
import { getAllTickets, getTicket } from '@/db/tickets';
import { Ticket } from '@/types';

const { width: WIN_W, height: WIN_H } = Dimensions.get('window');

/**
 * 풀스크린 티켓 뷰어
 *
 * 의도적으로 Reanimated worklet을 사용하지 않음.
 * Expo Go SDK 54 + New Architecture 환경에서 worklet 초기화가 불안정해
 * "Exception in HostFunction" 으로 모듈 로딩이 실패하는 사례 회피.
 *
 * 줌은 iOS의 ScrollView maximumZoomScale 네이티브 기능 사용 (Android는 미지원).
 * 인접 티켓 이동은 좌우 화살표 버튼으로 제공 (스와이프 대신).
 */
export default function TicketPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const initialId = Number(id);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      try {
        const cur = await getTicket(initialId);
        if (cur) {
          setTickets([cur]);
          setCurrentIndex(0);
          setLoading(false);
        }
        const all = await getAllTickets({ sort: 'newest' });
        setTickets(all);
        const idx = all.findIndex((t) => t.id === initialId);
        setCurrentIndex(idx >= 0 ? idx : 0);
      } catch (err) {
        console.error('[티켓 미리보기 로드 실패]', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [initialId]);

  const goPrev = useCallback(() => {
    if (currentIndex <= 0) return;
    haptic.tap();
    setCurrentIndex((i) => i - 1);
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  }, [currentIndex]);

  const goNext = useCallback(() => {
    if (currentIndex >= tickets.length - 1) return;
    haptic.tap();
    setCurrentIndex((i) => i + 1);
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  }, [currentIndex, tickets.length]);

  const handleShare = async () => {
    haptic.tap();
    const t = tickets[currentIndex];
    if (!t) return;
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('알림', '이 기기에서는 공유 기능을 사용할 수 없어요');
        return;
      }
      await Sharing.shareAsync(t.imageUri);
    } catch (err) {
      console.error('[공유 실패]', err);
    }
  };

  const counter = useMemo(() => {
    return tickets.length > 0 ? `${currentIndex + 1} / ${tickets.length}` : '';
  }, [currentIndex, tickets.length]);

  if (loading || tickets.length === 0) {
    return (
      <View style={styles.fullscreen}>
        <ActivityIndicator color="#FFF" />
      </View>
    );
  }

  const t = tickets[currentIndex];
  const canPrev = currentIndex > 0;
  const canNext = currentIndex < tickets.length - 1;

  return (
    <View style={styles.fullscreen}>
      <RNStatusBar barStyle="light-content" />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        maximumZoomScale={5}
        minimumZoomScale={1}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        centerContent
        bouncesZoom
      >
        <Image
          source={{ uri: t.imageUri }}
          style={styles.image}
          resizeMode="contain"
        />
      </ScrollView>

      {/* 상단 바 */}
      <View style={styles.topBar}>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={12} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>✕</Text>
        </Pressable>
        <Text style={styles.counter}>{counter}</Text>
        <Pressable onPress={handleShare} hitSlop={12} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>↗</Text>
        </Pressable>
      </View>

      {/* 좌우 이동 버튼 */}
      {canPrev && (
        <Pressable
          onPress={goPrev}
          hitSlop={20}
          style={[styles.navBtn, styles.navBtnLeft]}
        >
          <Text style={styles.navBtnText}>‹</Text>
        </Pressable>
      )}
      {canNext && (
        <Pressable
          onPress={goNext}
          hitSlop={20}
          style={[styles.navBtn, styles.navBtnRight]}
        >
          <Text style={styles.navBtnText}>›</Text>
        </Pressable>
      )}

      {/* 하단 정보 */}
      <View style={styles.bottomBar} pointerEvents="none">
        <Text style={styles.bottomText} numberOfLines={1}>{t.title}</Text>
        <Text style={styles.bottomHint}>핀치 줌 (iOS) · 화살표 버튼으로 이동</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: WIN_W, height: WIN_H * 0.85 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Spacing.huge,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#000A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  counter: { color: '#FFF', fontSize: Typography.bodyMedium, fontWeight: '600' },
  navBtn: {
    position: 'absolute',
    top: '45%',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#000A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnLeft: { left: Spacing.md },
  navBtnRight: { right: Spacing.md },
  navBtnText: { color: '#FFF', fontSize: 28, fontWeight: '700', marginTop: -4 },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  bottomText: { color: '#FFF', fontSize: Typography.bodyMedium, fontWeight: '700' },
  bottomHint: { color: '#FFF8', fontSize: Typography.labelSmall },
});
