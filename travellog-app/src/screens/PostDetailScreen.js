import { useState, useRef } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';

import { useVideoPlayer, VideoView } from 'expo-video';

const API_BASE = 'https://travel.spagenio.com';

const toFullUrl = (url) => {
  if (!url) return url;
  if (url.startsWith('http')) return url;
  return API_BASE + url;
};

function DetailVideo({ uri }) {
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.muted = false;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: 300 }}
      contentFit="cover"
      nativeControls={true}
    />
  );
}

export default function PostDetailScreen({ route, navigation }) {
  const { post: initialPost, user } = route.params;
  const [post, setPost] = useState(initialPost);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef(null);

  const liked = (post.likedUserIds || []).includes(user?.id);
  const bookmarked = (user?.savedPostIds || []).includes(post.id);
  const wishlisted = (user?.wishlistPostIds || []).includes(post.id);

  const handleLike = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/posts/${post.id}/like/${user.id}`, { method: 'POST' });
      if (res.ok) {
        setPost(await res.json());
        fetch(`${API_BASE}/api/push/notify-like`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId: post.id, likerId: user.id, likerNickname: user.nickname }),
        }).catch(() => {});
      }
    } catch (e) {}
  };

  const handleBookmark = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/${user.id}/bookmark/${post.id}`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        user.savedPostIds = updated.savedPostIds;
        setPost(p => ({ ...p }));
      }
    } catch (e) {}
  };

  const handleWishlist = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/${user.id}/wishlist/${post.id}`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        user.wishlistPostIds = updated.wishlistPostIds;
        setPost(p => ({ ...p }));
      }
    } catch (e) {}
  };

  const submitComment = async () => {
    if (!comment.trim() || !user) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, content: comment.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPost(updated);
        fetch(`${API_BASE}/api/push/notify-comment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId: post.id, commenterId: user.id, commenterNickname: user.nickname, commentText: comment.trim() }),
        }).catch(() => {});
        setComment('');
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
      }
    } catch (e) {}
    setSubmitting(false);
  };

  const deleteComment = (commentId) => {
    Alert.alert('댓글 삭제', '댓글을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        try {
          const res = await fetch(`${API_BASE}/api/posts/${post.id}/comments/${commentId}`, { method: 'DELETE' });
          if (res.ok) setPost(await res.json());
        } catch (e) {}
      }},
    ]);
  };

  return (
    <SafeAreaView style={S.container}>
      {/* 헤더 */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}>
          <Text style={S.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle} numberOfLines={1}>{post.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
          {/* 이미지 */}
          {post.images?.[0] && (
            toFullUrl(post.images[0])?.endsWith('.mp4') ? (
              <DetailVideo uri={toFullUrl(post.images[0])} />
            ) : (
              <Image source={{ uri: toFullUrl(post.images[0]) }} style={S.image} />
            )
          )}

          <View style={S.body}>
            {/* 여행 스타일 */}
            {post.travelStyles?.length > 0 && (
              <View style={S.tags}>
                {post.travelStyles.map((s, i) => (
                  <View key={`style-${i}`} style={S.tag}>
                    <Text style={S.tagText}>{s}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 제목 */}
            <Text style={S.title}>{post.title}</Text>

            {/* 작성자 */}
            <View style={S.authorRow}>
              <View style={S.avatar}>
                <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>
                  {post.userNickname?.[0]?.toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={S.authorName}>@{post.userNickname}</Text>
                {(post.country || post.city) && (
                  <Text style={S.location}>📍 {[post.city, post.country].filter(Boolean).join(', ')}</Text>
                )}
              </View>
            </View>

            {/* 내용 */}
            <Text style={S.content}>{post.content}</Text>

            {/* 장소 */}
            {post.places?.length > 0 && (
              <View style={S.placesWrap}>
                <Text style={S.placesTitle}>📍 방문 장소</Text>
                {post.places.map((p, i) => (
                  <View key={i} style={S.placeItem}>
                    <Text style={S.placeName}>{p.name}</Text>
                    {p.address && <Text style={S.placeAddr}>{p.address}</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* 유튜브 링크 */}
            {post.youtubeUrl && (
              <View style={S.youtubeWrap}>
                <Text style={S.youtubeIcon}>▶</Text>
                <View style={{ flex: 1 }}>
                  <Text style={S.youtubeLabel}>유튜브 영상</Text>
                  {post.youtubeTitle && <Text style={S.youtubeTitle} numberOfLines={1}>{post.youtubeTitle}</Text>}
                </View>
              </View>
            )}

            {/* 태그 */}
            {post.tags?.length > 0 && (
              <View style={S.hashTags}>
                {[...new Set(post.tags)].map((t, i) => (
                  <Text key={`tag-${i}`} style={S.hashTag}>#{t}</Text>
                ))}
              </View>
            )}

            {/* 액션 버튼 */}
            <View style={S.actions}>
              <TouchableOpacity style={S.actionBtn} onPress={handleLike}>
                <Text style={S.actionIcon}>{liked ? '❤️' : '🤍'}</Text>
                <Text style={[S.actionText, liked && { color: '#ef4444' }]}>{post.likedUserIds?.length || 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.actionBtn} onPress={handleWishlist}>
                <Text style={S.actionIcon}>✈️</Text>
                <Text style={[S.actionText, wishlisted && { color: '#4f46e5' }]}>{wishlisted ? '가고싶다✓' : '가고싶다'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.actionBtn} onPress={handleBookmark}>
                <Text style={S.actionIcon}>{bookmarked ? '🔖' : '🔖'}</Text>
                <Text style={[S.actionText, bookmarked && { color: '#4f46e5' }]}>{bookmarked ? '저장됨' : '저장'}</Text>
              </TouchableOpacity>
            </View>

            {/* 댓글 목록 */}
            <View style={S.commentsWrap}>
              <Text style={S.commentsTitle}>💬 댓글 {post.comments?.length || 0}개</Text>
              {post.comments?.length === 0 && (
                <Text style={S.emptyComment}>첫 번째 댓글을 남겨보세요!</Text>
              )}
              {post.comments?.map((c, i) => (
                <View key={`comment-${i}`} style={S.commentItem}>
                  <View style={S.commentAvatar}>
                    <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>
                      {c.userNickname?.[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.commentUser}>@{c.userNickname}</Text>
                    <Text style={S.commentContent}>{c.content}</Text>
                  </View>
                  {c.userId === user?.id && (
                    <TouchableOpacity onPress={() => deleteComment(c.id)} style={{ padding: 4 }}>
                      <Text style={{ fontSize: 12, color: '#ef4444' }}>삭제</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* 댓글 입력창 */}
        <View style={S.commentInput}>
          <View style={S.commentAvatar}>
            <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>
              {user?.nickname?.[0]?.toUpperCase()}
            </Text>
          </View>
          <TextInput style={S.commentBox} placeholder="댓글을 입력하세요..." placeholderTextColor="#9ca3af"
            value={comment} onChangeText={setComment} multiline maxLength={200} />
          <TouchableOpacity style={[S.sendBtn, !comment.trim() && { opacity: 0.4 }]}
            onPress={submitComment} disabled={!comment.trim() || submitting}>
            <Text style={S.sendText}>전송</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backIcon: { fontSize: 22, color: '#4f46e5', fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1a1a2e', textAlign: 'center' },
  image: { width: '100%', height: 280, resizeMode: 'cover' },
  body: { padding: 18 },
  tags: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  tag: { backgroundColor: '#eef2ff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11, color: '#4f46e5', fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '900', color: '#1a1a2e', marginBottom: 14, lineHeight: 28 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center' },
  authorName: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  location: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  content: { fontSize: 15, color: '#374151', lineHeight: 24, marginBottom: 20 },
  placesWrap: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 16 },
  placesTitle: { fontSize: 13, fontWeight: '800', color: '#1a1a2e', marginBottom: 10 },
  placeItem: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#eee' },
  placeName: { fontSize: 13, fontWeight: '700', color: '#374151' },
  placeAddr: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  youtubeWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, marginBottom: 14 },
  youtubeIcon: { fontSize: 20, color: '#dc2626' },
  youtubeLabel: { fontSize: 11, fontWeight: '700', color: '#dc2626' },
  youtubeTitle: { fontSize: 12, color: '#6b7280' },
  hashTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 },
  hashTag: { fontSize: 13, color: '#4f46e5', fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f0f0f0', marginBottom: 24 },
  actionBtn: { alignItems: 'center', gap: 4 },
  actionIcon: { fontSize: 24 },
  actionText: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  commentsWrap: { gap: 14, paddingBottom: 20 },
  commentsTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a2e' },
  emptyComment: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 20 },
  commentItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  commentUser: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 2 },
  commentContent: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
  commentInput: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: 'white' },
  commentBox: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, color: '#1a1a2e', maxHeight: 80 },
  sendBtn: { backgroundColor: '#4f46e5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  sendText: { color: 'white', fontSize: 13, fontWeight: '700' },
});
