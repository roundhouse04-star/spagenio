/**
 * 응급 연락처 — 국가별 경찰·구급·소방·관광경찰·한국 대사관
 * 각 번호 탭하면 전화 앱 호출 (Linking tel:)
 */
import { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Typography, Spacing } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import {
  EMERGENCY_CONTACTS,
  KOREA_CONSULAR_CALL_CENTER,
  type EmergencyContact,
} from '@/data/travelTools';

function dial(number?: string) {
  if (!number) return;
  haptic.medium();
  const url = `tel:${number.replace(/\s/g, '')}`;
  Linking.openURL(url).catch(() => {
    Alert.alert('전화 걸기 실패', '이 기기에서는 전화를 걸 수 없어요.');
  });
}

export default function EmergencyScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return EMERGENCY_CONTACTS;
    return EMERGENCY_CONTACTS.filter((e) =>
      e.countryNameKo.includes(q) || e.countryCode.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🚨 응급 연락처</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* 영사 콜센터 (한국 외교부 24시간) — 항상 상단 고정 */}
      <Pressable style={styles.consularCard} onPress={() => dial(KOREA_CONSULAR_CALL_CENTER)}>
        <View style={styles.consularLeft}>
          <Text style={styles.consularEyebrow}>한국 외교부 · 24시간</Text>
          <Text style={styles.consularTitle}>영사 콜센터</Text>
          <Text style={styles.consularNumber}>{KOREA_CONSULAR_CALL_CENTER}</Text>
        </View>
        <Text style={styles.consularPhone}>📞</Text>
      </Pressable>

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

      <ScrollView contentContainerStyle={styles.scroll}>
        {filtered.map((e) => (
          <CountryCard key={e.countryCode} contact={e} styles={styles} />
        ))}
        <Text style={styles.note}>
          💡 응급 시 가장 가까운 응급실 방문이 우선이에요. 국가에 따라 번호가 변경될 수 있으니 출발 전 외교부 영사서비스에서 확인하세요.
        </Text>
        <View style={{ height: Spacing.huge }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function CountryCard({ contact, styles }: {
  contact: EmergencyContact;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardFlag}>{contact.flag}</Text>
        <Text style={styles.cardCountry}>{contact.countryNameKo}</Text>
      </View>
      <View style={styles.numberGrid}>
        {contact.police && <NumberBtn label="경찰" number={contact.police} icon="🚓" styles={styles} />}
        {contact.ambulance && <NumberBtn label="구급" number={contact.ambulance} icon="🚑" styles={styles} />}
        {contact.fire && <NumberBtn label="소방" number={contact.fire} icon="🚒" styles={styles} />}
        {contact.touristPolice && <NumberBtn label="관광경찰" number={contact.touristPolice} icon="🛡" styles={styles} />}
      </View>
      {contact.embassy && (
        <Pressable style={styles.embassyBtn} onPress={() => dial(contact.embassy)}>
          <Text style={styles.embassyIcon}>🇰🇷</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.embassyLabel}>주{contact.countryNameKo} 한국대사관</Text>
            <Text style={styles.embassyNumber}>{contact.embassy}</Text>
          </View>
          <Text style={styles.callIcon}>📞</Text>
        </Pressable>
      )}
    </View>
  );
}

function NumberBtn({ label, number, icon, styles }: {
  label: string; number: string; icon: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable style={styles.numberBtn} onPress={() => dial(number)}>
      <Text style={styles.numberIcon}>{icon}</Text>
      <Text style={styles.numberLabel}>{label}</Text>
      <Text style={styles.numberValue}>{number}</Text>
    </Pressable>
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

    consularCard: {
      flexDirection: 'row', alignItems: 'center',
      marginHorizontal: Spacing.lg, marginTop: Spacing.md,
      padding: Spacing.lg,
      backgroundColor: c.error ? c.error + '12' : '#B5564B12',
      borderWidth: 1, borderColor: c.error ?? '#B5564B',
      borderRadius: 14,
    },
    consularLeft: { flex: 1 },
    consularEyebrow: { fontSize: 10, color: c.error, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
    consularTitle: { fontSize: Typography.titleMedium, fontWeight: '700', color: c.textPrimary },
    consularNumber: { fontSize: Typography.bodyMedium, color: c.textSecondary, marginTop: 2 },
    consularPhone: { fontSize: 32 },

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

    scroll: { padding: Spacing.lg, gap: Spacing.md },
    card: {
      backgroundColor: c.surface,
      borderRadius: 14, borderWidth: 1, borderColor: c.border,
      padding: Spacing.md,
    },
    cardHeader: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    cardFlag: { fontSize: 22 },
    cardCountry: { fontSize: Typography.bodyLarge, color: c.textPrimary, fontWeight: '700' },

    numberGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs,
    },
    numberBtn: {
      flex: 1, minWidth: '47%',
      flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
      backgroundColor: c.surfaceAlt,
      borderRadius: 10,
      paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    },
    numberIcon: { fontSize: 18 },
    numberLabel: { fontSize: Typography.labelSmall, color: c.textSecondary, flex: 1 },
    numberValue: { fontSize: Typography.bodyMedium, color: c.primary, fontWeight: '700' },

    embassyBtn: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      marginTop: Spacing.sm, padding: Spacing.sm,
      backgroundColor: c.surfaceAlt, borderRadius: 10,
    },
    embassyIcon: { fontSize: 18 },
    embassyLabel: { fontSize: Typography.labelSmall, color: c.textSecondary },
    embassyNumber: { fontSize: Typography.bodyMedium, color: c.primary, fontWeight: '700' },
    callIcon: { fontSize: 18 },

    note: {
      fontSize: Typography.labelSmall, color: c.textTertiary, textAlign: 'center',
      marginTop: Spacing.lg, lineHeight: Typography.labelSmall * 1.6,
    },
  });
}
