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
        <Text style={styles.lastUpdated}>시행일: 2026년 4월 24일</Text>

        <Section title="제 1조 (목적)" styles={styles}>
          {`본 약관은 Spagenio 앱(이하 "앱")을 이용하는 사용자와 개발자 간의 권리, 의무, 책임 및 서비스 이용 조건을 규정함을 목적으로 합니다.`}
        </Section>

        <Section title="제 2조 (용어의 정의)" styles={styles}>
          {`1. "앱"이란 Spagenio라는 이름으로 제공되는 모바일 애플리케이션을 말합니다.
2. "사용자"란 본 앱을 설치하고 이용하는 자를 말합니다.
3. "개발자"란 본 앱을 개발·운영하는 개인(이태호)을 말합니다.
4. "콘텐츠"란 사용자가 앱에 입력하거나 생성한 여행 기록, 사진, 비용 정보, 체크리스트 등을 말합니다.`}
        </Section>

        <Section title="제 3조 (앱의 성격)" styles={styles}>
          {`• 본 앱은 사용자의 개인 여행 정보를 기록·관리하는 개인용 도구입니다.
• 모든 개인 콘텐츠는 사용자 기기의 로컬 저장소에 저장되며, 외부 서버로 자동 전송되지 않습니다.
• 사용자의 동의 없이 개인 콘텐츠가 외부로 전송되지 않습니다.
• 익명 통계 수집에 동의한 경우, 식별 불가능한 집계 데이터만 전송됩니다.`}
        </Section>

        <Section title="제 4조 (콘텐츠의 소유권)" styles={styles}>
          {`• 사용자가 앱에 입력하거나 생성한 모든 콘텐츠의 소유권은 전적으로 사용자에게 있습니다.
• 개발자는 사용자의 콘텐츠에 대한 어떠한 권리도 주장하지 않습니다.
• 사용자는 언제든지 콘텐츠를 내보내거나 완전히 삭제할 수 있습니다.
• 앱 삭제 시 모든 로컬 데이터가 기기에서 제거됩니다. (iCloud/Google 백업이 활성화된 경우 별도 삭제 필요)`}
        </Section>

        <Section title="제 5조 (외부 서비스 이용)" styles={styles}>
          {`본 앱은 다음 외부 서비스를 제한적으로 사용합니다:

• 환율 API (frankfurter.dev): 실시간 환율 조회 (무료 공개 API)
• 장소 검색 (OpenStreetMap Nominatim): 일정 장소 자동완성 (무료 공개 API)
• Google Fonts: 앱 글꼴 로딩 (무료 CDN)
• iCloud / Google Drive: OS 기본 백업 (사용자 설정에 따름)

본 앱은 OpenAI / Anthropic / Google AI 등 AI 서버에 직접 데이터를 전송하지 않습니다.
"AI에 질문하기" 기능은 사용자의 기기에 설치된 ChatGPT / Gemini / Claude 앱을 외부에서 열어주는 역할만 합니다.

영수증·티켓 OCR은 기기 내부 ML Kit 라이브러리만 사용하며, 이미지가 외부로 전송되지 않습니다.
향후 유료 버전에서 외부 OCR 서비스 또는 광고 서비스가 도입될 수 있으며,
도입 시 약관 갱신 후 사용자 재동의를 받습니다.

자세한 내용은 [개인정보처리방침]을 참고해 주십시오.`}
        </Section>

        <Section title="제 6조 (광고)" styles={styles}>
          {`• 본 앱은 무료 사용자에게 Google AdMob 배너 광고를 표시합니다.
• 광고 수익은 앱 운영·서버 비용 충당에 사용됩니다.
• iOS 14.5 이상 사용자는 추적 권한 동의 시 맞춤 광고가 표시되며, 거부 시 일반 광고가 표시됩니다 (앱 사용에 제한 없음).
• 광고 추적은 iOS 설정 > 개인정보 보호 > 추적, Android 설정 > Google > 광고에서 언제든 변경 가능합니다.
• 향후 출시 예정인 Spagenio PRO 결제 시 광고 없이 사용 가능합니다.`}
        </Section>

        <Section title="제 7조 (사용자의 의무)" styles={styles}>
          {`사용자는 다음 행위를 해서는 안 됩니다:
• 앱을 역공학(reverse engineering), 디컴파일, 분해하는 행위
• 앱의 소스 코드나 데이터베이스를 무단으로 추출·배포하는 행위
• 타인의 개인정보, 저작권 등 권리를 침해하는 콘텐츠를 기록하는 행위
• 본 앱을 불법적인 목적으로 이용하는 행위
• 앱의 정상적인 운영을 방해하는 행위`}
        </Section>

        <Section title="제 8조 (만 14세 미만 이용자)" styles={styles}>
          {`본 앱은 만 14세 미만의 이용자를 대상으로 하지 않습니다.
만 14세 미만의 이용자는 법정대리인의 동의 없이 본 서비스를 이용할 수 없습니다.`}
        </Section>

        <Section title="제 9조 (면책 조항)" styles={styles}>
          {`• 본 앱은 "있는 그대로(AS IS)" 제공되며, 명시적이거나 묵시적인 어떠한 보증도 하지 않습니다.
• 환율 정보, 교통 정보, AI가 생성한 일정 등은 참고용이며 정확성을 보증하지 않습니다.
• 개발자는 앱 사용으로 인해 발생한 직·간접적 손해(데이터 손실, 금전적 손실 등)에 대해 책임을 지지 않습니다.
• 사용자는 중요한 데이터를 수시로 백업할 것을 권장합니다.
• 외부 서비스(환율, OCR, AI 등)의 장애나 오류에 대해 개발자는 책임지지 않습니다.`}
        </Section>

        <Section title="제 10조 (서비스 중단)" styles={styles}>
          {`• 개발자는 기술적 사유, 운영상 판단 등으로 서비스를 변경하거나 중단할 수 있습니다.
• 서비스 중단 시 사전에 앱 내 공지 또는 업데이트를 통해 안내합니다.
• 서비스 중단이 임박한 경우 사용자가 데이터를 내보낼 수 있도록 충분한 기간을 제공합니다.`}
        </Section>

        <Section title="제 11조 (약관의 변경)" styles={styles}>
          {`• 개발자는 필요 시 본 약관을 변경할 수 있습니다.
• 변경된 약관은 앱 업데이트 또는 앱 내 공지를 통해 안내됩니다.
• 중대한 변경의 경우 사전 고지 후 사용자의 재동의를 받습니다.`}
        </Section>

        <Section title="제 12조 (준거법 및 분쟁 해결)" styles={styles}>
          {`• 본 약관은 대한민국 법령에 따라 해석됩니다.
• 앱 이용과 관련한 분쟁은 먼저 당사자 간 성실히 협의하여 해결합니다.
• 협의가 이루어지지 않을 경우, 대한민국 법원을 관할 법원으로 합니다.`}
        </Section>

        <Section title="제 13조 (문의)" styles={styles}>
          {`• 개발자: 이태호
• 이메일: roundhouse04@gmail.com

앱 사용 관련 문의, 버그 제보, 기능 제안 등은 위 이메일로 연락 주시기 바랍니다.`}
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
