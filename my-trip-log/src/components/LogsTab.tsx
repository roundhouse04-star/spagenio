import { useMemo, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image, Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { TripLog, Trip } from '@/types';
import { getTripLogs, deleteTripLog } from '@/db/logs';
import { showMapOptions, searchInMaps } from '@/utils/maps';

export function LogsTab({ trip }: { trip: Trip }) {
  const [logs, setLogs] = useState<TripLog[]>([]);

  const load = useCallback(async () => {
    const all = await getTripLogs(trip.id);
    setLogs(all);
  }, [trip.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (id: number) => {
    Alert.alert('기록 삭제', '이 기록을 삭제하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await deleteTripLog(id);
          load();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {logs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📝</Text>
          <Text style={styles.emptyTitle}>기록이 없어요</Text>
          <Text style={styles.emptyDesc}>여행의 순간을 기록해보세요</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {logs.map((log) => (
            <LogCard key={log.id} log={log} onDelete={() => handleDelete(log.id)} />
          ))}
        </View>
      )}

      <Pressable
        style={styles.addButton}
        onPress={() => router.push({
          pathname: '/trip/[id]/log-new',
          params: { id: String(trip.id) },
        } as any)}
      >
        <Text style={styles.addButtonText}>+ 새 기록 작성</Text>
      </Pressable>
    </View>
  );
}

function LogCard({ log, onDelete }: { log: TripLog; onDelete: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.date}>📅 {log.logDate}</Text>
          {log.title && <Text style={styles.title}>{log.title}</Text>}
        </View>
        <Pressable onPress={onDelete}>
          <Text style={styles.deleteIcon}>⋯</Text>
        </Pressable>
      </View>

      {log.images.length > 0 && (
        <View style={styles.imageGrid}>
          {log.images.slice(0, 4).map((uri, i) => (
            <Image key={i} source={{ uri }} style={styles.image} />
          ))}
          {log.images.length > 4 && (
            <View style={styles.moreOverlay}>
              <Text style={styles.moreText}>+{log.images.length - 4}</Text>
            </View>
          )}
        </View>
      )}

      {log.content && (
        <Text style={styles.content} numberOfLines={5}>
          {log.content}
        </Text>
      )}

      <View style={styles.metaRow}>
        {log.location && (
          <Pressable
            onPress={() => {
              const anyLog = log as any;
              if (anyLog.lat && anyLog.lng) {
                showMapOptions({
                  lat: anyLog.lat,
                  lng: anyLog.lng,
                  label: log.location!,
                });
              } else {
                searchInMaps(log.location!);
              }
            }}
            style={styles.locationChip}
          >
            <Text style={styles.locationChipText}>📍 {log.location}</Text>
          </Pressable>
        )}
        {log.weather && <Text style={styles.meta}>{log.weather}</Text>}
        {log.mood && <Text style={styles.meta}>{log.mood}</Text>}
      </View>
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
  container: { paddingBottom: Spacing.xl },
  list: { gap: Spacing.md },
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    ...Shadows.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  date: {
    fontSize: Typography.labelMedium,
    color: c.accent,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: Typography.headlineSmall,
    fontWeight: '700',
    color: c.textPrimary,
  },
  deleteIcon: {
    fontSize: 22,
    color: c.textTertiary,
    fontWeight: '700',
    padding: Spacing.xs,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: Spacing.md,
    position: 'relative',
  },
  image: {
    width: '49%',
    height: 120,
    borderRadius: 10,
    backgroundColor: c.surfaceAlt,
  },
  moreOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: '49%',
    height: 120,
    backgroundColor: 'rgba(30, 42, 58, 0.6)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontSize: 24,
    fontWeight: '700',
    color: c.textOnPrimary,
  },
  content: {
    fontSize: Typography.bodyMedium,
    color: c.textPrimary,
    lineHeight: Typography.bodyMedium * 1.6,
    marginBottom: Spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  meta: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
  },
  locationChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: c.primary + '15',
    borderWidth: 1,
    borderColor: c.primary + '30',
  },
  locationChipText: {
    fontSize: Typography.labelSmall,
    color: c.primary,
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyIcon: { fontSize: 40, marginBottom: Spacing.sm },
  emptyTitle: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: Spacing.xs,
  },
  emptyDesc: {
    fontSize: Typography.bodySmall,
    color: c.textSecondary,
  },
  addButton: {
    marginTop: Spacing.lg,
    backgroundColor: c.primary,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: c.textOnPrimary,
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
  },
});
}
