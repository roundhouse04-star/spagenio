import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator,
         Share, Modal, TextInput, Linking } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { Colors, Fonts, FontSizes, Spacing, Radius } from '@/theme/theme';
import { Divider } from '@/components/UI';
import { getDB, resetDatabase } from '@/db/database';
import { getAllArtists } from '@/db/artists';
import { getAllEvents } from '@/db/events';
import { getAllTickets } from '@/db/tickets';
import { getAllNotifications } from '@/db/notifications';
import { syncAllArtists } from '@/services/syncManager';
import { getMeta, setMeta, deleteMeta, META_KEYS } from '@/db/app-meta';

export default function SettingsScreen() {
  const router = useRouter();
  const [counts, setCounts] = useState({ artists: 0, events: 0, tickets: 0, notifications: 0 });
  const [busy, setBusy] = useState<string | null>(null);
  const [kopisKey, setKopisKey] = useState<string | null>(null);
  const [showKopisModal, setShowKopisModal] = useState(false);
  const [kopisInput, setKopisInput] = useState('');

  const refresh = useCallback(async () => {
    const [a, e, t, n, key] = await Promise.all([
      getAllArtists('all'), getAllEvents(), getAllTickets(), getAllNotifications(),
      getMeta(META_KEYS.KOPIS_API_KEY),
    ]);
    setCounts({ artists: a.length, events: e.length, tickets: t.length, notifications: n.length });
    setKopisKey(key);
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleSync = async () => {
    try {
      setBusy('sync');
      const r = await syncAllArtists();
      Alert.alert('동기화 완료', `아티스트 ${r.artistCount}명 · 신규 이벤트 ${r.newEventCount}건${r.errors.length ? ` · 오류 ${r.errors.length}건` : ''}`);
      await refresh();
    } catch (e: any) {
      Alert.alert('동기화 실패', e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  };

  const openKopisModal = () => {
    setKopisInput(kopisKey ?? '');
    setShowKopisModal(true);
  };

  const saveKopisKey = async () => {
    const k = kopisInput.trim();
    if (!k) {
      await deleteMeta(META_KEYS.KOPIS_API_KEY);
      setKopisKey(null);
    } else {
      await setMeta(META_KEYS.KOPIS_API_KEY, k);
      setKopisKey(k);
    }
    setShowKopisModal(false);
    Alert.alert('저장됨', k ? 'KOPIS 키가 저장됐어요. 다음 동기화부터 적용됩니다.' : 'KOPIS 키를 삭제했어요.');
  };

  const openKopisGuide = () => {
    Linking.openURL('https://www.data.go.kr/data/15000343/openapi.do').catch(() => {
      Alert.alert('오류', '링크를 열 수 없습니다.');
    });
  };

  const handleExport = async () => {
    try {
      setBusy('export');
      const [artists, events, tickets, notifications] = await Promise.all([
        getAllArtists('all'), getAllEvents(), getAllTickets(), getAllNotifications(),
      ]);
      const payload = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        artists, events, tickets, notifications,
      };
      const fileName = `mygong-backup-${new Date().toISOString().slice(0,10)}.json`;
      const uri = (FileSystem.documentDirectory ?? '') + fileName;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: '내공연 백업 공유' });
      } else {
        Alert.alert('저장됨', uri);
      }
    } catch (e: any) {
      Alert.alert('내보내기 실패', e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      setBusy('import');
      const text = await FileSystem.readAsStringAsync(res.assets[0].uri);
      const payload = JSON.parse(text);
      // Import 흐름: 기존 데이터 유지하되 같은 id 있으면 덮어씀
      const db = await getDB();
      await db.withTransactionAsync(async () => {
        const now = new Date().toISOString();
        for (const a of payload.artists ?? []) {
          await db.runAsync(
            `INSERT OR REPLACE INTO artists (id, external_id, name, name_en, role, tag, emoji, avatar_url, thumb_color,
              bio, followers, is_following, notify_enabled, last_synced_at, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [a.id, a.externalId, a.name, a.nameEn, a.role, a.tag, a.emoji, a.avatarUrl, a.thumbColor,
             a.bio, a.followers, a.isFollowing ? 1 : 0, a.notifyEnabled ? 1 : 0, a.lastSyncedAt, a.createdAt ?? now, a.updatedAt ?? now]
          );
        }
        for (const e of payload.events ?? []) {
          await db.runAsync(
            `INSERT OR REPLACE INTO events (id, artist_id, external_id, title, category, cat_icon, date, weekday,
              time, venue, city, price, ticket_url, poster_url, notify_enabled, notes, source, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [e.id, e.artistId, e.externalId, e.title, e.category, e.catIcon, e.date, e.weekday, e.time, e.venue,
             e.city, e.price, e.ticketUrl, e.posterUrl, e.notifyEnabled ? 1 : 0, e.notes, e.source, e.createdAt ?? now, e.updatedAt ?? now]
          );
        }
        for (const t of payload.tickets ?? []) {
          await db.runAsync(
            `INSERT OR REPLACE INTO tickets (id, artist_id, event_id, title, category, cat_icon, date, month,
              venue, seat, photo_uri, rating, notes, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [t.id, t.artistId, t.eventId, t.title, t.category, t.catIcon, t.date, t.month,
             t.venue, t.seat, t.photoUri, t.rating ?? 0, t.notes, t.createdAt ?? now, t.updatedAt ?? now]
          );
        }
      });
      await refresh();
      Alert.alert('가져오기 완료');
    } catch (e: any) {
      Alert.alert('가져오기 실패', e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
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

        <SectionLabel>🔌 외부 데이터 소스</SectionLabel>
        <View style={styles.providerCard}>
          <View style={styles.providerRow}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>🌐</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.medium, fontSize: FontSizes.body }}>Wikipedia 한국어</Text>
              <Text style={{ fontSize: FontSizes.tiny, color: Colors.textSub, marginTop: 2 }}>
                프로필 + 본문에서 콘서트·투어 추출 · 키 불필요
              </Text>
            </View>
            <Text style={[styles.badge, { backgroundColor: Colors.verified, color: '#fff' }]}>활성</Text>
          </View>
          <Divider />
          <Pressable onPress={openKopisModal} style={({ pressed }) => [styles.providerRow, pressed && { opacity: 0.6 }]}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>🎭</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.medium, fontSize: FontSizes.body }}>KOPIS 공연정보</Text>
              <Text style={{ fontSize: FontSizes.tiny, color: Colors.textSub, marginTop: 2 }}>
                {kopisKey
                  ? `키 등록됨 · ${kopisKey.slice(0, 6)}…${kopisKey.slice(-4)}`
                  : '뮤지컬·연극·콘서트 공식 DB · 키 필요'}
              </Text>
            </View>
            <Text style={[styles.badge, kopisKey
              ? { backgroundColor: Colors.verified, color: '#fff' }
              : { backgroundColor: Colors.bgMuted, color: Colors.textSub }]}>
              {kopisKey ? '활성' : '미설정'}
            </Text>
          </Pressable>
          {!kopisKey && (
            <Pressable onPress={openKopisGuide} style={({ pressed }) => [{ paddingTop: 8 }, pressed && { opacity: 0.5 }]}>
              <Text style={{ fontSize: FontSizes.caption, color: Colors.primary, textAlign: 'center' }}>
                🔑 KOPIS API 키 발급 받기 (공공데이터포털) ›
              </Text>
            </Pressable>
          )}
        </View>
        <Text style={{ fontSize: FontSizes.tiny, color: Colors.textFaint, lineHeight: 16,
                       marginTop: 8, paddingHorizontal: 4 }}>
          • 모든 데이터는 개인 사용 목적으로만 사용됩니다.{'\n'}
          • 각 공연 상세 화면에 출처가 자동으로 표시됩니다.{'\n'}
          • 재배포·상업적 재판매는 각 제공처 정책을 따릅니다.
        </Text>

        <SectionLabel>🔄 데이터</SectionLabel>
        <Row icon="🔄" label="전체 동기화" sub="팔로잉 중인 아티스트 모두 새로 조회" onPress={handleSync} busy={busy === 'sync'} />
        <Row icon="📤" label="데이터 내보내기" sub="JSON 백업 파일 생성·공유" onPress={handleExport} busy={busy === 'export'} />
        <Row icon="📥" label="데이터 가져오기" sub="JSON 백업에서 복원 (기존 데이터 병합)" onPress={handleImport} busy={busy === 'import'} />

        <SectionLabel>⚠ 위험</SectionLabel>
        <Row icon="🗑" label="모든 데이터 삭제" sub="DB 초기화. 되돌릴 수 없음" onPress={handleReset} busy={busy === 'reset'} danger />

        <Text style={{ fontSize: FontSizes.tiny, color: Colors.textFaint, textAlign: 'center', marginTop: 30, lineHeight: 18 }}>
          내공연관리 · 모든 데이터는 이 기기에만 저장됩니다.{'\n'}
          기기 변경 · 앱 삭제 전엔 꼭 내보내기로 백업하세요.
        </Text>
      </ScrollView>

      {/* KOPIS 키 입력 모달 */}
      <Modal visible={showKopisModal} transparent animationType="fade" onRequestClose={() => setShowKopisModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowKopisModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>🎭 KOPIS API 키</Text>
            <Text style={styles.modalSub}>
              공공데이터포털에서 발급받은 일반 인증키를 붙여넣으세요.
              디코딩된 키 또는 인코딩된 키 둘 다 동작합니다.
            </Text>
            <TextInput
              value={kopisInput}
              onChangeText={setKopisInput}
              placeholder="예: a1b2c3d4..."
              placeholderTextColor={Colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.modalInput}
            />
            <Pressable onPress={openKopisGuide}>
              <Text style={{ color: Colors.primary, fontSize: FontSizes.caption, marginTop: 8, textAlign: 'right' }}>
                키 발급 페이지 열기 ›
              </Text>
            </Pressable>
            <View style={{ flexDirection: 'row', marginTop: 20, gap: 8 }}>
              <Pressable onPress={() => setShowKopisModal(false)}
                         style={[styles.modalBtn, { backgroundColor: Colors.bgMuted }]}>
                <Text style={{ fontFamily: Fonts.medium }}>취소</Text>
              </Pressable>
              <Pressable onPress={saveKopisKey}
                         style={[styles.modalBtn, { backgroundColor: Colors.primary }]}>
                <Text style={{ fontFamily: Fonts.medium, color: '#fff' }}>
                  {kopisInput.trim() ? '저장' : (kopisKey ? '키 삭제' : '닫기')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
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
  providerCard: { backgroundColor: Colors.bg, borderRadius: Radius.md,
                  borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.divider,
                  padding: Spacing.md },
  providerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  badge: { fontSize: FontSizes.tiny, fontFamily: Fonts.semibold,
           paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
                   alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', backgroundColor: Colors.bg, borderRadius: Radius.lg,
               padding: 20, maxWidth: 420 },
  modalTitle: { fontFamily: Fonts.semibold, fontSize: FontSizes.title, marginBottom: 6 },
  modalSub: { fontSize: FontSizes.caption, color: Colors.textSub, lineHeight: 18 },
  modalInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm,
                padding: 12, marginTop: 12, fontFamily: Fonts.regular,
                fontSize: FontSizes.body, color: Colors.text },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.sm,
              alignItems: 'center', justifyContent: 'center' },
});
