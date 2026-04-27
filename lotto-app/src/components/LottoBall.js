import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ballColor } from '../lib/theme';

export default function LottoBall({ n, size = 40, hit = false }) {
  return (
    <View
      style={[
        styles.ball,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: ballColor(n),
        },
        hit && styles.hit,
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.42 }]}>{n}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ball: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  hit: {
    borderWidth: 3,
    borderColor: '#22c55e',
  },
  text: {
    color: '#fff',
    fontWeight: '800',
  },
});
