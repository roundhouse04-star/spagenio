import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { Colors } from '@/theme/theme';

function Icon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{icon}</Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          paddingTop: 4,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ focused }) => <Icon icon="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: '여행',
          tabBarIcon: ({ focused }) => <Icon icon="✈️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: '도구',
          tabBarIcon: ({ focused }) => <Icon icon="🧰" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: '탐색',
          tabBarIcon: ({ focused }) => <Icon icon="🌍" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: '내 정보',
          tabBarIcon: ({ focused }) => <Icon icon="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
