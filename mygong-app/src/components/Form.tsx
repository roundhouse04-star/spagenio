/**
 * 공연·티켓 추가/수정 폼에서 공통으로 쓰는 입력 필드 컴포넌트들.
 */
import React from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Platform } from 'react-native';
import { Colors, Fonts, FontSizes, Spacing, Radius } from '@/theme/theme';

export function Field({ label, required, children, hint }: {
  label: string; required?: boolean; children: React.ReactNode; hint?: string;
}) {
  return (
    <View style={{ marginBottom: Spacing.lg }}>
      <Text style={styles.label}>{label}{required && <Text style={{ color: Colors.heart }}> *</Text>}</Text>
      {children}
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

export function TextField({ value, onChangeText, placeholder, multiline, keyboardType }: {
  value: string; onChangeText: (s: string) => void;
  placeholder?: string; multiline?: boolean; keyboardType?: any;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textFaint}
      multiline={multiline}
      keyboardType={keyboardType}
      style={[styles.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
    />
  );
}

export function DateField({ value, onChangeText, placeholder = 'YYYY-MM-DD' }: {
  value: string; onChangeText: (s: string) => void; placeholder?: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textFaint}
      style={styles.input}
      keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
    />
  );
}

export function TimeField({ value, onChangeText, placeholder = 'HH:MM' }: {
  value: string; onChangeText: (s: string) => void; placeholder?: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textFaint}
      style={[styles.input, { maxWidth: 120 }]}
      keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
    />
  );
}

export function CategoryPicker({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: readonly { value: string; icon: string }[];
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <Pressable key={opt.value} onPress={() => onChange(opt.value)}
                     style={[styles.chip, active && styles.chipActive]}>
            <Text style={{ fontSize: FontSizes.caption, color: active ? '#fff' : Colors.text, fontFamily: Fonts.medium }}>
              {opt.icon} {opt.value}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RatingPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1,2,3,4,5].map(n => (
        <Pressable key={n} onPress={() => onChange(n === value ? 0 : n)} hitSlop={4}>
          <Text style={{ fontSize: 30, color: n <= value ? Colors.heart : Colors.textFaint }}>
            {n <= value ? '★' : '☆'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function SelectRow<T extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T | undefined) => void;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Pressable onPress={() => onChange(undefined)}
                   style={[styles.chip, value === undefined && styles.chipActive]}>
          <Text style={{ fontSize: FontSizes.caption, color: value === undefined ? '#fff' : Colors.text }}>
            없음
          </Text>
        </Pressable>
        {options.map(o => (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)}
                     style={[styles.chip, value === o.value && styles.chipActive]}>
            <Text style={{ fontSize: FontSizes.caption, color: value === o.value ? '#fff' : Colors.text }}>
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: FontSizes.caption, fontFamily: Fonts.semibold, color: Colors.text, marginBottom: 6 },
  hint: { fontSize: FontSizes.tiny, color: Colors.textFaint, marginTop: 4 },
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: FontSizes.body, fontFamily: Fonts.regular, color: Colors.text,
    backgroundColor: Colors.bg,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, backgroundColor: Colors.bg,
  },
  chipActive: { backgroundColor: Colors.text, borderColor: Colors.text },
});
