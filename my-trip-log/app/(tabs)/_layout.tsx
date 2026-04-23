import { Tabs } from 'expo-router';
import { Text, View, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { AdBanner } from '@/components/AdBanner';

function Icon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 28, opacity: focused ? 1 : 0.55 }}>{icon}</Text>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textTertiary,
        }}
        tabBar={(props) => (
          <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.surface }}>
            <AdBanner />
            <CustomTabBar {...props} />
          </SafeAreaView>
        )}
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
    </View>
  );
}

/**
 * 커스텀 탭바 — AdBanner 아래에 배치.
 * (expo-router Tabs 의 tabBar prop 에서 호출됨)
 */
function CustomTabBar({ state, descriptors, navigation }: any) {
  const { colors } = useTheme();
  const styles = createTabBarStyles(colors);

  return (
    <View style={styles.tabBar}>
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = options.title ?? route.name;

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
            {options.tabBarIcon?.({
              focused,
              color: focused ? colors.primary : colors.textTertiary,
              size: 28,
            })}
            <Text
              style={[
                styles.tabLabel,
                { color: focused ? colors.primary : colors.textTertiary },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createTabBarStyles(colors: any) {
  return StyleSheet.create({
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      height: 84,
      paddingTop: 8,
      paddingBottom: 8,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 4,
      paddingVertical: 4,
    },
    tabLabel: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
    },
  });
}
