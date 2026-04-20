import { Linking, Platform, Alert } from 'react-native';

/**
 * 구글지도로 특정 위치 열기 (딥링크 방식)
 *
 * iOS: 애플지도 → 구글지도 앱 → 브라우저 순으로 시도
 * Android: geo: 인텐트 → 구글지도 URL 순으로 시도
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
 * 지도에서 위치 보기 (장소 표시)
 */
export const openInMaps = async (location: MapLocation): Promise<void> => {
  const { lat, lng, label } = location;

  if (!lat || !lng) {
    Alert.alert('위치 정보 없음', '이 장소는 좌표 정보가 없어서 지도에서 열 수 없어요.');
    return;
  }

  const encodedLabel = encodeURIComponent(label || '위치');

  try {
    if (Platform.OS === 'ios') {
      // iOS: 애플지도 먼저 시도 (기본 지도 앱)
      const appleMapsUrl = `http://maps.apple.com/?ll=${lat},${lng}&q=${encodedLabel}`;
      const canOpen = await Linking.canOpenURL(appleMapsUrl);
      if (canOpen) {
        await Linking.openURL(appleMapsUrl);
        return;
      }
    }

    if (Platform.OS === 'android') {
      // Android: geo: 인텐트 먼저 시도 (지도 앱 선택 다이얼로그 표시)
      const geoUrl = `geo:${lat},${lng}?q=${lat},${lng}(${encodedLabel})`;
      const canOpen = await Linking.canOpenURL(geoUrl);
      if (canOpen) {
        await Linking.openURL(geoUrl);
        return;
      }
    }

    // 위 방법 실패 시 → 구글지도 웹 URL (앱 설치되어 있으면 앱으로, 없으면 브라우저)
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    await Linking.openURL(googleMapsUrl);
  } catch (error) {
    console.error('[openInMaps] 실패:', error);
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

  const encodedLabel = encodeURIComponent(label || '목적지');

  try {
    if (Platform.OS === 'ios') {
      // iOS: 애플지도 길찾기
      const appleMapsUrl = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
      const canOpen = await Linking.canOpenURL(appleMapsUrl);
      if (canOpen) {
        await Linking.openURL(appleMapsUrl);
        return;
      }
    }

    if (Platform.OS === 'android') {
      // Android: google.navigation: 인텐트 (구글지도 네비게이션 바로 시작)
      const navUrl = `google.navigation:q=${lat},${lng}`;
      const canOpen = await Linking.canOpenURL(navUrl);
      if (canOpen) {
        await Linking.openURL(navUrl);
        return;
      }
    }

    // fallback: 구글지도 웹 URL
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    await Linking.openURL(googleMapsUrl);
  } catch (error) {
    console.error('[openDirections] 실패:', error);
    Alert.alert('길찾기 실패', '지도 앱을 열 수 없어요.');
  }
};

/**
 * 이름/주소로 검색 (좌표 없을 때)
 */
export const searchInMaps = async (query: string): Promise<void> => {
  if (!query || !query.trim()) return;

  const encoded = encodeURIComponent(query.trim());

  try {
    if (Platform.OS === 'ios') {
      const appleMapsUrl = `http://maps.apple.com/?q=${encoded}`;
      const canOpen = await Linking.canOpenURL(appleMapsUrl);
      if (canOpen) {
        await Linking.openURL(appleMapsUrl);
        return;
      }
    }

    if (Platform.OS === 'android') {
      const geoUrl = `geo:0,0?q=${encoded}`;
      const canOpen = await Linking.canOpenURL(geoUrl);
      if (canOpen) {
        await Linking.openURL(geoUrl);
        return;
      }
    }

    // fallback
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    await Linking.openURL(googleMapsUrl);
  } catch (error) {
    console.error('[searchInMaps] 실패:', error);
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
