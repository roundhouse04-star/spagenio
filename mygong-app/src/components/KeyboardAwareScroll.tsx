/**
 * 키보드가 입력 필드를 가리지 않게 자동 스크롤하는 ScrollView 래퍼.
 *
 * 사용법:
 *   <KeyboardAwareScroll contentContainerStyle={{ padding: 16 }}>
 *     <Field>...</Field>
 *     <TextField ... />
 *   </KeyboardAwareScroll>
 *
 * 기존 <ScrollView>를 그대로 대체 가능.
 *
 * 동작:
 *   - iOS: 키보드 올라오면 padding 추가 → 입력 필드가 자연스럽게 위로
 *   - Android: height 조정으로 동일 효과
 *   - 빈 공간 탭: 키보드 닫힘
 *   - 스크롤 다운: 키보드 닫힘 (interactive)
 */
import React from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ScrollViewProps,
  StyleSheet,
} from 'react-native';

type Props = ScrollViewProps & {
  children: React.ReactNode;
  /** iOS 상단 네비바 높이 보정. 기본 90 (네비바 + 안전영역). */
  keyboardVerticalOffset?: number;
};

export function KeyboardAwareScroll({
  children,
  keyboardVerticalOffset = 90,
  ...scrollProps
}: Props) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
      keyboardVerticalOffset={Platform.OS === 'ios' ? keyboardVerticalOffset : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        {...scrollProps}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
