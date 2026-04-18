/**
 * 교통 - 도시 목록 화면
 *
 * 도시를 클릭하면 [city]/transit/[city] 화면으로 이동
 */
import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Typography, Spacing, Shadows } from '@/theme/theme';
import { haptic } from '@/utils/haptics';
import transitData from '@/data/transit.json';

interface City {
  id: string;
  name: string;
  flag: string;
  country: string;
  linesCount: number;
  stationsCount: number;
}

const FALLBACK_CITIES: City[] = [
  { id: 'seoul', name: '서울', flag: '🇰🇷', country: '한국', linesCount: 9, stationsCount: 320 },
  { id: 'tokyo', name: '도쿄', flag: '🇯🇵', country: '일본', linesCount: 13, stationsCount: 285 },
  { id: 'osaka', name: '오사카', flag: '🇯🇵', country: '일본', linesCount: 9, stationsCount: 130 },
  { id: 'bangkok', name: '방콕', flag: '🇹🇭', country: '태국', linesCount: 6, stationsCount: 70 },
  { id: 'singapore', name: '싱가포르', flag: '🇸🇬', country: '싱가포르', linesCount: 6, stationsCount: 119 },
  { id: 'hongkong', name: '홍콩', flag: '🇭🇰', country: '홍콩', linesCount: 11, stationsCount: 98 },
  { id: 'paris', name: '파리', flag: '🇫🇷', country: '프랑스', linesCount: 16, stationsCount: 308 },
  { id: 'london', name: '런던', flag: '🇬🇧', country: '영국', linesCount: 11, stationsCount: 272 },
];

export default function TransitScreen() {
  const [cities, setCities] = useState<City[]>(FALLBACK_CITIES);

  useEffect(() => {
    // JSON 데이터에서 도시 목록 추출 (있으면 사용)
    try {
      const data = transitData as any;
      if (data.cities && data.cities.length > 0) {
        const cityList: City[] = data.cities.map((cityId: string) => {
          const lines = data.lines.filter((l: any) => l.city === cityId);
          const stations = data.stations.filter((s: any) => s.city === cityId);
          const fb = FALLBACK_CITIES.find(f => f.id === cityId);
          return {
            id: cityId,
            name: fb?.name || cityId,
            flag: fb?.flag || '🌍',
            country: fb?.country || '',
            linesCount: lines.length,
            stationsCount: stations.length,
          };
        });
        if (cityList.length > 0) setCities(cityList);
      }
    } catch (err) {
      console.warn('교통 데이터 로드 실패', err);
    }
  }, []);

  const openCity = (city: City) => {
    haptic.tap();
    router.push(`/transit/${city.id}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>🚇 교통</Text>
        <Text style={styles.subtitle}>전세계 주요 도시의 지하철 정보</Text>

        <View style={styles.grid}>
          {cities.map((c) => (
            <Pressable key={c.id} style={styles.card} onPress={() => openCity(c)}>
              <Text style={styles.flag}>{c.flag}</Text>
              <Text style={styles.cityName}>{c.name}</Text>
              <Text style={styles.country}>{c.country}</Text>
              <View style={styles.stats}>
                <Text style={styles.statText}>🚇 {c.linesCount}개 노선</Text>
                <Text style={styles.statText}>📍 {c.stationsCount}개 역</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            💡 더 많은 도시가 추가될 예정이에요
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.xl, paddingBottom: Spacing.huge },
  title: {
    fontSize: Typography.displaySmall,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.bodyMedium,
    color: Colors.textTertiary,
    marginBottom: Spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  card: {
    flexBasis: '47%',
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: 14,
    ...Shadows.sm,
  },
  flag: {
    fontSize: 36,
    marginBottom: Spacing.sm,
  },
  cityName: {
    fontSize: Typography.titleMedium,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  country: {
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
  },
  stats: {
    gap: 2,
  },
  statText: {
    fontSize: Typography.labelSmall,
    color: Colors.textSecondary,
  },
  footer: {
    marginTop: Spacing.xxxl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
  },
});
