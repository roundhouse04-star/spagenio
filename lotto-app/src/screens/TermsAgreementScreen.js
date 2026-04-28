import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, BackHandler, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../lib/theme';
import { saveTermsAgreement, CURRENT_TERMS_VERSION } from '../lib/appSettings';

const REQUIRED_ITEMS = [
  {
    id: 'service',
    title: '이용약관 동의',
    desc: '서비스 이용 규칙 · 책임의 한계',
    required: true,
  },
  {
    id: 'privacy',
    title: '개인정보 처리방침 동의',
    desc: '데이터는 디바이스에만 저장되며 회사 서버 미사용',
    required: true,
  },
  {
    id: 'age',
    title: '만 19세 이상입니다',
    desc: '복권 관련 서비스로 미성년자 이용 불가',
    required: true,
  },
  {
    id: 'ad',
    title: '광고 식별자 사용 동의',
    desc: 'Google AdMob 광고 노출 (서비스 무료 운영)',
    required: true,
  },
];

function CheckBox({ checked, onPress, size = 22 }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[
        styles.checkbox,
        { width: size, height: size, borderRadius: size / 2 },
        checked && styles.checkboxChecked,
      ]}
    >
      {checked && <Text style={styles.checkmark}>✓</Text>}
    </Pressable>
  );
}

export default function TermsAgreementScreen({ onAgreed, onShowDetails }) {
  const [checked, setChecked] = useState({
    service: false,
    privacy: false,
    age: false,
    ad: false,
  });

  const allRequired = Object.values(checked).every(Boolean);

  const toggleAll = () => {
    const next = !allRequired;
    setChecked({ service: next, privacy: next, age: next, ad: next });
  };

  const toggleItem = (id) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const onProceed = async () => {
    if (!allRequired) {
      Alert.alert('약관 동의 필요', '필수 항목 4개를 모두 동의해주세요.');
      return;
    }
    await saveTermsAgreement();
    onAgreed?.();
  };

  const onDecline = () => {
    Alert.alert(
      '앱 종료',
      '약관에 동의하지 않으시면 앱을 사용할 수 없습니다. 앱을 종료할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '종료', style: 'destructive',
          onPress: () => BackHandler.exitApp?.(),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <LinearGradient
          colors={['#6366f1', '#8b5cf6', '#ec4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroEmoji}>🍀</Text>
          <Text style={styles.heroTitle}>로또부스터</Text>
          <Text style={styles.heroSub}>이용을 위해 약관 동의가 필요합니다</Text>
        </LinearGradient>

        <View style={styles.card}>
          {/* 전체 동의 */}
          <Pressable style={styles.allRow} onPress={toggleAll}>
            <CheckBox checked={allRequired} onPress={toggleAll} size={26} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.allTitle}>전체 동의</Text>
              <Text style={styles.allSub}>아래 4개 필수 항목 일괄 동의</Text>
            </View>
          </Pressable>

          <View style={styles.divider} />

          {/* 개별 항목 */}
          {REQUIRED_ITEMS.map((item) => (
            <View key={item.id} style={styles.item}>
              <Pressable style={styles.itemRow} onPress={() => toggleItem(item.id)}>
                <CheckBox checked={checked[item.id]} onPress={() => toggleItem(item.id)} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.itemHead}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <View style={styles.requiredBadge}>
                      <Text style={styles.requiredTxt}>필수</Text>
                    </View>
                  </View>
                  <Text style={styles.itemDesc}>{item.desc}</Text>
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() => onShowDetails?.()}
                  style={styles.viewBtn}
                >
                  <Text style={styles.viewBtnTxt}>보기</Text>
                </Pressable>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>⚠️ 중요 안내</Text>
          <Text style={styles.noticeTxt}>
            본 앱이 제공하는 추천 번호는{' '}
            <Text style={styles.bold}>참고용</Text>이며 당첨을 보장하지 않습니다.
            로또 구매 및 결과는 전적으로 사용자의 판단과 책임이며, 본 앱은 어떠한 법적 책임도 지지 않습니다.
            도박 중독이 의심되면 한국도박문제예방치유원(
            <Text style={styles.link} onPress={() => Linking.openURL('tel:1336')}>1336</Text>
            )에 도움을 요청하세요.
          </Text>
        </View>

        <Text style={styles.versionTxt}>약관 v{CURRENT_TERMS_VERSION}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.declineBtn} onPress={onDecline}>
          <Text style={styles.declineBtnTxt}>거부 (앱 종료)</Text>
        </Pressable>
        <Pressable
          style={[styles.proceedBtn, !allRequired && styles.proceedBtnDisabled]}
          onPress={onProceed}
        >
          <Text style={styles.proceedBtnTxt}>
            {allRequired ? '✓ 동의하고 시작하기' : '필수 항목 동의 필요'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  scroll: { padding: 16, paddingBottom: 40 },

  hero: {
    borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16,
  },
  heroEmoji: { fontSize: 48, marginBottom: 8 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4 },

  card: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border,
    borderRadius: 14, padding: 4, marginBottom: 14,
  },

  allRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
  },
  allTitle: { fontSize: 16, fontWeight: '900', color: theme.text },
  allSub: { fontSize: 12, color: theme.textSub, marginTop: 2 },

  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 12 },

  item: { paddingHorizontal: 4 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
  },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemTitle: { fontSize: 14, fontWeight: '800', color: theme.text },
  itemDesc: { fontSize: 11, color: theme.textSub, marginTop: 2 },

  requiredBadge: {
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 4, backgroundColor: '#fef2f2',
  },
  requiredTxt: { fontSize: 9, color: theme.danger, fontWeight: '900' },

  checkbox: {
    borderWidth: 2, borderColor: theme.border, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: theme.primary, backgroundColor: theme.primary,
  },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '900', lineHeight: 14 },

  viewBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: '#f3f4f6', borderRadius: 8,
  },
  viewBtnTxt: { fontSize: 11, color: theme.textSub, fontWeight: '700' },

  notice: {
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a',
    borderRadius: 12, padding: 12, marginBottom: 14,
  },
  noticeTitle: { fontSize: 13, fontWeight: '800', color: '#b45309', marginBottom: 6 },
  noticeTxt: { fontSize: 12, color: '#92400e', lineHeight: 19 },
  bold: { fontWeight: '900', color: '#7c2d12' },
  link: { color: theme.primary, fontWeight: '800', textDecorationLine: 'underline' },

  versionTxt: {
    textAlign: 'center', color: theme.textMuted, fontSize: 11,
  },

  footer: {
    flexDirection: 'row', gap: 10, padding: 14,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: theme.border,
  },
  declineBtn: {
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
  },
  declineBtnTxt: { color: theme.danger, fontWeight: '700', fontSize: 13 },
  proceedBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: theme.primary,
  },
  proceedBtnDisabled: { backgroundColor: theme.textMuted, opacity: 0.7 },
  proceedBtnTxt: { color: '#fff', fontWeight: '900', fontSize: 14 },
});
