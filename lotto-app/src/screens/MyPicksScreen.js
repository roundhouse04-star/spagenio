import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, SectionList, Pressable, RefreshControl, Alert, ScrollView,
} from 'react-native';
import BannerAdSlot from '../components/BannerAdSlot';
import { useFocusEffect } from '@react-navigation/native';
import LottoBall from '../components/LottoBall';
import { theme } from '../lib/theme';
import { loadPicks, removePick, clearAllPicks } from '../lib/storage';
import { fetchRound, detectLatestRound } from '../lib/lottoApi';
import { evaluateRank } from '../lib/lottoEngine';
import { sendTelegramFromConfig, formatLottoMessage, loadTelegramConfig } from '../lib/telegram';

const RANK_LABEL = {
  1: { txt: '🏆 1등', color: '#dc2626' },
  2: { txt: '🥈 2등', color: '#ea580c' },
  3: { txt: '🥉 3등', color: '#d97706' },
  4: { txt: '4등', color: '#10b981' },
  5: { txt: '5등', color: '#0ea5e9' },
  0: { txt: '낙첨', color: '#6b7280' },
};

const SOURCE_BADGE = {
  'auto-tg': { txt: '🚀 자동발송', color: '#6366f1', bg: '#eef2ff' },
  'auto':    { txt: '🎯 자동추천',  color: '#ea580c', bg: '#fff7ed' },
  'algo':    { txt: '⚙️ 알고리즘',  color: '#10b981', bg: '#ecfdf5' },
  'manual':  { txt: '💾 직접',      color: '#6b7280', bg: '#f3f4f6' },
};

const formatNumbers = (nums) => nums.map((n) => String(n).padStart(2, '0')).join(', ');

