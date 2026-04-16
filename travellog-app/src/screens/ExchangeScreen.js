import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { colors } from '../theme/colors';

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'JPY', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'CNY', name: 'Chinese Yuan', flag: '🇨🇳' },
  { code: 'GBP', name: 'British Pound', flag: '🇬🇧' },
  { code: 'THB', name: 'Thai Baht', flag: '🇹🇭' },
  { code: 'VND', name: 'Vietnamese Dong', flag: '🇻🇳' },
  { code: 'TWD', name: 'Taiwan Dollar', flag: '🇹🇼' },
  { code: 'SGD', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'HKD', name: 'Hong Kong Dollar', flag: '🇭🇰' },
];

export default function ExchangeScreen() {
  const [amount, setAmount] = useState('10000');
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
    return `1 ${code} = ${Math.round(krwPer1).toLocaleString()} KRW`;
  };

  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <View>
          <Text style={S.title}>Exchange</Text>
          <Text style={S.subtitle}>CURRENCY RATES</Text>
        </View>
        <TouchableOpacity onPress={loadRates}>
          <RefreshCw size={18} color={colors.primary} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>

      <View style={S.inputWrap}>
        <Text style={S.inputLabel}>🇰🇷 KRW · SOUTH KOREAN WON</Text>
        <TextInput style={S.input} value={amount} onChangeText={setAmount}
          keyboardType="numeric" placeholder="Enter amount"
          placeholderTextColor={colors.textMuted} />
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          {CURRENCIES.map(cur => (
            <View key={cur.code} style={S.rateCard}>
              <View style={S.rateLeft}>
                <Text style={S.rateFlag}>{cur.flag}</Text>
                <View>
                  <Text style={S.rateName}>{cur.code}</Text>
                  <Text style={S.rateFullName}>{cur.name.toUpperCase()}</Text>
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
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  title: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 26, color: colors.primary, letterSpacing: -0.8, marginBottom: 2 },
  subtitle: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 2, color: colors.textTertiary, textTransform: 'uppercase' },
  inputWrap: { padding: 20, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  inputLabel: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 2, color: colors.textTertiary, marginBottom: 8 },
  input: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 32, color: colors.primary, letterSpacing: -0.8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.primary },
  rateCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  rateLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rateFlag: { fontSize: 28 },
  rateName: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 18, color: colors.primary, letterSpacing: -0.3 },
  rateFullName: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 1.5, color: colors.textTertiary, marginTop: 2 },
  rateRight: { alignItems: 'flex-end' },
  rateValue: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 18, color: colors.primary },
  rateInfo: { fontFamily: 'Inter_400Regular', fontSize: 10, color: colors.textTertiary, marginTop: 2 },
});
