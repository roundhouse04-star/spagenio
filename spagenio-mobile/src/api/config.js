// API 베이스 URL.
// - 운영: https://www.spagenio.com (cloudflared 터널)
// - 로컬 개발: http://<your-mac-ip>:3000  (iOS 시뮬레이터는 localhost 가능, 안드 에뮬은 10.0.2.2)
//   디바이스에서 테스트하려면 같은 와이파이 + Mac IP (예: http://192.168.0.10:3000)
export const API_BASE_URL = 'https://www.spagenio.com';

// 응답 시간 제한 (ms)
export const REQUEST_TIMEOUT = 15000;
