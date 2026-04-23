import React from 'react';
import { View, Text, Pressable, Image, StyleSheet, Dimensions } from 'react-native';
import { Colors, Fonts, FontSizes, Radius } from '@/theme/theme';
import type { Event, Artist } from '@/types';

/**
 * 3열 그리드용 이벤트 카드.
 *
 * 이미지 우선순위:
 *   1. ev.posterUrl (KOPIS 포스터)
 *   2. artist.avatarUrl (Wikipedia 아티스트 대표 사진 fallback)
 *   3. 카테고리별 이모지 placeholder
 *
 * 카테고리: 콘서트 / 뮤지컬 / 연극 / 팬미팅 / 페스티벌 / 전시 (6개)
 */

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 6;
const GRID_PADDING = 8;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * 2) / 3;
const CARD_IMAGE_HEIGHT = CARD_WIDTH * 1.35;

/** 6개 카테고리별 이모지 + 파스텔 배경 색상 */
function placeholderStyle(category?: string, catIcon?: string) {
  const cat = category ?? '';
  if (cat === '콘서트')   return { bg: '#ffe0e9', icon: catIcon || '🎤' };
  if (cat === '뮤지컬')   return { bg: '#e8e4ff', icon: catIcon || '🎭' };
  if (cat === '연극')     return { bg: '#fff4d6', icon: catIcon || '🎪' };
  if (cat === '팬미팅')   return { bg: '#ffdfe8', icon: catIcon || '💖' };
  if (cat === '페스티벌') return { bg: '#ffeac9', icon: catIcon || '🎉' };
  if (cat === '전시')     return { bg: '#d8eefe', icon: catIcon || '🖼️' };
  return { bg: '#eee', icon: catIcon || '🎤' };
}

/** iOS http:// 차단 → https 변환 */
function secureUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace(/^http:\/\//i, 'https://');
}

export function EventGridItem({ ev, artist, onPress }: { ev: Event; artist?: Artist | null; onPress?: () => void }) {
  const posterUri = secureUrl(ev.posterUrl) || secureUrl(artist?.avatarUrl);
  const hasPoster = !!posterUri;
  const isFallback = !ev.posterUrl && !!posterUri;
  const ph = placeholderStyle(ev.category, ev.catIcon);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}>
      {hasPoster ? (
        <View style={styles.imageWrap}>
          <Image source={{ uri: posterUri }} style={styles.image} resizeMode="cover" />
          {isFallback && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeIcon}>{ph.icon}</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.imagePlaceholder, { backgroundColor: ph.bg }]}>
          <Text style={styles.placeholderIcon}>{ph.icon}</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text numberOfLines={2} style={styles.title}>{ev.title}</Text>
        <Text numberOfLines={1} style={styles.date}>{ev.date ?? ''}</Text>
      </View>
    </Pressable>
  );
}

export function EventGridContainer({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.container}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: GRID_PADDING,
    gap: GRID_GAP,
  },
  card: {
    width: CARD_WIDTH,
    marginBottom: GRID_GAP,
  },
  imageWrap: {
    position: 'relative',
  },
  image: {
    width: CARD_WIDTH,
    height: CARD_IMAGE_HEIGHT,
    borderRadius: Radius.sm,
    backgroundColor: '#f0f0f0',
  },
  imagePlaceholder: {
    width: CARD_WIDTH,
    height: CARD_IMAGE_HEIGHT,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 38,
  },
  categoryBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadgeIcon: {
    fontSize: 14,
  },
  info: {
    paddingTop: 6,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: FontSizes.tiny,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    lineHeight: 15,
  },
  date: {
    fontSize: 10,
    color: Colors.textSub,
    marginTop: 2,
  },
});
