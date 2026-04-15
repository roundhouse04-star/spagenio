import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useState } from 'react';
import { Text } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import FeedScreen from './src/screens/FeedScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import WriteScreen from './src/screens/WriteScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import NearbyScreen from './src/screens/NearbyScreen';
import PostDetailScreen from './src/screens/PostDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// 피드 스택 (피드 → 게시물 상세)
function FeedStack({ user }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FeedMain">{() => <FeedScreen user={user} />}</Stack.Screen>
      <Stack.Screen name="PostDetail">{(props) => <PostDetailScreen {...props} />}</Stack.Screen>
    </Stack.Navigator>
  );
}

// 탐색 스택 (탐색 → 게시물 상세)
function ExploreStack({ user }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ExploreMain">{() => <ExploreScreen user={user} />}</Stack.Screen>
      <Stack.Screen name="PostDetail">{(props) => <PostDetailScreen {...props} />}</Stack.Screen>
    </Stack.Navigator>
  );
}

// 내 주변 스택 (내 주변 → 게시물 상세)
function NearbyStack({ user }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="NearbyMain">{() => <NearbyScreen user={user} />}</Stack.Screen>
      <Stack.Screen name="PostDetail">{(props) => <PostDetailScreen {...props} />}</Stack.Screen>
    </Stack.Navigator>
  );
}

function ProfileStack({ user, onLogout }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain">{() => <ProfileStack user={user} onLogout={onLogout} />}</Stack.Screen>
      <Stack.Screen name="PostDetail">{(props) => <PostDetailScreen {...props} />}</Stack.Screen>
    </Stack.Navigator>
  );
}

function TabNavigator({ user, onLogout }) {
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarStyle: { height: 82, paddingBottom: 22, paddingTop: 8, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
      tabBarActiveTintColor: '#4f46e5',
      tabBarInactiveTintColor: '#9ca3af',
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
    }}>
      <Tab.Screen name="홈" options={{ tabBarIcon: ({ focused }) => <Text style={{ fontSize: 22 }}>{focused ? '🏠' : '🏠'}</Text> }}>
        {() => <FeedStack user={user} />}
      </Tab.Screen>
      <Tab.Screen name="내 주변" options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>📍</Text> }}>
        {() => <NearbyStack user={user} />}
      </Tab.Screen>
      <Tab.Screen name="탐색" options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>🔍</Text> }}>
        {() => <ExploreStack user={user} />}
      </Tab.Screen>
      <Tab.Screen name="글쓰기" options={{ tabBarIcon: () => <Text style={{ fontSize: 26, color: '#4f46e5' }}>✏️</Text> }}>
        {() => <WriteScreen user={user} />}
      </Tab.Screen>
      <Tab.Screen name="프로필" options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>👤</Text> }}>
        {() => <ProfileStack user={user} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);

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
