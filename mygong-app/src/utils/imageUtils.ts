/**
 * 포스터 이미지 경로 유틸
 * iOS는 앱 재시작 시 documentDirectory 경로가 변경되므로
 * DB에는 파일명만 저장하고, 표시할 때 전체 경로로 변환
 */

import * as FileSystem from 'expo-file-system/legacy';

/**
 * posterUrl을 올바른 URI로 변환
 * 
 * @param url - DB에 저장된 posterUrl (파일명 또는 전체 URL)
 * @returns 표시 가능한 URI (file:// 또는 https://)
 * 
 * @example
 * // 파일명만 있는 경우
 * getPosterUri('PF123456.jpg')
 * // → 'file:///.../Documents/posters/PF123456.jpg'
 * 
 * // 이미 전체 경로인 경우 (기존 데이터 호환)
 * getPosterUri('https://kopis.or.kr/...jpg')
 * // → 'https://kopis.or.kr/...jpg'
 */
export function getPosterUri(url?: string | null): string | undefined {
  if (!url) return undefined;
  
  // 이미 전체 경로면 그대로 사용 (기존 데이터 호환)
  if (url.startsWith('file://') || url.startsWith('http://') || url.startsWith('https://')) {
    // HTTP → HTTPS 변환 (iOS ATS 정책)
    return url.replace(/^http:\/\//i, 'https://');
  }
  
  // 파일명만 있으면 로컬 경로 생성
  return `${FileSystem.documentDirectory}posters/${url}`;
}

/**
 * URL을 HTTPS로 변환 (iOS ATS 정책)
 */
export function secureUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.replace(/^http:\/\//i, 'https://');
}
