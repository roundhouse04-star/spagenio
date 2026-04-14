import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const API_BASE = 'https://travel.spagenio.com';

function PostCard({ post, user, onLike, onPress }) {
  const liked = (post.likedUserIds || []).includes(user?.id);
  const likeCount = post.likedUserIds?.length || 0;

  return (
    <TouchableOpacity style={S.card} onPress={() => onPress(post)} activeOpacity={0.95}>
      {post.images?.[0] && (
        <Image source={{ uri: post.images[0] }} style={S.cardImage} />
      )}
      <View style={S.cardBody}>
        {/* 여행 스타일 태그 */}
        {post.travelStyles?.length > 0 && (
          <View style={S.tags}>
            {post.travelStyles.slice(0, 2).map(s => (
              <View key={s} style={S.tag}>
                <Text style={S.tagText}>{s}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={S.title}>{post.title}</Text>
        <Text style={S.content} numberOfLines={2}>{post.content}</Text>

        {/* 장소 */}
        {post.places?.length > 0 && (
          <Text style={S.place}>📍 {post.places.slice(0, 2).map(p => p.name).join(' · ')}</Text>
        )}

        {/* 하단 메타 */}
        <View style={S.meta}>
          <View style={S.userInfo}>
            <View style={S.avatar}>
              <Text style={{ fontSize: 12, color: 'white', fontWeight: '700' }}>
                {post.userNickname?.[0]?.toUpperCase()}
              </Text>
            </View>
            <Text style={S.nickname}>@{post.userNickname}</Text>
          </View>
          <TouchableOpacity style={S.likeBtn} onPress={() => onLike(post.id)} activeOpacity={0.7}>
            <Text style={S.likeIcon}>{liked ? '❤️' : '🤍'}</Text>
            <Text style={[S.likeCount, liked && { color: '#ef4444' }]}>{likeCount}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function FeedScreen({ user }) {
  const navigation = useNavigation();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/posts`);
      if (res.ok) setPosts(await res.json());
    } catch (e) {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const handleLike = async (postId) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/posts/${postId}/like/${user.id}`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setPosts(prev => prev.map(p => p.id === postId ? updated : p));
      }
    } catch (e) {}
  };

  const handlePress = (post) => {
    navigation?.navigate('PostDetail', { post, user });
  };

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#4f46e5" />
    </View>
  );

  return (
    <SafeAreaView style={S.container}>
      {/* 헤더 */}
      <View style={S.header}>
        <Text style={S.logo}>✈ Travellog</Text>
        <Text style={S.headerUser}>{user?.nickname}</Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <PostCard post={item} user={user} onLike={handleLike} onPress={handlePress} />
        )}
        contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#4f46e5" />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#9ca3af', marginTop: 60 }}>게시물이 없어요</Text>}
      />
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  header: { backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  logo: { fontSize: 20, fontWeight: '900', color: '#4f46e5' },
  headerUser: { fontSize: 13, color: '#6b7280', fontWeight: '600' },

  card: { backgroundColor: 'white', borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  cardImage: { width: '100%', height: 200, resizeMode: 'cover' },
  cardBody: { padding: 14 },

  tags: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  tag: { backgroundColor: '#eef2ff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontSize: 11, color: '#4f46e5', fontWeight: '700' },

  title: { fontSize: 16, fontWeight: '800', color: '#1a1a2e', marginBottom: 5 },
  content: { fontSize: 13, color: '#6b7280', lineHeight: 19, marginBottom: 8 },
  place: { fontSize: 12, color: '#4f46e5', marginBottom: 10 },

  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center' },
  nickname: { fontSize: 12, color: '#9ca3af', fontWeight: '600' },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  likeIcon: { fontSize: 18 },
  likeCount: { fontSize: 13, fontWeight: '700', color: '#9ca3af' },
});
