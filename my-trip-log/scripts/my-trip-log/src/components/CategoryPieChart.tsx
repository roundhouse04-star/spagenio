/**
 * 카테고리별 파이차트 + 범례 (재사용 컴포넌트)
 *
 * 사용처: app/expenses/[id].tsx, app/expenses/index.tsx
 *
 * - SVG 도넛 차트 (WebView)
 * - 범례 클릭 시 onCategoryToggle 콜백 호출 (필터링용)
 */
import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { EXPENSE_CATEGORIES } from '@/db/schema';
import { ExpenseCategory } from '@/types';

// 카테고리별 색상 (Pie chart용 — 서로 뚜렷하게 구별되게)
export const CATEGORY_COLORS: Record<string, string> = {
  food: '#F56565',
  transport: '#4299E1',
  accommodation: '#9F7AEA',
  activity: '#48BB78',
  entertainment: '#F687B3',
  shopping: '#ED8936',
  sightseeing: '#38B2AC',
  other: '#A0AEC0',
};

export type CategoryStat = {
  category: ExpenseCategory | string;
  total: number;
  count: number;
};

export function CategoryPieChart({
  stats,
  total,
  activeCategory,
  onCategoryToggle,
  title = '카테고리별 지출',
}: {
  stats: CategoryStat[];
  total: number;
  activeCategory?: string;
  onCategoryToggle?: (category: string) => void;
  title?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (stats.length === 0 || total <= 0) {
    return null;
  }

  const pieHtml = useMemo(() => buildPieChartHtml(stats, total), [stats, total]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>

      <View style={styles.chartCard}>
        <View style={styles.pieWrap}>
          <WebView
            source={{ html: pieHtml }}
            style={styles.pie}
            scrollEnabled={false}
            javaScriptEnabled
            backgroundColor="transparent"
          />
        </View>

        {/* 범례 */}
        <View style={styles.legend}>
          {stats.map((stat) => {
            const cat = EXPENSE_CATEGORIES.find((c) => c.key === stat.category);
            const pct = total > 0 ? (stat.total / total) * 100 : 0;
            const color = CATEGORY_COLORS[stat.category] || '#A0AEC0';
            const isActive = activeCategory === stat.category;
            const isClickable = !!onCategoryToggle;

            const Inner = (
              <>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendIcon}>{cat?.icon || '💰'}</Text>
                <View style={styles.legendBody}>
                  <Text style={styles.legendLabel}>
                    {cat?.label || stat.category}
                  </Text>
                  <Text style={styles.legendMeta}>{stat.count}건</Text>
                </View>
                <View style={styles.legendRight}>
                  <Text style={styles.legendAmount}>
                    ₩{stat.total.toLocaleString()}
                  </Text>
                  <Text style={styles.legendPercent}>{pct.toFixed(1)}%</Text>
                </View>
              </>
            );

            return isClickable ? (
              <Pressable
                key={stat.category}
                style={[styles.legendItem, isActive && styles.legendItemActive]}
                onPress={() => onCategoryToggle!(stat.category as string)}
              >
                {Inner}
              </Pressable>
            ) : (
              <View key={stat.category} style={styles.legendItem}>
                {Inner}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ====== Pie Chart HTML 생성 ======
function buildPieChartHtml(stats: CategoryStat[], total: number): string {
  const segments = stats.map((s) => ({
    value: s.total,
    color: CATEGORY_COLORS[s.category] || '#A0AEC0',
  }));

  const size = 200;
  const radius = size / 2;
  const cx = radius;
  const cy = radius;
  const innerRadius = radius * 0.55;

  let currentAngle = -90;
  const paths = segments.map((seg) => {
    const angle = (seg.value / total) * 360;
    // 100% 한 카테고리만 있으면 SVG arc가 안 그려짐 — 원으로 fallback
    if (angle >= 359.999) {
      return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${seg.color}" />
              <circle cx="${cx}" cy="${cy}" r="${innerRadius}" fill="white" />`;
    }
    const endAngle = currentAngle + angle;

    const start = polarToCartesian(cx, cy, radius, currentAngle);
    const end = polarToCartesian(cx, cy, radius, endAngle);
    const innerStart = polarToCartesian(cx, cy, innerRadius, endAngle);
    const innerEnd = polarToCartesian(cx, cy, innerRadius, currentAngle);

    const largeArc = angle > 180 ? 1 : 0;

    const d = [
      `M ${start.x} ${start.y}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`,
      `L ${innerStart.x} ${innerStart.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
      'Z',
    ].join(' ');

    currentAngle = endAngle;
    return `<path d="${d}" fill="${seg.color}" />`;
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body {
      margin: 0; padding: 0; height: 100%;
      display: flex; align-items: center; justify-content: center;
      background: transparent;
    }
    svg { display: block; }
    .total { position: absolute; text-align: center; }
    .total-label { font-size: 10px; color: #8E96A6; font-family: -apple-system, sans-serif; }
    .total-value { font-size: 15px; font-weight: 700; color: #1E2A3A; font-family: -apple-system, sans-serif; }
  </style>
</head>
<body>
  <div style="position: relative; width: ${size}px; height: ${size}px;">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${paths.join('\n      ')}
    </svg>
    <div class="total" style="top: 50%; left: 50%; transform: translate(-50%, -50%);">
      <div class="total-label">총 지출</div>
      <div class="total-value">₩${Math.round(total).toLocaleString()}</div>
    </div>
  </div>
</body>
</html>
  `;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    section: { marginTop: Spacing.xl },
    sectionTitle: {
      fontSize: Typography.bodyLarge,
      color: c.textPrimary,
      fontWeight: '700',
      marginHorizontal: Spacing.xl,
      marginBottom: Spacing.md,
    },
    chartCard: {
      backgroundColor: c.surface,
      marginHorizontal: Spacing.xl,
      borderRadius: 16,
      padding: Spacing.lg,
      ...Shadows.sm,
    },
    pieWrap: {
      height: 220,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    pie: {
      width: 220,
      height: 220,
      backgroundColor: 'transparent',
    },
    legend: { gap: Spacing.xs },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: 10,
      backgroundColor: c.surfaceAlt,
    },
    legendItemActive: {
      backgroundColor: c.primary + '20',
      borderWidth: 1,
      borderColor: c.primary,
    },
    legendDot: { width: 12, height: 12, borderRadius: 6 },
    legendIcon: { fontSize: 18 },
    legendBody: { flex: 1 },
    legendLabel: {
      fontSize: Typography.bodyMedium,
      color: c.textPrimary,
      fontWeight: '600',
    },
    legendMeta: {
      fontSize: Typography.labelSmall,
      color: c.textTertiary,
    },
    legendRight: { alignItems: 'flex-end' },
    legendAmount: {
      fontSize: Typography.bodyMedium,
      color: c.textPrimary,
      fontWeight: '700',
    },
    legendPercent: {
      fontSize: Typography.labelSmall,
      color: c.textTertiary,
    },
  });
}
