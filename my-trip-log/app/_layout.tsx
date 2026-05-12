import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, ActivityIndicator, useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  useFonts as usePlayfair,
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  NotoSansKR_400Regular,
  NotoSansKR_500Medium,
  NotoSansKR_700Bold,
} from '@expo-google-fonts/noto-sans-kr';

import { initializeDatabase, isUserRegistered, hasFullConsent } from '@/db/database';
import { syncStatsOnAppStart } from '@/utils/serverStats';
import { setupGlobalFont } from '@/utils/globalFont';
import { incrementLaunchCount, maybePromptReview } from '@/utils/storeReview';
import { checkRateAlerts } from '@/utils/rateAlerts';
import { initializeAdMob } from '@/utils/admobInit';
import { Colors } from '@/theme/theme';
import { ThemeProvider } from '@/theme/ThemeProvider';

// Expo Go 등 splash screen 모듈이 등록되지 않은 환경에서 에러 방지
SplashScreen.preventAutoHideAsync().catch(() => {
  // No native splash screen registered — Expo Go 환경에서 정상 분기
});

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [hasUser, setHasUser] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);

  // 시스템 테마 변경 감지 → 리렌더 트리거
  const colorScheme = useColorScheme();

  const [fontsLoaded] = usePlayfair({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    NotoSansKR_400Regular,
    NotoSansKR_500Medium,
    NotoSansKR_700Bold,
  });

  useEffect(() => {
    (async () => {
      try {
        await initializeDatabase();
        const registered = await isUserRegistered();
        const consented = registered ? await hasFullConsent() : false;
        setHasUser(registered);
        setHasConsent(consented);

        if (registered && consented) {
          syncStatsOnAppStart().catch((err) => {
            console.warn('[stats sync] non-fatal background sync failed:', err);
          });
          // 앱 진입 횟수 카운트 → 5번 이상 + 1년 경과 시 자연스러운 별점 요청
          incrementLaunchCount().then(() => {
            // 약간 지연시켜 다른 UI 안정화 후 표시
            setTimeout(() => { maybePromptReview().catch(() => undefined); }, 3000);
          }).catch(() => undefined);
          // 환율 목표가 알림 체크 (백그라운드, 도달 시 로컬 알림)
          setTimeout(() => { checkRateAlerts().catch(() => undefined); }, 2000);
          // AdMob 초기화 + iOS ATT 다이얼로그 (광고 활성 상태일 때만 동작)
          setTimeout(() => { initializeAdMob().catch(() => undefined); }, 1500);
        }
      } catch (err) {
        console.error('App init error:', err);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      setupGlobalFont();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (isReady && fontsLoaded) {
      // Expo Go 등 splash screen 모듈이 없는 환경에서 에러 방지
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady, fontsLoaded]);

  useEffect(() => {
    if (!isReady || !fontsLoaded) return;
    if (!hasUser) {
      // 신규: 처음부터 시작
      router.replace('/(onboarding)/welcome');
    } else if (!hasConsent) {
      // 닉네임만 입력하고 약관 단계에서 종료한 사용자 → 약관 화면으로 직진
      router.replace('/(onboarding)/terms');
    }
  }, [isReady, fontsLoaded, hasUser, hasConsent]);

  // Deep Link 처리 — triplive://import?d=...
  // 사용자가 외부 메신저(카톡 등)에서 공유 링크를 탭하면 앱이 열리고
  // 이 핸들러가 자동으로 trip-import 화면으로 이동시킴.
  useEffect(() => {
    if (!isReady || !fontsLoaded || !hasUser || !hasConsent) return;

    const handleUrl = (url: string | null) => {
      if (!url) return;
      // triplive://import?d=XXX 형식 감지
      if (url.includes('import') && url.includes('d=')) {
        const idx = url.indexOf('d=');
        const data = url.substring(idx + 2).split('&')[0];
        if (data) {
          router.push({ pathname: '/trip-import', params: { d: data } });
        }
      }
    };

    // 앱이 종료 상태에서 Deep Link 로 실행된 경우
    Linking.getInitialURL().then(handleUrl).catch(() => {});

    // 앱이 백그라운드 → 포그라운드로 올라온 경우
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [isReady, fontsLoaded, hasUser, hasConsent]);

  if (!isReady || !fontsLoaded) {
    return <BrandSplash />;
  }

  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          {/* 시스템 다크모드에 따라 status bar 자동 */}
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

          <Stack
            screenOptions={{
              headerShown: false,
              // 부드러운 화면 전환 애니메이션
              animation: 'slide_from_right',
              animationDuration: 250,
              contentStyle: { backgroundColor: Colors.background },
            }}
          >
          <Stack.Screen
            name="(tabs)"
            options={{
              animation: 'fade',
              animationDuration: 200,
            }}
          />
          <Stack.Screen
            name="(onboarding)"
            options={{
              animation: 'fade',
              animationDuration: 300,
            }}
          />
          <Stack.Screen
            name="trip/[id]/index"
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
              animationDuration: 280,
            }}
          />
          <Stack.Screen
            name="trip/[id]/item-new"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              animationDuration: 300,
            }}
          />
          <Stack.Screen
            name="trip/[id]/log-new"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              animationDuration: 300,
            }}
          />
          <Stack.Screen
            name="trip/[id]/expense-new"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              animationDuration: 300,
            }}
          />
          <Stack.Screen
            name="trip/[id]/receipt-scan"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              animationDuration: 300,
            }}
          />
          <Stack.Screen
            name="trip/[id]/receipts"
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
              animationDuration: 280,
            }}
          />
          <Stack.Screen
            name="trips/new"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              animationDuration: 300,
            }}
          />
          <Stack.Screen
            name="transit/[city]/index"
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
              animationDuration: 280,
            }}
          />
          <Stack.Screen
            name="ai-itinerary"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              animationDuration: 300,
            }}
          />
          <Stack.Screen
            name="expenses/index"
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
              animationDuration: 280,
            }}
          />
          <Stack.Screen
            name="expenses/[id]"
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
              animationDuration: 280,
            }}
          />
          <Stack.Screen
            name="tickets/index"
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
              animationDuration: 280,
            }}
          />
          <Stack.Screen
            name="tickets/new"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              animationDuration: 300,
            }}
          />
          <Stack.Screen
            name="tickets/[id]/index"
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
              animationDuration: 280,
            }}
          />
          <Stack.Screen
            name="tickets/[id]/preview"
            options={{
              presentation: 'fullScreenModal',
              animation: 'fade',
              animationDuration: 200,
              contentStyle: { backgroundColor: '#000' },
            }}
          />
          <Stack.Screen name="tools/timezone" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="tools/emergency" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="tools/visa" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="stats/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="wishlist/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="trip/[id]/recap" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
    </ThemeProvider>
  );
}

function BrandSplash() {
  return (
    <View style={splashStyles.container}>
      <View style={splashStyles.content}>
        <Text style={splashStyles.word1}>Spa</Text>
        <Text style={splashStyles.word2}>Trip Log</Text>
      </View>
      <View style={splashStyles.bottom}>
        <Text style={splashStyles.icon}>✈️</Text>
        <ActivityIndicator size="small" color="#1E2A3A" style={{ marginTop: 16 }} />
      </View>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EFE4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  word1: {
    fontSize: 56,
    fontWeight: '800',
    color: '#1E2A3A',
    letterSpacing: -1.5,
    lineHeight: 64,
  },
  word2: {
    fontSize: 56,
    fontWeight: '800',
    color: '#1E2A3A',
    letterSpacing: -1.5,
    lineHeight: 64,
  },
  bottom: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
  },
  icon: {
    fontSize: 28,
  },
});
