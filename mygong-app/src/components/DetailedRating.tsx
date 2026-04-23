/**
 * 항목별 별점 컴포넌트.
 * 카테고리에 따라 다른 항목들 표시.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Fonts, FontSizes, Spacing } from '@/theme/theme';
import { getRatingItems } from '@/db/schema';
import type { DetailedRatings } from '@/types';

type Props = {
  category?: string;
  value?: DetailedRatings;
  onChange: (v: DetailedRatings) => void;
};

export function DetailedRating({ category, value, onChange }: Props) {
  const items = getRatingItems(category);
  const ratings = value ?? {};

  const setRating = (key: string, star: number) => {
    // 같은 별 다시 누르면 0 (취소)
    const current = ratings[key] ?? 0;
    const next = current === star ? 0 : star;
    onChange({ ...ratings, [key]: next });
  };

  return (
    <View style={styles.container}>
      {items.map((item) => {
        const score = ratings[item.key] ?? 0;
        return (
          <View key={item.key} style={styles.row}>
            <Text style={styles.label}>{item.label}</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setRating(item.key, n)}
                  hitSlop={6}
                  style={styles.starPress}
                >
                  <Text style={[styles.star, score >= n && styles.starActive]}>
                    {score >= n ? '★' : '☆'}
                  </Text>
                </Pressable>
              ))}
              {score > 0 && (
                <Text style={styles.scoreText}>{score}.0</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgMuted,
    borderRadius: 10,
    padding: Spacing.md,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: FontSizes.body,
    fontFamily: Fonts.medium,
    color: Colors.text,
    width: 100,
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starPress: { paddingHorizontal: 2 },
  star: {
    fontSize: 24,
    color: Colors.border,
  },
  starActive: {
    color: '#f4c430',
  },
  scoreText: {
    marginLeft: 8,
    fontSize: FontSizes.caption,
    fontFamily: Fonts.semibold,
    color: Colors.textSub,
    minWidth: 26,
  },
});
