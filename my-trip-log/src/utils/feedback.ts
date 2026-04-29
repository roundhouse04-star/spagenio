/**
 * 앱 내 피드백 — 메일 클라이언트로 이메일 작성 화면 열기
 */
import { Linking, Alert, Platform } from 'react-native';
import Constants from 'expo-constants';

const FEEDBACK_EMAIL = 'roundhouse04@gmail.com';

export async function openFeedbackMail(): Promise<void> {
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const subject = encodeURIComponent('[My Trip Log] 피드백');
  const body = encodeURIComponent(
    `\n\n` +
    `─────────\n` +
    `앱 버전: ${appVersion}\n` +
    `OS: ${Platform.OS} ${Platform.Version}\n` +
    `─────────\n`,
  );
  const url = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert(
        '메일 앱이 없어요',
        `${FEEDBACK_EMAIL} 으로 직접 보내주세요.`,
      );
      return;
    }
    await Linking.openURL(url);
  } catch (err) {
    console.warn('[feedback] mailto 실패:', err);
    Alert.alert('오류', `${FEEDBACK_EMAIL} 으로 직접 보내주세요.`);
  }
}
