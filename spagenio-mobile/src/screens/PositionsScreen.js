import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { theme } from '../theme';

// 백엔드: GET /api/alpaca-user/v2/positions → 사용자 Alpaca 보유 포지션
// 화이트리스트 적용된 라우트 (서버 측 routes/front.js 의 ALPACA_PROXY_ALLOW)
export function PositionsScreen() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [noAccount, setNoAccount] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setNoAccount(false);
      const data = await api.get('/api/alpaca-user/v2/positions');
      // 서버가 미등록 계좌면 { ok:false, no_account:true, ... } 응답
      if (data && data.no_account) {
        setNoAccount(true);
        setPositions([]);
        return;
      }
      const list = Array.isArray(data) ? data : (data?.positions || []);
      setPositions(list);
    } catch (e) {
      setError(e.message || '불러오기 실패');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      >
        <Text style={styles.title}>보유 포지션</Text>

        {error && <Text style={styles.error}>⚠️ {error}</Text>}

        {noAccount && (
          <View style={styles.card}>
            <Text style={styles.empty}>Alpaca 계좌가 등록되지 않았습니다.{'\n'}웹 대시보드에서 먼저 계좌를 등록해주세요.</Text>
          </View>
        )}

        {!noAccount && positions.length === 0 && !error && (
          <Text style={styles.empty}>보유 포지션이 없습니다.</Text>
        )}

        {positions.map((p, idx) => {
          const qty = Number(p.qty ?? 0);
          const avg = Number(p.avg_entry_price ?? 0);
          const cur = Number(p.current_price ?? 0);
          const pl = Number(p.unrealized_pl ?? (cur - avg) * qty);
          const plPct = Number(p.unrealized_plpc ?? (avg ? ((cur - avg) / avg) * 100 : 0));
          const plColor = pl > 0 ? theme.green : pl < 0 ? theme.red : theme.subtext;
          return (
            <View key={p.symbol || idx} style={styles.card}>
              <View style={styles.rowTop}>
                <Text style={styles.symbol}>{p.symbol}</Text>
                <Text style={[styles.pl, { color: plColor }]}>
                  {pl > 0 ? '+' : ''}${pl.toFixed(2)} ({plPct.toFixed(2)}%)
                </Text>
              </View>
              <View style={styles.rowBottom}>
                <Stat label="수량" value={qty.toString()} />
                <Stat label="평단" value={`$${avg.toFixed(2)}`} />
                <Stat label="현재가" value={`$${cur.toFixed(2)}`} />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  title: { color: theme.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  error: { color: theme.red, marginBottom: 12 },
  empty: { color: theme.subtext, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  rowBottom: { flexDirection: 'row', gap: 8 },
  symbol: { color: theme.text, fontSize: 18, fontWeight: '700' },
  pl: { fontSize: 14, fontWeight: '600' },
  statLabel: { color: theme.subtext, fontSize: 12 },
  statValue: { color: theme.text, fontSize: 14, fontWeight: '600', marginTop: 2 },
});
