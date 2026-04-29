import { Linking, Platform, Alert } from 'react-native';

/**
 * 지도 딥링크 유틸 (구글지도 우선)
 *
 * 열기 순서:
 *   1. 구글지도 앱 (설치돼 있으면)
 *   2. 애플지도 (iOS, 구글지도 없을 때)
 *   3. 브라우저 (모두 실패 시)
 *
 * 완전 무료, API 키 불필요!
 */

export interface MapLocation {
  lat: number;
  lng: number;
  label?: string;
  address?: string;
}

/**
 * URL을 순차적으로 시도해서 여는 함수
 */
const tryOpenUrls = async (urls: string[]): Promise<boolean> => {
  for (const url of urls) {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return true;
      }
    } catch (err) {
      console.warn(`[지도] ${url} 열기 실패:`, err);
    }
  }
  return false;
};

/**
 * 검색어 기반 구글 지도 열기 (좌표 없이 동작)
 *
 * 사용 예: openMapsBySearch("센소지 아사쿠사 도쿄")
 *   → iOS: 구글지도 앱 → 브라우저
 *   → Android: 기본 지도 앱 → 브라우저
 *
 * 좌표가 없는 데이터(추천 장소 카드)에서 정확한 검색어로 바로 지도 열기 용도.
 */
export const openMapsBySearch = async (query: string): Promise<void> => {
  const q = query.trim();
  if (!q) {
    Alert.alert('알림', '검색어가 없어요');
    return;
  }
  const encoded = encodeURIComponent(q);
  const urls = Platform.OS === 'ios'
    ? [
        `comgooglemaps://?q=${encoded}`,
        `https://www.google.com/maps/search/?api=1&query=${encoded}`,
      ]
    : [
        `geo:0,0?q=${encoded}`,
        `https://www.google.com/maps/search/?api=1&query=${encoded}`,
      ];
  const ok = await tryOpenUrls(urls);
  if (!ok) {
    Alert.alert('지도 열기 실패', '인터넷 연결을 확인해주세요.');
  }
};

/**
 * 지도에서 위치 보기
 */
export const openInMaps = async (location: MapLocation): Promise<void> => {
  const { lat, lng, label } = location;

  if (!lat || !lng) {
    Alert.alert('위치 정보 없음', '이 장소는 좌표 정보가 없어서 지도에서 열 수 없어요.');
    return;
  }

  const encodedLabel = encodeURIComponent(label || '위치');

  // 우선순위: 구글지도 앱 → 애플지도(iOS) → 브라우저
  const urls =
    Platform.OS === 'ios'
      ? [
          // 1. 구글지도 iOS 앱 (comgooglemaps://)
          `comgooglemaps://?q=${encodedLabel}&center=${lat},${lng}&zoom=15`,
          // 2. 애플지도
          `maps://?ll=${lat},${lng}&q=${encodedLabel}`,
          // 3. 브라우저 → 구글지도 웹
          `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
        ]
      : [
          // Android: geo 인텐트 → 지도 앱 선택 다이얼로그
          `geo:${lat},${lng}?q=${lat},${lng}(${encodedLabel})`,
          // 안 되면 구글지도 웹
          `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
        ];

  const ok = await tryOpenUrls(urls);
  if (!ok) {
    Alert.alert('지도 열기 실패', '지도 앱을 열 수 없어요.');
  }
};

/**
 * 길찾기 (현재 위치 → 목적지)
 */
export const openDirections = async (location: MapLocation): Promise<void> => {
  const { lat, lng, label } = location;

  if (!lat || !lng) {
    Alert.alert('위치 정보 없음', '이 장소는 좌표 정보가 없어서 길찾기를 할 수 없어요.');
    return;
  }

  // label은 길찾기에서 destination 좌표로만 라우팅하므로 사용하지 않음 (검색과 달리)
  void label;

  const urls =
    Platform.OS === 'ios'
      ? [
          // 1. 구글지도 iOS 앱 길찾기
          `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
          // 2. 애플지도 길찾기
          `maps://?daddr=${lat},${lng}&dirflg=d`,
          // 3. 브라우저
          `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        ]
      : [
          // Android: 구글지도 네비게이션 바로 시작
          `google.navigation:q=${lat},${lng}`,
          // fallback
          `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        ];

  const ok = await tryOpenUrls(urls);
  if (!ok) {
    Alert.alert('길찾기 실패', '지도 앱을 열 수 없어요.');
  }
};

/**
 * 이름/주소로 검색
 */
export const searchInMaps = async (query: string): Promise<void> => {
  if (!query || !query.trim()) return;

  const encoded = encodeURIComponent(query.trim());

  const urls =
    Platform.OS === 'ios'
      ? [
          // 1. 구글지도 앱
          `comgooglemaps://?q=${encoded}`,
          // 2. 애플지도
          `maps://?q=${encoded}`,
          // 3. 브라우저
          `https://www.google.com/maps/search/?api=1&query=${encoded}`,
        ]
      : [
          `geo:0,0?q=${encoded}`,
          `https://www.google.com/maps/search/?api=1&query=${encoded}`,
        ];

  const ok = await tryOpenUrls(urls);
  if (!ok) {
    Alert.alert('지도 열기 실패', '지도 앱을 열 수 없어요.');
  }
};

/**
 * 선택 다이얼로그 — 지도 보기 vs 길찾기
 */
export const showMapOptions = (location: MapLocation): void => {
  const { lat, lng, label } = location;

  if (!lat || !lng) {
    // 좌표 없으면 이름으로 검색
    if (label) {
      searchInMaps(label);
    } else {
      Alert.alert('위치 정보 없음', '이 장소는 지도에서 열 수 없어요.');
    }
    return;
  }

  Alert.alert(
    label || '지도 열기',
    '무엇을 하시겠어요?',
    [
      { text: '취소', style: 'cancel' },
      { text: '📍 지도에서 보기', onPress: () => openInMaps(location) },
      { text: '🧭 길찾기', onPress: () => openDirections(location) },
    ],
    { cancelable: true }
  );
};
