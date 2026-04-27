import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, FontSizes, Spacing } from '@/theme/theme';
import { Divider } from '@/components/UI';
import {
  TERMS_OF_SERVICE_TEXT, PRIVACY_POLICY_TEXT, DISCLAIMER_TEXT,
  TERMS_OF_SERVICE_DATE, PRIVACY_POLICY_DATE, DISCLAIMER_DATE,
} from '@/legal/content';

type LegalType = 'terms' | 'privacy' | 'disclaimer';

const META: Record<LegalType, { title: string; body: string; date: string }> = {
  terms:      { title: '이용약관',         body: TERMS_OF_SERVICE_TEXT, date: TERMS_OF_SERVICE_DATE },
  privacy:    { title: '개인정보처리방침',   body: PRIVACY_POLICY_TEXT,   date: PRIVACY_POLICY_DATE   },
  disclaimer: { title: '면책조항',         body: DISCLAIMER_TEXT,       date: DISCLAIMER_DATE       },
};

export default function LegalDocumentScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: string }>();

  const meta = (type && type in META) ? META[type as LegalType] : null;

  if (!meta) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
        <NavBar title="문서" onBack={() => router.back()} />
        <Divider />
        <View style={{ padding: Spacing.xl }}>
          <Text style={{ fontFamily: Fonts.krRegular, fontSize: FontSizes.body, color: Colors.textSub }}>
            문서를 찾을 수 없습니다.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <NavBar title={meta.title} onBack={() => router.back()} />
      <Divider />
      <ScrollView contentContainerStyle={{ padding: Spacing.xl, paddingBottom: Spacing.xxl }}>
        <Text
          style={{
            fontFamily: Fonts.krBold,
            fontSize: FontSizes.h2,
            color: Colors.text,
            marginBottom: Spacing.sm,
          }}
        >
          {meta.title}
        </Text>
        <Text
          style={{
            fontFamily: Fonts.krRegular,
            fontSize: FontSizes.tiny,
            color: Colors.textFaint,
            marginBottom: Spacing.lg,
          }}
        >
          시행일: {meta.date}
        </Text>
        <Text
          style={{
            fontFamily: Fonts.krRegular,
            fontSize: FontSizes.body,
            lineHeight: 22,
            color: Colors.text,
          }}
        >
          {meta.body}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function NavBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.navBar}>
      <Pressable onPress={onBack} hitSlop={8}>
        <Text style={{ fontSize: 22 }}>‹</Text>
      </Pressable>
      <Text style={styles.navTitle}>{title}</Text>
      <View style={{ width: 22 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    height: 48,
  },
  navTitle: { fontFamily: Fonts.krBold, fontSize: FontSizes.title },
});
