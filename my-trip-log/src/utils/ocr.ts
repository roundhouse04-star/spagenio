/**
 * 듀얼 엔진 영수증 OCR
 *
 * 1차: ML Kit (온디바이스) - Expo Go에선 X
 * 2차: OCR.space (서버) - 80+ 언어
 *
 * forceLang 있으면 자동 감지 대신 그 언어로만 시도
 */
import { parseReceipt, ParsedReceipt } from './receiptParser';
import { recognizeWithOcrSpace, guessOcrLanguage } from './ocrSpace';

export interface OcrResult extends ParsedReceipt {
  engine: 'mlkit' | 'ocrspace' | 'none';
  duration: number;
  lang?: 'kor' | 'jpn' | 'eng' | 'tha' | 'chs';
}

interface RecognizeOptions {
  countryCode?: string;
  cityId?: string;
  defaultCurrency?: string;
  preferServer?: boolean;
  ocrSpaceApiKey?: string;
  /** 자동 언어 감지 무시하고 이 언어로 강제 */
  forceLang?: 'kor' | 'jpn' | 'eng' | 'tha' | 'chs';
}

export async function recognizeReceiptDual(
  imageUri: string,
  options: RecognizeOptions = {}
): Promise<OcrResult> {
  const {
    countryCode, cityId, defaultCurrency = 'KRW',
    preferServer = false, ocrSpaceApiKey, forceLang,
  } = options;

  const startTime = Date.now();
  const lang = forceLang ?? guessOcrLanguage(countryCode, cityId);

  // 1차: ML Kit (forceLang 있으면 스킵 - 사용자 의도대로 특정 언어로 OCR.space)
  if (!preferServer && !forceLang) {
    const mlKitResult = await tryMLKit(imageUri);
    if (mlKitResult?.rawText) {
      const parsed = parseReceipt(mlKitResult.rawText, defaultCurrency);
      if (parsed.confidence >= 0.4) {
        return {
          ...parsed,
          engine: 'mlkit',
          duration: Date.now() - startTime,
          lang,
        };
      }
    }
  }

  // 2차: OCR.space
  try {
    const serverResult = await recognizeWithOcrSpace(imageUri, lang, ocrSpaceApiKey);
    if (serverResult.success && serverResult.text) {
      const parsed = parseReceipt(serverResult.text, defaultCurrency);
      return {
        ...parsed,
        engine: 'ocrspace',
        duration: Date.now() - startTime,
        lang,
      };
    }
  } catch (err) {
    console.error('[OCR.space] 예외:', err);
  }

  return {
    confidence: 0,
    rawText: '',
    engine: 'none',
    duration: Date.now() - startTime,
    lang,
  };
}

async function tryMLKit(imageUri: string): Promise<{ rawText: string } | null> {
  try {
    const mod: { default?: { recognize: (uri: string) => Promise<{ text?: string }> }; recognize?: (uri: string) => Promise<{ text?: string }> } = await import('@react-native-ml-kit/text-recognition');
    const TextRecognition = mod.default ?? mod;
    const result = await TextRecognition.recognize!(imageUri);
    return { rawText: result?.text ?? '' };
  } catch {
    return null;
  }
}

export async function getOcrStatus(): Promise<{ mlkit: boolean; ocrspace: boolean }> {
  let mlkit = false;
  try {
    await import('@react-native-ml-kit/text-recognition');
    mlkit = true;
  } catch {
    // 모듈 미설치/번들 미포함 시 fallback (OCR.space 사용) — 정상 분기
  }
  return { mlkit, ocrspace: true };
}
