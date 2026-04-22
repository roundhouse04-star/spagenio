import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  useFonts,
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  NotoSansKR_400Regular, NotoSansKR_500Medium, NotoSansKR_700Bold,
} from '@expo-google-fonts/noto-sans-kr';
import {
  JetBrainsMono_400Regular, JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import { Gaegu_700Bold } from '@expo-google-fonts/gaegu';

import { initializeDatabase } from '@/db/database';
import { syncStaleArtists } from '@/services/syncManager';
import { Colors } from '@/theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    NotoSansKR_400Regular, NotoSansKR_500Medium, NotoSansKR_700Bold,
    JetBrainsMono_400Regular, JetBrainsMono_500Medium,
    Gaegu_700Bold,
  });

  useEffect(() => {
    (async () => {
      try {
        // 1) DB 테이블 생성·마이그레이션
        await initializeDatabase();

        // 2) 저장된 팔로잉 아티스트 중 stale한 것들 백그라운드로 동기화
        //    (오래된 아티스트만, 에러는 무시. UI 블로킹 안 함)
        syncStaleArtists(12).catch(e => console.warn('[sync] stale failed', e));

        setIsReady(true);
      } catch (err) {
        console.error('[boot] failed:', err);
        setIsReady(true); // 실패해도 앱은 띄운다 (에러 화면은 각 스크린에서)
      }
    })();
  }, []);

  useEffect(() => {
    if (isReady && fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [isReady, fontsLoaded]);

  if (!isReady || !fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="search/index"       options={{ presentation: 'modal' }} />
          <Stack.Screen name="artist/[id]" />
          <Stack.Screen name="ticket/[id]" />
          <Stack.Screen name="event/[id]" />
          <Stack.Screen name="ticket/new" />
          <Stack.Screen name="event/new" />
          <Stack.Screen name="settings/index" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
