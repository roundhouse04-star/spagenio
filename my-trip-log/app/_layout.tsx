import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Appearance, useColorScheme } from 'react-native';
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

import { initializeDatabase, isUserRegistered } from '@/db/database';
import { syncStatsOnAppStart } from '@/utils/serverStats';
import { setupGlobalFont } from '@/utils/globalFont';
import { Colors } from '@/theme/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [hasUser, setHasUser] = useState(false);

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
            name="trips/new"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              animationDuration: 300,
            }}
          />
          <Stack.Screen
            name="transit/[city]"
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
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
