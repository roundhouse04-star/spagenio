/**
 * 국가별 감염병 / 권장 백신 정보
 *
 * 기능:
 *  - 국가 검색
 *  - 백신 위험도 색상 표시 (none/basic/medium/high)
 *  - 클릭 시 상세 (백신 목록 + 예방 수칙)
 *
 * 출처: src/data/safety/diseases.ts
 */
import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { DISEASE_INFO, getVaccinationRisk } from '@/data/safety/diseases';
import type { DiseaseInfo } from '@/data/safety/types';

// 국가코드 → 한글명 매핑
const COUNTRY_NAMES: Record<string, string> = {
  TH: '태국', VN: '베트남', PH: '필리핀', ID: '인도네시아', SG: '싱가포르',
  JP: '일본', CN: '중국', TW: '대만',
  GB: '영국', FR: '프랑스', IT: '이탈리아',
  US: '미국', MX: '멕시코', BR: '브라질',
  AE: 'UAE', TR: '튀르키예',
  AU: '호주', EG: '이집트',
};

const COUNTRY_FLAG: Record<string, string> = {
  TH: '🇹🇭', VN: '🇻🇳', PH: '🇵🇭', ID: '🇮🇩', SG: '🇸🇬',
  JP: '🇯🇵', CN: '🇨🇳', TW: '🇹🇼',
  GB: '🇬🇧', FR: '🇫🇷', IT: '🇮🇹',
  US: '🇺🇸', MX: '🇲🇽', BR: '🇧🇷',
  AE: '🇦🇪', TR: '🇹🇷',
  AU: '🇦🇺', EG: '🇪🇬',
};

const RISK_META = {
  none: { color: '#10B981', label: '낮음' },
  basic: { color: '#3B82F6', label: '기본 백신' },
  medium: { color: '#F59E0B', label: '주의' },
  high: { color: '#EF4444', label: '필수 백신' },
} as const;

