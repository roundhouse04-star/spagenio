/**
 * Triplive PRO 결제 상태 관리
 *
 * ## 현재 단계 — 인프라만 준비 (미출시)
 *
 * PRO 결제 도입 시:
 *   1. expo-in-app-purchases 또는 react-native-iap 추가
 *   2. App Store Connect / Play Console에 IAP 상품 등록
 *   3. 본 모듈의 setProActive() 결제 성공 콜백에서 호출
 *   4. 광고 제거 + OCR 네트워크 폴백 활성 자동 적용
 *
 * ## PRO 가치 제안 (계획)
 *  - 광고 제거 (AdBanner)
 *  - OCR.space 네트워크 폴백 활성 → 영수증 인식률 향상 (ML Kit 실패 시)
 *  - PDF 회고 워터마크 제거 (계획)
 *  - 미래 기능 우선 액세스
 *
 * ## 현재는 항상 false
 *  - 결제 시스템 미구현
 *  - 광고/OCR 동작은 ADS_ENABLED, NETWORK_OCR_ENABLED 플래그로 통제 중
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'pro_status_v1';

interface ProStatus {
  active: boolean;
  /** 'lifetime' | 'subscription' */
  type?: 'lifetime' | 'subscription';
  /** 구독: 만료일 ISO. 평생: null */
  expiresAt?: string | null;
  /** 결제 영수증 (애플 트랜잭션 ID 등) */
  receiptId?: string;
  activatedAt?: string;
}

/**
 * 현재 PRO 상태 조회.
 * 만료된 구독은 자동으로 false 반환.
 */
export async function isProActive(): Promise<boolean> {
  try {
    const json = await AsyncStorage.getItem(KEY);
    if (!json) return false;
    const status: ProStatus = JSON.parse(json);
    if (!status.active) return false;
    if (status.type === 'subscription' && status.expiresAt) {
      return new Date(status.expiresAt).getTime() > Date.now();
    }
    return true;
  } catch {
    return false;
  }
}

/** 결제 성공 시 호출 (IAP 구현 후) */
export async function setProActive(info: Omit<ProStatus, 'active' | 'activatedAt'>): Promise<void> {
  const status: ProStatus = {
    ...info,
    active: true,
    activatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(status));
}

/** PRO 해제 (환불·구독 취소·테스트용) */
export async function clearProStatus(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
