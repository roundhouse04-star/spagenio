import { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, SafeAreaView, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const API_BASE = 'https://travel.spagenio.com';
const { width } = Dimensions.get('window');

function PostCard({ post, user, onLike, onPress }) {
  const liked = (post.likedUserIds || []).includes(user?.id);
  const likeCount = post.likedUserIds?.length || 0;
  const commentCount = post.comments?.length || 0;

  return (
    <View style={S.card}>
      {/* ── 헤더: 프로필 + 닉네임 ── */}
      <View style={S.cardHeader}>
        <TouchableOpacity style={S.headerLeft}>
          <View style={S.avatar}>
            <Text style={S.avatarText}>{post.userNickname?.[0]?.toUpperCase()}</Text>
          </View>
          <View>
            <Text style={S.nickname}>{post.userNickname}</Text>
            {(post.city || post.country) && (
              <Text style={S.location}>📍 {[post.city, post.country].filter(Boolean).join(', ')}</Text>
            )}
          </View>
        </TouchableOpacity>
        <Text style={S.moreBtn}>···</Text>
      </View>

      {/* ── 이미지 (정사각형) ── */}
      <TouchableOpacity onPress={() => onPress(post)} activeOpacity={0.97}>
        {post.images?.[0] ? (
          <Image source={{ uri: post.images[0] }} style={S.cardImage} />
        ) : (
          <View style={[S.cardImage, S.noImage]}>
            <Text style={S.noImageIcon}>✈️</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── 액션 버튼 ── */}
      <View style={S.actions}>
        <View style={S.actionsLeft}>
          <TouchableOpacity style={S.actionBtn} onPress={() => onLike(post.id)}>
            <Text style={S.actionIcon}>{liked ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.actionBtn} onPress={() => onPress(post)}>
            <Text style={S.actionIcon}>💬</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.actionBtn}>
            <Text style={S.actionIcon}>✈️</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity>
          <Text style={S.actionIcon}>🔖</Text>
        </TouchableOpacity>
      </View>

      {/* ── 좋아요 수 ── */}
      {likeCount > 0 && (
        <Text style={S.likeCount}>좋아요 {likeCount}개</Text>
      )}

      {/* ── 캡션 ── */}
      <View style={S.caption}>
        <Text style={S.captionText}>
          <Text style={S.captionNick}>{post.userNickname} </Text>
          <Text>{post.title}</Text>
        </Text>
        {post.content && (
          <Text style={S.captionContent} numberOfLines={2}>{post.content}</Text>
        )}
      </View>

      {/* ── 댓글 미리보기 ── */}
      {commentCount > 0 && (
        <TouchableOpacity onPress={() => onPress(post)}>
          <Text style={S.commentPreview}>댓글 {commentCount}개 모두 보기</Text>
        </TouchableOpacity>
      )}

      {/* ── 태그 ── */}
      {post.tags?.length > 0 && (
        <View style={S.tags}>
          {post.tags.slice(0, 3).map((t, i) => (
            <Text key={i} style={S.tag}>#{t}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

export default function FeedScreen({ user }) {
  const navigation = useNavigation();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('all'); // all | following | popular
  const [allPosts, setAllPosts] = useState([]);
  const [allPosts, setAllPosts] = useState([]);

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

  return (
    <SafeAreaView style={S.container}>
      {/* ── 헤더 ── */}
      <View style={S.header}>
        <Text style={S.logo}>✈ Travellog</Text>
        <View style={S.headerRight}>
          <TouchableOpacity style={S.headerBtn}>
            <Text style={S.headerBtnText}>🔔</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.headerBtn}>
            <Text style={S.headerBtnText}>💬</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 탭 (전체 / 팔로잉) ── */}
      <View style={S.tabs}>
        <TouchableOpacity style={[S.tab, tab === 'all' && S.tabActive]} onPress={() => setTab('all')}>
          <Text style={[S.tabText, tab === 'all' && S.tabTextActive]}>📍 근처</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.tab, tab === 'following' && S.tabActive]} onPress={() => setTab('following')}>
          <Text style={[S.tabText, tab === 'following' && S.tabTextActive]}>👤 팔로잉</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.tab, tab === 'popular' && S.tabActive]} onPress={() => setTab('popular')}>
          <Text style={[S.tabText, tab === 'popular' && S.tabTextActive]}>🔥 인기</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <PostCard post={item} user={user} onLike={handleLike}
              onPress={(post) => navigation.navigate('PostDetail', { post, user })} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#4f46e5" />}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
              <Text style={{ fontSize: 48 }}>✈️</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#374151' }}>게시물이 없어요</Text>
              <Text style={{ fontSize: 13, color: '#9ca3af' }}>첫 번째 여행 이야기를 올려보세요!</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },

  // 헤더
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  logo: { fontSize: 22, fontWeight: '900', color: '#4f46e5', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', gap: 4 },
  headerBtn: { padding: 6 },
  headerBtnText: { fontSize: 22 },

  // 탭
  tabs: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#FF5A5F' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  tabTextActive: { color: '#4f46e5' },

  // 카드
  card: { backgroundColor: 'white', marginBottom: 0 },

  // 카드 헤더
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#c7d2fe' },
  avatarText: { color: 'white', fontWeight: '800', fontSize: 14 },
  nickname: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  location: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  moreBtn: { fontSize: 18, color: '#374151', letterSpacing: 1 },

  // 이미지
  cardImage: { width: width, height: width, resizeMode: 'cover' },
  noImage: { backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center' },
  noImageIcon: { fontSize: 64 },

  // 액션
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  actionsLeft: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 4 },
  actionIcon: { fontSize: 24 },

  // 좋아요 수
  likeCount: { paddingHorizontal: 14, fontSize: 13, fontWeight: '700', color: '#1a1a2e', marginBottom: 4 },

  // 캡션
  caption: { paddingHorizontal: 14, marginBottom: 4 },
  captionText: { fontSize: 14, color: '#1a1a2e', lineHeight: 20 },
  captionNick: { fontWeight: '800' },
  captionContent: { fontSize: 13, color: '#6b7280', marginTop: 2, lineHeight: 18 },

  // 댓글 미리보기
  commentPreview: { paddingHorizontal: 14, fontSize: 13, color: '#9ca3af', marginBottom: 4 },

  // 태그
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingHorizontal: 14, paddingBottom: 10 },
  tag: { fontSize: 13, color: '#4f46e5' },
});
