/**
 * 시차 계산기
 * - 두 도시 선택 → 현재 시각 + 차이(시간)
 * - IANA timezone 기반 (외부 호출 X)
 */
import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Typography, Spacing } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { TIMEZONE_CITIES, type TimezoneCity } from '@/data/travelTools';

/**
 * 주어진 timezone 의 현재 시각·날짜·UTC offset(시간) 반환.
 *
 * 주의 — Hermes(iOS RN) 호환:
 *  `new Date(now.toLocaleString('en-US', { timeZone: ... }))` 패턴은
 *  Hermes 에서 invalid Date 가 자주 나옴 → offset 이 NaN.
 *  대신 Intl.DateTimeFormat 으로 numeric 파트를 받아 Date.UTC 로 재조립한다.
 */
function nowInTimezone(tz: string): { time: string; date: string; offsetHours: number } {
  const now = new Date();

  // 표시용 (한국어)
  const localized = new Intl.DateTimeFormat('ko-KR', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (t: string) => localized.find((p) => p.type === t)?.value ?? '';
  let hourStr = get('hour');
  // Intl 가 24시 표기에서 '24' 를 줄 수 있음 → '00' 으로 정규화
  if (hourStr === '24') hourStr = '00';
  const date = `${get('year')}-${get('month')}-${get('day')} (${get('weekday')})`;
  const time = `${hourStr}:${get('minute')}`;

  // offset(시간) — en-US locale + numeric 파트만 사용해서 Hermes 호환
  let offsetHours = 0;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const num = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
    let y = num('year');
    const mo = num('month');
    const d = num('day');
    let h = num('hour');
    if (h === 24) h = 0;
    const mi = num('minute');
    const s = num('second');
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
      offsetHours = 0;
    } else {
      const tzAsUtcMs = Date.UTC(y, mo - 1, d, h, mi, s);
      offsetHours = Math.round((tzAsUtcMs - now.getTime()) / (1000 * 60 * 60));
    }
  } catch {
    offsetHours = 0;
  }

  return { time, date, offsetHours };
}

export default function TimezoneScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [cityA, setCityA] = useState<string>('seoul');
  const [cityB, setCityB] = useState<string>('tokyo');
  const [tick, setTick] = useState(0);

  // 1분마다 재계산
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const a = TIMEZONE_CITIES.find((c) => c.id === cityA) ?? TIMEZONE_CITIES[0];
  const b = TIMEZONE_CITIES.find((c) => c.id === cityB) ?? TIMEZONE_CITIES[1];
  // tick은 1분 주기 재계산 트리거용 (의존성에 포함)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const aInfo = useMemo(() => nowInTimezone(a.tz), [a, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bInfo = useMemo(() => nowInTimezone(b.tz), [b, tick]);
  const rawDiff = bInfo.offsetHours - aInfo.offsetHours;
  const diff = Number.isFinite(rawDiff) ? rawDiff : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🕐 시차 계산기</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <CityClock
          label="기준 도시"
          city={a}
          info={aInfo}
          onChange={setCityA}
          styles={styles}
        />
        <View style={styles.diffWrap}>
          <Text style={styles.diffLabel}>시차</Text>
          <Text style={styles.diffValue}>
            {diff === 0 ? '동일' : `${diff > 0 ? '+' : ''}${diff}시간`}
          </Text>
        </View>
        <CityClock
          label="비교 도시"
          city={b}
          info={bInfo}
          onChange={setCityB}
          styles={styles}
        />

        <Text style={styles.note}>
          💡 IANA 시간대 기준 (DST 자동 반영). 항공편·일정 시간은 항상 항공사 공식 정보를 우선 확인하세요.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function CityClock({ label, city, info, onChange, styles }: {
  label: string;
  city: TimezoneCity;
  info: ReturnType<typeof nowInTimezone>;
  onChange: (id: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.clockCard}>
      <Text style={styles.clockLabel}>{label}</Text>
      <Pressable style={styles.cityRow} onPress={() => { haptic.tap(); setOpen(!open); }}>
        <Text style={styles.cityFlag}>{city.flag}</Text>
        <Text style={styles.cityName}>{city.nameKo}</Text>
        <Text style={styles.cityArrow}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      <Text style={styles.timeText}>{info.time}</Text>
      <Text style={styles.dateText}>{info.date}</Text>

      {open && (
        <View style={styles.dropdown}>
          <ScrollView style={{ maxHeight: 280 }}>
            {TIMEZONE_CITIES.map((c) => (
              <Pressable
                key={c.id}
                style={[styles.option, city.id === c.id && styles.optionActive]}
                onPress={() => { haptic.select(); onChange(c.id); setOpen(false); }}
              >
                <Text style={styles.optionText}>{c.flag} {c.nameKo}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backText: { fontSize: 24, color: c.textPrimary },
    headerTitle: { fontSize: Typography.bodyLarge, fontWeight: '700', color: c.textPrimary },
    scroll: { padding: Spacing.lg, gap: Spacing.md },
    clockCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: Spacing.lg,
      borderWidth: 1, borderColor: c.border,
    },
    clockLabel: {
      fontSize: 11, color: c.accent, fontWeight: '700', letterSpacing: 1.5,
    },
    cityRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs,
    },
    cityFlag: { fontSize: 24 },
    cityName: { fontSize: Typography.titleMedium, color: c.textPrimary, fontWeight: '700', flex: 1 },
    cityArrow: { fontSize: 12, color: c.textTertiary },
    timeText: {
      fontSize: 56, color: c.textPrimary, fontWeight: '300', marginTop: Spacing.sm, letterSpacing: -1,
    },
    dateText: { fontSize: Typography.bodyMedium, color: c.textSecondary, marginTop: 4 },
    dropdown: {
      marginTop: Spacing.md,
      backgroundColor: c.surfaceAlt,
      borderRadius: 10,
      borderWidth: 1, borderColor: c.border,
    },
    option: {
      paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    },
    optionActive: { backgroundColor: c.primary + '15' },
    optionText: { fontSize: Typography.bodyMedium, color: c.textPrimary },
    diffWrap: {
      alignItems: 'center', paddingVertical: Spacing.sm,
    },
    diffLabel: { fontSize: 11, color: c.textTertiary, fontWeight: '700', letterSpacing: 1.5 },
    diffValue: {
      fontSize: Typography.titleLarge, fontWeight: '800', color: c.primary, marginTop: 2,
    },
    note: {
      fontSize: Typography.labelSmall, color: c.textTertiary, textAlign: 'center',
      marginTop: Spacing.lg, lineHeight: Typography.labelSmall * 1.6,
    },
  });
}
