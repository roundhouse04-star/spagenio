import { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Typography, Spacing, Shadows } from '@/theme/theme';
import { useTheme, type ColorPalette } from '@/theme/ThemeProvider';
import { getAllTrips, createTrip } from '@/db/trips';
import { createTripItem } from '@/db/items';
import DatePickerModal from '@/components/DatePickerModal';
import { Trip, TripItemCategory } from '@/types';
import { parseAiItinerary, AiJsonParseError } from '@/utils/aiJsonParser';

const TRIP_ITEM_CATEGORY_VALUES: readonly TripItemCategory[] = [
  'sightseeing', 'food', 'activity', 'accommodation', 'transport', 'shopping', 'other',
];
function normalizeTripItemCategory(v: unknown): TripItemCategory {
  return TRIP_ITEM_CATEGORY_VALUES.includes(v as TripItemCategory)
    ? (v as TripItemCategory)
    : 'other';
}

// 관심사 6개 고정
const INTEREST_PRESETS = [
  { key: 'food', label: '🍽️ 맛집' },
  { key: 'photo', label: '📸 사진' },
  { key: 'shopping', label: '🛍️ 쇼핑' },
  { key: 'nature', label: '🌿 자연' },
  { key: 'history', label: '🏛️ 역사' },
  { key: 'activity', label: '🎢 액티비티' },
];

// AI 앱 딥링크
const AI_APPS = [
  {
    key: 'chatgpt',
    label: 'ChatGPT',
    icon: '💬',
    color: '#10A37F',
    schemes: ['chatgpt://', 'https://chat.openai.com'],
  },
  {
    key: 'claude',
    label: 'Claude',
    icon: '🧠',
    color: '#D97757',
    schemes: ['claude://', 'https://claude.ai'],
  },
  {
    key: 'gemini',
    label: 'Gemini',
    icon: '✨',
    color: '#4285F4',
    schemes: ['https://gemini.google.com/app'],
  },
];

