import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { theme } from '../lib/theme';
import BannerAdSlot from '../components/BannerAdSlot';

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function P({ children, em = false }) {
  return <Text style={[styles.p, em && styles.pEm]}>{children}</Text>;
}

function Bullet({ children }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bullet}>·</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

export default function LegalScreen({ navigation }) {
  useEffect(() => {
    navigation.setOptions?.({ title: '약관 및 면책조항' });
  }, [navigation]);

  return (
    <View style={styles.root}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.headerEmoji}>⚖️</Text>
        <Text style={styles.headerTitle}>약관 및 면책조항</Text>
        <Text style={styles.headerSub}>본 앱을 사용하기 전 반드시 읽어주세요</Text>
      </View>

      <Section title="❗ 면책 조항 (Disclaimer)">
        <P em>
          본 앱은 로또 번호 추천 서비스를 제공하며, 어떠한 형태의 당첨도 보장하지 않습니다.
        </P>
        <Bullet>본 앱이 제공하는 모든 추천 번호는 과거 회차 데이터를 참고하여 생성한 참고용 정보일 뿐, 미래의 당첨을 예측하거나 보장하지 않습니다.</Bullet>
        <Bullet>로또 복권 구매 및 그에 따른 결과는 전적으로 사용자 본인의 자유 의사와 판단에 의한 것이며, 본 앱은 어떠한 법적 책임도 지지 않습니다.</Bullet>
        <Bullet>사용자가 본 앱의 추천 번호로 복권을 구매하여 발생한 금전적 손실, 심리적 손실, 시간적 손실 등 일체의 손해에 대해 본 앱 및 개발자는 책임지지 않습니다.</Bullet>
        <Bullet>본 앱은 사행성을 조장하지 않으며, 책임감 있는 복권 이용을 권장합니다.</Bullet>
        <Bullet>본 앱은 「사행산업통합감독위원회법」 및 관련 법령을 준수합니다.</Bullet>
      </Section>

      <Section title="🔞 이용 제한">
        <P>본 앱은 만 19세 이상 성인을 대상으로 하며, 미성년자(만 19세 미만)는 사용할 수 없습니다.</P>
        <Bullet>「사행산업통합감독위원회법」에 따라 만 19세 미만은 복권 구입이 금지되어 있습니다.</Bullet>
        <Bullet>도박 중독이 의심되거나 일상생활에 지장을 받고 있다면 한국도박문제예방치유원(상담전화 1336)에 도움을 요청하세요.</Bullet>
      </Section>

      <Section title="🔒 개인정보 처리방침">
        <P em>본 앱은 사용자의 개인정보를 회사 서버로 전송하거나 수집하지 않습니다.</P>
        <Bullet>모든 데이터(추천번호, 구입번호, 알고리즘 가중치, 텔레그램 설정 등)는 사용자 디바이스의 로컬 SQLite 데이터베이스에만 저장됩니다.</Bullet>
        <Bullet>회원가입, 로그인, 이메일/전화번호 등 개인 식별 정보를 수집하지 않습니다.</Bullet>
        <Bullet>텔레그램 봇 토큰 및 Chat ID는 사용자가 직접 입력한 값으로, 디바이스에만 저장되며 제3자에게 제공되지 않습니다.</Bullet>
        <Bullet>앱 삭제 시 모든 로컬 데이터는 운영체제에 의해 함께 제거됩니다.</Bullet>
        <Bullet>광고 식별자(IDFA / AAID)는 Google AdMob의 광고 노출 목적으로만 사용되며, 사용자는 디바이스 설정에서 언제든 추적을 비활성화할 수 있습니다.</Bullet>
      </Section>

      <Section title="🌐 외부 서비스">
        <P>본 앱은 아래 외부 서비스를 사용하며, 각 서비스는 자체 개인정보 처리방침을 따릅니다.</P>
        <Bullet>동행복권 (dhlottery.co.kr) — 회차 정보 및 당첨 판매점 조회</Bullet>
        <Bullet>lotto.oot.kr — 회차 데이터 미러링 (JSON API)</Bullet>
        <Bullet>Telegram Bot API — 사용자가 자발적으로 설정한 경우에만 추천번호 발송</Bullet>
        <Bullet>Google AdMob — 광고 노출 (광고 식별자 사용)</Bullet>
      </Section>

      <Section title="📢 광고 안내">
        <P>본 앱은 무료 서비스 운영을 위해 Google AdMob 광고를 사용합니다.</P>
        <Bullet>광고 클릭 또는 광고에 표시된 상품·서비스 구매로 인한 결과는 본 앱과 무관하며, 광고주 또는 광고 플랫폼의 책임 하에 있습니다.</Bullet>
        <Bullet>iOS의 경우 앱 추적 투명성(ATT) 정책에 따라 사용자에게 추적 권한을 요청할 수 있습니다.</Bullet>
      </Section>

      <Section title="📝 이용약관">
        <P>사용자는 본 앱을 다음과 같이 이용해야 합니다.</P>
        <Bullet>본 앱을 불법적이거나 부정한 목적으로 사용해서는 안 됩니다.</Bullet>
        <Bullet>본 앱의 소스코드 및 알고리즘을 무단 복제·재배포·역공학할 수 없습니다.</Bullet>
        <Bullet>본 앱의 추천 번호를 유료로 판매하거나 영리 목적으로 재배포할 수 없습니다.</Bullet>
        <Bullet>본 앱은 사전 통보 없이 기능 변경, 서비스 중단이 가능합니다.</Bullet>
      </Section>

      <Section title="📄 데이터 출처">
        <Bullet>로또 회차 정보 및 당첨 번호: 동행복권(주) 공개 데이터</Bullet>
        <Bullet>로또 6/45는 (주)동행복권의 등록 상표이며, 본 앱은 동행복권과 무관한 비공식 분석 도구입니다.</Bullet>
      </Section>

      <Section title="🔄 약관 변경">
        <Bullet>본 약관은 법령 또는 서비스 변경에 따라 사전 통보 없이 갱신될 수 있습니다.</Bullet>
        <Bullet>변경된 약관은 앱 업데이트 후 본 화면에서 확인할 수 있습니다.</Bullet>
        <Bullet>최종 갱신일: 2026-04-28 (v1.1)</Bullet>
      </Section>

      <View style={styles.footer}>
        <Text style={styles.footerTitle}>📌 요약</Text>
        <Text style={styles.footerTxt}>
          본 앱이 제공하는 추천 번호는 <Text style={styles.bold}>참고용 정보</Text>입니다.
          {'\n'}로또 구매 및 그에 따른 모든 결과는 <Text style={styles.bold}>사용자 본인의 판단과 책임</Text>입니다.
          {'\n'}본 앱은 <Text style={styles.bold}>당첨을 보장하지 않으며</Text> 어떠한 손실에 대해서도 <Text style={styles.bold}>법적 책임을 지지 않습니다</Text>.
        </Text>
      </View>

      <Text style={styles.copyright}>© 2026 spagenio · 비공식 로또 분석 도구</Text>
    </ScrollView>
    <BannerAdSlot position="bottom" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  scroll: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 40 },

  headerCard: {
    backgroundColor: theme.primary, borderRadius: 14, padding: 18,
    alignItems: 'center', marginBottom: 16,
  },
  headerEmoji: { fontSize: 32, marginBottom: 6 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4 },

  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 14, fontWeight: '800', color: theme.text,
    marginBottom: 8, paddingLeft: 2, letterSpacing: 0.2,
  },
  sectionBody: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: theme.border,
    padding: 12,
  },

  p: { fontSize: 13, color: theme.text, lineHeight: 20, marginBottom: 6 },
  pEm: {
    fontWeight: '700', color: '#b91c1c', backgroundColor: '#fef2f2',
    borderLeftWidth: 3, borderLeftColor: theme.danger,
    padding: 8, borderRadius: 6, marginBottom: 8,
  },

  bulletRow: { flexDirection: 'row', marginBottom: 4, paddingRight: 4 },
  bullet: { fontSize: 14, color: theme.primary, fontWeight: '900', width: 12 },
  bulletText: { flex: 1, fontSize: 12, color: theme.textSub, lineHeight: 19 },

  footer: {
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a',
    borderRadius: 12, padding: 14, marginTop: 8,
  },
  footerTitle: { fontSize: 14, fontWeight: '800', color: '#b45309', marginBottom: 8 },
  footerTxt: { fontSize: 12, color: '#92400e', lineHeight: 20 },
  bold: { fontWeight: '900', color: '#7c2d12' },

  copyright: {
    textAlign: 'center', color: theme.textMuted, fontSize: 11, marginTop: 18,
  },
});
