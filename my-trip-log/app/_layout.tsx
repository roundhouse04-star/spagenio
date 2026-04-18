import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initializeDatabase, isUserRegistered } from '@/db/database';
import { Colors } from '@/theme/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [hasUser, setHasUser] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await initializeDatabase();
        const registered = await isUserRegistered();
        setHasUser(registered);
      } catch (err) {
        console.error('App init error:', err);
      } finally {
        setIsReady(true);
        await SplashScreen.hideAsync();
      }
    })();
  }, []);

  useEffect(() => {
    if (isReady) {
      // 가입 안 되어 있으면 온보딩으로
      if (!hasUser) {
        router.replace('/(onboarding)/welcome');
      }
    }
  }, [isReady, hasUser]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary }}>
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
          <Stack.Screen name="trip/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="trips/new" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
