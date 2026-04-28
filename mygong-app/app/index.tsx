/**
 * 루트 진입점 (`/`).
 *
 * 동의 여부에 따라 (tabs) 또는 (onboarding) 으로 분기하는 라우터.
 * `app/index.tsx` 가 없으면 expo-router 가 첫 화면을 자동 선택하는데,
 * 파일 시스템 순서상 (onboarding) 이 먼저라서 동의한 사용자도 다시 약관 화면을
 * 보게 되는 문제가 있었음. 명시적 진입점으로 해결.
 */

import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';

import { hasAcceptedConsent } from '@/services/consent';
import { Colors } from '@/theme/theme';

export default function Index() {
  const [consented, setConsented] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    hasAcceptedConsent()
      .then(v => {
        if (!cancelled) {
          console.log('[index] consent loaded:', v);
          setConsented(v);
        }
      })
      .catch(err => {
        console.warn('[index] consent load failed:', err);
        if (!cancelled) setConsented(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (consented === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={consented ? '/(tabs)' : '/(onboarding)'} />;
}
