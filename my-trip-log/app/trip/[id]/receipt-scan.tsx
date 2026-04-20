/**
 * 영수증 스캔 v2 - 듀얼 엔진 + 다중 통화
 *
 * 경로: /trip/[id]/receipt-scan
 *
 * 개선사항:
 *   - 여행 도시에 따라 OCR 언어 자동 선택
 *   - ML Kit → OCR.space 자동 폴백
 *   - 원본 통화로 저장 + 환율 자동 기록
 *   - 실시간 환율 미리보기 (home 통화 환산)
 */
import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image, ScrollView,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { Colors, Typography, Spacing, Shadows } from '@/theme/theme';
import { haptic } from '@/utils/haptics';
import { recognizeReceiptDual, getOcrStatus } from '@/utils/ocr';
import { saveReceiptImage } from '@/utils/receiptStorage';
import {
  ExpenseCategory, CATEGORY_INFO,
} from '@/utils/receiptParser';
import {
  calculateExchangeRate, getCurrencySymbol,
} from '@/utils/currencyConverter';
import { getDB } from '@/db/database';
import { insertExpenseWithReceipt } from '@/db/receipts';

const CATEGORIES_ORDER: ExpenseCategory[] = [
  'food', 'transport', 'accommodation', 'shopping',
  'sightseeing', 'entertainment', 'other',
];

const COMMON_CURRENCIES = ['KRW', 'JPY', 'USD', 'EUR', 'THB', 'GBP', 'CNY', 'HKD', 'SGD', 'VND'];

