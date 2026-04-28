import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
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
import { Colors } from '@/theme/theme';
import { ThemeProvider } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync();

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
      SplashScreen.hideAsync();
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
