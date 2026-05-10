import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Typography, Spacing, Fonts } from '@/theme/theme';
import { haptic } from '@/utils/haptics';

function Feature({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

export default function WelcomeScreen() {
  const handleStart = () => {
    haptic.medium();
    router.push('/(onboarding)/nickname');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>TRAVEL JOURNAL</Text>
        <Text style={styles.brand}>Triplive</Text>
        <Text style={styles.productName}>여행 기록</Text>
        <View style={styles.divider} />
        <Text style={styles.subtitle}>
          모든 여행은{'\n'}한 권의 책이 됩니다
        </Text>
        <Text style={styles.body}>
          개인 여행 기록을{'\n'}
          품격 있게 보관하세요.
        </Text>

        <View style={styles.features}>
          <Feature icon="📔" label="기록·일정·체크리스트" />
          <Feature icon="💰" label="비용·영수증 OCR" />
          <Feature icon="🌍" label="46도시 추천 장소" />
          <Feature icon="📊" label="여행 통계·회고" />
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.primaryButton} onPress={handleStart}>
          <Text style={styles.primaryButtonText}>시작하기</Text>
        </Pressable>
        <Text style={styles.note}>
          오프라인 우선 · 광고 없음 · 데이터 소유권 100% 본인
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  hero: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: Fonts.bodyEnSemiBold,
    fontSize: Typography.labelSmall,
    color: Colors.accent,
    letterSpacing: Typography.letterSpacingExtraWide,
    marginBottom: Spacing.lg,
  },
  // Triplive - 큰 브랜드명 (타이틀 포지션)
  brand: {
    fontFamily: Fonts.display,             // Playfair Display Bold
    fontSize: Typography.displayLarge + 12, // 48
    color: Colors.textPrimary,
    letterSpacing: Typography.letterSpacingTight,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  // 여행 기록 - 작은 서브타이틀
  productName: {
    fontFamily: Fonts.bodyEnMedium,        // Inter Medium
    fontSize: Typography.titleMedium,      // 18
    color: Colors.textSecondary,
    letterSpacing: Typography.letterSpacingWide,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  divider: {
    width: 50,
    height: 1,
    backgroundColor: Colors.accent,
    marginBottom: Spacing.xl,
  },
  subtitle: {
    fontFamily: Fonts.bodyKrMedium,
    fontSize: Typography.titleLarge,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: Typography.titleLarge * 1.5,
    marginBottom: Spacing.xxl,
  },
  body: {
    fontFamily: Fonts.bodyKr,
    fontSize: Typography.bodyMedium,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: Typography.bodyMedium * 1.7,
  },
  features: {
    marginTop: Spacing.xl,
    gap: Spacing.sm,
    alignSelf: 'stretch',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  featureIcon: { fontSize: 22 },
  featureLabel: {
    fontFamily: Fonts.bodyKr,
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  footer: {
    padding: Spacing.xxl,
    paddingBottom: Spacing.xxxl,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  primaryButtonText: {
    fontFamily: Fonts.bodyEnBold,
    color: Colors.textOnPrimary,
    fontSize: Typography.bodyLarge,
    letterSpacing: 0.5,
  },
  note: {
    fontFamily: Fonts.bodyKr,
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});
