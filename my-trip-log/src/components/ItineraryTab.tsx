import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Colors, Typography, Spacing, Shadows } from '@/theme/theme';
import { TripItem, Trip } from '@/types';
import {
  getTripItems, toggleItemDone, deleteTripItem, calculateTripDays,
} from '@/db/items';
import { TRIP_ITEM_CATEGORIES } from '@/db/schema';

export function ItineraryTab({ trip }: { trip: Trip }) {
  const [items, setItems] = useState<TripItem[]>([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const totalDays = calculateTripDays(trip.startDate, trip.endDate);

  const load = useCallback(async () => {
    const all = await getTripItems(trip.id);
    setItems(all);
  }, [trip.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const dayItems = items.filter((it) => it.day === selectedDay);
  const days = Array.from({ length: totalDays }, (_, i) => i + 1);

  const handleDelete = (id: number) => {
    Alert.alert('일정 삭제', '이 일정을 삭제하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await deleteTripItem(id);
          load();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayTabs}
      >
        {days.map((d) => (
          <Pressable
            key={d}
            style={[styles.dayTab, selectedDay === d && styles.dayTabActive]}
            onPress={() => setSelectedDay(d)}
          >
            <Text style={[styles.dayTabText, selectedDay === d && styles.dayTabTextActive]}>
              Day {d}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {dayItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>Day {selectedDay} 일정이 없어요</Text>
          <Text style={styles.emptyDesc}>이 날의 계획을 추가해보세요</Text>
        </View>
      ) : (
        <View style={styles.timeline}>
          {dayItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onToggle={async () => {
                await toggleItemDone(item.id);
                load();
              }}
              onDelete={() => handleDelete(item.id)}
            />
          ))}
        </View>
      )}

      <Pressable
        style={styles.addButton}
        onPress={() => router.push({
          pathname: '/trip/[id]/item-new',
          params: { id: String(trip.id), day: String(selectedDay) },
        } as any)}
      >
        <Text style={styles.addButtonText}>+ Day {selectedDay} 일정 추가</Text>
      </Pressable>
    </View>
  );
}

function ItemCard({
  item, onToggle, onDelete,
}: {
  item: TripItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const cat = TRIP_ITEM_CATEGORIES.find((c) => c.key === item.category);
  return (
    <View style={[styles.card, item.isDone && styles.cardDone]}>
      <Pressable onPress={onToggle} style={styles.checkbox}>
        {item.isDone && <Text style={styles.check}>✓</Text>}
      </Pressable>
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          {item.startTime && (
            <Text style={styles.time}>🕐 {item.startTime}</Text>
          )}
          <Text style={styles.category}>{cat?.icon} {cat?.label}</Text>
        </View>
        <Text
          style={[styles.title, item.isDone && styles.titleDone]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        {item.location && <Text style={styles.location}>📍 {item.location}</Text>}
        {item.memo && <Text style={styles.memo} numberOfLines={2}>{item.memo}</Text>}
        {item.cost > 0 && (
          <Text style={styles.cost}>
            💰 {item.cost.toLocaleString()} {item.currency ?? ''}
          </Text>
        )}
      </View>
      <Pressable onPress={onDelete} style={styles.deleteBtn}>
        <Text style={styles.deleteIcon}>⋯</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: Spacing.xl },
  dayTabs: {
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  dayTab: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayTabText: {
    fontSize: Typography.labelLarge,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  dayTabTextActive: { color: Colors.textOnPrimary },
  timeline: { gap: Spacing.sm, marginTop: Spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.soft,
  },
  cardDone: { opacity: 0.6 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  check: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  cardBody: { flex: 1 },
  cardHeader: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
    flexWrap: 'wrap',
  },
  time: {
    fontSize: Typography.labelSmall,
    color: Colors.accent,
    fontWeight: '700',
  },
  category: {
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
  },
  title: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: Colors.textTertiary,
  },
  location: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  memo: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: Typography.bodySmall * 1.5,
    marginTop: Spacing.xs,
  },
  cost: {
    fontSize: Typography.labelSmall,
    color: Colors.accent,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  deleteBtn: { padding: Spacing.xs },
  deleteIcon: {
    fontSize: 20,
    color: Colors.textTertiary,
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
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  emptyDesc: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
  },
  addButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: Colors.textOnPrimary,
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
  },
});
