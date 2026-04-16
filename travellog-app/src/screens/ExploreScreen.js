import { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Search } from 'lucide-react-native';
import { colors } from '../theme/colors';

const API_BASE = 'https://travel.spagenio.com';

const toFullUrl = (url) => {
  if (!url) return url;
  if (url.startsWith('http')) return url;
  return API_BASE + url;
};

const STYLES = [
  { key: 'food', label: 'FOOD' },
  { key: 'culture', label: 'CULTURE' },
  { key: 'nature', label: 'NATURE' },
  { key: 'photo', label: 'PHOTO' },
  { key: 'activity', label: 'ACTIVITY' },
  { key: 'shopping', label: 'SHOPPING' },
];

export default function ExploreScreen({ user }) {
  const navigation = useNavigation();
  const [posts, setPosts] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [styleFilter, setStyleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const search = async (kw = keyword, style = styleFilter) => {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/posts/search?keyword=${encodeURIComponent(kw)}`;
      if (style) url += `&travelStyle=${style}`;
      const res = await fetch(url);
      if (res.ok) setPosts(await res.json());
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { search('', ''); }, []);

  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <Text style={S.title}>Explore</Text>
        <Text style={S.subtitle}>DISCOVER THE WORLD</Text>
      </View>

      <View style={S.searchWrap}>
        <Search size={14} color={colors.textTertiary} strokeWidth={1.5} />
        <TextInput style={S.searchInput} placeholder="Search destinations, tags..."
          placeholderTextColor={colors.textMuted} value={keyword}
          onChangeText={setKeyword} onSubmitEditing={() => search()}
          returnKeyType="search" />
      </View>

      <View style={S.filters}>
        <TouchableOpacity style={[S.filter, !styleFilter && S.filterActive]}
          onPress={() => { setStyleFilter(''); search(keyword, ''); }}>
          <Text style={[S.filterText, !styleFilter && S.filterTextActive]}>ALL</Text>
        </TouchableOpacity>
        {STYLES.map(s => (
          <TouchableOpacity key={s.key}
            style={[S.filter, styleFilter === s.key && S.filterActive]}
            onPress={() => { setStyleFilter(s.key); search(keyword, s.key); }}>
            <Text style={[S.filterText, styleFilter === s.key && S.filterTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <FlatList data={posts} keyExtractor={i => i.id}
          numColumns={2} columnWrapperStyle={{ gap: 2 }}
          contentContainerStyle={{ padding: 2, gap: 2, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={S.gridCard} activeOpacity={0.9}
              onPress={() => navigation.navigate('PostDetail', { post: item, user })}>
              {item.images?.[0]
                ? <Image source={{ uri: toFullUrl(item.images[0].endsWith('.mp4') ? item.images[0].replace('_video.mp4', '_thumb.jpg') : item.images[0]) }} style={S.gridImage} />
                : <View style={[S.gridImage, { backgroundColor: colors.bgTertiary, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 24 }}>✈</Text>
                  </View>
              }
              <View style={S.gridOverlay}>
                {(item.city || item.country) && (
                  <Text style={S.gridLocation}>{[item.city, item.country].filter(Boolean).join(' · ').toUpperCase()}</Text>
                )}
                <Text style={S.gridTitle} numberOfLines={2}>{item.title}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={S.empty}>NO RESULTS FOUND</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  title: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 26, color: colors.primary, letterSpacing: -0.8, marginBottom: 2 },
  subtitle: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 2, color: colors.textTertiary, textTransform: 'uppercase' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bgTertiary, marginHorizontal: 16, marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 2 },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textPrimary, padding: 0 },
  filters: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, gap: 18, flexWrap: 'wrap' },
  filter: { paddingBottom: 4 },
  filterActive: { borderBottomWidth: 1, borderBottomColor: colors.primary },
  filterText: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1.5, color: colors.textTertiary },
  filterTextActive: { fontFamily: 'Inter_600SemiBold', color: colors.primary },
  gridCard: { flex: 1, aspectRatio: 1, position: 'relative', overflow: 'hidden' },
  gridImage: { width: '100%', height: '100%' },
  gridOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, backgroundColor: 'rgba(30,42,58,0.5)' },
  gridLocation: { fontFamily: 'Inter_600SemiBold', fontSize: 8, letterSpacing: 1.5, color: 'white', marginBottom: 2 },
  gridTitle: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 12, color: 'white', lineHeight: 14 },
  empty: { textAlign: 'center', fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 2, color: colors.textTertiary, marginTop: 60 },
});
