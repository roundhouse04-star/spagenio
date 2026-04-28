/**
 * 티켓 이미지 저장 (영구)
 *
 * 카메라/갤러리에서 선택한 이미지를 압축 후 documentDirectory/tickets/ 로 영구 복사.
 * cache 디렉토리는 OS가 자유롭게 삭제 가능하므로 영구 저장 불가.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

const TICKET_DIR = FileSystem.documentDirectory + 'tickets/';
const TARGET_WIDTH = 1600;
const TARGET_QUALITY = 0.7;

export async function ensureTicketDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(TICKET_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(TICKET_DIR, { intermediates: true });
  }
}

/**
 * 임시 URI → 압축 후 영구 저장. 영구 URI 반환.
 * 이미 압축된 파일도 한 번 더 매니퓰레이션 거치는 비용은 미미하며,
 * 저장소 사용량을 일정하게 유지하기 위해 항상 압축.
 */
export async function saveTicketImage(sourceUri: string): Promise<string> {
  await ensureTicketDir();

  const compressed = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: TARGET_WIDTH } }],
    { compress: TARGET_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );

  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const filename = `ticket_${timestamp}_${random}.jpg`;
  const targetUri = TICKET_DIR + filename;

  await FileSystem.copyAsync({ from: compressed.uri, to: targetUri });
  return targetUri;
}

export async function deleteTicketImage(uri: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch (err) {
    console.warn('[ticket] 이미지 삭제 실패:', err);
  }
}

export async function clearAllTicketImages(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(TICKET_DIR);
    if (info.exists) {
      await FileSystem.deleteAsync(TICKET_DIR, { idempotent: true });
    }
  } catch {
    // 무시
  }
}