export default function DiseasesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return DISEASE_INFO;
    const q = search.toLowerCase();
    return DISEASE_INFO.filter((d) => {
      const name = COUNTRY_NAMES[d.countryCode] ?? '';
      return d.countryCode.toLowerCase().includes(q) || name.toLowerCase().includes(q);
    });
  }, [search]);

  return (
    <>
      <Stack.Screen options={{ title: '감염병 / 백신 정보', headerBackTitle: '안전' }} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            placeholder="국가명 검색 (예: 태국, 일본, US)"
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.legend}>
            <Text style={styles.legendTitle}>백신 위험도</Text>
            <View style={styles.legendRow}>
              {(['none', 'basic', 'medium', 'high'] as const).map((r) => (
                <View key={r} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: RISK_META[r].color }]} />
                  <Text style={styles.legendLabel}>{RISK_META[r].label}</Text>
                </View>
              ))}
            </View>
          </View>

          {filtered.map((d) => (
            <DiseaseCard
              key={d.countryCode}
              info={d}
              isOpen={openId === d.countryCode}
              onToggle={() => {
                haptic.tap();
                setOpenId(openId === d.countryCode ? null : d.countryCode);
              }}
              styles={styles}
            />
          ))}

          <Text style={styles.footer}>
            데이터: WHO + 질병관리청 (KDCA){'\n'}
            출국 4~6주 전 보건소 / 가정의학과 상담 권장.{'\n'}
            실시간 감염병 발생은 Phase 2 에서 API 연동 예정.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function DiseaseCard({
  info, isOpen, onToggle, styles,
}: {
  info: DiseaseInfo;
  isOpen: boolean;
  onToggle: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const risk = getVaccinationRisk(info.countryCode);
  const meta = RISK_META[risk];
  const flag = COUNTRY_FLAG[info.countryCode] ?? '🌍';
  const name = COUNTRY_NAMES[info.countryCode] ?? info.countryCode;

  return (
    <View style={styles.card}>
      <Pressable style={styles.cardHeader} onPress={onToggle}>
        <Text style={styles.flag}>{flag}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.countryName}>{name}</Text>
          <View style={[styles.riskChip, { backgroundColor: meta.color + '20' }]}>
            <View style={[styles.riskDot, { backgroundColor: meta.color }]} />
            <Text style={[styles.riskText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        <Text style={styles.arrow}>{isOpen ? '▾' : '›'}</Text>
      </Pressable>

      {isOpen && (
        <View style={styles.cardBody}>
          {info.vaccinesRequired.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>⚠️ 입국 필수 백신</Text>
              <Text style={styles.vaccineRequired}>{info.vaccinesRequired.join(' · ')}</Text>
            </>
          )}

          <Text style={[styles.sectionLabel, info.vaccinesRequired.length > 0 && { marginTop: 16 }]}>
            💉 권장 백신
          </Text>
          {info.vaccinesRecommended.length > 0 ? (
            <View style={styles.vaccineList}>
              {info.vaccinesRecommended.map((v) => (
                <View key={v} style={styles.vaccineChip}>
                  <Text style={styles.vaccineChipText}>{v}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noVaccine}>특별한 권장 백신 없음</Text>
          )}

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>🛡 예방 수칙</Text>
          {info.preventionTipsKo.map((tip, i) => (
            <Text key={i} style={styles.tipText}>• {tip}</Text>
          ))}

          <Text style={styles.sourceText}>
            출처: {info.source} · {info.lastUpdated}
          </Text>
        </View>
      )}
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      backgroundColor: c.surface,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderLight,
    },
    searchIcon: { fontSize: 18 },
    searchInput: { flex: 1, fontSize: Typography.bodyMedium, color: c.textPrimary, paddingVertical: 4 },
    scroll: { padding: Spacing.lg, paddingBottom: Spacing.huge },
    legend: {
      backgroundColor: c.surface, borderRadius: 12,
      padding: Spacing.md, marginBottom: Spacing.lg, ...Shadows.sm,
    },
    legendTitle: {
      fontSize: Typography.labelSmall, color: c.textTertiary,
      fontWeight: '600', marginBottom: Spacing.sm,
    },
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { fontSize: Typography.labelSmall, color: c.textSecondary },

    card: {
      backgroundColor: c.surface, borderRadius: 12, marginBottom: Spacing.sm,
      ...Shadows.sm, overflow: 'hidden',
    },
    cardHeader: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md,
    },
    flag: { fontSize: 28 },
    countryName: { fontSize: Typography.bodyMedium, fontWeight: '700', color: c.textPrimary, marginBottom: 4 },
    riskChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      alignSelf: 'flex-start',
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    },
    riskDot: { width: 6, height: 6, borderRadius: 3 },
    riskText: { fontSize: 11, fontWeight: '700' },
    arrow: { fontSize: 18, color: c.textTertiary },

    cardBody: {
      paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderLight, paddingTop: Spacing.md,
    },
    sectionLabel: {
      fontSize: Typography.labelSmall, fontWeight: '700',
      color: c.accent, marginBottom: Spacing.sm,
      letterSpacing: 0.3,
    },
    vaccineRequired: {
      fontSize: Typography.bodyMedium, color: '#dc2626', fontWeight: '700',
      backgroundColor: '#fef2f2', padding: Spacing.sm, borderRadius: 8,
    },
    vaccineList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    vaccineChip: {
      backgroundColor: c.surfaceAlt, paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 999,
    },
    vaccineChipText: { fontSize: Typography.labelSmall, color: c.textPrimary, fontWeight: '600' },
    noVaccine: { fontSize: Typography.labelMedium, color: c.textTertiary, fontStyle: 'italic' },

    tipText: {
      fontSize: Typography.labelMedium, color: c.textSecondary,
      lineHeight: Typography.labelMedium * 1.7, marginBottom: 2,
    },

    sourceText: {
      marginTop: Spacing.md, fontSize: Typography.labelSmall,
      color: c.textTertiary, fontStyle: 'italic',
    },

    footer: {
      marginTop: Spacing.xl, fontSize: Typography.labelSmall,
      color: c.textTertiary, textAlign: 'center',
      lineHeight: Typography.labelSmall * 1.6,
    },
  });
}
