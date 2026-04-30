import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { theme } from '../theme';

// POST /api/alpaca-user/v2/orders 본문:
// { symbol, qty, side, type, time_in_force, limit_price }
// 백엔드 화이트리스트 + 본문 검증 (qty 1..MAX_ORDER_QTY=10) 적용됨

export function TradeScreen() {
  const [symbol, setSymbol] = useState('');
  const [qty, setQty] = useState('1');
  const [side, setSide] = useState('buy');           // 'buy' | 'sell'
  const [orderType, setOrderType] = useState('market'); // 'market' | 'limit'
  const [limitPrice, setLimitPrice] = useState('');
  const [tif, setTif] = useState('day');             // 'day' | 'gtc'
  const [lookupPrice, setLookupPrice] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function lookupCurrentPrice() {
    const s = symbol.trim().toUpperCase();
    if (!s) return;
    setLookupLoading(true);
    setLookupPrice(null);
    try {
      const res = await api.get(`/proxy/stock/api/stock/price?symbol=${encodeURIComponent(s)}`);
      if (res?.price != null) setLookupPrice(Number(res.price));
    } catch (_) {
      // 무시
    } finally {
      setLookupLoading(false);
    }
  }

  function adjustQty(delta) {
    const n = Math.max(1, Math.min(10, (parseInt(qty) || 0) + delta));
    setQty(String(n));
  }

  function validate() {
    const s = symbol.trim().toUpperCase();
    if (!s || !/^[A-Z0-9.]{1,10}$/.test(s)) return '종목 심볼을 입력해주세요. (예: AAPL, 005930.KS)';
    const q = parseInt(qty);
    if (!Number.isFinite(q) || q < 1 || q > 10) return '수량은 1~10 사이여야 합니다. (서버 한도 MAX_ORDER_QTY=10)';
    if (orderType === 'limit') {
      const lp = parseFloat(limitPrice);
      if (!Number.isFinite(lp) || lp <= 0) return '지정가를 올바르게 입력해주세요.';
    }
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) { Alert.alert('입력 오류', err); return; }
    const s = symbol.trim().toUpperCase();
    const q = parseInt(qty);

    // 확인 다이얼로그
    const sideLabel = side === 'buy' ? '매수' : '매도';
    const typeLabel = orderType === 'market' ? '시장가' : `지정가 $${limitPrice}`;
    const estTotal = orderType === 'limit'
      ? (parseFloat(limitPrice) * q).toFixed(2)
      : (lookupPrice != null ? (lookupPrice * q).toFixed(2) : '?');

    Alert.alert(
      `${sideLabel} 주문 확인`,
      `${s}\n${q}주 · ${typeLabel}\n예상 총액: $${estTotal}`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: `${sideLabel} 제출`,
          style: side === 'sell' ? 'destructive' : 'default',
          onPress: () => submitOrder(s, q),
        },
      ]
    );
  }

  async function submitOrder(s, q) {
    setSubmitting(true);
    try {
      const body = {
        symbol: s,
        qty: q,
        side,
        type: orderType,
        time_in_force: tif,
      };
      if (orderType === 'limit') body.limit_price = parseFloat(limitPrice);

      const res = await api.post('/api/alpaca-user/v2/orders', body);
      const orderId = res?.id || res?.client_order_id || '?';
      Alert.alert(
        '✅ 주문 접수',
        `주문ID: ${orderId}\n상태: ${res?.status || '-'}\n\n포지션 탭에서 결과 확인 가능`,
        [{ text: '확인' }]
      );
      // 폼 초기화 (심볼 유지, 수량/가격만 리셋)
      setQty('1');
      setLimitPrice('');
      setLookupPrice(null);
    } catch (e) {
      Alert.alert('❌ 주문 실패', e.data?.error || e.message || '서버 오류');
    } finally {
      setSubmitting(false);
    }
  }

  const sideColor = side === 'buy' ? theme.green : theme.red;
  const sideLabel = side === 'buy' ? '매수' : '매도';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>거래</Text>
            <Text style={styles.subtitle}>Alpaca 주문 (시장가/지정가)</Text>
          </View>

          {/* 매수/매도 토글 */}
          <View style={styles.sideRow}>
            <TouchableOpacity
              style={[styles.sideBtn, side === 'buy' && { backgroundColor: theme.green + '22', borderColor: theme.green }]}
              onPress={() => setSide('buy')}
            >
              <Text style={[styles.sideText, { color: side === 'buy' ? theme.green : theme.subtext }]}>
                BUY 매수
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sideBtn, side === 'sell' && { backgroundColor: theme.red + '22', borderColor: theme.red }]}
              onPress={() => setSide('sell')}
            >
              <Text style={[styles.sideText, { color: side === 'sell' ? theme.red : theme.subtext }]}>
                SELL 매도
              </Text>
            </TouchableOpacity>
          </View>

          {/* 심볼 */}
          <Text style={styles.label}>종목 심볼</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={symbol}
              onChangeText={setSymbol}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="AAPL, TSLA, 005930.KS"
              placeholderTextColor={theme.muted}
              onSubmitEditing={lookupCurrentPrice}
            />
            <TouchableOpacity style={styles.lookupBtn} onPress={lookupCurrentPrice} disabled={lookupLoading}>
              {lookupLoading
                ? <ActivityIndicator color={theme.bg} size="small" />
                : <Text style={styles.lookupText}>현재가</Text>}
            </TouchableOpacity>
          </View>
          {lookupPrice != null && (
            <Text style={styles.priceHint}>
              💲 현재가: ${lookupPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </Text>
          )}

          {/* 주문 유형 */}
          <Text style={styles.label}>주문 유형</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeBtn, orderType === 'market' && styles.typeBtnActive]}
              onPress={() => setOrderType('market')}
            >
              <Text style={[styles.typeText, orderType === 'market' && { color: theme.bg, fontWeight: '700' }]}>
                시장가
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, orderType === 'limit' && styles.typeBtnActive]}
              onPress={() => setOrderType('limit')}
            >
              <Text style={[styles.typeText, orderType === 'limit' && { color: theme.bg, fontWeight: '700' }]}>
                지정가
              </Text>
            </TouchableOpacity>
          </View>

          {/* 지정가 입력 (Limit 일 때만) */}
          {orderType === 'limit' && (
            <>
              <Text style={styles.label}>지정가 ($)</Text>
              <TextInput
                style={styles.input}
                value={limitPrice}
                onChangeText={setLimitPrice}
                keyboardType="decimal-pad"
                placeholder="180.50"
                placeholderTextColor={theme.muted}
              />
            </>
          )}

          {/* 수량 */}
          <Text style={styles.label}>수량 (1~10주)</Text>
          <View style={styles.qtyRow}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustQty(-1)}>
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.input, { flex: 1, textAlign: 'center', marginHorizontal: 8 }]}
              value={qty}
              onChangeText={(v) => setQty(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={2}
            />
            <TouchableOpacity style={styles.qtyBtn} onPress={() => adjustQty(1)}>
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* 유효기간 */}
          <Text style={styles.label}>유효기간</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeBtn, tif === 'day' && styles.typeBtnActive]}
              onPress={() => setTif('day')}
            >
              <Text style={[styles.typeText, tif === 'day' && { color: theme.bg, fontWeight: '700' }]}>
                Day (당일)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, tif === 'gtc' && styles.typeBtnActive]}
              onPress={() => setTif('gtc')}
            >
              <Text style={[styles.typeText, tif === 'gtc' && { color: theme.bg, fontWeight: '700' }]}>
                GTC (취소시까지)
              </Text>
            </TouchableOpacity>
          </View>

          {/* 예상 총액 */}
          {(lookupPrice != null || (orderType === 'limit' && limitPrice)) && (
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>예상 총액</Text>
              <Text style={styles.totalValue}>
                ${(orderType === 'limit'
                    ? (parseFloat(limitPrice) || 0) * (parseInt(qty) || 0)
                    : (lookupPrice || 0) * (parseInt(qty) || 0)
                  ).toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </Text>
            </View>
          )}

          {/* 제출 */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: sideColor }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color={theme.bg} />
              : <Text style={styles.submitText}>{sideLabel} 주문 제출</Text>}
          </TouchableOpacity>

          {/* 안내 */}
          <Text style={styles.notice}>
            ⚠️ 1회 주문 한도: 10주 (서버 MAX_ORDER_QTY).{'\n'}
            현재 활성 Alpaca 계좌로 주문됩니다 (내정보 탭에서 확인).
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  title: { color: theme.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: theme.subtext, fontSize: 13, marginTop: 4 },
  sideRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 18 },
  sideBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.card, alignItems: 'center' },
  sideText: { fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  label: { color: theme.subtext, fontSize: 12, fontWeight: '600', marginHorizontal: 20, marginTop: 6, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
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
  lookupBtn: { backgroundColor: theme.accent, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', minWidth: 80, alignItems: 'center' },
  lookupText: { color: theme.bg, fontSize: 13, fontWeight: '700' },
  priceHint: { color: theme.green, fontSize: 13, marginHorizontal: 20, marginTop: 8 },
  typeRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, alignItems: 'center' },
  typeBtnActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  typeText: { color: theme.text, fontSize: 14, fontWeight: '600' },
  qtyRow: { flexDirection: 'row', paddingHorizontal: 16, alignItems: 'center' },
  qtyBtn: { width: 50, height: 50, borderRadius: 12, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { color: theme.text, fontSize: 22, fontWeight: '700' },
  totalCard: { backgroundColor: theme.card, marginHorizontal: 16, marginTop: 18, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: theme.subtext, fontSize: 13 },
  totalValue: { color: theme.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  submitBtn: { marginHorizontal: 16, marginTop: 22, paddingVertical: 18, borderRadius: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  submitText: { color: theme.bg, fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  notice: { color: theme.subtext, fontSize: 11, marginHorizontal: 20, marginTop: 18, lineHeight: 16, textAlign: 'center' },
});
