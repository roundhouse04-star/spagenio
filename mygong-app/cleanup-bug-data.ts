// ============================================================
// 버그 데이터 정리: artistId = 0인 데이터만 삭제
// 사용자가 직접 등록한 티켓(source='user')은 보존
// ============================================================

import { getDB } from './src/db/database';

export async function cleanupBugData() {
  const db = await getDB();
  
  console.log('[CLEANUP] 시작: artistId = 0인 버그 데이터 삭제');
  
  // 삭제 전 확인
  const bugEvents = await db.getAllAsync<any>(
    `SELECT id, title, source FROM events 
     WHERE artistId = 0 OR artistId IS NULL`
  );
  
  console.log(`[CLEANUP] 발견: ${bugEvents.length}개`);
  
  if (bugEvents.length === 0) {
    console.log('[CLEANUP] 삭제할 데이터 없음');
    return;
  }
  
  // source='user'인 것은 제외하고 삭제
  const toDelete = bugEvents.filter(e => e.source !== 'user');
  
  console.log(`[CLEANUP] 삭제 대상: ${toDelete.length}개 (사용자 데이터 ${bugEvents.length - toDelete.length}개는 보존)`);
  
  // 삭제 실행
  const result = await db.runAsync(
    `DELETE FROM events 
     WHERE (artistId = 0 OR artistId IS NULL) 
     AND source != 'user'`
  );
  
  console.log(`[CLEANUP] 완료: ${result.changes}개 삭제됨`);
}
