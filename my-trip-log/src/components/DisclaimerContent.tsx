import { View, Text, StyleSheet } from 'react-native';
import { Typography, Spacing } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { useMemo } from 'react';

/**
 * 면책조항 본문 — 온보딩/설정 양쪽에서 재사용.
 * 자체 스크롤 컨테이너는 포함하지 않음 (호출 측에서 ScrollView 감쌈).
 */
export function DisclaimerContent() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View>
      <Text style={styles.lastUpdated}>시행일: 2026년 4월 28일</Text>

      <Text style={styles.intro}>
        Triplive(이하 &ldquo;앱&rdquo;)을 사용하기 전에 아래 내용을 반드시 확인해 주세요.
        본 앱은 개인이 운영하는 무료 도구로, 서비스 사용에 따른 책임 한계를 명확히 하기 위해 면책 조항을 둡니다.
      </Text>

      <Section title="1. 서비스 제공의 한계" styles={styles}>
        {`• 본 앱은 "있는 그대로(AS IS)" 무상 제공되며, 명시적이거나 묵시적인 어떠한 보증도 하지 않습니다.
• 앱의 기능이 사용자의 특정 목적에 부합한다거나 오류가 없음을 보증하지 않습니다.
• 정기적인 점검·업데이트가 보장되지 않으며, 사전 고지 후 서비스가 중단될 수 있습니다.`}
      </Section>

      <Section title="2. 외부 정보의 정확성" styles={styles}>
        {`본 앱이 표시하는 다음 정보는 참고용이며, 실제와 다를 수 있습니다:

• 환율 정보 (frankfurter.dev) — 거래에 사용되는 실시간 시세가 아닙니다
• 교통 정보 (지하철 노선도/경로) — 실제 운행 시간·요금과 차이가 있을 수 있습니다
• 외부 AI 앱(ChatGPT 등)에서 받아온 여행 일정 — 추천일 뿐 실제 운영·예약 정보가 아닙니다
• OCR로 인식된 영수증·티켓 텍스트 — 인식 오류가 있을 수 있습니다 (기기 내 ML Kit로 처리)

위 정보를 기반으로 한 의사결정은 사용자가 직접 검증한 후 진행해 주십시오.`}
      </Section>

      <Section title="3. 데이터 손실 책임" styles={styles}>
        {`• 모든 여행 기록·사진·비용 데이터는 사용자의 기기 로컬 저장소에 저장됩니다.
• 앱 삭제, 기기 분실·파손, OS 업데이트, 사용자의 잘못된 조작 등으로 인한 데이터 손실에 대해 개발자는 책임지지 않습니다.
• 사용자는 [내 정보] → [데이터 내보내기] 기능으로 정기적인 백업을 권장합니다.
• iCloud / Google Drive 자동 백업은 OS 정책에 따라 동작하며, 백업 성공·복원을 개발자가 보증하지 않습니다.`}
      </Section>

      <Section title="4. 사용자 책임" styles={styles}>
        {`• 앱에 입력하는 콘텐츠(여행 기록, 사진, 비용 등)의 적법성·정확성은 사용자에게 있습니다.
• 타인의 개인정보·저작권을 침해하는 콘텐츠를 기록해서는 안 됩니다.
• 앱을 통해 얻은 정보의 활용 결과는 전적으로 사용자의 책임입니다.
• 영수증·여권·신분증 등 민감 정보 보관 시 사용자가 보안에 주의해야 합니다.`}
      </Section>

      <Section title="5. 외부 서비스 장애" styles={styles}>
        {`본 앱은 다음 외부 서비스를 제한적으로 이용하며, 이들의 장애·정책 변경·종료로 일부 기능이 작동하지 않을 수 있습니다. 외부 서비스 장애에 대해 개발자는 책임지지 않습니다.

• frankfurter.dev (환율 — 무료 공개 API)
• OpenStreetMap Nominatim (장소 검색 — 무료 공개 API)
• Google Fonts (글꼴 — 무료 CDN)
• Apple iCloud / Google Drive (OS 백업)
• 사용자 기기에 설치된 외부 AI 앱 (ChatGPT / Gemini / Claude 등 — 본 앱은 딥링크로 열기만 함)

영수증·티켓 OCR은 기기 내부 ML Kit 라이브러리만 사용하며 외부 서버에 의존하지 않습니다.`}
      </Section>

      <Section title="6. 손해배상의 한계" styles={styles}>
        {`관련 법률이 허용하는 최대 한도 내에서, 개발자는 다음에 대해 책임지지 않습니다:

• 직접·간접·부수적·결과적 손해 (데이터 손실, 영업 손실, 금전적 손실 등)
• 앱 사용 또는 사용 불가로 발생한 모든 손실
• 본 앱이 표시한 정보의 부정확성으로 인한 손실
• 제3자 서비스 이용에서 발생하는 분쟁 또는 손실`}
      </Section>

      <Section title="7. 분쟁 해결" styles={styles}>
        {`• 본 면책 조항은 대한민국 법률에 따라 해석됩니다.
• 분쟁 발생 시 먼저 당사자 간 성실히 협의합니다.
• 협의가 성립하지 않을 경우 대한민국 법원을 관할 법원으로 합니다.`}
      </Section>

      <Section title="8. 동의 철회" styles={styles}>
        {`• 본 면책 조항에 동의하지 않는 경우 앱을 사용하실 수 없습니다.
• 사용 중 동의를 철회하시려면 앱을 삭제하시기 바랍니다.
• 앱 삭제 시 로컬 데이터는 즉시 제거됩니다.`}
      </Section>

      <Section title="9. 문의" styles={styles}>
        {`• 개발자: 이태호
• 이메일: spagenio.official@gmail.com

본 면책 조항에 관한 문의는 위 이메일로 연락 주시기 바랍니다.`}
      </Section>
    </View>
  );
}

function Section({
  title,
  children,
  styles,
}: {
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
