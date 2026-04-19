/**
 * 영수증 이미지 저장
 *
 * 카메라/갤러리에서 찍은 이미지를 앱의 document directory로 복사
 * (기본 cache 디렉토리는 시스템이 자유롭게 삭제함 → 영구 저장 X)
 */
import * as FileSystem from 'expo-file-system';

const RECEIPT_DIR = FileSystem.documentDirectory + 'receipts/';

export async function ensureReceiptDir() {
  const info = await FileSystem.getInfoAsync(RECEIPT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(RECEIPT_DIR, { intermediates: true });
  }
}

/** 임시 URI → 영구 저장. 새 URI 반환 */
export async function saveReceiptImage(sourceUri: string, expenseId?: string): Promise<string> {
  await ensureReceiptDir();

  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const filename = `receipt_${timestamp}_${random}.jpg`;
  const targetUri = RECEIPT_DIR + filename;

  await FileSystem.copyAsync({ from: sourceUri, to: targetUri });
  return targetUri;
}

/** 영수증 이미지 삭제 */
export async function deleteReceiptImage(uri: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch (err) {
    console.warn('[receipt] 이미지 삭제 실패:', err);
  }
}

/** 모든 영수증 이미지 삭제 (리셋용) */
export async function clearAllReceiptImages(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(RECEIPT_DIR);
    if (info.exists) {
      await FileSystem.deleteAsync(RECEIPT_DIR, { idempotent: true });
    }
  } catch {
    // 무시
  }
}
