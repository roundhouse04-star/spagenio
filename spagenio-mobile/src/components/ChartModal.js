import { useEffect, useState } from 'react';
import {
  Modal, View, Text, ActivityIndicator, TouchableOpacity, Dimensions, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import { api } from '../api/client';
import { theme } from '../theme';

const PERIODS = [
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '1Y', value: '1y' },
];

export function ChartModal({ visible, symbol, label, onClose }) {
  const [period, setPeriod] = useState('3mo');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible || !symbol) return;
    setLoading(true);
    setData(null);
    setError(null);
    api.get(`/proxy/quant/api/quant/chart?symbol=${encodeURIComponent(symbol)}&period=${period}`)
      .then(d => {
        if (d?.error) setError(d.error);
        else setData(d);
      })
      .catch(e => setError(e.message || '차트 로드 실패'))
      .finally(() => setLoading(false));
  }, [visible, symbol, period]);

  // 데이터 derived
  const closes = data?.ohlc?.close || [];
  const dates = data?.dates || [];
  const lastPrice = closes.length ? closes[closes.length - 1] : 0;
  const firstPrice = closes.length ? closes[0] : 0;
  const change = lastPrice - firstPrice;
  const changePct = firstPrice ? (change / firstPrice) * 100 : 0;
  const isUp = change >= 0;
  const lineColor = isUp ? theme.green : theme.red;

  const screenW = Dimensions.get('window').width;

  // chart-kit 은 너무 많은 포인트 못 받음. ~100개로 다운샘플링.
  function downsample(arr, max = 100) {
    if (arr.length <= max) return arr;
    const step = arr.length / max;
    const out = [];
    for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
    return out;
  }
  const sampledCloses = downsample(closes, 80);
  const sampledDates = downsample(dates, 80);

  // X축 라벨 4개만 (start, 1/3, 2/3, end)
  function makeXLabels(arr) {
    if (arr.length === 0) return [];
    const idxs = [0, Math.floor(arr.length / 3), Math.floor(arr.length * 2 / 3), arr.length - 1];
    const out = arr.map(() => '');
    idxs.forEach(i => {
      const d = arr[i] || '';
      out[i] = d.slice(5); // MM-DD
    });
    return out;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* 드래그 인디케이터 (모달임을 시각화) */}
        <View style={styles.dragHandle} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.symbol}>{symbol}</Text>
            <Text style={styles.label} numberOfLines={1}>{label || ''}</Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          {/* 가격 + 변동 */}
          <View style={styles.priceSection}>
            <Text style={styles.priceMain}>
              {Number.isFinite(lastPrice) ? lastPrice.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '-'}
            </Text>
            <View style={styles.changeRow}>
              <Text style={[styles.changeText, { color: lineColor }]}>
                {isUp ? '▲' : '▼'} {Math.abs(change).toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.changeText, { color: lineColor, marginLeft: 8 }]}>
                ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
              </Text>
              <Text style={styles.periodHint}>  · {PERIODS.find(p => p.value === period)?.label} 변동</Text>
            </View>
          </View>

          {/* 기간 선택 */}
          <View style={styles.periodRow}>
            {PERIODS.map(p => (
              <TouchableOpacity
                key={p.value}
                style={[styles.periodBtn, period === p.value && styles.periodBtnActive]}
                onPress={() => setPeriod(p.value)}
              >
                <Text style={[styles.periodBtnText, period === p.value && { color: theme.bg, fontWeight: '700' }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 차트 */}
          {loading && <ActivityIndicator color={theme.accent} style={{ marginVertical: 60 }} size="large" />}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}
          {!loading && !error && sampledCloses.length > 1 && (
            <View style={styles.chartWrap}>
              <LineChart
                data={{
                  labels: makeXLabels(sampledDates),
                  datasets: [{ data: sampledCloses, color: () => lineColor, strokeWidth: 2 }],
                }}
                width={screenW - 8}
                height={260}
                bezier
                withDots={false}
                withInnerLines
                withOuterLines={false}
                withVerticalLabels
                withHorizontalLabels
                fromZero={false}
                chartConfig={{
                  backgroundColor: theme.bg,
                  backgroundGradientFrom: theme.bg,
                  backgroundGradientTo: theme.bg,
                  decimalPlaces: 2,
                  color: () => lineColor,
                  labelColor: () => theme.subtext,
                  propsForBackgroundLines: { stroke: theme.border, strokeDasharray: '4,4' },
                  propsForLabels: { fontSize: 10 },
                }}
                style={{ borderRadius: 12 }}
              />
            </View>
          )}

          {/* RSI / MACD 숫자만 (시각화는 너무 무거움) */}
          {!loading && !error && data && (
            <View style={styles.indicators}>
              <IndCell label="RSI(14)" value={lastValueOf(data?.rsi)} suffix="" />
              <IndCell label="MACD" value={lastValueOf(data?.macd?.macd)} suffix="" />
              <IndCell label="SMA20" value={lastValueOf(data?.sma?.sma20)} suffix="" />
              <IndCell label="SMA50" value={lastValueOf(data?.sma?.sma50)} suffix="" />
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function lastValueOf(arr) {
  if (!Array.isArray(arr)) return null;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null && Number.isFinite(arr[i])) return arr[i];
  }
  return null;
}

function IndCell({ label, value, suffix }) {
  return (
    <View style={styles.indCell}>
      <Text style={styles.indLabel}>{label}</Text>
      <Text style={styles.indValue}>
        {value != null ? Number(value).toFixed(2) + suffix : '-'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  dragHandle: { alignSelf: 'center', width: 40, height: 4, backgroundColor: theme.borderLight, borderRadius: 2, marginTop: 8, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  symbol: { color: theme.text, fontSize: 18, fontWeight: '700' },
  label: { color: theme.subtext, fontSize: 12, marginTop: 2 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  closeText: { color: theme.text, fontSize: 18, fontWeight: '600', lineHeight: 20 },
  priceSection: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 },
  priceMain: { color: theme.text, fontSize: 36, fontWeight: '800', letterSpacing: -0.5 },
  changeRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  changeText: { fontSize: 16, fontWeight: '700' },
  periodHint: { color: theme.subtext, fontSize: 12, marginLeft: 6 },
  periodRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, alignItems: 'center' },
  periodBtnActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  periodBtnText: { color: theme.text, fontSize: 13, fontWeight: '600' },
  chartWrap: { paddingHorizontal: 4, marginTop: 4 },
  errorBox: { paddingHorizontal: 20, paddingVertical: 40, alignItems: 'center' },
  errorText: { color: theme.red, fontSize: 14 },
  indicators: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20, paddingVertical: 20, marginTop: 8, backgroundColor: theme.card, marginHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.border },
  indCell: { alignItems: 'center', flex: 1 },
  indLabel: { color: theme.subtext, fontSize: 11, marginBottom: 4 },
  indValue: { color: theme.text, fontSize: 16, fontWeight: '700' },
});
