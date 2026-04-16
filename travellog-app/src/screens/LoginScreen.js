import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useState } from 'react';
import { MapPin } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/fonts';

const API_BASE = 'https://travel.spagenio.com';

export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    if (mode === 'signup' && !nickname) {
      Alert.alert('입력 오류', '닉네임을 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const body = mode === 'login'
        ? { email, password }
        : { email, password, nickname };
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        onLogin(data.user);
      } else {
        Alert.alert('오류', data.error || data.detail || '로그인에 실패했습니다.');
      }
    } catch (e) {
      Alert.alert('오류', '서버 연결에 실패했습니다.');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={S.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={S.inner}
      >
        {/* Logo */}
        <View style={S.logoWrap}>
          <View style={S.logoBox}>
            <MapPin size={24} color="white" strokeWidth={1.6} />
          </View>
          <Text style={S.logoSub}>travel</Text>
          <Text style={S.logoMain}>Spagenio</Text>
          <Text style={S.tagline}>TRAVEL · SHARE · DISCOVER</Text>
        </View>

        {/* Form */}
        <View style={S.form}>
          {mode === 'signup' && (
            <View style={S.inputWrap}>
              <Text style={S.inputLabel}>Nickname</Text>
              <TextInput
                style={S.input}
                value={nickname}
                onChangeText={setNickname}
                placeholder="닉네임"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
            </View>
          )}
          <View style={S.inputWrap}>
            <Text style={S.inputLabel}>Email</Text>
            <TextInput
              style={S.input}
              value={email}
              onChangeText={setEmail}
              placeholder="example@email.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <View style={S.inputWrap}>
            <Text style={S.inputLabel}>Password</Text>
            <TextInput
              style={S.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />
          </View>

          <TouchableOpacity style={S.submitBtn} onPress={handleSubmit} disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color="white" />
              : <Text style={S.submitText}>{mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}</Text>}
          </TouchableOpacity>

          <View style={S.switchWrap}>
            <Text style={S.switchText}>
              {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
            </Text>
            <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
              <Text style={S.switchLink}>
                {mode === 'login' ? 'Create account' : 'Sign in'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logoWrap: { alignItems: 'center', marginBottom: 56 },
  logoBox: {
    width: 64, height: 64, backgroundColor: colors.primary,
    borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    marginBottom: 28,
  },
  logoSub: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 16, fontStyle: 'italic',
    color: colors.textTertiary, letterSpacing: 3,
    marginBottom: 2,
  },
  logoMain: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 44, color: colors.primary,
    letterSpacing: -1.5, lineHeight: 48,
  },
  tagline: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10, letterSpacing: 2.5,
    color: colors.textTertiary, marginTop: 14,
  },
  form: { width: '100%' },
  inputWrap: { marginBottom: 18 },
  inputLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10, letterSpacing: 2,
    color: colors.textTertiary, textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14, color: colors.textPrimary,
    paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16, borderRadius: 3,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 16, height: 52,
  },
  submitText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11, color: 'white',
    letterSpacing: 3,
  },
  switchWrap: {
    flexDirection: 'row', justifyContent: 'center',
    marginTop: 20,
  },
  switchText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12, color: colors.textTertiary,
  },
  switchLink: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12, color: colors.primary,
  },
});
