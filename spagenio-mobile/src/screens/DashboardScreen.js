import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { theme } from '../theme';
import { ChartModal } from '../components/ChartModal';

// /proxy/stock/api/market/indicators → 시장 지표 (S&P, Nasdaq, VIX, Gold, BTC 등)
export function DashboardScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [chartVisible, setChartVisible] = useState(false);
  const [chartSymbol, setChartSymbol] = useState(null);
  const [chartLabel, setChartLabel] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.get('/proxy/stock/api/market/indicators');
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

  function openChart(it) {
    setChartSymbol(it.symbol);
    setChartLabel(it.label || it.name || '');
    setChartVisible(true);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator color={theme.accent} style={{ marginTop: 60 }} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>시장</Text>
          <Text style={styles.subtitle}>실시간 지표 (당겨서 새로고침)</Text>
        </View>

        {error && <Text style={styles.error}>⚠️ {error}</Text>}

        {items.length === 0 && !error && (
          <Text style={styles.empty}>표시할 데이터가 없습니다.</Text>
        )}

        <View style={styles.grid}>
          {items.map((it, idx) => {
            const change = Number(it.change_pct ?? 0);
            const isVix = it.type === 'vix' || it.symbol === '^VIX';
            // VIX는 상승=리스크↑(빨강), 일반은 상승=초록
            const up = change >= 0;
            const changeColor = isVix
              ? (up ? theme.red : theme.green)
              : (up ? theme.green : theme.red);
            return (
              <TouchableOpacity
                key={`${idx}-${it.symbol}`}
                style={styles.card}
                onPress={() => openChart(it)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cardLabel} numberOfLines={1}>{it.label || it.symbol}</Text>
                  <Text style={styles.cardSymbol} numberOfLines={1}>{it.symbol}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.cardPrice}>{formatPrice(it.price)}</Text>
                  <View style={[styles.changePill, { backgroundColor: changeColor + '22' }]}>
                    <Text style={[styles.changeText, { color: changeColor }]}>
                      {up ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <ChartModal
        visible={chartVisible}
        symbol={chartSymbol}
        label={chartLabel}
        onClose={() => setChartVisible(false)}
      />
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
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  title: { color: theme.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: theme.subtext, fontSize: 13, marginTop: 4 },
  error: { color: theme.red, marginHorizontal: 20, marginBottom: 12 },
  empty: { color: theme.subtext, textAlign: 'center', marginTop: 60 },
  grid: { paddingHorizontal: 12 },
  card: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLabel: { color: theme.text, fontSize: 16, fontWeight: '700' },
  cardSymbol: { color: theme.subtext, fontSize: 11, marginTop: 2, fontFamily: 'Menlo' },
  cardPrice: { color: theme.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  changePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  changeText: { fontSize: 12, fontWeight: '700' },
});
