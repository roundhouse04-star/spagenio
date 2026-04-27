import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, View, Platform } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { initDb } from './src/lib/db';
import { setupSchedulerListeners, runCatchup, reapplyTelegramSchedule, reapplyWinningAlertSchedule } from './src/lib/scheduler';
import { loadAppSettings } from './src/lib/appSettings';
import HomeScreen from './src/screens/HomeScreen';
import GenerateScreen from './src/screens/GenerateScreen';
import PurchasedScreen from './src/screens/PurchasedScreen';
import PatternScreen from './src/screens/PatternScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import WinningStoresScreen from './src/screens/WinningStoresScreen';
import WeightsScreen from './src/screens/WeightsScreen';
import MyPicksScreen from './src/screens/MyPicksScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import QRScanScreen from './src/screens/QRScanScreen';
import { theme } from './src/lib/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.bg,
    primary: theme.primary,
    border: theme.border,
    card: '#fff',
    text: theme.text,
  },
};

function TabIcon({ emoji, focused }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>
    </View>
  );
}

function MainTabs() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSub,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: Platform.select({
          ios: { height: 84, paddingTop: 6 },
          android: { height: 64, paddingTop: 6, paddingBottom: 6 },
          default: { height: 64 },
        }),
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: '홈', tabBarIcon: (p) => <TabIcon emoji="🏠" focused={p.focused} /> }}
      />
      <Tab.Screen
        name="Generate"
        component={GenerateScreen}
        options={{ title: '추천', tabBarIcon: (p) => <TabIcon emoji="🎯" focused={p.focused} /> }}
      />
      <Tab.Screen
        name="Purchased"
        component={PurchasedScreen}
        options={{ title: '구입', tabBarIcon: (p) => <TabIcon emoji="🎟" focused={p.focused} /> }}
      />
      <Tab.Screen
        name="Pattern"
        component={PatternScreen}
        options={{ title: '분석', tabBarIcon: (p) => <TabIcon emoji="🔍" focused={p.focused} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: '설정', tabBarIcon: (p) => <TabIcon emoji="⚙️" focused={p.focused} /> }}
      />
    </Tab.Navigator>
    </SafeAreaView>
  );
}

const stackHeader = {
  headerStyle: { backgroundColor: theme.primary },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '800' },
};

export default function App() {
  useEffect(() => {
    let unsubscribe;
    (async () => {
      try {
        // 1) DB 초기화
        await initDb();

        // 2) 알림 리스너 등록 (텔레그램 자동발송 + 당첨 자동확인 트리거)
        unsubscribe = setupSchedulerListeners();

        // 3) 토글 상태에 맞게 OS 스케줄 재등록 (앱 갱신/재설치 후에도 일관성 유지)
        const sets = await loadAppSettings();
        await reapplyTelegramSchedule(sets.autoSendTelegram);
        await reapplyWinningAlertSchedule();

        // 4) 놓친 스케줄 catch-up (앱 죽어있던 동안 발사된 알림 보정)
        runCatchup().catch((e) => console.warn('[catchup]', e?.message));
      } catch (e) {
        console.warn('[App init]', e?.message);
      }
    })();
    return () => unsubscribe?.();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator screenOptions={stackHeader}>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="QRScan" component={QRScanScreen} options={{ title: 'QR 당첨확인' }} />
          <Stack.Screen name="History" component={HistoryScreen} options={{ title: '회차 정보' }} />
          <Stack.Screen name="WinningStores" component={WinningStoresScreen} options={{ title: '당첨 판매점' }} />
          <Stack.Screen name="Weights" component={WeightsScreen} options={{ title: '알고리즘 가중치' }} />
          <Stack.Screen name="MyPicks" component={MyPicksScreen} options={{ title: '알고리즘추천' }} />
        </Stack.Navigator>
        <StatusBar style="dark" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
