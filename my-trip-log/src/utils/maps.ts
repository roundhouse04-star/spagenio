import { Linking, Platform, Alert } from 'react-native';

/**
 * 지도 딥링크 유틸 — **구글 지도 전용**
 *
 * 정책: 사용자 의도에 따라 모든 외부 지도는 구글지도로 통일.
 * 애플지도 폴백 사용 안 함.
 *
 * 열기 순서:
 *   iOS:     구글지도 앱 (comgooglemaps://) → 구글지도 웹 (https)
 *   Android: 구글지도 앱 (geo: / google.navigation:) → 구글지도 웹 (https)
 *
 * 완전 무료, API 키 불필요.
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

  // 구글지도 전용: 앱 → 웹 폴백 (애플지도 사용 안 함)
  const urls =
    Platform.OS === 'ios'
      ? [
          // 1. 구글지도 iOS 앱
          `comgooglemaps://?q=${encodedLabel}&center=${lat},${lng}&zoom=15`,
          // 2. 구글지도 웹 (구글지도 앱 없을 때)
          `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
        ]
      : [
          // Android: 구글지도 표준 URL — 구글지도 앱 설치 시 자동 가로챔
          `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
          // fallback: 좌표만으로 geo 인텐트 (다른 지도 앱이 default여도 좌표는 표시됨)
          `geo:${lat},${lng}?q=${lat},${lng}(${encodedLabel})`,
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

  // 구글지도 길찾기 전용
  const urls =
    Platform.OS === 'ios'
      ? [
          // 1. 구글지도 iOS 앱 길찾기
          `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
          // 2. 구글지도 웹 길찾기
          `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        ]
      : [
          // Android: 구글 네비게이션 직진입
          `google.navigation:q=${lat},${lng}`,
          // fallback: 구글지도 웹 길찾기
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

  // 구글지도 검색 전용
  const urls =
    Platform.OS === 'ios'
      ? [
          // 1. 구글지도 앱
          `comgooglemaps://?q=${encoded}`,
          // 2. 구글지도 웹
          `https://www.google.com/maps/search/?api=1&query=${encoded}`,
        ]
      : [
          // Android: 구글지도 웹 URL이 구글앱 자동 가로챔
          `https://www.google.com/maps/search/?api=1&query=${encoded}`,
          `geo:0,0?q=${encoded}`,
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
