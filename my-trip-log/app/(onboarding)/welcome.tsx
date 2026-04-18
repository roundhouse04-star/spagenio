import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Typography, Spacing, Fonts } from '@/theme/theme';
import { haptic } from '@/utils/haptics';

export default function WelcomeScreen() {
  const handleStart = () => {
    haptic.medium();
    router.push('/(onboarding)/nickname');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>SPAGENIO PRESENTS</Text>
        <Text style={styles.title}>My Trip Log</Text>
        <Text style={styles.subtitle}>
          모든 여행은{'\n'}한 권의 책이 됩니다
        </Text>
        <View style={styles.divider} />
        <Text style={styles.body}>
          개인 여행 기록을{'\n'}
          품격 있게 보관하세요.
        </Text>
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
    marginBottom: Spacing.xl,
  },
  title: {
    fontFamily: Fonts.display,             // ← Playfair Display Bold
    fontSize: Typography.displayLarge + 8, // 살짝 더 크게 (44)
    color: Colors.textPrimary,
    letterSpacing: Typography.letterSpacingTight,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.bodyKrMedium,
    fontSize: Typography.titleLarge,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.titleLarge * 1.5,
    marginBottom: Spacing.xxxl,
  },
  divider: {
    width: 50,
    height: 1,
    backgroundColor: Colors.accent,
    marginBottom: Spacing.xl,
  },
  body: {
    fontFamily: Fonts.bodyKr,
    fontSize: Typography.bodyMedium,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: Typography.bodyMedium * 1.7,
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
    fontFamily: Fonts.bodyEnBold,         // ← Inter Bold
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
