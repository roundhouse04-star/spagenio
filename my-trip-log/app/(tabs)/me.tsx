import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Colors, Typography, Spacing, Shadows } from '@/theme/theme';
import { getDB, resetDatabase } from '@/db/database';

export default function MeScreen() {
  const [user, setUser] = useState<{ nickname: string; nationality: string | null } | null>(null);
  const [stats, setStats] = useState({
    totalTrips: 0,
    totalLogs: 0,
    totalCountries: 0,
  });

  const load = useCallback(async () => {
    const db = await getDB();
    const u = await db.getFirstAsync<any>('SELECT * FROM user LIMIT 1');
    if (u) setUser({ nickname: u.nickname, nationality: u.nationality });

    const t = await db.getFirstAsync<any>('SELECT COUNT(*) as c FROM trips');
    const l = await db.getFirstAsync<any>('SELECT COUNT(*) as c FROM trip_logs');
    const c = await db.getFirstAsync<any>(
      `SELECT COUNT(DISTINCT country) as c FROM trips WHERE country IS NOT NULL AND country != ''`
    );
    setStats({
      totalTrips: t?.c ?? 0,
      totalLogs: l?.c ?? 0,
      totalCountries: c?.c ?? 0,
    });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleReset = () => {
    Alert.alert(
      '모든 데이터 삭제',
      '정말 모든 여행 기록을 삭제하시겠어요?\n이 작업은 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await resetDatabase();
            router.replace('/(onboarding)/welcome');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.nickname?.slice(0, 1).toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={styles.nickname}>{user?.nickname ?? '여행자'}</Text>
          <Text style={styles.nationality}>
            {user?.nationality === 'KR' ? '🇰🇷 대한민국' : user?.nationality ?? ''}
          </Text>
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>여행 통계</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalTrips}</Text>
              <Text style={styles.statLabel}>총 여행</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalCountries}</Text>
              <Text style={styles.statLabel}>방문 국가</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalLogs}</Text>
              <Text style={styles.statLabel}>기록 수</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>설정</Text>
        <View style={styles.menuList}>
          <MenuItem icon="👤" label="프로필 수정" />
          <MenuItem icon="💵" label="기본 통화 설정" />
          <MenuItem icon="🔔" label="알림 설정" />
          <MenuItem icon="💾" label="데이터 내보내기" />
          <MenuItem icon="📥" label="데이터 가져오기" />
        </View>

        <Text style={styles.sectionTitle}>앱 정보</Text>
        <View style={styles.menuList}>
          <MenuItem icon="ℹ️" label="앱 버전" trailing="1.0.0" />
          <MenuItem icon="📄" label="이용약관" />
          <MenuItem icon="🔒" label="개인정보처리방침" />
          <MenuItem icon="✉️" label="문의하기" />
        </View>

        <Pressable style={styles.dangerBtn} onPress={handleReset}>
          <Text style={styles.dangerBtnText}>모든 데이터 초기화</Text>
        </Pressable>

        <Text style={styles.footer}>
          My Trip Log v1.0.0{'\n'}
          Made with ♥ for travelers
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({
  icon, label, trailing,
}: {
  icon: string;
  label: string;
  trailing?: string;
}) {
  return (
    <Pressable style={styles.menuItem}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      {trailing ? (
        <Text style={styles.menuTrailing}>{trailing}</Text>
      ) : (
        <Text style={styles.menuArrow}>›</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.xxl, paddingBottom: Spacing.huge },
  profileCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  nickname: {
    fontSize: Typography.headlineMedium,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  nationality: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  statsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    ...Shadows.soft,
  },
  statsTitle: {
    fontSize: Typography.labelMedium,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },
  statValue: {
    fontSize: Typography.displayMedium,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: Typography.labelSmall,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontSize: Typography.labelMedium,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  menuList: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    ...Shadows.soft,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceAlt,
    gap: Spacing.md,
  },
  menuIcon: { fontSize: 22, width: 28 },
  menuLabel: {
    flex: 1,
    fontSize: Typography.bodyMedium,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  menuArrow: {
    fontSize: 22,
    color: Colors.textTertiary,
  },
  menuTrailing: {
    fontSize: Typography.bodySmall,
    color: Colors.textTertiary,
  },
  dangerBtn: {
    marginTop: Spacing.xxl,
    padding: Spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error,
    alignItems: 'center',
  },
  dangerBtnText: {
    color: Colors.error,
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
  },
  footer: {
    marginTop: Spacing.xxl,
    textAlign: 'center',
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
    lineHeight: Typography.labelSmall * 1.6,
  },
});
