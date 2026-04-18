import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Shadows } from '@/theme/theme';

const FEATURED_CITIES = [
  { code: 'tokyo', name: '도쿄', country: '일본', flag: '🇯🇵', emoji: '🗼' },
  { code: 'osaka', name: '오사카', country: '일본', flag: '🇯🇵', emoji: '🏯' },
  { code: 'bangkok', name: '방콕', country: '태국', flag: '🇹🇭', emoji: '🛺' },
  { code: 'paris', name: '파리', country: '프랑스', flag: '🇫🇷', emoji: '🗼' },
  { code: 'newyork', name: '뉴욕', country: '미국', flag: '🇺🇸', emoji: '🗽' },
  { code: 'london', name: '런던', country: '영국', flag: '🇬🇧', emoji: '🎡' },
  { code: 'barcelona', name: '바르셀로나', country: '스페인', flag: '🇪🇸', emoji: '⛪' },
  { code: 'singapore', name: '싱가포르', country: '싱가포르', flag: '🇸🇬', emoji: '🦁' },
];

const TIPS = [
  { icon: '✈️', title: '항공권 예약 팁', desc: '화요일 새벽이 가장 저렴해요' },
  { icon: '💳', title: '해외 결제 수수료', desc: '트래블 카드로 절약하는 법' },
  { icon: '🧳', title: '짐 싸기 체크리스트', desc: '꼭 필요한 것만 챙기는 법' },
  { icon: '📱', title: '해외 데이터 로밍', desc: 'eSIM vs 포켓와이파이 비교' },
];

export default function DiscoverScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>탐색</Text>
        <Text style={styles.subtitle}>어디로 떠나볼까요?</Text>

        <Text style={styles.sectionTitle}>인기 여행지</Text>
        <View style={styles.cityGrid}>
          {FEATURED_CITIES.map((city) => (
            <Pressable key={city.code} style={styles.cityCard}>
              <Text style={styles.cityEmoji}>{city.emoji}</Text>
              <Text style={styles.cityFlag}>{city.flag}</Text>
              <Text style={styles.cityName}>{city.name}</Text>
              <Text style={styles.cityCountry}>{city.country}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>여행 꿀팁</Text>
        <View style={styles.tipsList}>
          {TIPS.map((tip, i) => (
            <Pressable key={i} style={styles.tipCard}>
              <Text style={styles.tipIcon}>{tip.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipDesc}>{tip.desc}</Text>
              </View>
              <Text style={styles.tipArrow}>›</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.comingSoon}>
          <Text style={styles.comingSoonIcon}>🚧</Text>
          <Text style={styles.comingSoonText}>
            더 많은 콘텐츠를 준비 중입니다
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.xxl, paddingBottom: Spacing.huge },
  title: {
    fontSize: Typography.displaySmall,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: Typography.headlineSmall,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  cityCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.soft,
  },
  cityEmoji: { fontSize: 40, marginBottom: Spacing.xs },
  cityFlag: { fontSize: 20, marginBottom: Spacing.xs },
  cityName: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  cityCountry: {
    fontSize: Typography.labelMedium,
    color: Colors.textSecondary,
  },
  tipsList: { gap: Spacing.sm, marginBottom: Spacing.xl },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.soft,
  },
  tipIcon: { fontSize: 28 },
  tipTitle: {
    fontSize: Typography.bodyLarge,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  tipDesc: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
  },
  tipArrow: {
    fontSize: 24,
    color: Colors.textTertiary,
  },
  comingSoon: {
    alignItems: 'center',
    padding: Spacing.xxl,
    marginTop: Spacing.lg,
  },
  comingSoonIcon: { fontSize: 40, marginBottom: Spacing.sm },
  comingSoonText: {
    fontSize: Typography.bodyMedium,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});