export default function AiItineraryScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [targetMode, setTargetMode] = useState<'new' | 'existing'>('new');
  const [existingTripId, setExistingTripId] = useState<number | null>(null);

  // 새 여행 정보
  const [title, setTitle] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');

  // 관심사
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['food']);
  const [customInterests, setCustomInterests] = useState<string[]>([]);
  const [newCustomInterest, setNewCustomInterest] = useState('');

  // 특별 요청
  const [specialNote, setSpecialNote] = useState('');

  // 단계 (1: 폼, 2: 답변 붙여넣기)
  const [step, setStep] = useState<1 | 2>(1);
  const [aiResponse, setAiResponse] = useState('');
  const [parsing, setParsing] = useState(false);

  // 날짜 피커
  const [datePickerVisible, setDatePickerVisible] = useState<'start' | 'end' | null>(null);

  useFocusEffect(
    useCallback(() => {
      getAllTrips()
        .then((all) => {
          // 최신순 정렬 (created/updated 모두 안전하게)
          const sorted = [...all].sort((a, b) => {
            const aDate = a.updatedAt || a.createdAt || '';
            const bDate = b.updatedAt || b.createdAt || '';
            return bDate.localeCompare(aDate);
          });
          setTrips(sorted);
          // 기존 모드인데 선택된 게 없으면 자동 선택 (UX 개선)
          if (targetMode === 'existing' && !existingTripId && sorted.length > 0) {
            setExistingTripId(sorted[0].id);
          }
        })
        .catch(console.error);
    }, [targetMode, existingTripId])
  );

  const toggleInterest = (key: string) => {
    setSelectedInterests((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const addCustomInterest = () => {
    const v = newCustomInterest.trim();
    if (!v) return;
    if (customInterests.includes(v)) return;
    if (customInterests.length >= 5) {
      Alert.alert('알림', '기타 관심사는 5개까지 추가할 수 있어요');
      return;
    }
    setCustomInterests([...customInterests, v]);
    setSelectedInterests([...selectedInterests, `custom:${v}`]);
    setNewCustomInterest('');
  };

  const removeCustomInterest = (v: string) => {
    setCustomInterests(customInterests.filter((c) => c !== v));
    setSelectedInterests(selectedInterests.filter((k) => k !== `custom:${v}`));
  };

  const getTargetInfo = () => {
    if (targetMode === 'existing' && existingTripId) {
      const t = trips.find((x) => x.id === existingTripId);
      if (!t) return null;
      return {
        title: t.title,
        country: t.country || '',
        city: t.city || '',
        startDate: t.startDate || '',
        endDate: t.endDate || '',
        budget: t.budget || 0,
      };
    }
    return {
      title: title.trim(),
      country: country.trim(),
      city: city.trim(),
      startDate,
      endDate,
      budget: Number(budget) || 0,
    };
  };

  // 프롬프트 생성
  const buildPrompt = (): string => {
    const info = getTargetInfo();
    if (!info) return '';

    const interestLabels = [
      ...selectedInterests
        .filter((k) => !k.startsWith('custom:'))
        .map((k) => INTEREST_PRESETS.find((p) => p.key === k)?.label || '')
        .filter(Boolean),
      ...customInterests,
    ].join(', ');

    const totalDays = calculateDays(info.startDate, info.endDate);

    return `아래 조건으로 ${totalDays}일 여행 일정을 JSON 형식으로만 답해주세요. 설명이나 마크다운 없이 순수 JSON만 출력하세요.

여행 정보:
- 제목: ${info.title}
- 국가: ${info.country}
- 도시: ${info.city}
- 기간: ${info.startDate} ~ ${info.endDate} (${totalDays}일)
- 예산: ${info.budget.toLocaleString()}원
- 관심사: ${interestLabels || '자유롭게'}
${specialNote ? `- 특별 요청: ${specialNote}` : ''}

JSON 형식:
{
  "items": [
    {
      "day": 1,
      "startTime": "10:00",
      "title": "일정 제목",
      "location": "장소 이름",
      "category": "attraction",
      "memo": "일정 설명이나 팁",
      "cost": 0
    }
  ]
}

규칙:
- category는 반드시 다음 중 하나: "attraction"(관광), "food"(식사), "activity"(액티비티), "hotel"(숙소), "transport"(이동), "shopping"(쇼핑), "other"(기타)
- day는 1부터 ${totalDays}까지
- startTime은 "HH:MM" 형식
- cost는 1인 기준 원화(KRW)
- 하루 4~6개 일정
- 동선이 효율적이도록 배치
- memo에는 구체적인 팁, 주의사항, 소요시간 등 포함
- JSON 외 다른 텍스트는 절대 포함하지 마세요`;
  };

  // 프롬프트 복사 + AI 앱 열기
  const handleOpenAi = async (app: (typeof AI_APPS)[0]) => {
    // 모드별 검증
    if (targetMode === 'existing') {
      if (!existingTripId) {
        Alert.alert('알림', '여행을 선택해주세요');
        return;
      }
      const t = trips.find((x) => x.id === existingTripId);
      if (!t) {
        Alert.alert('알림', '선택한 여행을 찾을 수 없어요. 다시 시도해주세요.');
        return;
      }
      // 기존 여행은 제목/날짜가 DB에 저장돼있을 가능성 높지만 빈 필드도 허용 (사용자가 임시로 만든 여행일 수도)
      const missing: string[] = [];
      if (!t.title) missing.push('제목');
      if (!t.startDate) missing.push('출발일');
      if (!t.endDate) missing.push('도착일');
      if (missing.length > 0) {
        Alert.alert(
          '여행 정보 부족',
          `선택한 여행에 ${missing.join(', ')}이(가) 없어요. 여행 상세에서 정보를 채워주세요.`
        );
        return;
      }
    } else {
      // 새 여행 - 입력란 검증
      const missing: string[] = [];
      if (!title.trim()) missing.push('제목');
      if (!startDate) missing.push('출발일');
      if (!endDate) missing.push('도착일');
      if (missing.length > 0) {
        Alert.alert(
          '입력 부족',
          `${missing.join(', ')}을(를) 입력해주세요.`
        );
        return;
      }
    }

    const info = getTargetInfo();
    if (!info) {
      Alert.alert('알림', '여행 정보를 가져오지 못했어요.');
      return;
    }

    const prompt = buildPrompt();
    try {
      await Clipboard.setStringAsync(prompt);
    } catch (err) {
      console.error('[클립보드 복사 실패]', err);
    }

    // 사용 가능한 scheme 찾기 (외부 앱 열기 전에 미리 확인만)
    let availableScheme: string | null = null;
    for (const scheme of app.schemes) {
      try {
        const can = await Linking.canOpenURL(scheme);
        if (can) {
          availableScheme = scheme;
          break;
        }
      } catch (err) {
        console.warn(`[${scheme}] canOpenURL 실패:`, err);
      }
    }

    if (!availableScheme) {
      Alert.alert('앱 열기 실패', `${app.label} 앱이나 웹을 열 수 없어요.`);
      return;
    }

    // ⭐ 외부 앱 열기 전에 안내 Alert 먼저 띄움
    // 사용자가 "AI 앱 열기" 눌러야 그제서야 이동 (붙여넣기 준비할 시간 확보)
    Alert.alert(
      '✅ 프롬프트 복사 완료!',
      `${app.label}이(가) 열리면 대화창을 길게 눌러 붙여넣기(📋)하고 전송해주세요.\n\n답변을 받으면 다시 이 화면으로 돌아와 "답변 붙여넣기"를 눌러주세요.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: `${app.label} 열기`,
          onPress: async () => {
            try {
              await Linking.openURL(availableScheme!);
            } catch (err) {
              console.warn(`[${availableScheme}] openURL 실패:`, err);
              Alert.alert('앱 열기 실패', `${app.label}을(를) 열 수 없어요.`);
            }
          },
        },
      ]
    );
  };

  // AI 답변 파싱
  const handleParseResponse = async () => {
    if (!aiResponse.trim()) {
      Alert.alert('알림', '답변을 붙여넣어주세요');
      return;
    }

    setParsing(true);
    try {
      // 견고한 AI JSON 파서 — trailing comma / 주석 / 키 alias / 스마트 따옴표 등
      // 다양한 어긋난 형식을 자동 보정해서 처리.
      const parsed = parseAiItinerary(aiResponse);

      // 대상 여행 결정
      let tripId: number;
      if (targetMode === 'existing' && existingTripId) {
        tripId = existingTripId;
      } else {
        const info = getTargetInfo();
        if (!info) throw new AiJsonParseError('여행 정보가 없어요');
        tripId = await createTrip({
          title: info.title,
          country: info.country,
          city: info.city,
          startDate: info.startDate,
          endDate: info.endDate,
          budget: info.budget,
          currency: 'KRW',
          status: 'planning',
        });
      }

      // 일정 추가 — parser 가 이미 정규화한 값이라 안전하게 저장
      let addedCount = 0;
      for (const item of parsed.items) {
        try {
          await createTripItem({
            tripId,
            day: item.day,
            startTime: item.startTime,
            title: item.title,
            location: item.location,
            category: normalizeTripItemCategory(item.category),
            memo: item.memo,
            cost: item.cost,
            currency: 'KRW',
          });
          addedCount++;
        } catch (err) {
          // 개별 항목 저장 실패는 silent — 나머지 항목 계속 진행
          console.error('[일정 저장 실패]', err, item);
        }
      }

      Alert.alert(
        '✨ 성공!',
        `${addedCount}개의 일정이 추가되었어요!`,
        [
          {
            text: '확인',
            style: 'cancel',
            onPress: () => {
              // 답변 초기화하고 step 1로 돌아감 (또는 화면 닫기)
              setAiResponse('');
              setStep(1);
            },
          },
          {
            text: '일정 보러 가기',
            onPress: () => {
              router.replace({
                pathname: '/trip/[id]',
                params: { id: String(tripId) },
              });
            },
          },
        ]
      );
    } catch (err) {
      console.error('[파싱 실패]', err);
      // AiJsonParseError 는 사용자 친화 메시지를 이미 포함하고 있음
      const message =
        err instanceof AiJsonParseError
          ? err.message
          : `답변 형식이 올바르지 않아요.\n\n${(err as Error).message}\n\nAI에게 "JSON 형식으로만 답해줘"라고 다시 요청해보세요.`;
      Alert.alert('파싱 실패', message);
    } finally {
      setParsing(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (step === 2) setStep(1);
            else router.back();
          }}
          style={styles.headerBtn}
          hitSlop={10}
        >
          <Text style={styles.cancelText}>{step === 2 ? '← 이전' : '취소'}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {step === 1 ? '🤖 AI 일정 만들기' : '📥 답변 붙여넣기'}
        </Text>
        {step === 2 ? (
          <Pressable
            onPress={handleParseResponse}
            style={styles.headerBtn}
            hitSlop={10}
            disabled={parsing || !aiResponse.trim()}
          >
            <Text style={[
              styles.saveText,
              (parsing || !aiResponse.trim()) && { opacity: 0.4 },
            ]}>
              {parsing ? '저장 중…' : '저장'}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 ? (
          <>
            {/* 안내 */}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                ✨ 여행 정보를 입력하고 AI에게 일정을 요청하세요. 프롬프트가 자동 복사되고 AI 앱이 열려요.
              </Text>
            </View>

            {/* 대상 선택 */}
            <View style={styles.field}>
              <Text style={styles.label}>어디에 추가할까요?</Text>
              <View style={styles.row}>
                <Pressable
                  style={[
                    styles.modeBtn,
                    targetMode === 'new' && styles.modeBtnActive,
                  ]}
                  onPress={() => setTargetMode('new')}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      targetMode === 'new' && styles.modeBtnTextActive,
                    ]}
                  >
                    ✨ 새 여행
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modeBtn,
                    targetMode === 'existing' && styles.modeBtnActive,
                  ]}
                  onPress={() => {
                    setTargetMode('existing');
                    // 모드 전환 시 첫 번째 여행 자동 선택
                    if (!existingTripId && trips.length > 0) {
                      setExistingTripId(trips[0].id);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      targetMode === 'existing' && styles.modeBtnTextActive,
                    ]}
                  >
                    📂 기존 여행
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* 기존 여행 선택 */}
            {targetMode === 'existing' && (
              <View style={styles.field}>
                <Text style={styles.label}>여행 선택</Text>
                {trips.length === 0 ? (
                  <Text style={styles.emptyText}>
                    저장된 여행이 없어요.{'\n'}{'"'}새 여행{'"'}을 선택해주세요.
                  </Text>
                ) : (
                  <View style={styles.tripList}>
                    {trips.map((t) => (
                      <Pressable
                        key={t.id}
                        style={[
                          styles.tripItem,
                          existingTripId === t.id && styles.tripItemActive,
                        ]}
                        onPress={() => setExistingTripId(t.id)}
                      >
                        <Text
                          style={[
                            styles.tripItemTitle,
                            existingTripId === t.id && styles.tripItemTitleActive,
                          ]}
                        >
                          {t.title}
                        </Text>
                        <Text style={[
                          styles.tripItemDate,
                          existingTripId === t.id && styles.tripItemDateActive,
                        ]}>
                          {t.startDate ?? '날짜 미정'} ~ {t.endDate ?? ''}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* 새 여행 정보 입력 */}
            {targetMode === 'new' && (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>
                    여행 제목 <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="예: 도쿄 여행"
                    placeholderTextColor={colors.textTertiary}
                    value={title}
                    onChangeText={setTitle}
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.label}>국가</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="일본"
                      placeholderTextColor={colors.textTertiary}
                      value={country}
                      onChangeText={setCountry}
                    />
                  </View>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.label}>도시</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="도쿄"
                      placeholderTextColor={colors.textTertiary}
                      value={city}
                      onChangeText={setCity}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.label}>
                      출발일 <Text style={styles.required}>*</Text>
                    </Text>
                    <Pressable
                      style={styles.input}
                      onPress={() => setDatePickerVisible('start')}
                    >
                      <Text
                        style={[
                          styles.inputText,
                          !startDate && { color: colors.textTertiary },
                        ]}
                      >
                        {startDate || 'YYYY-MM-DD'}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.label}>
                      도착일 <Text style={styles.required}>*</Text>
                    </Text>
                    <Pressable
                      style={styles.input}
                      onPress={() => setDatePickerVisible('end')}
                    >
                      <Text
                        style={[
                          styles.inputText,
                          !endDate && { color: colors.textTertiary },
                        ]}
                      >
                        {endDate || 'YYYY-MM-DD'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>예산 (KRW)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="2000000"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                    value={budget}
                    onChangeText={setBudget}
                  />
                </View>
              </>
            )}

            {/* 관심사 */}
            <View style={styles.field}>
              <Text style={styles.label}>관심사 (여러 개 선택)</Text>
              <View style={styles.interestGrid}>
                {INTEREST_PRESETS.map((p) => (
                  <Pressable
                    key={p.key}
                    onPress={() => toggleInterest(p.key)}
                    style={[
                      styles.interestChip,
                      selectedInterests.includes(p.key) && styles.interestChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.interestChipText,
                        selectedInterests.includes(p.key) && styles.interestChipTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                ))}
                {customInterests.map((v) => (
                  <Pressable
                    key={v}
                    onLongPress={() => {
                      Alert.alert('삭제하시겠어요?', v, [
                        { text: '취소', style: 'cancel' },
                        {
                          text: '삭제',
                          style: 'destructive',
                          onPress: () => removeCustomInterest(v),
                        },
                      ]);
                    }}
                    onPress={() => toggleInterest(`custom:${v}`)}
                    style={[
                      styles.interestChip,
                      styles.interestChipCustom,
                      selectedInterests.includes(`custom:${v}`) && styles.interestChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.interestChipText,
                        selectedInterests.includes(`custom:${v}`) && styles.interestChipTextActive,
                      ]}
                    >
                      🏷️ {v}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.helpText}>기타 관심사는 길게 눌러 삭제</Text>

              {/* 기타 추가 */}
              <View style={[styles.row, { marginTop: Spacing.sm }]}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="기타 관심사 추가 (예: 애니 성지)"
                  placeholderTextColor={colors.textTertiary}
                  value={newCustomInterest}
                  onChangeText={setNewCustomInterest}
                  onSubmitEditing={addCustomInterest}
                  returnKeyType="done"
                />
                <Pressable onPress={addCustomInterest} style={styles.addBtn}>
                  <Text style={styles.addBtnText}>추가</Text>
                </Pressable>
              </View>
            </View>

            {/* 특별 요청 */}
            <View style={styles.field}>
              <Text style={styles.label}>특별 요청 (선택)</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="예: 아이와 함께, 걷기 많이 하기, 아침형 일정"
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
                value={specialNote}
                onChangeText={setSpecialNote}
              />
            </View>

            {/* AI 앱 선택 */}
            <View style={styles.field}>
              <Text style={styles.label}>🤖 어떤 AI를 사용할까요?</Text>
              <Text style={styles.helpText}>
                버튼 탭 → 프롬프트 자동 복사 + AI 앱 열림
              </Text>
              <View style={styles.aiGrid}>
                {AI_APPS.map((app) => (
                  <Pressable
                    key={app.key}
                    onPress={() => handleOpenAi(app)}
                    style={[styles.aiBtn, { backgroundColor: app.color }]}
                  >
                    <Text style={styles.aiBtnIcon}>{app.icon}</Text>
                    <Text style={styles.aiBtnText}>{app.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* 답변 붙여넣기 이동 */}
            <Pressable style={styles.pasteBtn} onPress={() => setStep(2)}>
              <Text style={styles.pasteBtnText}>
                📥 답변 받으셨나요? 붙여넣기
              </Text>
            </Pressable>

            <View style={{ height: 40 }} />
          </>
        ) : (
          <>
            {/* Step 2: 답변 붙여넣기 */}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                AI에게서 받은 답변을 아래에 붙여넣어주세요.{'\n'}
                {'\n'}
                🔹 마크다운 코드블록(```json ```) 있어도 자동 처리{'\n'}
                🔹 설명 섞여있어도 JSON만 추출해서 일정 추가{'\n'}
                🔹 답변이 길면 위쪽 {'"'}저장{'"'} 버튼을 눌러도 됩니다
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                AI 답변 {aiResponse.length > 0 && `(${aiResponse.length}자)`}
              </Text>
              <TextInput
                style={[styles.input, styles.bigTextarea]}
                placeholder={'{\n  "items": [\n    { "day": 1, "title": "..." }\n  ]\n}'}
                placeholderTextColor={colors.textTertiary}
                multiline
                value={aiResponse}
                onChangeText={setAiResponse}
                textAlignVertical="top"
                scrollEnabled={true}
              />
            </View>

            <Pressable
              style={[styles.submitBtn, (parsing || !aiResponse.trim()) && { opacity: 0.5 }]}
              onPress={handleParseResponse}
              disabled={parsing || !aiResponse.trim()}
            >
              {parsing ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.submitBtnText}>
                  💾 일정 저장하기
                </Text>
              )}
            </Pressable>

            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>

      {/* 날짜 피커 */}
      {datePickerVisible && (
        <DatePickerModal
          visible={!!datePickerVisible}
          value={datePickerVisible === 'start' ? startDate : endDate}
          minDate={datePickerVisible === 'end' ? startDate : undefined}
          title={datePickerVisible === 'start' ? '출발일 선택' : '도착일 선택'}
          onConfirm={(date) => {
            if (datePickerVisible === 'start') setStartDate(date);
            else setEndDate(date);
            setDatePickerVisible(null);
          }}
          onClose={() => setDatePickerVisible(null)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function calculateDays(start: string, end: string): number {
  if (!start || !end) return 1;
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.background,
  },
  headerBtn: { minWidth: 60, paddingVertical: 4 },
  headerTitle: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: c.textPrimary,
  },
  cancelText: {
    fontSize: Typography.bodyMedium,
    color: c.textSecondary,
  },
  saveText: {
    fontSize: Typography.bodyMedium,
    color: c.accent,
    fontWeight: '700',
    textAlign: 'right',
  },
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  field: { gap: Spacing.xs },
  label: {
    fontSize: Typography.labelMedium,
    fontWeight: '600',
    color: c.textPrimary,
  },
  required: { color: c.error },
  helpText: {
    fontSize: Typography.labelSmall,
    color: c.textTertiary,
  },
  input: {
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: Typography.bodyMedium,
    color: c.textPrimary,
    borderWidth: 1,
    borderColor: c.border,
  },
  inputText: {
    fontSize: Typography.bodyMedium,
    color: c.textPrimary,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  bigTextarea: {
    height: 280,
    maxHeight: 280,
    textAlignVertical: 'top'
  },
  row: { flexDirection: 'row', gap: Spacing.md },
  modeBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  modeBtnText: {
    fontSize: Typography.bodyMedium,
    fontWeight: '600',
    color: c.textPrimary,
  },
  modeBtnTextActive: { color: c.textOnPrimary },
  tripList: { gap: Spacing.sm },
  tripItem: {
    padding: Spacing.md,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  tripItemActive: {
    borderColor: c.primary,
    borderWidth: 2,
    backgroundColor: c.primary,
  },
  tripItemTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: c.textPrimary,
  },
  tripItemTitleActive: { color: c.textOnPrimary },
  tripItemDate: {
    fontSize: Typography.labelSmall,
    color: c.textSecondary,
    marginTop: 2,
  },
  tripItemDateActive: {
    color: c.textOnPrimary,
    opacity: 0.85,
  },
  emptyText: {
    fontSize: Typography.bodySmall,
    color: c.textTertiary,
    padding: Spacing.md,
    textAlign: 'center',
    lineHeight: Typography.bodySmall * 1.6,
  },
  interestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  interestChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  interestChipCustom: {
    backgroundColor: c.surfaceAlt,
    borderStyle: 'dashed',
  },
  interestChipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  interestChipText: {
    fontSize: Typography.labelMedium,
    color: c.textPrimary,
  },
  interestChipTextActive: {
    color: c.textOnPrimary,
    fontWeight: '700',
  },
  addBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: c.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: c.textOnPrimary,
    fontWeight: '700',
  },
  aiGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  aiBtn: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...Shadows.soft,
  },
  aiBtnIcon: { fontSize: 28 },
  aiBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: Typography.bodyMedium,
  },
  pasteBtn: {
    marginTop: Spacing.sm,
    padding: Spacing.lg,
    backgroundColor: c.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: c.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  pasteBtnText: {
    color: c.primary,
    fontWeight: '700',
    fontSize: Typography.bodyMedium,
  },
  infoBox: {
    padding: Spacing.md,
    backgroundColor: c.surfaceAlt,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: c.accent,
  },
  infoText: {
    fontSize: Typography.bodySmall,
    color: c.textPrimary,
    lineHeight: Typography.bodySmall * 1.6,
  },
  submitBtn: {
    padding: Spacing.lg,
    backgroundColor: c.primary,
    borderRadius: 14,
    alignItems: 'center',
    ...Shadows.soft,
  },
  submitBtnText: {
    color: c.textOnPrimary,
    fontWeight: '700',
    fontSize: Typography.bodyLarge,
  },
});
}
