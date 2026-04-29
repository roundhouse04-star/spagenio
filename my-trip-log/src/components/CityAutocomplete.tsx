/**
 * 도시 자동완성 입력
 *
 * CITY_ALIASES (46도시) 기반으로 한글/영문/현지명 어떤 입력이든 매칭.
 * 사용자가 후보 선택하면 표시명·국가코드·cityId 모두 콜백으로 전달 → trip 저장 시 활용.
 */
import { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
} from 'react-native';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { CITY_ALIASES } from '@/data/cityHighlights';

interface CityCandidate {
  cityId: string;
  name: string;
  flag: string;
  countryAlias?: string;  // 매칭에 사용된 alias 중 국가명으로 보이는 것 (선택적 country 자동 채움용)
}

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (info: { cityId: string; name: string; flag: string }) => void;
  placeholder?: string;
  // 사용자가 직접 알리아스 외 텍스트를 입력할 때 cityId clear 콜백
  onClear?: () => void;
}

export function CityAutocomplete({
  value, onChangeText, onSelect, placeholder = '예: 도쿄, Bangkok', onClear,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);

  // 입력값 기반 후보 검색 (최대 8개)
  const candidates = useMemo<CityCandidate[]>(() => {
    const norm = value.trim().toLowerCase();
    if (!norm || norm.length < 1) return [];
    const out: CityCandidate[] = [];
    for (const [cityId, info] of Object.entries(CITY_ALIASES)) {
      const matched = info.aliases.find((a) => a.toLowerCase().includes(norm));
      if (matched) {
        out.push({ cityId, name: info.name, flag: info.flag });
        if (out.length >= 8) break;
      }
    }
    return out;
  }, [value]);

  const showDropdown = focused && candidates.length > 0;

  const handleSelect = (cand: CityCandidate) => {
    haptic.select();
    onChangeText(cand.name);
    onSelect({ cityId: cand.cityId, name: cand.name, flag: cand.flag });
    setFocused(false);
  };

  const handleChange = (text: string) => {
    onChangeText(text);
    onClear?.(); // 사용자가 텍스트 수정하면 기존 cityId 매칭은 무효 (선택 시 재설정됨)
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // 약간의 지연 후 닫기 (탭 이벤트 처리 시간 확보)
          setTimeout(() => setFocused(false), 150);
        }}
      />
      {showDropdown && (
        <View style={styles.dropdown}>
          <ScrollView keyboardShouldPersistTaps="always" style={{ maxHeight: 280 }}>
            {candidates.map((c) => (
              <Pressable
                key={c.cityId}
                style={styles.option}
                onPress={() => handleSelect(c)}
              >
                <Text style={styles.optionFlag}>{c.flag}</Text>
                <Text style={styles.optionText}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    wrap: { position: 'relative' },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: c.surface,
      color: c.textPrimary,
      fontSize: Typography.bodyMedium,
    },
    dropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: Spacing.xs,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      ...Shadows.medium,
      zIndex: 100,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border + '40',
    },
    optionFlag: { fontSize: 22 },
    optionText: {
      fontSize: Typography.bodyMedium,
      color: c.textPrimary,
      flex: 1,
    },
  });
}
