import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { theme } from '../theme';

// 백엔드: GET /api/news/fetch?category=all → { news: [{title, url, source, category, publishedAt}] }
export function NewsScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.get('/api/news/fetch?category=all');
      setItems(Array.isArray(data?.news) ? data.news : []);
    } catch (e) {
      setError(e.message || '불러오기 실패');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openLink(url) {
    if (!url) return;
    Linking.openURL(url).catch(() => Alert.alert('열기 실패', '링크를 열 수 없습니다.'));
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.accent} />}
      >
        <Text style={styles.title}>뉴스</Text>

        {error && <Text style={styles.error}>⚠️ {error}</Text>}

        {items.length === 0 && !error && (
          <Text style={styles.empty}>표시할 뉴스가 없습니다.</Text>
        )}

        {items.map((it, idx) => {
          const url = it.url || it.link;
          return (
            <TouchableOpacity key={url || idx} style={styles.card} onPress={() => openLink(url)}>
              <Text style={styles.headline} numberOfLines={3}>{it.title || '(제목 없음)'}</Text>
              <View style={styles.meta}>
                {it.source && <Text style={styles.source}>{it.source}</Text>}
                {it.publishedAt && <Text style={styles.time}>{formatTime(it.publishedAt)}</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  title: { color: theme.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  error: { color: theme.red, marginBottom: 12 },
  empty: { color: theme.subtext, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  headline: { color: theme.text, fontSize: 15, fontWeight: '600', lineHeight: 22 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  source: { color: theme.accent, fontSize: 12 },
  time: { color: theme.subtext, fontSize: 12 },
});
