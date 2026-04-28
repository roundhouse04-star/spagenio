import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Dimensions, ActivityIndicator,
  StatusBar as RNStatusBar, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS,
} from 'react-native-reanimated';
import * as Sharing from 'expo-sharing';
import { Typography, Spacing } from '@/theme/theme';
import { haptic } from '@/utils/haptics';
import { getAllTickets, getTicket } from '@/db/tickets';
import { Ticket } from '@/types';

const { width: WIN_W, height: WIN_H } = Dimensions.get('window');
const SWIPE_THRESHOLD = WIN_W * 0.25;
const MAX_SCALE = 5;
const MIN_SCALE = 1;

export default function TicketPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const initialId = Number(id);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // 핀치/팬 제스처 값
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // 페이지 전환 애니메이션
  const pageX = useSharedValue(0);

  const resetTransform = useCallback(() => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

  useEffect(() => {
    (async () => {
      try {
        // 우선 현재 티켓 정보로 화면을 빠르게 표시
        const cur = await getTicket(initialId);
        if (cur) {
          setTickets([cur]);
          setCurrentIndex(0);
          setLoading(false);
        }
        // 동시에 인접 티켓 (좌우 스와이프용) 로드
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

  const goToIndex = useCallback((newIndex: number) => {
    if (newIndex < 0 || newIndex >= tickets.length) {
      // 경계: 원위치
      pageX.value = withSpring(0);
      return;
    }
    setCurrentIndex(newIndex);
    pageX.value = 0;
    resetTransform();
    haptic.select();
  }, [tickets.length, pageX, resetTransform]);

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

  // ===== 제스처 =====
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, savedScale.value * e.scale));
      scale.value = next;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      // 스케일이 1로 돌아가면 위치도 리셋
      if (scale.value < 1.05) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // 확대 상태에서는 이미지 내부 팬
      if (savedScale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      } else {
        // 축소 상태에서는 페이지 전환 (좌우만)
        if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
          pageX.value = e.translationX;
        }
      }
    })
    .onEnd((e) => {
      if (savedScale.value > 1) {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      } else if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        // 페이지 전환 결정
        const dir = e.translationX > 0 ? -1 : 1; // 우→좌 swipe = next
        const newIndex = currentIndex + dir;
        if (newIndex < 0 || newIndex >= tickets.length) {
          pageX.value = withSpring(0);
        } else {
          pageX.value = withTiming(dir > 0 ? -WIN_W : WIN_W, { duration: 220 }, () => {
            runOnJS(goToIndex)(newIndex);
          });
        }
      } else {
        pageX.value = withSpring(0);
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      // 더블탭 = 줌 토글
      if (savedScale.value > 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(2.5);
        savedScale.value = 2.5;
      }
    });

  const composedGesture = Gesture.Simultaneous(
    panGesture,
    Gesture.Exclusive(doubleTapGesture, pinchGesture),
  );

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value + pageX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

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

  return (
    <GestureHandlerRootView style={styles.fullscreen}>
      <RNStatusBar barStyle="light-content" />

      <GestureDetector gesture={composedGesture}>
        <View style={styles.imageContainer}>
          <Animated.Image
            source={{ uri: t.imageUri }}
            style={[styles.image, imageStyle]}
            resizeMode="contain"
          />
        </View>
      </GestureDetector>

      {/* 상단 바 */}
      <View style={styles.topBar} pointerEvents="box-none">
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={12} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>✕</Text>
        </Pressable>
        <Text style={styles.counter}>{counter}</Text>
        <Pressable onPress={handleShare} hitSlop={12} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>↗</Text>
        </Pressable>
      </View>

      {/* 하단 안내 */}
      <View style={styles.bottomBar} pointerEvents="none">
        <Text style={styles.bottomText} numberOfLines={1}>{t.title}</Text>
        <Text style={styles.bottomHint}>핀치 줌 · 더블탭 · 좌우 스와이프</Text>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    flex: 1,
    width: WIN_W,
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
