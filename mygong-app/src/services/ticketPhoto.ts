/**
 * 티켓 사진 영구 저장 유틸리티.
 *
 * 문제:
 *   ImagePicker 가 반환하는 uri 는 임시 cache 경로:
 *     file:///var/mobile/Containers/.../tmp/ImagePicker/xxx.jpg
 *   앱 UUID 가 prebuild·재설치 후 바뀌면 → 못 찾음.
 *
 * 해결:
 *   1. ImagePicker 결과 → Documents/tickets/ 로 복사 (영구 저장)
 *   2. DB 에는 "tickets/xxx.jpg" 같은 상대 경로 저장
 *   3. 표시 시 → 현재 documentDirectory + 상대 경로로 변환
 *
 * 효과:
 *   - 앱 UUID 가 바뀌어도 사진 유지
 *   - DB 가 호환됨 (상대 경로니까)
 *
 * 호환성:
 *   - 기존 절대 경로 (file://...) 도 그대로 표시 시도 (마이그레이션 전)
 *   - 못 찾으면 빈 경로 처리
 */

import * as FileSystem from 'expo-file-system/legacy';

const PHOTOS_DIR = 'tickets/';
const PHOTOS_FULL_PATH = (FileSystem.documentDirectory ?? '') + PHOTOS_DIR;

/** 폴더 보장 */
async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PHOTOS_FULL_PATH);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_FULL_PATH, { intermediates: true });
  }
}

/**
 * ImagePicker 결과 uri 를 Documents 로 복사하고 상대 경로 반환.
 * @returns "tickets/xxx.jpg" 형태 상대 경로 (DB 저장용)
 */
export async function savePhoto(sourceUri: string): Promise<string> {
  await ensureDir();
  const ext = (sourceUri.split('.').pop() ?? 'jpg').split('?')[0].toLowerCase();
  const safeExt = ['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(ext) ? ext : 'jpg';
  const fileName = `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${safeExt}`;
  const destPath = PHOTOS_FULL_PATH + fileName;

  await FileSystem.copyAsync({ from: sourceUri, to: destPath });
  console.log('[photo] saved:', fileName);
  return PHOTOS_DIR + fileName;
}

/**
 * 상대 경로 → 표시 가능한 절대 경로 (file://...)
 * 기존 절대 경로 (file:// 또는 /var/...) 는 그대로 통과.
 */
export function resolvePhotoUri(stored?: string | null): string | undefined {
  if (!stored) return undefined;

  // 이미 절대 경로 (file:// 시작) → 그대로
  if (stored.startsWith('file://')) return stored;
  if (stored.startsWith('/')) return 'file://' + stored;

  // http(s) 원격 → 그대로
  if (stored.startsWith('http://') || stored.startsWith('https://')) return stored;

  // 상대 경로 → documentDirectory 기준 절대 경로
  return (FileSystem.documentDirectory ?? '') + stored;
}

/**
 * 사진 파일 삭제 (티켓 사진 제거 시).
 * 실패해도 무시 (이미 없을 수도 있음).
 */
export async function deletePhoto(stored?: string | null): Promise<void> {
  if (!stored) return;
  try {
    const abs = resolvePhotoUri(stored);
    if (!abs) return;
    // 상대 경로 저장된 것만 안전하게 삭제 (외부 경로는 우리 책임 X)
    if (stored.startsWith(PHOTOS_DIR)) {
      await FileSystem.deleteAsync(abs.replace('file://', ''), { idempotent: true });
      console.log('[photo] deleted:', stored);
    }
  } catch (e) {
    console.warn('[photo] delete failed:', e);
  }
}

/**
 * photoUri 가 실제로 파일이 존재하는지 확인.
 */
export async function photoExists(stored?: string | null): Promise<boolean> {
  if (!stored) return false;
  try {
    const abs = resolvePhotoUri(stored);
    if (!abs) return false;
    if (abs.startsWith('http')) return true; // 원격은 가정
    const info = await FileSystem.getInfoAsync(abs);
    return info.exists;
  } catch {
    return false;
  }
}

/**
 * DB 의 모든 photoUri 정리 — 파일 없는 것은 NULL 로 만들기.
 * 앱 시작 시 한 번 실행해서 깨진 참조 청소.
 *
 * @returns 정리된 티켓 수
 */
export async function cleanupBrokenPhotoRefs(): Promise<number> {
  const { getDB } = await import('@/db/database');
  const db = await getDB();

  const rows = await db.getAllAsync<{ id: number; photo_uri: string | null }>(
    `SELECT id, photo_uri FROM tickets WHERE photo_uri IS NOT NULL`
  );

  let cleaned = 0;
  for (const r of rows) {
    const exists = await photoExists(r.photo_uri);
    if (!exists) {
      await db.runAsync(`UPDATE tickets SET photo_uri = NULL WHERE id = ?`, [r.id]);
      cleaned += 1;
      console.log(`[photo] cleaned broken ref: ticket ${r.id} (${r.photo_uri})`);
    }
  }
  if (cleaned > 0) {
    console.log(`[photo] cleanup: ${cleaned} broken photo refs cleared`);
  }
  return cleaned;
}
