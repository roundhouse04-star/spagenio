import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ballColor } from '../lib/theme';

// outlined=true → 흰 배경 + 색 테두리 + 색 텍스트 (매칭 안 된 번호 표시용)
// outlined=false (default) → 색 채움 + 흰 텍스트
// hit=true → 초록 테두리 (강조용, optional)
export default function LottoBall({ n, size = 40, hit = false, outlined = false }) {
  const color = ballColor(n);
  return (
    <View
      style={[
        styles.ball,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: outlined ? '#fff' : color,
          borderWidth: outlined ? 2 : (hit ? 3 : 0),
          borderColor: outlined ? color : (hit ? '#22c55e' : 'transparent'),
        },
      ]}
    >
      <Text style={[
        styles.text,
        {
          fontSize: size * 0.42,
          color: outlined ? color : '#fff',
        },
      ]}>{n}</Text>
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
  text: {
    fontWeight: '800',
  },
});
