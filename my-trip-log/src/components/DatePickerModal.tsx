import { useMemo, useState } from 'react';
import {
  Modal, View, Text, Pressable, StyleSheet,
} from 'react-native';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
  isSameDay, isToday, parseISO, isValid, isBefore, isAfter,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';

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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

  // 주(week) 단위로 분할된 날짜 배열
  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start, end });
    const chunks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      chunks.push(days.slice(i, i + 7));
    }
    return chunks;
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
              <View key={w} style={styles.weekLabelCell}>
                <Text
                  style={[
                    styles.weekLabel,
                    i === 0 && { color: colors.error },
                    i === 6 && { color: colors.info },
                  ]}
                >
                  {w}
                </Text>
              </View>
            ))}
          </View>

          {/* Days grid - week rows */}
          <View style={styles.grid}>
            {weeks.map((week, wIdx) => (
              <View key={wIdx} style={styles.weekDayRow}>
                {week.map((d) => {
                  const inMonth = isSameMonth(d, month);
                  const isSelected = selected && isSameDay(d, selected);
                  const today = isToday(d);
                  const disabled = isDisabled(d);
                  const dow = d.getDay();

                  return (
                    <Pressable
                      key={d.toISOString()}
                      style={styles.dayCell}
                      disabled={disabled}
                      onPress={() => setSelected(d)}
                    >
                      <View
                        style={[
                          styles.dayCircle,
                          isSelected && styles.dayCircleSelected,
                          today && !isSelected && styles.dayCircleToday,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            !inMonth && styles.dayTextOutside,
                            isSelected && styles.dayTextSelected,
                            today && !isSelected && styles.dayTextToday,
                            dow === 0 && inMonth && !isSelected && !today && { color: colors.error },
                            dow === 6 && inMonth && !isSelected && !today && { color: colors.info },
                            disabled && styles.dayTextDisabled,
                          ]}
                        >
                          {d.getDate()}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
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

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
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
    backgroundColor: c.surface,
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
    color: c.textPrimary,
  },
  closeBtn: {
    fontSize: 20,
    color: c.textSecondary,
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
    backgroundColor: c.surfaceAlt,
  },
  navArrow: {
    fontSize: 22,
    color: c.textPrimary,
    fontWeight: '600',
    lineHeight: 24,
  },
  monthLabel: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: c.textPrimary,
  },

  // 요일 라벨 행
  weekRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  weekLabelCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  weekLabel: {
    fontSize: Typography.labelSmall,
    color: c.textSecondary,
    fontWeight: '600',
  },

  // 날짜 그리드
  grid: {},
  weekDayRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayCircle: {
    width: '90%',
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: c.primary,
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: c.accent,
  },
  dayText: {
    fontSize: Typography.bodyMedium,
    color: c.textPrimary,
    fontWeight: '500',
  },
  dayTextOutside: {
    color: c.textTertiary,
    opacity: 0.4,
  },
  dayTextSelected: {
    color: c.textOnPrimary,
    fontWeight: '700',
  },
  dayTextToday: {
    color: c.accent,
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: c.textTertiary,
    opacity: 0.3,
  },

  // Footer
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
    backgroundColor: c.surfaceAlt,
  },
  footerBtnPrimary: {
    backgroundColor: c.primary,
  },
  footerBtnText: {
    fontSize: Typography.bodyMedium,
    fontWeight: '600',
    color: c.textPrimary,
  },
  footerBtnTextPrimary: {
    color: c.textOnPrimary,
  },
});
}
