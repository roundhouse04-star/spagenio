/**
 * 영수증/티켓 OCR — ML Kit 온디바이스 전용
 *
 * ## 1.1 정책
 *  유료 / 네트워크 OCR (Google Vision, OCR.space 등) 도입하지 않음.
 *  - 비용 0
 *  - 사용자 이미지 외부 전송 0 (개인정보 보호)
 *  - 정확도 ~80% (수동 보정 UI 로 보완)
 *
 * ## ML Kit 동작 환경
 *  - EAS dev/prod build: 정상 동작
 *  - Expo Go: ML Kit native 모듈 없어서 미동작 → 'none' 반환
 *    (호출 측에서 사용자에게 "이 빌드에서는 OCR 사용 불가" 안내)
 */
import { parseReceipt, ParsedReceipt } from './receiptParser';

export interface OcrResult extends ParsedReceipt {
  engine: 'mlkit' | 'none';
  duration: number;
  lang?: 'kor' | 'jpn' | 'eng' | 'tha' | 'chs';
}

interface RecognizeOptions {
  countryCode?: string;
  cityId?: string;
  defaultCurrency?: string;
}

export async function recognizeReceiptDual(
  imageUri: string,
  options: RecognizeOptions = {}
): Promise<OcrResult> {
  const { defaultCurrency = 'KRW' } = options;
  const startTime = Date.now();

  const mlKitResult = await tryMLKit(imageUri);
  if (mlKitResult?.rawText) {
    const parsed = parseReceipt(mlKitResult.rawText, defaultCurrency);
    if (parsed.confidence >= 0.4) {
      return {
        ...parsed,
        engine: 'mlkit',
        duration: Date.now() - startTime,
      };
    }
  }

  return {
    confidence: 0,
    rawText: '',
    engine: 'none',
    duration: Date.now() - startTime,
  };
}

/**
 * Raw text OCR — 영수증 파서를 거치지 않고 원본 텍스트만 필요한 경우용 (티켓 등).
 */
export async function recognizeRawText(
  imageUri: string,
): Promise<{ text: string; engine: 'mlkit' | 'none' }> {
  const ml = await tryMLKit(imageUri);
  if (ml?.rawText && ml.rawText.trim().length > 0) {
    return { text: ml.rawText, engine: 'mlkit' };
  }
  return { text: '', engine: 'none' };
}

async function tryMLKit(imageUri: string): Promise<{ rawText: string } | null> {
  try {
    const mod: {
      default?: { recognize: (uri: string) => Promise<{ text?: string }> };
      recognize?: (uri: string) => Promise<{ text?: string }>;
    } = await import('@react-native-ml-kit/text-recognition');
    const TextRecognition = mod.default ?? mod;
    const result = await TextRecognition.recognize!(imageUri);
    return { rawText: result?.text ?? '' };
  } catch {
    return null;
  }
}

export async function getOcrStatus(): Promise<{ mlkit: boolean }> {
  try {
    await import('@react-native-ml-kit/text-recognition');
    return { mlkit: true };
  } catch {
    // Expo Go 등 — ML Kit native 모듈 없음
    return { mlkit: false };
  }
}
