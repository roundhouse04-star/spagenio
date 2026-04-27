import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Pressable, Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { theme } from '../lib/theme';

// 동행복권 사이트는 메인 페이지에서 RSA-기반 JS 세션을 설정한 뒤에야 하위 페이지 접근을 허용함
// 직접 /wnprchsplcsrch/home 으로 진입하면 /error.html 로 리다이렉트됨
// → WebView를 메인 페이지로 시작 → 로드 완료 후 JS injection 으로 당첨판매점 페이지로 이동
const HOME_URL = 'https://www.dhlottery.co.kr/';
const WINNING_PATH = '/wnprchsplcsrch/home';
const WINNING_FULL = 'https://www.dhlottery.co.kr' + WINNING_PATH;

export default function WinningStoresScreen({ navigation }) {
  const webRef = useRef(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('boot'); // 'boot' → 'winning'

  useEffect(() => {
    navigation.setOptions?.({ title: '🏪 당첨 판매점' });
  }, [navigation]);

  const handleLoadEnd = (e) => {
    const currentUrl = e.nativeEvent.url || '';
    setLoading(false);

    if (!bootstrapped && currentUrl.startsWith(HOME_URL.replace(/\/$/, ''))) {
      // 메인 페이지 첫 로드 완료 → 당첨판매점으로 자동 이동
      setBootstrapped(true);
      setLoading(true);
      setPhase('winning');
      webRef.current?.injectJavaScript(`
        try { window.location.href = '${WINNING_PATH}'; } catch (e) {}
        true;
      `);
    }
  };

  const handleNavStateChange = (state) => {
    // error.html로 튕긴 경우 감지
    if (bootstrapped && /error\.html/i.test(state.url)) {
      setLoading(false);
    }
  };

  const onReload = () => {
    setBootstrapped(false);
    setPhase('boot');
    setLoading(true);
    webRef.current?.injectJavaScript(`window.location.href = '${HOME_URL}'; true;`);
  };

  const onOpenExternal = () => Linking.openURL(WINNING_FULL);

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <View style={styles.phaseBadge}>
          <Text style={styles.phaseTxt}>
            {phase === 'boot' ? '🔐 세션 준비 중...' : '🏪 당첨 판매점'}
          </Text>
        </View>
        <Pressable style={styles.iconBtn} onPress={onReload}>
          <Text style={styles.iconTxt}>↻</Text>
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={onOpenExternal}>
          <Text style={styles.iconTxt}>🌐</Text>
        </Pressable>
      </View>

      {loading && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loaderTxt}>
            {phase === 'boot' ? '동행복권 세션 준비 중...' : '판매점 정보 불러오는 중...'}
          </Text>
        </View>
      )}

      <WebView
        ref={webRef}
        source={{ uri: HOME_URL }}
        style={styles.web}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={handleLoadEnd}
        onNavigationStateChange={handleNavStateChange}
        startInLoadingState={false}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  phaseBadge: {
    flex: 1, padding: 8, borderRadius: 8, backgroundColor: '#eef2ff',
    borderWidth: 1, borderColor: '#c7d2fe',
  },
  phaseTxt: { color: theme.primary, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  iconBtn: {
    width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  iconTxt: { fontSize: 16, fontWeight: '700' },
  web: { flex: 1, backgroundColor: '#fff' },
  overlay: {
    position: 'absolute', top: 80, left: 0, right: 0,
    alignItems: 'center', padding: 20, zIndex: 1,
  },
  loaderTxt: { marginTop: 8, color: theme.textSub, fontSize: 12, fontWeight: '600' },
});
