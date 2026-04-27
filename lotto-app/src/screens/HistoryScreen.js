import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Pressable,
} from 'react-native';
import LottoBall from '../components/LottoBall';
import { fetchRecentHistory } from '../lib/lottoApi';
import { theme } from '../lib/theme';
import BannerAdSlot from '../components/BannerAdSlot';

function formatWon(amount) {
  if (!amount) return '-';
  if (amount >= 100_000_000) return (amount / 100_000_000).toFixed(amount >= 1_000_000_000 ? 1 : 2) + '억';
  if (amount >= 10_000) return Math.floor(amount / 10_000).toLocaleString() + '만';
  return amount.toLocaleString();
}

export default function HistoryScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [latest, setLatest] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    const { latest: lr, history } = await fetchRecentHistory(50);
    setLatest(lr);
    setRows([...history].sort((a, b) => b.drwNo - a.drwNo));
  }, []);

  useEffect(() => {
    navigation?.setOptions?.({ title: '📜 회차 정보 & 당첨금' });
    (async () => {
      setLoading(true);
      try { await load(); } finally { setLoading(false); }
    })();
  }, [load, navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loaderText}>회차 데이터 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(it) => String(it.drwNo)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>📜 회차 정보</Text>
          <Text style={styles.headerSub}>최신 {latest ?? '?'}회 · 최근 {rows.length}회차</Text>
          <Text style={styles.headerHint}>회차 카드를 탭하면 상세 당첨금이 펼쳐집니다</Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>데이터를 불러오지 못했습니다.</Text>
      }
      renderItem={({ item }) => {
        const isOpen = expanded === item.drwNo;
        return (
          <Pressable
            onPress={() => setExpanded(isOpen ? null : item.drwNo)}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.row}>
              <Text style={styles.round}>{item.drwNo}회</Text>
              <Text style={styles.date}>{item.drwDate}</Text>
            </View>
            <View style={styles.balls}>
              {item.numbers.map((n) => <LottoBall key={n} n={n} size={32} />)}
              <Text style={styles.plus}>+</Text>
              <LottoBall n={item.bonus} size={32} />
            </View>
            {item.prizes && (
              <View style={styles.summary}>
                <Text style={styles.summaryTxt}>
                  🏆 1등 {item.prizes[1]?.count ?? 0}명 · {formatWon(item.prizes[1]?.amount)}원
                </Text>
                <Text style={styles.expand}>{isOpen ? '접기 ▴' : '상세 ▾'}</Text>
              </View>
            )}
            {isOpen && item.prizes && (
              <View style={styles.prizeBox}>
                {[1, 2, 3, 4, 5].map((rk) => {
                  const p = item.prizes[rk];
                  if (!p) return null;
                  return (
                    <View key={rk} style={styles.prizeRow}>
                      <Text style={styles.prizeRank}>{rk}등</Text>
                      <Text style={styles.prizeCount}>{(p.count ?? 0).toLocaleString()}명</Text>
                      <Text style={styles.prizeAmount}>{formatWon(p.amount)}원</Text>
                    </View>
                  );
                })}
                {item.prizes[1]?.auto !== undefined && (
                  <Text style={styles.autoNote}>
                    ※ 1등 내역: 자동 {item.prizes[1].auto ?? 0}명 · 수동 {item.prizes[1].manual ?? 0}명
                    {item.prizes[1].semi != null ? ` · 반자동 ${item.prizes[1].semi}명` : ''}
                  </Text>
                )}
              </View>
            )}
          </Pressable>
        );
      }}
    />
    <BannerAdSlot position="bottom" />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 40 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg },
  loaderText: { marginTop: 12, color: theme.textSub },
  headerCard: {
    backgroundColor: theme.primary, borderRadius: 14, padding: 16, marginBottom: 14,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4 },
  headerHint: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 6 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: theme.border,
    padding: 12, marginBottom: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  round: { fontWeight: '800', color: theme.primary, fontSize: 15 },
  date: { color: theme.textSub, fontSize: 12 },
  balls: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  plus: { fontSize: 14, color: theme.textSub, fontWeight: '700' },
  summary: {
    marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  summaryTxt: { color: theme.text, fontSize: 12, fontWeight: '600' },
  expand: { color: theme.primary, fontSize: 11, fontWeight: '700' },
  prizeBox: {
    marginTop: 10, padding: 10, backgroundColor: '#fafafa', borderRadius: 8,
    borderWidth: 1, borderColor: theme.border,
  },
  prizeRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 4,
  },
  prizeRank: { width: 36, fontWeight: '800', color: theme.text, fontSize: 12 },
  prizeCount: { flex: 1, color: theme.textSub, fontSize: 12, textAlign: 'right' },
  prizeAmount: { width: 90, color: theme.text, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  autoNote: { fontSize: 11, color: theme.textMuted, marginTop: 6 },
  empty: { textAlign: 'center', color: theme.textSub, paddingVertical: 32 },
});
