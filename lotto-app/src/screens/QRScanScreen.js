import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator,
  Alert, Linking,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import LottoBall from '../components/LottoBall';
import { theme } from '../lib/theme';
import { parseLottoQR, dhlotteryVerifyUrl } from '../lib/qrParse';
import { fetchRound, detectLatestRound } from '../lib/lottoApi';
import { evaluateRank } from '../lib/lottoEngine';
import { addPurchase } from '../lib/storage';
import { pickAndDecodeQR } from '../lib/qrImage';

const RANK_LABEL = {
  1: { txt: '🏆 1등', color: '#dc2626' },
  2: { txt: '🥈 2등', color: '#ea580c' },
  3: { txt: '🥉 3등', color: '#d97706' },
  4: { txt: '4등', color: '#10b981' },
  5: { txt: '5등', color: '#0ea5e9' },
  0: { txt: '낙첨', color: '#6b7280' },
};

export default function QRScanScreen({ navigation, route }) {
  const saveToPurchased = !!route?.params?.saveToPurchased;
  const sourceMode = route?.params?.sourceMode || 'camera'; // 'camera' | 'gallery'
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(sourceMode === 'camera');
  const [pickerLoading, setPickerLoading] = useState(sourceMode === 'gallery');
  const [verifying, setVerifying] = useState(false);
  const [parsed, setParsed] = useState(null);   // { round, games }
  const [winning, setWinning] = useState(null); // { drwNo, drwDate, numbers, bonus, pending }
  const [results, setResults] = useState([]);   // [{ rank, matched, bonusMatch }, ...]
  const [saved, setSaved] = useState(false);
  const lockRef = useRef(false);
  const galleryStartedRef = useRef(false);

  useEffect(() => {
    const titles = {
      camera: saveToPurchased ? '📷 구입번호 등록' : '🔎 로또 QR 당첨확인',
      gallery: '🖼 갤러리에서 QR 등록',
    };
    navigation.setOptions({ title: titles[sourceMode] });
  }, [navigation, saveToPurchased, sourceMode]);

  // 갤러리 모드: 화면 진입 즉시 picker 실행
  useEffect(() => {
    if (sourceMode !== 'gallery' || galleryStartedRef.current) return;
    galleryStartedRef.current = true;
    runGalleryPick();
  }, [sourceMode]);

  const runGalleryPick = async () => {
    setPickerLoading(true);
    try {
      const r = await pickAndDecodeQR();
      if (r.canceled) {
        navigation.goBack();
        return;
      }
      if (!r.found) {
        Alert.alert(
          'QR 인식 실패',
          '선택한 이미지에서 QR을 찾지 못했습니다. QR이 또렷하게 보이는 사진을 선택하세요.',
          [
            { text: '다시 선택', onPress: () => { runGalleryPick(); } },
            { text: '닫기', style: 'cancel', onPress: () => navigation.goBack() },
          ],
        );
        return;
      }
      // QR 텍스트를 카메라 인식과 동일하게 처리
      await onScanned({ data: r.data });
    } catch (e) {
      Alert.alert('오류', e.message, [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setPickerLoading(false);
    }
  };

  const onScanned = useCallback(async ({ data }) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setScanning(false);

    const result = parseLottoQR(data);
    if (!result) {
      Alert.alert(
        'QR 인식 실패',
        '로또 복권 QR이 아닙니다.\n인식된 데이터:\n' + (data || '').slice(0, 80),
        [
          { text: '다시 스캔', onPress: () => { lockRef.current = false; setScanning(true); } },
          { text: '닫기', onPress: () => navigation.goBack() },
        ],
      );
      return;
    }
    setParsed(result);
    await verifyResult(result);
  }, [navigation]);

  const verifyResult = async (result) => {
    setVerifying(true);
    try {
      const round = await fetchRound(result.round);
      if (!round) {
        const latest = await detectLatestRound();
        if (result.round > latest) {
          setWinning({ pending: true, drwNo: result.round, latest });
          setResults([]);
          return;
        }
        Alert.alert('회차 조회 실패', `${result.round}회 데이터를 가져오지 못했습니다. 네트워크를 확인해주세요.`);
        return;
      }
      setWinning(round);
      const evals = result.games.map((nums) => ({
        numbers: nums,
        ...evaluateRank(nums, round.numbers, round.bonus),
      }));
      setResults(evals);
    } catch (e) {
      Alert.alert('오류', e.message || '당첨 확인 중 오류가 발생했습니다.');
    } finally {
      setVerifying(false);
    }
  };

  const onScanAgain = () => {
    setParsed(null);
    setWinning(null);
    setResults([]);
    setSaved(false);
    lockRef.current = false;
    if (sourceMode === 'gallery') {
      runGalleryPick();
    } else {
      setScanning(true);
    }
  };

  const onSaveToPurchased = async () => {
    if (!parsed || saved) return;
    const ts = Date.now();
    const baseEntry = {
      id: `q_${ts}`,
      createdAt: ts,
      round: parsed.round,
      source: 'qr',
      games: parsed.games,
    };
    if (winning && !winning.pending) {
      baseEntry.results = parsed.games.map((nums) => ({
        numbers: nums,
        ...evaluateRank(nums, winning.numbers, winning.bonus),
      }));
      baseEntry.drawDate = winning.drwDate;
      baseEntry.winning = winning.numbers;
      baseEntry.bonus = winning.bonus;
    }
    await addPurchase(baseEntry);
    setSaved(true);
    Alert.alert('등록 완료', `${parsed.round}회 ${parsed.games.length}게임이 구입번호 목록에 추가되었습니다.`);
  };

  const onOpenWeb = () => {
    if (!parsed) return;
    const url = dhlotteryVerifyUrl(parsed.round, parsed.games);
    if (url) Linking.openURL(url);
  };

  // 갤러리 모드: 카메라 권한 불필요, 로딩만 표시 (picker가 즉시 시스템 UI를 띄움)
  if (sourceMode === 'gallery' && (pickerLoading || (!parsed && !verifying))) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loaderText}>QR 인식 중...</Text>
      </View>
    );
  }

  // 카메라 모드 — 권한 처리
  if (sourceMode === 'camera') {
    if (!permission) {
      return <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>;
    }
    if (!permission.granted) {
      return (
        <View style={styles.center}>
          <Text style={styles.permTitle}>📷 카메라 권한 필요</Text>
          <Text style={styles.permSub}>로또 복권 QR을 스캔하려면 카메라 접근을 허용해주세요.</Text>
          <Pressable style={styles.btn} onPress={requestPermission}>
            <Text style={styles.btnTxt}>권한 허용</Text>
          </Pressable>
        </View>
      );
    }
  }

  // 카메라 스캔 모드
  if (sourceMode === 'camera' && scanning) {
    return (
      <View style={styles.scanWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onScanned}
        />
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.frame} />
          <Text style={styles.scanHint}>복권의 QR 코드를 사각형 안에 맞춰주세요</Text>
        </View>
        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelTxt}>취소</Text>
        </Pressable>
      </View>
    );
  }

  // 결과 화면
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {verifying && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loaderText}>{parsed?.round}회 결과 조회 중...</Text>
        </View>
      )}

      {!verifying && parsed && (
        <>
          <View style={styles.headerCard}>
            <Text style={styles.headerTitle}>📄 {parsed.round}회 복권</Text>
            <Text style={styles.headerSub}>{parsed.games.length}게임 인식</Text>
          </View>

          {winning?.pending ? (
            <View style={styles.pendingCard}>
              <Text style={styles.pendingTitle}>⏳ 추첨 대기중</Text>
              <Text style={styles.pendingSub}>
                {parsed.round}회는 아직 추첨되지 않았습니다.{'\n'}
                현재 최신 회차: {winning.latest}회
              </Text>
            </View>
          ) : winning ? (
            <View style={styles.winCard}>
              <View style={styles.winHead}>
                <Text style={styles.winRound}>{winning.drwNo}회 당첨번호</Text>
                <Text style={styles.winDate}>{winning.drwDate}</Text>
              </View>
              <View style={styles.balls}>
                {winning.numbers.map((n) => <LottoBall key={n} n={n} size={36} />)}
                <Text style={styles.plus}>+</Text>
                <LottoBall n={winning.bonus} size={36} />
              </View>
            </View>
          ) : null}

          {!winning?.pending && results.length > 0 && (
            <View style={styles.summary}>
              <Text style={styles.summaryTxt}>
                {results.filter((r) => r.rank > 0).length} / {results.length} 게임 당첨
              </Text>
            </View>
          )}

          {!winning?.pending && results.map((r, idx) => {
            const info = RANK_LABEL[r.rank];
            const winSet = new Set(winning?.numbers || []);
            return (
              <View key={idx} style={styles.gameCard}>
                <View style={styles.gameHead}>
                  <Text style={styles.gameTitle}>{idx + 1}게임</Text>
                  <View style={[styles.rankPill, { backgroundColor: info.color + '15' }]}>
                    <Text style={[styles.rankTxt, { color: info.color }]}>
                      {info.txt} ({r.matched}개{r.bonusMatch ? '+보너스' : ''})
                    </Text>
                  </View>
                </View>
                <View style={styles.balls}>
                  {r.numbers.map((n) => (
                    <LottoBall key={n} n={n} size={36} outlined={!winSet.has(n)} />
                  ))}
                </View>
              </View>
            );
          })}

          {winning?.pending && parsed.games.map((nums, idx) => (
            <View key={idx} style={styles.gameCard}>
              <Text style={styles.gameTitle}>{idx + 1}게임</Text>
              <View style={styles.balls}>
                {nums.map((n) => <LottoBall key={n} n={n} size={36} />)}
              </View>
            </View>
          ))}

          <Pressable
            style={[styles.btnSave, saved && { opacity: 0.5 }]}
            disabled={saved}
            onPress={onSaveToPurchased}
          >
            <Text style={styles.btnSaveTxt}>
              {saved ? '✅ 구입번호로 저장됨' : '💾 구입번호로 저장'}
            </Text>
          </Pressable>

          <View style={styles.btnRow}>
            <Pressable style={styles.btn} onPress={onScanAgain}>
              <Text style={styles.btnTxt}>🔁 다시 스캔</Text>
            </Pressable>
            <Pressable style={styles.btnAlt} onPress={onOpenWeb}>
              <Text style={styles.btnAltTxt}>🌐 동행복권</Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: theme.bg },
  loaderText: { marginTop: 12, color: theme.textSub },
  permTitle: { fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 8 },
  permSub: { color: theme.textSub, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  scanWrap: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: 260, height: 260, borderRadius: 16,
    borderWidth: 3, borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.0)',
  },
  scanHint: {
    position: 'absolute', bottom: 120, color: '#fff', fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  cancelBtn: {
    position: 'absolute', top: 50, right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  cancelTxt: { color: '#fff', fontWeight: '700' },
  headerCard: {
    backgroundColor: theme.primary, borderRadius: 14, padding: 16, marginBottom: 14,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4 },
  pendingCard: {
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a',
    borderRadius: 12, padding: 16, marginBottom: 14, alignItems: 'center',
  },
  pendingTitle: { fontSize: 16, fontWeight: '800', color: '#b45309', marginBottom: 6 },
  pendingSub: { color: '#92400e', textAlign: 'center', lineHeight: 20 },
  winCard: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border,
    borderRadius: 12, padding: 14, marginBottom: 14,
  },
  winHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  winRound: { fontWeight: '800', color: theme.primary },
  winDate: { color: theme.textSub, fontSize: 12 },
  balls: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  plus: { fontSize: 16, color: theme.textSub, fontWeight: '700' },
  summary: {
    backgroundColor: '#ecfeff', borderWidth: 1, borderColor: '#a5f3fc',
    borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 12,
  },
  summaryTxt: { color: '#0e7490', fontWeight: '800' },
  gameCard: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: theme.border,
    padding: 12, marginBottom: 10,
  },
  gameHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  gameTitle: { fontWeight: '800', color: theme.text },
  rankPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  rankTxt: { fontWeight: '800', fontSize: 12 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: {
    flex: 1, backgroundColor: theme.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
  },
  btnTxt: { color: '#fff', fontWeight: '800' },
  btnAlt: {
    flex: 1, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: theme.primary,
    paddingVertical: 12, borderRadius: 10, alignItems: 'center',
  },
  btnAltTxt: { color: theme.primary, fontWeight: '800' },
  btnSave: {
    backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', marginTop: 12,
  },
  btnSaveTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
