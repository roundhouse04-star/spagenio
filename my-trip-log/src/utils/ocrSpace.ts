/**
 * OCR.space API 래퍼
 *
 * 무료 할당: 월 25,000회
 * API Key: helloworld (공용) 또는 개인 키 발급 가능 (https://ocr.space/ocrapi)
 *
 * 지원 언어 80+ : 한국어, 일본어, 중국어, 태국어, 베트남어, 영어, 유럽 대부분
 *
 * 장점: Expo Go에서도 동작 (HTTP 요청만)
 * 단점: 서버 거침 (프라이버시 이슈 가능), 속도 3~5초
 */
import * as FileSystem from 'expo-file-system';

// 언어 코드 매핑 (OCR.space 기준)
const LANG_MAP: Record<string, string> = {
  'ko': 'kor',       // 한국어
  'ja': 'jpn',       // 일본어
  'zh': 'chs',       // 중국어 간체
  'en': 'eng',       // 영어
  'th': 'tha',       // 태국어
  'vi': 'vie',       // 베트남어 - 지원 안함, fallback to eng
  'auto': 'eng',     // 기본은 eng (다중 인식 어려움)
};

// 공개 API 키 (무료 25,000회/월 공유)
// 개인 키 발급 추천: https://ocr.space/ocrapi/freekey
const DEFAULT_API_KEY = 'helloworld';

export interface OcrSpaceResult {
  success: boolean;
  text: string;
  errorMessage?: string;
}

/**
 * OCR.space로 이미지 텍스트 인식
 *
 * @param imageUri 로컬 이미지 경로
 * @param lang 언어 코드 (kor/jpn/eng/tha 등)
 * @param apiKey 개인 API 키 (없으면 공용)
 */
export async function recognizeWithOcrSpace(
  imageUri: string,
  lang: 'kor' | 'jpn' | 'eng' | 'tha' | 'chs' = 'eng',
  apiKey: string = DEFAULT_API_KEY
): Promise<OcrSpaceResult> {
  try {
    // 이미지를 base64로 변환
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 이미지 크기 체크 (OCR.space 무료는 1MB 제한)
    const info = await FileSystem.getInfoAsync(imageUri);
    if (info.exists && info.size && info.size > 1024 * 1024) {
      console.warn('[OCR.space] 이미지 1MB 초과, 압축 필요');
    }

    // API 호출
    const formData = new FormData();
    formData.append('apikey', apiKey);
    formData.append('language', lang);
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2'); // Engine 2가 정확도 높음
    formData.append('base64Image', `data:image/jpeg;base64,${base64}`);

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
    });

    const json = await response.json();

    if (json.IsErroredOnProcessing) {
      return {
        success: false,
        text: '',
        errorMessage: json.ErrorMessage?.[0] || '알 수 없는 오류',
      };
    }

    const text = json.ParsedResults?.[0]?.ParsedText ?? '';
    return {
      success: !!text,
      text,
    };
  } catch (err) {
    return {
      success: false,
      text: '',
      errorMessage: String(err),
    };
  }
}

/**
 * 도시/국가 → 적절한 OCR 언어 코드 추측
 *
 * 여행 중이면 여행 도시에 따라 자동 선택
 */
export function guessOcrLanguage(countryCode?: string, cityId?: string): 'kor' | 'jpn' | 'eng' | 'tha' | 'chs' {
  if (!countryCode && !cityId) return 'kor'; // 기본

  const code = (countryCode || '').toUpperCase();
  const city = (cityId || '').toLowerCase();

  if (code === 'KR' || city === 'seoul' || city === 'busan') return 'kor';
  if (code === 'JP' || ['tokyo', 'osaka', 'kyoto', 'fukuoka', 'sapporo'].includes(city)) return 'jpn';
  if (code === 'TH' || city === 'bangkok') return 'tha';
  if (code === 'CN' || ['shanghai', 'beijing'].includes(city)) return 'chs';
  if (['HK', 'TW'].includes(code) || ['hongkong', 'taipei'].includes(city)) return 'chs';

  return 'eng'; // 나머지는 영어 (유럽/미국/동남아 영어권)
}
