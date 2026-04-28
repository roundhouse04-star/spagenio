/**
 * OCR 네트워크 호출 활성화 플래그
 *
 * ## 배포 정책
 *
 * - **무료 배포 (현재)**: `NETWORK_OCR_ENABLED = false`
 *   ML Kit 온디바이스 OCR만 사용. 외부 API 호출 0건. 사용자 데이터(영수증·티켓 이미지)
 *   가 절대 외부로 전송되지 않음.
 *
 * - **유료 배포 (향후)**: 본 상수를 `true` 로 직접 변경 후 빌드.
 *   ML Kit 우선 시도 → 실패 시 OCR.space (무료 quota) 폴백.
 *
 * ## 왜 코드 상수로 관리하는가
 * 사용자 설정으로 노출하면 정책상 모호해지므로 (개인정보처리방침 일관성),
 * 배포 단위로만 변경 가능하게 코드에 두고 빌드 시 고정.
 *
 * ## ML Kit 동작 환경
 * - EAS dev/prod build: ML Kit 정상 동작
 * - Expo Go: ML Kit 미설치라 OCR 사용 불가 (사용자에게 안내 메시지)
 */
export const NETWORK_OCR_ENABLED = false;
