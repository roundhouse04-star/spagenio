// 갤러리에서 선택한 이미지에서 QR 코드를 추출하는 헬퍼
// 흐름: ImagePicker → ImageManipulator (JPEG 변환 + 리사이즈) → jpeg-js 디코딩 → jsQR
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import jsQR from 'jsqr';

// base64 → Uint8Array (Hermes 호환, Buffer 의존성 제거)
function base64ToBytes(b64) {
  const binary = global.atob ? global.atob(b64) : null;
  if (binary == null) throw new Error('atob 미지원 환경입니다');
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// 갤러리 권한 요청 + 이미지 1장 선택
export async function pickImageFromGallery() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('사진 접근 권한이 필요합니다. 시스템 설정에서 허용해주세요.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
    allowsMultipleSelection: false,
  });
  if (result.canceled) return null;
  return result.assets?.[0]?.uri || null;
}

// 이미지 URI → QR 텍스트 (못 찾으면 null)
export async function decodeQRFromImageUri(uri) {
  // 큰 이미지는 jsQR 처리 시간이 길어지므로 1280px로 다운스케일 + JPEG로 통일
  const manip = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }],
    { format: ImageManipulator.SaveFormat.JPEG, base64: true, compress: 0.92 },
  );
  if (!manip.base64) throw new Error('이미지 변환에 실패했습니다');

  const bytes = base64ToBytes(manip.base64);
  const decoded = jpeg.decode(bytes, { useTArray: true });
  // jsQR은 RGBA Uint8ClampedArray를 요구
  const clamped = new Uint8ClampedArray(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength);
  const code = jsQR(clamped, decoded.width, decoded.height, {
    inversionAttempts: 'attemptBoth',
  });
  return code?.data || null;
}

// 한 번에: 갤러리 선택 → QR 디코드
export async function pickAndDecodeQR() {
  const uri = await pickImageFromGallery();
  if (!uri) return { canceled: true };
  const data = await decodeQRFromImageUri(uri);
  if (!data) return { canceled: false, found: false, uri };
  return { canceled: false, found: true, uri, data };
}
