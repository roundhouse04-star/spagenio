import { StatusBar } from 'expo-status-bar';
import { useFonts, PlayfairDisplay_400Regular, PlayfairDisplay_500Medium, PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useState } from 'react';
import LoginScreen from './src/screens/LoginScreen';
import FeedScreen from './src/screens/FeedScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import WriteScreen from './src/screens/WriteScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import NearbyScreen from './src/screens/NearbyScreen';
import PostDetailScreen from './src/screens/PostDetailScreen';
import MoreScreen from './src/screens/MoreScreen';
import PlannerScreen from './src/screens/PlannerScreen';
import TransitScreen from './src/screens/TransitScreen';
import ExchangeScreen from './src/screens/ExchangeScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function FeedStack({ user }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FeedMain">{() => <FeedScreen user={user} />}</Stack.Screen>
      <Stack.Screen name="PostDetail">{(props) => <PostDetailScreen {...props} />}</Stack.Screen>
    </Stack.Navigator>
  );
}

function ExploreStack({ user }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ExploreMain">{() => <ExploreScreen user={user} />}</Stack.Screen>
      <Stack.Screen name="PostDetail">{(props) => <PostDetailScreen {...props} />}</Stack.Screen>
    </Stack.Navigator>
  );
}

function ProfileStack({ user, onLogout }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain">{() => <ProfileScreen user={user} onLogout={onLogout} />}</Stack.Screen>
      <Stack.Screen name="PostDetail">{(props) => <PostDetailScreen {...props} />}</Stack.Screen>
    </Stack.Navigator>
  );
}

function MoreStack({ user }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MoreMain">{() => <MoreScreen user={user} />}</Stack.Screen>
      <Stack.Screen name="NearbyPage">{() => <NearbyScreen user={user} />}</Stack.Screen>
      <Stack.Screen name="PlannerPage">{() => <PlannerScreen user={user} />}</Stack.Screen>
      <Stack.Screen name="TransitPage" component={TransitScreen} />
      <Stack.Screen name="ExchangePage" component={ExchangeScreen} />
    </Stack.Navigator>
  );
}

function TabNavigator({ user, onLogout }) {
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarStyle: { height: 82, paddingBottom: 22, paddingTop: 8, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
      tabBarActiveTintColor: '#FF5A5F',
      tabBarInactiveTintColor: '#9ca3af',
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
    }}>
      <Tab.Screen name="홈" options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>🏠</Text> }}>
        {() => <FeedStack user={user} />}
      </Tab.Screen>
      <Tab.Screen name="탐색" options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>🔍</Text> }}>
        {() => <ExploreStack user={user} />}
      </Tab.Screen>
      <Tab.Screen name="글쓰기" options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>📝</Text> }}>
        {() => <WriteScreen user={user} />}
      </Tab.Screen>
      <Tab.Screen name="더보기" options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>☰</Text> }}>
        {() => <MoreStack user={user} />}
      </Tab.Screen>
      <Tab.Screen name="프로필" options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>👤</Text> }}>
        {() => <ProfileStack user={user} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="small" color="#1E2A3A" />
      </View>
    );
  }
  if (!user) return (
    <>
      <StatusBar style="dark" />
      <LoginScreen onLogin={setUser} />
    </>
  );
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <TabNavigator user={user} onLogout={() => setUser(null)} />
    </NavigationContainer>
  );
}
