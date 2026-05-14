/**
 * Triplive PRO 인앱 결제 — RevenueCat (react-native-purchases) 래퍼
 *
 * ## 왜 RevenueCat?
 *  react-native-iap 12.x 가 Expo SDK 54 / RN 0.81 의 currentActivity 호환 깨져서
 *  Android Gradle 컴파일 실패. RevenueCat 은 자체 native 코드 + SaaS 서버로
 *  Expo SDK 54 검증된 라이브러리. 영수증 검증·환불 추적·만료 자동.
 *
 * ## 등록된 자원 (RevenueCat 대시보드)
 *   Project:       Triplive
 *   iOS App:       Triplive (App Store) — Bundle: com.triplive.app
 *   Product ID:    com.triplive.app.pro (App Store Connect 와 동일)
 *   Entitlement:   "Triplive Pro" — PRO 사용자 권한 식별
 *
 * ## 흐름
 *   1) 앱 시작 시 _layout.tsx 에서 Purchases.configure(API Key) 호출
 *   2) PRO 화면 마운트 시 fetchProProduct() → 현지화 가격 표시
 *   3) buyPro() → Apple 결제 시트 → 영수증 자동 검증 (RC 서버)
 *   4) entitlements.active["Triplive Pro"] 존재 시 PRO 활성
 *
 * ## 1.1 단계 한계 (Android)
 *   Android 는 Play Console 등록 + Service Account 셋업 미완료라 RevenueCat
 *   Android 앱 등록 안 함. canUseIap() 가 iOS 한정 true.
 *   → Android 에서 결제 화면 들어가면 "준비 중" 표시 (의도적).
 */
import { Platform } from 'react-native';

import { setProActive, clearProStatus } from './proStatus';

/** RevenueCat 대시보드의 entitlement identifier 와 정확히 일치. */
export const ENTITLEMENT_ID = 'Triplive Pro';

/** 상품 ID — App Store Connect 와 동일. */
export const PRO_PRODUCT_ID = 'com.triplive.app.pro';

/** UI fallback 가격 (RC 서버 응답 실패 시만 사용). */
export const PRO_DISPLAY_PRICE = '₩7,700';

/**
 * RevenueCat SDK API Key — iOS / Android 별도.
 * iOS: RevenueCat 대시보드 → Apps & providers → Triplive (App Store) → API Key
 * Android: 1.2 에서 Play Console 등록 후 추가
 */
const RC_IOS_API_KEY = 'appl_EcdKYKEPAjWkusiuTOUYUSwVxwh';
const RC_ANDROID_API_KEY = ''; // 1.2 에서 채울 예정

export interface ProProductInfo {
  productId: string;
  /** 스토어가 제공한 현지화 가격 문자열 (예: "₩7,700") */
  price: string;
  title: string;
  description: string;
}

let purchasesModule: any = null;
let configured = false;

/** Expo Go (native module 미포함) / dev 환경 가드 */
function canUseIap(): boolean {
  if (__DEV__) return false;
  // Android 는 1.2 까지 비활성
  if (Platform.OS === 'android' && !RC_ANDROID_API_KEY) return false;
  try {
    if (!purchasesModule) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('react-native-purchases');
      purchasesModule = mod?.default ?? mod;
    }
    return !!purchasesModule;
  } catch {
    return false;
  }
}

