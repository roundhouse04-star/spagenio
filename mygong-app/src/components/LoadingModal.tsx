import React, { useState } from 'react';
import { View, Text, Modal, ActivityIndicator, StyleSheet } from 'react-native';

// MARK: - 로딩 팝업 컴포넌트
interface LoadingModalProps {
  visible: boolean;
  message: string;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({ visible, message }) => {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.title}>검색 중</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
};

// MARK: - 사용 예시
export const ArtistAddScreen = () => {
  const [loading, setLoading] = useState(false);
  const [artistName, setArtistName] = useState('');

  const handleAddArtist = async (name: string) => {
    // 1. 로딩 팝업 표시
    setLoading(true);

    try {
      // 2. API 호출
      const performances = await fetchPerformances(name);
      
      console.log(`✅ ${performances.length}개 공연 찾음`);
      
      // 3. 성공 처리
      // TODO: 아티스트 저장 로직
      
    } catch (error) {
      console.error('❌ 에러:', error);
      // TODO: 에러 처리
      
    } finally {
      // 4. 로딩 팝업 닫기
      setLoading(false);
    }
  };

  return (
    <View>
      {/* 기존 UI */}
      
      {/* 로딩 팝업 */}
      <LoadingModal
        visible={loading}
        message="아티스트 공연 정보 검색 중...
최대 5분 정도 소요될 수 있습니다."
      />
    </View>
  );
};

// MARK: - API 호출 함수
const fetchPerformances = async (artist: string): Promise<Performance[]> => {
  const baseUrl = 'https://mygong-api.roundhouse04.workers.dev/performances';
  const params = new URLSearchParams({
    shprfnm: artist,
    stdate: '20100101',
    eddate: '20260430',
  });

  const response = await fetch(`${baseUrl}?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  const xml = await response.text();
  
  // TODO: XML 파싱 로직 (기존 parseData.ts 사용)
  // const performances = parseXML(xml);
  // return performances;
  
  return [];
};

// MARK: - 타입 정의
interface Performance {
  id: string;
  name: string;
  venue: string;
  startDate: string;
  endDate: string;
}

// MARK: - 스타일
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});
