import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { theme } from '../theme';

// 백엔드: GET /proxy/stock/api/stock/price?symbol=AAPL → 단일 종목 시세
export function StocksScreen() {
  const [symbol, setSymbol] = useState('AAPL');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={{ padding: 16 }}>
        <Text style={styles.title}>종목 검색</Text>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            value={symbol}
            onChangeText={setSymbol}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="AAPL"
            placeholderTextColor={theme.subtext}
            onSubmitEditing={search}
          />
          <TouchableOpacity style={styles.button} onPress={search} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.buttonText}>조회</Text>}
          </TouchableOpacity>
        </View>

        {data && (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>{data.name || data.symbol}</Text>
              <Text style={styles.symbol}>{data.symbol}</Text>
            </View>
            <Text style={styles.price}>
              {Number(data.price ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} {data.currency || ''}
            </Text>
            <Text style={[
              styles.change,
              { color: Number(data.change_pct ?? 0) > 0 ? theme.green : Number(data.change_pct ?? 0) < 0 ? theme.red : theme.subtext }
            ]}>
              {Number(data.change ?? 0).toFixed(2)} ({Number(data.change_pct ?? 0).toFixed(2)}%)
            </Text>
            {data.volume != null && (
              <Text style={styles.meta}>거래량: {Number(data.volume).toLocaleString('en-US')}</Text>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  title: { color: theme.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: {
    flex: 1,
    backgroundColor: theme.card,
    color: theme.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.border,
    fontSize: 16,
  },
  button: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '700' },
  card: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  label: { color: theme.text, fontSize: 18, fontWeight: '600', flex: 1 },
  symbol: { color: theme.subtext, fontSize: 14 },
  price: { color: theme.text, fontSize: 32, fontWeight: '800' },
  change: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  meta: { color: theme.subtext, fontSize: 13, marginTop: 12 },
});
