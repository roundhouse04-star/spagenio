import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { theme } from '../theme';
import { ChartModal } from '../components/ChartModal';

// /proxy/quant/api/quant/stock-analysis?symbol=AAPL
// → { current_price, change_pct, consensus, fundamentals, technical }
export function StocksScreen() {
  const [symbol, setSymbol] = useState('AAPL');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chartVisible, setChartVisible] = useState(false);

  async function analyze() {
    const s = symbol.trim().toUpperCase();
    if (!s) return;
    setLoading(true);
    setData(null);
    try {
      const res = await api.get(`/proxy/quant/api/quant/stock-analysis?symbol=${encodeURIComponent(s)}`);
      if (res?.ok === false) throw new Error(res.error || '분석 실패');
      setData(res);
    } catch (e) {
      Alert.alert('조회 실패', e.message || '서버 응답 없음');
    } finally {
      setLoading(false);
    }
  }

  const isKr = (data?.symbol || '').endsWith('.KS') || (data?.symbol || '').endsWith('.KQ');
  const currency = isKr ? '₩' : '$';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>종목</Text>
          <Text style={styles.subtitle}>심볼 입력 → 종합 분석 (컨센서스 / 펀더멘털 / 기술적)</Text>
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
              onSubmitEditing={analyze}
            />
            <TouchableOpacity style={styles.button} onPress={analyze} disabled={loading}>
              {loading
                ? <ActivityIndicator color={theme.bg} />
                : <Text style={styles.buttonText}>분석</Text>}
            </TouchableOpacity>
          </View>

          {loading && <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} size="large" />}

          {data && !loading && (
            <>
              <PriceCard data={data} currency={currency} isKr={isKr} onChart={() => setChartVisible(true)} />
              <ConsensusCard data={data} currency={currency} isKr={isKr} />
              <FundamentalsCard data={data} />
              <TechnicalCard data={data} />
            </>
          )}
        </View>
      </ScrollView>

      <ChartModal
        visible={chartVisible}
        symbol={data?.symbol}
        label={data?.fundamentals?.name}
        onClose={() => setChartVisible(false)}
      />
    </SafeAreaView>
  );
}

// ── 가격 + 헤더 카드 ───────────────────────────────────────
function PriceCard({ data, currency, isKr, onChart }) {
  const f = data.fundamentals || {};
  const chg = Number(data.change_pct ?? 0);
  const up = chg >= 0;
  const color = up ? theme.green : theme.red;

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardSymbol}>{f.name || data.symbol}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Text style={styles.cardSubtle}>{data.symbol}</Text>
            {f.sector && <Text style={styles.cardSubtle}> · {f.sector}</Text>}
          </View>
        </View>
        <TouchableOpacity onPress={onChart} style={styles.chartBtn}>
          <Text style={styles.chartBtnText}>📈 차트</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.priceMain}>
        {currency}{fmtNum(data.current_price, isKr)}
      </Text>
      <View style={[styles.changePill, { backgroundColor: color + '22' }]}>
        <Text style={[styles.changeText, { color }]}>
          {up ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}%
        </Text>
      </View>

      <View style={styles.metaGrid}>
        <Meta label="52주 최고" value={f.fifty_two_week_high != null ? `${currency}${fmtNum(f.fifty_two_week_high, isKr)}` : '-'} />
        <Meta label="52주 최저" value={f.fifty_two_week_low != null ? `${currency}${fmtNum(f.fifty_two_week_low, isKr)}` : '-'} />
        <Meta label="거래량" value={f.volume ? (f.volume / 1e6).toFixed(1) + 'M' : '-'} />
        <Meta label="시가총액" value={fmtMarketCap(f.market_cap)} />
      </View>
    </View>
  );
}

