# 📺 AdMob 광고 연동 가이드

현재는 **플레이스홀더 모드** ("내공연관리 PRO 곧 출시!" 배너가 표시됨).
AdMob 실광고로 전환할 때 아래 단계를 따르면 됩니다.

## 📦 사전 준비

### 1. AdMob 계정 + 앱 등록
1. https://admob.google.com 접속 → Google 계정 로그인
2. 앱 추가 → "내공연관리" 등록 (플랫폼: iOS + Android 각각)
3. 앱 ID 발급받음 (예: `ca-app-pub-1234567890123456~1234567890`)

### 2. 광고 단위 생성
- 각 플랫폼에서 "광고 단위 추가" → **배너** 타입 선택
- 광고 단위 ID 발급받음 (예: `ca-app-pub-1234567890123456/1234567890`)
- iOS 광고 단위 + Android 광고 단위 2개 필요

## 🔧 코드 수정 (3단계)

### 단계 1. 패키지 설치
```bash
cd ~/projects/spagenio/mygong-app
npx expo install react-native-google-mobile-ads
```

### 단계 2. `src/config/ads.ts` 채우기
```typescript
export const ADS_ENABLED = true;  // ← 이걸 true 로

export const AD_UNIT_IDS = {
  bannerIOS: 'ca-app-pub-1234.../5678...',     // ← 본인 광고 단위 ID
  bannerAndroid: 'ca-app-pub-1234.../5678...', // ← 본인 광고 단위 ID
};

export const ADMOB_APP_IDS = {
  ios: 'ca-app-pub-1234...~5678...',     // ← 본인 앱 ID
  android: 'ca-app-pub-1234...~5678...',
};
```

### 단계 3. `app.json`에 플러그인 등록
```json
{
  "expo": {
    "plugins": [
      [
        "react-native-google-mobile-ads",
        {
          "androidAppId": "ca-app-pub-1234...~5678...",
          "iosAppId": "ca-app-pub-1234...~5678..."
        }
      ]
    ]
  }
}
```

## 🏗 빌드 + 테스트

```bash
# iOS 테스트 빌드
eas build --profile preview --platform ios

# Android 테스트 빌드
eas build --profile preview --platform android
```

**⚠️ Expo Go 에서는 광고 작동 안 함** — 반드시 EAS 빌드 또는 development build 필수.

### 개발 빌드 (dev-client)
```bash
npx expo install expo-dev-client
eas build --profile development --platform ios
```
→ 이 빌드를 폰에 설치하면 `npx expo start --dev-client` 로 빠른 개발 가능

## 📋 출시 전 체크리스트

- [ ] AdMob 계정 생성 + 앱 등록
- [ ] 광고 단위 2개 생성 (iOS/Android 배너)
- [ ] `src/config/ads.ts` ID 4개 입력
- [ ] `app.json` 플러그인 등록 (ID 2개)
- [ ] `ADS_ENABLED = true`
- [ ] EAS Preview 빌드로 **테스트 광고** 표시 확인 (`__DEV__` → TestIds 자동 사용)
- [ ] EAS Production 빌드로 실광고 확인 (심사 전 최소 1회)
- [ ] App Store / Play Store 심사 제출

## 💡 수익 팁

- **ANCHORED_ADAPTIVE_BANNER** 사용 중 (현재 설정) — 기기별 최적 크기
- **보상형 광고** 나중에 추가 가능 (유료 기능 임시 잠금 해제 등)
- **PRO 업그레이드** 유료 전환 시 `ADS_ENABLED = false` 로 즉시 끌 수 있게 설계됨

## 🚨 주의

- 개발 중에 **실광고 ID로 클릭 테스트 금지** (AdMob 계정 정지 사유)
- `__DEV__` 모드에서는 자동으로 TestIds 가 사용되므로 안전
- 앱 심사 중에는 광고 테스트 모드 유지 권장
