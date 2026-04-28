import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import LottoBall from '../components/LottoBall';
import { theme } from '../lib/theme';
import { detectLatestRound, fetchRound } from '../lib/lottoApi';
import { loadPurchases, loadPicks } from '../lib/storage';

function CountdownToNextDraw() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // 다음 토요일 20:35 KST 추첨
  const target = new Date(now);
  const day = target.getDay();
  const offset = (6 - day + 7) % 7 || (now.getHours() >= 21 ? 7 : 0);
  target.setDate(target.getDate() + offset);
  target.setHours(20, 35, 0, 0);

  const diff = target.getTime() - now.getTime();
  const days = Math.max(0, Math.floor(diff / 86400000));
  const hours = Math.max(0, Math.floor((diff % 86400000) / 3600000));
  const mins = Math.max(0, Math.floor((diff % 3600000) / 60000));

  return (
    <View style={styles.countdown}>
      <Text style={styles.countdownLabel}>다음 추첨까지</Text>
      <Text style={styles.countdownValue}>
        {days > 0 ? `${days}일 ` : ''}{String(hours).padStart(2, '0')}:{String(mins).padStart(2, '0')}
      </Text>
    </View>
  );
}

function MenuTile({ emoji, title, subtitle, color, onPress, full }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        full && styles.tileFull,
        { backgroundColor: color },
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}
    >
      <Text style={styles.tileEmoji}>{emoji}</Text>
      <Text style={styles.tileTitle}>{title}</Text>
      {subtitle ? <Text style={styles.tileSub}>{subtitle}</Text> : null}
    </Pressable>
  );
}

