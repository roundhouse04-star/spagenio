/**
 * 가고 싶은 도시 위시리스트
 */
import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { getWishlist, toggleWishlist } from '@/utils/wishlist';
import { getCityDisplayName, getCityFlag, getHighlightsByCity, CITY_ALIASES } from '@/data/cityHighlights';
import { getCityImageUrl } from '@/utils/cityImages';

export default function WishlistScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [list, setList] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string | null>>({});

  const load = useCallback(async () => {
    const ids = await getWishlist();
    setList(ids);
    // 이미지 lazy fetch
    const urls: Record<string, string | null> = {};
    await Promise.all(
      ids.map(async (id) => {
        urls[id] = await getCityImageUrl(id);
      }),
    );
    setImageUrls(urls);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRemove = async (cityId: string) => {
    haptic.medium();
    await toggleWishlist(cityId);
    setList((prev) => prev.filter((id) => id !== cityId));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>❤️ 가고 싶은 곳 ({list.length})</Text>
        <View style={{ width: 36 }} />
      </View>

      {list.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💭</Text>
          <Text style={styles.emptyTitle}>아직 위시리스트가 비어있어요</Text>
          <Text style={styles.emptyDesc}>
            탐색에서 ❤️ 버튼으로 가고 싶은 도시를 추가해보세요
          </Text>
          <Pressable
            style={styles.emptyBtn}
            onPress={() => { haptic.medium(); router.replace('/(tabs)/discover'); }}
          >
            <Text style={styles.emptyBtnText}>🔍 탐색 둘러보기</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {list.map((cityId) => {
            const all = getHighlightsByCity(cityId);
            const imageUrl = imageUrls[cityId];
            const exists = !!CITY_ALIASES[cityId];
            if (!exists) return null;
            return (
              <Pressable
                key={cityId}
                style={styles.card}
                onPress={() => { haptic.tap(); router.push('/(tabs)/discover'); }}
              >
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={StyleSheet.absoluteFillObject}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.primary }]} />
                )}
                <LinearGradient
                  colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <Pressable
                  onPress={() => handleRemove(cityId)}
                  hitSlop={8}
                  style={styles.heartBtn}
                >
                  <Text style={styles.heartActive}>❤️</Text>
                </Pressable>
                <View style={styles.cardBottom}>
                  <Text style={styles.cardFlag}>{getCityFlag(cityId)}</Text>
                  <Text style={styles.cardName}>{getCityDisplayName(cityId)}</Text>
                  <Text style={styles.cardCount}>{all.length}곳 추천 장소</Text>
                </View>
              </Pressable>
            );
          })}
          <View style={{ height: Spacing.huge }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backText: { fontSize: 24, color: c.textPrimary },
    headerTitle: { fontSize: Typography.bodyLarge, fontWeight: '700', color: c.textPrimary },

    empty: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      gap: Spacing.md, paddingHorizontal: Spacing.xl,
    },
    emptyIcon: { fontSize: 56 },
    emptyTitle: { fontSize: Typography.titleMedium, fontWeight: '700', color: c.textPrimary },
    emptyDesc: { fontSize: Typography.bodySmall, color: c.textSecondary, textAlign: 'center', lineHeight: 22 },
    emptyBtn: {
      marginTop: Spacing.md,
      backgroundColor: c.primary,
      paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl,
      borderRadius: 999,
    },
    emptyBtnText: { color: c.textOnPrimary, fontWeight: '700', fontSize: Typography.bodyMedium },

    scroll: { padding: Spacing.lg, gap: Spacing.md },
    card: {
      height: 160,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: c.surfaceAlt,
      ...Shadows.medium,
    },
    heartBtn: {
      position: 'absolute', top: Spacing.md, right: Spacing.md,
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.9)',
      alignItems: 'center', justifyContent: 'center',
    },
    heartActive: { fontSize: 18 },
    cardBottom: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      padding: Spacing.lg,
    },
    cardFlag: { fontSize: 28, marginBottom: 2 },
    cardName: {
      fontSize: Typography.titleMedium, color: '#FFFFFF', fontWeight: '700',
      textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4,
    },
    cardCount: { fontSize: Typography.labelSmall, color: 'rgba(255,255,255,0.85)' },
  });
}
