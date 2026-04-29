/**
 * 여행 회고 — 완료된 여행 자동 요약 카드
 * - 핵심 숫자 (일수, 일정 수, 기록 수, 지출)
 * - 카테고리별 지출
 * - 베스트 사진 (기록의 첫 사진들)
 * - SNS 공유 가능한 1페이지 형태
 */
import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Typography, Spacing, Shadows, Fonts } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { getDB } from '@/db/database';
import { EXPENSE_CATEGORIES } from '@/db/schema';
import type { Trip } from '@/types';
import { exportRecapAsPdf } from '@/utils/recapExport';

interface RecapData {
  trip: Trip | null;
  days: number;
  itemCount: number;
  logCount: number;
  totalSpent: number;
  byCategory: { key: string; label: string; icon: string; total: number }[];
  photos: string[];
}

export default function TripRecapScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);

  const [data, setData] = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDB();
      const t = await db.getFirstAsync<{
        id: number; title: string; country: string | null; city: string | null; city_id: string | null;
        country_code: string | null; start_date: string | null; end_date: string | null;
        budget: number; currency: string; status: string; cover_image: string | null;
        memo: string | null; is_favorite: number; created_at: string; updated_at: string;
      }>('SELECT * FROM trips WHERE id = ?', [tripId]);

      if (!t) {
        setData(null);
        setLoading(false);
        return;
      }

      const trip: Trip = {
        id: t.id, title: t.title, country: t.country, countryCode: t.country_code,
        city: t.city, cityId: t.city_id ?? null,
        startDate: t.start_date, endDate: t.end_date,
        budget: t.budget, currency: t.currency,
        status: t.status as Trip['status'],
        coverImage: t.cover_image, memo: t.memo, isFavorite: !!t.is_favorite,
        createdAt: t.created_at, updatedAt: t.updated_at,
      };

      // 일수
      let days = 0;
      if (t.start_date && t.end_date) {
        const s = new Date(t.start_date);
        const e = new Date(t.end_date);
        if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
          days = Math.max(1, Math.floor((e.getTime() - s.getTime()) / 86400000) + 1);
        }
      }

      const items = await db.getAllAsync<{ c: number }>('SELECT COUNT(*) as c FROM trip_items WHERE trip_id = ?', [tripId]);
      const logs = await db.getAllAsync<{ c: number; images: string }>(
        `SELECT COUNT(*) as c, GROUP_CONCAT(images, '|||') as images FROM trip_logs WHERE trip_id = ?`,
        [tripId],
      );

      // 지출
      const expenses = await db.getAllAsync<{
        category: string; amount: number; amount_in_home_currency: number | null;
      }>('SELECT category, amount, amount_in_home_currency FROM expenses WHERE trip_id = ?', [tripId]);
      let totalSpent = 0;
      const catMap = new Map<string, number>();
      for (const e of expenses) {
        const amt = e.amount_in_home_currency ?? e.amount ?? 0;
        totalSpent += amt;
        catMap.set(e.category, (catMap.get(e.category) ?? 0) + amt);
      }
      const byCategory = Array.from(catMap.entries())
        .map(([key, total]) => {
          const meta = EXPENSE_CATEGORIES.find((c) => c.key === key);
          return { key, label: meta?.label ?? key, icon: meta?.icon ?? '💰', total };
        })
        .sort((a, b) => b.total - a.total);

      // 사진 — 기록의 첫 6개만
      const allPhotos: string[] = [];
      const imagesRaw = logs[0]?.images;
      if (imagesRaw) {
        for (const block of imagesRaw.split('|||')) {
          try {
            const arr = JSON.parse(block) as string[];
            for (const url of arr) {
              if (url && allPhotos.length < 6) allPhotos.push(url);
            }
          } catch {/* ignore */}
        }
      }

      setData({
        trip,
        days,
        itemCount: items[0]?.c ?? 0,
        logCount: logs[0]?.c ?? 0,
        totalSpent,
        byCategory,
        photos: allPhotos,
      });
    } catch (err) {
      console.error('[recap] load failed:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingBox}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!data || !data.trip) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🤷</Text>
          <Text style={styles.emptyTitle}>여행을 찾을 수 없어요</Text>
        </View>
      </SafeAreaView>
    );
  }

  const t = data.trip;
  const period = t.startDate && t.endDate
    ? `${t.startDate.replace(/-/g, '.')} ~ ${t.endDate.replace(/-/g, '.')}`
    : '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>📔 여행 회고</Text>
        <Pressable
          onPress={() => {
            haptic.medium();
            const period = t.startDate && t.endDate
              ? `${t.startDate.replace(/-/g, '.')} ~ ${t.endDate.replace(/-/g, '.')}`
              : '';
            const byCategoryWithPct = data.byCategory.map((c) => ({
              ...c,
              pct: data.totalSpent > 0 ? (c.total / data.totalSpent) * 100 : 0,
            }));
            exportRecapAsPdf({
              title: t.title,
              country: t.country,
              city: t.city,
              period,
              days: data.days,
              itemCount: data.itemCount,
              logCount: data.logCount,
              totalSpent: data.totalSpent,
              currency: t.currency,
              byCategory: byCategoryWithPct,
              memo: t.memo,
            });
          }}
          hitSlop={10}
          style={styles.shareBtn}
        >
          <Text style={styles.shareText}>↗</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 히어로 */}
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>TRAVEL RECAP</Text>
          <Text style={styles.heroTitle}>{t.title}</Text>
          {t.country && <Text style={styles.heroSub}>{t.country}{t.city ? ` · ${t.city}` : ''}</Text>}
          {period && <Text style={styles.heroPeriod}>{period}</Text>}
        </View>

        {/* 핵심 숫자 */}
        <View style={styles.numGrid}>
          <NumCard label="일수" value={data.days} unit="일" styles={styles} />
          <NumCard label="일정" value={data.itemCount} unit="개" styles={styles} />
          <NumCard label="기록" value={data.logCount} unit="개" styles={styles} />
          <NumCard
            label="지출"
            value={Math.round(data.totalSpent)}
            unit={t.currency}
            styles={styles}
          />
        </View>

        {/* 카테고리별 지출 */}
        {data.byCategory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💰 카테고리별 지출</Text>
            {data.byCategory.map((c) => {
              const pct = data.totalSpent > 0 ? (c.total / data.totalSpent) * 100 : 0;
              return (
                <View key={c.key} style={styles.catRow}>
                  <Text style={styles.catIcon}>{c.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.catLabelRow}>
                      <Text style={styles.catLabel}>{c.label}</Text>
                      <Text style={styles.catValue}>
                        {c.total.toLocaleString()} {t.currency}
                      </Text>
                    </View>
                    <View style={styles.catBar}>
                      <View style={[styles.catBarFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* 베스트 사진 */}
        {data.photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📸 사진</Text>
            <View style={styles.photoGrid}>
              {data.photos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.photo} />
              ))}
            </View>
          </View>
        )}

        {/* 메모 */}
        {t.memo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 메모</Text>
            <Text style={styles.memoText}>{t.memo}</Text>
          </View>
        )}

        <View style={{ height: Spacing.huge }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function NumCard({ label, value, unit, styles }: {
  label: string; value: number; unit: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.numCard}>
      <Text style={styles.numValue}>{value.toLocaleString()}</Text>
      <Text style={styles.numUnit}>{unit}</Text>
      <Text style={styles.numLabel}>{label}</Text>
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
    shareBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center', justifyContent: 'center',
    },
    shareText: { fontSize: 18, color: c.primary, fontWeight: '700' },

    loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    emptyIcon: { fontSize: 56 },
    emptyTitle: { fontSize: Typography.titleMedium, fontWeight: '700', color: c.textPrimary },

    scroll: { padding: Spacing.lg, gap: Spacing.lg },

    hero: {
      backgroundColor: c.primary, padding: Spacing.xl, borderRadius: 16,
      ...Shadows.medium,
    },
    heroEyebrow: {
      fontFamily: Fonts.bodyEnSemiBold, fontSize: 11,
      color: c.textOnPrimary, letterSpacing: 2.5, opacity: 0.8,
    },
    heroTitle: {
      fontFamily: Fonts.bodyKrBold, fontSize: Typography.displaySmall,
      color: c.textOnPrimary, marginTop: Spacing.xs,
    },
    heroSub: { fontSize: Typography.bodyMedium, color: c.textOnPrimary, opacity: 0.9, marginTop: 4 },
    heroPeriod: { fontSize: Typography.labelMedium, color: c.textOnPrimary, opacity: 0.8, marginTop: Spacing.xs },

    numGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    numCard: {
      flex: 1, minWidth: '47%',
      backgroundColor: c.surface, borderRadius: 12,
      borderWidth: 1, borderColor: c.border,
      padding: Spacing.md,
      ...Shadows.soft,
    },
    numValue: { fontFamily: Fonts.bodyEnBold, fontSize: 32, color: c.primary, letterSpacing: -1 },
    numUnit: { fontSize: Typography.labelSmall, color: c.textTertiary, fontWeight: '600' },
    numLabel: { fontSize: Typography.labelSmall, color: c.textSecondary, marginTop: Spacing.xs },

    section: {
      backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border,
      padding: Spacing.lg, gap: Spacing.md,
    },
    sectionTitle: { fontSize: Typography.titleSmall, fontWeight: '700', color: c.textPrimary },
    catRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    catIcon: { fontSize: 22, width: 28 },
    catLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    catLabel: { fontSize: Typography.bodyMedium, color: c.textPrimary, fontWeight: '600' },
    catValue: { fontSize: Typography.labelMedium, color: c.textSecondary, fontWeight: '700' },
    catBar: { height: 6, backgroundColor: c.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
    catBarFill: { height: '100%', backgroundColor: c.primary },

    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    photo: { width: '32.5%', aspectRatio: 1, borderRadius: 8, backgroundColor: c.surfaceAlt },

    memoText: { fontSize: Typography.bodyMedium, color: c.textPrimary, lineHeight: Typography.bodyMedium * 1.6 },
  });
}