export default function HomeScreen({ navigation }) {
  const [round, setRound] = useState(null);
  const [data, setData] = useState(null);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [pickCount, setPickCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const lr = await detectLatestRound();
    setRound(lr);
    const d = await fetchRound(lr);
    setData(d);
    const [purchases, picks] = await Promise.all([loadPurchases(), loadPicks()]);
    setPurchaseCount(purchases.length);
    setPickCount(picks.length);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { await load(); } finally { setLoading(false); }
    })();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const go = (target, params) => navigation.navigate(target, params);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* HERO 카드 */}
      <LinearGradient
        colors={['#6366f1', '#8b5cf6', '#ec4899']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <Text style={styles.heroBrand}>🍀 로또부스터</Text>
          <CountdownToNextDraw />
        </View>

        {loading ? (
          <ActivityIndicator color="#fff" style={{ marginVertical: 20 }} />
        ) : data ? (
          <>
            <Text style={styles.heroRound}>{round}회</Text>
            <Text style={styles.heroDate}>{data.drwDate}</Text>
            <View style={styles.heroBalls}>
              {data.numbers.map((n) => <LottoBall key={n} n={n} size={36} />)}
              <Text style={styles.heroPlus}>+</Text>
              <LottoBall n={data.bonus} size={36} />
            </View>
          </>
        ) : (
          <Text style={styles.heroEmpty}>회차 데이터 불러오기 실패</Text>
        )}

        <View style={styles.heroFooter}>
          <Pressable style={styles.heroBtn} onPress={() => go('QRScan')}>
            <Text style={styles.heroBtnTxt}>🔎 당첨확인</Text>
          </Pressable>
          <Pressable style={styles.heroBtn} onPress={() => go('Generate')}>
            <Text style={styles.heroBtnTxt}>🎯 번호추천</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {/* 나의 로또 — 구입한 로또 스캔 & 추천번호 보관함 */}
      <Text style={styles.section}>나의 로또</Text>
      <View style={styles.grid}>
        <MenuTile
          emoji="📷" title="QR 코드입력" subtitle="카메라로 실시간 스캔"
          color="#dbeafe" onPress={() => go('QRScan', { saveToPurchased: true, sourceMode: 'camera' })}
        />
        <MenuTile
          emoji="🖼" title="구입번호 직접입력" subtitle="갤러리에서 QR 이미지"
          color="#fce7f3" onPress={() => go('QRScan', { saveToPurchased: true, sourceMode: 'gallery' })}
        />
        <MenuTile
          emoji="🎟" title="구입번호 목록" subtitle={purchaseCount ? `${purchaseCount}건 · 당첨확인` : '저장된 복권'}
          color="#fef3c7" onPress={() => go('Purchased')}
        />
        <MenuTile
          emoji="💾" title="추천번호 확인" subtitle={pickCount ? `${pickCount}게임 · 회차별` : '자동/직접 통합'}
          color="#d1fae5" onPress={() => go('MyPicks')}
        />
      </View>

      {/* 번호생성기 — 두 가지 추천 모드 분리 */}
      <Text style={styles.section}>번호 생성기</Text>
      <View style={styles.grid}>
        <MenuTile
          emoji="🎯" title="자동추천"
          color="#e0e7ff" onPress={() => go('Generate', { mode: 'auto' })}
        />
        <MenuTile
          emoji="⚙️" title="알고리즘 추천"
          color="#f3e8ff" onPress={() => go('Generate', { mode: 'algo' })}
        />
      </View>

      {/* 번호분석 */}
      <Text style={styles.section}>번호 분석</Text>
      <View style={styles.grid}>
        <MenuTile
          emoji="🔍" title="패턴분석표" subtitle="당첨번호 패턴"
          color="#ffedd5" onPress={() => go('Pattern')}
        />
        <MenuTile
          emoji="📜" title="회차 정보" subtitle="당첨금 & 통계"
          color="#fee2e2" onPress={() => go('History')}
        />
      </View>

      {/* 판매점 + 설정 */}
      <Text style={styles.section}>판매점 & 설정</Text>
      <View style={styles.grid}>
        <MenuTile
          emoji="🏪" title="당첨 판매점" subtitle="1등/2등 매장"
          color="#cffafe" onPress={() => go('WinningStores')}
        />
        <MenuTile
          emoji="📲" title="텔레그램" subtitle="자동 발송 설정"
          color="#dcfce7" onPress={() => go('Settings')}
        />
      </View>

      <Text style={styles.footer}>© 2026 spagenio · 동행복권 데이터 기반</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.bg },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },

  hero: {
    borderRadius: 20, padding: 18, marginBottom: 18,
    shadowColor: '#6366f1', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16, elevation: 6,
  },
  heroTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  heroBrand: { color: '#fff', fontSize: 14, fontWeight: '700' },
  countdown: {
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, alignItems: 'center',
  },
  countdownLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 9 },
  countdownValue: { color: '#fff', fontSize: 12, fontWeight: '800' },

  heroRound: { color: '#fff', fontSize: 42, fontWeight: '900', letterSpacing: 1 },
  heroDate: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  heroBalls: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, flexWrap: 'wrap' },
  heroPlus: { color: '#fff', fontSize: 18, fontWeight: '700', marginHorizontal: 4 },
  heroEmpty: { color: '#fff', textAlign: 'center', marginVertical: 12, opacity: 0.85 },

  heroFooter: { flexDirection: 'row', gap: 10, marginTop: 18 },
  heroBtn: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.22)', paddingVertical: 12, borderRadius: 12, alignItems: 'center',
  },
  heroBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },

  section: {
    fontSize: 14, fontWeight: '800', color: theme.text, marginTop: 6, marginBottom: 10,
    letterSpacing: 0.3,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  tile: {
    width: '48%', borderRadius: 14, padding: 14, minHeight: 96,
  },
  tileFull: { width: '100%' },
  tileEmoji: { fontSize: 26, marginBottom: 6 },
  tileTitle: { fontSize: 15, fontWeight: '800', color: theme.text },
  tileSub: { fontSize: 11, color: theme.textSub, marginTop: 2 },

  footer: { textAlign: 'center', color: theme.textMuted, fontSize: 11, marginTop: 24 },
});
