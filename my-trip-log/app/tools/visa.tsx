/**
 * 한국 여권 무비자 정보
 */
import { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Typography, Spacing } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { VISA_INFO, type VisaInfo } from '@/data/travelTools';

const TYPE_LABEL: Record<VisaInfo['type'], { label: string; color: 'green' | 'orange' | 'blue' | 'red' }> = {
  'visa-free': { label: '무비자', color: 'green' },
  'visa-on-arrival': { label: '도착비자', color: 'orange' },
  'evisa': { label: '전자비자', color: 'blue' },
  'required': { label: '비자 필요', color: 'red' },
};

export default function VisaScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<VisaInfo['type'] | 'all'>('all');

  const filtered = useMemo(() => {
    let list = VISA_INFO;
    if (filter !== 'all') list = list.filter((v) => v.type === filter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((v) => v.countryNameKo.includes(q) || v.countryCode.toLowerCase().includes(q));
    return list;
  }, [search, filter]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>📄 무비자 정보</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.disclaimerBox}>
        <Text style={styles.disclaimerIcon}>⚠️</Text>
        <Text style={styles.disclaimerText}>
          <Text style={{ fontWeight: '700' }}>대한민국 일반여권 기준 참고용입니다.</Text>{' '}
          무비자 정책은 변동될 수 있어요. 출발 전 외교부 영사서비스에서 최신 정보를 확인해주세요.
        </Text>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="국가명 검색"
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
        {([
          ['all', '전체'],
          ['visa-free', '무비자'],
          ['visa-on-arrival', '도착비자'],
          ['evisa', '전자비자'],
        ] as const).map(([k, label]) => (
          <Pressable
            key={k}
            style={[styles.chip, filter === k && styles.chipActive]}
            onPress={() => { haptic.select(); setFilter(k); }}
          >
            <Text style={[styles.chipText, filter === k && styles.chipTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.list}>
        {filtered.map((v) => (
          <View key={v.countryCode} style={styles.row}>
            <Text style={styles.rowFlag}>{v.flag}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowCountry}>{v.countryNameKo}</Text>
              {v.note && <Text style={styles.rowNote}>{v.note}</Text>}
            </View>
            <View style={[styles.typeBadge, getBadgeColor(TYPE_LABEL[v.type].color, colors)]}>
              <Text style={[styles.typeBadgeText, { color: getBadgeTextColor(TYPE_LABEL[v.type].color, colors) }]}>
                {v.days ? `${v.days}일` : TYPE_LABEL[v.type].label}
              </Text>
            </View>
          </View>
        ))}
        <View style={{ height: Spacing.huge }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getBadgeColor(color: 'green' | 'orange' | 'blue' | 'red', c: ColorPalette) {
  switch (color) {
    case 'green': return { backgroundColor: '#7FB39B25', borderColor: '#7FB39B' };
    case 'orange': return { backgroundColor: '#F4A47625', borderColor: '#F4A476' };
    case 'blue': return { backgroundColor: c.primary + '20', borderColor: c.primary };
    case 'red': return { backgroundColor: '#B5564B25', borderColor: '#B5564B' };
  }
}
function getBadgeTextColor(color: 'green' | 'orange' | 'blue' | 'red', c: ColorPalette) {
  switch (color) {
    case 'green': return '#3D8B6F';
    case 'orange': return '#C8702E';
    case 'blue': return c.primary;
    case 'red': return '#8B3D33';
  }
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

    disclaimerBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
      marginHorizontal: Spacing.lg, marginTop: Spacing.md,
      padding: Spacing.md,
      backgroundColor: c.warning ? c.warning + '15' : '#FFB84D15',
      borderLeftWidth: 3, borderLeftColor: c.warning ?? '#FFB84D',
      borderRadius: 8,
    },
    disclaimerIcon: { fontSize: 14 },
    disclaimerText: {
      flex: 1, fontSize: Typography.labelSmall, color: c.textSecondary,
      lineHeight: Typography.labelSmall * 1.6,
    },

    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      marginHorizontal: Spacing.lg, marginTop: Spacing.md,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
      backgroundColor: c.surface,
      borderRadius: 10, borderWidth: 1, borderColor: c.border,
    },
    searchIcon: { fontSize: 14 },
    searchInput: {
      flex: 1, fontSize: Typography.bodyMedium, color: c.textPrimary, paddingVertical: 0,
    },

    chipScroll: { flexGrow: 0, flexShrink: 0 },
    chipRow: {
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm,
      alignItems: 'center',
    },
    chip: {
      paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md,
      borderRadius: 999,
      backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.border,
      alignSelf: 'center',
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: Typography.labelSmall, color: c.textSecondary, fontWeight: '600' },
    chipTextActive: { color: c.textOnPrimary },

    list: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: c.surface,
      borderRadius: 12, borderWidth: 1, borderColor: c.border,
      padding: Spacing.md,
    },
    rowFlag: { fontSize: 24 },
    rowCountry: { fontSize: Typography.bodyMedium, color: c.textPrimary, fontWeight: '700' },
    rowNote: { fontSize: Typography.labelSmall, color: c.textSecondary, marginTop: 2 },
    typeBadge: {
      paddingHorizontal: Spacing.sm, paddingVertical: 4,
      borderRadius: 6, borderWidth: 1,
    },
    typeBadgeText: { fontSize: Typography.labelSmall, fontWeight: '700' },
  });
}
