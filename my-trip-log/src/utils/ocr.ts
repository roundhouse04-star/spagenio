/**
 * 듀얼 엔진 OCR (영수증/티켓 공통)
 *
 * 1차: ML Kit (온디바이스, 무료, 네트워크 0)
 * 2차: OCR.space (네트워크) — `NETWORK_OCR_ENABLED=true` 일 때만 동작
 *
 * 무료 배포에서는 NETWORK_OCR_ENABLED=false 라 ML Kit만 사용.
 * Expo Go 환경은 ML Kit 미동작이므로 OCR 사용 불가 — 호출 측에서 'none' 처리.
 */
import { parseReceipt, ParsedReceipt } from './receiptParser';
import { recognizeWithOcrSpace, guessOcrLanguage } from './ocrSpace';
import { NETWORK_OCR_ENABLED } from '@/config/ocr';
import { isProActive } from './proStatus';

/**
 * OCR.space 네트워크 폴백 사용 가능 여부.
 * - 무료 사용자: NETWORK_OCR_ENABLED 플래그(=false)
 * - PRO 사용자: 자동으로 true (인식률 향상 혜택)
 */
async function isNetworkOcrAllowed(): Promise<boolean> {
  if (NETWORK_OCR_ENABLED) return true;
  return await isProActive();
}

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

  // 2차: OCR.space — 무료 배포에서는 비활성, PRO 사용자에게는 자동 활성
  const networkAllowed = await isNetworkOcrAllowed();
  if (networkAllowed) {
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
  }

  return {
    confidence: 0,
    rawText: '',
    engine: 'none',
    duration: Date.now() - startTime,
    lang,
  };
}

/**
 * Raw text OCR — 영수증 파서를 거치지 않고 원본 텍스트만 필요한 경우용 (티켓 등).
 * 동일하게 NETWORK_OCR_ENABLED 플래그 존중.
 */
export async function recognizeRawText(
  imageUri: string,
  options: { countryCode?: string; cityId?: string; forceLang?: 'kor' | 'jpn' | 'eng' | 'tha' | 'chs' } = {},
): Promise<{ text: string; engine: 'mlkit' | 'ocrspace' | 'none' }> {
  const lang = options.forceLang ?? guessOcrLanguage(options.countryCode, options.cityId);

  // 1차: ML Kit (온디바이스)
  const ml = await tryMLKit(imageUri);
  if (ml?.rawText && ml.rawText.trim().length > 0) {
    return { text: ml.rawText, engine: 'mlkit' };
  }

  // 2차: OCR.space — 플래그 또는 PRO 사용자만 호출
  const networkAllowed = await isNetworkOcrAllowed();
  if (!networkAllowed) {
    return { text: '', engine: 'none' };
  }
  try {
    const result = await recognizeWithOcrSpace(imageUri, lang);
    if (result.success && result.text) {
      return { text: result.text, engine: 'ocrspace' };
    }
  } catch (err) {
    console.error('[OCR raw text] OCR.space 예외:', err);
  }
  return { text: '', engine: 'none' };
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
    // 모듈 미설치/번들 미포함 시 — Expo Go 환경에서 정상 분기
  }
  return { mlkit, ocrspace: NETWORK_OCR_ENABLED };
}
