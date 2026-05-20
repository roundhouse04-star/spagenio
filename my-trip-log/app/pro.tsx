/**
 * Triplive PRO 결제 화면
 *
 * ⚠️ 사업자등록 완료 전까지 결제 기능 비활성화 (연말 재활성화 예정)
 *
 * 원본 결제 UI 는 git history 에 보존되어 있어요.
 * 재활성화 시 이 파일을 git revert 하거나 백업해둔 원본으로 교체하면 됩니다.
 *
 * 현재는 진입 경로(me.tsx · AdBanner) 가 모두 막혀있지만,
 * 만약 외부 deep link / 북마크로 들어오는 사용자가 있을 수 있어
 * "준비 중" 안내 화면만 표시합니다.
 */
import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';

import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';

export default function ProScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <>
      <Stack.Screen
        options={{ title: 'Triplive PRO', headerBackTitle: '뒤로' }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.center}>
          <Text style={styles.icon}>🛠️</Text>
          <Text style={styles.title}>준비 중이에요</Text>
          <Text style={styles.desc}>
            Triplive PRO 는 현재 준비 중입니다.{'\n'}
            곧 더 좋은 모습으로 찾아뵐게요!
          </Text>
          <Pressable
            style={styles.btn}
            onPress={() => { haptic.tap(); router.back(); }}
          >
            <Text style={styles.btnText}>돌아가기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    icon: { fontSize: 64, marginBottom: Spacing.lg },
    title: {
      fontSize: Typography.titleLarge,
      fontWeight: '800',
      color: c.textPrimary,
      marginBottom: Spacing.md,
    },
    desc: {
      fontSize: Typography.bodyMedium,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: Typography.bodyMedium * 1.6,
      marginBottom: Spacing.xxl,
    },
    btn: {
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xxl,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.border,
      ...Shadows.sm,
    },
    btnText: {
      fontSize: Typography.bodyMedium,
      fontWeight: '700',
      color: c.textPrimary,
    },
  });
}
