import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Typography, Spacing } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';

export default function TermsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>이용약관</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.lastUpdated}>최종 수정: 2026년 4월 19일</Text>

        <Section title="제 1조 (목적)" styles={styles}>
          본 약관은 My Trip Log 앱(이하 "앱")의 사용 방법, 이용자의 권리와 의무,
          개발자의 책임 범위를 명시합니다.
        </Section>

        <Section title="제 2조 (앱의 성격)" styles={styles}>
          {`• 본 앱은 사용자의 개인 여행 정보를 기록하는 도구입니다.
• 모든 데이터는 사용자 기기의 로컬 저장소에만 저장됩니다.
• 사용자의 명시적 동의 없이 외부 서버로 개인 데이터가 전송되지 않습니다.
• 익명 통계 수집에 동의한 경우, 식별 불가능한 집계 데이터만 전송됩니다.`}
        </Section>

        <Section title="제 3조 (데이터의 소유권)" styles={styles}>
          {`• 모든 여행 기록, 사진, 비용 데이터의 소유권은 전적으로 사용자에게 있습니다.
• 사용자는 언제든지 데이터를 내보내거나 완전히 삭제할 수 있습니다.
• 앱 삭제 시 모든 로컬 데이터가 제거됩니다.`}
        </Section>

        <Section title="제 4조 (외부 서비스)" styles={styles}>
          {`본 앱은 다음 외부 서비스를 사용합니다:
• 환율 API (frankfurter.dev): 실시간 환율 조회
• 이미지 저장은 기기 내부에만 이루어집니다
• 지도 링크 클릭 시 기기의 지도 앱으로 이동합니다`}
        </Section>

        <Section title="제 5조 (면책 조항)" styles={styles}>
          {`• 본 앱은 "있는 그대로" 제공되며 명시적이거나 묵시적인 보증을 하지 않습니다.
• 환율 정보의 정확성은 외부 API에 의존하며, 실제 환전 시 차이가 있을 수 있습니다.
• 교통 정보는 참고용이며 실제 운행 상황과 다를 수 있습니다.`}
        </Section>

        <Section title="제 6조 (문의)" styles={styles}>
          앱 사용 중 문의사항은 roundhouse04@gmail.com 으로 연락주시기 바랍니다.
        </Section>

        <View style={{ height: Spacing.huge }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children, styles }: {
  title: string;
  children: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={{ marginBottom: Spacing.xl }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
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
  scroll: { padding: Spacing.xl },
  lastUpdated: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    marginBottom: Spacing.xxl,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: Typography.titleSmall,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: Spacing.sm,
  },
  sectionBody: {
    fontSize: Typography.bodyMedium,
    color: c.textSecondary,
    lineHeight: Typography.bodyMedium * 1.7,
  },
});
}
