import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { theme } from '../theme';

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!username.trim() || !password) {
      Alert.alert('입력 오류', '아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      // 성공 시 AppNavigator 가 자동으로 Tab 으로 전환 (token 변경 감지)
    } catch (e) {
      Alert.alert('로그인 실패', e.message || '서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.body}>
          <Text style={styles.brand}>spagenio</Text>
          <Text style={styles.subtitle}>주식 자동매매 / 퀀트 분석</Text>

          <View style={styles.form}>
            <Text style={styles.label}>아이디</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="username"
              placeholderTextColor={theme.subtext}
            />

            <Text style={[styles.label, { marginTop: 16 }]}>비밀번호</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="••••••••"
              placeholderTextColor={theme.subtext}
            />

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.buttonText}>로그인</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  flex: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  brand: { color: theme.accent, fontSize: 36, fontWeight: '800', textAlign: 'center', letterSpacing: 1 },
  subtitle: { color: theme.subtext, textAlign: 'center', marginTop: 8, marginBottom: 40 },
  form: { backgroundColor: theme.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: theme.border },
  label: { color: theme.subtext, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: theme.bg,
    color: theme.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.border,
    fontSize: 16,
  },
  button: {
    marginTop: 24,
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '700' },
});
