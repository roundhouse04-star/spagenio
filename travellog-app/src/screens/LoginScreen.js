import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Dimensions } from 'react-native';
import Svg, { Rect, Line, Circle, Path } from 'react-native-svg';

const API_BASE = 'https://travel.spagenio.com';
const { width, height } = Dimensions.get('window');

function LogoSvg({ size = 64 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Rect width="96" height="96" rx="24" fill="rgba(255,255,255,0.2)"/>
      <Line x1="0" y1="34" x2="96" y2="34" stroke="white" strokeWidth="1.2" opacity="0.3"/>
      <Line x1="0" y1="62" x2="96" y2="62" stroke="white" strokeWidth="1.2" opacity="0.3"/>
      <Line x1="34" y1="0" x2="34" y2="96" stroke="white" strokeWidth="1.2" opacity="0.3"/>
      <Line x1="62" y1="0" x2="62" y2="96" stroke="white" strokeWidth="1.2" opacity="0.3"/>
      <Circle cx="48" cy="38" r="22" fill="white"/>
      <Circle cx="48" cy="38" r="10" fill="#FF5A5F"/>
      <Path d="M36 58 Q48 80 60 58" fill="white"/>
    </Svg>
  );
}

function MiniCard({ icon, label }) {
  return (
    <View style={S.miniCard}>
      <Text style={S.miniIcon}>{icon}</Text>
      <Text style={S.miniLabel}>{label}</Text>
    </View>
  );
}

export default function LoginScreen({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState('');

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
    <KeyboardAvoidingView style={S.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled" bounces={false}>

        {/* 상단: 코랄 패널 */}
        <View style={S.coral}>
          <LogoSvg size={68} />

          <View style={S.copyWrap}>
            <Text style={S.headline}>당신의 순간을{'\n'}세상과 나눠요</Text>
            <Text style={S.sub}>사진 한 장, 짧은 글 하나로{'\n'}새로운 연결이 시작돼요</Text>
          </View>

          {/* 미니 카드 */}
          <View style={S.miniRow}>
            <MiniCard icon="📍" label="132개 여행지" />
            <MiniCard icon="🗺" label="8.9만 코스" />
          </View>
        </View>

        {/* 하단: 로그인 폼 */}
        <View style={S.formArea}>
          <Text style={S.formTitle}>로그인</Text>
          <Text style={S.formSub}>계정에 접속하세요</Text>

          {error ? <Text style={S.error}>{error}</Text> : null}

          <TextInput
            style={[S.input, focusedField === 'email' && S.inputFocused]}
            placeholder="이메일 주소"
            placeholderTextColor="#bbb"
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.email}
            onChangeText={v => setForm(p => ({ ...p, email: v }))}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField('')}
          />
          <TextInput
            style={[S.input, focusedField === 'password' && S.inputFocused]}
            placeholder="비밀번호"
            placeholderTextColor="#bbb"
            secureTextEntry
            value={form.password}
            onChangeText={v => setForm(p => ({ ...p, password: v }))}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField('')}
          />

          <TouchableOpacity style={S.loginBtn} onPress={login} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={S.loginBtnText}>로그인</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={S.forgotBtn}>
            <Text style={S.forgotText}>비밀번호를 잊으셨나요?</Text>
          </TouchableOpacity>

          <View style={S.divider}>
            <View style={S.dividerLine} />
            <Text style={S.dividerText}>또는</Text>
            <View style={S.dividerLine} />
          </View>

          <TouchableOpacity style={S.registerBtn}>
            <Text style={S.registerText}>새 계정 만들기</Text>
          </TouchableOpacity>

          <View style={S.footerLinks}>
            <Text style={S.footerLink}>서비스 약관</Text>
            <Text style={S.footerLink}>개인정보처리방침</Text>
            <Text style={S.footerLink}>도움말</Text>
          </View>
          <Text style={S.copyright}>© 2026 Travellog</Text>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FF5A5F' },
  scroll: { flexGrow: 1 },

  /* 코랄 상단 */
  coral: { backgroundColor: '#FF5A5F', paddingTop: 70, paddingBottom: 30, alignItems: 'center', paddingHorizontal: 24 },
  copyWrap: { marginTop: 20, alignItems: 'center' },
  headline: { fontSize: 26, fontWeight: '800', color: 'white', textAlign: 'center', lineHeight: 36 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 10, lineHeight: 22 },

  /* 미니 카드 */
  miniRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  miniCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  miniIcon: { fontSize: 14, marginRight: 6 },
  miniLabel: { fontSize: 12, color: 'white', fontWeight: '600' },

  /* 하단 폼 */
  formArea: { backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 28, paddingTop: 32, paddingBottom: 40, minHeight: height * 0.5 },
  formTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a2e', marginBottom: 4 },
  formSub: { fontSize: 13, color: '#9ca3af', marginBottom: 20 },

  error: { backgroundColor: '#fef2f2', color: '#ef4444', padding: 12, borderRadius: 12, fontSize: 13, fontWeight: '600', marginBottom: 12, overflow: 'hidden' },

  input: { backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#1a1a2e', marginBottom: 12 },
  inputFocused: { borderColor: '#FF5A5F', backgroundColor: '#fff5f5' },

  loginBtn: { backgroundColor: '#FF5A5F', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  loginBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },

  forgotBtn: { alignItems: 'center', marginTop: 14 },
  forgotText: { fontSize: 13, color: '#FF5A5F', fontWeight: '600' },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerText: { marginHorizontal: 12, fontSize: 12, color: '#9ca3af' },

  registerBtn: { borderWidth: 1.5, borderColor: '#FF5A5F', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  registerText: { color: '#FF5A5F', fontSize: 15, fontWeight: '700' },

  footerLinks: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 24 },
  footerLink: { fontSize: 11, color: '#d1d5db' },
  copyright: { textAlign: 'center', fontSize: 11, color: '#d1d5db', marginTop: 10 },
});
