/**
 * 대사관 / 영사관 리스트
 *
 * 기능:
 *  - 도시명/국가명 검색
 *  - 클릭 시 상세 (주소, 전화, 시간, 지도)
 *  - 전화 / 지도 앱 외부 실행
 *
 * 출처: src/data/safety/embassies.ts
 */
import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { EMBASSIES } from '@/data/safety/embassies';
import type { Embassy } from '@/data/safety/types';

const TYPE_LABEL: Record<Embassy['type'], string> = {
  embassy: '대사관',
  consulate: '총영사관',
  consular_agency: '대표부',
};

export default function EmbassiesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return EMBASSIES;
    const q = search.toLowerCase();
    return EMBASSIES.filter((e) =>
      e.cityName.toLowerCase().includes(q) ||
      e.nameKo.includes(search) ||
      e.countryCode.toLowerCase().includes(q),
    );
  }, [search]);

  const openMap = (e: Embassy) => {
    haptic.tap();
    const query = encodeURIComponent(`${e.nameKo} ${e.address}`);
    const url = Platform.OS === 'ios'
      ? `https://maps.apple.com/?q=${query}&ll=${e.latitude},${e.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${e.latitude},${e.longitude}`;
    Linking.openURL(url);
  };

  const callEmbassy = (phone: string) => {
    haptic.medium();
    Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, '')}`);
  };

  return (
    <>
      <Stack.Screen options={{ title: '대사관 / 영사관', headerBackTitle: '안전' }} />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            placeholder="도시명 / 국가 / 공관명 검색"
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Text style={styles.searchClear}>✕</Text>
            </Pressable>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.count}>{filtered.length}개 공관</Text>

          {filtered.map((e) => {
            const isOpen = openId === e.id;
            return (
              <View key={e.id} style={styles.card}>
                <Pressable
                  style={styles.cardHeader}
                  onPress={() => { haptic.tap(); setOpenId(isOpen ? null : e.id); }}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.cityName}>{e.cityName}</Text>
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeText}>{TYPE_LABEL[e.type]}</Text>
                      </View>
                    </View>
                    <Text style={styles.embassyName}>{e.nameKo}</Text>
                  </View>
                  <Text style={styles.arrow}>{isOpen ? '▾' : '›'}</Text>
                </Pressable>

                {isOpen && (
                  <View style={styles.cardBody}>
                    <DetailRow label="주소" value={e.address} styles={styles} />
                    <DetailRow label="전화" value={e.phone} styles={styles} onPress={() => callEmbassy(e.phone)} />
                    {e.phoneEmergency && (
                      <DetailRow
                        label="긴급 (야간)"
                        value={e.phoneEmergency}
                        styles={styles}
                        onPress={() => callEmbassy(e.phoneEmergency!)}
                        emergency
                      />
                    )}
                    {e.hours && <DetailRow label="시간" value={e.hours} styles={styles} />}
                    {e.email && <DetailRow label="이메일" value={e.email} styles={styles} />}

                    <Pressable style={styles.mapButton} onPress={() => openMap(e)}>
                      <Text style={styles.mapButtonText}>🗺  지도에서 보기</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}

          {filtered.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyText}>검색 결과 없음</Text>
            </View>
          )}

          <Text style={styles.footer}>
            데이터: 외교부 재외공관 정보 (수동 큐레이션 25개){'\n'}
            1.3 에서 외교부 API 자동 확장 예정
          </Text>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function DetailRow({
  label, value, styles, onPress, emergency,
}: {
  label: string; value: string;
  styles: ReturnType<typeof createStyles>;
  onPress?: () => void;
  emergency?: boolean;
}) {
  const inner = (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, onPress && styles.detailValueLink, emergency && styles.detailValueEmerg]}>
        {value}
      </Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{inner}</Pressable> : inner;
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      backgroundColor: c.surface, borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderLight,
    },
    searchIcon: { fontSize: 18 },
    searchInput: {
      flex: 1, fontSize: Typography.bodyMedium, color: c.textPrimary,
      paddingVertical: 4,
    },
    searchClear: {
      fontSize: 18, color: c.textTertiary, paddingHorizontal: Spacing.sm,
    },
    scroll: { padding: Spacing.lg, paddingBottom: Spacing.huge },
    count: {
      fontSize: Typography.labelMedium, color: c.textTertiary,
      marginBottom: Spacing.md,
    },
    card: {
      backgroundColor: c.surface, borderRadius: 12, marginBottom: Spacing.sm,
      ...Shadows.sm, overflow: 'hidden',
    },
    cardHeader: {
      flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm,
    },
    titleRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4,
    },
    cityName: { fontSize: Typography.bodyMedium, fontWeight: '800', color: c.textPrimary },
    typeBadge: {
      paddingHorizontal: 8, paddingVertical: 2,
      backgroundColor: c.primary + '15', borderRadius: 999,
    },
    typeText: { fontSize: 10, fontWeight: '700', color: c.primary },
    embassyName: { fontSize: Typography.labelMedium, color: c.textSecondary },
    arrow: { fontSize: 18, color: c.textTertiary },

    cardBody: {
      paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderLight, paddingTop: Spacing.md,
      gap: Spacing.sm,
    },
    detailRow: { flexDirection: 'row', gap: Spacing.sm },
    detailLabel: {
      width: 70, fontSize: Typography.labelSmall, color: c.textTertiary,
      fontWeight: '600', paddingTop: 2,
    },
    detailValue: { flex: 1, fontSize: Typography.bodyMedium, color: c.textPrimary, lineHeight: 22 },
    detailValueLink: { color: c.accent, fontWeight: '600' },
    detailValueEmerg: { color: '#dc2626', fontWeight: '700' },

    mapButton: {
      marginTop: Spacing.sm, padding: Spacing.md, borderRadius: 8,
      backgroundColor: c.primary, alignItems: 'center',
    },
    mapButtonText: { color: c.textOnPrimary, fontWeight: '700', fontSize: Typography.bodyMedium },

    empty: {
      alignItems: 'center', padding: Spacing.huge,
    },
    emptyIcon: { fontSize: 48, marginBottom: Spacing.md, opacity: 0.5 },
    emptyText: { color: c.textTertiary, fontSize: Typography.bodyMedium },

    footer: {
      marginTop: Spacing.xl, fontSize: Typography.labelSmall,
      color: c.textTertiary, textAlign: 'center',
      lineHeight: Typography.labelSmall * 1.6,
    },
  });
}
