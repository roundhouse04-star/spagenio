import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Typography, Spacing } from '@/theme/theme';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>MY TRIP LOG</Text>
          <Text style={styles.title}>당신의{'\n'}여행을 기록하세요</Text>
          <Text style={styles.subtitle}>
            모든 여행의 순간을{'\n'}당신의 기기에 안전하게 보관합니다
          </Text>
        </View>

        <View style={styles.features}>
          <Feature icon="📖" title="나만의 여행 일기" desc="사진과 함께 추억을 기록" />
          <Feature icon="🗺️" title="스마트 플래너" desc="일정과 비용을 한눈에" />
          <Feature icon="🔒" title="완전한 프라이버시" desc="모든 데이터는 기기에만" />
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/(onboarding)/nickname')}
        >
          <Text style={styles.primaryButtonText}>시작하기</Text>
        </Pressable>
        <Text style={styles.footerNote}>
          가입 후 별도의 로그인은 필요하지 않습니다
        </Text>
      </View>
    </SafeAreaView>
  );
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <View style={styles.feature}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.huge,
  },
  hero: {
    marginBottom: Spacing.giant,
  },
  eyebrow: {
    fontSize: Typography.labelMedium,
    color: Colors.accent,
    letterSpacing: Typography.letterSpacingExtraWide,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.displayMedium,
    color: Colors.textOnPrimary,
    fontWeight: '700',
    lineHeight: Typography.displayMedium * 1.2,
    marginBottom: Spacing.lg,
  },
  subtitle: {
    fontSize: Typography.bodyLarge,
    color: 'rgba(250, 248, 243, 0.7)',
    lineHeight: Typography.bodyLarge * 1.5,
  },
  features: {
    gap: Spacing.xl,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  featureIcon: {
    fontSize: 32,
    width: 48,
    textAlign: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: Typography.bodyLarge,
    color: Colors.textOnPrimary,
    fontWeight: '600',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: Typography.bodySmall,
    color: 'rgba(250, 248, 243, 0.6)',
  },
  footer: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.lg,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.primary,
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footerNote: {
    fontSize: Typography.labelSmall,
    color: 'rgba(250, 248, 243, 0.5)',
    textAlign: 'center',
  },
});
