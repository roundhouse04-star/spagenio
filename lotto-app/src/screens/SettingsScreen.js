import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, Linking, Switch,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  loadTelegramConfig, saveTelegramConfig, clearTelegramConfig,
  sendTelegramMessage,
} from '../lib/telegram';
import {
  loadAppSettings, setAutoSendTelegram, setAutoPushNotify,
  loadTelegramSchedule, saveTelegramSchedule,
  loadWinningAlertSchedule, saveWinningAlertSchedule,
} from '../lib/appSettings';
import { ensureNotificationReady, sendLocalLottoNotification } from '../lib/notifications';
import {
  reapplyTelegramSchedule, reapplyWinningAlertSchedule,
  performTelegramAutoSend, performWinningCheck,
} from '../lib/scheduler';
import { exportToFile, importFromFile } from '../lib/backup';
import { theme } from '../lib/theme';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const COUNT_OPTIONS = [1, 3, 5, 10];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);

export default function SettingsScreen({ navigation }) {
  const [token, setToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [autoTg, setAutoTg] = useState(false);
  const [autoPush, setAutoPush] = useState(false);

  // 텔레그램 스케줄
  const [tgDays, setTgDays] = useState([]);
  const [tgHour, setTgHour] = useState(9);
  const [tgCount, setTgCount] = useState(5);

  // 당첨 자동확인 스케줄
  const [winEnabled, setWinEnabled] = useState(false);
  const [winHour, setWinHour] = useState(21);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const reload = useCallback(async () => {
    const [cfg, sets, tgSch, winSch] = await Promise.all([
      loadTelegramConfig(),
      loadAppSettings(),
      loadTelegramSchedule(),
      loadWinningAlertSchedule(),
    ]);
    setToken(cfg.token);
    setChatId(cfg.chatId);
    setAutoTg(sets.autoSendTelegram);
    setAutoPush(sets.autoPushNotify);
    setTgDays(tgSch.days);
    setTgHour(tgSch.hour);
    setTgCount(tgSch.count);
    setWinEnabled(winSch.enabled);
    setWinHour(winSch.hour);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { await reload(); } finally { setLoading(false); }
    })();
  }, [reload]);

  const onSaveTg = async () => {
    if (!token.trim() || !chatId.trim()) {
      Alert.alert('입력 오류', 'Bot Token과 Chat ID를 모두 입력하세요.');
      return;
    }
    setWorking(true);
    try {
      await saveTelegramConfig({ token, chatId });
      Alert.alert('저장 완료', '텔레그램 설정이 저장되었습니다.');
    } catch (e) { Alert.alert('저장 실패', e.message); }
    finally { setWorking(false); }
  };

  const onTestTg = async () => {
    if (!token.trim() || !chatId.trim()) {
      Alert.alert('입력 오류', 'Bot Token과 Chat ID를 먼저 입력하세요.');
      return;
    }
    setWorking(true);
    try {
      await sendTelegramMessage({
        token, chatId,
        text: '🔔 *스파제니오 로또* 봇 연결 테스트\n정상 수신되면 성공입니다 🍀',
      });
      Alert.alert('전송 성공', '텔레그램으로 테스트 메시지가 전송되었습니다.');
    } catch (e) { Alert.alert('전송 실패', e.message); }
    finally { setWorking(false); }
  };

  const onClearTg = () => {
    Alert.alert('초기화', '텔레그램 설정을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          await clearTelegramConfig();
          await setAutoSendTelegram(false);
          setToken(''); setChatId(''); setAutoTg(false);
          Alert.alert('완료', '텔레그램 설정이 삭제되었습니다.');
        },
      },
    ]);
  };

  const onToggleAutoTg = async (val) => {
    if (val && (!token.trim() || !chatId.trim())) {
      Alert.alert('알림', '먼저 Bot Token과 Chat ID를 저장해주세요.');
      return;
    }
    setAutoTg(val);
    await setAutoSendTelegram(val);
    // 스케줄 알림도 함께 적용/취소
    await reapplyTelegramSchedule(val);
  };

  const onToggleDay = async (d) => {
    const next = tgDays.includes(d) ? tgDays.filter((x) => x !== d) : [...tgDays, d].sort();
    setTgDays(next);
    await saveTelegramSchedule({ days: next, hour: tgHour, count: tgCount });
    if (autoTg) await reapplyTelegramSchedule(true);
  };

  const onChangeHour = async (h) => {
    setTgHour(h);
    await saveTelegramSchedule({ days: tgDays, hour: h, count: tgCount });
    if (autoTg) await reapplyTelegramSchedule(true);
  };

  const onChangeCount = async (c) => {
    setTgCount(c);
    await saveTelegramSchedule({ days: tgDays, hour: tgHour, count: c });
    if (autoTg) await reapplyTelegramSchedule(true);
  };

  const onTestTgAutoSend = async () => {
    if (!token.trim() || !chatId.trim()) {
      Alert.alert('알림', '먼저 텔레그램 설정을 저장하세요.');
      return;
    }
    setWorking(true);
    try {
      const r = await performTelegramAutoSend();
      Alert.alert('발송 성공', `${r.round}회 기준 ${r.count}게임이 텔레그램으로 발송됨`);
    } catch (e) {
      Alert.alert('발송 실패', e.message);
    } finally { setWorking(false); }
  };

  const onToggleWinAlert = async (val) => {
    if (val) {
      const granted = await ensureNotificationReady();
      if (!granted) {
        Alert.alert('권한 필요', '시스템 설정에서 알림 권한을 허용해주세요.');
        return;
      }
    }
    setWinEnabled(val);
    await saveWinningAlertSchedule({ enabled: val, hour: winHour });
    await reapplyWinningAlertSchedule();
  };

  const onChangeWinHour = async (h) => {
    setWinHour(h);
    await saveWinningAlertSchedule({ enabled: winEnabled, hour: h });
    if (winEnabled) await reapplyWinningAlertSchedule();
  };

  const onTestWinCheck = async () => {
    setWorking(true);
    try {
      const r = await performWinningCheck();
      Alert.alert('당첨 확인 완료', r.checked === 0 ? '확인할 구입번호가 없습니다' : `${r.updated}건 갱신 · ${r.won}게임 당첨`);
    } catch (e) {
      Alert.alert('실패', e.message);
    } finally { setWorking(false); }
  };

  const onToggleAutoPush = async (val) => {
    if (val) {
      const granted = await ensureNotificationReady();
      if (!granted) {
        Alert.alert('권한 필요', '시스템 설정에서 알림 권한을 허용해주세요.');
        return;
      }
    }
    setAutoPush(val);
    await setAutoPushNotify(val);
  };

  const onTestPush = async () => {
    try {
      await sendLocalLottoNotification({
        games: [{ numbers: [3, 7, 11, 23, 35, 42] }],
        round: null,
      });
      Alert.alert('테스트 발송', '알림이 전송되었습니다.');
    } catch (e) {
      Alert.alert('실패', e.message);
    }
  };

  const onExport = async () => {
    setWorking(true);
    try {
      const { filename, size } = await exportToFile();
      Alert.alert('백업 생성', `${filename}\n크기: ${(size / 1024).toFixed(1)} KB\n\n파일이 공유 시트에 노출되었습니다. 안전한 곳(드라이브/메일/iCloud)에 보관하세요.`);
    } catch (e) {
      Alert.alert('백업 실패', e.message || '오류가 발생했습니다.');
    } finally { setWorking(false); }
  };

  const onImport = () => {
    Alert.alert(
      '복원 모드 선택',
      '기존 데이터를 어떻게 처리할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '병합 (기존+백업)', onPress: () => doImport(true),
        },
        {
          text: '교체 (백업만 유지)', style: 'destructive',
          onPress: () => doImport(false),
        },
      ],
    );
  };

  const doImport = async (merge) => {
    setWorking(true);
    try {
      const r = await importFromFile({ merge });
      if (r.canceled) return;
      const c = r.counts;
      Alert.alert(
        '복원 완료',
        `추천번호 ${c.picks}건 · 구입번호 ${c.purchases}건 · 가중치 ${c.weights}건 · 설정 ${c.settings}건 복원됨.`,
      );
      await reload();
    } catch (e) {
      Alert.alert('복원 실패', e.message || '백업 파일을 읽을 수 없습니다.');
    } finally { setWorking(false); }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* 번호 생성 설정 */}
      <Text style={styles.sectionTitle}>번호 생성</Text>
      <Pressable
        style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.7 }]}
        onPress={() => navigation?.navigate('Weights')}
      >
        <Text style={styles.navEmoji}>⚙️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>알고리즘 가중치</Text>
          <Text style={styles.navSub}>8개 알고리즘 비중 조정 (freq · hot · cold · ...)</Text>
        </View>
        <Text style={styles.navChevron}>›</Text>
      </Pressable>

      {/* 자동 연동 토글 */}
      <Text style={styles.sectionTitle}>자동 연동</Text>
      <View style={styles.toggleCard}>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>📲 텔레그램 자동발송</Text>
            <Text style={styles.toggleSub}>
              스케줄 시각에 AI 자동추천 → 텔레그램 발송
            </Text>
          </View>
          <Switch
            value={autoTg}
            onValueChange={onToggleAutoTg}
            trackColor={{ false: '#e5e7eb', true: '#a5b4fc' }}
            thumbColor={autoTg ? theme.primary : '#fff'}
          />
        </View>

        {autoTg && (
          <View style={styles.scheduleBox}>
            <Text style={styles.scheduleLabel}>요일</Text>
            <View style={styles.dayRow}>
              {DAY_LABELS.map((label, idx) => {
                const active = tgDays.includes(idx);
                return (
                  <Pressable
                    key={idx}
                    style={[styles.dayBtn, active && styles.dayBtnActive]}
                    onPress={() => onToggleDay(idx)}
                  >
                    <Text style={[styles.dayTxt, active && styles.dayTxtActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.scheduleLabel}>발송 시각</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6 }}
            >
              {HOUR_OPTIONS.map((h) => {
                const active = tgHour === h;
                return (
                  <Pressable
                    key={h}
                    style={[styles.hourBtn, active && styles.hourBtnActive]}
                    onPress={() => onChangeHour(h)}
                  >
                    <Text style={[styles.hourTxt, active && styles.hourTxtActive]}>
                      {String(h).padStart(2, '0')}시
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.scheduleLabel}>게임 수</Text>
            <View style={styles.countRow}>
              {COUNT_OPTIONS.map((c) => {
                const active = tgCount === c;
                return (
                  <Pressable
                    key={c}
                    style={[styles.countBtn, active && styles.countBtnActive]}
                    onPress={() => onChangeCount(c)}
                  >
                    <Text style={[styles.countTxt, active && styles.countTxtActive]}>{c}게임</Text>
                  </Pressable>
                );
              })}
            </View>

            {tgDays.length > 0 ? (
              <View style={styles.scheduleSummary}>
                <Text style={styles.scheduleSummaryTxt}>
                  ⏰ 매주 {tgDays.map((d) => DAY_LABELS[d]).join('·')}요일{' '}
                  {String(tgHour).padStart(2, '0')}시 · {tgCount}게임 자동 발송
                </Text>
              </View>
            ) : (
              <Text style={styles.scheduleHint}>요일을 1개 이상 선택해주세요</Text>
            )}

            <Pressable
              style={[styles.testBtn, working && { opacity: 0.5 }]}
              disabled={working}
              onPress={onTestTgAutoSend}
            >
              <Text style={styles.testBtnTxt}>🚀 지금 테스트 발송</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>🔔 번호 생성 푸시</Text>
            <Text style={styles.toggleSub}>
              앱에서 번호 생성 시 디바이스 알림으로 표시
            </Text>
          </View>
          <Switch
            value={autoPush}
            onValueChange={onToggleAutoPush}
            trackColor={{ false: '#e5e7eb', true: '#a5b4fc' }}
            thumbColor={autoPush ? theme.primary : '#fff'}
          />
        </View>
        {autoPush && (
          <Pressable style={styles.testBtn} onPress={onTestPush}>
            <Text style={styles.testBtnTxt}>🔔 알림 테스트</Text>
          </Pressable>
        )}

        <View style={styles.divider} />

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>🎉 당첨 자동확인</Text>
            <Text style={styles.toggleSub}>
              매주 토요일 추첨 후 구입번호를 자동 검사
            </Text>
          </View>
          <Switch
            value={winEnabled}
            onValueChange={onToggleWinAlert}
            trackColor={{ false: '#e5e7eb', true: '#a5b4fc' }}
            thumbColor={winEnabled ? theme.primary : '#fff'}
          />
        </View>
        {winEnabled && (
          <View style={styles.scheduleBox}>
            <Text style={styles.scheduleLabel}>확인 시각 (토요일)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6 }}
            >
              {[20, 21, 22, 23, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((h) => {
                const active = winHour === h;
                return (
                  <Pressable
                    key={h}
                    style={[styles.hourBtn, active && styles.hourBtnActive]}
                    onPress={() => onChangeWinHour(h)}
                  >
                    <Text style={[styles.hourTxt, active && styles.hourTxtActive]}>
                      {String(h).padStart(2, '0')}시
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.scheduleSummary}>
              <Text style={styles.scheduleSummaryTxt}>
                ⏰ 매주 토요일 {String(winHour).padStart(2, '0')}시 자동 확인 · 당첨 시 푸시 알림
              </Text>
            </View>
            <Pressable
              style={[styles.testBtn, working && { opacity: 0.5 }]}
              disabled={working}
              onPress={onTestWinCheck}
            >
              <Text style={styles.testBtnTxt}>🎯 지금 당첨 확인</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* 텔레그램 봇 설정 */}
      <Text style={styles.sectionTitle}>텔레그램 봇</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Bot Token</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={token}
            onChangeText={setToken}
            placeholder="123456:ABC-DEF..."
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!showToken}
          />
          <Pressable onPress={() => setShowToken((s) => !s)} style={styles.eyeBtn}>
            <Text style={styles.eyeTxt}>{showToken ? '🙈' : '👁'}</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Chat ID</Text>
        <TextInput
          style={[styles.input, { width: '100%' }]}
          value={chatId}
          onChangeText={setChatId}
          placeholder="예: 123456789"
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.btnRow}>
          <Pressable style={[styles.btn, working && { opacity: 0.6 }]} disabled={working} onPress={onSaveTg}>
            <Text style={styles.btnTxt}>💾 저장</Text>
          </Pressable>
          <Pressable style={[styles.btnAlt, working && { opacity: 0.6 }]} disabled={working} onPress={onTestTg}>
            <Text style={styles.btnAltTxt}>📤 테스트</Text>
          </Pressable>
        </View>

        <Pressable style={styles.btnDanger} onPress={onClearTg}>
          <Text style={styles.btnDangerTxt}>설정 초기화</Text>
        </Pressable>

        <View style={styles.helpBox}>
          <Text style={styles.helpTitle}>📖 봇 설정 가이드</Text>
          <Text style={styles.helpItem}>1. @BotFather → /newbot으로 봇 생성</Text>
          <Text style={styles.helpItem}>2. 발급된 Token 복사</Text>
          <Text style={styles.helpItem}>3. 본인 봇과 1:1 대화 시작</Text>
          <Text style={styles.helpItem}>4. @userinfobot으로 Chat ID 확인</Text>
          <View style={styles.helpLinks}>
            <Pressable onPress={() => Linking.openURL('https://t.me/BotFather')}>
              <Text style={styles.helpLink}>BotFather 열기 →</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL('https://t.me/userinfobot')}>
              <Text style={styles.helpLink}>Chat ID 확인 →</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* 데이터 백업 */}
      <Text style={styles.sectionTitle}>데이터 백업</Text>
      <View style={styles.card}>
        <Text style={styles.dataInfo}>
          📦 모든 데이터(추천번호, 구입번호, 알고리즘 가중치, 텔레그램 설정)는 디바이스의{' '}
          <Text style={styles.bold}>로컬 SQLite DB</Text>에 안전하게 저장됩니다.
        </Text>
        <Text style={styles.dataInfo}>
          ⚠️ 어플을 <Text style={styles.bold}>완전 삭제</Text>하면 디바이스 데이터도 함께 사라집니다. 안전을 위해 정기적으로 백업 파일을 내보내 보관하세요.
        </Text>

        <View style={styles.btnRow}>
          <Pressable style={[styles.btn, working && { opacity: 0.6 }]} disabled={working} onPress={onExport}>
            <Text style={styles.btnTxt}>📤 백업 내보내기</Text>
          </Pressable>
          <Pressable style={[styles.btnAlt, working && { opacity: 0.6 }]} disabled={working} onPress={onImport}>
            <Text style={styles.btnAltTxt}>📥 복원하기</Text>
          </Pressable>
        </View>
      </View>

      {/* 약관 및 면책조항 */}
      <Text style={styles.sectionTitle}>약관 및 정책</Text>
      <Pressable
        style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.7 }]}
        onPress={() => navigation?.navigate('Legal')}
      >
        <Text style={styles.navEmoji}>⚖️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>약관 및 면책조항</Text>
          <Text style={styles.navSub}>이용약관 · 개인정보 · 면책 · 광고 안내</Text>
        </View>
        <Text style={styles.navChevron}>›</Text>
      </Pressable>

      <View style={styles.legalNotice}>
        <Text style={styles.legalNoticeTitle}>⚠️ 면책 안내</Text>
        <Text style={styles.legalNoticeTxt}>
          본 앱이 제공하는 추천 번호는 <Text style={{ fontWeight: '800' }}>통계 분석에 기반한 참고용</Text>이며,
          당첨을 보장하지 않습니다. 로또 구매 및 결과는 전적으로 사용자의 판단과 책임이며,
          본 앱은 <Text style={{ fontWeight: '800' }}>어떠한 법적 책임도 지지 않습니다</Text>.
        </Text>
      </View>

      <Text style={styles.footer}>v1.0.0 · 데이터는 회사 서버를 거치지 않습니다</Text>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 60 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg },

  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: theme.textSub,
    letterSpacing: 0.5, marginTop: 18, marginBottom: 8, paddingLeft: 4,
  },

  toggleCard: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: theme.border,
    padding: 4,
  },
  navRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: theme.border,
    padding: 14,
  },
  navEmoji: { fontSize: 24 },
  navTitle: { fontSize: 15, fontWeight: '800', color: theme.text },
  navSub: { fontSize: 11, color: theme.textSub, marginTop: 2 },
  navChevron: { fontSize: 24, color: theme.textMuted },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12,
  },
  toggleTitle: { fontSize: 15, fontWeight: '800', color: theme.text },
  toggleSub: { fontSize: 12, color: theme.textSub, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 12 },
  activeBanner: {
    margin: 8, padding: 10, borderRadius: 10,
    backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0',
  },
  activeBannerTxt: { color: '#065f46', fontSize: 12, fontWeight: '700' },
  testBtn: {
    margin: 8, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#eef2ff', borderWidth: 1, borderColor: theme.primary,
  },
  testBtnTxt: { color: theme.primary, fontWeight: '700', fontSize: 13 },

  scheduleBox: {
    margin: 8, padding: 12, borderRadius: 10,
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb',
  },
  scheduleLabel: {
    fontSize: 11, color: theme.textSub, fontWeight: '700',
    marginBottom: 6, marginTop: 8, letterSpacing: 0.3,
  },
  dayRow: { flexDirection: 'row', gap: 5, justifyContent: 'space-between' },
  dayBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border,
  },
  dayBtnActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  dayTxt: { fontSize: 12, color: theme.text, fontWeight: '700' },
  dayTxtActive: { color: '#fff' },

  hourBtn: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border,
  },
  hourBtnActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  hourTxt: { fontSize: 12, color: theme.text, fontWeight: '700' },
  hourTxtActive: { color: '#fff' },

  countRow: { flexDirection: 'row', gap: 6 },
  countBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border,
  },
  countBtnActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  countTxt: { fontSize: 12, color: theme.text, fontWeight: '700' },
  countTxtActive: { color: '#fff' },

  scheduleSummary: {
    marginTop: 10, padding: 9, borderRadius: 8,
    backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0',
  },
  scheduleSummaryTxt: { color: '#065f46', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  scheduleHint: {
    marginTop: 10, padding: 8, color: theme.warn, fontSize: 11,
    textAlign: 'center', fontWeight: '600',
  },

  card: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: theme.border,
    padding: 14,
  },

  label: { color: theme.textSub, fontSize: 12, fontWeight: '700', marginTop: 8, marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1, borderWidth: 1, borderColor: theme.border, backgroundColor: '#fafafa',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.text,
  },
  eyeBtn: {
    width: 44, height: 44, borderWidth: 1, borderColor: theme.border, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  eyeTxt: { fontSize: 16 },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: theme.primary,
  },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnAlt: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#eef2ff', borderWidth: 1, borderColor: theme.primary,
  },
  btnAltTxt: { color: theme.primary, fontWeight: '800', fontSize: 14 },
  btnDanger: {
    paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', marginTop: 10,
  },
  btnDangerTxt: { color: theme.danger, fontWeight: '700' },

  helpBox: {
    marginTop: 14, padding: 12, backgroundColor: '#fafafa',
    borderRadius: 10, borderWidth: 1, borderColor: theme.border,
  },
  helpTitle: { fontWeight: '800', color: theme.text, marginBottom: 6 },
  helpItem: { color: theme.textSub, fontSize: 12, marginBottom: 3 },
  helpLinks: { flexDirection: 'row', gap: 12, marginTop: 8 },
  helpLink: { color: theme.primary, fontSize: 12, fontWeight: '700' },

  dataInfo: { fontSize: 12, color: theme.textSub, lineHeight: 18, marginBottom: 8 },
  bold: { fontWeight: '800', color: theme.text },

  legalNotice: {
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a',
    borderRadius: 10, padding: 12, marginTop: 12,
  },
  legalNoticeTitle: { fontSize: 12, fontWeight: '800', color: '#b45309', marginBottom: 5 },
  legalNoticeTxt: { fontSize: 11, color: '#92400e', lineHeight: 17 },
  footer: { textAlign: 'center', color: theme.textMuted, fontSize: 11, marginTop: 24 },
});
