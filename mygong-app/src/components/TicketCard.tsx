import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Colors, Fonts, FontSizes, Spacing, Radius, chipBg } from '@/theme/theme';
import { Stars, CategoryChip } from '@/components/UI';
import { resolvePhotoUri } from '@/services/ticketPhoto';
import type { Ticket } from '@/types';

/**
 * 인스타그램 스타일 티켓 카드 (단일 칼럼).
 *
 * 레이아웃:
 *   [사진 (있으면) 또는 이모지 플레이스홀더 — 16:9 비율]
 *   ── 하단 정보 영역 ──
 *   🎤 아이유 콘서트
 *   2024-09-21 · 고척 스카이돔
 *   좌석: 1층 A구역 12열 15번
 *   ⭐⭐⭐⭐⭐
 *
 * v2: photoUri 가 상대 경로(tickets/...)면 documentDirectory + 상대 경로로 변환
 */

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_MARGIN = Spacing.lg;
const CARD_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 2;
const IMAGE_HEIGHT = CARD_WIDTH * 0.75; // 4:3 비율

export function TicketCard({ ticket, onPress }: { ticket: Ticket; onPress?: () => void }) {
  // 절대 경로로 변환 (상대 경로면 자동 보정, 절대 경로면 그대로)
  const photoUri = resolvePhotoUri(ticket.photoUri);
  const hasPhoto = !!photoUri;
  const bgColor = chipBg(ticket.category);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      {/* 이미지 영역 */}
      {hasPhoto ? (
        <View style={styles.imageWrap}>
          <Image source={{ uri: photoUri }} style={styles.image} resizeMode="cover" />
          {/* 별점 오버레이 (이미지 위 좌상단) */}
          {ticket.rating > 0 && (
            <View style={styles.ratingBadge}>
              <Stars n={ticket.rating} size={12} />
            </View>
          )}
          {/* 카테고리 뱃지 (우상단) */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>
              {ticket.catIcon ?? '🎟️'} {ticket.category ?? ''}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.placeholderWrap, { backgroundColor: bgColor }]}>
          <Text style={styles.placeholderIcon}>{ticket.catIcon ?? '🎟️'}</Text>
          <Text style={styles.placeholderCategory}>{ticket.category ?? '이벤트'}</Text>
        </View>
      )}

      {/* 정보 영역 */}
      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.title}>
          {ticket.title}
        </Text>
        <Text numberOfLines={1} style={styles.subtitle}>
          {ticket.date}
          {ticket.venue ? ` · ${ticket.venue}` : ''}
        </Text>
        {ticket.seat && (
          <Text numberOfLines={1} style={styles.seat}>
            🪑 {ticket.seat}
          </Text>
        )}
        {/* 사진 없을 때만 별점 하단 표시 (사진 있으면 오버레이로 이미 표시) */}
        {!hasPhoto && ticket.rating > 0 && (
          <View style={{ marginTop: 8 }}>
            <Stars n={ticket.rating} size={14} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    marginHorizontal: CARD_MARGIN,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.divider,
  },
  imageWrap: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: '#f0f0f0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  ratingBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  categoryBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  categoryBadgeText: {
    fontSize: FontSizes.tiny,
    fontFamily: Fonts.semibold,
    color: Colors.text,
  },
  placeholderWrap: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 70,
    marginBottom: 4,
  },
  placeholderCategory: {
    fontSize: FontSizes.caption,
    fontFamily: Fonts.semibold,
    color: Colors.textSub,
  },
  info: {
    padding: Spacing.md,
  },
  title: {
    fontSize: FontSizes.bodyLg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FontSizes.caption,
    color: Colors.textSub,
    marginBottom: 2,
  },
  seat: {
    fontSize: FontSizes.tiny,
    color: Colors.textSub,
    marginTop: 2,
  },
});
