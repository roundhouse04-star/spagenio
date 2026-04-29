import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LottoBall from './LottoBall';
import { theme } from '../lib/theme';

export default function GameCard({ index, game, winning, bonus }) {
  const winSet = new Set(winning || []);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{index + 1}번 게임</Text>
        <Text style={styles.meta}>
          홀짝 {game.meta.oddEven} · 저고 {game.meta.lowHigh} · 합 {game.meta.sum}
        </Text>
      </View>
      <View style={styles.balls}>
        {game.numbers.map((n) => (
          <LottoBall
            key={n} n={n} size={42}
            outlined={winning ? !winSet.has(n) : false}
          />
        ))}
        {bonus !== undefined && (
          <View style={styles.bonusWrap}>
            <Text style={styles.plus}>+</Text>
            <LottoBall
              n={bonus} size={42}
              outlined={!game.numbers.includes(bonus)}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    backgroundColor: theme.card,
    padding: 14,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  title: {
    fontWeight: '800',
    color: theme.text,
    fontSize: 14,
  },
  meta: {
    fontSize: 12,
    color: theme.textSub,
  },
  balls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  bonusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  plus: {
    fontSize: 18,
    color: theme.textSub,
    fontWeight: '700',
  },
});