// ── 애널리스트 컨센서스 카드 ──────────────────────────────
function ConsensusCard({ data, currency, isKr }) {
  const c = data.consensus || {};
  const recMap = {
    buy:           { label: '매수',     color: theme.green },
    'strong buy':  { label: '강력매수', color: theme.green },
    hold:          { label: '보유',     color: theme.yellow },
    sell:          { label: '매도',     color: theme.red },
    'strong sell': { label: '강력매도', color: theme.red },
  };
  const rec = recMap[c.recommendation?.toLowerCase()] || { label: c.recommendation || '-', color: theme.subtext };
  const up = (c.upside_pct ?? 0) >= 0;
  const upsideColor = up ? theme.green : theme.red;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>👥 애널리스트 컨센서스</Text>

      <View style={styles.consensusRow}>
        <View>
          <Text style={styles.consensusLabel}>추천</Text>
          <View style={[styles.recBadge, { backgroundColor: rec.color + '22' }]}>
            <Text style={[styles.recText, { color: rec.color }]}>{rec.label}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.consensusLabel}>애널리스트</Text>
          <Text style={styles.consensusValue}>{c.analyst_count ? `${c.analyst_count}명` : '-'}</Text>
        </View>
      </View>

      <View style={styles.targetRow}>
        <Target label="평균 목표가" value={c.target_mean} currency={currency} isKr={isKr} />
        <Target label="최고" value={c.target_high} currency={currency} isKr={isKr} />
        <Target label="최저" value={c.target_low} currency={currency} isKr={isKr} />
      </View>

      {c.upside_pct != null && (
        <View style={[styles.upsideBox, { backgroundColor: upsideColor + '15', borderColor: upsideColor + '44' }]}>
          <Text style={[styles.upsideText, { color: upsideColor }]}>
            현재가 대비 {up ? '+' : ''}{Number(c.upside_pct).toFixed(2)}% {up ? '↑ 상승여력' : '↓ 하락여지'}
          </Text>
        </View>
      )}
    </View>
  );
}

function Target({ label, value, currency, isKr }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.consensusLabel}>{label}</Text>
      <Text style={styles.consensusValue}>{value != null ? `${currency}${fmtNum(value, isKr)}` : '-'}</Text>
    </View>
  );
}

