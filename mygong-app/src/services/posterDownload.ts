/**
 * 이미지 다운로드 서비스
 * 포스터 이미지를 로컬에 저장하고 경로 반환
 */

import * as FileSystem from 'expo-file-system/legacy';

const POSTERS_DIR = `${FileSystem.documentDirectory}posters/`;

/**
 * HTTP URL을 HTTPS로 변환 (iOS ATS 정책 준수)
 */
function ensureHttps(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // HTTP를 HTTPS로 변경
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  
  return url;
}

/**
 * 포스터 디렉토리 초기화
 */
export async function initPostersDirectory(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(POSTERS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(POSTERS_DIR, { intermediates: true });
    console.log('[IMAGE] 포스터 디렉토리 생성:', POSTERS_DIR);
  }
}

/**
 * 포스터 이미지 다운로드 및 로컬 저장
 * 
 * @param posterUrl KOPIS 포스터 URL
 * @param eventId 이벤트 ID (파일명으로 사용)
 * @returns 로컬 파일 경로 또는 null
 */
export async function downloadPoster(
  posterUrl: string | null | undefined,
  eventId: string
): Promise<string | null> {
  if (!posterUrl) return null;
  
  try {
    // 디렉토리 확인
    await initPostersDirectory();
    
    // HTTP → HTTPS 변환 (iOS ATS 정책)
    const secureUrl = ensureHttps(posterUrl);
    if (!secureUrl) return null;
    
    // 파일명: eventId.jpg
    const filename = `${eventId}.jpg`;
    const localPath = `${POSTERS_DIR}${filename}`;
    
    // 이미 다운로드된 파일이 있으면 스킵
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      console.log(`[IMAGE] 이미 존재: ${filename}`);
      return localPath;
    }
    
    // 다운로드
    console.log(`[IMAGE] 다운로드 시작: ${filename} (HTTPS)`);
    const downloadResult = await FileSystem.downloadAsync(secureUrl, localPath);
    
    if (downloadResult.status === 200) {
      console.log(`[IMAGE] 다운로드 완료: ${filename}`);
      return localPath;
    } else {
      // console.error(`[IMAGE] 다운로드 실패: ${filename} (status: ${downloadResult.status})`);
      return null;
    }
  } catch (error) {
    // console.error(`[IMAGE] 다운로드 에러 (${eventId}):`, error);
    return null;
  }
}

/**
 * 배치로 포스터 다운로드 (병렬 처리)
 * 
 * @param posters { eventId: string, posterUrl: string }[]
 * @param batchSize 동시 다운로드 개수 (기본: 5)
 * @returns { eventId: string, localPath: string | null }[]
 */
export async function downloadPostersInBatch(
  posters: Array<{ eventId: string; posterUrl: string | null }>,
  batchSize: number = 5
): Promise<Array<{ eventId: string; localPath: string | null }>> {
  const results: Array<{ eventId: string; localPath: string | null }> = [];
  
  console.log(`[IMAGE] 배치 다운로드 시작: ${posters.length}개 (배치 크기: ${batchSize})`);
  
  for (let i = 0; i < posters.length; i += batchSize) {
    const batch = posters.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async ({ eventId, posterUrl }) => ({
      eventId,
      localPath: await downloadPoster(posterUrl, eventId),
    }));
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    const progress = Math.min(i + batchSize, posters.length);
    console.log(`[IMAGE] 다운로드 진행: ${progress}/${posters.length}`);
  }
  
  const successCount = results.filter(r => r.localPath !== null).length;
  console.log(`[IMAGE] 배치 다운로드 완료: ${successCount}/${posters.length} 성공`);
  
  return results;
}

/**
 * 오래된 포스터 파일 정리
 * 
 * @param daysOld 며칠 이상 오래된 파일 삭제 (기본: 30일)
 */
export async function cleanupOldPosters(daysOld: number = 30): Promise<number> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(POSTERS_DIR);
    if (!dirInfo.exists) return 0;
    
    const files = await FileSystem.readDirectoryAsync(POSTERS_DIR);
    const now = Date.now();
    const maxAge = daysOld * 24 * 60 * 60 * 1000;
    
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = `${POSTERS_DIR}${file}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      if (fileInfo.exists && fileInfo.modificationTime) {
        const age = now - fileInfo.modificationTime * 1000;
        
        if (age > maxAge) {
          await FileSystem.deleteAsync(filePath);
          deletedCount++;
        }
      }
    }
    
    console.log(`[IMAGE] 정리 완료: ${deletedCount}개 파일 삭제 (${daysOld}일 이상)`);
    return deletedCount;
  } catch (error) {
    // console.error('[IMAGE] 정리 실패:', error);
    return 0;
  }
}
