import { StatusBar } from 'expo-status-bar';
import { useFonts, PlayfairDisplay_400Regular, PlayfairDisplay_500Medium, PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { View, Text, ActivityIndicator } from 'react-native';
import { Home, Search, PenLine, Menu, User } from 'lucide-react-native';
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

function FeedStack({ user, setUser }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FeedMain">{() => <FeedScreen user={user} />}</Stack.Screen>
      <Stack.Screen name="PostDetail">{(props) => <PostDetailScreen {...props} user={user} setUser={setUser} />}</Stack.Screen>
    </Stack.Navigator>
  );
}

function ExploreStack({ user, setUser }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ExploreMain">{() => <ExploreScreen user={user} />}</Stack.Screen>
      <Stack.Screen name="PostDetail">{(props) => <PostDetailScreen {...props} user={user} setUser={setUser} />}</Stack.Screen>
    </Stack.Navigator>
  );
}

function ProfileStack({ user, setUser, onLogout }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain">{() => <ProfileScreen user={user} setUser={setUser} onLogout={onLogout} />}</Stack.Screen>
      <Stack.Screen name="PostDetail">{(props) => <PostDetailScreen {...props} user={user} setUser={setUser} />}</Stack.Screen>
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

function TabNavigator({ user, setUser, onLogout }) {
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarStyle: { height: 82, paddingBottom: 22, paddingTop: 8, backgroundColor: 'white', borderTopWidth: 0.5, borderTopColor: '#f0f0f0' },
      tabBarActiveTintColor: '#1E2A3A',
      tabBarInactiveTintColor: '#9ca3af',
      tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 1.5 },
    }}>
      <Tab.Screen name="HOME" options={{ tabBarIcon: ({ focused }) => <Home size={20} color={focused ? '#1E2A3A' : '#9ca3af'} strokeWidth={focused ? 2 : 1.5} /> }}>
        {() => <FeedStack user={user} setUser={setUser} />}
      </Tab.Screen>
      <Tab.Screen name="EXPLORE" options={{ tabBarIcon: ({ focused }) => <Search size={20} color={focused ? '#1E2A3A' : '#9ca3af'} strokeWidth={focused ? 2 : 1.5} /> }}>
        {() => <ExploreStack user={user} setUser={setUser} />}
      </Tab.Screen>
      <Tab.Screen name="WRITE" options={{ tabBarIcon: ({ focused }) => <PenLine size={20} color={focused ? '#1E2A3A' : '#9ca3af'} strokeWidth={focused ? 2 : 1.5} /> }}>
        {() => <WriteScreen user={user} />}
      </Tab.Screen>
      <Tab.Screen name="MORE" options={{ tabBarIcon: ({ focused }) => <Menu size={20} color={focused ? '#1E2A3A' : '#9ca3af'} strokeWidth={focused ? 2 : 1.5} /> }}>
        {() => <MoreStack user={user} />}
      </Tab.Screen>
      <Tab.Screen name="PROFILE" options={{ tabBarIcon: ({ focused }) => <User size={20} color={focused ? '#1E2A3A' : '#9ca3af'} strokeWidth={focused ? 2 : 1.5} /> }}>
        {() => <ProfileStack user={user} setUser={setUser} onLogout={onLogout} />}
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
      <TabNavigator user={user} setUser={setUser} onLogout={() => setUser(null)} />
    </NavigationContainer>
  );
}
