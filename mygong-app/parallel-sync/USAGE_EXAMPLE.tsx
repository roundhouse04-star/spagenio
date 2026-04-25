/**
 * 사용 예시: 홈 화면에서 병렬 동기화 적용
 * 
 * 기존 코드에 추가/수정할 부분
 */

import React, { useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { syncAllArtists, type SyncProgress } from '@/services/syncManager';
import { SyncProgressOverlay } from '@/components/SyncProgressOverlay';

export function HomeScreen() {
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // 전체 동기화 실행
  const handleSyncAll = async () => {
    setIsSyncing(true);
    setSyncProgress({ total: 0, completed: 0, current: [], failed: 0 });

    try {
      await syncAllArtists('future-only', (progress) => {
        // 진행 상황 업데이트
        setSyncProgress(progress);
        console.log('[UI] Sync progress:', progress);
      });

      // 완료 후 3초 뒤 오버레이 닫기
      setTimeout(() => {
        setIsSyncing(false);
        setSyncProgress(null);
      }, 3000);
    } catch (error) {
      console.error('[UI] Sync failed:', error);
      setIsSyncing(false);
    }
  };

  return (
    <View>
      {/* 전체 동기화 버튼 */}
      <TouchableOpacity 
        onPress={handleSyncAll}
        disabled={isSyncing}
        style={{
          backgroundColor: isSyncing ? '#CCC' : '#007AFF',
          padding: 16,
          borderRadius: 12,
          margin: 16,
        }}
      >
        <Text style={{ color: '#FFF', fontWeight: '700', textAlign: 'center' }}>
          {isSyncing ? '동기화 중...' : '⚡ 전체 동기화 (병렬 8개)'}
        </Text>
      </TouchableOpacity>

      {/* 진행 상황 오버레이 */}
      <SyncProgressOverlay 
        progress={syncProgress}
        visible={isSyncing}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// 아티스트 상세 화면 예시 - 개별 동기화
// ═══════════════════════════════════════════════════════════

export function ArtistDetailScreen({ artistId }: { artistId: number }) {
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncOne = async () => {
    setIsSyncing(true);
    setSyncProgress({ total: 1, completed: 0, current: ['현재 아티스트'], failed: 0 });

    try {
      await syncOneArtist(artistId, 'incremental', (progress) => {
        setSyncProgress(progress);
      });

      setTimeout(() => {
        setIsSyncing(false);
        setSyncProgress(null);
      }, 2000);
    } catch (error) {
      console.error('[UI] Sync failed:', error);
      setIsSyncing(false);
    }
  };

  return (
    <View>
      <TouchableOpacity 
        onPress={handleSyncOne}
        disabled={isSyncing}
      >
        <Text>{isSyncing ? '동기화 중...' : '🔄 동기화'}</Text>
      </TouchableOpacity>

      <SyncProgressOverlay 
        progress={syncProgress}
        visible={isSyncing}
      />
    </View>
  );
}
