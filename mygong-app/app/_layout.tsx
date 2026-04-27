import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
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
import { hasAcceptedConsent } from '@/services/consent';
import { Colors } from '@/theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [consented, setConsented] = useState<boolean | null>(null);

  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    NotoSansKR_400Regular, NotoSansKR_500Medium, NotoSansKR_700Bold,
    Gaegu_700Bold,
  });

  useEffect(() => {
    (async () => {
      try {
        // 1) 동의 상태 우선 로드 (UI 분기에 필요)
        const accepted = await hasAcceptedConsent();
        setConsented(accepted);

        // 2) DB 테이블 생성·마이그레이션
        await initializeDatabase();

        // 3) 저장된 팔로잉 아티스트 중 stale한 것들 백그라운드로 동기화
        //    (동의 상태와 무관하게 트리거하되, 첫 실행에서는 어차피 데이터가 없음)
        syncStaleArtists(12).catch(e => console.warn('[sync] stale failed', e));

        setIsReady(true);
      } catch (err) {
        console.error('[boot] failed:', err);
        setIsReady(true);
        if (consented === null) setConsented(false);
      }
    })();
  }, []);

  const bootDone = isReady && fontsLoaded && consented !== null;

  useEffect(() => {
    if (bootDone) SplashScreen.hideAsync().catch(() => {});
  }, [bootDone]);

  useEffect(() => {
    if (bootDone && consented === false) {
      router.replace('/(onboarding)');
    }
  }, [bootDone, consented, router]);

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
