import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// 폰트 import (3종)
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

import { initializeDatabase, isUserRegistered } from '@/db/database';
import { syncStatsOnAppStart } from '@/utils/serverStats';
import { setupGlobalFont } from '@/utils/globalFont';
import { Colors } from '@/theme/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [hasUser, setHasUser] = useState(false);

  // 폰트 로딩
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
        setHasUser(registered);

        if (registered) {
          syncStatsOnAppStart().catch(() => {});
        }
      } catch (err) {
        console.error('App init error:', err);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  // 폰트 로드되자마자 전역 적용
  useEffect(() => {
    if (fontsLoaded) {
      setupGlobalFont();
    }
  }, [fontsLoaded]);

  // 폰트 + DB 둘 다 준비됐을 때만 splash 닫기
  useEffect(() => {
    if (isReady && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isReady, fontsLoaded]);

  useEffect(() => {
    if (isReady && fontsLoaded && !hasUser) {
      router.replace('/(onboarding)/welcome');
    }
  }, [isReady, fontsLoaded, hasUser]);

  if (!isReady || !fontsLoaded) {
    return (
      <View style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
      }}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen
            name="trip/[id]/index"
            options={{ presentation: 'card' }}
          />
          <Stack.Screen
            name="trip/[id]/item-new"
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="trip/[id]/log-new"
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="trip/[id]/expense-new"
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="trips/new"
            options={{ presentation: 'modal' }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
