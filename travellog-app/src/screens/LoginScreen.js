import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';

const API_BASE = 'https://travel.spagenio.com';

export default function LoginScreen({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = async () => {
    if (!form.email || !form.password) { setError('이메일과 비밀번호를 입력해주세요.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        onLogin(data.user);
      } else {
        setError(data.detail || data.error || '로그인 실패');
      }
    } catch (e) {
      setError('서버 연결 오류');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={S.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={S.box}>
        {/* 로고 */}
        <Text style={S.logo}>✈ Travellog</Text>
        <Text style={S.subtitle}>여행 이야기를 공유하세요</Text>

        {error ? <Text style={S.error}>{error}</Text> : null}

        <TextInput style={S.input} placeholder="이메일" placeholderTextColor="#9ca3af"
          value={form.email} onChangeText={t => setForm(p => ({ ...p, email: t }))}
          keyboardType="email-address" autoCapitalize="none" />

        <TextInput style={S.input} placeholder="비밀번호" placeholderTextColor="#9ca3af"
          value={form.password} onChangeText={t => setForm(p => ({ ...p, password: t }))}
          secureTextEntry />

        <TouchableOpacity style={S.btn} onPress={login} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={S.btnText}>로그인</Text>}
        </TouchableOpacity>

        <Text style={S.hint}>아직 계정이 없으신가요? travel.spagenio.com 에서 가입하세요</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8', justifyContent: 'center', alignItems: 'center' },
  box: { width: '88%', backgroundColor: 'white', borderRadius: 24, padding: 32, shadowColor: '#4f46e5', shadowOpacity: 0.1, shadowRadius: 20, elevation: 5 },
  logo: { fontSize: 30, fontWeight: '900', color: '#4f46e5', textAlign: 'center', marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginBottom: 28 },
  error: { backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontSize: 14, color: '#1a1a2e', backgroundColor: '#fafafa', marginBottom: 12 },
  btn: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 4 },
  btnText: { color: 'white', fontSize: 15, fontWeight: '700' },
  hint: { marginTop: 16, fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 18 },
});
