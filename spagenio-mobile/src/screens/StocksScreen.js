import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { theme } from '../theme';
import { ChartModal } from '../components/ChartModal';

// /proxy/stock/api/stock/price?symbol=AAPL → 단일 종목 시세
export function StocksScreen() {
  const [symbol, setSymbol] = useState('AAPL');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chartVisible, setChartVisible] = useState(false);

  async function search() {
    const s = symbol.trim().toUpperCase();
    if (!s) return;
    setLoading(true);
    try {
      const res = await api.get(`/proxy/stock/api/stock/price?symbol=${encodeURIComponent(s)}`);
      setData(res);
    } catch (e) {
      Alert.alert('조회 실패', e.message || '서버 응답 없음');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const change = Number(data?.change_pct ?? 0);
  const up = change >= 0;
  const color = up ? theme.green : (change < 0 ? theme.red : theme.subtext);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>종목</Text>
        <Text style={styles.subtitle}>심볼 입력 후 조회 → 카드 탭하면 차트</Text>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            value={symbol}
            onChangeText={setSymbol}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="AAPL, TSLA, 005930.KS …"
            placeholderTextColor={theme.muted}
            onSubmitEditing={search}
          />
          <TouchableOpacity style={styles.button} onPress={search} disabled={loading}>
            {loading
              ? <ActivityIndicator color={theme.bg} />
              : <Text style={styles.buttonText}>조회</Text>}
          </TouchableOpacity>
        </View>

        {data && (
          <TouchableOpacity
            style={styles.card}
            onPress={() => setChartVisible(true)}
            activeOpacity={0.85}
          >
            <View style={styles.cardHead}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.symbolLabel} numberOfLines={1}>{data.name || data.symbol}</Text>
                <Text style={styles.symbolMono}>{data.symbol}</Text>
              </View>
              <Text style={styles.tapHint}>📈 차트 보기</Text>
            </View>

            <Text style={styles.priceMain}>
              {Number(data.price ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
              <Text style={styles.currency}> {data.currency || ''}</Text>
            </Text>

            <View style={[styles.changePill, { backgroundColor: color + '22' }]}>
              <Text style={[styles.changeText, { color }]}>
                {up ? '▲' : '▼'} {Math.abs(Number(data.change ?? 0)).toFixed(2)} ({Math.abs(change).toFixed(2)}%)
              </Text>
            </View>

            {data.volume != null && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>거래량</Text>
                <Text style={styles.metaValue}>{Number(data.volume).toLocaleString('en-US')}</Text>
              </View>
            )}
            {data.high != null && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>고가 / 저가</Text>
                <Text style={styles.metaValue}>
                  {Number(data.high).toFixed(2)} / {Number(data.low ?? 0).toFixed(2)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      <ChartModal
        visible={chartVisible}
        symbol={data?.symbol}
        label={data?.name}
        onClose={() => setChartVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  title: { color: theme.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: theme.subtext, fontSize: 13, marginTop: 4 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: {
    flex: 1,
    backgroundColor: theme.card,
    color: theme.text,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.border,
    fontSize: 15,
    fontFamily: 'Menlo',
  },
  button: {
    backgroundColor: theme.accent,
    borderRadius: 12,
    paddingHorizontal: 22,
    justifyContent: 'center',
    minWidth: 80,
  },
  buttonText: { color: theme.bg, fontSize: 15, fontWeight: '700' },
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  symbolLabel: { color: theme.text, fontSize: 18, fontWeight: '700' },
  symbolMono: { color: theme.subtext, fontSize: 11, fontFamily: 'Menlo', marginTop: 2 },
  tapHint: { color: theme.accent, fontSize: 12, fontWeight: '600' },
  priceMain: { color: theme.text, fontSize: 36, fontWeight: '800', letterSpacing: -0.5, marginVertical: 4 },
  currency: { fontSize: 16, fontWeight: '600', color: theme.subtext },
  changePill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 4 },
  changeText: { fontSize: 14, fontWeight: '700' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
  metaLabel: { color: theme.subtext, fontSize: 13 },
  metaValue: { color: theme.text, fontSize: 13, fontWeight: '600', fontFamily: 'Menlo' },
});
