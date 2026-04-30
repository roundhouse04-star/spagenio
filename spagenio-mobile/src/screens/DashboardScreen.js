import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { theme } from '../theme';

// 백엔드: GET /proxy/stock/api/market/indicators → stock_server.py 의 시장 지표
// (S&P 500, Dow, Nasdaq, VIX, Gold, BTC, USD Index 등 — 30분 캐시)
export function DashboardScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.get('/proxy/stock/api/market/indicators');
      // 응답 구조 추정: 배열 또는 { indicators: [...] }
      const list = Array.isArray(data) ? data : (data?.indicators || []);
      setItems(list);
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
        <Text style={styles.title}>시장 지표</Text>

        {error && <Text style={styles.error}>⚠️ {error}</Text>}

        {items.length === 0 && !error && (
          <Text style={styles.empty}>표시할 데이터가 없습니다. 당겨서 새로고침.</Text>
        )}

        {items.map((it, idx) => {
          const change = Number(it.change_pct ?? it.change ?? 0);
          const changeColor = change > 0 ? theme.green : change < 0 ? theme.red : theme.subtext;
          return (
            <View key={it.symbol || idx} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{it.label || it.symbol}</Text>
                <Text style={styles.symbol}>{it.symbol}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.price}>{formatPrice(it.price)}</Text>
                <Text style={[styles.change, { color: changeColor }]}>
                  {change > 0 ? '+' : ''}{change.toFixed(2)}%
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatPrice(p) {
  if (p == null) return '-';
  const n = Number(p);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  title: { color: theme.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  error: { color: theme.red, marginBottom: 12 },
  empty: { color: theme.subtext, textAlign: 'center', marginTop: 40 },
  card: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  label: { color: theme.text, fontSize: 16, fontWeight: '600' },
  symbol: { color: theme.subtext, fontSize: 12, marginTop: 2 },
  price: { color: theme.text, fontSize: 18, fontWeight: '700' },
  change: { fontSize: 14, marginTop: 2, fontWeight: '600' },
});
