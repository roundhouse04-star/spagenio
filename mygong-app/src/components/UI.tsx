/**
 * 공통 UI 컴포넌트 — 모노크롬 와이어프레임 스타일.
 * minimal.css 의 .chip .btn .box .label-caps .placeholder .line 등을 RN 으로 이식.
 */
import React from 'react';
import {
  View, Text, Pressable, StyleSheet, Image,
  PressableProps, StyleProp, ViewStyle, TextStyle,
} from 'react-native';
import { Colors, Fonts, FontSizes, Spacing } from '@/theme/theme';
import type { Artist, Event, Ticket } from '@/types';

// ─── 라벨캡 (섹션 헤더) ───────────────────────────────────────────
// "GREETING", "MY ARTISTS", "UPCOMING" 같은 mono uppercase 라벨
export function LabelCaps({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.labelCaps, style]}>{String(children).toUpperCase()}</Text>;
}

// ─── Mono 숫자 (D-3, 3.18, 2026.03) ───────────────────────────────
export function Mono({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.mono, style]}>{children}</Text>;
}

// ─── Chip (on / off / soft) ───────────────────────────────────────
export function Chip({
  label, on, soft, style, textStyle, onPress,
}: {
  label: string; on?: boolean; soft?: boolean;
  style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle>;
  onPress?: () => void;
}) {
  const bg = on ? Colors.ink : Colors.paper;
  const fg = on ? '#fff' : (soft ? Colors.ink3 : Colors.ink);
  const border = soft ? Colors.lineSoft : Colors.ink;
  const Inner = (
    <View style={[styles.chip, { backgroundColor: bg, borderColor: border }, style]}>
      <Text style={[styles.chipText, { color: fg }, textStyle]}>{label}</Text>
    </View>
  );
  if (!onPress) return Inner;
  return <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>{Inner}</Pressable>;
}

