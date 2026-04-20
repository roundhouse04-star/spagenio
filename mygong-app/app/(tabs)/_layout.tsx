import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { Colors, Fonts, FontSizes } from '@/theme/theme';
import { useUnreadCount } from '@/utils/useUnreadCount';

const tabIcon = (emoji: string, active: boolean) => (
  <Text style={{ fontSize: active ? 26 : 22, opacity: active ? 1 : 0.55 }}>{emoji}</Text>
);

export default function TabsLayout() {
  const unread = useUnreadCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.text,
        tabBarInactiveTintColor: Colors.textFaint,
        tabBarStyle: {
          backgroundColor: Colors.bg,
          borderTopColor: Colors.divider,
          height: 58,
          paddingBottom: 6,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.medium,
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen name="index"     options={{ title: '홈',       tabBarIcon: ({ focused }) => tabIcon('🏠', focused) }} />
      <Tabs.Screen name="artists"   options={{ title: '아티스트', tabBarIcon: ({ focused }) => tabIcon('👤', focused) }} />
      <Tabs.Screen name="tickets"   options={{ title: '티켓',     tabBarIcon: ({ focused }) => tabIcon('🎟️', focused) }} />
      <Tabs.Screen name="calendar"  options={{ title: '캘린더',   tabBarIcon: ({ focused }) => tabIcon('📅', focused) }} />
      <Tabs.Screen name="notif"     options={{
        title: '알림',
        tabBarIcon: ({ focused }) => (
          <View>
            {tabIcon('🔔', focused)}
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
        ),
      }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: Colors.badge,
    borderRadius: 8, minWidth: 16, height: 16,
    paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: {
    color: '#fff', fontSize: 9, fontFamily: Fonts.bold,
  },
});