/** 앱 시작 시 1회 호출 (_layout.tsx). 결제 화면 마운트 전에 끝나야 함. */
export async function initIapConnection(): Promise<boolean> {
  if (!canUseIap() || !purchasesModule) return false;
  if (configured) return true;
  try {
    const apiKey = Platform.OS === 'ios' ? RC_IOS_API_KEY : RC_ANDROID_API_KEY;
    if (!apiKey) return false;

    // 디버그 로그 (TestFlight 에서만, App Store 출시 시점에 LOG_LEVEL.WARN 로 낮추기 가능)
    if (purchasesModule.setLogLevel && purchasesModule.LOG_LEVEL) {
      purchasesModule.setLogLevel(purchasesModule.LOG_LEVEL.INFO);
    }

    await purchasesModule.configure({ apiKey });
    configured = true;

    // 앱 시작 시 RC 서버에서 현재 사용자 권한 동기화
    // (다른 기기 결제했어도 자동 복원)
    try {
      const info = await purchasesModule.getCustomerInfo();
      const hasPro = !!info?.entitlements?.active?.[ENTITLEMENT_ID];
      if (hasPro) {
        await setProActive({
          type: 'lifetime',
          receiptId: info.originalAppUserId || 'rc',
        });
      } else {
        // RC 가 "환불됨/만료됨" 이라고 알리면 로컬에서도 해제
        await clearProStatus();
      }
    } catch {
      // 네트워크 실패 등 — 기존 로컬 상태 유지
    }

    return true;
  } catch (e) {
    console.warn('[proStore] Purchases.configure 실패:', e);
    return false;
  }
}

/** 결제 화면 unmount 시 — 별도 정리 불필요. */
export async function endIapConnection(): Promise<void> {
  /* no-op — RC 는 앱 lifetime 동안 유지 */
}

/** 스토어에서 상품 정보 (현지화 가격 포함) 조회. */
export async function fetchProProduct(): Promise<ProProductInfo | null> {
  if (!canUseIap() || !purchasesModule) return null;
  await initIapConnection();
  try {
    // ⚠️ type 'inapp' 명시 필수 — 안 주면 기본 'subs' (구독) 으로 간주해서 빈 배열 반환.
    // 우리 PRO 는 비소모성 (non-consumable) 일회성이라 'inapp'.
    const list = await purchasesModule.getProducts([PRO_PRODUCT_ID], 'inapp');
    const p = Array.isArray(list) ? list[0] : null;
    if (!p) {
      console.warn('[proStore] getProducts 반환 0개 — RC sync / ASC 상품 상태 확인');
      return null;
    }
    return {
      productId: p.identifier || PRO_PRODUCT_ID,
      price: p.priceString || p.price_string || PRO_DISPLAY_PRICE,
      title: p.title || 'Triplive PRO',
      description: p.description || '광고 없이 깔끔하게 여행 기록하기',
    };
  } catch (e) {
    console.warn('[proStore] getProducts 실패:', e);
    return null;
  }
}

/**
 * PRO 구매 시작.
 * 성공 시 entitlements 가 갱신되고 setProActive 호출 → UI 즉시 PRO 모드.
 * 사용자가 결제 시트 취소하면 throw (호출부에서 silent 처리).
 */
export async function buyPro(): Promise<void> {
  if (!canUseIap() || !purchasesModule) {
    throw new Error('이 빌드에서는 결제를 사용할 수 없어요.');
  }
  await initIapConnection();

  // RC 10.x: purchaseProduct(productId, [options], type?)
  const result = await purchasesModule.purchaseProduct(PRO_PRODUCT_ID);
  const customerInfo = result?.customerInfo;
  const productId = result?.productIdentifier;

  if (
    productId === PRO_PRODUCT_ID &&
    customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]
  ) {
    await setProActive({
      type: 'lifetime',
      receiptId: customerInfo.originalAppUserId || 'rc',
    });
  }
}

/**
 * 이전 구매 복원 — 다른 기기 / 재설치 / 환불 후 재구매 시.
 * Apple/Google 정책상 반드시 노출되어야 하는 기능.
 * @returns 복원 성공 여부
 */
export async function restorePurchases(): Promise<boolean> {
  if (!canUseIap() || !purchasesModule) return false;
  await initIapConnection();
  try {
    const info = await purchasesModule.restorePurchases();
    const hasPro = !!info?.entitlements?.active?.[ENTITLEMENT_ID];
    if (hasPro) {
      await setProActive({
        type: 'lifetime',
        receiptId: info.originalAppUserId || 'restored',
      });
    }
    return hasPro;
  } catch (e) {
    console.warn('[proStore] restore 실패:', e);
    return false;
  }
}
