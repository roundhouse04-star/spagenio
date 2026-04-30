import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme as NavDefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthContext';
import { theme } from '../theme';
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { StocksScreen } from '../screens/StocksScreen';
import { TradeScreen } from '../screens/TradeScreen';
import { PositionsScreen } from '../screens/PositionsScreen';
import { NewsScreen } from '../screens/NewsScreen';
import { AccountScreen } from '../screens/AccountScreen';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const navTheme = {
  ...NavDefaultTheme,
  dark: true,
  colors: {
    ...NavDefaultTheme.colors,
    background: theme.bg,
    card: theme.card,
    text: theme.text,
    border: theme.border,
    primary: theme.accent,
    notification: theme.accent,
  },
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.subtext,
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen name="Dashboard" component={DashboardScreen} options={{ title: '시장' }} />
      <Tabs.Screen name="Stocks"    component={StocksScreen}    options={{ title: '종목' }} />
      <Tabs.Screen name="Trade"     component={TradeScreen}     options={{ title: '거래' }} />
      <Tabs.Screen name="Positions" component={PositionsScreen} options={{ title: '포지션' }} />
      <Tabs.Screen name="News"      component={NewsScreen}      options={{ title: '뉴스' }} />
      <Tabs.Screen name="Account"   component={AccountScreen}   options={{ title: '내정보' }} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const { token, bootstrapping } = useAuth();

  if (bootstrapping) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token
          ? <Stack.Screen name="Main" component={MainTabs} />
          : <Stack.Screen name="Login" component={LoginScreen} />}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
