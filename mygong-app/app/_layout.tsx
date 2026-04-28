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
    Gaegu_700Bold,
  });

  // DB 초기화 + 백그라운드 sync. 동의 분기는 app/index.tsx 가 담당한다.
  useEffect(() => {
    (async () => {
      try {
        await initializeDatabase();
        syncStaleArtists(12).catch(e => console.warn('[sync] stale failed', e));
      } catch (err) {
        console.error('[boot] db init failed:', err);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const bootDone = isReady && fontsLoaded;

  useEffect(() => {
    if (bootDone) SplashScreen.hideAsync().catch(() => {});
  }, [bootDone]);

  if (!bootDone) {
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
          <Stack.Screen name="index" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="search/index"       options={{ presentation: 'modal' }} />
          <Stack.Screen name="artist/[id]" />
          <Stack.Screen name="ticket/[id]" />
          <Stack.Screen name="event/[id]" />
          <Stack.Screen name="ticket/new" />
          <Stack.Screen name="event/new" />
          <Stack.Screen name="settings/index" />
          <Stack.Screen name="settings/legal/[type]" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
