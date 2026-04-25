/**
 * 동기화 진행 상황 표시 컴포넌트
 * 
 * 병렬 처리 진행 상황을 실시간으로 표시
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import type { SyncProgress } from '@/services/syncManager';

type Props = {
  progress: SyncProgress | null;
  visible: boolean;
};

export function SyncProgressOverlay({ progress, visible }: Props) {
  if (!visible || !progress) return null;

  const percentage = progress.total > 0 
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  const isComplete = progress.completed === progress.total;

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <Text style={styles.title}>
          {isComplete ? '✅ 동기화 완료!' : '⏳ 동기화 중...'}
        </Text>

        {/* 진행률 */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View 
              style={[
                styles.progressBarFill, 
                { width: `${percentage}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {progress.completed} / {progress.total} ({percentage}%)
          </Text>
        </View>

        {/* 현재 동기화 중인 아티스트 */}
        {!isComplete && progress.current.length > 0 && (
          <View style={styles.currentContainer}>
            <Text style={styles.currentLabel}>현재 진행 중:</Text>
            {progress.current.map((name, idx) => (
              <View key={idx} style={styles.currentItem}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.currentName}>{name}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 실패 정보 */}
        {progress.failed > 0 && (
          <Text style={styles.failedText}>
            ⚠️ 실패: {progress.failed}개
          </Text>
        )}

        {/* 완료 메시지 */}
        {isComplete && (
          <Text style={styles.completeText}>
            {progress.failed > 0 
              ? `${progress.total - progress.failed}개 성공, ${progress.failed}개 실패`
              : `모든 아티스트 동기화 완료!`
            }
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    color: '#000',
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontWeight: '600',
  },
  currentContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  currentLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    fontWeight: '600',
  },
  currentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  currentName: {
    fontSize: 14,
    color: '#000',
    marginLeft: 8,
    fontWeight: '500',
  },
  failedText: {
    fontSize: 13,
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  completeText: {
    fontSize: 14,
    color: '#34C759',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
});
