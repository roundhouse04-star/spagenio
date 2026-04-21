import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Typography, Spacing } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';

export default function PrivacyScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>개인정보처리방침</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.lastUpdated}>최종 수정: 2026년 4월 19일</Text>

        <Text style={styles.intro}>
          My Trip Log는 사용자의 개인정보를 소중히 여기며, 최소한의 정보만 수집합니다.
        </Text>

        <Section title="1. 수집하는 정보">
          {`[기기 내 저장 정보 (외부 전송 없음)]
• 닉네임, 국적
• 여행 기록 (제목, 내용, 사진, 위치)
• 비용 및 예산 정보
• 체크리스트

[선택적 익명 통계 (동의 시에만)]
• 익명 UUID (개인 식별 불가)
• OS 종류 및 버전
• 앱 버전, 기기 언어
• 가입일, 마지막 접속일
• 여행/기록 개수 (내용은 절대 전송 안 됨)`}
        </Section>

        <Section title="2. 개인정보의 저장">
          {`• 대부분의 데이터는 사용자 기기의 로컬 DB(SQLite)에만 저장됩니다.
• 익명 통계에 동의한 경우, 위 정보는 spagenio 서버에 저장됩니다.
• 서버 저장 데이터는 개인을 식별할 수 없는 익명 정보입니다.`}
        </Section>

        <Section title="3. 개인정보의 사용">
          {`익명 통계 정보는 다음 목적으로만 사용됩니다:
• 앱 사용 현황 파악
• 기능 개선 우선순위 결정
• 지역별 사용자 분포 분석`}
        </Section>

        <Section title="4. 제3자 제공 및 외부 서비스">
          {`[개인정보 제공]
• 어떠한 경우에도 사용자 개인정보를 제3자에게 제공하지 않습니다.

[외부 서비스 이용]
• frankfurter.dev: 환율 정보 조회 (개인정보 전송 없음)
• Google Fonts: 폰트 로딩 (CDN, 개인정보 전송 없음)`}
        </Section>

        <Section title="5. 이용자의 권리">
          {`• 언제든지 앱에서 모든 데이터를 삭제할 수 있습니다
• 데이터를 JSON 파일로 내보낼 수 있습니다
• 익명 통계 동의를 언제든지 철회할 수 있습니다
• 앱 삭제 시 로컬 데이터는 즉시 제거됩니다`}
        </Section>

        <Section title="6. 데이터 보관 기간">
          {`• 로컬 데이터: 사용자가 삭제하거나 앱 제거 시까지
• 서버 익명 데이터: 익명 ID 기준, 사용자 요청 시 즉시 삭제`}
        </Section>

        <Section title="7. 개인정보 보호책임자">
          {`개인정보 관련 문의: roundhouse04@gmail.com

사용자의 권리 행사 (데이터 삭제 등) 요청 시,
위 이메일로 익명 UUID와 함께 요청 주시기 바랍니다.`}
        </Section>

        <View style={{ height: Spacing.huge }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: string }) {
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
    marginBottom: Spacing.md,
    fontStyle: 'italic',
  },
  intro: {
    fontSize: Typography.bodyMedium,
    color: c.textPrimary,
    fontWeight: '600',
    lineHeight: Typography.bodyMedium * 1.6,
    marginBottom: Spacing.xxl,
    padding: Spacing.lg,
    backgroundColor: c.surfaceAlt,
    borderRadius: 12,
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
