import { useMemo, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Alert, ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { ChecklistItem, ChecklistCategory, Trip } from '@/types';
import {
  getChecklist, createChecklistItem, toggleChecklistItem,
  deleteChecklistItem, addTemplateItems, DEFAULT_CHECKLIST_TEMPLATES,
} from '@/db/checklists';
import { CHECKLIST_CATEGORIES } from '@/db/schema';

// 'all' = 전체 보기, 그 외는 ChecklistCategory
type FilterCategory = 'all' | ChecklistCategory;

export function ChecklistTab({ trip }: { trip: Trip }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState('');
  // 카테고리 탭: 표시 필터 용도
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');

  const load = useCallback(async () => {
    const all = await getChecklist(trip.id);
    setItems(all);
  }, [trip.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 낙관적 업데이트 + 안정적 핸들러
  const handleToggle = useCallback(async (id: number) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isChecked: !i.isChecked } : i))
    );
    try {
      await toggleChecklistItem(id);
    } catch (err) {
      console.error('토글 실패:', err);
      load();
    }
  }, [load]);

  const handleAdd = async () => {
    if (!newItem.trim()) return;
    // 전체 탭일 때는 'general'로, 특정 카테고리 탭일 때는 그 카테고리로
    const targetCategory: ChecklistCategory =
      filterCategory === 'all' ? 'general' : filterCategory;
    await createChecklistItem({
      tripId: trip.id,
      title: newItem.trim(),
      category: targetCategory,
      isChecked: false,
    });
    setNewItem('');
    load();
  };

  const handleDelete = useCallback((id: number) => {
    Alert.alert('항목 삭제', '이 항목을 삭제하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await deleteChecklistItem(id);
          load();
        },
      },
    ]);
  }, [load]);

  const handleAddTemplate = (category: ChecklistCategory) => {
    const cat = CHECKLIST_CATEGORIES.find((c) => c.key === category);
    Alert.alert(
      `${cat?.label} 템플릿 추가`,
      '기본 항목들을 한 번에 추가하시겠어요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '추가',
          onPress: async () => {
            await addTemplateItems(trip.id, category);
            load();
          },
        },
      ]
    );
  };

  const checkedCount = items.filter((i) => i.isChecked).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  // 카테고리별 그룹 (필터 적용)
  const grouped = CHECKLIST_CATEGORIES
    .filter((cat) => filterCategory === 'all' || cat.key === filterCategory)
    .map((cat) => ({
      ...cat,
      items: items.filter((i) => i.category === cat.key),
    }))
    .filter((g) => g.items.length > 0);

  // 필터 적용 후 카운트
  const filteredCount = grouped.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <View style={styles.container}>
      {totalCount > 0 && (
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>준비 완료</Text>
            <Text style={styles.progressValue}>
              {checkedCount} / {totalCount}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      )}

      <View style={styles.addBox}>
        <TextInput
          style={styles.input}
          value={newItem}
          onChangeText={setNewItem}
          placeholder={
            filterCategory === 'all'
              ? '새 항목 추가... (일반)'
              : `새 항목 추가... (${CHECKLIST_CATEGORIES.find((c) => c.key === filterCategory)?.label})`
          }
          placeholderTextColor={colors.textTertiary}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <Pressable
          style={[styles.addBtn, !newItem.trim() && styles.addBtnDisabled]}
          onPress={handleAdd}
          disabled={!newItem.trim()}
        >
          <Text style={styles.addBtnText}>+</Text>
        </Pressable>
      </View>

      {/* 카테고리 필터 탭 - "전체" 탭 추가 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catTabs}
      >
        <Pressable
          style={[
            styles.catTab,
            filterCategory === 'all' && styles.catTabActive,
          ]}
          onPress={() => setFilterCategory('all')}
        >
          <Text
            style={[
              styles.catTabText,
              filterCategory === 'all' && styles.catTabTextActive,
            ]}
          >
            📋 전체 {totalCount > 0 && `(${totalCount})`}
          </Text>
        </Pressable>
        {CHECKLIST_CATEGORIES.map((c) => {
          const count = items.filter((i) => i.category === c.key).length;
          return (
            <Pressable
              key={c.key}
              style={[
                styles.catTab,
                filterCategory === c.key && styles.catTabActive,
              ]}
              onPress={() => setFilterCategory(c.key as ChecklistCategory)}
            >
              <Text
                style={[
                  styles.catTabText,
                  filterCategory === c.key && styles.catTabTextActive,
                ]}
              >
                {c.icon} {c.label} {count > 0 && `(${count})`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {totalCount === 0 ? (
        // 전체 비어있음: 템플릿 안내
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>체크리스트가 비어있어요</Text>
          <Text style={styles.emptyDesc}>
            위에서 직접 추가하거나 아래 템플릿을 사용해보세요
          </Text>
          <View style={styles.templateGrid}>
            {CHECKLIST_CATEGORIES.map((c) => (
              <Pressable
                key={c.key}
                style={styles.templateBtn}
                onPress={() => handleAddTemplate(c.key as ChecklistCategory)}
              >
                <Text style={styles.templateIcon}>{c.icon}</Text>
                <Text style={styles.templateLabel}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : filteredCount === 0 ? (
        // 선택한 카테고리만 비어있음
        <View style={styles.emptyFiltered}>
          <Text style={styles.emptyFilteredText}>
            이 카테고리에 항목이 없어요
          </Text>
          <Pressable
            style={styles.templateSmallBtn}
            onPress={() => {
              if (filterCategory !== 'all') {
                handleAddTemplate(filterCategory);
              }
            }}
          >
            <Text style={styles.templateSmallText}>
              {CHECKLIST_CATEGORIES.find((c) => c.key === filterCategory)?.label} 템플릿 추가
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {grouped.map((group) => (
            <View key={group.key} style={styles.groupCard}>
              <Text style={styles.groupTitle}>
                {group.icon} {group.label}
              </Text>
              {group.items.map((item) => (
                <ChecklistRow
                  key={item.id}
                  item={item}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              ))}
            </View>
          ))}
          <Text style={styles.hint}>
            길게 누르면 삭제할 수 있어요
          </Text>
        </View>
      )}
    </View>
  );
}

function ChecklistRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ChecklistItem;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
      ]}
      onPress={() => onToggle(item.id)}
      onLongPress={() => onDelete(item.id)}
      android_ripple={{ color: colors.surfaceAlt }}
    >
      <View
        style={[
          styles.checkbox,
          item.isChecked && styles.checkboxChecked,
        ]}
      >
        {item.isChecked && <Text style={styles.check}>✓</Text>}
      </View>
      <Text
        style={[
          styles.rowText,
          item.isChecked && styles.rowTextChecked,
        ]}
      >
        {item.title}
      </Text>
    </Pressable>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
  container: { paddingBottom: Spacing.xl },
  progressCard: {
    backgroundColor: c.primary,
    padding: Spacing.lg,
    borderRadius: 14,
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  progressLabel: {
    fontSize: Typography.labelSmall,
    color: c.accent,
    fontWeight: '700',
    letterSpacing: 1,
  },
  progressValue: {
    fontSize: Typography.bodyLarge,
    color: c.textOnPrimary,
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    backgroundColor: c.textOnPrimary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: c.accent,
  },
  addBox: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Typography.bodyMedium,
    color: c.textPrimary,
    borderWidth: 1,
    borderColor: c.border,
  },
  addBtn: {
    width: 44,
    backgroundColor: c.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: {
    color: c.textOnPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  catTabs: {
    gap: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  catTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 999,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  catTabActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  catTabText: {
    fontSize: Typography.labelMedium,
    color: c.textSecondary,
    fontWeight: '600',
  },
  catTabTextActive: { color: c.textOnPrimary },
  list: { gap: Spacing.md },
  groupCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: Spacing.lg,
    ...Shadows.soft,
  },
  groupTitle: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    gap: Spacing.md,
    borderRadius: 8,
  },
  rowPressed: {
    backgroundColor: c.surfaceAlt,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  check: {
    color: c.textOnPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  rowText: {
    flex: 1,
    fontSize: Typography.bodyMedium,
    color: c.textPrimary,
  },
  rowTextChecked: {
    textDecorationLine: 'line-through',
    color: c.textTertiary,
  },
  hint: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
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
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  emptyFiltered: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: Spacing.lg,
    ...Shadows.soft,
  },
  emptyFilteredText: {
    fontSize: Typography.bodyMedium,
    color: c.textSecondary,
    marginBottom: Spacing.md,
  },
  templateSmallBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: c.primary,
    borderRadius: 999,
  },
  templateSmallText: {
    fontSize: Typography.labelMedium,
    color: c.textOnPrimary,
    fontWeight: '700',
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    justifyContent: 'center',
  },
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: c.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.border,
  },
  templateIcon: { fontSize: 16 },
  templateLabel: {
    fontSize: Typography.labelMedium,
    color: c.textPrimary,
    fontWeight: '600',
  },
});
}
