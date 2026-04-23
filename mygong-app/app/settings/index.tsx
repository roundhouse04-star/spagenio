import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, FontSizes, Spacing, Radius } from '@/theme/theme';
import { Divider } from '@/components/UI';
import { getAllArtists } from '@/db/artists';
import { getAllEvents } from '@/db/events';
import { getAllTickets } from '@/db/tickets';
import { getAllNotifications } from '@/db/notifications';
import { resetDatabase } from '@/db/database';
import { syncAllArtists } from '@/services/syncManager';
import {
  createBackup,
  listBackups,
  restoreFromFile,
  shareBackup,
  deleteBackup,
  getLastBackupInfo,
  type BackupFile,
  type LastBackupInfo,
} from '@/services/backup';

import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';

export default function SettingsScreen() {
  const router = useRouter();
  const [counts, setCounts] = useState({ artists: 0, events: 0, tickets: 0, notifications: 0 });
  const [busy, setBusy] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [lastBackup, setLastBackup] = useState<LastBackupInfo>({ display: '없음' });

  const refresh = useCallback(async () => {
    const [a, e, t, n, list, last] = await Promise.all([
      getAllArtists('all'), getAllEvents(), getAllTickets(), getAllNotifications(),
      listBackups(), getLastBackupInfo(),
    ]);
    setCounts({ artists: a.length, events: e.length, tickets: t.length, notifications: n.length });
    setBackups(list);
    setLastBackup(last);
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleSync = async () => {
    Alert.alert(
      '전체 동기화',
      '팔로잉 중인 아티스트 전원의 과거·미래 공연을 모두 조회해요.\n\n⏳ 아티스트 수에 따라 1~3분 정도 걸릴 수 있어요.\n그동안 앱을 닫지 말고 기다려주세요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '시작',
          onPress: async () => {
            try {
              setBusy('sync');
              const r = await syncAllArtists('full');
              Alert.alert('동기화 완료', `아티스트 ${r.artistCount}명 · 신규 이벤트 ${r.newEventCount}건${r.errors.length ? ` · 오류 ${r.errors.length}건` : ''}`);
              await refresh();
            } catch (e: any) {
              Alert.alert('동기화 실패', e?.message ?? String(e));
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  };

  // ─── 즉시 백업 (수동) ───────────────────────────────────────
  const handleBackupNow = async () => {
    try {
      setBusy('backup');
      const uri = await createBackup('manual');
      await refresh();
      Alert.alert('백업 완료', '저장된 백업 목록에서 확인할 수 있어요.');
    } catch (e: any) {
      Alert.alert('백업 실패', e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  };

  // ─── 최신 백업 외부로 공유 (AirDrop / iCloud Drive 등) ──────
  const handleShareLatest = async () => {
    try {
      if (backups.length === 0) {
        Alert.alert('백업 없음', '먼저 백업을 만들어주세요.');
        return;
      }
      setBusy('share');
      await shareBackup(backups[0].uri);
    } catch (e: any) {
      Alert.alert('공유 실패', e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  };

  // ─── 외부 파일에서 복원 ───────────────────────────────────
  const handleImportExternal = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;

      Alert.alert(
        '복원 확인',
        '백업 파일에서 데이터를 가져옵니다. 같은 ID의 데이터는 덮어씁니다. 진행할까요?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '복원',
            onPress: async () => {
              setBusy('import');
              const result = await restoreFromFile(res.assets![0].uri);
              if (result.success) {
                await refresh();
                Alert.alert('복원 완료',
                  `아티스트 ${result.stats?.artistCount ?? 0}명, 티켓 ${result.stats?.ticketCount ?? 0}장`);
              } else {
                Alert.alert('복원 실패', result.message);
              }
              setBusy(null);
            },
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('가져오기 실패', e?.message ?? String(e));
      setBusy(null);
    }
  };

  // ─── 저장된 백업에서 복원 ─────────────────────────────────
  const handleRestoreLocal = (file: BackupFile) => {
    Alert.alert(
      '백업에서 복원',
      `${formatBackupTime(file.createdAt)} 백업으로 복원합니다. 같은 ID의 데이터는 덮어씁니다. 진행할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '복원',
          onPress: async () => {
            try {
              setBusy('restore');
              const result = await restoreFromFile(file.uri);
              if (result.success) {
                await refresh();
                Alert.alert('복원 완료',
                  `아티스트 ${result.stats?.artistCount ?? 0}명, 티켓 ${result.stats?.ticketCount ?? 0}장`);
              } else {
                Alert.alert('복원 실패', result.message);
              }
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  };

  const handleDeleteBackup = (file: BackupFile) => {
    Alert.alert('백업 삭제', `${formatBackupTime(file.createdAt)} 백업을 삭제합니다.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          await deleteBackup(file.uri);
          await refresh();
        },
      },
    ]);
  };

  const handleShareBackup = async (file: BackupFile) => {
    try { await shareBackup(file.uri); }
    catch (e: any) { Alert.alert('공유 실패', e?.message ?? String(e)); }
  };

  const handleReset = () => {
    Alert.alert('모든 데이터 삭제', '되돌릴 수 없습니다. 정말 삭제하시겠어요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        try {
          setBusy('reset');
          await resetDatabase();
          await refresh();
          Alert.alert('초기화 완료');
        } catch (e: any) {
          Alert.alert('실패', e?.message ?? String(e));
        } finally {
          setBusy(null);
        }
      }},
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={{ fontSize: 22 }}>‹</Text></Pressable>
        <Text style={styles.navTitle}>설정</Text>
        <View style={{ width: 22 }} />
      </View>
      <Divider />

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 80 }}>
        {/* Stats card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 데이터 현황</Text>
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <StatBlock n={counts.artists} label="아티스트" />
            <StatBlock n={counts.events} label="공연" />
            <StatBlock n={counts.tickets} label="티켓" />
            <StatBlock n={counts.notifications} label="알림" />
          </View>
        </View>

        {/* ─── 데이터 보호 (자동 백업) ─────────────────────── */}
        <SectionLabel>🔒 데이터 보호</SectionLabel>

        <View style={styles.backupCard}>
          <Text style={styles.backupCardLabel}>마지막 백업</Text>
          <Text style={styles.backupCardValue}>{lastBackup.display}</Text>
          <Text style={styles.backupCardSub}>
            저장된 백업 {backups.length}개 · 데이터 변경 시 자동 백업
          </Text>
        </View>

        <Row icon="📦" label="지금 백업하기" sub="현재 데이터를 즉시 백업"
             onPress={handleBackupNow} busy={busy === 'backup'} />
        <Row icon="📤" label="최신 백업 공유" sub="AirDrop · iCloud Drive · 카톡 등으로 보내기"
             onPress={handleShareLatest} busy={busy === 'share'} />
        <Row icon="📥" label="백업 파일에서 복원" sub="외부 JSON 파일 가져오기"
             onPress={handleImportExternal} busy={busy === 'import'} />

        {/* ─── 저장된 백업 목록 ─────────────────────────── */}
        {backups.length > 0 && (
          <>
            <SectionLabel>📋 저장된 백업 ({backups.length})</SectionLabel>
            {backups.map(file => (
              <BackupItem
                key={file.uri}
                file={file}
                onRestore={() => handleRestoreLocal(file)}
                onShare={() => handleShareBackup(file)}
                onDelete={() => handleDeleteBackup(file)}
              />
            ))}
          </>
        )}

        {/* ─── 데이터 동기화 ─────────────────────────────── */}
        <SectionLabel>🔄 데이터</SectionLabel>
        <Row icon="🔄" label="전체 동기화" sub="팔로잉 중인 아티스트 모두 새로 조회"
             onPress={handleSync} busy={busy === 'sync'} />

        {/* ─── 위험 ─────────────────────────────────────── */}
        <SectionLabel>⚠ 위험</SectionLabel>
        <Row icon="🗑" label="모든 데이터 삭제" sub="DB 초기화. 되돌릴 수 없음"
             onPress={handleReset} busy={busy === 'reset'} danger />

        {/* ─── 정보 ─────────────────────────────────────── */}
        <SectionLabel>ℹ️ 정보</SectionLabel>
        <Row icon="📖" label="앱 정보" sub="데이터 출처·라이선스·약관"
             onPress={() => router.push('/settings/about')} />

        <Text style={{ fontSize: FontSizes.tiny, color: Colors.textFaint,
                       textAlign: 'center', marginTop: 30, lineHeight: 18 }}>
          내공연관리 · 모든 데이터는 이 기기에 저장됩니다.{'\n'}
          중요한 데이터는 가끔 외부로 공유해서 보관하세요.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── 백업 아이템 ───────────────────────────────────────────
function BackupItem({ file, onRestore, onShare, onDelete }: {
  file: BackupFile;
  onRestore: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.backupItem}>
      <View style={{ flex: 1 }}>
        <Text style={styles.backupItemTitle}>
          {file.trigger === 'manual' ? '✋' : '⚙️'} {formatBackupTime(file.createdAt)}
        </Text>
        <Text style={styles.backupItemSub}>
          {file.trigger === 'manual' ? '수동 백업' : '자동 백업'} · {formatSize(file.sizeBytes)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <Pressable onPress={onShare} style={styles.iconBtn} hitSlop={6}>
          <Text style={{ fontSize: 18 }}>📤</Text>
        </Pressable>
        <Pressable onPress={onRestore} style={styles.iconBtn} hitSlop={6}>
          <Text style={{ fontSize: 18 }}>↩️</Text>
        </Pressable>
        <Pressable onPress={onDelete} style={styles.iconBtn} hitSlop={6}>
          <Text style={{ fontSize: 18 }}>🗑</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatBackupTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yy}.${mm}.${dd} ${hh}:${min}`;
  } catch {
    return iso;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function StatBlock({ n, label }: { n: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontFamily: Fonts.bold, fontSize: FontSizes.h2 }}>{n}</Text>
      <Text style={{ fontSize: FontSizes.tiny, color: Colors.textSub, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={{ fontSize: FontSizes.caption, fontFamily: Fonts.semibold, color: Colors.textSub,
                   marginTop: Spacing.xl, marginBottom: 6, paddingLeft: 4 }}>
      {children}
    </Text>
  );
}

function Row({ icon, label, sub, onPress, busy, danger }: {
  icon: string; label: string; sub?: string; onPress: () => void; busy?: boolean; danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={busy}
               style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <Text style={{ fontSize: 22, width: 32 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: FontSizes.body, fontFamily: Fonts.medium, color: danger ? Colors.heart : Colors.text }}>
          {label}
        </Text>
        {sub && <Text style={{ fontSize: FontSizes.tiny, color: Colors.textSub, marginTop: 2 }}>{sub}</Text>}
      </View>
      {busy ? <ActivityIndicator size="small" /> : <Text style={{ color: Colors.textFaint, fontSize: 18 }}>›</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: Spacing.lg, height: 48 },
  navTitle: { fontSize: FontSizes.title, fontFamily: Fonts.semibold },
  card: { backgroundColor: Colors.bgMuted, padding: Spacing.lg, borderRadius: Radius.md },
  cardTitle: { fontFamily: Fonts.semibold, fontSize: FontSizes.body },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
         backgroundColor: Colors.bg, borderRadius: Radius.md, marginBottom: 6, gap: 8,
         borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.divider },

  // ─── 데이터 보호 카드 ────────────────────────────────
  backupCard: {
    backgroundColor: '#fff8e1',
    padding: Spacing.lg,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  backupCardLabel: {
    fontSize: FontSizes.tiny,
    color: '#7a5e00',
  },
  backupCardValue: {
    fontSize: FontSizes.h2,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginTop: 2,
  },
  backupCardSub: {
    fontSize: FontSizes.tiny,
    color: Colors.textSub,
    marginTop: 6,
  },

  // ─── 백업 아이템 ─────────────────────────────────────
  backupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    marginBottom: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.divider,
    gap: 8,
  },
  backupItemTitle: {
    fontSize: FontSizes.body,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  backupItemSub: {
    fontSize: FontSizes.tiny,
    color: Colors.textSub,
    marginTop: 2,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 4,
  },
});
