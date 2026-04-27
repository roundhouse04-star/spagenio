import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView,
  Dimensions,
} from 'react-native';
import { theme, ballColor } from '../lib/theme';
import { fetchRound, detectLatestRound } from '../lib/lottoApi';

// 1~45 번호를 7열 × 7행 그리드로 배치 (45번까지)
const COLS = 7;
const ROWS = 7;

export default function PatternScreen({ navigation }) {
  const [latest, setLatest] = useState(null);
  const [round, setRound] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cellSize, setCellSize] = useState(40);

  useEffect(() => {
    navigation.setOptions?.({ title: '🔍 패턴분석표' });
    (async () => {
      setLoading(true);
      const lr = await detectLatestRound();
      setLatest(lr);
      setRound(lr);
      const r = await fetchRound(lr);
      setData(r);
      setLoading(false);
    })();
  }, [navigation]);

  const goRound = useCallback(async (target) => {
    if (target < 1 || (latest && target > latest)) return;
    setLoading(true);
    setRound(target);
    const r = await fetchRound(target);
    setData(r);
    setLoading(false);
  }, [latest]);

  // 그리드 셀 위치 계산
  const onLayoutGrid = (e) => {
    const w = e.nativeEvent.layout.width;
    setCellSize(Math.floor((w - 8) / COLS));
  };

  const winningSet = new Set(data?.numbers || []);
  const bonus = data?.bonus;

  // 당첨번호 6개의 그리드 좌표 (라인 그리기용)
  const linePoints = (data?.numbers || []).map((n) => {
    const idx = n - 1;
    const r = Math.floor(idx / COLS);
    const c = idx % COLS;
    return {
      x: c * cellSize + cellSize / 2,
      y: r * cellSize + cellSize / 2,
      n,
    };
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.headerRound}>{round ?? '?'}회</Text>
        <Text style={styles.headerDate}>{data?.drwDate || '추첨일 미정'}</Text>
        {data && (
          <View style={styles.headerBalls}>
            {data.numbers.map((n) => (
              <View key={n} style={[styles.miniBall, { backgroundColor: ballColor(n) }]}>
                <Text style={styles.miniBallTxt}>{n}</Text>
              </View>
            ))}
            <Text style={styles.headerPlus}>+</Text>
            <View style={[styles.miniBall, { backgroundColor: ballColor(bonus), opacity: 0.85 }]}>
              <Text style={styles.miniBallTxt}>{bonus}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.gridWrap} onLayout={onLayoutGrid}>
        {/* 연결선 (당첨번호 순서대로) */}
        <View style={styles.lineLayer} pointerEvents="none">
          {linePoints.length >= 2 && linePoints.slice(0, -1).map((p, i) => {
            const next = linePoints[i + 1];
            const dx = next.x - p.x;
            const dy = next.y - p.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            const cx = (p.x + next.x) / 2;
            const cy = (p.y + next.y) / 2;
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: cx - len / 2,
                  top: cy - 2,
                  width: len,
                  height: 4,
                  backgroundColor: '#22c55e',
                  borderRadius: 2,
                  transform: [{ rotate: `${angle}deg` }],
                  opacity: 0.85,
                }}
              />
            );
          })}
        </View>

        {/* 1~45 그리드 */}
        <View style={styles.grid}>
          {Array.from({ length: COLS * ROWS }).map((_, idx) => {
            const n = idx + 1;
            if (n > 45) return <View key={idx} style={[styles.cell, { width: cellSize, height: cellSize }]} />;
            const hit = winningSet.has(n);
            const isBonus = bonus === n && !hit;
            return (
              <View key={idx} style={[styles.cell, { width: cellSize, height: cellSize }]}>
                <View style={[
                  styles.cellInner,
                  { width: cellSize - 6, height: cellSize - 6 },
                  hit && { backgroundColor: '#1f2937', borderColor: '#1f2937' },
                  isBonus && { backgroundColor: '#fef3c7', borderColor: '#f59e0b' },
                ]}>
                  <Text style={[
                    styles.cellTxt,
                    hit && { color: '#fff', fontWeight: '900' },
                    !hit && !isBonus && { color: '#ef4444' },
                  ]}>
                    {n}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* 회차 네비게이션 */}
      <View style={styles.navWrap}>
        <Pressable
          style={[styles.navBtn, (!round || round <= 1) && styles.navBtnDisabled]}
          disabled={!round || round <= 1}
          onPress={() => goRound((round || 1) - 1)}
        >
          <Text style={styles.navBtnTxt}>◀ 이전회차</Text>
        </Pressable>
        <View style={styles.navCenter}>
          <Text style={styles.navRoundTxt}>{round ?? '-'}회</Text>
          <Text style={styles.navHintTxt}>1 ~ {latest ?? '?'}</Text>
        </View>
        <Pressable
          style={[styles.navBtn, (!round || (latest && round >= latest)) && styles.navBtnDisabled]}
          disabled={!round || (latest && round >= latest)}
          onPress={() => goRound((round || 0) + 1)}
        >
          <Text style={styles.navBtnTxt}>다음회차 ▶</Text>
        </Pressable>
      </View>

      {loading && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      )}

      {/* 메타 정보 */}
      {data && (
        <View style={styles.statsCard}>
          <Stat label="합계" value={data.numbers.reduce((a, b) => a + b, 0)} />
          <Stat label="홀짝" value={`${data.numbers.filter((n) => n % 2 === 1).length}:${data.numbers.filter((n) => n % 2 === 0).length}`} />
          <Stat label="저고" value={`${data.numbers.filter((n) => n <= 22).length}:${data.numbers.filter((n) => n > 22).length}`} />
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 40 },
  headerCard: {
    backgroundColor: theme.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16,
  },
  headerRound: { color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: 1 },
  headerDate: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  headerBalls: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  miniBall: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },
  miniBallTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
  headerPlus: { color: '#fff', fontSize: 18, fontWeight: '700', marginHorizontal: 2 },

  gridWrap: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 4, position: 'relative' },
  lineLayer: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, zIndex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { alignItems: 'center', justifyContent: 'center' },
  cellInner: {
    borderRadius: 999, borderWidth: 1.5, borderColor: '#fca5a5',
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  cellTxt: { fontSize: 13, fontWeight: '700', color: '#ef4444' },

  navWrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 16, gap: 10,
  },
  navBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border,
  },
  navBtnDisabled: { opacity: 0.4 },
  navBtnTxt: { color: theme.text, fontWeight: '700', fontSize: 13 },
  navCenter: { alignItems: 'center', minWidth: 80 },
  navRoundTxt: { fontSize: 18, fontWeight: '800', color: theme.primary },
  navHintTxt: { fontSize: 11, color: theme.textMuted, marginTop: 2 },

  loaderOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.5)',
  },

  statsCard: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: theme.border, marginTop: 16, padding: 12,
  },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 11, color: theme.textSub, fontWeight: '600' },
  statValue: { fontSize: 16, fontWeight: '800', color: theme.text, marginTop: 2 },
});
