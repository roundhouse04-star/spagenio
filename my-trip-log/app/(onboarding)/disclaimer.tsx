import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Typography, Spacing, Fonts } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { DisclaimerContent } from '@/components/DisclaimerContent';

export default function OnboardingDisclaimerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>면책 조항 자세히</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>DISCLAIMER</Text>
        <Text style={styles.title}>책임의 한계를{'\n'}확인해주세요</Text>
        <Text style={styles.subtitle}>
          본 내용을 모두 읽고 약관 화면으로 돌아가 동의해주세요
        </Text>

        <View style={styles.divider} />

        <DisclaimerContent />
        <View style={{ height: Spacing.huge }} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => { haptic.medium(); router.back(); }}
        >
          <Text style={styles.primaryButtonText}>확인했어요</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backText: { fontSize: 22, color: c.textPrimary },
    headerTitle: {
      fontSize: Typography.bodyLarge,
      fontWeight: '700',
      color: c.textPrimary,
    },
    scroll: { padding: Spacing.xxl },
    eyebrow: {
      fontFamily: Fonts.bodyEnSemiBold,
      fontSize: Typography.labelSmall,
      color: c.accent,
      letterSpacing: Typography.letterSpacingExtraWide,
      marginBottom: Spacing.md,
    },
    title: {
      fontFamily: Fonts.bodyKrBold,
      fontSize: Typography.displaySmall,
      color: c.textPrimary,
      marginBottom: Spacing.sm,
      lineHeight: Typography.displaySmall * 1.3,
    },
    subtitle: {
      fontFamily: Fonts.bodyKr,
      fontSize: Typography.bodyMedium,
      color: c.textSecondary,
      marginBottom: Spacing.xl,
      lineHeight: Typography.bodyMedium * 1.6,
    },
    divider: {
      height: 1,
      backgroundColor: c.border,
      marginBottom: Spacing.xl,
    },
    footer: {
      padding: Spacing.xxl,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    primaryButton: {
      backgroundColor: c.primary,
      paddingVertical: Spacing.lg,
      borderRadius: 14,
      alignItems: 'center',
    },
    primaryButtonText: {
      fontFamily: Fonts.bodyEnBold,
      color: c.textOnPrimary,
      fontSize: Typography.bodyLarge,
      letterSpacing: 0.5,
    },
  });
}