// ─── Button (filled / outline / ghost) ────────────────────────────
export function Btn({
  label, filled, ghost, style, onPress, disabled,
}: {
  label: string; filled?: boolean; ghost?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void; disabled?: boolean;
}) {
  const bg = filled ? Colors.ink : Colors.paper;
  const fg = filled ? '#fff' : (ghost ? Colors.ink2 : Colors.ink);
  const border = ghost ? Colors.lineSoft : Colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: border },
        pressed && { opacity: 0.6 },
        disabled && { opacity: 0.3 },
        style,
      ]}>
      <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export const PrimaryButton = (props: { title: string; onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) =>
  <Btn label={props.title} filled onPress={props.onPress} disabled={props.disabled} style={props.style} />;
export const SecondaryButton = (props: { title: string; onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) =>
  <Btn label={props.title} onPress={props.onPress} disabled={props.disabled} style={props.style} />;

// ─── Box (기본 흰 박스) / BoxFill (fill 배경) ─────────────────────
export function Box({ children, fill, style, soft }: {
  children: React.ReactNode; fill?: boolean; soft?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[
      styles.box,
      fill && { backgroundColor: Colors.fill },
      soft && { borderColor: Colors.lineSoft },
      style,
    ]}>
      {children}
    </View>
  );
}

// ─── Placeholder (X 표시된 이미지 자리) ───────────────────────────
export function Placeholder({
  w, h, round, label, style,
}: {
  w?: number | string; h?: number | string; round?: boolean;
  label?: string; style?: StyleProp<ViewStyle>;
}) {
  const size: ViewStyle = { width: w as any, height: h as any };
  if (round && typeof w === 'number') size.borderRadius = w / 2;
  return (
    <View style={[styles.ph, size, style]}>
      {/* 대각선 X 대신 · 표시 (RN 에선 CSS gradient 불가) */}
      <Text style={styles.phDot}>{label || '·'}</Text>
    </View>
  );
}

// ─── Avatar (placeholder 원형 또는 사진) ──────────────────────────
export function Avatar({
  artist, size = 48, style,
}: {
  artist?: Artist; size?: number; style?: StyleProp<ViewStyle>;
}) {
  const base: ViewStyle = {
    width: size, height: size, borderRadius: size / 2,
    borderWidth: 1, borderColor: Colors.ink,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.paper, overflow: 'hidden',
  };
  if (artist?.avatarUrl) {
    return (
      <View style={[base, style]}>
        <Image source={{ uri: artist.avatarUrl }} style={{ width: '100%', height: '100%' }} />
      </View>
    );
  }
  return (
    <View style={[base, { backgroundColor: Colors.fill }, style]}>
      <Text style={{ color: Colors.ink4, fontSize: Math.max(10, size / 3) }}>·</Text>
    </View>
  );
}

// ─── Divider ──────────────────────────────────────────────────────
export function Divider({ dark, style }: { dark?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[
    { height: StyleSheet.hairlineWidth, backgroundColor: dark ? Colors.ink : Colors.lineSoft },
    style,
  ]} />;
}

// ─── CategoryChip (카테고리만 표시) ───────────────────────────────
export function CategoryChip({ category, style }: { category?: string; style?: StyleProp<ViewStyle> }) {
  if (!category) return null;
  return <Chip label={category} style={style} />;
}

// ─── Stars (★★★★☆) ────────────────────────────────────────────
export function Stars({ value, size = 12 }: { value: number; size?: number }) {
  const full = Math.round(value);
  return (
    <Text style={{ fontSize: size, color: Colors.ink, letterSpacing: 1 }}>
      {'★'.repeat(full)}{'☆'.repeat(Math.max(0, 5 - full))}
    </Text>
  );
}

// ─── 빈 상태 ──────────────────────────────────────────────────────
export function Empty({ icon, title, subtitle }: { icon?: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      {icon && <Text style={{ fontSize: 28, color: Colors.ink4, marginBottom: 10 }}>{icon}</Text>}
      <Text style={{ fontFamily: Fonts.semibold, fontSize: FontSizes.body, color: Colors.ink2 }}>{title}</Text>
      {subtitle && <Text style={{ fontSize: FontSizes.caption, color: Colors.ink3, marginTop: 6, textAlign: 'center' }}>{subtitle}</Text>}
    </View>
  );
}

// ─── 이벤트 행 ────────────────────────────────────────────────────
export function EventRow({ ev, onPress }: { ev: Event; onPress?: () => void }) {
  const dday = daysUntil(ev.date);
  const ddayLabel = dday === 0 ? 'D-DAY' : dday > 0 ? `D-${dday}` : `D+${-dday}`;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <Box style={{ padding: 8, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Text style={[styles.mono, { fontSize: 12, fontWeight: '600', minWidth: 48 }]}>{ddayLabel}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: Fonts.semibold, color: Colors.ink }}>{ev.title}</Text>
          {ev.venue && <Text numberOfLines={1} style={{ fontSize: 10, color: Colors.ink3, marginTop: 2 }}>{ev.venue}</Text>}
        </View>
        {ev.category && <Chip label={ev.category} />}
      </Box>
    </Pressable>
  );
}

// ─── 티켓 행 ──────────────────────────────────────────────────────
export function TicketRow({ ticket, onPress }: { ticket: Ticket; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <Box style={{ padding: 6, flexDirection: 'row', gap: 8 }}>
        <Placeholder w={44} h={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: Fonts.semibold }}>{ticket.title}</Text>
          <Text style={[styles.mono, { fontSize: 10, color: Colors.ink3 }]}>{formatDate(ticket.date)}</Text>
          {ticket.rating > 0 && <Stars value={ticket.rating} size={10} />}
        </View>
        <Chip label={ticket.category} style={{ alignSelf: 'flex-start' }} />
      </Box>
    </Pressable>
  );
}

// ─── helpers ──────────────────────────────────────────────────────
function daysUntil(date?: string): number {
  if (!date) return -9999;
  const d = new Date(date);
  if (isNaN(d.getTime())) return -9999;
  const n = new Date(); n.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - n.getTime()) / 86400000);
}

function formatDate(iso: string): string {
  // "2026-03-18" → "3.18"
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${Number(m[1])}.${Number(m[2])}`;
}

// ─── 스타일 ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  labelCaps: {
    fontFamily: Fonts.mono,
    fontSize: FontSizes.micro,
    letterSpacing: 1.2,
    color: Colors.ink3,
  },
  mono: {
    fontFamily: Fonts.mono,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.micro + 1,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  btnText: {
    fontFamily: Fonts.medium,
    fontSize: FontSizes.caption,
  },
  box: {
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.ink,
  },
  ph: {
    backgroundColor: Colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phDot: {
    color: Colors.ink4,
    fontSize: 10,
  },
  empty: {
    alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xxl,
  },
});
