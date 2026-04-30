import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { theme } from '../theme';

export function AccountScreen() {
  const { user, logout } = useAuth();

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
      <View style={{ padding: 16 }}>
        <Text style={styles.title}>내 정보</Text>

        <View style={styles.card}>
          <Row label="아이디" value={user?.username || '-'} />
          <Row label="권한" value={user?.is_admin ? '관리자' : '일반회원'} />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  title: { color: theme.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: theme.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: theme.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  rowLabel: { color: theme.subtext, fontSize: 14 },
  rowValue: { color: theme.text, fontSize: 14, fontWeight: '600' },
  logoutBtn: { marginTop: 24, backgroundColor: theme.card, borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.red },
  logoutText: { color: theme.red, fontSize: 16, fontWeight: '700' },
});
