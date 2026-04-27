import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, FontSizes, Spacing, Radius } from '@/theme/theme';
import { PrimaryButton, Divider } from '@/components/UI';
import { acceptConsent } from '@/services/consent';
import {
  TERMS_OF_SERVICE_TEXT, PRIVACY_POLICY_TEXT, DISCLAIMER_TEXT,
  TERMS_OF_SERVICE_DATE, PRIVACY_POLICY_DATE, DISCLAIMER_DATE,
} from '@/legal/content';

type DocType = 'terms' | 'privacy' | 'disclaimer';

export default function OnboardingTerms() {
  const router = useRouter();

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeDisclaimer, setAgreeDisclaimer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openDoc, setOpenDoc] = useState<DocType | null>(null);

  const allAgreed = agreeTerms && agreePrivacy && agreeDisclaimer;

  const toggleAll = () => {
    const next = !allAgreed;
    setAgreeTerms(next);
    setAgreePrivacy(next);
    setAgreeDisclaimer(next);
  };

  const onStart = async () => {
    if (!allAgreed || submitting) return;
    setSubmitting(true);
    try {
      await acceptConsent();
      router.replace('/(tabs)');
    } catch (e) {
      console.warn('[consent] save failed', e);
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.xl, paddingBottom: Spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* 헤더 */}
        <View style={{ alignItems: 'center', marginTop: Spacing.xl, marginBottom: Spacing.xl }}>
          <Text style={{ fontSize: 56 }}>🎫</Text>
          <Text style={{ fontFamily: Fonts.brand, fontSize: 36, marginTop: 8 }}>내공연관리</Text>
          <Text style={{ fontFamily: Fonts.krRegular, fontSize: FontSizes.body, color: Colors.textSub, marginTop: 6 }}>
            연극·뮤지컬·콘서트 덕질을 한 곳에
          </Text>
        </View>

        {/* 핵심 안내 카드 */}
        <View style={styles.infoCard}>
          <InfoLine
            icon="🔒"
            text="이용자 정보를 서버로 보내지 않습니다. 모든 데이터는 본인 기기에만 저장됩니다."
          />
          <InfoLine
            icon="📡"
            text="공연 정보는 KOPIS, 아티스트 정보는 위키백과 등 외부 공개 데이터를 활용합니다."
          />
          <InfoLine
            icon="🆓"
            text="현재 모든 기능을 무료로 제공합니다. 광고 추적·행동 분석을 사용하지 않습니다."
          />
        </View>

        {/* 약관 동의 박스 */}
        <View style={styles.consentBox}>
          <CheckRow checked={allAgreed} label="모두 동의합니다" emphasis onToggle={toggleAll} />
          <Divider style={{ marginVertical: Spacing.md }} />

          <CheckRow
            checked={agreeTerms}
            label="(필수) 이용약관 동의"
            onToggle={() => setAgreeTerms(v => !v)}
            onView={() => setOpenDoc('terms')}
          />
          <View style={{ height: Spacing.sm }} />
          <CheckRow
            checked={agreePrivacy}
            label="(필수) 개인정보처리방침 동의"
            onToggle={() => setAgreePrivacy(v => !v)}
            onView={() => setOpenDoc('privacy')}
          />
          <View style={{ height: Spacing.sm }} />
          <CheckRow
            checked={agreeDisclaimer}
            label="(필수) 면책조항 확인 및 동의"
            onToggle={() => setAgreeDisclaimer(v => !v)}
            onView={() => setOpenDoc('disclaimer')}
          />
        </View>

        <Text style={styles.note}>
          이용약관 시행일: {TERMS_OF_SERVICE_DATE}{'\n'}
          개인정보처리방침 시행일: {PRIVACY_POLICY_DATE}{'\n'}
          면책조항 시행일: {DISCLAIMER_DATE}
        </Text>
      </ScrollView>

      {/* 하단 시작 버튼 */}
      <View style={styles.footer}>
        <PrimaryButton
          title={submitting ? '저장 중…' : '동의하고 시작하기'}
          onPress={onStart}
          disabled={!allAgreed}
          loading={submitting}
        />
      </View>

      {/* 약관 전체 보기 모달 */}
      <Modal
        visible={openDoc !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpenDoc(null)}
      >
        <DocumentView
          type={openDoc}
          onClose={() => setOpenDoc(null)}
        />
      </Modal>
    </SafeAreaView>
  );
}

/* ────────────────────────────────────────────────────────────── */

function InfoLine({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Spacing.sm }}>
      <Text style={{ fontSize: 18, marginRight: Spacing.md, marginTop: 1 }}>{icon}</Text>
      <Text
        style={{
          flex: 1,
          fontFamily: Fonts.krRegular,
          fontSize: FontSizes.body,
          lineHeight: 22,
          color: Colors.text,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function CheckRow({
  checked, label, emphasis, onToggle, onView,
}: {
  checked: boolean;
  label: string;
  emphasis?: boolean;
  onToggle: () => void;
  onView?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
      >
        <View style={[styles.checkbox, checked && styles.checkboxOn]}>
          {checked && <Text style={styles.checkboxMark}>✓</Text>}
        </View>
        <Text
          style={{
            fontFamily: emphasis ? Fonts.krBold : Fonts.krMedium,
            fontSize: emphasis ? FontSizes.bodyLg : FontSizes.body,
            color: Colors.text,
          }}
        >
          {label}
        </Text>
      </Pressable>
      {onView && (
        <Pressable onPress={onView} hitSlop={8}>
          <Text style={{ fontFamily: Fonts.medium, fontSize: FontSizes.caption, color: Colors.primary }}>
            전체보기
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function DocumentView({ type, onClose }: { type: DocType | null; onClose: () => void }) {
  if (!type) return null;

  const meta = {
    terms:      { title: '이용약관',         body: TERMS_OF_SERVICE_TEXT },
    privacy:    { title: '개인정보처리방침',   body: PRIVACY_POLICY_TEXT   },
    disclaimer: { title: '면책조항',         body: DISCLAIMER_TEXT       },
  }[type];

  const { title, body } = meta;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top', 'bottom']}>
      <View style={styles.modalNav}>
        <Text style={{ fontFamily: Fonts.krBold, fontSize: FontSizes.title }}>{title}</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={{ fontSize: 22 }}>✕</Text>
        </Pressable>
      </View>
      <Divider />
      <ScrollView contentContainerStyle={{ padding: Spacing.xl, paddingBottom: Spacing.xxl }}>
        <Text
          style={{
            fontFamily: Fonts.krRegular,
            fontSize: FontSizes.body,
            lineHeight: 22,
            color: Colors.text,
          }}
        >
          {body}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  infoCard: {
    backgroundColor: Colors.bgMuted,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  consentBox: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  note: {
    marginTop: Spacing.lg,
    fontFamily: Fonts.krRegular,
    fontSize: FontSizes.tiny,
    color: Colors.textFaint,
    textAlign: 'center',
    lineHeight: 16,
  },
  checkbox: {
    width: 22, height: 22,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginRight: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
  checkboxOn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxMark: {
    color: Colors.textInverse,
    fontSize: 14,
    fontWeight: '700',
    marginTop: -1,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    backgroundColor: Colors.bg,
  },
  modalNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
});
