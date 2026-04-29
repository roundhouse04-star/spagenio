import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, View, Platform, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator, BottomTabBar } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { initDb } from './src/lib/db';
import { setupSchedulerListeners, runCatchup, reapplyTelegramSchedule, reapplyWinningAlertSchedule } from './src/lib/scheduler';
import { loadAppSettings, loadTermsAgreement } from './src/lib/appSettings';
import TermsAgreementScreen from './src/screens/TermsAgreementScreen';
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
import LegalScreen from './src/screens/LegalScreen';
import BannerAdSlot from './src/components/BannerAdSlot';
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
      tabBar={(props) => (
        <View>
          <BannerAdSlot position="bottom" />
          <BottomTabBar {...props} />
        </View>
      )}
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
  // null = 로딩 중 / false = 동의 필요 / true = 정상 진입
  const [termsState, setTermsState] = useState(null);

  useEffect(() => {
    let unsubscribe;
    (async () => {
      try {
        // 1) DB 초기화 (반드시 먼저)
        await initDb();

        // 2) 약관 동의 상태 확인 — 미동의면 동의 화면만 표시
        const terms = await loadTermsAgreement();
        setTermsState(terms.isAgreed);

        // 3) 동의된 경우에만 스케줄러/리스너 활성화
        if (terms.isAgreed) {
          unsubscribe = setupSchedulerListeners();
          const sets = await loadAppSettings();
          await reapplyTelegramSchedule(sets.autoSendTelegram);
          await reapplyWinningAlertSchedule();
          runCatchup().catch((e) => console.warn('[catchup]', e?.message));
        }
      } catch (e) {
        console.warn('[App init]', e?.message);
        setTermsState(false); // 안전 폴백
      }
    })();
    return () => unsubscribe?.();
  }, []);

  // 로딩 화면
  if (termsState === null) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>🍀</Text>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  // 약관 미동의 — 동의 화면만 표시 (메인 앱 차단)
  if (termsState === false) {
    return (
      <SafeAreaProvider>
        <TermsAgreementScreen
          onAgreed={async () => {
            setTermsState(true);
            // 동의 후 스케줄러/리스너 활성화
            try {
              setupSchedulerListeners();
              const sets = await loadAppSettings();
              await reapplyTelegramSchedule(sets.autoSendTelegram);
              await reapplyWinningAlertSchedule();
            } catch (e) { console.warn('[post-agree init]', e?.message); }
          }}
        />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator screenOptions={stackHeader}>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="QRScan" component={QRScanScreen} options={{ title: 'QR 당첨확인' }} />
          <Stack.Screen name="History" component={HistoryScreen} options={{ title: '회차 정보' }} />
          <Stack.Screen name="WinningStores" component={WinningStoresScreen} options={{ title: '당첨 판매점' }} />
          <Stack.Screen name="Weights" component={WeightsScreen} options={{ title: '알고리즘 가중치' }} />
          <Stack.Screen name="MyPicks" component={MyPicksScreen} options={{ title: '추천번호 확인' }} />
          <Stack.Screen name="Legal" component={LegalScreen} options={{ title: '약관 및 면책조항' }} />
        </Stack.Navigator>
        <StatusBar style="dark" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
