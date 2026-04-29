import { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Switch, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import Constants from 'expo-constants';

import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { getDB, resetDatabase } from '@/db/database';
import { exportData, importData } from '@/utils/backup';
import {
  getNotificationEnabled, setNotificationEnabled,
  ThemeMode,
} from '@/utils/settings';

interface UserInfo {
  nickname: string;
  nationality: string;
  homeCurrency: string;
}

interface Stats {
  totalTrips: number;
  uniqueCountries: number;
  totalLogs: number;
  totalExpenses: number;
  totalItems: number;
}

export default function MeScreen() {
  // 다크모드: ThemeProvider에서 관리
  const { colors, mode: themeMode, setMode: setThemeProvider } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [user, setUser] = useState<UserInfo | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalTrips: 0, uniqueCountries: 0, totalLogs: 0, totalExpenses: 0, totalItems: 0,
  });
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const db = await getDB();
      const u = await db.getFirstAsync<any>('SELECT * FROM user LIMIT 1');
      if (u) {
        setUser({
          nickname: u.nickname,
          nationality: u.nationality || '',
          homeCurrency: u.home_currency || 'KRW',
        });
      }

      // 통계 계산
      const tripsRow = await db.getFirstAsync<any>('SELECT COUNT(*) as c FROM trips');
      const countriesRow = await db.getFirstAsync<any>(
        "SELECT COUNT(DISTINCT country) as c FROM trips WHERE country IS NOT NULL AND country != ''"
      );
      const logsRow = await db.getFirstAsync<any>('SELECT COUNT(*) as c FROM trip_logs');
      const expensesRow = await db.getFirstAsync<any>('SELECT COUNT(*) as c FROM expenses');
      const itemsRow = await db.getFirstAsync<any>('SELECT COUNT(*) as c FROM trip_items');

      setStats({
        totalTrips: tripsRow?.c ?? 0,
        uniqueCountries: countriesRow?.c ?? 0,
        totalLogs: logsRow?.c ?? 0,
        totalExpenses: expensesRow?.c ?? 0,
        totalItems: itemsRow?.c ?? 0,
      });

      // 알림 설정만 로드 (테마는 ThemeProvider가 관리)
      setNotifEnabled(await getNotificationEnabled());
    } catch (err) {
      console.error(err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleEditProfile = () => {
    haptic.tap();
    router.push('/settings/profile');
  };

  const handleNotifToggle = async (v: boolean) => {
    haptic.select();
    setNotifEnabled(v);
    await setNotificationEnabled(v);
  };

  const handleThemeChange = async (mode: ThemeMode) => {
    haptic.select();
    await setThemeProvider(mode); // ThemeProvider가 즉시 전체 앱에 반영
  };

  const handleExport = async () => {
    haptic.medium();
    if (busy) return;
    setBusy(true);
    const result = await exportData();
    setBusy(false);
    if (result.ok) {
      haptic.success();
    } else {
      haptic.error();
    }
    Alert.alert(result.ok ? '백업 완료' : '백업 실패', result.message);
  };

  const handleImport = async () => {
    haptic.medium();
    if (busy) return;

    Alert.alert(
      '데이터 복원',
      '백업 파일로 복원하면 현재 여행 데이터가 모두 대체됩니다.\n계속하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '복원',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const result = await importData();
            setBusy(false);
            if (result.ok) {
              haptic.success();
              Alert.alert('복원 완료', result.message, [{ text: '확인', onPress: load }]);
            } else {
              haptic.error();
              Alert.alert('복원 실패', result.message);
            }
          },
        },
      ]
    );
  };

  const handleResetAll = () => {
    haptic.heavy();
    Alert.alert(
      '⚠️ 정말 모든 데이터를 초기화할까요?',
      '모든 여행 기록, 사진, 설정이 영구 삭제됩니다.\n이 작업은 되돌릴 수 없어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '초기화',
          style: 'destructive',
          onPress: async () => {
            await resetDatabase();
            haptic.heavy();
            router.replace('/(onboarding)/welcome');
          },
        },
      ]
    );
  };

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 프로필 헤더 */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.nickname?.[0] || '?'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nickname}>{user?.nickname || '이름없음'}</Text>
            <Text style={styles.nationality}>
              {countryLabel(user?.nationality)} · 기본 통화 {user?.homeCurrency}
            </Text>
          </View>
          <Pressable style={styles.editButton} onPress={handleEditProfile}>
            <Text style={styles.editButtonText}>수정</Text>
          </Pressable>
        </View>

        {/* 여행 통계 */}
        <View style={styles.statsCard}>
          <Text style={styles.cardTitle}>여행 통계</Text>
          <View style={styles.statsGrid}>
            <Stat value={stats.totalTrips} label="총 여행" styles={styles} />
            <Divider styles={styles} />
            <Stat value={stats.uniqueCountries} label="방문 국가" styles={styles} />
            <Divider styles={styles} />
            <Stat value={stats.totalLogs} label="기록 수" styles={styles} />
          </View>
          <View style={[styles.statsGrid, { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight }]}>
            <Stat value={stats.totalItems} label="일정" small styles={styles} />
            <Divider styles={styles} />
            <Stat value={stats.totalExpenses} label="지출 기록" small styles={styles} />
          </View>
        </View>

        {/* 설정 섹션 */}
        <SectionTitle styles={styles}>설정</SectionTitle>
        <View style={styles.menuCard}>
          <MenuRow
            icon="👤"
            label="프로필 수정"
            onPress={handleEditProfile}
            styles={styles}
          
          />
          <MenuRow
            icon="🎨"
            label="테마"
            value={themeMode === 'system' ? '시스템' : themeMode === 'dark' ? '다크' : '라이트'}
            onPress={() => {
              haptic.tap();
              Alert.alert('테마 선택', '원하는 테마를 선택하세요', [
                { text: '시스템 자동', onPress: () => handleThemeChange('system') },
                { text: '라이트', onPress: () => handleThemeChange('light') },
                { text: '다크', onPress: () => handleThemeChange('dark') },
                { text: '취소', style: 'cancel' },
              ]);
            }}
            styles={styles}
          
          />
          <MenuRowSwitch
            icon="🔔"
            label="알림 받기"
            value={notifEnabled}
            onValueChange={handleNotifToggle}
            styles={styles}
            colors={colors}
          
          />
        </View>

        {/* 데이터 섹션 */}
        <SectionTitle styles={styles}>데이터</SectionTitle>
        <View style={styles.menuCard}>
          <MenuRow
            icon="☁️"
            label="자동 백업"
            desc={Platform.OS === 'ios' ? 'iCloud 백업 안내' : 'Google Drive 백업 안내'}
            onPress={() => { haptic.tap(); router.push('/settings/backup'); }}
            styles={styles}
          />
          <MenuRow
            icon="💾"
            label="데이터 내보내기"
            desc="JSON 파일로 백업"
            onPress={handleExport}
            disabled={busy}
            styles={styles}
          
          />
          <MenuRow
            icon="📥"
            label="데이터 가져오기"
            desc="백업 파일에서 복원"
            onPress={handleImport}
            disabled={busy}
            styles={styles}
          
          />
        </View>

        {/* 앱 정보 섹션 */}
        <SectionTitle styles={styles}>앱 정보</SectionTitle>
        <View style={styles.menuCard}>
          <MenuRow icon="ℹ️" label="앱 버전" value={appVersion} noArrow
            styles={styles}
           />
          <MenuRow
            icon="📄"
            label="이용약관"
            onPress={() => { haptic.tap(); router.push('/settings/terms'); }}
            styles={styles}
          
          />
          <MenuRow
            icon="🔒"
            label="개인정보처리방침"
            onPress={() => { haptic.tap(); router.push('/settings/privacy'); }}
            styles={styles}

          />
          <MenuRow
            icon="⚠️"
            label="면책 조항"
            onPress={() => { haptic.tap(); router.push('/settings/disclaimer'); }}
            styles={styles}
          />
          <MenuRow
            icon="✉️"
            label="피드백 보내기"
            onPress={() => {
              haptic.tap();
              import('@/utils/feedback').then((m) => m.openFeedbackMail());
            }}
            styles={styles}
          />
        </View>

        {/* 위험 영역 */}
        <View style={{ marginTop: Spacing.xxl }}>
          <Pressable style={styles.dangerButton} onPress={handleResetAll}>
            <Text style={styles.dangerText}>⚠️ 모든 데이터 초기화</Text>
          </Pressable>
        </View>

        <View style={{ height: Spacing.huge }} />
      </ScrollView>

      {busy && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.overlayText}>처리 중...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function Stat({ value, label, small, styles }: {
  value: number;
  label: string;
  small?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, small && { fontSize: Typography.titleMedium }]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Divider({ styles }: { styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.divider} />;
}

function SectionTitle({ children, styles }: {
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function MenuRow({
  icon, label, desc, value, onPress, noArrow, disabled, styles,
}: {
  icon: string;
  label: string;
  desc?: string;
  value?: string;
  onPress?: () => void;
  noArrow?: boolean;
  disabled?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuRow,
        pressed && !disabled && { opacity: 0.6 },
        disabled && { opacity: 0.4 },
      ]}
      onPress={disabled ? undefined : onPress}
      disabled={disabled || !onPress}
    >
      <Text style={styles.menuIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuLabel}>{label}</Text>
        {desc && <Text style={styles.menuDesc}>{desc}</Text>}
      </View>
      {value && <Text style={styles.menuValue}>{value}</Text>}
      {!noArrow && onPress && <Text style={styles.menuArrow}>›</Text>}
    </Pressable>
  );
}

function MenuRowSwitch({
  icon, label, value, onValueChange, styles, colors,
}: {
  icon: string;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ColorPalette;
}) {
  return (
    <View style={styles.menuRow}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={[styles.menuLabel, { flex: 1 }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor="#fff"
      />
    </View>
  );
}

function countryLabel(code?: string): string {
  const map: Record<string, string> = {
    KR: '🇰🇷 한국',
    JP: '🇯🇵 일본',
    US: '🇺🇸 미국',
    OTHER: '🌍 기타',
  };
  return map[code || ''] || '🌍 기타';
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scroll: { padding: Spacing.xl },

  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: c.surface,
    padding: Spacing.lg,
    borderRadius: 16,
    marginBottom: Spacing.xl,
    ...Shadows.sm,
  },
  avatar: {
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: c.textOnPrimary,
  },
  nickname: {
    fontSize: Typography.titleMedium,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: 2,
  },
  nationality: {
    fontSize: Typography.labelMedium,
    color: c.textTertiary,
  },
  editButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: c.surfaceAlt,
    borderRadius: 10,
  },
  editButtonText: {
    fontSize: Typography.labelMedium,
    fontWeight: '600',
    color: c.textSecondary,
  },

  statsCard: {
    backgroundColor: c.surface,
    padding: Spacing.lg,
    borderRadius: 16,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  cardTitle: {
    fontSize: Typography.labelMedium,
    fontWeight: '700',
    color: c.accent,
    letterSpacing: 1,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: {
    fontSize: Typography.displaySmall,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: c.borderLight,
  },

  sectionTitle: {
    fontSize: Typography.labelMedium,
    fontWeight: '600',
    color: c.textTertiary,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },

  menuCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  menuIcon: { fontSize: 20 },
  menuLabel: {
    fontSize: Typography.bodyMedium,
    color: c.textPrimary,
    fontWeight: '500',
  },
  menuDesc: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    marginTop: 2,
  },
  menuValue: {
    fontSize: Typography.labelMedium,
    color: c.textTertiary,
  },
  menuArrow: {
    fontSize: 18,
    color: c.textTertiary,
  },

  dangerButton: {
    borderWidth: 1.5,
    borderColor: c.error,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  dangerText: {
    fontSize: Typography.bodyMedium,
    fontWeight: '600',
    color: c.error,
  },

  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  overlayText: {
    fontSize: Typography.bodyMedium,
    color: '#fff',
    fontWeight: '600',
  },
});
}

