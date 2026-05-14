/**
 * Triplive PRO 결제 상태 관리
 *
 * ## PRO 가치 제안
 *  - 광고 제거 (AdBanner)
 *  - PDF 회고 워터마크 제거 (계획)
 *  - 미래 기능 우선 액세스
 *
 * ## OCR 정책 (1.1 결정)
 *  유료 OCR API (Google Vision / NAVER CLOVA 등) 도입하지 않음.
 *  사용자 수 증가 시 비용이 매출을 초과해서 운영 모델이 안 맞음.
 *  온디바이스 ML Kit OCR 만 사용 (비용 0, 정확도 ~80%).
 *  정확도 보완은 사용자 수동 보정 UI 강화 방향.
 *
 * ## 결제 흐름
 *   1. proStore.ts 의 buyPro() → Apple/Google 결제
 *   2. RevenueCat 영수증 검증
 *   3. setProActive() 로 로컬 PRO 상태 저장
 *   4. 광고 자동 제거 (AdBanner 가 isProActive() 체크)
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
