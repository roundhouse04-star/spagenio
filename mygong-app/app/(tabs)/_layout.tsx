import { Tabs } from 'expo-router';
import { Text, View, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts, FontSizes } from '@/theme/theme';
import { useUnreadCount } from '@/utils/useUnreadCount';
import { AdBanner } from '@/components/AdBanner';

const tabIcon = (emoji: string, active: boolean) => (
  <Text style={{ fontSize: active ? 30 : 26, opacity: active ? 1 : 0.55 }}>{emoji}</Text>
);

export default function TabsLayout() {
  const unread = useUnreadCount();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.text,
          tabBarInactiveTintColor: Colors.textFaint,
        }}
        tabBar={(props) => (
          <SafeAreaView edges={['bottom']} style={styles.bottomContainer}>
            <AdBanner />
            <CustomTabBar {...props} unread={unread} />
          </SafeAreaView>
        )}
      >
        <Tabs.Screen name="index"     options={{ title: '홈',       tabBarIcon: ({ focused }) => tabIcon('🏠', focused) }} />
        <Tabs.Screen name="artists"   options={{ title: '아티스트', tabBarIcon: ({ focused }) => tabIcon('👤', focused) }} />
        <Tabs.Screen name="tickets"   options={{ title: '티켓',     tabBarIcon: ({ focused }) => tabIcon('🎟️', focused) }} />
        <Tabs.Screen name="calendar"  options={{ title: '캘린더',   tabBarIcon: ({ focused }) => tabIcon('📅', focused) }} />
        <Tabs.Screen name="notif"     options={{
          title: '알림',
          tabBarIcon: ({ focused }) => tabIcon('🔔', focused),
        }} />
      </Tabs>
    </View>
  );
}

/**
 * 커스텀 탭바 — 더 크게 (80pt), 알림 배지 포함.
 */
function CustomTabBar({ state, descriptors, navigation, unread }: any) {
  return (
    <View style={styles.tabBar}>
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = options.title ?? route.name;
        const isNotif = route.name === 'notif';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={({ pressed }) => [styles.tabItem, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
          >
            <View style={styles.iconWrap}>
              {options.tabBarIcon?.({ focused, color: focused ? Colors.text : Colors.textFaint, size: 28 })}
              {isNotif && unread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              )}
            </View>
            <Text style={[
              styles.tabLabel,
              { color: focused ? Colors.text : Colors.textFaint },
              focused && { fontFamily: Fonts.semibold },
            ]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomContainer: {
    backgroundColor: Colors.bg,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    height: 80,                    // 58 → 80 (더 크게)
    paddingTop: 10,
    paddingBottom: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,                        // 아이콘과 글씨 사이 여유
  },
  iconWrap: {
    position: 'relative',
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    fontFamily: Fonts.medium,
    fontSize: 12,                  // 10 → 12 (가독성 ↑)
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: Colors.badge,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: Fonts.bold,
  },
});
