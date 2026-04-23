/**
 * 영수증 갤러리 v2
 *
 * - 통화별 지출 + home 통화 환산 정산
 * - 카테고리별 총액
 * - 그리드 뷰
 */
import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Image, Modal,
  ScrollView, Dimensions, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';

import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { getDB } from '@/db/database';
import { getAllExpenses, getExpensesWithReceipts } from '@/db/receipts';
import { CATEGORY_INFO, ExpenseCategory } from '@/utils/receiptParser';
import { deleteReceiptImage } from '@/utils/receiptStorage';
import {
  summarizeExpenses, formatWithConversion, getCurrencySymbol,
  Summary,
} from '@/utils/currencyConverter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_SIZE = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.sm * 2) / 3;

interface ReceiptExpense {
  id: string;
  expense_date: string;
  category: string;
  title: string;
  amount: number;
  currency: string;
  exchange_rate?: number;
  amount_in_home_currency?: number;
  memo?: string;
  receipt_image: string;
  receipt_ocr_text?: string;
  receipt_confidence?: number;
  ocr_engine?: string;
  created_at: string;
}

export default function ReceiptGalleryScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = id as string;

  const [receipts, setReceipts] = useState<ReceiptExpense[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [homeCurrency, setHomeCurrency] = useState('KRW');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selected, setSelected] = useState<ReceiptExpense | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const load = useCallback(async () => {
    try {
      const db = await getDB();
      const u = await db.getFirstAsync<any>('SELECT home_currency FROM user LIMIT 1');
      const home = u?.home_currency || 'KRW';
      setHomeCurrency(home);

      // 영수증만
      const receiptsRows = await getExpensesWithReceipts(db, tripId);
      setReceipts(receiptsRows as ReceiptExpense[]);

      // 전체 expense (정산용)
      const allRows = await getAllExpenses(db, tripId);
      setAllExpenses(allRows);

      // 다중 통화 정산 (비동기, 환율 조회)
      setLoadingSummary(true);
      const s = await summarizeExpenses(
        allRows.map((e: any) => ({
          amount: e.amount,
          currency: e.currency,
          exchangeRate: e.exchange_rate,
          amountInHomeCurrency: e.amount_in_home_currency,
        })),
        home
      );
      setSummary(s);
      setLoadingSummary(false);
    } catch (err) {
      console.error(err);
      setLoadingSummary(false);
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // 카테고리별 그룹
  const grouped = receipts.reduce((acc, r) => {
    const cat = r.category as ExpenseCategory;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {} as Record<ExpenseCategory, ReceiptExpense[]>);

  const totalByCategory = Object.entries(grouped).map(([cat, items]) => {
    const total = items.reduce((sum, r) => {
      const home = r.amount_in_home_currency ??
        (r.exchange_rate ? r.amount * r.exchange_rate : r.amount);
      return sum + home;
    }, 0);
    return { category: cat as ExpenseCategory, count: items.length, totalInHome: total };
  }).sort((a, b) => b.totalInHome - a.totalInHome);

  const handleDelete = () => {
    if (!selected) return;
    haptic.heavy();
    Alert.alert(
      '영수증 삭제',
      '이 영수증과 해당 지출 기록이 삭제됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDB();
              await deleteReceiptImage(selected.receipt_image);
              await db.runAsync('DELETE FROM expenses WHERE id = ?', [selected.id]);
              haptic.success();
              setSelected(null);
              load();
            } catch (err) {
              haptic.error();
              Alert.alert('삭제 실패', String(err));
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => { haptic.tap(); router.back(); }} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>영수증 & 정산</Text>
          <Text style={styles.headerSub}>{receipts.length}개 영수증</Text>
        </View>
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            haptic.tap();
            router.push(`/trip/${tripId}/receipt-scan`);
          }}
        >
          <Text style={styles.addBtnText}>+ 스캔</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 총 지출 (multi-currency 정산) */}
        {summary && allExpenses.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>총 지출</Text>
            {loadingSummary ? (
              <ActivityIndicator style={{ marginVertical: Spacing.lg }} color={colors.accent} />
            ) : (
              <>
                <Text style={styles.summaryTotal}>
                  {getCurrencySymbol(summary.homeCurrency)}
                  {summary.totalInHome.toLocaleString()}
                </Text>
                <Text style={styles.summaryHome}>{summary.homeCurrency} 환산</Text>

                {/* 통화별 세부 */}
                {summary.byCurrency.length > 1 && (
                  <View style={styles.currencyBreakdown}>
                    <Text style={styles.breakdownTitle}>통화별 지출</Text>
                    {summary.byCurrency.map(cb => (
                      <View key={cb.currency} style={styles.breakdownRow}>
                        <Text style={styles.breakdownCurrency}>
                          {getCurrencySymbol(cb.currency)}{cb.currency}
                        </Text>
                        <View style={styles.breakdownRight}>
                          <Text style={styles.breakdownAmount}>
                            {getCurrencySymbol(cb.currency)}
                            {cb.total.toLocaleString()}
                          </Text>
                          {cb.currency !== summary.homeCurrency && (
                            <Text style={styles.breakdownHome}>
                              ≈ {getCurrencySymbol(summary.homeCurrency)}
                              {cb.totalInHome.toLocaleString()}
                            </Text>
                          )}
                          <Text style={styles.breakdownCount}>
                            {cb.count}건
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {summary.missingRates.length > 0 && (
                  <Text style={styles.missingWarning}>
                    ⚠️ 환율 조회 실패: {summary.missingRates.join(', ')}
                  </Text>
                )}
              </>
            )}
          </View>
        )}

        {receipts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🧾</Text>
            <Text style={styles.emptyTitle}>아직 영수증이 없어요</Text>
            <Text style={styles.emptyDesc}>
              영수증을 스캔하면 자동으로{'\n'}
              가게/금액/카테고리가 기록돼요
            </Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => {
                haptic.tap();
                router.push(`/trip/${tripId}/receipt-scan`);
              }}
            >
              <Text style={styles.emptyBtnText}>📸 첫 영수증 스캔하기</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* 카테고리별 */}
            <Text style={styles.sectionTitle}>카테고리별 지출</Text>
            <View style={styles.categoryRow}>
              {totalByCategory.map(({ category, count, totalInHome }) => {
                const info = CATEGORY_INFO[category];
                return (
                  <View key={category} style={styles.categoryCard}>
                    <Text style={styles.categoryIcon}>{info.icon}</Text>
                    <Text style={styles.categoryLabel}>{info.label}</Text>
                    <Text style={styles.categoryCount}>{count}건</Text>
                    <Text style={styles.categoryTotal}>
                      {getCurrencySymbol(homeCurrency)}
                      {Math.round(totalInHome).toLocaleString()}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* 영수증 그리드 */}
            <Text style={styles.sectionTitle}>전체 영수증</Text>
            <View style={styles.grid}>
              {receipts.map((r) => {
                const info = CATEGORY_INFO[r.category as ExpenseCategory] || CATEGORY_INFO.other;
                return (
                  <Pressable
                    key={r.id}
                    style={styles.cell}
                    onPress={() => { haptic.tap(); setSelected(r); }}
                  >
                    <Image source={{ uri: r.receipt_image }} style={styles.cellImage} />
                    <View style={[styles.cellBadge, { backgroundColor: info.color }]}>
                      <Text style={styles.cellBadgeText}>{info.icon}</Text>
                    </View>
                    <View style={styles.cellFooter}>
                      <Text style={styles.cellAmount} numberOfLines={1}>
                        {getCurrencySymbol(r.currency)}
                        {r.amount.toLocaleString()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <View style={{ height: Spacing.huge }} />
      </ScrollView>

      {/* 상세 모달 */}
      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        {selected && (
          <View style={styles.modalOverlay}>
            <SafeAreaView style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Pressable onPress={() => { haptic.tap(); setSelected(null); }}>
                  <Text style={styles.modalClose}>✕</Text>
                </Pressable>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {selected.title}
                </Text>
                <Pressable onPress={handleDelete}>
                  <Text style={styles.modalDelete}>삭제</Text>
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.modalScroll}>
                <Image
                  source={{ uri: selected.receipt_image }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />

                <View style={styles.modalInfo}>
                  <InfoRow label="가게" value={selected.title} styles={styles} />
                  <InfoRow label="날짜" value={selected.expense_date} styles={styles} />
                  <InfoRow
                    label="원본 금액"
                    value={formatWithConversion(
                      selected.amount,
                      selected.currency,
                      selected.amount_in_home_currency ?? null,
                      homeCurrency
                    )} styles={styles} />
                  {selected.exchange_rate && selected.currency !== homeCurrency && (
                    <InfoRow
                      label="저장 시 환율"
                      value={`1 ${selected.currency} = ${selected.exchange_rate.toFixed(4)} ${homeCurrency}`} styles={styles} />
                  )}
                  <InfoRow
                    label="카테고리"
                    value={`${CATEGORY_INFO[selected.category as ExpenseCategory]?.icon} ${
                      CATEGORY_INFO[selected.category as ExpenseCategory]?.label
                    }`} styles={styles} />
                  {selected.memo && <InfoRow label="메모" value={selected.memo} styles={styles} />}
                  {selected.receipt_confidence !== undefined && (
                    <InfoRow
                      label="인식률"
                      value={`${Math.round((selected.receipt_confidence ?? 0) * 100)}% · ${
                        selected.ocr_engine === 'mlkit' ? 'ML Kit' :
                        selected.ocr_engine === 'ocrspace' ? 'OCR.space' :
                        '수동'
                      }`} styles={styles} />
                  )}
                </View>

                {selected.receipt_ocr_text && (
                  <>
                    <Text style={styles.ocrLabel}>📄 원본 인식 텍스트</Text>
                    <View style={styles.ocrBox}>
                      <Text style={styles.ocrText}>{selected.receipt_ocr_text}</Text>
                    </View>
                  </>
                )}

                {/* 비용 편집 화면으로 이동 */}
                <Pressable
                  style={styles.editBtn}
                  onPress={() => {
                    haptic.tap();
                    const expenseId = selected.id;
                    setSelected(null);
                    router.push({
                      pathname: '/trip/[id]/expense/[expenseId]',
                      params: { id: String(tripId), expenseId: String(expenseId) },
                    } as any);
                  }}
                >
                  <Text style={styles.editBtnText}>✏️  비용 정보 편집</Text>
                </Pressable>

                <View style={{ height: Spacing.huge }} />
              </ScrollView>
            </SafeAreaView>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, styles }: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 22, color: c.textPrimary },
  headerTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '700',
    color: c.textPrimary,
  },
  headerSub: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: c.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
  },
  addBtnText: {
    fontSize: Typography.labelMedium,
    fontWeight: '700',
    color: c.textOnPrimary,
  },

  scroll: { padding: Spacing.xl },

  summaryCard: {
    backgroundColor: c.primary,
    padding: Spacing.xl,
    borderRadius: 16,
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  summaryLabel: {
    fontSize: Typography.labelSmall,
    color: c.accent,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  summaryTotal: {
    fontSize: Typography.displayMedium,
    fontWeight: '700',
    color: c.textOnPrimary,
    marginTop: Spacing.xs,
  },
  summaryHome: {
    fontSize: Typography.labelMedium,
    color: c.accent,
    marginTop: 2,
  },
  currencyBreakdown: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    gap: Spacing.sm,
  },
  breakdownTitle: {
    fontSize: Typography.labelSmall,
    color: c.accent,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  breakdownCurrency: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: c.textOnPrimary,
    minWidth: 60,
  },
  breakdownRight: {
    alignItems: 'flex-end',
    flex: 1,
  },
  breakdownAmount: {
    fontSize: Typography.bodyMedium,
    color: c.textOnPrimary,
    fontWeight: '600',
  },
  breakdownHome: {
    fontSize: Typography.labelSmall,
    color: c.accent,
    marginTop: 2,
  },
  breakdownCount: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  missingWarning: {
    marginTop: Spacing.sm,
    fontSize: Typography.labelSmall,
    color: c.warning,
  },

  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
  },
  emptyIcon: { fontSize: 72, marginBottom: Spacing.lg },
  emptyTitle: {
    fontSize: Typography.titleMedium,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptyDesc: {
    fontSize: Typography.bodyMedium,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.bodyMedium * 1.6,
    marginBottom: Spacing.xxl,
  },
  emptyBtn: {
    backgroundColor: c.primary,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xxl,
    borderRadius: 14,
    ...Shadows.md,
  },
  emptyBtnText: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: c.textOnPrimary,
  },

  sectionTitle: {
    fontSize: Typography.labelMedium,
    fontWeight: '700',
    color: c.textSecondary,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },

  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryCard: {
    flexBasis: '30%',
    backgroundColor: c.surface,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    ...Shadows.sm,
  },
  categoryIcon: { fontSize: 24, marginBottom: 4 },
  categoryLabel: {
    fontSize: Typography.labelSmall,
    color: c.textSecondary,
    fontWeight: '600',
  },
  categoryCount: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
    marginTop: 2,
  },
  categoryTotal: {
    fontSize: Typography.labelMedium,
    fontWeight: '700',
    color: c.textPrimary,
    marginTop: 4,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE * 1.4,
    backgroundColor: c.surfaceAlt,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  cellImage: { width: '100%', flex: 1 },
  cellBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellBadgeText: { fontSize: 12 },
  cellFooter: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  cellAmount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)' },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  modalClose: { fontSize: 24, color: '#fff', fontWeight: '700' },
  modalTitle: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  modalDelete: {
    fontSize: Typography.labelMedium,
    color: c.error,
    fontWeight: '700',
  },
  modalScroll: { paddingHorizontal: Spacing.xl },
  modalImage: {
    width: '100%',
    height: 400,
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: Spacing.lg,
  },
  modalInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: Spacing.lg,
    borderRadius: 12,
    gap: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: Typography.labelMedium,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  infoValue: {
    fontSize: Typography.bodyMedium,
    color: '#fff',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: Spacing.md,
  },
  ocrLabel: {
    fontSize: Typography.labelMedium,
    color: '#fff',
    fontWeight: '700',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  ocrBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: Spacing.md,
    borderRadius: 10,
  },
  ocrText: {
    fontSize: Typography.labelSmall,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 16,
    fontFamily: 'monospace',
  },
  editBtn: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
  },
  editBtnText: {
    fontSize: Typography.bodyMedium,
    color: '#fff',
    fontWeight: '600',
  },
});
}
