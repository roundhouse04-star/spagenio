/**
 * 관극 리포트 화면 — 연도별 통계, 카테고리 분포, 최애 아티스트 등.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { Colors, Fonts, FontSizes, Spacing, chipBg } from '@/theme/theme';
import { Divider } from '@/components/UI';
import { getAllTimeStats, getYearlyReport } from '@/db/stats';
import { iconForCategory } from '@/db/schema';
import type { YearlyReport, AllTimeStats } from '@/db/stats';

export default function ReportScreen() {
  const router = useRouter();
  const [allTime, setAllTime] = useState<AllTimeStats | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [report, setReport] = useState<YearlyReport | null>(null);

  const load = useCallback(async () => {
    const at = await getAllTimeStats();
    setAllTime(at);
    const targetYear = at.availableYears.includes(year)
      ? year
      : (at.availableYears[0] ?? new Date().getFullYear());
    setYear(targetYear);
    setReport(await getYearlyReport(targetYear));
  }, [year]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!allTime || !report) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: Colors.textSub }}>로딩 중…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (allTime.totalTickets === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
        <View style={styles.navBar}>
          <Pressable onPress={() => router.back()} hitSlop={8}><Text style={{ fontSize: 22 }}>‹</Text></Pressable>
          <Text style={styles.navTitle}>관극 리포트</Text>
          <View style={{ width: 22 }} />
        </View>
        <Divider />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl }}>
          <Text style={{ fontSize: 60, marginBottom: 16 }}>📊</Text>
          <Text style={{ fontFamily: Fonts.bold, fontSize: FontSizes.h2, marginBottom: 8 }}>
            아직 데이터가 없어요
          </Text>
          <Text style={{ color: Colors.textSub, textAlign: 'center' }}>
            티켓을 등록하면{'\n'}멋진 관극 리포트를 볼 수 있어요!
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const maxMonthCount = Math.max(...report.byMonth.map(m => m.count), 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={{ fontSize: 22 }}>‹</Text></Pressable>
        <Text style={styles.navTitle}>관극 리포트</Text>
        <View style={{ width: 22 }} />
      </View>
      <Divider />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {allTime.availableYears.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.yearPicker}>
            {allTime.availableYears.map(y => (
              <Pressable key={y} onPress={() => setYear(y)}
                         style={[styles.yearChip, y === year && styles.yearChipActive]}>
                <Text style={[styles.yearChipText, y === year && styles.yearChipTextActive]}>{y}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>{year}년 공연 결산</Text>
          <Text style={styles.heroCount}>{report.total}회</Text>
          <Text style={styles.heroSub}>
            평균 별점 {report.avgRating.toFixed(1)} · 총 지출 {formatWon(report.totalSpent)}
          </Text>
        </View>

        <Section title="카테고리">
          {report.byCategory.length > 0 ? report.byCategory.map(c => (
            <View key={c.category} style={styles.catRow}>
              <View style={[styles.catBadge, { backgroundColor: chipBg(c.category) }]}>
                <Text style={styles.catIcon}>{iconForCategory(c.category)}</Text>
                <Text style={styles.catName}>{c.category}</Text>
              </View>
              <View style={styles.catBarWrap}>
                <View style={[styles.catBar, { width: `${c.percent}%` }]} />
              </View>
              <Text style={styles.catCount}>{c.count}회</Text>
            </View>
          )) : <EmptySection />}
        </Section>

        <Section title="월별 관람">
          <View style={styles.monthChart}>
            {report.byMonth.map(m => {
              const heightPct = m.count > 0 ? (m.count / maxMonthCount) * 100 : 4;
              return (
                <View key={m.month} style={styles.monthBarWrap}>
                  <View style={[styles.monthBar, { height: `${heightPct}%` }]}>
                    {m.count > 0 && <Text style={styles.monthBarLabel}>{m.count}</Text>}
                  </View>
                  <Text style={styles.monthLabel}>{m.month}</Text>
                </View>
              );
            })}
          </View>
        </Section>

        <Section title="최애 아티스트">
          {report.topArtists.length > 0 ? report.topArtists.map((a, i) => (
            <View key={a.artistId} style={styles.rankRow}>
              <Text style={styles.rankNum}>{i + 1}</Text>
              <Text style={styles.rankName}>{a.name}</Text>
              <Text style={styles.rankCount}>{a.count}회</Text>
            </View>
          )) : <EmptySection />}
        </Section>

        {report.topVenues.length > 0 && (
          <Section title="자주 간 장소">
            {report.topVenues.map((v, i) => (
              <View key={v.venue} style={styles.rankRow}>
                <Text style={styles.rankNum}>{i + 1}</Text>
                <Text style={styles.rankName} numberOfLines={1}>{v.venue}</Text>
                <Text style={styles.rankCount}>{v.count}회</Text>
              </View>
            ))}
          </Section>
        )}

        <Section title="역대 기록">
          <View style={styles.allTimeRow}>
            <View style={styles.allTimeItem}>
              <Text style={styles.allTimeNum}>{allTime.totalTickets}</Text>
              <Text style={styles.allTimeLabel}>총 티켓</Text>
            </View>
            <View style={styles.allTimeItem}>
              <Text style={styles.allTimeNum}>{allTime.avgRating.toFixed(1)}</Text>
              <Text style={styles.allTimeLabel}>평균 별점</Text>
            </View>
            <View style={styles.allTimeItem}>
              <Text style={[styles.allTimeNum, { fontSize: 18 }]}>{formatWon(allTime.totalSpent)}</Text>
              <Text style={styles.allTimeLabel}>총 지출</Text>
            </View>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function EmptySection() {
  return <Text style={{ color: Colors.textFaint, paddingVertical: 8 }}>아직 기록이 없어요</Text>;
}

function formatWon(n: number): string {
  if (!n) return '0원';
  if (n >= 10000) {
    const man = Math.floor(n / 10000);
    const rest = n % 10000;
    if (rest === 0) return `${man.toLocaleString()}만원`;
    return `${man.toLocaleString()}만 ${rest.toLocaleString()}원`;
  }
  return `${n.toLocaleString()}원`;
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    height: 48,
  },
  navTitle: { fontSize: FontSizes.title, fontFamily: Fonts.semibold },
  yearPicker: { paddingHorizontal: Spacing.lg, paddingVertical: 10, gap: 8 },
  yearChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.bgMuted,
    marginRight: 8,
  },
  yearChipActive: { backgroundColor: '#000' },
  yearChipText: {
    fontSize: FontSizes.caption,
    fontFamily: Fonts.medium,
    color: Colors.textSub,
  },
  yearChipTextActive: { color: '#fff', fontFamily: Fonts.semibold },
  heroCard: {
    margin: Spacing.lg,
    padding: Spacing.xxl,
    backgroundColor: '#fff1f3',
    borderRadius: 16,
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: FontSizes.caption,
    color: '#a85577',
    marginBottom: 6,
  },
  heroCount: {
    fontSize: 48,
    fontFamily: Fonts.bold,
    color: '#e53e7a',
  },
  heroSub: {
    fontSize: FontSizes.caption,
    color: '#a85577',
    marginTop: 6,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSizes.body,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 10,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
    minWidth: 85,
  },
  catIcon: { fontSize: 14 },
  catName: { fontSize: FontSizes.caption, fontFamily: Fonts.semibold },
  catBarWrap: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.bgMuted,
    borderRadius: 4,
    overflow: 'hidden',
  },
  catBar: { height: '100%', backgroundColor: '#ff6b9d', borderRadius: 4 },
  catCount: {
    fontSize: FontSizes.caption,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    minWidth: 36,
    textAlign: 'right',
  },
  monthChart: {
    flexDirection: 'row',
    height: 140,
    gap: 4,
    alignItems: 'flex-end',
  },
  monthBarWrap: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  monthBar: {
    width: '100%',
    backgroundColor: '#ff6b9d',
    borderRadius: 4,
    minHeight: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  monthBarLabel: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: '#fff',
  },
  monthLabel: {
    fontSize: 10,
    color: Colors.textSub,
    marginTop: 4,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  rankNum: {
    fontSize: FontSizes.body,
    fontFamily: Fonts.bold,
    color: '#ff6b9d',
    width: 20,
  },
  rankName: {
    fontSize: FontSizes.body,
    fontFamily: Fonts.medium,
    color: Colors.text,
    flex: 1,
  },
  rankCount: {
    fontSize: FontSizes.caption,
    fontFamily: Fonts.semibold,
    color: Colors.textSub,
  },
  allTimeRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bgMuted,
    borderRadius: 10,
    paddingVertical: Spacing.lg,
  },
  allTimeItem: { flex: 1, alignItems: 'center' },
  allTimeNum: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  allTimeLabel: {
    fontSize: FontSizes.tiny,
    color: Colors.textSub,
    marginTop: 2,
  },
});
