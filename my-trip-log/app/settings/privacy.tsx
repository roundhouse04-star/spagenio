import { useMemo } from 'react';
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
        <Text style={styles.lastUpdated}>시행일: 2026년 4월 24일</Text>

        <Text style={styles.intro}>
          Triplive는 사용자의 개인정보를 소중히 여기며, 서비스 제공에 필요한 최소한의 정보만 수집합니다.
          모든 여행 데이터는 기본적으로 사용자 기기에만 저장되며, 외부로 전송되지 않습니다.
        </Text>

        <Section title="1. 수집하는 정보" styles={styles}>
          {`[기기 내 저장 정보 (외부 전송 없음)]
• 닉네임, 국적
• 여행 기록 (제목, 내용, 사진, 위치)
• 비용 및 예산 정보
• 체크리스트, 일정
• 영수증 사진 및 OCR 인식 텍스트

[iCloud / Google Drive 자동 백업]
• 사용자의 기기 설정에 따라 위 데이터가 OS 기본 백업에 포함될 수 있습니다.
• Triplive는 별도의 백업 서버를 운영하지 않습니다.

[선택적 익명 통계 (동의 시에만)]
• 익명 UUID (개인 식별 불가)
• OS 종류 및 버전, 앱 버전, 기기 언어
• 가입일, 마지막 접속일
• 여행/기록 개수 (내용은 전송하지 않음)

[광고 식별자 (광고 동의 시)]
• iOS: IDFA (추적 허용 시에만)
• Android: 광고 ID (재설정/거부 가능)`}
        </Section>

        <Section title="2. 개인정보의 저장 및 이용" styles={styles}>
          {`• 대부분의 데이터는 사용자 기기의 로컬 DB(SQLite)에만 저장됩니다.
• 익명 통계 동의 시, 식별 불가능한 집계 데이터만 개발자가 운영하는 서버에 저장됩니다.
• 서버 데이터는 앱 개선, 기능 우선순위 결정, 지역별 사용 현황 분석에만 사용됩니다.
• 여행 기록, 사진, 영수증 등 개인 콘텐츠는 절대 외부 서버로 전송되지 않습니다.`}
        </Section>

        <Section title="3. 외부 서비스" styles={styles}>
          {`본 앱은 다음 외부 서비스를 제한적으로 이용합니다:

[환율 정보]
• frankfurter.dev: 실시간 환율 조회 (개인정보 전송 없음)

[장소 검색]
• OpenStreetMap Nominatim: 일정에 추가할 장소명 자동완성 (사용자 입력 텍스트만 전송, 개인 식별 정보 없음)

[AI 일정 생성 — 외부 앱 딥링크]
• 본 앱은 AI 서버에 직접 데이터를 전송하지 않습니다.
• "AI에 질문하기" 버튼은 사용자의 기기에 설치된 ChatGPT / Gemini / Claude 앱을 외부에서 열어주는 역할만 합니다.
• 외부 AI 앱에서 발생하는 데이터 처리는 해당 앱의 정책을 따르며, 본 앱은 그 과정에 관여하지 않습니다.

[영수증·티켓 OCR — 온디바이스]
• 영수증/티켓 텍스트 인식은 기기 내부의 ML Kit 라이브러리만 사용합니다.
• 이미지가 외부 서버로 전송되지 않습니다.
• 향후 유료 버전에서 인식률 보강을 위해 외부 OCR 서비스가 도입될 수 있으며, 도입 시 본 방침이 갱신되고 사용자 재동의를 받습니다.

[광고 — Google AdMob]
• 무료 사용자에게는 Google AdMob 배너 광고가 표시됩니다.
• AdMob은 광고 식별자(IDFA / Android Advertising ID)를 사용하여 광고를 제공합니다.
• iOS 14.5 이상: 앱 시작 시 추적 권한 다이얼로그가 표시됩니다. 거부해도 앱 사용에 제한이 없으며, 비개인화된 일반 광고가 표시됩니다.
• 광고 추적 거부 방법:
  - iOS: 설정 > 개인정보 보호 > 추적
  - Android: 설정 > Google > 광고 > 광고 ID 재설정 / 맞춤 광고 사용 안 함
• Google 개인정보 처리방침: https://policies.google.com/privacy
• Triplive PRO 결제 시 광고가 표시되지 않습니다 (출시 예정).

[도시 이미지]
• 탐색 화면의 도시 대표 사진은 Wikipedia REST API를 통해 위키미디어 커먼즈에서 제공받습니다.
• 대부분의 사진은 Creative Commons BY-SA 4.0 또는 Public Domain 라이선스를 따르며, 앱 내에서 출처(Wikipedia · CC BY-SA)를 표기합니다.
• 이미지 로드 시 위키피디아 서버에 일반적인 HTTP 요청 정보(IP·User-Agent)가 전송될 수 있습니다.

[지도·지하철 외부 링크]
• 지도 보기/길찾기는 사용자의 기기에 설치된 구글 지도 앱(또는 브라우저)을 외부에서 호출합니다.
• 지하철 노선도 카드는 각 도시 운영사의 공식 페이지를 외부 브라우저에서 엽니다.
• 외부 앱·페이지에서 발생하는 데이터 처리는 해당 서비스의 정책을 따릅니다.

[글꼴]
• Google Fonts (CDN): 글꼴 로딩 시 IP 주소가 Google에 전송될 수 있습니다.

[일정 공유 (사용자 간 P2P)]
• 사용자가 [공유] 버튼을 누른 경우에만 작동합니다.
• QR 코드 또는 링크 형태로 여행 정보(제목, 날짜, 도시, 일정 25개 등)가 디바이스 화면 또는 카톡·문자 등 사용자가 직접 선택한 채널로 전달됩니다.
• 본 앱은 외부 서버를 거치지 않습니다 (P2P 방식 — 사용자 간 직접 전달).
• 닉네임, 이메일, 디바이스 식별자, 실제 사용 비용, 영수증 사진, 일기는 절대 포함되지 않습니다.
• 예산·예상 비용은 사용자 토글 선택 시에만 포함됩니다.
• 공유받는 사람도 Triplive 앱 설치가 필요합니다.`}
        </Section>

        <Section title="4. 제3자 제공" styles={styles}>
          {`개발자는 어떠한 경우에도 사용자의 개인 콘텐츠(여행 기록, 사진, 비용 정보 등)를 제3자에게 제공하거나 판매하지 않습니다.

단, 아래의 경우는 예외입니다:
• 법령에 따라 수사기관의 적법한 요청이 있는 경우
• 사용자가 명시적으로 동의한 경우`}
        </Section>

        <Section title="5. 이용자의 권리" styles={styles}>
          {`• 언제든지 앱 내에서 모든 데이터를 삭제할 수 있습니다 ([내 정보] → [데이터 초기화])
• 데이터를 JSON 파일로 내보낼 수 있습니다 ([내 정보] → [데이터 내보내기])
• 익명 통계 수집 동의를 언제든지 철회할 수 있습니다
• 앱 삭제 시 로컬 데이터는 즉시 제거됩니다 (iCloud 백업이 활성화된 경우 별도 삭제 필요)
• 광고 추적을 iOS/Android 설정에서 거부할 수 있습니다`}
        </Section>

        <Section title="6. 데이터 보관 기간" styles={styles}>
          {`• 로컬 데이터: 사용자가 삭제하거나 앱을 제거할 때까지
• 서버 익명 통계: 사용자 요청 시 즉시 삭제 (익명 UUID 필요)
• 영수증·티켓 OCR: 기기 내부 처리만 수행 (외부 전송 없음)
• AI 일정 생성: 외부 AI 앱(ChatGPT 등) 딥링크 방식이라 본 앱은 데이터를 보관하지 않으며, 외부 앱 측 데이터는 해당 앱 정책을 따름
• 광고 식별자: Google AdMob 정책에 따라 처리 (https://policies.google.com/privacy)`}
        </Section>

        <Section title="7. 만 14세 미만 이용자" styles={styles}>
          {`본 앱은 만 14세 미만의 아동을 대상으로 하지 않습니다.
만 14세 미만의 이용자는 법정대리인의 동의 없이 본 서비스를 이용할 수 없습니다.
만 14세 미만 이용자가 발견될 경우, 관련 데이터는 즉시 삭제됩니다.`}
        </Section>

        <Section title="8. 개인정보 보호책임자" styles={styles}>
          {`• 개발자: 이태호
• 연락처: spagenio.official@gmail.com

개인정보 관련 문의, 데이터 삭제 요청, 광고 관련 문의 등은
위 이메일로 연락 주시기 바랍니다.

데이터 삭제 요청 시, 익명 UUID를 함께 알려주시면 신속히 처리해 드립니다.`}
        </Section>

        <Section title="9. 방침 변경 고지" styles={styles}>
          {`본 개인정보처리방침이 변경될 경우, 앱 업데이트 또는 앱 내 공지를 통해 안내드립니다.
중대한 변경(새로운 정보 수집, 제3자 제공 등)의 경우 사전 고지 후 사용자 동의를 다시 받습니다.`}
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
