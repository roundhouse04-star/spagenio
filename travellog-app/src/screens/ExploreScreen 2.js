import { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const API_BASE = 'https://travel.spagenio.com';
const STYLES = [
  { key: 'food', icon: '🍜', label: '맛집' },
  { key: 'culture', icon: '🏛️', label: '문화' },
  { key: 'nature', icon: '🌿', label: '자연' },
  { key: 'photo', icon: '📸', label: '포토' },
  { key: 'activity', icon: '🏄', label: '액티비티' },
  { key: 'shopping', icon: '🛍️', label: '쇼핑' },
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
        <Text style={S.title}>🔍 탐색</Text>
      </View>

      <View style={S.searchWrap}>
        <TextInput style={S.searchInput} placeholder="여행지, 제목 검색..."
          placeholderTextColor="#9ca3af" value={keyword}
          onChangeText={setKeyword} onSubmitEditing={() => search()}
          returnKeyType="search" />
      </View>

      <View style={S.filters}>
        <TouchableOpacity style={[S.filter, !styleFilter && S.filterActive]}
          onPress={() => { setStyleFilter(''); search(keyword, ''); }}>
          <Text style={[S.filterText, !styleFilter && S.filterTextActive]}>전체</Text>
        </TouchableOpacity>
        {STYLES.map(s => (
          <TouchableOpacity key={s.key}
            style={[S.filter, styleFilter === s.key && S.filterActive]}
            onPress={() => { setStyleFilter(s.key); search(keyword, s.key); }}>
            <Text style={[S.filterText, styleFilter === s.key && S.filterTextActive]}>
              {s.icon} {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator color="#4f46e5" style={{ marginTop: 40 }} /> : (
        <FlatList data={posts} keyExtractor={i => i.id}
          numColumns={2} columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={S.gridCard} activeOpacity={0.9}
              onPress={() => navigation.navigate('PostDetail', { post: item, user })}>
              {item.images?.[0]
                ? <Image source={{ uri: item.images[0] }} style={S.gridImage} />
                : <View style={[S.gridImage, { backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 32 }}>✈️</Text>
                  </View>
              }
              <View style={S.gridBody}>
                <Text style={S.gridTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={S.gridUser}>@{item.userNickname}</Text>
                {item.travelStyles?.length > 0 && (
                  <Text style={S.gridStyle}>{item.travelStyles[0]}</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#9ca3af', marginTop: 60, fontSize: 14 }}>검색 결과가 없어요</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  header: { backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 20, fontWeight: '900', color: '#1a1a2e' },
  searchWrap: { backgroundColor: 'white', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  searchInput: { backgroundColor: '#f3f4f6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1a1a2e' },
  filters: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 6, flexWrap: 'wrap', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  filter: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: '#eee' },
  filterActive: { backgroundColor: '#eef2ff', borderColor: '#4f46e5' },
  filterText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  filterTextActive: { color: '#4f46e5' },
  gridCard: { flex: 1, backgroundColor: 'white', borderRadius: 14, overflow: 'hidden' },
  gridImage: { width: '100%', height: 130, resizeMode: 'cover' },
  gridBody: { padding: 10, gap: 3 },
  gridTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  gridUser: { fontSize: 11, color: '#9ca3af' },
  gridStyle: { fontSize: 10, color: '#4f46e5', fontWeight: '600' },
});
