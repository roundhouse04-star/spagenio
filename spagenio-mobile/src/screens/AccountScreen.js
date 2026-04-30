import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { theme } from '../theme';

const ACCOUNT_TYPE_LABEL = { 0: '미지정', 1: '수동 전용', 2: '자동매매 전용' };

export function AccountScreen() {
  const { user, logout } = useAuth();
  const [brokers, setBrokers] = useState([]);
  const [registered, setRegistered] = useState(false);
  const [balance, setBalance] = useState(null); // active account 잔고
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      // 등록된 broker 계좌 목록
      const bk = await api.get('/api/user/broker-keys');
      setRegistered(!!bk?.registered);
      setBrokers(Array.isArray(bk?.accounts) ? bk.accounts : []);

      // 활성 Alpaca 계좌 잔고 (등록돼있을 때만)
      if (bk?.registered) {
        try {
          const acc = await api.get('/api/alpaca-user/v2/account');
          if (acc && !acc.no_account) setBalance(acc);
          else setBalance(null);
        } catch (e) {
          setBalance(null);
        }
      } else {
        setBalance(null);
      }
    } catch (e) {
      // 무시 — 화면 빈 상태로 유지
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  function confirmLogout() {
    Alert.alert(
      '로그아웃',
      '로그아웃 하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { text: '로그아웃', style: 'destructive', onPress: () => logout() },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      >
        <Text style={styles.title}>내 정보</Text>

        {/* 사용자 정보 */}
        <View style={styles.card}>
          <Row label="아이디" value={user?.username || '-'} />
          <Row label="권한" value={user?.is_admin ? '관리자' : '일반회원'} last />
        </View>

        {/* Alpaca 활성 계좌 잔고 */}
        <Text style={styles.sectionTitle}>Alpaca 활성 계좌</Text>
        {loading ? (
          <ActivityIndicator color={theme.accent} style={{ marginVertical: 16 }} />
        ) : !registered ? (
          <View style={styles.card}>
            <Text style={styles.empty}>
              등록된 Alpaca 계좌가 없습니다.{'\n'}웹 대시보드에서 계좌를 등록해주세요.
            </Text>
          </View>
        ) : balance ? (
          <View style={styles.card}>
            <Row label="현금" value={fmtMoney(balance.cash)} />
            <Row label="총 자산" value={fmtMoney(balance.equity || balance.portfolio_value)} />
            <Row label="매수 가능" value={fmtMoney(balance.buying_power)} />
            <Row label="상태" value={String(balance.status || '-')} last />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.empty}>잔고 정보를 가져올 수 없습니다.{'\n'}계좌 키가 만료됐거나 인증 오류일 수 있습니다.</Text>
          </View>
        )}

        {/* 등록된 broker 계좌 목록 */}
        {brokers.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>등록된 계좌 ({brokers.length})</Text>
            {brokers.map(b => (
              <View key={b.id} style={styles.card}>
                <View style={styles.rowTop}>
                  <Text style={styles.brokerName}>{b.account_name}</Text>
                  <View style={styles.badges}>
                    {b.is_active && <Badge text="활성" color={theme.green} />}
                    <Badge text={b.alpaca_paper ? 'Paper' : 'Live'} color={b.alpaca_paper ? theme.yellow : theme.red} />
                  </View>
                </View>
                <Row label="유형" value={ACCOUNT_TYPE_LABEL[b.account_type] || '-'} />
                <Row label="API Key" value={b.key_preview || '-'} mono last />
              </View>
            ))}
          </>
        )}

        {/* 로그아웃 */}
        <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, last, mono }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && { fontFamily: 'Menlo' }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Badge({ text, color }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

function fmtMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  title: { color: theme.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  sectionTitle: { color: theme.subtext, fontSize: 13, fontWeight: '600', marginTop: 20, marginBottom: 8, marginLeft: 4 },
  card: {
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 },
  rowLabel: { color: theme.subtext, fontSize: 13 },
  rowValue: { color: theme.text, fontSize: 14, fontWeight: '600', maxWidth: '60%' },
  brokerName: { color: theme.text, fontSize: 16, fontWeight: '700' },
  badges: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  empty: { color: theme.subtext, padding: 14, textAlign: 'center', lineHeight: 20 },
  logoutBtn: { marginTop: 24, backgroundColor: theme.card, borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.red },
  logoutText: { color: theme.red, fontSize: 16, fontWeight: '700' },
});
