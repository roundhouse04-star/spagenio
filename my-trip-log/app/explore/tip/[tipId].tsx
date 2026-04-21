import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { TRAVEL_TIPS, TIP_CATEGORIES } from '@/data/destinations';

export default function TipDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { tipId } = useLocalSearchParams<{ tipId: string }>();
  const tip = TRAVEL_TIPS.find(t => t.id === tipId);

  if (!tip) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>팁을 찾을 수 없어요</Text>
        </View>
      </SafeAreaView>
    );
  }

  const categoryInfo = TIP_CATEGORIES.find(c => c.key === tip.category);

  // 같은 카테고리의 다른 팁
  const relatedTips = TRAVEL_TIPS.filter(t =>
    t.category === tip.category && t.id !== tip.id
  ).slice(0, 3);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 헤더 섹션 */}
        <View style={styles.heroCard}>
          <Text style={styles.heroIcon}>{tip.icon}</Text>
          {categoryInfo && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {categoryInfo.icon} {categoryInfo.label}
              </Text>
            </View>
          )}
          <Text style={styles.title}>{tip.title}</Text>
          <Text style={styles.summary}>{tip.summary}</Text>
        </View>

        {/* 상세 내용 */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsLabel}>자세히 알아보기</Text>
          {tip.details.map((detail, i) => (
            <View key={i} style={styles.detailItem}>
              <View style={styles.detailNum}>
                <Text style={styles.detailNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.detailText}>{detail}</Text>
            </View>
          ))}
        </View>

        {/* 관련 팁 */}
        {relatedTips.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              {categoryInfo && `${categoryInfo.icon} ${categoryInfo.label}`} 관련 팁
            </Text>
            <View style={{ gap: Spacing.sm }}>
              {relatedTips.map(t => (
                <Pressable
                  key={t.id}
                  style={styles.relatedCard}
                  onPress={() => {
                    haptic.tap();
                    router.push(`/explore/tip/${t.id}`);
                  }}
                >
                  <Text style={styles.relatedIcon}>{t.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.relatedTitle}>{t.title}</Text>
                    <Text style={styles.relatedSummary}>{t.summary}</Text>
                  </View>
                  <Text style={styles.relatedArrow}>›</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <View style={{ height: Spacing.huge }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 22, color: c.textPrimary },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: Typography.bodyMedium, color: c.textTertiary },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.huge },

  heroCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: c.primary,
    borderRadius: 20,
    marginBottom: Spacing.lg,
  },
  heroIcon: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  categoryBadge: {
    backgroundColor: c.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: Spacing.md,
  },
  categoryBadgeText: {
    fontSize: Typography.labelSmall,
    fontWeight: '700',
    color: c.textOnAccent,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: Typography.titleLarge,
    fontWeight: '700',
    color: c.textOnPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  summary: {
    fontSize: Typography.bodyMedium,
    color: c.accent,
    textAlign: 'center',
    fontWeight: '500',
  },

  detailsCard: {
    backgroundColor: c.surface,
    padding: Spacing.lg,
    borderRadius: 14,
    ...Shadows.sm,
  },
  detailsLabel: {
    fontSize: Typography.labelMedium,
    color: c.accent,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
  },
  detailItem: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    alignItems: 'flex-start',
  },
  detailNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  detailNumText: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textOnAccent,
  },
  detailText: {
    flex: 1,
    fontSize: Typography.bodyMedium,
    color: c.textPrimary,
    lineHeight: Typography.bodyMedium * 1.7,
  },

  sectionTitle: {
    fontSize: Typography.titleSmall,
    fontWeight: '700',
    color: c.textPrimary,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  relatedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: c.surface,
    padding: Spacing.md,
    borderRadius: 12,
    ...Shadows.sm,
  },
  relatedIcon: { fontSize: 28 },
  relatedTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: c.textPrimary,
  },
  relatedSummary: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    marginTop: 2,
  },
  relatedArrow: {
    fontSize: 20,
    color: c.textTertiary,
  },
});
}
