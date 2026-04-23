import { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Typography, Spacing } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { getDB, getDBPath } from '@/db/database';
import { exportData, importData } from '@/utils/backup';

export default function BackupScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [dbPath, setDbPath] = useState<string>('');
  const [stats, setStats] = useState<{
    trips: number;
    logs: number;
    expenses: number;
    receipts: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const path = await getDBPath();
        setDbPath(path);

        const db = await getDB();
        const t = await db.getFirstAsync<any>('SELECT COUNT(*) as c FROM trips');
        const l = await db.getFirstAsync<any>('SELECT COUNT(*) as c FROM trip_logs');
        const e = await db.getFirstAsync<any>('SELECT COUNT(*) as c FROM expenses');
        const r = await db.getFirstAsync<any>(
          "SELECT COUNT(*) as c FROM expenses WHERE receipt_image IS NOT NULL AND receipt_image != ''"
        );
        setStats({
          trips: t?.c ?? 0,
          logs: l?.c ?? 0,
          expenses: e?.c ?? 0,
          receipts: r?.c ?? 0,
        });
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  const handleExport = async () => {
    haptic.medium();
    if (busy) return;
    setBusy(true);
    const result = await exportData();
    setBusy(false);
    haptic[result.ok ? 'success' : 'error']();
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
            haptic[result.ok ? 'success' : 'error']();
            Alert.alert(result.ok ? '복원 완료' : '복원 실패', result.message);
          },
        },
      ]
    );
  };

  const cloudName = Platform.OS === 'ios' ? 'iCloud' : 'Google Drive';
  const settingsHint =
    Platform.OS === 'ios'
      ? 'iPhone 설정 → 본인 이름 → iCloud → iCloud Drive 켜기 → 앱 목록에서 Spagenio 켜기'
      : 'Android 설정 → 시스템 → 백업 → Google One으로 백업 켜기';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>데이터 백업</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 자동 백업 안내 */}
        <View style={styles.heroCard}>
          <Text style={styles.heroIcon}>☁️</Text>
          <Text style={styles.heroTitle}>{cloudName} 자동 백업 활성화됨</Text>
          <Text style={styles.heroDesc}>
            앱의 모든 데이터(여행, 일기, 가계부, 영수증 사진)는{'\n'}
            {cloudName}에 자동으로 백업됩니다.
          </Text>
        </View>

        {/* 현재 데이터 통계 */}
        {stats && (
          <View style={styles.statsCard}>
            <Text style={styles.cardTitle}>📊 백업 대상 데이터</Text>
            <View style={styles.statsGrid}>
              <StatBox icon="🌍" label="여행" value={stats.trips} styles={styles} />
              <StatBox icon="📝" label="일기" value={stats.logs} styles={styles} />
              <StatBox icon="💰" label="지출" value={stats.expenses} styles={styles} />
              <StatBox icon="🧾" label="영수증" value={stats.receipts} styles={styles} />
            </View>
          </View>
        )}

        {/* 어떻게 작동하는가 */}
        <Section title="🔄 어떻게 작동하나요?" styles={styles}>
          {Platform.OS === 'ios'
            ? `• iOS는 앱 데이터를 매일 밤(Wi-Fi 연결 시) iCloud에 자동 백업합니다.
• 새 iPhone으로 옮길 때 iCloud 백업에서 복원하면 모든 데이터가 그대로 옮겨집니다.
• 같은 Apple ID로 로그인된 다른 기기에서도 자동으로 동기화됩니다.`
            : `• Android는 24시간마다(Wi-Fi 연결 + 충전 중) Google Drive에 자동 백업합니다.
• 새 폰에서 같은 Google 계정으로 앱을 설치하면 이전 데이터가 자동으로 복원됩니다.
• 백업 용량은 최대 25MB까지 무료(Google Drive 용량과 별개).`}
        </Section>

        {/* 활성화 방법 */}
        <Section title="✅ 자동 백업 켜는 방법" styles={styles}>
          {settingsHint}
        </Section>

        {/* 수동 백업도 함께 */}
        <Section title="💾 수동 백업도 가능" styles={styles}>
          {`자동 백업 외에도 언제든 데이터를 JSON 파일로 직접 내보낼 수 있어요.
이메일이나 메신저로 자기 자신에게 보내거나, 다른 클라우드(Google Drive, Dropbox)에 직접 저장할 수 있습니다.`}
        </Section>

        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, busy && styles.actionBtnDisabled]}
            onPress={handleExport}
            disabled={busy}
          >
            <Text style={styles.actionBtnIcon}>📤</Text>
            <Text style={styles.actionBtnText}>지금 내보내기</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, busy && styles.actionBtnDisabled]}
            onPress={handleImport}
            disabled={busy}
          >
            <Text style={styles.actionBtnIcon}>📥</Text>
            <Text style={styles.actionBtnText}>파일에서 복원</Text>
          </Pressable>
        </View>

        {/* 디버깅 정보 (개발자용) */}
        {__DEV__ && dbPath && (
          <View style={styles.debugCard}>
            <Text style={styles.debugLabel}>🔧 DB 경로 (개발 모드)</Text>
            <Text style={styles.debugValue}>{dbPath}</Text>
          </View>
        )}

        <View style={{ height: Spacing.huge }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ icon, label, value, styles }: {
  icon: string;
  label: string;
  value: number;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children, styles }: {
  title: string;
  children: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backText: { fontSize: 24, color: c.textPrimary },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: Typography.bodyLarge, fontWeight: '700', color: c.textPrimary },
    scroll: { padding: Spacing.xl },

    heroCard: {
      backgroundColor: c.primary,
      borderRadius: 16,
      padding: Spacing.xl,
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    heroIcon: { fontSize: 40, marginBottom: Spacing.sm },
    heroTitle: {
      fontSize: Typography.bodyLarge,
      fontWeight: '700',
      color: c.textOnPrimary,
      marginBottom: Spacing.xs,
    },
    heroDesc: {
      fontSize: Typography.bodyMedium,
      color: c.textOnPrimary,
      opacity: 0.9,
      textAlign: 'center',
      lineHeight: 20,
    },

    statsCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: c.border,
    },
    cardTitle: {
      fontSize: Typography.bodyMedium,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: Spacing.md,
    },
    statsGrid: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    statBox: {
      flex: 1,
      backgroundColor: c.surfaceAlt,
      borderRadius: 10,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    statIcon: { fontSize: 22, marginBottom: 2 },
    statValue: { fontSize: Typography.headlineSmall, fontWeight: '700', color: c.textPrimary },
    statLabel: { fontSize: Typography.labelSmall, color: c.textTertiary, marginTop: 2 },

    section: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: c.border,
    },
    sectionTitle: {
      fontSize: Typography.bodyMedium,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: Spacing.sm,
    },
    sectionBody: {
      fontSize: Typography.bodyMedium,
      color: c.textSecondary,
      lineHeight: 22,
    },

    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    actionBtn: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 12,
      padding: Spacing.lg,
      alignItems: 'center',
    },
    actionBtnDisabled: { opacity: 0.5 },
    actionBtnIcon: { fontSize: 22, marginBottom: 4 },
    actionBtnText: {
      fontSize: Typography.bodyMedium,
      color: c.primary,
      fontWeight: '600',
    },

    debugCard: {
      marginTop: Spacing.xl,
      padding: Spacing.md,
      backgroundColor: c.surfaceAlt,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      borderStyle: 'dashed',
    },
    debugLabel: { fontSize: Typography.labelSmall, color: c.textTertiary, marginBottom: 4 },
    debugValue: { fontSize: 11, color: c.textSecondary, fontFamily: 'monospace' },
  });
}
