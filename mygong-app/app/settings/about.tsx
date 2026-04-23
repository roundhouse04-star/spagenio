/**
 * 앱 정보 화면 (설정 → 앱 정보).
 *
 * 역할:
 *   1. 앱 버전·빌드 정보
 *   2. 데이터 출처 크레딧 (KOPIS · 위키백과)
 *   3. 라이선스 공지 (CC BY-SA 4.0 준수)
 *   4. 개인정보처리방침·이용약관 링크 (앱스토어 심사 필수)
 *
 * 앱스토어 배포 전 필수로 채워야 할 자리:
 *   - PRIVACY_POLICY_URL
 *   - TERMS_OF_SERVICE_URL
 *   - SUPPORT_EMAIL
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, FontSizes, Spacing, Radius } from '@/theme/theme';
import { Divider } from '@/components/UI';

// TODO(배포 전): 실제 URL 로 교체
const PRIVACY_POLICY_URL   = 'https://roundhouse04.github.io/mygong/privacy.html';
const TERMS_OF_SERVICE_URL = 'https://roundhouse04.github.io/mygong/terms.html';
const SUPPORT_EMAIL        = '5ive111@hanmail.net';

const APP_VERSION = '1.0.0';
const APP_BUILD   = '4.2';

export default function AboutScreen() {
  const router = useRouter();

  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('링크를 열 수 없습니다', url);
    }
  };

  const openMail = () => {
    openUrl(`mailto:${SUPPORT_EMAIL}?subject=내공연관리%20문의`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={{ fontSize: 22 }}>‹</Text></Pressable>
        <Text style={styles.navTitle}>앱 정보</Text>
        <View style={{ width: 22 }} />
      </View>
      <Divider />

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}>
        {/* ─── 앱 로고 · 이름 · 버전 ─────────────────────────── */}
        <View style={{ alignItems: 'center', paddingVertical: Spacing.xl }}>
          <Text style={{ fontSize: 56 }}>🎫</Text>
          <Text style={{ fontFamily: Fonts.bold, fontSize: FontSizes.title, marginTop: 8 }}>내공연관리</Text>
          <Text style={{ fontSize: FontSizes.tiny, color: Colors.textSub, marginTop: 4 }}>
            v{APP_VERSION} ({APP_BUILD})
          </Text>
        </View>

        {/* ─── 데이터 출처 ──────────────────────────────────── */}
        <SectionLabel>📚 데이터 출처</SectionLabel>
        <InfoCard>
          <InfoLine
            icon="🎭"
            title="공연 정보"
            desc="공연예술통합전산망(KOPIS)"
            sub="문화체육관광부 · 예술경영지원센터"
          />
          <InfoLine
            icon="📖"
            title="아티스트 프로필"
            desc="위키백과 (CC BY-SA 4.0)"
            sub="콘서트·출연 이력 포함"
          />
        </InfoCard>

        {/* ─── 라이선스 공지 ────────────────────────────────── */}
        <SectionLabel>⚖️ 라이선스 공지</SectionLabel>
        <View style={styles.legalCard}>
          <Text style={styles.legalText}>
            이 앱에 표시되는 아티스트 소개와 출연 이력은 <Text style={{ fontFamily: Fonts.semibold }}>위키백과</Text>의
            콘텐츠를 재가공한 것으로, <Text style={{ fontFamily: Fonts.semibold }}>크리에이티브 커먼즈
            저작자표시-동일조건변경허락 4.0 국제 라이선스 (CC BY-SA 4.0)</Text>에 따라 이용됩니다.
          </Text>
          <Text style={[styles.legalText, { marginTop: 10 }]}>
            공연 정보는 <Text style={{ fontFamily: Fonts.semibold }}>공공데이터포털</Text>을 통해 제공되는
            공공데이터입니다. 상업·비영리 이용이 허가되어 있으며, 본 앱은 출처를 명시하여 이용합니다.
          </Text>
          <Text style={[styles.legalText, { marginTop: 10, color: Colors.textSub }]}>
            공연 일정·장소·출연진 등의 데이터는 원 출처의 변경에 따라 달라질 수 있으며, 
            실제 예매 전 공식 판매처에서 재확인하시기 바랍니다.
          </Text>
        </View>

        {/* ─── 법적 문서 ────────────────────────────────────── */}
        <SectionLabel>📝 법적 문서</SectionLabel>
        <LinkRow
          icon="🔒"
          label="개인정보처리방침"
          onPress={() => openUrl(PRIVACY_POLICY_URL)}
        />
        <LinkRow
          icon="📄"
          label="이용약관"
          onPress={() => openUrl(TERMS_OF_SERVICE_URL)}
        />

        {/* ─── 외부 링크 ───────────────────────────────────── */}
        <SectionLabel>🔗 외부 링크</SectionLabel>
        <LinkRow
          icon="🎭"
          label="KOPIS 공연예술통합전산망"
          onPress={() => openUrl('https://www.kopis.or.kr')}
        />
        <LinkRow
          icon="📖"
          label="위키백과 (한국어)"
          onPress={() => openUrl('https://ko.wikipedia.org')}
        />
        <LinkRow
          icon="📋"
          label="공공데이터포털"
          onPress={() => openUrl('https://www.data.go.kr')}
        />

        {/* ─── 문의 ────────────────────────────────────────── */}
        <SectionLabel>💬 문의</SectionLabel>
        <LinkRow
          icon="✉️"
          label={SUPPORT_EMAIL}
          sub="오류 제보·기능 제안"
          onPress={openMail}
        />

        {/* ─── 저작권 푸터 ─────────────────────────────────── */}
        <Text style={{
          fontSize: FontSizes.tiny, color: Colors.textFaint, textAlign: 'center',
          marginTop: Spacing.xl, lineHeight: 18,
        }}>
          © 2026 내공연관리{'\n'}
          모든 데이터는 사용자 기기에만 저장됩니다.{'\n'}
          서버 전송·수집 없음.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── 내부 컴포넌트 ──────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={{
      fontSize: FontSizes.caption, fontFamily: Fonts.semibold, color: Colors.textSub,
      marginTop: Spacing.xl, marginBottom: 8, paddingLeft: 4,
    }}>
      {children}
    </Text>
  );
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: Colors.bgMuted, padding: Spacing.md, borderRadius: Radius.md, gap: 12,
    }}>
      {children}
    </View>
  );
}

