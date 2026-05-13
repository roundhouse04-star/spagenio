/**
 * Triplive PRO 인앱 결제 — react-native-iap 래퍼
 *
 * ## 상품 (App Store Connect + Play Console 양쪽에 동일 ID로 등록)
 *   PRO_PRODUCT_ID = 'com.triplive.app.pro'
 *   타입: Non-Consumable (일회성 평생 결제)
 *
 * ## 흐름
 *   1) 사용자가 "구매하기" → buyPro()
 *   2) Apple/Google 결제 시트 표시 → 결제 성공
 *   3) purchaseUpdatedListener 가 영수증 수신
 *   4) setProActive() 로 로컬 SQLite 에 저장
 *   5) finishTransaction() 으로 트랜잭션 종료 (필수)
 *   6) 앱 전체 광고 즉시 사라짐 (AdBanner 가 isProActive() 체크)
 *
 * ## Expo Go / dev 환경
 *   react-native-iap 는 native module 필요 → Expo Go 미동작.
 *   __DEV__ 에서는 connection 시도 자체를 skip하고 mock 으로 false 반환.
 *
 * ## App Store / Play Store 영수증 검증
 *   현재 구현: 로컬 검증만 (구매 후 영수증 ID 저장).
 *   서버 검증이 필요해지면 (환불·구독 정확 추적) 추후 cloud function 추가.
 *
 * @see https://github.com/hyochan/react-native-iap
 */
import { Platform } from 'react-native';

import { setProActive } from './proStatus';

/** 상품 ID — 양쪽 스토어 동일하게 등록할 것. */
export const PRO_PRODUCT_ID = 'com.triplive.app.pro';

/** UI 에 표시할 추천 가격 (스토어 등록 가격을 기준으로 변경). */
export const PRO_DISPLAY_PRICE = '₩7,900';

export interface ProProductInfo {
  productId: string;
  /** 스토어에서 받은 현지화 가격 문자열 (예: "₩7,900" / "$5.99") */
  price: string;
  title: string;
  description: string;
}

let iapModule: typeof import('react-native-iap') | null = null;
let connectionReady = false;
let listenersAttached = false;
let purchaseUpdateSub: { remove: () => void } | null = null;
let purchaseErrorSub: { remove: () => void } | null = null;

/** Expo Go 등 native module 미포함 환경 가드 */
function canUseIap(): boolean {
  if (__DEV__) {
    // dev 환경에서도 EAS dev-client 라면 동작하지만, 안전하게 false
    return false;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    if (!iapModule) iapModule = require('react-native-iap');
    return !!iapModule;
  } catch {
    return false;
  }
}

/** 연결 + 리스너 부착. 결제 화면 마운트 시 1회 호출. */
export async function initIapConnection(): Promise<boolean> {
  if (!canUseIap() || !iapModule) return false;
  if (connectionReady) return true;
  try {
    await iapModule.initConnection();
    connectionReady = true;

    // 결제 성공/실패 리스너 (전역 1회)
    if (!listenersAttached) {
      purchaseUpdateSub = iapModule.purchaseUpdatedListener(async (purchase: any) => {
        try {
          if (purchase?.productId === PRO_PRODUCT_ID && purchase?.transactionReceipt) {
            await setProActive({
              type: 'lifetime',
              receiptId: purchase.transactionId || purchase.transactionReceipt.slice(0, 32),
            });
            // 트랜잭션 finalize (이거 안 하면 Apple 이 같은 영수증 계속 재전송)
            await iapModule!.finishTransaction({ purchase, isConsumable: false });
          }
        } catch (e) {
          console.warn('[proStore] purchaseUpdated handler 오류:', e);
        }
      });

      purchaseErrorSub = iapModule.purchaseErrorListener((err: any) => {
        // 사용자가 결제 시트 취소한 경우는 정상 흐름 — 로그만
        if (err?.code === 'E_USER_CANCELLED') return;
        console.warn('[proStore] purchase error:', err?.code, err?.message);
      });

      listenersAttached = true;
    }
    return true;
  } catch (e) {
    console.warn('[proStore] initConnection 실패:', e);
    return false;
  }
}

/** 결제 화면 unmount 시 호출 (선택). */
export async function endIapConnection(): Promise<void> {
  try {
    purchaseUpdateSub?.remove();
    purchaseErrorSub?.remove();
    purchaseUpdateSub = null;
    purchaseErrorSub = null;
    listenersAttached = false;
    if (connectionReady && iapModule) {
      await iapModule.endConnection();
      connectionReady = false;
    }
  } catch {
    // ignore
  }
}

/** 스토어에서 상품 정보 (현지화 가격 포함) 조회. */
export async function fetchProProduct(): Promise<ProProductInfo | null> {
  if (!canUseIap() || !iapModule) return null;
  await initIapConnection();
  try {
    // react-native-iap 15.x: fetchProducts (이전 12.x 의 getProducts 대체)
    const products: any = await iapModule.fetchProducts({
      skus: [PRO_PRODUCT_ID],
      type: 'in-app',
    });
    const list: any[] = Array.isArray(products) ? products : [];
    const p = list[0];
    if (!p) return null;
    return {
      productId: p.productId || p.id || PRO_PRODUCT_ID,
      price: p.displayPrice || p.localizedPrice || p.price || PRO_DISPLAY_PRICE,
      title: p.title || p.displayName || 'Triplive PRO',
      description: p.description || '광고 없이 깔끔하게 여행 기록하기',
    };
  } catch (e) {
    console.warn('[proStore] fetchProducts 실패:', e);
    return null;
  }
}

/**
 * PRO 구매 시작.
 * 성공 시 purchaseUpdatedListener 가 setProActive 호출 → UI 즉시 PRO 모드.
 * 사용자가 취소하면 throw — 호출부에서 silent 처리 권장.
 */
export async function buyPro(): Promise<void> {
  if (!canUseIap() || !iapModule) {
    throw new Error('이 빌드에서는 결제를 사용할 수 없어요.');
  }
  await initIapConnection();
  // react-native-iap 15.x: 새 API — request 객체에 플랫폼별 prop
  await iapModule.requestPurchase({
    request: {
      ios: { sku: PRO_PRODUCT_ID },
      android: { skus: [PRO_PRODUCT_ID] },
    },
    type: 'in-app',
  });
}

/**
 * 이전 구매 복원 — 다른 기기 / 재설치 / 환불 후 재구매 시.
 * Apple/Google 정책상 반드시 노출되어야 하는 기능.
 * @returns 복원 성공 여부 (이 계정으로 PRO 구매 이력 있으면 true)
 */
export async function restorePurchases(): Promise<boolean> {
  if (!canUseIap() || !iapModule) return false;
  await initIapConnection();
  try {
    const purchases = await iapModule.getAvailablePurchases();
    const proPurchase = purchases.find((p: any) => p.productId === PRO_PRODUCT_ID);
    if (!proPurchase) return false;
    await setProActive({
      type: 'lifetime',
      receiptId: proPurchase.transactionId || (proPurchase as any).purchaseToken || 'restored',
    });
    return true;
  } catch (e) {
    console.warn('[proStore] restore 실패:', e);
    return false;
  }
}
