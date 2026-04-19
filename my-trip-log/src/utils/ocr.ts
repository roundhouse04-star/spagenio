/**
 * 듀얼 엔진 영수증 OCR
 *
 * 1차: ML Kit (온디바이스, 무료, 빠름, 오프라인)
 *   - 한/일/영/중 잘됨
 *   - Expo Go에선 동작 X
 *
 * 2차 (폴백): OCR.space (서버형, 무료 25k회/월)
 *   - 태국어 등 80+ 언어
 *   - Expo Go에서도 동작
 *   - 속도 3~5초
 *
 * 자동 전략:
 *   1. 사용자 언어 자동 추측 (여행 중인 도시 기반)
 *   2. ML Kit 시도 → 신뢰도 0.4 이상이면 OK
 *   3. 실패 or 신뢰도 낮으면 OCR.space 시도
 *   4. 둘 다 실패하면 수동 입력
 */
import { parseReceipt, ParsedReceipt } from './receiptParser';
import { recognizeWithOcrSpace, guessOcrLanguage } from './ocrSpace';

export interface OcrResult extends ParsedReceipt {
  engine: 'mlkit' | 'ocrspace' | 'none';
  duration: number; // ms
}

interface RecognizeOptions {
  countryCode?: string;
  cityId?: string;
  defaultCurrency?: string;
  preferServer?: boolean; // true면 OCR.space 직행 (ML Kit 스킵)
  ocrSpaceApiKey?: string;
}

export async function recognizeReceiptDual(
  imageUri: string,
  options: RecognizeOptions = {}
): Promise<OcrResult> {
  const {
    countryCode,
    cityId,
    defaultCurrency = 'KRW',
    preferServer = false,
    ocrSpaceApiKey,
  } = options;

  const startTime = Date.now();
  const lang = guessOcrLanguage(countryCode, cityId);

  // 1차: ML Kit (온디바이스)
  if (!preferServer) {
    const mlKitResult = await tryMLKit(imageUri);
    if (mlKitResult && mlKitResult.rawText) {
      const parsed = parseReceipt(mlKitResult.rawText, defaultCurrency);

      // 신뢰도 0.4 이상이면 ML Kit 결과 채택
      if (parsed.confidence >= 0.4) {
        return {
          ...parsed,
          engine: 'mlkit',
          duration: Date.now() - startTime,
        };
      }

      // 낮으면 OCR.space 시도 (한글 영수증인데 ML Kit 결과가 이상할 수도)
      console.log('[OCR] ML Kit 신뢰도 낮음, OCR.space 시도');
    }
  }

  // 2차: OCR.space (서버)
  try {
    const serverResult = await recognizeWithOcrSpace(imageUri, lang, ocrSpaceApiKey);
    if (serverResult.success && serverResult.text) {
      const parsed = parseReceipt(serverResult.text, defaultCurrency);
      return {
        ...parsed,
        engine: 'ocrspace',
        duration: Date.now() - startTime,
      };
    }
  } catch (err) {
    console.error('[OCR] OCR.space 실패:', err);
  }

  // 둘 다 실패
  return {
    confidence: 0,
    rawText: '',
    engine: 'none',
    duration: Date.now() - startTime,
  };
}

/** ML Kit 시도 (동적 import) */
async function tryMLKit(imageUri: string): Promise<{ rawText: string } | null> {
  try {
    // @ts-ignore
    const mod = await import('@react-native-ml-kit/text-recognition');
    const TextRecognition = mod.default ?? mod;
    const result = await TextRecognition.recognize(imageUri);
    return { rawText: result?.text ?? '' };
  } catch {
    return null; // Expo Go 또는 미설치
  }
}

/** 두 엔진 모두 사용 가능한지 체크 */
export async function getOcrStatus(): Promise<{
  mlkit: boolean;
  ocrspace: boolean;
}> {
  // ML Kit 체크
  let mlkit = false;
  try {
    // @ts-ignore
    await import('@react-native-ml-kit/text-recognition');
    mlkit = true;
  } catch {
    mlkit = false;
  }

  // OCR.space는 항상 사용 가능 (네트워크만 있으면)
  return { mlkit, ocrspace: true };
}
