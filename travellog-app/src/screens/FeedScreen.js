import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, SafeAreaView, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';

const API_BASE = 'https://travel.spagenio.com';
const { width } = Dimensions.get('window');
const PAGE_SIZE = 8;

// 자동재생 비디오 컴포넌트
function AutoPlayVideo({ src, poster, isVisible }) {
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isVisible) {
      videoRef.current.playAsync().catch(() => {});
    } else {
      videoRef.current.pauseAsync().catch(() => {});
    }
  }, [isVisible]);

  return (
    <View style={{ position: 'relative' }}>
      <Video
        ref={videoRef}
        source={{ uri: src }}
        posterSource={poster ? { uri: poster } : undefined}
        usePoster={!!poster}
        resizeMode={ResizeMode.COVER}
        isLooping
        isMuted={muted}
        shouldPlay={isVisible}
        style={{ width: width, height: width, backgroundColor: '#000' }}
      />
      <TouchableOpacity
        onPress={() => setMuted(!muted)}
        style={S.muteBtn}>
        <Text style={{ fontSize: 16, color: 'white' }}>{muted ? '🔇' : '🔊'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function PostCard({ post, user, onLike, onPress, isVisible }) {
  const liked = (post.likedUserIds || []).includes(user?.id);
  const likeCount = post.likedUserIds?.length || 0;
  const commentCount = post.comments?.length || 0;
  const isVideo = post.images?.[0]?.endsWith('.mp4');

  return (
    <View style={S.card}>
      <View style={S.cardHeader}>
        <View style={S.headerLeft}>
          <View style={S.avatar}>
            {post.userProfileImage ? (
              <Image source={{ uri: post.userProfileImage }} style={{ width: '100%', height: '100%', borderRadius: 18 }} />
            ) : (
              <Text style={S.avatarText}>{post.userNickname?.[0]?.toUpperCase()}</Text>
            )}
          </View>
          <View>
            <Text style={S.nickname}>{post.userNickname}</Text>
            {(post.city || post.country) && (
              <Text style={S.location}>📍 {[post.city, post.country].filter(Boolean).join(', ')}</Text>
            )}
          </View>
        </View>
        <Text style={S.moreBtn}>···</Text>
      </View>

      {isVideo ? (
        <AutoPlayVideo
          src={post.images[0]}
          poster={post.images[0].replace('_video.mp4', '_thumb.jpg')}
          isVisible={isVisible}
        />
      ) : (
        <TouchableOpacity onPress={() => onPress(post)} activeOpacity={0.97}>
          {post.images?.[0] ? (
            <Image source={{ uri: post.images[0] }} style={S.cardImage} />
          ) : (
            <View style={[S.cardImage, S.noImage]}>
              <Text style={S.noImageIcon}>✈️</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

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
        <TouchableOpacity style={S.actionBtn}>
          <Text style={S.actionIcon}>🔖</Text>
        </TouchableOpacity>
      </View>

      {likeCount > 0 && <Text style={S.likeCount}>좋아요 {likeCount}개</Text>}

      <View style={S.caption}>
        <Text style={S.captionText}>
          <Text style={S.captionNick}>{post.userNickname} </Text>
          <Text>{post.title}</Text>
        </Text>
        {post.content && <Text style={S.captionContent} numberOfLines={2}>{post.content}</Text>}
      </View>

      {commentCount > 0 && (
        <TouchableOpacity onPress={() => onPress(post)}>
          <Text style={S.commentPreview}>댓글 {commentCount}개 모두 보기</Text>
        </TouchableOpacity>
      )}

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [tab, setTab] = useState('all');
  const [visibleItems, setVisibleItems] = useState([]);

  const load = async () => {
    setLoading(true);
    setPage(0);
    try {
      const res = await fetch(API_BASE + '/api/posts?offset=0&limit=' + PAGE_SIZE);
      if (res.ok) {
        const data = await res.json();
        setPosts(data || []);
        setHasMore((data || []).length >= PAGE_SIZE);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetch(API_BASE + '/api/posts?offset=' + (nextPage * PAGE_SIZE) + '&limit=' + PAGE_SIZE);
      if (res.ok) {
        const data = await res.json();
        if ((data || []).length === 0) {
          setHasMore(false);
        } else {
          setPosts(prev => [...prev, ...data]);
          setPage(nextPage);
          setHasMore(data.length >= PAGE_SIZE);
        }
      }
    } catch (e) { console.error(e); }
    setLoadingMore(false);
  };

  useEffect(() => { load(); }, [tab]);

  const handleLike = async (postId) => {
    if (!user) return;
    try {
      const res = await fetch(API_BASE + '/api/posts/' + postId + '/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPosts(prev => prev.map(p => p.id === postId ? updated : p));
      }
    } catch (e) { console.error(e); }
  };

  // 화면에 보이는 아이템 추적 (자동재생용)
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    setVisibleItems(viewableItems.map(v => v.item.id));
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <Text style={S.logo}>✈ Travellog</Text>
        <View style={S.headerRight}>
          <TouchableOpacity style={S.headerBtn}><Text style={S.headerBtnText}>🔔</Text></TouchableOpacity>
          <TouchableOpacity style={S.headerBtn}><Text style={S.headerBtnText}>💬</Text></TouchableOpacity>
        </View>
      </View>

      <View style={S.tabs}>
        <TouchableOpacity style={[S.tab, tab === 'all' && S.tabActive]} onPress={() => setTab('all')}>
          <Text style={[S.tabText, tab === 'all' && S.tabTextActive]}>전체</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.tab, tab === 'following' && S.tabActive]} onPress={() => setTab('following')}>
          <Text style={[S.tabText, tab === 'following' && S.tabTextActive]}>팔로잉</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FF5A5F" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item, index) => item.id + '_' + index}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              user={user}
              onLike={handleLike}
              onPress={(post) => navigation.navigate('PostDetail', { post, user })}
              isVisible={visibleItems.includes(item.id)}
            />
          )}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#FF5A5F" />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator size="small" color="#FF5A5F" style={{ padding: 16 }} /> :
            !hasMore && posts.length > 0 ? <Text style={{ textAlign: 'center', padding: 16, fontSize: 12, color: '#d1d5db' }}>모든 게시물을 봤어요 ✓</Text> : null
          }
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  logo: { fontSize: 22, fontWeight: '900', color: '#FF5A5F', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', gap: 4 },
  headerBtn: { padding: 6 },
  headerBtnText: { fontSize: 22 },
  tabs: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#FF5A5F' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  tabTextActive: { color: '#FF5A5F' },
  card: { backgroundColor: 'white', marginBottom: 0 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF5A5F', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ffcccf' },
  avatarText: { color: 'white', fontWeight: '800', fontSize: 14 },
  nickname: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  location: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  moreBtn: { fontSize: 18, color: '#374151', letterSpacing: 1 },
  cardImage: { width: width, height: width, resizeMode: 'cover' },
  noImage: { backgroundColor: '#fff5f5', justifyContent: 'center', alignItems: 'center' },
  noImageIcon: { fontSize: 64 },
  muteBtn: { position: 'absolute', bottom: 14, right: 14, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 18, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  actionsLeft: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 4 },
  actionIcon: { fontSize: 24 },
  likeCount: { paddingHorizontal: 14, fontSize: 13, fontWeight: '700', color: '#1a1a2e', marginBottom: 4 },
  caption: { paddingHorizontal: 14, marginBottom: 4 },
  captionText: { fontSize: 14, color: '#1a1a2e', lineHeight: 20 },
  captionNick: { fontWeight: '800' },
  captionContent: { fontSize: 13, color: '#6b7280', marginTop: 2, lineHeight: 18 },
  commentPreview: { paddingHorizontal: 14, fontSize: 13, color: '#9ca3af', marginBottom: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingHorizontal: 14, paddingBottom: 10 },
  tag: { fontSize: 13, color: '#FF5A5F' },
});
