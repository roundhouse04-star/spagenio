import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { theme } from '../theme';
import { ChartModal } from '../components/ChartModal';

// /api/alpaca-user/v2/positions → 보유 포지션 (서버 화이트리스트 라우트)
export function PositionsScreen() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [noAccount, setNoAccount] = useState(false);

  const [chartVisible, setChartVisible] = useState(false);
  const [chartSymbol, setChartSymbol] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setNoAccount(false);
      const data = await api.get('/api/alpaca-user/v2/positions');
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

  // 합계 계산
  const totalValue = positions.reduce((s, p) => s + Number(p.market_value || 0), 0);
  const totalPL = positions.reduce((s, p) => s + Number(p.unrealized_pl || 0), 0);
  const totalPLPct = totalValue ? (totalPL / (totalValue - totalPL)) * 100 : 0;
  const totalUp = totalPL >= 0;
  const totalColor = totalUp ? theme.green : theme.red;

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
          <Text style={styles.title}>포지션</Text>
          <Text style={styles.subtitle}>{positions.length} 보유 종목 · 탭하면 차트</Text>
        </View>

        {error && <Text style={styles.error}>⚠️ {error}</Text>}

        {noAccount && (
          <View style={styles.notice}>
            <Text style={styles.noticeIcon}>🔑</Text>
            <Text style={styles.noticeTitle}>Alpaca 계좌 미등록</Text>
            <Text style={styles.noticeText}>웹 대시보드에서 Alpaca API 키를 먼저 등록해주세요.</Text>
          </View>
        )}

        {!noAccount && positions.length === 0 && !error && (
          <Text style={styles.empty}>보유 포지션이 없습니다.</Text>
        )}

        {/* 합계 카드 */}
        {positions.length > 0 && (
          <View style={[styles.summary, { borderColor: totalColor + '44' }]}>
            <View>
              <Text style={styles.summaryLabel}>총 평가금액</Text>
              <Text style={styles.summaryValue}>${totalValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.summaryLabel}>총 평가손익</Text>
              <Text style={[styles.summaryValue, { color: totalColor }]}>
                {totalUp ? '+' : ''}${totalPL.toFixed(2)} ({totalPLPct.toFixed(2)}%)
              </Text>
            </View>
          </View>
        )}

        {/* 포지션 카드 */}
        <View style={{ paddingHorizontal: 12 }}>
          {positions.map((p, idx) => {
            const qty = Number(p.qty ?? 0);
            const avg = Number(p.avg_entry_price ?? 0);
            const cur = Number(p.current_price ?? 0);
            const pl = Number(p.unrealized_pl ?? (cur - avg) * qty);
            const plPct = Number(p.unrealized_plpc ?? (avg ? ((cur - avg) / avg) * 100 : 0));
            const up = pl >= 0;
            const plColor = up ? theme.green : theme.red;
            return (
              <TouchableOpacity
                key={`${idx}-${p.symbol}`}
                style={styles.card}
                onPress={() => { setChartSymbol(p.symbol); setChartVisible(true); }}
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardSymbol}>{p.symbol}</Text>
                  <View style={[styles.plPill, { backgroundColor: plColor + '22' }]}>
                    <Text style={[styles.plText, { color: plColor }]}>
                      {up ? '▲' : '▼'} {plPct.toFixed(2)}%
                    </Text>
                  </View>
                </View>
                <Text style={[styles.plMain, { color: plColor }]}>
                  {up ? '+' : ''}${pl.toFixed(2)}
                </Text>
                <View style={styles.cardBottom}>
                  <Stat label="수량" value={qty.toString()} />
                  <Stat label="평단가" value={`$${avg.toFixed(2)}`} />
                  <Stat label="현재가" value={`$${cur.toFixed(2)}`} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <ChartModal
        visible={chartVisible}
        symbol={chartSymbol}
        label={chartSymbol}
        onClose={() => setChartVisible(false)}
      />
    </SafeAreaView>
  );
}

function Stat({ label, value }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={statStyles.label}>{label}</Text>
      <Text style={statStyles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  title: { color: theme.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: theme.subtext, fontSize: 13, marginTop: 4 },
  error: { color: theme.red, marginHorizontal: 20, marginBottom: 12 },
  empty: { color: theme.subtext, textAlign: 'center', marginTop: 60 },
  notice: { backgroundColor: theme.card, marginHorizontal: 16, padding: 24, borderRadius: 14, borderWidth: 1, borderColor: theme.borderLight, alignItems: 'center' },
  noticeIcon: { fontSize: 32, marginBottom: 8 },
  noticeTitle: { color: theme.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  noticeText: { color: theme.subtext, fontSize: 13, textAlign: 'center' },
  summary: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: theme.card, marginHorizontal: 16, marginBottom: 12,
    padding: 16, borderRadius: 14, borderWidth: 1,
  },
  summaryLabel: { color: theme.subtext, fontSize: 11 },
  summaryValue: { color: theme.text, fontSize: 18, fontWeight: '800', marginTop: 4 },
  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardSymbol: { color: theme.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  plPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  plText: { fontSize: 12, fontWeight: '700' },
  plMain: { fontSize: 22, fontWeight: '800', marginVertical: 8, letterSpacing: -0.5 },
  cardBottom: { flexDirection: 'row', gap: 8, marginTop: 4, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
});

const statStyles = StyleSheet.create({
  label: { color: theme.subtext, fontSize: 11 },
  value: { color: theme.text, fontSize: 14, fontWeight: '600', marginTop: 2 },
});
