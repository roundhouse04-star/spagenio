import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import Constants from 'expo-constants';

// app.json의 expo.extra.ocrSpaceApiKey 또는 EXPO_PUBLIC_OCR_SPACE_KEY 환경변수에서 키 로드
// 기본값 'helloworld'는 OCR.space 공개 데모 키 — quota·요청 크기 제한 있어 운영 부적합
const DEFAULT_API_KEY: string =
  (Constants.expoConfig?.extra as { ocrSpaceApiKey?: string } | undefined)?.ocrSpaceApiKey
  ?? process.env.EXPO_PUBLIC_OCR_SPACE_KEY
  ?? 'helloworld';
const MAX_BYTES = 1024 * 1024;

export interface OcrSpaceResult {
  success: boolean;
  text: string;
  errorMessage?: string;
}

/** OCR.space 1MB 한도에 맞게 자동 압축 */
async function ensureUnder1MB(uri: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(uri);
  const size = info.exists ? info.size : 0;
  if (size <= MAX_BYTES) {
    console.log('🗜️ 건너뜀 (' + Math.round(size / 1024) + 'KB)');
    return uri;
  }

  console.log('🗜️ 원본 ' + Math.round(size / 1024) + 'KB → 압축 시작');

  // 3단계로 점진적 압축
  const steps: { width: number; quality: number }[] = [
    { width: 1600, quality: 0.6 },
    { width: 1200, quality: 0.5 },
    { width: 900, quality: 0.4 },
    { width: 700, quality: 0.3 },
  ];

  let result = { uri };
  for (const step of steps) {
    result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: step.width } }],
      { compress: step.quality, format: ImageManipulator.SaveFormat.JPEG }
    );
    const newInfo = await FileSystem.getInfoAsync(result.uri);
    const newSize = newInfo.exists ? newInfo.size : 0;
    console.log(`🗜️ ${step.width}px/q${step.quality}: ${Math.round(newSize / 1024)}KB`);
    if (newSize <= MAX_BYTES) return result.uri;
  }
  return result.uri; // 최후 결과라도 반환
}

export async function recognizeWithOcrSpace(
  imageUri: string,
  lang: 'kor' | 'jpn' | 'eng' | 'tha' | 'chs' = 'kor',
  apiKey: string = DEFAULT_API_KEY
): Promise<OcrSpaceResult> {
  try {
    const compressedUri = await ensureUnder1MB(imageUri);

    const base64 = await FileSystem.readAsStringAsync(compressedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const formData = new FormData();
    formData.append('apikey', apiKey);
    formData.append('language', lang);
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2');
    formData.append('base64Image', `data:image/jpeg;base64,${base64}`);

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
    });

    const json = await response.json();

    if (json.IsErroredOnProcessing) {
      console.error('📡 OCR.space 오류:', json.ErrorMessage);
      return {
        success: false,
        text: '',
        errorMessage: json.ErrorMessage?.[0] || '알 수 없는 오류',
      };
    }

    const text = json.ParsedResults?.[0]?.ParsedText ?? '';
    return { success: !!text, text };
  } catch (err) {
    console.error('🔥 OCR.space 예외:', err);
    return { success: false, text: '', errorMessage: String(err) };
  }
}

/** 도시/국가 → OCR 언어 (한글 도시명도 지원) */
export function guessOcrLanguage(
  countryCode?: string,
  cityId?: string
): 'kor' | 'jpn' | 'eng' | 'tha' | 'chs' {
  if (!countryCode && !cityId) return 'kor';

  const code = (countryCode || '').toUpperCase();
  const city = (cityId || '').toLowerCase();

  // 한국 (영어/한글 둘 다)
  if (code === 'KR' || /seoul|busan|서울|부산|대구|인천|광주|대전/.test(city)) return 'kor';
  // 일본
  if (code === 'JP' || /tokyo|osaka|kyoto|fukuoka|sapporo|도쿄|오사카|교토|후쿠오카|삿포로/.test(city)) return 'jpn';
  // 태국
  if (code === 'TH' || /bangkok|방콕/.test(city)) return 'tha';
  // 중화권
  if (['CN', 'HK', 'TW'].includes(code) || /shanghai|beijing|hongkong|taipei|상하이|베이징|홍콩|타이페이/.test(city)) return 'chs';

  return 'eng'; // 나머지는 영어
}
