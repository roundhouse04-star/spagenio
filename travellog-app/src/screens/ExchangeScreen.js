import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';

const CURRENCIES = [
  { code: 'USD', name: '미국 달러', flag: '🇺🇸' },
  { code: 'JPY', name: '일본 엔', flag: '🇯🇵' },
  { code: 'EUR', name: '유로', flag: '🇪🇺' },
  { code: 'CNY', name: '중국 위안', flag: '🇨🇳' },
  { code: 'GBP', name: '영국 파운드', flag: '🇬🇧' },
  { code: 'THB', name: '태국 바트', flag: '🇹🇭' },
  { code: 'VND', name: '베트남 동', flag: '🇻🇳' },
  { code: 'TWD', name: '대만 달러', flag: '🇹🇼' },
  { code: 'SGD', name: '싱가포르 달러', flag: '🇸🇬' },
  { code: 'AUD', name: '호주 달러', flag: '🇦🇺' },
  { code: 'HKD', name: '홍콩 달러', flag: '🇭🇰' },
];

export default function ExchangeScreen() {
  const [amount, setAmount] = useState('10000');
  const [from, setFrom] = useState('KRW');
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadRates(); }, []);

  const loadRates = async () => {
    setLoading(true);
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/KRW');
      if (res.ok) setRates(await res.json());
    } catch (e) {}
    setLoading(false);
  };

  const convert = (code) => {
    if (!rates || !amount) return '—';
    const rate = rates.rates[code];
    if (!rate) return '—';
    const val = parseFloat(amount) * rate;
    if (code === 'JPY' || code === 'VND' || code === 'KRW') return Math.round(val).toLocaleString();
    return val.toFixed(2);
  };

  const getRate = (code) => {
    if (!rates) return '';
    const rate = rates.rates[code];
    if (!rate) return '';
    const krwPer1 = (1 / rate).toFixed(2);
    return `1 ${code} = ${Math.round(krwPer1).toLocaleString()}원`;
  };

  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <Text style={S.title}>💱 환율 계산</Text>
        <TouchableOpacity onPress={loadRates}>
          <Text style={S.refresh}>🔄</Text>
        </TouchableOpacity>
      </View>

      <View style={S.inputWrap}>
        <Text style={S.inputLabel}>🇰🇷 원화 (KRW)</Text>
        <TextInput style={S.input} value={amount} onChangeText={setAmount}
          keyboardType="numeric" placeholder="금액 입력"
          placeholderTextColor="#9ca3af" />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FF5A5F" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={S.list} showsVerticalScrollIndicator={false}>
          {CURRENCIES.map(cur => (
            <View key={cur.code} style={S.rateCard}>
              <View style={S.rateLeft}>
                <Text style={S.rateFlag}>{cur.flag}</Text>
                <View>
                  <Text style={S.rateName}>{cur.code}</Text>
                  <Text style={S.rateFullName}>{cur.name}</Text>
                </View>
              </View>
              <View style={S.rateRight}>
                <Text style={S.rateValue}>{convert(cur.code)}</Text>
                <Text style={S.rateInfo}>{getRate(cur.code)}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  header: { backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 20, fontWeight: '900', color: '#1a1a2e' },
  refresh: { fontSize: 22 },
  inputWrap: { backgroundColor: 'white', padding: 16, margin: 16, borderRadius: 16 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#6b7280', marginBottom: 8 },
  input: { fontSize: 28, fontWeight: '800', color: '#1a1a2e', borderBottomWidth: 2, borderBottomColor: '#FF5A5F', paddingBottom: 8 },
  list: { padding: 16, gap: 8, paddingBottom: 30 },
  rateCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', borderRadius: 14, padding: 16 },
  rateLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rateFlag: { fontSize: 28 },
  rateName: { fontSize: 15, fontWeight: '800', color: '#1a1a2e' },
  rateFullName: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  rateRight: { alignItems: 'flex-end' },
  rateValue: { fontSize: 17, fontWeight: '800', color: '#FF5A5F' },
  rateInfo: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
});