export default function ReceiptScanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = id as string;

  const [trip, setTrip] = useState<any>(null);
  const [homeCurrency, setHomeCurrency] = useState('KRW');
  const [ocrStatus, setOcrStatus] = useState<{ mlkit: boolean; ocrspace: boolean } | null>(null);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [parsed, setParsed] = useState<any>(null);

  // 편집 필드
  const [storeName, setStoreName] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('KRW');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [memo, setMemo] = useState('');

  // 환율 미리보기
  const [previewHomeAmount, setPreviewHomeAmount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const db = await getDB();
      const t = await db.getFirstAsync<any>(
        'SELECT * FROM trips WHERE id = ?',
        [tripId]
      );
      if (t) {
        setTrip(t);
        // 여행 통화가 있으면 기본 통화로 미리 세팅
        if (t.currency) {
          setCurrency(t.currency);
        }
      }

      const u = await db.getFirstAsync<any>('SELECT home_currency FROM user LIMIT 1');
      if (u?.home_currency) {
        setHomeCurrency(u.home_currency);
      }

      setOcrStatus(await getOcrStatus());
    })();
  }, [tripId]);

  // 금액/통화 바뀔 때마다 환율 미리보기 갱신
  useEffect(() => {
    if (!amount || currency === homeCurrency) {
      setPreviewHomeAmount(null);
      return;
    }

    const n = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(n)) {
      setPreviewHomeAmount(null);
      return;
    }

    let cancelled = false;
    calculateExchangeRate(currency, homeCurrency).then(rate => {
      if (cancelled || !rate) return;
      setPreviewHomeAmount(Math.round(n * rate));
    });

    return () => { cancelled = true; };
  }, [amount, currency, homeCurrency]);

  const pickFromCamera = async () => {
    haptic.tap();
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('카메라 권한 필요', '카메라 권한을 허용해주세요');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      await processImage(result.assets[0].uri);
    }
  };

  const pickFromLibrary = async () => {
    haptic.tap();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('사진 권한 필요', '사진 앱 접근 권한을 허용해주세요');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      await processImage(result.assets[0].uri);
    }
  };

  const processImage = async (uri: string, forceLang?: 'kor' | 'jpn' | 'eng' | 'tha' | 'chs') => {
    setLoading(true);
    setImageUri(uri);
    setLoadingText('텍스트 인식 중...');

    try {
      const result = await recognizeReceiptDual(uri, {
        countryCode: trip?.country_code,
        cityId: trip?.city ? trip.city.toLowerCase() : undefined,
        forceLang: forceLang ?? ocrLang,
        defaultCurrency: trip?.currency || 'KRW',
      });

      setParsed(result); if (result.lang) setOcrLang(result.lang);
      if (result.storeName) setStoreName(result.storeName);
      if (result.date) setDate(result.date);
      if (result.totalAmount) setAmount(String(result.totalAmount));
      if (result.currency) setCurrency(result.currency);
      if (result.category) setCategory(result.category);

      if (result.engine === 'none') {
        haptic.warning();
      } else {
        haptic.success();
      }
    } catch (err) {
      haptic.error();
      Alert.alert('OCR 실패', String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    haptic.medium();
    if (!amount || !storeName) {
      haptic.warning();
      Alert.alert('정보 부족', '가게명과 금액은 필수예요');
      return;
    }

    try {
      setLoading(true);
      setLoadingText('저장 중...');

      const db = await getDB();

      let savedImageUri: string | undefined;
      if (imageUri) {
        savedImageUri = await saveReceiptImage(imageUri);
      }

      await insertExpenseWithReceipt(db, {
        tripId,
        expenseDate: date || new Date().toISOString().slice(0, 10),
        category,
        title: storeName,
        amount: parseFloat(amount.replace(/,/g, '')),
        currency,
        homeCurrency,
        paymentMethod: 'receipt',
        memo: memo || undefined,
        receiptImage: savedImageUri,
        receiptOcrText: parsed?.rawText,
        receiptConfidence: parsed?.confidence,
        ocrEngine: parsed?.engine,
      });

      haptic.success();
      router.back();
    } catch (err) {
      haptic.error();
      Alert.alert('저장 실패', String(err));
    } finally {
      setLoading(false);
    }
  };

  // 아직 이미지 선택 전
  if (!imageUri) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => { haptic.tap(); router.back(); }}>
            <Text style={styles.cancel}>취소</Text>
          </Pressable>
          <Text style={styles.headerTitle}>영수증 스캔</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.intro}>
          <Text style={styles.introIcon}>🧾</Text>
          <Text style={styles.introTitle}>영수증 찍어서{'\n'}바로 기록하세요</Text>
          <Text style={styles.introDesc}>
            가게명, 날짜, 금액, 카테고리가{'\n'}
            자동으로 인식되고 환율도 계산돼요
          </Text>

          <View style={styles.btnGroup}>
            <Pressable style={styles.bigBtn} onPress={pickFromCamera}>
              <Text style={styles.bigBtnIcon}>📸</Text>
              <Text style={styles.bigBtnText}>카메라로 촬영</Text>
            </Pressable>
            <Pressable
              style={[styles.bigBtn, { backgroundColor: Colors.surfaceAlt }]}
              onPress={pickFromLibrary}
            >
              <Text style={styles.bigBtnIcon}>🖼️</Text>
              <Text style={[styles.bigBtnText, { color: Colors.textPrimary }]}>
                앨범에서 선택
              </Text>
            </Pressable>
          </View>

          {/* OCR 엔진 상태 */}
          {ocrStatus && (
            <View style={styles.engineBox}>
              <Text style={styles.engineTitle}>🤖 OCR 엔진</Text>
              <View style={styles.engineRow}>
                <Text style={styles.engineLabel}>ML Kit (빠름, 오프라인)</Text>
                <Text style={[styles.engineStatus, ocrStatus.mlkit ? styles.engineOn : styles.engineOff]}>
                  {ocrStatus.mlkit ? '✅ 사용 가능' : '⚠️ 개발 빌드 필요'}
                </Text>
              </View>
              <View style={styles.engineRow}>
                <Text style={styles.engineLabel}>OCR.space (80+ 언어)</Text>
                <Text style={[styles.engineStatus, styles.engineOn]}>
                  ✅ 사용 가능
                </Text>
              </View>
              <Text style={styles.engineHint}>
                {ocrStatus.mlkit
                  ? '자동으로 최적의 엔진을 선택해요'
                  : '인터넷 연결 필요 (태국어 등 지원)'}
              </Text>
            </View>
          )}

          <View style={styles.tipsBox}>
            <Text style={styles.tipsTitle}>💡 더 정확하게 인식하려면</Text>
            <Text style={styles.tipsText}>• 영수증을 평평하게</Text>
            <Text style={styles.tipsText}>• 밝은 곳에서 촬영</Text>
            <Text style={styles.tipsText}>• 전체가 프레임 안에 들어오게</Text>
            <Text style={styles.tipsText}>• 구겨진 건 살짝 펴주세요</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 이미지 있음 - 편집 화면
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => {
            haptic.tap();
            setImageUri(null); setParsed(null);
            setStoreName(''); setDate(''); setAmount(''); setMemo('');
          }}>
            <Text style={styles.cancel}>다시</Text>
          </Pressable>
          <Text style={styles.headerTitle}>영수증 확인</Text>
          <Pressable onPress={handleSave} disabled={loading}>
            <Text style={[styles.save, loading && styles.saveDisabled]}>저장</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* 이미지 */}
          <View style={styles.imageBox}>
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
            {loading && (
              <View style={styles.imageOverlay}>
                <ActivityIndicator size="large" color={Colors.accent} />
                <Text style={styles.imageOverlayText}>{loadingText}</Text>
              </View>
            )}
          </View>

          {/* OCR 결과 요약 */}
          {parsed && !loading && (
            <View style={[
              styles.confidenceBox,
              parsed.confidence >= 0.6 ? styles.confidenceGood :
              parsed.confidence >= 0.3 ? styles.confidenceMid :
              styles.confidenceLow,
            ]}>
              <Text style={styles.confidenceText}>
                {parsed.confidence >= 0.6 ? '✅ 자동 인식 성공' :
                 parsed.confidence >= 0.3 ? '⚠️ 부분 인식 (확인 필요)' :
                 '❌ 인식 실패 (수동 입력)'}
                {' '}({Math.round(parsed.confidence * 100)}%)
              </Text>
              <Text style={styles.engineText}>
                엔진: {parsed.engine === 'mlkit' ? '📱 ML Kit (온디바이스)' :
                       parsed.engine === 'ocrspace' ? '☁️ OCR.space (서버)' : '❌ 없음'}
                {' · '}{parsed.duration}ms
                {parsed.lang && ` · 언어: ${parsed.lang.toUpperCase()}`}
              </Text>

              {/* 언어 수동 재인식 */}
              {imageUri && (
                <>
                  <Text style={styles.relangHint}>결과가 이상한가요? 다른 언어로 재인식:</Text>
                  <View style={styles.langChips}>
                    {[
                      { k: 'kor', label: '🇰🇷 한국어' },
                      { k: 'jpn', label: '🇯🇵 일본어' },
                      { k: 'chs', label: '🇨🇳 중국어' },
                      { k: 'eng', label: '🇺🇸 영어' },
                      { k: 'tha', label: '🇹🇭 태국어' },
                    ].map((L) => (
                      <Pressable
                        key={L.k}
                        style={[
                          styles.langChip,
                          ocrLang === L.k && styles.langChipActive,
                        ]}
                        onPress={() => {
                          haptic.tap();
                          setOcrLang(L.k as any);
                          if (imageUri) processImage(imageUri, L.k as any);
                        }}
                      >
                        <Text
                          style={[
                            styles.langChipText,
                            ocrLang === L.k && styles.langChipTextActive,
                          ]}
                        >
                          {L.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          <Text style={styles.fieldLabel}>가게명 *</Text>
          <TextInput
            style={styles.input}
            value={storeName}
            onChangeText={setStoreName}
            placeholder="예: 스타벅스 강남점"
            placeholderTextColor={Colors.textTertiary}
          />

          <Text style={styles.fieldLabel}>날짜</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textTertiary}
          />

          <Text style={styles.fieldLabel}>금액 *</Text>
          <View style={styles.amountWrap}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="decimal-pad"
            />
            <Text style={styles.currencyDisplay}>
              {getCurrencySymbol(currency)}{currency}
            </Text>
          </View>

          {/* 환율 미리보기 */}
          {previewHomeAmount !== null && currency !== homeCurrency && (
            <View style={styles.previewBox}>
              <Text style={styles.previewText}>
                ≈ {getCurrencySymbol(homeCurrency)}{previewHomeAmount.toLocaleString()} {homeCurrency}
              </Text>
              <Text style={styles.previewSub}>현재 환율 기준 · 저장 시 기록됨</Text>
            </View>
          )}

          <Text style={styles.fieldLabel}>통화</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.currencyRow}
          >
            {COMMON_CURRENCIES.map(c => (
              <Pressable
                key={c}
                style={[styles.currencyChip, currency === c && styles.currencyChipActive]}
                onPress={() => { haptic.select(); setCurrency(c); }}
              >
                <Text style={[
                  styles.currencyChipText,
                  currency === c && styles.currencyChipTextActive,
                ]}>
                  {getCurrencySymbol(c)} {c}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>카테고리</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES_ORDER.map(cat => {
              const info = CATEGORY_INFO[cat];
              const active = category === cat;
              return (
                <Pressable
                  key={cat}
                  style={[styles.catChip, active && { backgroundColor: info.color }]}
                  onPress={() => { haptic.select(); setCategory(cat); }}
                >
                  <Text style={styles.catIcon}>{info.icon}</Text>
                  <Text style={[styles.catLabel, active && styles.catLabelActive]}>
                    {info.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>메모 (선택)</Text>
          <TextInput
            style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
            value={memo}
            onChangeText={setMemo}
            placeholder="추가 정보를 적어두세요"
            placeholderTextColor={Colors.textTertiary}
            multiline
          />

          {parsed?.rawText && (
            <>
              <Text style={styles.fieldLabel}>📄 인식된 텍스트 (원본)</Text>
              <View style={styles.rawTextBox}>
                <Text style={styles.rawText}>{parsed.rawText}</Text>
              </View>
            </>
          )}

          <View style={{ height: Spacing.huge }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  relangHint: {
    marginTop: 8,
    fontSize: 11,
    color: '#888',
  },
  langChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  langChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F3F0E8',
    borderWidth: 1,
    borderColor: '#E0DCD0',
  },
  langChipActive: {
    backgroundColor: '#1E2A3A',
    borderColor: '#1E2A3A',
  },
  langChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  langChipTextActive: {
    color: '#fff',
  },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cancel: { fontSize: Typography.bodyMedium, color: Colors.textTertiary },
  headerTitle: { fontSize: Typography.bodyLarge, fontWeight: '700', color: Colors.textPrimary },
  save: { fontSize: Typography.bodyMedium, color: Colors.primary, fontWeight: '700' },
  saveDisabled: { color: Colors.textTertiary },

  intro: { padding: Spacing.xl, alignItems: 'center' },
  introIcon: { fontSize: 72, marginBottom: Spacing.lg },
  introTitle: {
    fontSize: Typography.titleLarge,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  introDesc: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.bodyMedium * 1.6,
    marginBottom: Spacing.xxl,
  },
  btnGroup: { width: '100%', gap: Spacing.md, marginBottom: Spacing.xxl },
  bigBtn: {
    backgroundColor: Colors.primary,
    padding: Spacing.xl,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    ...Shadows.md,
  },
  bigBtnIcon: { fontSize: 32 },
  bigBtnText: {
    fontSize: Typography.titleSmall,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },

  engineBox: {
    width: '100%',
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  engineTitle: {
    fontSize: Typography.labelMedium,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  engineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  engineLabel: {
    fontSize: Typography.labelSmall,
    color: Colors.textSecondary,
  },
  engineStatus: {
    fontSize: Typography.labelSmall,
    fontWeight: '600',
  },
  engineOn: { color: Colors.success },
  engineOff: { color: Colors.warning },
  engineHint: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },

  tipsBox: {
    width: '100%',
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: 14,
    gap: Spacing.xs,
  },
  tipsTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  tipsText: {
    fontSize: Typography.labelMedium,
    color: Colors.textSecondary,
    lineHeight: Typography.labelMedium * 1.6,
  },

  scroll: { padding: Spacing.xl },
  imageBox: {
    height: 250,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  imageOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
    gap: Spacing.md,
  },
  imageOverlayText: {
    color: '#fff',
    fontSize: Typography.bodyMedium,
    fontWeight: '600',
  },

  confidenceBox: {
    padding: Spacing.md,
    borderRadius: 10,
    marginBottom: Spacing.lg,
    gap: 4,
  },
  confidenceGood: { backgroundColor: '#E8F5E9' },
  confidenceMid: { backgroundColor: '#FFF7E6' },
  confidenceLow: { backgroundColor: '#FFEBEE' },
  confidenceText: {
    fontSize: Typography.labelMedium,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  engineText: {
    fontSize: Typography.labelSmall,
    color: Colors.textSecondary,
  },

  fieldLabel: {
    fontSize: Typography.labelMedium,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  input: {
    fontSize: Typography.bodyMedium,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  amountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  currencyDisplay: {
    fontSize: Typography.titleSmall,
    fontWeight: '700',
    color: Colors.primary,
    minWidth: 70,
    textAlign: 'right',
  },

  previewBox: {
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.md,
    borderRadius: 10,
    marginTop: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  previewText: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  previewSub: {
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
    marginTop: 2,
  },

  currencyRow: { gap: Spacing.xs, paddingRight: Spacing.xl },
  currencyChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencyChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  currencyChipText: {
    fontSize: Typography.labelMedium,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  currencyChipTextActive: {
    color: Colors.textOnPrimary,
  },

  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catIcon: { fontSize: 16 },
  catLabel: {
    fontSize: Typography.labelMedium,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  catLabelActive: { color: '#fff' },

  rawTextBox: {
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  rawText: {
    fontSize: Typography.labelSmall,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
});
