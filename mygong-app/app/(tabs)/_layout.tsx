import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { Colors, Fonts } from '@/theme/theme';
import { useUnreadCount } from '@/utils/useUnreadCount';

/** 각 탭의 22x22 사각형 아이콘. 선택되면 검정 배경 + 흰 글자. */
function TabIcon({ glyph, active }: { glyph: string; active: boolean }) {
  return (
    <View style={[
      styles.tabIc,
      active && { backgroundColor: Colors.ink, borderColor: Colors.ink },
    ]}>
      <Text style={{
        fontFamily: Fonts.regular,
        fontSize: 11,
        color: active ? '#fff' : Colors.ink,
      }}>{glyph}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const unread = useUnreadCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.ink,
        tabBarInactiveTintColor: Colors.ink4,
        tabBarStyle: {
          backgroundColor: Colors.paper,
          borderTopColor: Colors.ink,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.medium,
          fontSize: 10,
          marginTop: 3,
        },
      }}
    >
      <Tabs.Screen name="index"    options={{ title: '홈',       tabBarIcon: ({ focused }) => <TabIcon glyph="◱" active={focused} /> }} />
      <Tabs.Screen name="artists"  options={{ title: '아티스트', tabBarIcon: ({ focused }) => <TabIcon glyph="♡" active={focused} /> }} />
      <Tabs.Screen name="tickets"  options={{ title: '티켓',     tabBarIcon: ({ focused }) => <TabIcon glyph="▦" active={focused} /> }} />
      <Tabs.Screen name="calendar" options={{ title: '캘린더',   tabBarIcon: ({ focused }) => <TabIcon glyph="▤" active={focused} /> }} />
      <Tabs.Screen name="notif"    options={{
        title: '알림',
        tabBarIcon: ({ focused }) => (
          <View>
            <TabIcon glyph="◔" active={focused} />
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
  tabIc: {
    width: 22, height: 22,
    borderWidth: 1, borderColor: Colors.ink3,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.paper,
  },
  badge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: Colors.ink,
    minWidth: 14, height: 14,
    paddingHorizontal: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: {
    color: '#fff', fontSize: 9, fontFamily: Fonts.mono,
  },
});
