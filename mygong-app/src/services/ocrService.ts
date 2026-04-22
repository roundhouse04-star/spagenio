/**
 * 온디바이스 OCR 서비스.
 *
 * @react-native-ml-kit/text-recognition 을 래핑. 네이티브 모듈이라 Expo Go 에선
 * 로드 실패 → 호출 측에서 isOcrAvailable() 먼저 체크하고 안내 메시지 표시.
 *
 * dev-client 빌드 (`npx eas build --profile preview` 또는 `npx expo run:ios`)
 * 로 네이티브 링킹 되면 정상 동작.
 */

let _mlKit: any = null;
let _probeAttempted = false;

function probeMLKit(): any {
  if (_probeAttempted) return _mlKit;
  _probeAttempted = true;
  try {
    // require 를 사용해야 정적 import 로 인한 번들 타임 크래시 피할 수 있음
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-ml-kit/text-recognition');
    _mlKit = mod?.default ?? mod;
  } catch (e) {
    console.log('[ocr] native module not available (Expo Go):', (e as any)?.message);
    _mlKit = null;
  }
  return _mlKit;
}

/** 네이티브 모듈이 로드 가능한지 (= dev-client 인지) */
export function isOcrAvailable(): boolean {
  return !!probeMLKit();
}

/** 이미지에서 텍스트 추출. Expo Go 에선 null 반환 */
export async function extractTextFromImage(uri: string): Promise<string | null> {
  const kit = probeMLKit();
  if (!kit) return null;
  try {
    // ML Kit API: TextRecognition.recognize(uri) → { text, blocks }
    const result = await kit.recognize(uri);
    return result?.text ?? '';
  } catch (e: any) {
    console.warn('[ocr] extract failed:', e?.message ?? e);
    throw new Error(`OCR 실패: ${e?.message ?? String(e)}`);
  }
}

/** 사용자에게 표시할 안내문 (Expo Go 일 때) */
export const OCR_UNAVAILABLE_MSG =
  'OCR 자동 추출은 dev-client 빌드에서만 동작해요.\n\n' +
  '터미널에서 npx eas build --profile preview 실행 후\n' +
  '빌드된 앱을 설치하면 사용 가능합니다.\n\n' +
  '지금은 수동 입력으로 티켓을 저장할 수 있어요.';
