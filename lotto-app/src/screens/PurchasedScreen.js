import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LottoBall from '../components/LottoBall';
import { theme } from '../lib/theme';
import {
  loadPurchases, removePurchase, updatePurchase, clearAllPurchases,
} from '../lib/storage';
import { fetchRound } from '../lib/lottoApi';
import { evaluateRank } from '../lib/lottoEngine';

const RANK_LABEL = {
  1: { txt: '🏆 1등', color: '#dc2626' },
  2: { txt: '🥈 2등', color: '#ea580c' },
  3: { txt: '🥉 3등', color: '#d97706' },
  4: { txt: '4등', color: '#10b981' },
  5: { txt: '5등', color: '#0ea5e9' },
  0: { txt: '낙첨', color: '#6b7280' },
};

const SOURCE_LABEL = { qr: { icon: '📷', txt: 'QR' }, manual: { icon: '✍️', txt: '수기' } };

export default function PurchasedScreen({ navigation }) {
  const [list, setList] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    const rows = await loadPurchases();
    setList(rows);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    navigation.setOptions?.({ title: '🎟 구입번호' });
  }, [navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const onAddManual = () => navigation.navigate('QRScan', { saveToPurchased: true, sourceMode: 'gallery' });
  const onAddQR = () => navigation.navigate('QRScan', { saveToPurchased: true, sourceMode: 'camera' });

  const onDelete = (id) => {
    Alert.alert('삭제', '이 회차의 구입번호를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => setList(await removePurchase(id)) },
    ]);
  };

  const onClearAll = () => {
    if (!list.length) return;
    Alert.alert('전체 삭제', '저장된 모든 구입번호를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => { await clearAllPurchases(); setList([]); },
      },
    ]);
  };

  const onCheckAll = async () => {
    if (!list.length) return;
    setChecking(true);
    try {
      const cache = {};
      let updated = 0, totalWin = 0;
      for (const p of list) {
        if (!cache[p.round]) cache[p.round] = await fetchRound(p.round);
        const round = cache[p.round];
        if (!round) continue;
        const results = p.games.map((nums) => ({ numbers: nums, ...evaluateRank(nums, round.numbers, round.bonus) }));
        const winCount = results.filter((r) => r.rank > 0).length;
        totalWin += winCount;
        await updatePurchase(p.id, {
          results,
          drawDate: round.drwDate,
          winning: round.numbers,
          bonus: round.bonus,
        });
        updated += 1;
      }
      await load();
      Alert.alert('당첨 확인 완료', `${updated}건 조회 · ${totalWin}게임 당첨 🎉`);
    } catch (e) {
      Alert.alert('오류', e.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={list}
      keyExtractor={(it) => it.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <View style={styles.actionGrid}>
            <Pressable style={[styles.actionCard, { backgroundColor: '#dbeafe' }]} onPress={onAddQR}>
              <Text style={styles.actionEmoji}>📷</Text>
              <Text style={styles.actionTitle}>QR 스캔</Text>
              <Text style={styles.actionSub}>카메라로 실시간</Text>
            </Pressable>
            <Pressable style={[styles.actionCard, { backgroundColor: '#fce7f3' }]} onPress={onAddManual}>
              <Text style={styles.actionEmoji}>🖼</Text>
              <Text style={styles.actionTitle}>직접입력</Text>
              <Text style={styles.actionSub}>갤러리 이미지</Text>
            </Pressable>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryTxt}>총 {list.length}건의 구입번호</Text>
            {list.length > 0 && (
              <Pressable onPress={onClearAll}>
                <Text style={styles.clearTxt}>전체삭제</Text>
              </Pressable>
            )}
          </View>

          {list.length > 0 && (
            <Pressable
              style={[styles.checkBtn, checking && { opacity: 0.6 }]}
              disabled={checking}
              onPress={onCheckAll}
            >
              <Text style={styles.checkBtnTxt}>
                {checking ? '확인 중...' : '🎯 전체 당첨 확인'}
              </Text>
            </Pressable>
          )}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🎟</Text>
          <Text style={styles.emptyTitle}>구입한 복권이 없습니다</Text>
          <Text style={styles.emptySub}>QR 스캔 또는 직접입력으로 등록하세요</Text>
        </View>
      }
      renderItem={({ item }) => {
        const winSet = item.winning ? new Set(item.winning) : null;
        const winCount = item.results ? item.results.filter((r) => r.rank > 0).length : 0;
        const totalGames = item.games.length;
        const src = SOURCE_LABEL[item.source] || { icon: '🎟', txt: '' };
        return (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View>
                <View style={styles.roundRow}>
                  <Text style={styles.roundTxt}>{item.round}회</Text>
                  <Text style={styles.srcTxt}>{src.icon} {src.txt}</Text>
                </View>
                <Text style={styles.metaTxt}>
                  {totalGames}게임 · {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                  {item.note ? ` · ${item.note}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => onDelete(item.id)} hitSlop={8}>
                <Text style={styles.delTxt}>✕</Text>
              </Pressable>
            </View>

            {item.winning && (
              <View style={styles.winningStrip}>
                <Text style={styles.winningLabel}>당첨번호</Text>
                <View style={styles.winningBalls}>
                  {item.winning.map((n) => <LottoBall key={n} n={n} size={26} />)}
                  <Text style={styles.plus}>+</Text>
                  <LottoBall n={item.bonus} size={26} />
                </View>
              </View>
            )}

            {item.games.map((nums, idx) => {
              const r = item.results?.[idx];
              const info = r ? RANK_LABEL[r.rank] : null;
              return (
                <View key={idx} style={styles.gameRow}>
                  <Text style={styles.gameLabel}>{idx + 1}</Text>
                  <View style={styles.balls}>
                    {nums.map((n) => (
                      <LottoBall key={n} n={n} size={30} outlined={winSet ? !winSet.has(n) : false} />
                    ))}
                  </View>
                  {info && (
                    <View style={[styles.rankPill, { backgroundColor: info.color + '15' }]}>
                      <Text style={[styles.rankTxt, { color: info.color }]}>{info.txt}</Text>
                    </View>
                  )}
                </View>
              );
            })}

            {winCount > 0 && (
              <View style={styles.winSummary}>
                <Text style={styles.winSummaryTxt}>🎉 {winCount}게임 당첨!</Text>
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 60 },
  actionGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionCard: {
    flex: 1, padding: 16, borderRadius: 14, alignItems: 'flex-start',
  },
  actionEmoji: { fontSize: 28, marginBottom: 6 },
  actionTitle: { fontSize: 16, fontWeight: '800', color: theme.text },
  actionSub: { fontSize: 11, color: theme.textSub, marginTop: 2 },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  summaryTxt: { color: theme.textSub, fontSize: 13, fontWeight: '600' },
  clearTxt: { color: theme.danger, fontSize: 12, fontWeight: '600' },
  checkBtn: {
    backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', marginBottom: 16,
  },
  checkBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  empty: { padding: 40, alignItems: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: theme.text, fontSize: 16, fontWeight: '700' },
  emptySub: { color: theme.textMuted, fontSize: 12, marginTop: 6 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: theme.border,
    padding: 14, marginBottom: 12,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  roundRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundTxt: { fontWeight: '800', color: theme.primary, fontSize: 16 },
  srcTxt: { color: theme.textMuted, fontSize: 11 },
  metaTxt: { color: theme.textSub, fontSize: 11, marginTop: 2 },
  delTxt: { fontSize: 18, color: theme.textMuted },
  winningStrip: {
    backgroundColor: '#fffbeb', borderRadius: 8, padding: 10, marginBottom: 10,
  },
  winningLabel: { fontSize: 11, fontWeight: '700', color: '#92400e', marginBottom: 6 },
  winningBalls: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  plus: { fontSize: 14, color: theme.textSub, fontWeight: '700' },
  gameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6,
  },
  gameLabel: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#f3f4f6',
    textAlign: 'center', lineHeight: 22, fontSize: 11, color: theme.textSub, fontWeight: '700',
  },
  balls: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  rankPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  rankTxt: { fontSize: 10, fontWeight: '800' },
  winSummary: {
    marginTop: 8, padding: 8, borderRadius: 8, alignItems: 'center',
    backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0',
  },
  winSummaryTxt: { color: '#065f46', fontWeight: '800', fontSize: 13 },
});
