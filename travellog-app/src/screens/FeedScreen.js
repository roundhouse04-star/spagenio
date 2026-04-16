import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, SafeAreaView, Dimensions , Modal , ScrollView , TextInput , KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useVideoPlayer, VideoView } from 'expo-video';

const API_BASE = 'https://travel.spagenio.com';
const { width } = Dimensions.get('window');

const toFullUrl = (url) => {
  if (!url) return url;
  if (url.startsWith('http')) return url;
  return API_BASE + url;
};

function LogoIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 96 96" fill="none">
      <Circle cx="48" cy="48" r="48" fill="#FF5A5F"/>
      <Circle cx="48" cy="38" r="18" fill="white"/>
      <Circle cx="48" cy="38" r="8" fill="#FF5A5F"/>
      <Path d="M36 58 Q48 76 60 58" fill="white"/>
    </Svg>
  );
}

function VideoCard({ uri, style }) {
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} style={style} contentFit="cover" nativeControls={false} />;
}

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

      {/* ── 이미지/동영상 ── */}
      <TouchableOpacity onPress={() => onPress(post)} activeOpacity={0.97}>
        {post.images?.[0] ? (
          toFullUrl(post.images[0])?.endsWith('.mp4') ? (
            <VideoCard uri={toFullUrl(post.images[0])} style={S.cardImage} />
          ) : (
            <Image source={{ uri: toFullUrl(post.images[0]) }} style={S.cardImage} />
          )
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
  const [tab, setTab] = useState('all');
  const [myLocation, setMyLocation] = useState(null);
  const [allPosts, setAllPosts] = useState([]);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dmModalVisible, setDmModalVisible] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [dmUnread, setDmUnread] = useState(0);

  const applyFilter = (data, t) => {
    if (t === 'following' && user?.id) {
      const fIds = user.followingIds || [];
      const filtered = fIds.length > 0 ? data.filter(p => fIds.includes(p.userId) && p.userId !== user.id) : [];
      setPosts(filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } else if (t === 'popular') {
      const now = Date.now();
      const week = 7 * 24 * 60 * 60 * 1000;
      const recent = data.filter(p => (now - new Date(p.createdAt).getTime()) < week);
      const scored = recent.map(p => ({
        ...p,
        _s: (p.likedUserIds?.length || 0) * 3 + (p.comments?.length || 0) * 2
      }));
      setPosts(scored.sort((a, b) => b._s - a._s));
    } else if (t === 'all' && myLocation) {
      const nearby = data.filter(p => {
        if (!p.latitude || !p.longitude) return false;
        const dist = Math.sqrt(
          Math.pow((p.latitude - myLocation.latitude) * 111, 2) +
          Math.pow((p.longitude - myLocation.longitude) * 111 * Math.cos(myLocation.latitude * Math.PI / 180), 2)
        );
        return dist < 50;
      });
      setPosts(nearby.length > 0 ? nearby : data);
    } else {
      setPosts(data);
    }
  };

  const load = async () => {
    try {
      const res = await fetch(API_BASE + '/api/posts?offset=0&limit=100');
      if (res.ok) {
        const data = await res.json();
        setAllPosts(data);
        applyFilter(data, tab);
      }
    } catch (e) {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setMyLocation(loc.coords);
      }
    })();
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => { if (allPosts.length > 0) applyFilter(allPosts, tab); }, [tab, myLocation]);

  const loadNotifications = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_BASE}/api/notifications?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : []);
      }
      const cRes = await fetch(`${API_BASE}/api/notifications/unread-count?userId=${user.id}`);
      if (cRes.ok) {
        const d = await cRes.json();
        setUnreadCount(d.count || 0);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (user?.id) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  const openNotifModal = async () => {
    await loadNotifications();
    setNotifModalVisible(true);
    if (user?.id && unreadCount > 0) {
      try {
        await fetch(`${API_BASE}/api/notifications/read-all?userId=${user.id}`, { method: 'POST' });
        setUnreadCount(0);
      } catch (e) {}
    }
  };

  const loadConversations = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_BASE}/api/dm/conversations?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(Array.isArray(data) ? data : []);
      }
      const ur = await fetch(`${API_BASE}/api/dm/unread-count?userId=${user.id}`);
      if (ur.ok) { const d = await ur.json(); setDmUnread(d.count || 0); }
    } catch (e) {}
  };

  useEffect(() => {
    if (user?.id) {
      loadConversations();
      const interval = setInterval(loadConversations, 60000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  const openDmModal = async () => {
    await loadConversations();
    setDmModalVisible(true);
  };

  const openConversation = async (convo) => {
    setActiveConvo(convo);
    setMessages([]);
    try {
      const res = await fetch(`${API_BASE}/api/dm/conversations/${convo.id}/messages`);
      if (res.ok) setMessages(await res.json());
      await fetch(`${API_BASE}/api/dm/conversations/${convo.id}/read?userId=${user.id}`, { method: 'POST' });
      loadConversations();
    } catch (e) {}
  };

  const sendMessage = async () => {
    const text = msgInput.trim();
    if (!text || !activeConvo) return;
    setMsgInput('');
    try {
      const res = await fetch(`${API_BASE}/api/dm/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: user.id, receiverId: activeConvo.otherUserId, content: text }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          const mRes = await fetch(`${API_BASE}/api/dm/conversations/${activeConvo.id}/messages`);
          if (mRes.ok) setMessages(await mRes.json());
        } else {
          alert(data.message || '전송 실패');
        }
      }
    } catch (e) {}
  };

  const handleLike = async (postId) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/posts/${postId}/like`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
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
        <LogoIcon />
        <View style={S.headerRight}>
          <TouchableOpacity style={S.headerBtn} onPress={() => navigation.navigate('더보기', { screen: 'NearbyPage' })}>
            <Text style={S.headerBtnText}>📍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.headerBtn} onPress={openNotifModal}>
            <Text style={S.headerBtnText}>🔔</Text>
            {unreadCount > 0 && (
              <View style={S.badge}>
                <Text style={S.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={S.headerBtn} onPress={openDmModal}>
            <Text style={S.headerBtnText}>💬</Text>
            {dmUnread > 0 && (
              <View style={S.badge}>
                <Text style={S.badgeText}>{dmUnread > 99 ? '99+' : dmUnread}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 탭 ── */}
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
        <ActivityIndicator size="large" color="#FF5A5F" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <PostCard post={item} user={user} onLike={handleLike}
              onPress={(post) => navigation.navigate('PostDetail', { post, user })} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#FF5A5F" />}
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
          <Modal visible={notifModalVisible} transparent animationType="fade" onRequestClose={() => setNotifModalVisible(false)}>
        <TouchableOpacity style={S.modalOverlay} activeOpacity={1} onPress={() => setNotifModalVisible(false)}>
          <TouchableOpacity style={S.modalContent} activeOpacity={1}>
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>🔔 알림</Text>
              <TouchableOpacity onPress={() => setNotifModalVisible(false)}>
                <Text style={S.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {notifications.length === 0 ? (
              <Text style={S.notifEmpty}>아직 알림이 없어요</Text>
            ) : (
              <ScrollView>
                {notifications.map(n => {
                  const icons = { like: '❤️', comment: '💬', follow: '👤' };
                  return (
                    <View key={n.id} style={[S.notifItem, !n.isRead && { backgroundColor: '#fef5f5' }]}>
                      <Text style={S.notifIcon}>{icons[n.type] || '🔔'}</Text>
                      <View style={S.notifContent}>
                        <Text style={S.notifText}><Text style={{ fontWeight: '700' }}>{n.actorNickname}</Text>님이 {n.message}</Text>
                        <Text style={S.notifTime}>{new Date(n.createdAt).toLocaleString('ko-KR')}</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={dmModalVisible} animationType="slide" onRequestClose={() => { setDmModalVisible(false); setActiveConvo(null); }}>
        <SafeAreaView style={S.dmContainer}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={0}
          >
            {activeConvo ? (
              <>
                <View style={S.dmHeader}>
                  <TouchableOpacity onPress={() => setActiveConvo(null)}>
                    <Text style={{ fontSize: 22 }}>←</Text>
                  </TouchableOpacity>
                  <View style={S.dmHeaderAvatar}>
                    <Text style={{ fontSize: 14, color: '#4f46e5', fontWeight: '700' }}>{(activeConvo.otherNickname || '?')[0].toUpperCase()}</Text>
                  </View>
                  <Text style={S.dmHeaderName}>{activeConvo.otherNickname}</Text>
                  <TouchableOpacity onPress={() => { setDmModalVisible(false); setActiveConvo(null); }}>
                    <Text style={{ fontSize: 20, color: '#9ca3af' }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={S.dmMessages}>
                  {messages.length === 0 ? (
                    <Text style={S.notifEmpty}>대화를 시작해보세요!</Text>
                  ) : messages.map(m => (
                    <View key={m.id} style={m.senderId === user.id ? S.dmBubbleMine : S.dmBubbleOther}>
                      <Text style={m.senderId === user.id ? S.dmBubbleMineText : S.dmBubbleOtherText}>{m.content}</Text>
                    </View>
                  ))}
                </ScrollView>
                <View style={S.dmInputRow}>
                  <TextInput value={msgInput} onChangeText={setMsgInput}
                    placeholder="메시지 입력..." placeholderTextColor="#9ca3af"
                    style={S.dmInput} onSubmitEditing={sendMessage} returnKeyType="send" />
                  <TouchableOpacity onPress={sendMessage} style={S.dmSendBtn}>
                    <Text style={S.dmSendText}>전송</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={S.modalHeader}>
                  <Text style={S.modalTitle}>💬 메시지</Text>
                  <TouchableOpacity onPress={() => setDmModalVisible(false)}>
                    <Text style={S.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                {conversations.length === 0 ? (
                  <Text style={S.notifEmpty}>아직 대화가 없어요.{'\n'}친구에게 메시지를 보내보세요!</Text>
                ) : (
                  <ScrollView>
                    {conversations.map(c => (
                      <TouchableOpacity key={c.id} style={S.convoItem} onPress={() => openConversation(c)}>
                        <View style={S.convoAvatar}>
                          <Text style={{ fontSize: 16, color: '#4f46e5', fontWeight: '700' }}>{(c.otherNickname || '?')[0].toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={S.convoName}>{c.otherNickname}</Text>
                          <Text style={S.convoLast} numberOfLines={1}>{c.lastMessage || '(메시지 없음)'}</Text>
                        </View>
                        {c.unreadCount > 0 && (
                          <View style={S.convoBadge}>
                            <Text style={S.convoBadgeText}>{c.unreadCount}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            )}
          </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  headerRight: { flexDirection: 'row', gap: 4 },
  headerBtn: { padding: 6 },
  headerBtnText: { fontSize: 22 },
  badge: { position: 'absolute', top: 2, right: 0, backgroundColor: '#FF5A5F', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText: { color: 'white', fontSize: 10, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-start', paddingTop: 80 },
  modalContent: { backgroundColor: 'white', borderRadius: 16, marginHorizontal: 20, maxHeight: '70%', overflow: 'hidden' },
  modalHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a2e' },
  modalClose: { fontSize: 20, color: '#9ca3af' },
  notifItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  notifIcon: { fontSize: 22 },
  notifContent: { flex: 1 },
  notifText: { fontSize: 13, color: '#1a1a2e', lineHeight: 18 },
  notifTime: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  notifEmpty: { padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 },
  dmContainer: { backgroundColor: 'white', flex: 1, overflow: 'hidden' },
  dmHeader: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', flexDirection: 'row', alignItems: 'center', gap: 10 },
  dmHeaderAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center' },
  dmHeaderName: { fontSize: 14, fontWeight: '700', flex: 1, color: '#1a1a2e' },
  dmMessages: { flex: 1, padding: 16, gap: 8 },
  dmBubbleMine: { alignSelf: 'flex-end', maxWidth: '75%', backgroundColor: '#4f46e5', padding: 10, paddingHorizontal: 14, borderRadius: 16, marginVertical: 3 },
  dmBubbleOther: { alignSelf: 'flex-start', maxWidth: '75%', backgroundColor: '#f3f4f6', padding: 10, paddingHorizontal: 14, borderRadius: 16, marginVertical: 3 },
  dmBubbleMineText: { color: 'white', fontSize: 13, lineHeight: 18 },
  dmBubbleOtherText: { color: '#1a1a2e', fontSize: 13, lineHeight: 18 },
  dmInputRow: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', gap: 8, alignItems: 'center' },
  dmInput: { flex: 1, padding: 10, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb', fontSize: 13 },
  dmSendBtn: { backgroundColor: '#4f46e5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  dmSendText: { color: 'white', fontSize: 13, fontWeight: '700' },
  convoItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', flexDirection: 'row', gap: 12, alignItems: 'center' },
  convoAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center' },
  convoName: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  convoLast: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  convoBadge: { backgroundColor: '#FF5A5F', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  convoBadgeText: { color: 'white', fontSize: 11, fontWeight: '700' },
  tabs: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#FF5A5F' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  tabTextActive: { color: '#FF5A5F', fontWeight: '700' },
  card: { backgroundColor: 'white' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF5A5F', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fecaca' },
  avatarText: { color: 'white', fontWeight: '800', fontSize: 14 },
  nickname: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  location: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  moreBtn: { fontSize: 18, color: '#374151', letterSpacing: 1 },
  cardImage: { width: width, height: width, resizeMode: 'cover' },
  noImage: { backgroundColor: '#fff5f5', justifyContent: 'center', alignItems: 'center' },
  noImageIcon: { fontSize: 64 },
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