export default function MyPicksScreen({ navigation }) {
  const [picks, setPicks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [latestRound, setLatestRound] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'auto-tg' | 'manual'

  const load = useCallback(async () => {
    const list = await loadPicks();
    setPicks(list);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    (async () => { setLatestRound(await detectLatestRound()); })();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  // 필터 적용 + 회차별 그룹핑
  const sections = useMemo(() => {
    const filtered = picks.filter((p) => filter === 'all' || p.source === filter);
    const map = new Map();
    for (const p of filtered) {
      const round = p.baseRound ?? 0;
      if (!map.has(round)) map.set(round, []);
      map.get(round).push(p);
    }
    return [...map.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([round, items]) => ({ title: round, data: items }));
  }, [picks, filter]);

  const counts = useMemo(() => {
    const autoTg = picks.filter((p) => p.source === 'auto-tg').length;
    const auto = picks.filter((p) => p.source === 'auto').length;
    const algo = picks.filter((p) => p.source === 'algo').length;
    const manual = picks.filter((p) => p.source === 'manual').length;
    return { all: picks.length, 'auto-tg': autoTg, auto, algo, manual };
  }, [picks]);

  const onDelete = (id) => {
    Alert.alert('삭제 확인', '이 게임을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => setPicks(await removePick(id)) },
    ]);
  };

  const onClearAll = () => {
    if (!picks.length) return;
    Alert.alert('전체 삭제', '저장된 모든 번호를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => { await clearAllPicks(); setPicks([]); },
      },
    ]);
  };

  const onSendTelegram = async () => {
    const visible = picks.filter((p) => filter === 'all' || p.source === filter);
    if (!visible.length) return;
    const cfg = await loadTelegramConfig();
    if (!cfg.token || !cfg.chatId) {
      Alert.alert('텔레그램 미설정', '설정 탭에서 봇 토큰과 Chat ID를 먼저 등록해주세요.');
      return;
    }
    try {
      const games = visible.map((p) => ({ numbers: p.numbers, meta: p.meta }));
      const text = formatLottoMessage(games, { round: latestRound, kind: '저장' });
      await sendTelegramFromConfig(text);
      Alert.alert('전송 성공', `${visible.length}게임이 텔레그램으로 전송되었습니다.`);
    } catch (e) { Alert.alert('전송 실패', e.message); }
  };

  const onCheckAll = async () => {
    if (!picks.length) return;
    setChecking(true);
    try {
      const cache = {};
      const next = await Promise.all(picks.map(async (p) => {
        const target = (p.baseRound || latestRound || 0) + 1;
        if (!target) return p;
        if (!cache[target]) cache[target] = await fetchRound(target);
        const round = cache[target];
        if (!round) return { ...p, checkedFor: target, status: 'pending' };
        const r = evaluateRank(p.numbers, round.numbers, round.bonus);
        return {
          ...p,
          checkedFor: target,
          status: 'done',
          result: { ...r, winning: round.numbers, bonus: round.bonus, drwDate: round.drwDate },
        };
      }));
      setPicks(next);
      const winners = next.filter((p) => p.result && p.result.rank > 0).length;
      Alert.alert('당첨 확인 완료', `${next.length}게임 중 ${winners}게임 당첨!`);
    } catch (e) {
      Alert.alert('오류', e.message || '당첨 확인 중 오류가 발생했습니다.');
    } finally { setChecking(false); }
  };

  const renderFilterChip = (key, label) => {
    const active = filter === key;
    return (
      <Pressable
        style={[styles.chip, active && styles.chipActive]}
        onPress={() => setFilter(key)}
      >
        <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
          {label} {counts[key] > 0 ? counts[key] : ''}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
    <SectionList
      style={styles.list}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(it) => it.id}
      stickySectionHeadersEnabled
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>💾 알고리즘추천</Text>
            <Text style={styles.headerSub}>가중치 기반 추천 모음 · 자동발송 + 직접저장 통합</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {renderFilterChip('all', '전체')}
            {renderFilterChip('auto', '🎯 자동추천')}
            {renderFilterChip('algo', '⚙️ 알고리즘')}
            {renderFilterChip('auto-tg', '🚀 자동발송')}
            {renderFilterChip('manual', '💾 직접')}
          </ScrollView>

          {picks.length > 0 && (
            <>
              <View style={styles.btnRow}>
                <Pressable
                  style={[styles.btn, checking && { opacity: 0.6 }]}
                  disabled={checking} onPress={onCheckAll}
                >
                  <Text style={styles.btnTxt}>
                    {checking ? '확인 중...' : '🎯 전체 당첨 확인'}
                  </Text>
                </Pressable>
                <Pressable style={styles.btnGhost} onPress={onClearAll}>
                  <Text style={styles.btnGhostTxt}>전체 삭제</Text>
                </Pressable>
              </View>
              <Pressable style={styles.btnAlt} onPress={onSendTelegram}>
                <Text style={styles.btnAltTxt}>📲 텔레그램으로 전체 발송</Text>
              </Pressable>
            </>
          )}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>💾</Text>
          <Text style={styles.emptyTxt}>저장된 번호가 없습니다</Text>
          <Text style={styles.emptySub}>
            추천 탭에서 번호를 생성하고 저장하거나{'\n'}
            텔레그램 자동발송을 활성화하세요
          </Text>
        </View>
      }
      renderSectionHeader={({ section: { title, data } }) => (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}회</Text>
          <Text style={styles.sectionCount}>{data.length}게임</Text>
        </View>
      )}
      renderItem={({ item, index }) => {
        const winSet = item.result ? new Set(item.result.winning) : null;
        const rankInfo = item.result ? RANK_LABEL[item.result.rank] : null;
        const src = SOURCE_BADGE[item.source] || SOURCE_BADGE.manual;
        return (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.indexTxt}>{index + 1}게임</Text>
                  <View style={[styles.srcBadge, { backgroundColor: src.bg }]}>
                    <Text style={[styles.srcBadgeTxt, { color: src.color }]}>{src.txt}</Text>
                  </View>
                </View>
                <Text style={styles.metaTxt}>
                  {new Date(item.createdAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                  {item.meta?.sum != null ? ` · 합 ${item.meta.sum}` : ''}
                  {item.meta?.oddEven ? ` · 홀짝 ${item.meta.oddEven}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => onDelete(item.id)} hitSlop={8}>
                <Text style={styles.delTxt}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.numText}>{formatNumbers(item.numbers)}</Text>

            <View style={styles.balls}>
              {item.numbers.map((n) => (
                <LottoBall key={n} n={n} size={34} hit={winSet ? winSet.has(n) : false} />
              ))}
            </View>

            {item.result && (
              <View style={[styles.resultRow, { backgroundColor: rankInfo.color + '15' }]}>
                <Text style={[styles.resultTxt, { color: rankInfo.color }]}>
                  {rankInfo.txt} · {item.checkedFor}회 ({item.result.matched}개{item.result.bonusMatch ? '+보너스' : ''})
                </Text>
              </View>
            )}
            {item.status === 'pending' && (
              <Text style={styles.pendingTxt}>{item.checkedFor}회 추첨 대기 중</Text>
            )}
          </View>
        );
      }}
    />
    <BannerAdSlot position="bottom" />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 40 },

  header: { marginBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: theme.text },
  headerSub: { color: theme.textSub, fontSize: 12, marginTop: 4 },

  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border,
  },
  chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipTxt: { fontSize: 12, fontWeight: '700', color: theme.textSub },
  chipTxtActive: { color: '#fff' },

  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  btn: {
    flex: 1, backgroundColor: theme.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
  },
  btnTxt: { color: '#fff', fontWeight: '700' },
  btnGhost: {
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1,
    borderRadius: 10, alignItems: 'center',
  },
  btnGhostTxt: { color: theme.danger, fontWeight: '700' },
  btnAlt: {
    backgroundColor: '#eef2ff', borderWidth: 1, borderColor: theme.primary,
    paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 12,
  },
  btnAltTxt: { color: theme.primary, fontWeight: '800' },

  empty: { padding: 40, alignItems: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTxt: { color: theme.text, fontSize: 16, fontWeight: '700' },
  emptySub: { color: theme.textMuted, fontSize: 12, marginTop: 6, textAlign: 'center', lineHeight: 18 },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: theme.bg, paddingVertical: 10, paddingHorizontal: 4, marginTop: 6,
  },
  sectionTitle: {
    fontSize: 16, fontWeight: '900', color: theme.primary, letterSpacing: 0.3,
  },
  sectionCount: { fontSize: 11, color: theme.textSub, fontWeight: '700' },

  card: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: theme.border,
    padding: 12, marginBottom: 8,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  indexTxt: { fontSize: 13, fontWeight: '800', color: theme.text },
  srcBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  srcBadgeTxt: { fontSize: 10, fontWeight: '800' },
  metaTxt: { fontSize: 11, color: theme.textSub, marginTop: 3 },
  delTxt: { fontSize: 16, color: theme.textMuted, paddingHorizontal: 4 },

  numText: {
    fontSize: 15, fontWeight: '800', color: theme.text,
    letterSpacing: 0.5, marginBottom: 8, fontVariant: ['tabular-nums'],
  },
  balls: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  resultRow: { padding: 8, borderRadius: 8, marginTop: 10, alignItems: 'center' },
  resultTxt: { fontWeight: '800', fontSize: 12 },
  pendingTxt: { fontSize: 11, color: theme.textMuted, marginTop: 8, textAlign: 'center' },
});