// ── 펀더멘털 카드 ─────────────────────────────────────────
function FundamentalsCard({ data }) {
  const f = data.fundamentals || {};
  const items = [
    { label: 'PER',       value: f.per != null ? f.per + '배' : '-' },
    { label: 'PBR',       value: f.pbr != null ? f.pbr + '배' : '-' },
    {
      label: 'ROE',
      value: f.roe != null ? f.roe + '%' : '-',
      color: f.roe != null ? (f.roe > 15 ? theme.green : f.roe > 0 ? theme.text : theme.red) : null,
    },
    {
      label: '부채비율',
      value: f.debt_to_equity != null ? f.debt_to_equity + '%' : '-',
      color: f.debt_to_equity != null ? (f.debt_to_equity < 100 ? theme.green : f.debt_to_equity < 200 ? theme.yellow : theme.red) : null,
    },
    {
      label: '매출성장',
      value: f.revenue_growth != null ? f.revenue_growth + '%' : '-',
      color: f.revenue_growth != null ? (f.revenue_growth > 10 ? theme.green : f.revenue_growth > 0 ? theme.text : theme.red) : null,
    },
    { label: '업종', value: f.industry || '-' },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>📊 펀더멘털</Text>
      <View style={styles.fundGrid}>
        {items.map((it, i) => (
          <View key={i} style={styles.fundCell}>
            <Text style={styles.fundLabel}>{it.label}</Text>
            <Text style={[styles.fundValue, it.color && { color: it.color }]} numberOfLines={1}>
              {it.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── 기술적 분석 카드 ──────────────────────────────────────
function TechnicalCard({ data }) {
  const t = data.technical || {};
  const sigMap = {
    buy:        { label: '매수',     color: theme.green },
    weak_buy:   { label: '약한매수', color: theme.green },
    hold:       { label: '중립',     color: theme.yellow },
    weak_sell:  { label: '약한매도', color: theme.red },
    sell:       { label: '매도',     color: theme.red },
  };
  const sig = sigMap[t.signal] || { label: t.signal || '-', color: theme.subtext };
  const details = t.details || {};
  const entries = Object.entries(details);

  return (
    <View style={styles.card}>
      <View style={styles.techHead}>
        <Text style={styles.sectionTitle}>📈 기술적 분석</Text>
        <View style={[styles.recBadge, { backgroundColor: sig.color + '22' }]}>
          <Text style={[styles.recText, { color: sig.color }]}>{sig.label}</Text>
        </View>
      </View>
      {t.score != null && (
        <Text style={styles.techScore}>종합점수: {Number(t.score).toFixed(2)}</Text>
      )}
      {entries.length === 0 ? (
        <Text style={styles.empty}>기술적 데이터 없음</Text>
      ) : (
        <View style={{ marginTop: 8 }}>
          {entries.map(([key, val]) => {
            const subSig = sigMap[val?.signal] || { color: theme.subtext };
            return (
              <View key={key} style={styles.techRow}>
                <Text style={styles.techKey}>{key}</Text>
                <Text style={[styles.techReason, { color: subSig.color }]} numberOfLines={2}>
                  {val?.reason || val?.signal || '-'}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── 헬퍼 ───────────────────────────────────────────────────
function Meta({ label, value }) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function fmtNum(v, isKr) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return isKr ? Math.round(n).toLocaleString() : n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function fmtMarketCap(mc) {
  if (!mc) return '-';
  const n = Number(mc);
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(1) + 'M';
  return n.toString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  title: { color: theme.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: theme.subtext, fontSize: 13, marginTop: 4 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: {
    flex: 1, backgroundColor: theme.card, color: theme.text,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: theme.border, fontSize: 15, fontFamily: 'Menlo',
  },
  button: { backgroundColor: theme.accent, borderRadius: 12, paddingHorizontal: 22, justifyContent: 'center', minWidth: 80 },
  buttonText: { color: theme.bg, fontSize: 15, fontWeight: '700' },

  card: {
    backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: theme.border,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardSymbol: { color: theme.text, fontSize: 18, fontWeight: '700' },
  cardSubtle: { color: theme.subtext, fontSize: 11 },
  chartBtn: { backgroundColor: theme.accent + '22', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: theme.accent + '55' },
  chartBtnText: { color: theme.accent, fontSize: 12, fontWeight: '700' },
  priceMain: { color: theme.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5, marginVertical: 4 },
  changePill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 4 },
  changeText: { fontSize: 13, fontWeight: '700' },

  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, gap: 8 },
  metaCell: { width: '48%', backgroundColor: theme.bgElevated, padding: 10, borderRadius: 8 },
  metaLabel: { color: theme.subtext, fontSize: 11, marginBottom: 4 },
  metaValue: { color: theme.text, fontSize: 13, fontWeight: '600' },

  sectionTitle: { color: theme.text, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  consensusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  consensusLabel: { color: theme.subtext, fontSize: 11, marginBottom: 4 },
  consensusValue: { color: theme.text, fontSize: 14, fontWeight: '700' },
  recBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  recText: { fontSize: 13, fontWeight: '700' },
  targetRow: { flexDirection: 'row', backgroundColor: theme.bgElevated, borderRadius: 10, paddingVertical: 12, marginBottom: 8 },
  upsideBox: { borderRadius: 10, padding: 10, borderWidth: 1, alignItems: 'center', marginTop: 6 },
  upsideText: { fontSize: 13, fontWeight: '700' },

  fundGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fundCell: { width: '48%', backgroundColor: theme.bgElevated, padding: 12, borderRadius: 8 },
  fundLabel: { color: theme.subtext, fontSize: 11, marginBottom: 4 },
  fundValue: { color: theme.text, fontSize: 15, fontWeight: '700' },

  techHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  techScore: { color: theme.subtext, fontSize: 12, marginBottom: 4 },
  techRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  techKey: { color: theme.subtext, fontSize: 12, fontWeight: '700', width: 56 },
  techReason: { flex: 1, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  empty: { color: theme.subtext, padding: 12, textAlign: 'center' },
});
