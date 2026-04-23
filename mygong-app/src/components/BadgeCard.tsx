/**
 * 뱃지 카드 컴포넌트 (내 뱃지 화면용)
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts, FontSizes } from '@/theme/theme';
import type { Badge } from '@/types';

const TIER_COLORS = {
  bronze:  { bg: '#f5e6d3', fg: '#8b6332' },
  silver:  { bg: '#e8e8e8', fg: '#555555' },
  gold:    { bg: '#fff3c4', fg: '#9a7410' },
  special: { bg: '#e7d8ff', fg: '#5a2ba8' },
};

export function BadgeCard({ badge }: { badge: Badge }) {
  const tier = TIER_COLORS[badge.tier];

  return (
    <View style={[styles.card, badge.unlocked ? styles.cardUnlocked : styles.cardLocked]}>
      <View style={[styles.iconCircle, { backgroundColor: badge.unlocked ? tier.bg : '#f0f0f0' }]}>
        <Text style={[styles.icon, !badge.unlocked && styles.iconLocked]}>
          {badge.unlocked ? badge.icon : '🔒'}
        </Text>
      </View>
      <Text style={[styles.name, !badge.unlocked && styles.textLocked]} numberOfLines={1}>
        {badge.name}
      </Text>
      <Text style={[styles.description, !badge.unlocked && styles.textLocked]} numberOfLines={2}>
        {badge.description}
      </Text>
      {badge.unlocked && (
        <View style={[styles.tierBadge, { backgroundColor: tier.bg }]}>
          <Text style={[styles.tierText, { color: tier.fg }]}>
            {badge.tier === 'bronze' ? '브론즈'
              : badge.tier === 'silver' ? '실버'
              : badge.tier === 'gold' ? '골드' : '스페셜'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '30%',
    aspectRatio: 0.85,
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    justifyContent: 'flex-start',
  },
  cardUnlocked: {
    backgroundColor: Colors.bg,
    borderColor: Colors.divider,
  },
  cardLocked: {
    backgroundColor: '#fafafa',
    borderColor: '#f0f0f0',
    opacity: 0.7,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  icon: { fontSize: 28 },
  iconLocked: { fontSize: 20, opacity: 0.4 },
  name: {
    fontSize: FontSizes.caption,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  description: {
    fontSize: FontSizes.tiny,
    color: Colors.textSub,
    textAlign: 'center',
    lineHeight: 13,
    minHeight: 26,
  },
  textLocked: { color: Colors.textFaint },
  tierBadge: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tierText: {
    fontSize: 9,
    fontFamily: Fonts.bold,
  },
});
