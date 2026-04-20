/**
 * IG 톤 공통 컴포넌트.
 */
import React from 'react';
import { View, Text, StyleSheet, Image, Pressable, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, Spacing, Radius, FontSizes, StoryGradient, Shadows, chipBg } from '@/theme/theme';
import type { Artist, Event, Ticket } from '@/types';

/** 인스타 스토리 스타일의 원형 아바타 — 링 그라디언트 on/off */
export function Avatar({
  artist,
  size = 44,
  ring = false,
  onPress,
}: {
  artist?: Partial<Artist>;
  size?: number;
  ring?: boolean;
  onPress?: () => void;
}) {
  const inner = size - (ring ? 6 : 0);
  const bg = artist?.thumbColor || '#eeeeee';

  const content = (
    <View style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: bg,
                   alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                   borderWidth: ring ? 2 : StyleSheet.hairlineWidth,
                   borderColor: ring ? '#fff' : Colors.border }}>
      {artist?.avatarUrl ? (
        <Image source={{ uri: artist.avatarUrl }} style={{ width: '100%', height: '100%' }} />
      ) : (
        <Text style={{ fontSize: inner * 0.5 }}>{artist?.emoji || '👤'}</Text>
      )}
    </View>
  );

  const body = ring ? (
    <LinearGradient
      colors={StoryGradient as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, padding: 2,
               alignItems: 'center', justifyContent: 'center' }}
    >
      {content}
    </LinearGradient>
  ) : content;

  if (!onPress) return body;
  return <Pressable onPress={onPress} hitSlop={6}>{body}</Pressable>;
}

export function CategoryChip({ category, compact }: { category?: string; compact?: boolean }) {
  if (!category) return null;
  return (
    <View style={{
      backgroundColor: chipBg(category), borderRadius: Radius.pill,
      paddingHorizontal: compact ? 6 : 10, paddingVertical: compact ? 2 : 4, alignSelf: 'flex-start',
    }}>
      <Text style={{ fontSize: compact ? 10 : 11, color: Colors.text, fontFamily: Fonts.medium }}>
        {category}
      </Text>
    </View>
  );
}

export function Stars({ n = 0, size = 12 }: { n?: number; size?: number }) {
  return (
    <Text style={{ fontSize: size, letterSpacing: 1 }}>
      {'★'.repeat(Math.max(0, Math.min(5, n)))}{'☆'.repeat(5 - Math.max(0, Math.min(5, n)))}
    </Text>
  );
}

export function PrimaryButton({
  title, onPress, loading, disabled, style,
}: {
  title: string; onPress: () => void; loading?: boolean; disabled?: boolean; style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btnPrimary,
        { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color="#fff" />
        : <Text style={styles.btnPrimaryText}>{title}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({
  title, onPress, style,
}: { title: string; onPress: () => void; style?: ViewStyle }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.7 }, style]}
    >
      <Text style={styles.btnSecondaryText}>{title}</Text>
    </Pressable>
  );
}

export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: Colors.divider }, style]} />;
}

export function Empty({ icon = '🫧', title, subtitle }: { icon?: string; title: string; subtitle?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: Spacing.xxl, gap: 8 }}>
      <Text style={{ fontSize: 40 }}>{icon}</Text>
      <Text style={{ fontSize: FontSizes.bodyLg, fontFamily: Fonts.semibold, color: Colors.text }}>{title}</Text>
      {subtitle && <Text style={{ fontSize: FontSizes.caption, color: Colors.textSub, textAlign: 'center' }}>{subtitle}</Text>}
    </View>
  );
}

export function EventRow({ ev, onPress }: { ev: Event; onPress?: () => void }) {
  const dday = daysUntil(ev.date);
  const ddayLabel = dday === 0 ? 'D-DAY' : dday > 0 ? `D-${dday}` : `D+${-dday}`;
  const soon = dday >= 0 && dday <= 7;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
        <View style={{ alignItems: 'center', width: 54 }}>
          <Text style={{ fontFamily: Fonts.bold, fontSize: 18, color: soon ? Colors.heart : Colors.text }}>
            {ddayLabel}
          </Text>
          <Text style={{ fontSize: 10, color: Colors.textSub }}>{ev.weekday ?? ''}</Text>
        </View>
        <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: Colors.divider, alignSelf: 'stretch' }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: FontSizes.bodyLg, fontFamily: Fonts.semibold, color: Colors.text }}>
            {ev.catIcon ?? ''} {ev.title}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: FontSizes.caption, color: Colors.textSub, marginTop: 2 }}>
            {ev.date} · {ev.venue ?? '장소 미정'}
          </Text>
          <View style={{ marginTop: 6 }}>
            <CategoryChip category={ev.category} compact />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function TicketRow({ t, onPress }: { t: Ticket; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
        <View style={{ width: 52, height: 52, borderRadius: Radius.md, backgroundColor: chipBg(t.category),
                       alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 24 }}>{t.catIcon ?? '🎟️'}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: FontSizes.bodyLg, fontFamily: Fonts.semibold }}>{t.title}</Text>
          <Text numberOfLines={1} style={{ fontSize: FontSizes.caption, color: Colors.textSub, marginTop: 2 }}>
            {t.date} · {t.venue ?? ''}
          </Text>
          <View style={{ marginTop: 4 }}>
            <Stars n={t.rating} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function daysUntil(date: string): number {
  if (!date) return -9999;
  const d = new Date(date);
  if (isNaN(d.getTime())) return -9999;
  const n = new Date(); n.setHours(0,0,0,0); d.setHours(0,0,0,0);
  return Math.round((d.getTime() - n.getTime()) / 86400000);
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.divider,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.xs,
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#fff', fontFamily: Fonts.semibold, fontSize: FontSizes.body,
  },
  btnSecondary: {
    backgroundColor: Colors.bgMuted,
    borderRadius: Radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  btnSecondaryText: {
    color: Colors.text, fontFamily: Fonts.medium, fontSize: FontSizes.body,
  },
});
