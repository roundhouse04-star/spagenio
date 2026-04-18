import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Alert, ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors, Typography, Spacing, Shadows } from '@/theme/theme';
import { ChecklistItem, ChecklistCategory, Trip } from '@/types';
import {
  getChecklist, createChecklistItem, toggleChecklistItem,
  deleteChecklistItem, addTemplateItems, DEFAULT_CHECKLIST_TEMPLATES,
} from '@/db/checklists';
import { CHECKLIST_CATEGORIES } from '@/db/schema';

export function ChecklistTab({ trip }: { trip: Trip }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ChecklistCategory>('general');

  const load = useCallback(async () => {
    const all = await getChecklist(trip.id);
    setItems(all);
  }, [trip.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAdd = async () => {
    if (!newItem.trim()) return;
    await createChecklistItem({
      tripId: trip.id,
      title: newItem.trim(),
      category: selectedCategory,
      isChecked: false,
    });
    setNewItem('');
    load();
  };

  const handleDelete = (id: number) => {
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
  };

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

  // 카테고리별 그룹
  const grouped = CHECKLIST_CATEGORIES.map((cat) => ({
    ...cat,
    items: items.filter((i) => i.category === cat.key),
  })).filter((g) => g.items.length > 0);

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
          placeholder="새 항목 추가..."
          placeholderTextColor={Colors.textTertiary}
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catTabs}
      >
        {CHECKLIST_CATEGORIES.map((c) => (
          <Pressable
            key={c.key}
            style={[
              styles.catTab,
              selectedCategory === c.key && styles.catTabActive,
            ]}
            onPress={() => setSelectedCategory(c.key as ChecklistCategory)}
          >
            <Text
              style={[
                styles.catTabText,
                selectedCategory === c.key && styles.catTabTextActive,
              ]}
            >
              {c.icon} {c.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {grouped.length === 0 ? (
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
      ) : (
        <View style={styles.list}>
          {grouped.map((group) => (
            <View key={group.key} style={styles.groupCard}>
              <Text style={styles.groupTitle}>
                {group.icon} {group.label}
              </Text>
              {group.items.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.row}
                  onPress={async () => {
                    await toggleChecklistItem(item.id);
                    load();
                  }}
                  onLongPress={() => handleDelete(item.id)}
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

const styles = StyleSheet.create({
  container: { paddingBottom: Spacing.xl },
  progressCard: {
    backgroundColor: Colors.primary,
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
    color: Colors.accent,
    fontWeight: '700',
    letterSpacing: 1,
  },
  progressValue: {
    fontSize: Typography.bodyLarge,
    color: Colors.textOnPrimary,
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(250, 248, 243, 0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
  },
  addBox: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Typography.bodyMedium,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addBtn: {
    width: 44,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: {
    color: Colors.textOnPrimary,
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catTabText: {
    fontSize: Typography.labelMedium,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  catTabTextActive: { color: Colors.textOnPrimary },
  list: { gap: Spacing.md },
  groupCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.lg,
    ...Shadows.soft,
  },
  groupTitle: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  check: {
    color: Colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  rowText: {
    flex: 1,
    fontSize: Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  rowTextChecked: {
    textDecorationLine: 'line-through',
    color: Colors.textTertiary,
  },
  hint: {
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
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
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  emptyDesc: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
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
    backgroundColor: Colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  templateIcon: { fontSize: 16 },
  templateLabel: {
    fontSize: Typography.labelMedium,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
});
