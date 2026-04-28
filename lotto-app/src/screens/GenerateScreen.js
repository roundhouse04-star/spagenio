import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import GameCard from '../components/GameCard';
import { generateGames, generateAuto, weightsSum } from '../lib/lottoEngine';
import { fetchAllHistory } from '../lib/lottoApi';
import { loadWeights } from '../lib/storage';
import { addPickEntry } from '../lib/storage';
import { theme } from '../lib/theme';
import { sendTelegramFromConfig, formatLottoMessage, loadTelegramConfig } from '../lib/telegram';
import { loadAppSettings } from '../lib/appSettings';
import { sendLocalLottoNotification } from '../lib/notifications';

const COUNT_OPTIONS = [1, 3, 5, 10];

export default function GenerateScreen({ route }) {
  // 모드: 'auto' (자동추천 — carryover 고정 프리셋) | 'algo' (알고리즘 추천 — 사용자 가중치)
  const mode = route?.params?.mode === 'algo' ? 'algo' : 'auto';
  const isAuto = mode === 'auto';

  const [count, setCount] = useState(5);
  const [games, setGames] = useState([]);
  const [history, setHistory] = useState([]);
  const [latestRound, setLatestRound] = useState(null);
  const [algos, setAlgos] = useState([]);
  const [autoTg, setAutoTg] = useState(false);
  const [autoPush, setAutoPush] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [autoStatus, setAutoStatus] = useState(null); // {tg, push, error?}

  const reload = useCallback(async () => {
    const w = await loadWeights();
    setAlgos(w);
    // 1회 ~ 최신회차 전체로 분석 (번들 + 캐시로 즉시 로드)
    const { latest, history: rows } = await fetchAllHistory();
    setLatestRound(latest);
    setHistory(rows.map((r) => r.numbers));
  }, []);

  const reloadToggles = useCallback(async () => {
    const s = await loadAppSettings();
    setAutoTg(s.autoSendTelegram);
    setAutoPush(s.autoPushNotify);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([reload(), reloadToggles()]);
      } finally { setLoading(false); }
    })();
  }, [reload, reloadToggles]);

  // 설정 화면에서 토글 변경 후 돌아왔을 때 다시 읽기
  useFocusEffect(useCallback(() => { reloadToggles(); }, [reloadToggles]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await reload(); } finally { setRefreshing(false); }
  }, [reload]);

  const triggerAutoActions = async (gen) => {
    const result = { tg: null, push: null };
    if (autoTg) {
      try {
        const cfg = await loadTelegramConfig();
        if (cfg.token && cfg.chatId) {
          const text = formatLottoMessage(gen, { round: latestRound, kind: '추천' });
          await sendTelegramFromConfig(text);
          result.tg = 'sent';
        } else {
          result.tg = 'no-config';
        }
      } catch (e) { result.tg = 'failed:' + e.message; }
    }
    if (autoPush) {
      try {
        await sendLocalLottoNotification({ games: gen, round: latestRound });
        result.push = 'sent';
      } catch (e) { result.push = 'failed:' + e.message; }
    }
    return result;
  };

  // 공통: 생성된 게임을 picks DB에 자동 저장 (source 구분)
  const autoSaveGames = async (gameList, source) => {
    const ts = Date.now();
    for (let i = 0; i < gameList.length; i++) {
      await addPickEntry({
        id: `${source}_${ts}_${i}`,
        createdAt: ts + i,
        baseRound: latestRound,
        numbers: gameList[i].numbers,
        meta: gameList[i].meta,
        source,
      });
    }
  };

  // [🎯 자동추천] — carryover 고정 프리셋 (사용자 가중치 무시)
  const onAutoRecommend = async () => {
    setGenerating(true);
    setAutoStatus(null);
    setTimeout(async () => {
      const { games: result, meta } = generateAuto({ history, count });
      setGames(result);
      setGenerating(false);
      // 자동 저장
      await autoSaveGames(result, 'auto');
      // 토글 ON이면 백그라운드에서 자동 발송
      if (autoTg || autoPush) {
        const status = await triggerAutoActions(result);
        setAutoStatus(status);
      }
    }, 16);
  };

  // [⚙️ 알고리즘 추천] — 사용자가 설정한 가중치로 생성
  const onAlgoRecommend = async () => {
    const sum = weightsSum(algos);
    if (sum === 0) {
      Alert.alert('가중치 오류', '알고리즘 가중치 합이 0입니다. 설정 → 알고리즘 가중치에서 조정하세요.');
      return;
    }
    setGenerating(true);
    setAutoStatus(null);
    setTimeout(async () => {
      const result = generateGames({ algos, history, count });
      setGames(result);
      setGenerating(false);
      // 자동 저장
      await autoSaveGames(result, 'algo');
      if (autoTg || autoPush) {
        const status = await triggerAutoActions(result);
        setAutoStatus(status);
      }
    }, 16);
  };

  const onSendTelegram = async () => {
    if (!games.length) {
      Alert.alert('알림', '먼저 번호를 생성해주세요.');
      return;
    }
    const cfg = await loadTelegramConfig();
    if (!cfg.token || !cfg.chatId) {
      Alert.alert(
        '텔레그램 미설정',
        '설정 탭에서 봇 토큰과 Chat ID를 먼저 등록해주세요.',
      );
      return;
    }
    try {
      const text = formatLottoMessage(games, { round: latestRound, kind: '추천' });
      await sendTelegramFromConfig(text);
      Alert.alert('전송 성공', `${games.length}게임이 텔레그램으로 전송되었습니다.`);
    } catch (e) {
      Alert.alert('전송 실패', e.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loaderText}>회차 데이터 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>
          {isAuto ? '🎯 자동추천' : '⚙️ 알고리즘 추천'}
        </Text>
        <Text style={styles.headerSub}>
          최신 {latestRound ?? '?'}회 · 전체 {history.length}회차 분석
        </Text>
        {(autoTg || autoPush) && (
          <View style={styles.autoBadgeRow}>
            {autoTg && <Text style={styles.autoBadge}>📲 텔레그램 자동발송 ON</Text>}
            {autoPush && <Text style={styles.autoBadge}>🔔 푸시 알림 ON</Text>}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>게임 수</Text>
        <View style={styles.row}>
          {COUNT_OPTIONS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCount(c)}
              style={[styles.countBtn, count === c && styles.countBtnActive]}
            >
              <Text style={[styles.countTxt, count === c && styles.countTxtActive]}>{c}게임</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        onPress={isAuto ? onAutoRecommend : onAlgoRecommend}
        disabled={generating}
        style={[styles.primaryBtn, generating && { opacity: 0.6 }]}
      >
        <Text style={styles.primaryBtnText}>
          {generating ? '생성 중...' : (isAuto ? '🎯 자동추천 받기' : '⚙️ 알고리즘 추천 받기')}
        </Text>
      </Pressable>

      {games.length > 0 && (
        <Pressable onPress={onSendTelegram} style={[styles.secondaryBtn, { marginTop: 8 }]}>
          <Text style={styles.secondaryBtnText}>📲 텔레그램으로 발송</Text>
        </Pressable>
      )}

      {games.length > 0 && (
        <View style={styles.savedHint}>
          <Text style={styles.savedHintTxt}>
            ✓ 자동 저장됨 — [추천번호 확인] 메뉴에서 회차별로 확인 가능
          </Text>
        </View>
      )}

      {autoStatus && (autoStatus.tg || autoStatus.push) && (
        <View style={styles.autoStatusCard}>
          {autoStatus.tg === 'sent' && <Text style={styles.autoStatusLine}>✅ 텔레그램 발송 완료</Text>}
          {autoStatus.tg === 'no-config' && <Text style={styles.autoStatusWarn}>⚠️ 텔레그램 설정 미완료 — 설정 탭에서 등록하세요</Text>}
          {typeof autoStatus.tg === 'string' && autoStatus.tg.startsWith('failed:') && (
            <Text style={styles.autoStatusErr}>❌ 텔레그램 실패: {autoStatus.tg.replace('failed:', '')}</Text>
          )}
          {autoStatus.push === 'sent' && <Text style={styles.autoStatusLine}>🔔 알림 표시됨</Text>}
          {typeof autoStatus.push === 'string' && autoStatus.push.startsWith('failed:') && (
            <Text style={styles.autoStatusErr}>❌ 알림 실패: {autoStatus.push.replace('failed:', '')}</Text>
          )}
        </View>
      )}

      <View style={{ marginTop: 16 }}>
        {games.length === 0 ? (
          <Text style={styles.empty}>버튼을 눌러 추천 번호를 받아보세요</Text>
        ) : (
          games.map((g, i) => <GameCard key={i} index={i} game={g} />)
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 40 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg },
  loaderText: { marginTop: 12, color: theme.textSub },
  headerCard: {
    backgroundColor: theme.primary,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4 },
  section: { marginBottom: 12 },
  sectionLabel: { color: theme.textSub, fontSize: 13, marginBottom: 8, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  countBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: theme.border, borderRadius: 8, backgroundColor: '#fff',
  },
  countBtnActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  countTxt: { color: theme.text, fontWeight: '600' },
  countTxtActive: { color: '#fff' },
  primaryBtn: {
    backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', marginTop: 4,
  },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  secondaryBtn: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border,
    paddingVertical: 12, borderRadius: 10, alignItems: 'center',
  },
  secondaryBtnText: { color: theme.text, fontWeight: '700' },
  savedHint: {
    backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0',
    borderRadius: 8, padding: 9, marginTop: 8, alignItems: 'center',
  },
  savedHintTxt: { color: '#065f46', fontSize: 11, fontWeight: '700' },
  empty: {
    textAlign: 'center', color: theme.textSub, paddingVertical: 32, fontSize: 14,
  },
  autoBadgeRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10,
  },
  autoBadge: {
    color: '#fff', fontSize: 11, fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  autoStatusCard: {
    marginTop: 12, padding: 12, borderRadius: 10,
    backgroundColor: '#ecfeff', borderWidth: 1, borderColor: '#a5f3fc',
  },
  autoStatusLine: { color: '#0e7490', fontSize: 12, fontWeight: '700', marginVertical: 1 },
  autoStatusWarn: { color: '#b45309', fontSize: 12, fontWeight: '700', marginVertical: 1 },
  autoStatusErr: { color: theme.danger, fontSize: 12, fontWeight: '700', marginVertical: 1 },
});
