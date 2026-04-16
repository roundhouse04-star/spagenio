import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Compass, Calendar, Train, Coins, ChevronRight } from 'lucide-react-native';
import { colors } from '../theme/colors';

const MENU_ITEMS = [
  { key: 'NearbyPage', Icon: Compass, label: 'Nearby', desc: 'DISCOVER AROUND YOU' },
  { key: 'PlannerPage', Icon: Calendar, label: 'Planner', desc: 'CREATE YOUR JOURNEY' },
  { key: 'TransitPage', Icon: Train, label: 'Transit', desc: 'METRO · SUBWAY' },
  { key: 'ExchangePage', Icon: Coins, label: 'Exchange', desc: 'CURRENCY RATES' },
];

export default function MoreScreen({ user }) {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <Text style={S.title}>More</Text>
        <Text style={S.subtitle}>TOOLS & UTILITIES</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8 }}>
        {MENU_ITEMS.map(item => (
          <TouchableOpacity key={item.key} style={S.menuItem} activeOpacity={0.7}
            onPress={() => navigation.navigate(item.key)}>
            <item.Icon size={20} color={colors.primary} strokeWidth={1.5} />
            <View style={S.menuText}>
              <Text style={S.menuLabel}>{item.label}</Text>
              <Text style={S.menuDesc}>{item.desc}</Text>
            </View>
            <ChevronRight size={16} color={colors.textTertiary} strokeWidth={1.5} />
          </TouchableOpacity>
        ))}

        <View style={S.appInfo}>
          <Text style={S.appName}>Spagenio</Text>
          <Text style={S.appTag}>TRAVEL</Text>
          <Text style={S.appVersion}>VERSION 1.0.0</Text>
          <Text style={S.appCopy}>EVERY DAY IS A JOURNEY</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  title: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 26, color: colors.primary, letterSpacing: -0.8, marginBottom: 2 },
  subtitle: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 2, color: colors.textTertiary, textTransform: 'uppercase' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, gap: 14, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  menuText: { flex: 1 },
  menuLabel: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 16, color: colors.primary, letterSpacing: -0.3 },
  menuDesc: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 1.5, color: colors.textTertiary, marginTop: 2 },
  appInfo: { alignItems: 'center', paddingVertical: 48, gap: 4 },
  appName: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 22, color: colors.primary, letterSpacing: -0.5 },
  appTag: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 3, color: colors.primary, marginTop: 2 },
  appVersion: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 1.5, color: colors.textTertiary, marginTop: 14 },
  appCopy: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 2, color: colors.textMuted, marginTop: 6 },
});