function InfoLine({ icon, title, desc, sub }: {
  icon: string; title: string; desc: string; sub?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Text style={{ fontSize: 18, width: 24 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: FontSizes.caption, color: Colors.textSub }}>{title}</Text>
        <Text style={{ fontSize: FontSizes.body, fontFamily: Fonts.medium, marginTop: 2 }}>{desc}</Text>
        {sub && <Text style={{ fontSize: FontSizes.tiny, color: Colors.textFaint, marginTop: 2 }}>{sub}</Text>}
      </View>
    </View>
  );
}

function LinkRow({ icon, label, sub, onPress }: {
  icon: string; label: string; sub?: string; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}
               style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <Text style={{ fontSize: 20, width: 28 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: FontSizes.body, color: Colors.text }}>{label}</Text>
        {sub && <Text style={{ fontSize: FontSizes.tiny, color: Colors.textSub, marginTop: 2 }}>{sub}</Text>}
      </View>
      <Text style={{ color: Colors.textFaint, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, height: 48,
  },
  navTitle: { fontSize: FontSizes.title, fontFamily: Fonts.semibold },
  legalCard: {
    backgroundColor: Colors.bgMuted, padding: Spacing.md, borderRadius: Radius.md,
  },
  legalText: {
    fontSize: FontSizes.caption, color: Colors.text, lineHeight: 20,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
    backgroundColor: Colors.bg, borderRadius: Radius.md, marginBottom: 6, gap: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.divider,
  },
});
