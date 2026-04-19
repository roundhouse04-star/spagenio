import { useMemo, useState } from 'react';
import {
  Modal, View, Text, Pressable, StyleSheet, ScrollView,
} from 'react-native';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
  isSameDay, isToday, parseISO, isValid, isBefore, isAfter,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { Colors, Typography, Spacing, Shadows } from '@/theme/theme';

type Props = {
  visible: boolean;
  value: string;              // "YYYY-MM-DD" or ""
  onConfirm: (date: string) => void;
  onClose: () => void;
  title?: string;
  minDate?: string;           // "YYYY-MM-DD"
  maxDate?: string;
};

const WEEK_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export default function DatePickerModal({
  visible, value, onConfirm, onClose, title = '날짜 선택', minDate, maxDate,
}: Props) {
  const initial = useMemo(() => {
    if (value) {
      const d = parseISO(value);
      if (isValid(d)) return d;
    }
    return new Date();
  }, [value]);

  const [month, setMonth] = useState<Date>(startOfMonth(initial));
  const [selected, setSelected] = useState<Date | null>(
    value && isValid(parseISO(value)) ? parseISO(value) : null
  );

  const min = minDate && isValid(parseISO(minDate)) ? parseISO(minDate) : null;
  const max = maxDate && isValid(parseISO(maxDate)) ? parseISO(maxDate) : null;

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const isDisabled = (d: Date) => {
    if (min && isBefore(d, min)) return true;
    if (max && isAfter(d, max)) return true;
    return false;
  };

  const handleConfirm = () => {
    if (selected) {
      onConfirm(format(selected, 'yyyy-MM-dd'));
    }
    onClose();
  };

  const handleClear = () => {
    setSelected(null);
    onConfirm('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.closeBtn}>✕</Text>
            </Pressable>
          </View>

          {/* Month switcher */}
          <View style={styles.monthRow}>
            <Pressable
              onPress={() => setMonth(subMonths(month, 1))}
              style={styles.navBtn}
              hitSlop={10}
            >
              <Text style={styles.navArrow}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel}>
              {format(month, 'yyyy년 M월', { locale: ko })}
            </Text>
            <Pressable
              onPress={() => setMonth(addMonths(month, 1))}
              style={styles.navBtn}
              hitSlop={10}
            >
              <Text style={styles.navArrow}>›</Text>
            </Pressable>
          </View>

          {/* Weekday labels */}
          <View style={styles.weekRow}>
            {WEEK_LABELS.map((w, i) => (
              <Text
                key={w}
                style={[
                  styles.weekLabel,
                  i === 0 && { color: Colors.error },
                  i === 6 && { color: Colors.info },
                ]}
              >
                {w}
              </Text>
            ))}
          </View>

          {/* Days grid */}
          <View style={styles.grid}>
            {days.map((d) => {
              const inMonth = isSameMonth(d, month);
              const isSelected = selected && isSameDay(d, selected);
              const today = isToday(d);
              const disabled = isDisabled(d);
              const dow = d.getDay();

              return (
                <Pressable
                  key={d.toISOString()}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    today && !isSelected && styles.dayCellToday,
                  ]}
                  disabled={disabled}
                  onPress={() => setSelected(d)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      !inMonth && styles.dayTextOutside,
                      isSelected && styles.dayTextSelected,
                      today && !isSelected && styles.dayTextToday,
                      dow === 0 && inMonth && !isSelected && { color: Colors.error },
                      dow === 6 && inMonth && !isSelected && { color: Colors.info },
                      disabled && styles.dayTextDisabled,
                    ]}
                  >
                    {d.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.footerBtn} onPress={handleClear}>
              <Text style={styles.footerBtnText}>지우기</Text>
            </Pressable>
            <Pressable
              style={[styles.footerBtn, styles.footerBtnPrimary]}
              onPress={handleConfirm}
            >
              <Text style={[styles.footerBtnText, styles.footerBtnTextPrimary]}>
                확인
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.xl,
    ...Shadows.medium,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeBtn: {
    fontSize: 20,
    color: Colors.textSecondary,
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceAlt,
  },
  navArrow: {
    fontSize: 22,
    color: Colors.textPrimary,
    fontWeight: '600',
    lineHeight: 24,
  },
  monthLabel: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.labelSmall,
    color: Colors.textSecondary,
    fontWeight: '600',
    paddingVertical: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: 999,
  },
  dayText: {
    fontSize: Typography.bodyMedium,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  dayTextOutside: {
    color: Colors.textTertiary,
    opacity: 0.4,
  },
  dayTextSelected: {
    color: Colors.textOnPrimary,
    fontWeight: '700',
  },
  dayTextToday: {
    color: Colors.accent,
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: Colors.textTertiary,
    opacity: 0.3,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
  },
  footerBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  footerBtnText: {
    fontSize: Typography.bodyMedium,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  footerBtnTextPrimary: {
    color: Colors.textOnPrimary,
  },
});
