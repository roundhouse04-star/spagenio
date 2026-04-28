import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Image, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Typography, Spacing, Shadows, Fonts } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/haptics';
import { TICKET_CATEGORIES } from '@/db/schema';
import { getTicket, updateTicket, deleteTicket } from '@/db/tickets';
import { getAllTrips } from '@/db/trips';
import { Ticket, Trip, TicketCategory } from '@/types';

const CURRENCIES = ['KRW', 'JPY', 'USD', 'EUR', 'GBP', 'CNY', 'THB', 'VND'];

export default function TicketDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticketId = Number(id);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // 편집 가능한 필드
  const [category, setCategory] = useState<TicketCategory>('flight');
  const [title, setTitle] = useState('');
  const [useDate, setUseDate] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [seat, setSeat] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('KRW');
  const [memo, setMemo] = useState('');
  const [tripId, setTripId] = useState<number | null>(null);
  const [tripPickerOpen, setTripPickerOpen] = useState(false);

  const showsRoute = category === 'flight' || category === 'train' || category === 'bus';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, allTrips] = await Promise.all([getTicket(ticketId), getAllTrips()]);
      setTicket(t);
      setTrips(allTrips);
      if (t) {
        setCategory(t.category);
        setTitle(t.title);
        setUseDate(t.useDate ?? '');
        setOrigin(t.origin ?? '');
        setDestination(t.destination ?? '');
        setSeat(t.seat ?? '');
        setAmount(t.amount != null ? String(t.amount) : '');
        setCurrency(t.currency ?? 'KRW');
        setMemo(t.memo ?? '');
        setTripId(t.tripId);
      }
    } catch (err) {
      console.error('[티켓 로드 실패]', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = () => {
    Alert.alert('티켓 삭제', '이 티켓을 삭제할까요? (사진도 함께 삭제됩니다)', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTicket(ticketId);
            haptic.success();
            router.back();
          } catch (err) {
            console.error('[티켓 삭제 실패]', err);
            Alert.alert('삭제 실패', '잠시 후 다시 시도해주세요');
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      haptic.warning();
      Alert.alert('알림', '제목을 입력해주세요');
      return;
    }
    setSaving(true);
    try {
      await updateTicket(ticketId, {
        category,
        title: title.trim(),
        useDate: useDate.trim() || null,
        origin: showsRoute && origin.trim() ? origin.trim().toUpperCase() : null,
        destination: showsRoute && destination.trim() ? destination.trim().toUpperCase() : null,
        seat: seat.trim() || null,
        amount: amount ? parseFloat(amount.replace(/,/g, '')) : null,
        currency: amount ? currency : null,
        memo: memo.trim() || null,
        tripId,
      });
      haptic.success();
      setEditing(false);
      await load();
    } catch (err) {
      console.error('[티켓 수정 실패]', err);
      Alert.alert('저장 실패', '잠시 후 다시 시도해주세요');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    if (!ticket) return;
    setEditing(false);
    setCategory(ticket.category);
    setTitle(ticket.title);
    setUseDate(ticket.useDate ?? '');
    setOrigin(ticket.origin ?? '');
    setDestination(ticket.destination ?? '');
    setSeat(ticket.seat ?? '');
    setAmount(ticket.amount != null ? String(ticket.amount) : '');
    setCurrency(ticket.currency ?? 'KRW');
    setMemo(ticket.memo ?? '');
    setTripId(ticket.tripId);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!ticket) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🤷</Text>
          <Text style={styles.emptyTitle}>티켓을 찾을 수 없어요</Text>
          <Pressable style={styles.emptyButton} onPress={() => router.back()}>
            <Text style={styles.emptyButtonText}>돌아가기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const cat = TICKET_CATEGORIES.find((c) => c.key === ticket.category);
  const tripTitle = ticket.tripId ? trips.find((t) => t.id === ticket.tripId)?.title : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => { haptic.tap(); router.back(); }} hitSlop={10} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>티켓 상세</Text>
          <View style={styles.headerActions}>
            {editing ? (
              <Pressable onPress={cancelEdit} hitSlop={10} style={styles.headerActionBtn}>
                <Text style={styles.headerActionText}>취소</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  onPress={() => { haptic.tap(); setEditing(true); }}
                  hitSlop={10}
                  style={styles.headerActionBtn}
                >
                  <Text style={styles.headerActionText}>편집</Text>
                </Pressable>
                <Pressable
                  onPress={handleDelete}
                  hitSlop={10}
                  style={styles.headerActionBtn}
                >
                  <Text style={[styles.headerActionText, { color: colors.error }]}>삭제</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 큰 이미지 (탭하면 풀스크린) */}
          <Pressable
            onPress={() => {
              haptic.tap();
              router.push({ pathname: '/tickets/[id]/preview', params: { id: String(ticketId) } });
            }}
          >
            <Image source={{ uri: ticket.imageUri }} style={styles.heroImage} resizeMode="cover" />
            <View style={styles.heroOverlay}>
              <Text style={styles.heroOverlayText}>🔍 탭하여 확대</Text>
            </View>
          </Pressable>

          {!editing ? (
            // 보기 모드
            <View style={styles.viewBlock}>
              <Text style={styles.viewCategory}>{cat?.icon} {cat?.label}</Text>
              <Text style={styles.viewTitle}>{ticket.title}</Text>

              <View style={styles.metaList}>
                {ticket.useDate && <MetaRow icon="📅" label={ticket.useDate} styles={styles} />}
                {ticket.origin && ticket.destination && (
                  <MetaRow
                    icon={ticket.category === 'flight' ? '🛫' : ticket.category === 'train' ? '🚄' : '🚌'}
                    label={`${ticket.origin}  →  ${ticket.destination}`}
                    styles={styles}
                  />
                )}
                {ticket.seat && <MetaRow icon="💺" label={ticket.seat} styles={styles} />}
                {ticket.amount != null && (
                  <MetaRow
                    icon="💰"
                    label={`${ticket.amount.toLocaleString()} ${ticket.currency ?? ''}`}
                    styles={styles}
                  />
                )}
                {tripTitle && <MetaRow icon="🧳" label={tripTitle} styles={styles} />}
              </View>

              {ticket.memo && (
                <View style={styles.memoBox}>
                  <Text style={styles.memoLabel}>메모</Text>
                  <Text style={styles.memoText}>{ticket.memo}</Text>
                </View>
              )}

              {ticket.ocrText && (
                <View style={styles.ocrBox}>
                  <Text style={styles.memoLabel}>OCR 인식 텍스트</Text>
                  <Text style={styles.ocrText} numberOfLines={6}>{ticket.ocrText}</Text>
                </View>
              )}
            </View>
          ) : (
            // 편집 모드
            <View>
              <Field label="카테고리" styles={styles}>
                <View style={styles.catGrid}>
                  {TICKET_CATEGORIES.map((c) => (
                    <Pressable
                      key={c.key}
                      style={[styles.catChip, category === c.key && styles.catChipActive]}
                      onPress={() => { haptic.select(); setCategory(c.key); }}
                    >
                      <Text style={[styles.catChipText, category === c.key && styles.catChipTextActive]}>
                        {c.icon} {c.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Field>

              <Field label="제목 *" styles={styles}>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="제목"
                  placeholderTextColor={colors.textTertiary}
                />
              </Field>

              <Field label="사용일" styles={styles}>
                <TextInput
                  style={styles.input}
                  value={useDate}
                  onChangeText={setUseDate}
                  placeholder="2026-04-15"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numbers-and-punctuation"
                />
              </Field>

              {showsRoute && (
                <View style={styles.row}>
                  <Field label="출발지" styles={styles} compact>
                    <TextInput
                      style={styles.input}
                      value={origin}
                      onChangeText={setOrigin}
                      autoCapitalize="characters"
                    />
                  </Field>
                  <View style={{ width: Spacing.md }} />
                  <Field label="도착지" styles={styles} compact>
                    <TextInput
                      style={styles.input}
                      value={destination}
                      onChangeText={setDestination}
                      autoCapitalize="characters"
                    />
                  </Field>
                </View>
              )}

              <Field label="좌석" styles={styles}>
                <TextInput
                  style={styles.input}
                  value={seat}
                  onChangeText={setSeat}
                  autoCapitalize="characters"
                />
              </Field>

              <Field label="금액" styles={styles}>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 2 }]}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                  />
                  <View style={{ width: Spacing.sm }} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 3 }}>
                    {CURRENCIES.map((cur) => (
                      <Pressable
                        key={cur}
                        style={[styles.currencyChip, currency === cur && styles.currencyChipActive]}
                        onPress={() => { haptic.select(); setCurrency(cur); }}
                      >
                        <Text style={[styles.currencyChipText, currency === cur && styles.currencyChipTextActive]}>
                          {cur}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </Field>

              <Field label="관련 여행" styles={styles}>
                <Pressable
                  style={styles.tripSelect}
                  onPress={() => { haptic.tap(); setTripPickerOpen((v) => !v); }}
                >
                  <Text style={[styles.tripSelectText, !tripId && styles.tripSelectPlaceholder]}>
                    {tripId
                      ? trips.find((t) => t.id === tripId)?.title ?? '여행 선택'
                      : '연결 안 함'}
                  </Text>
                  <Text style={styles.tripSelectArrow}>▾</Text>
                </Pressable>
                {tripPickerOpen && (
                  <View style={styles.tripDropdown}>
                    <Pressable
                      style={styles.tripOption}
                      onPress={() => { haptic.select(); setTripId(null); setTripPickerOpen(false); }}
                    >
                      <Text style={styles.tripOptionText}>
                        {!tripId ? '✓ ' : '   '}연결 안 함
                      </Text>
                    </Pressable>
                    {trips.map((t) => (
                      <Pressable
                        key={t.id}
                        style={styles.tripOption}
                        onPress={() => { haptic.select(); setTripId(t.id); setTripPickerOpen(false); }}
                      >
                        <Text style={styles.tripOptionText}>
                          {tripId === t.id ? '✓ ' : '   '}{t.title}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </Field>

              <Field label="메모" styles={styles}>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={memo}
                  onChangeText={setMemo}
                  placeholder="메모"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                />
              </Field>
            </View>
          )}

          <View style={{ height: Spacing.huge }} />
        </ScrollView>

        {editing && (
          <View style={styles.footer}>
            <Pressable
              style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>저장</Text>
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MetaRow({ icon, label, styles }: {
  icon: string;
  label: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaIcon}>{icon}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

function Field({ label, children, styles, compact }: {
  label: string;
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
  compact?: boolean;
}) {
  return (
    <View style={[styles.field, compact && { flex: 1 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    emptyIcon: { fontSize: 48 },
    emptyTitle: { fontSize: Typography.titleMedium, fontWeight: '700', color: c.textPrimary },
    emptyButton: {
      backgroundColor: c.primary,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xl,
      borderRadius: 999,
    },
    emptyButtonText: { color: c.textOnPrimary, fontWeight: '700' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backText: { fontSize: 24, color: c.textPrimary },
    headerTitle: { fontSize: Typography.bodyLarge, fontWeight: '700', color: c.textPrimary },
    headerActions: { flexDirection: 'row', gap: Spacing.sm },
    headerActionBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
    headerActionText: { fontSize: Typography.bodyMedium, color: c.primary, fontWeight: '600' },
    scroll: { padding: Spacing.lg },
    heroImage: {
      width: '100%',
      height: 320,
      borderRadius: 14,
      backgroundColor: c.surfaceAlt,
    },
    heroOverlay: {
      position: 'absolute',
      bottom: Spacing.md,
      right: Spacing.md,
      backgroundColor: '#000A',
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.md,
      borderRadius: 999,
    },
    heroOverlayText: { color: '#FFF', fontSize: Typography.labelSmall, fontWeight: '700' },
    viewBlock: { marginTop: Spacing.xl },
    viewCategory: {
      fontSize: Typography.labelSmall,
      color: c.accent,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: Spacing.xs,
    },
    viewTitle: {
      fontFamily: Fonts.bodyKrBold,
      fontSize: Typography.titleLarge,
      color: c.textPrimary,
      marginBottom: Spacing.lg,
    },
    metaList: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: Spacing.md,
      gap: Spacing.sm,
      borderWidth: 1,
      borderColor: c.border,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    metaIcon: { fontSize: 18, width: 24 },
    metaLabel: { fontSize: Typography.bodyMedium, color: c.textPrimary, flex: 1 },
    memoBox: {
      marginTop: Spacing.lg,
      padding: Spacing.md,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    memoLabel: {
      fontSize: Typography.labelSmall,
      color: c.accent,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: Spacing.xs,
    },
    memoText: {
      fontSize: Typography.bodyMedium,
      color: c.textPrimary,
      lineHeight: Typography.bodyMedium * 1.6,
    },
    ocrBox: {
      marginTop: Spacing.md,
      padding: Spacing.md,
      backgroundColor: c.surfaceAlt,
      borderRadius: 12,
    },
    ocrText: {
      fontSize: Typography.bodySmall,
      color: c.textTertiary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    field: { marginTop: Spacing.lg },
    fieldLabel: {
      fontFamily: Fonts.bodyEnSemiBold,
      fontSize: Typography.labelSmall,
      color: c.accent,
      letterSpacing: Typography.letterSpacingWide,
      marginBottom: Spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: c.surface,
      color: c.textPrimary,
      fontSize: Typography.bodyMedium,
    },
    textarea: { minHeight: 80, textAlignVertical: 'top' },
    row: { flexDirection: 'row', alignItems: 'center' },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    catChip: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    catChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    catChipText: { fontSize: Typography.bodyMedium, color: c.textSecondary },
    catChipTextActive: { color: c.textOnPrimary, fontWeight: '700' },
    currencyChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      marginRight: Spacing.xs,
    },
    currencyChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    currencyChipText: { fontSize: Typography.labelSmall, color: c.textSecondary },
    currencyChipTextActive: { color: c.textOnPrimary, fontWeight: '700' },
    tripSelect: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      backgroundColor: c.surface,
    },
    tripSelectText: { fontSize: Typography.bodyMedium, color: c.textPrimary, flex: 1 },
    tripSelectPlaceholder: { color: c.textTertiary },
    tripSelectArrow: { fontSize: Typography.bodyMedium, color: c.textTertiary },
    tripDropdown: {
      marginTop: Spacing.xs,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      ...Shadows.medium,
      maxHeight: 220,
    },
    tripOption: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
    tripOptionText: { fontSize: Typography.bodyMedium, color: c.textPrimary },
    footer: {
      padding: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    primaryButton: {
      backgroundColor: c.primary,
      paddingVertical: Spacing.lg,
      borderRadius: 14,
      alignItems: 'center',
    },
    primaryButtonDisabled: { backgroundColor: c.textTertiary },
    primaryButtonText: {
      color: c.textOnPrimary,
      fontWeight: '700',
      fontSize: Typography.bodyLarge,
    },
  });
}
