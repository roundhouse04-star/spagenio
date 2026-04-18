# 🎯 햅틱 피드백 적용 가이드

## 📦 1단계: 라이브러리 설치 (1줄)

```bash
cd ~/projects/spagenio/my-trip-log
npx expo install expo-haptics
```

## 📁 2단계: 유틸 파일 추가

`src/utils/haptics.ts` 파일을 zip에서 복사 (아래 첨부)

## ✏️ 3단계: 화면에 한 줄씩 추가

### 패턴 (3가지만 외우면 끝)

```typescript
import { haptic } from '@/utils/haptics';

// 패턴 1: 일반 탭/선택
onPress={() => { haptic.tap(); doSomething(); }}

// 패턴 2: 칩/체크박스 토글
onPress={() => { haptic.select(); toggleX(); }}

// 패턴 3: 저장 성공 후
async function save() {
  await db.save(...);
  haptic.success();   // ← 성공 직후
  router.back();
}
```

---

## 🎯 추천 적용 위치

### A. 온보딩 (가장 효과 큼!)

#### `app/(onboarding)/welcome.tsx` - 시작하기 버튼
```typescript
onPress={() => {
  haptic.medium();
  router.push('/(onboarding)/nickname');
}}
```

#### `app/(onboarding)/nickname.tsx` - 국적 칩
```typescript
onPress={() => {
  haptic.select();
  setNationality(c.code);
}}
```

#### `app/(onboarding)/nickname.tsx` - 다음 버튼
```typescript
const handleNext = async () => {
  if (!canProceed) return;
  haptic.medium();
  // ... 기존 코드
};
```

#### `app/(onboarding)/terms.tsx` - 체크박스 (4곳)
```typescript
onPress={() => { haptic.select(); setAgreeTerms(!agreeTerms); }}
onPress={() => { haptic.select(); setAgreePrivacy(!agreePrivacy); }}
onPress={() => { haptic.select(); setAgreeStats(!agreeStats); }}
onPress={() => { haptic.select(); setAgreeSnsAlert(!agreeSnsAlert); }}
```

#### `app/(onboarding)/terms.tsx` - 전체 동의
```typescript
onPress={() => {
  haptic.medium();
  toggleAll(!allChecked);
}}
```

#### `app/(onboarding)/terms.tsx` - 완료 버튼
```typescript
const handleComplete = async () => {
  if (!canProceed || submitting) return;
  setSubmitting(true);
  try {
    // ... 기존 db.runAsync 코드
    if (agreeStats) {
      await registerOnServer();
    }
    haptic.success();   // ← 가입 완료 강한 피드백!
    router.replace('/(tabs)');
  } finally {
    setSubmitting(false);
  }
};
```

### B. 탭바 (전환 시 가벼운 진동)

#### `app/(tabs)/_layout.tsx`
```typescript
import { haptic } from '@/utils/haptics';

// Tabs.Screen에 listeners 추가
<Tabs.Screen
  name="index"
  options={{...}}
  listeners={{
    tabPress: () => haptic.tap(),
  }}
/>
```
(5개 탭 모두 동일하게)

### C. 여행 카드 클릭

#### `app/(tabs)/trips.tsx` - 여행 카드 onPress
```typescript
onPress={() => {
  haptic.tap();
  router.push(`/trip/${trip.id}`);
}}
```

### D. 추가/저장 화면

#### `app/trips/new.tsx` - 저장 버튼
```typescript
const save = async () => {
  // ... db 저장 코드
  haptic.success();
  router.back();
};
```

#### `app/trip/[id]/item-new.tsx`, `log-new.tsx`, `expense-new.tsx`
```typescript
const save = async () => {
  // ... db 저장 코드
  haptic.success();
  router.back();
};
```

### E. 체크리스트 토글

#### `src/components/ChecklistTab.tsx` - 체크 토글
```typescript
const toggle = async (id: number) => {
  haptic.select();
  await toggleChecklist(id);
  load();
};
```

### F. 위험 액션 (강한 피드백)

#### "데이터 초기화" 같은 위험 버튼
```typescript
onPress={() => {
  haptic.heavy();   // 강한 진동으로 "주의!"
  Alert.alert('정말로 초기화...', ...);
}}
```

---

## 🚀 4단계: Expo 재시작

```bash
# Ctrl+C 로 끄고
npx expo start --clear
```

휴대폰에서 모든 동작에 진동 들어옴! 🎉

---

## ⚠️ 주의

- iOS에서만 풀로 작동, Android는 일부만
- Expo Go에서도 동작
- 진동이 너무 많으면 거슬려요. 위 위치만 적용 추천
