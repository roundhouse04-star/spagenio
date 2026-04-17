import { useState, useRef } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ArrowLeft, Heart, MessageSquare, Send, Bookmark, Play } from 'lucide-react-native';
import { colors } from '../theme/colors';

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
      style={{ width: '100%', height: 340 }}
      contentFit="cover"
      nativeControls={true}
    />
  );
}

export default function PostDetailScreen({ route, navigation, user: userProp, setUser }) {
  // Support both: user from route.params (back-compat) or from props
  const { post: initialPost } = route.params;
  const user = userProp || route.params?.user;

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
      const res = await fetch(`${API_BASE}/api/posts/${post.id}/like`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
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
        // Properly update user state so other screens re-render
        if (setUser) {
          setUser(prev => ({ ...prev, savedPostIds: updated.savedPostIds }));
        } else {
          // Fallback for back-compat
          user.savedPostIds = updated.savedPostIds;
          setPost(p => ({ ...p }));
        }
      }
    } catch (e) {}
  };

  const handleWishlist = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/${user.id}/wishlist/${post.id}`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        if (setUser) {
          setUser(prev => ({ ...prev, wishlistPostIds: updated.wishlistPostIds }));
        } else {
          user.wishlistPostIds = updated.wishlistPostIds;
          setPost(p => ({ ...p }));
        }
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
    Alert.alert('Delete comment', 'Delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const res = await fetch(`${API_BASE}/api/posts/${post.id}/comments/${commentId}`, { method: 'DELETE' });
          if (res.ok) setPost(await res.json());
        } catch (e) {}
      }},
    ]);
  };

  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}>
          <ArrowLeft size={20} color={colors.primary} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={S.headerTitle}>POST</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
          {post.images?.[0] && (
            toFullUrl(post.images[0])?.endsWith('.mp4') ? (
              <DetailVideo uri={toFullUrl(post.images[0])} />
            ) : (
              <Image source={{ uri: toFullUrl(post.images[0]) }} style={S.image} />
            )
          )}

          <View style={S.body}>
            {(post.country || post.city) && (
              <Text style={S.location}>{[post.city, post.country].filter(Boolean).join(' · ').toUpperCase()}</Text>
            )}

            <Text style={S.title}>{post.title}</Text>

            <View style={S.authorRow}>
              <View style={S.avatar}>
                <Text style={S.avatarText}>{post.userNickname?.[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.authorName}>{post.userNickname}</Text>
                <Text style={S.authorDate}>{new Date(post.createdAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}</Text>
              </View>
            </View>

            {post.travelStyles?.length > 0 && (
              <View style={S.tags}>
                {post.travelStyles.map((s, i) => (
                  <View key={`style-${i}`} style={S.tag}>
                    <Text style={S.tagText}>{s.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={S.content}>{post.content}</Text>

            {post.places?.length > 0 && (
              <View style={S.placesWrap}>
                <Text style={S.sectionLabel}>PLACES VISITED</Text>
                {post.places.map((p, i) => (
                  <View key={i} style={S.placeItem}>
                    <Text style={S.placeNum}>{String(i + 1).padStart(2, '0')}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={S.placeName}>{p.name}</Text>
                      {p.address && <Text style={S.placeAddr}>{p.address}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {post.youtubeUrl && (
              <View style={S.youtubeWrap}>
                <Play size={18} color={colors.primary} strokeWidth={1.5} fill={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={S.youtubeLabel}>VIDEO</Text>
                  {post.youtubeTitle && <Text style={S.youtubeTitle} numberOfLines={1}>{post.youtubeTitle}</Text>}
                </View>
              </View>
            )}

            {post.tags?.length > 0 && (
              <View style={S.hashTags}>
                {[...new Set(post.tags)].map((t, i) => (
                  <Text key={`tag-${i}`} style={S.hashTag}>#{t}</Text>
                ))}
              </View>
            )}

            <View style={S.actions}>
              <TouchableOpacity style={S.actionBtn} onPress={handleLike}>
                <Heart size={22} color={liked ? colors.accent : colors.primary} fill={liked ? colors.accent : 'none'} strokeWidth={1.5} />
                <Text style={S.actionCount}>{post.likedUserIds?.length || 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.actionBtn} onPress={handleWishlist}>
                <Send size={22} color={wishlisted ? colors.primary : colors.textTertiary} strokeWidth={1.5} />
                <Text style={S.actionLabel}>{wishlisted ? 'WISHED' : 'WISH'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.actionBtn} onPress={handleBookmark}>
                <Bookmark size={22} color={bookmarked ? colors.primary : colors.textTertiary} fill={bookmarked ? colors.primary : 'none'} strokeWidth={1.5} />
                <Text style={S.actionLabel}>{bookmarked ? 'SAVED' : 'SAVE'}</Text>
              </TouchableOpacity>
            </View>

            <View style={S.commentsWrap}>
              <Text style={S.sectionLabel}>COMMENTS ({post.comments?.length || 0})</Text>
              {post.comments?.length === 0 && (
                <Text style={S.emptyComment}>BE THE FIRST TO COMMENT</Text>
              )}
              {post.comments?.map((c, i) => (
                <View key={`comment-${i}`} style={S.commentItem}>
                  <View style={S.commentAvatar}>
                    <Text style={S.commentAvatarText}>{c.userNickname?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.commentUser}>{c.userNickname}</Text>
                    <Text style={S.commentContent}>{c.content}</Text>
                  </View>
                  {c.userId === user?.id && (
                    <TouchableOpacity onPress={() => deleteComment(c.id)}>
                      <Text style={S.deleteBtn}>DELETE</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={S.commentInput}>
          <View style={S.commentAvatar}>
            <Text style={S.commentAvatarText}>{user?.nickname?.[0]?.toUpperCase()}</Text>
          </View>
          <TextInput style={S.commentBox} placeholder="Add a comment..." placeholderTextColor={colors.textMuted}
            value={comment} onChangeText={setComment} multiline maxLength={200} />
          <TouchableOpacity style={[S.sendBtn, !comment.trim() && { opacity: 0.4 }]}
            onPress={submitComment} disabled={!comment.trim() || submitting}>
            <Text style={S.sendText}>SEND</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 2.5, color: colors.primary },
  image: { width: '100%', height: 340, resizeMode: 'cover' },
  body: { padding: 20 },
  location: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 2, color: colors.primary, marginBottom: 8 },
  title: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 24, color: colors.primary, letterSpacing: -0.5, lineHeight: 30, marginBottom: 18 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 14, paddingBottom: 14, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: colors.borderLight, marginBottom: 18 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgTertiary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.primary },
  authorName: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.primary },
  authorDate: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 1.5, color: colors.textTertiary, marginTop: 2 },
  tags: { flexDirection: 'row', gap: 6, marginBottom: 14, flexWrap: 'wrap' },
  tag: { borderWidth: 0.5, borderColor: colors.primary, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.5, color: colors.primary },
  content: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textPrimary, lineHeight: 24, marginBottom: 20 },
  sectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 2, color: colors.primary, marginBottom: 12 },
  placesWrap: { borderTopWidth: 0.5, borderTopColor: colors.borderLight, paddingTop: 18, marginBottom: 20 },
  placeItem: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  placeNum: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 16, color: colors.textTertiary, width: 24 },
  placeName: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 14, color: colors.primary, lineHeight: 18 },
  placeAddr: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  youtubeWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 0.5, borderColor: colors.borderLight, padding: 12, marginBottom: 16 },
  youtubeLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 2, color: colors.primary },
  youtubeTitle: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  hashTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  hashTag: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.primary },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 18, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: colors.borderLight, marginBottom: 24 },
  actionBtn: { alignItems: 'center', gap: 6 },
  actionCount: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.primary },
  actionLabel: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 1.5, color: colors.textTertiary },
  commentsWrap: { paddingBottom: 20 },
  emptyComment: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1.5, color: colors.textTertiary, textAlign: 'center', paddingVertical: 24 },
  commentItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  commentAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bgTertiary, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  commentAvatarText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.primary },
  commentUser: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.primary, marginBottom: 2 },
  commentContent: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  deleteBtn: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 1.5, color: colors.accent },
  commentInput: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: 0.5, borderTopColor: colors.borderLight, backgroundColor: colors.bgPrimary },
  commentBox: { flex: 1, backgroundColor: colors.bgTertiary, borderRadius: 3, paddingHorizontal: 14, paddingVertical: 10, fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textPrimary, maxHeight: 80 },
  sendBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 3 },
  sendText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 2, color: 'white' },
});
