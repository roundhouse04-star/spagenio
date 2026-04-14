import { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, Alert, SafeAreaView, TextInput, ActivityIndicator, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const API_BASE = 'https://travel.spagenio.com';
const TRAVEL_STYLES = [
  { key: 'food', icon: '🍜', label: '맛집' },
  { key: 'culture', icon: '🏛️', label: '문화' },
  { key: 'nature', icon: '🌿', label: '자연' },
  { key: 'photo', icon: '📸', label: '포토' },
  { key: 'activity', icon: '🏄', label: '액티비티' },
  { key: 'shopping', icon: '🛍️', label: '쇼핑' },
  { key: 'longstay', icon: '🏠', label: '장기체류' },
  { key: 'market', icon: '🏪', label: '시장' },
];

export default function ProfileScreen({ user, onLogout }) {
  const [posts, setPosts] = useState([]);
  const [userData, setUserData] = useState(user);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ nickname: '', bio: '', preferredStyles: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    if (!user) return;
    try {
      const [postsRes, userRes] = await Promise.all([
        fetch(`${API_BASE}/api/posts?userId=${user.id}`),
        fetch(`${API_BASE}/api/users/${user.id}`),
      ]);
      if (postsRes.ok) setPosts(await postsRes.json());
      if (userRes.ok) {
        const data = await userRes.json();
        setUserData(data);
      }
    } catch (e) {}
  };

  const openEdit = () => {
    setEditForm({
      nickname: userData.nickname || '',
      bio: userData.bio || '',
      preferredStyles: userData.preferredStyles || [],
    });
    setEditing(true);
  };

  const pickProfileImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('권한 필요', '갤러리 접근 권한이 필요해요.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) {
      setEditForm(p => ({ ...p, profileImage: result.assets[0].uri }));
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setUserData(updated);
        setEditing(false);
        Alert.alert('완료!', '프로필이 저장됐어요.');
      }
    } catch (e) { Alert.alert('오류', '저장에 실패했어요.'); }
    setSaving(false);
  };

  const toggleStyle = (key) => {
    setEditForm(p => ({
      ...p,
      preferredStyles: p.preferredStyles.includes(key)
        ? p.preferredStyles.filter(k => k !== key)
        : [...p.preferredStyles, key],
    }));
  };

  const logout = () => Alert.alert('로그아웃', '로그아웃 하시겠어요?', [
    { text: '취소', style: 'cancel' },
    { text: '로그아웃', style: 'destructive', onPress: onLogout },
  ]);

  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <Text style={S.title}>👤 프로필</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={S.logoutBtn}>로그아웃</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 프로필 카드 */}
        <View style={S.profileCard}>
          <View style={S.avatarWrap}>
            {userData?.profileImage
              ? <Image source={{ uri: userData.profileImage }} style={S.avatar} />
              : <View style={[S.avatar, { backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ fontSize: 28, color: 'white', fontWeight: '800' }}>
                    {userData?.nickname?.[0]?.toUpperCase()}
                  </Text>
                </View>
            }
          </View>
          <Text style={S.nickname}>{userData?.nickname}</Text>
          {userData?.bio && <Text style={S.bio}>{userData.bio}</Text>}

          {/* 여행 성향 */}
          {userData?.preferredStyles?.length > 0 && (
            <View style={S.styleTags}>
              {userData.preferredStyles.map(key => {
                const s = TRAVEL_STYLES.find(t => t.key === key);
                if (!s) return null;
                return (
                  <View key={key} style={S.styleTag}>
                    <Text style={S.styleTagText}>{s.icon} {s.label}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* 통계 */}
          <View style={S.statsRow}>
            {[['게시물', posts.length], ['팔로워', userData?.followerIds?.length || 0], ['팔로잉', userData?.followingIds?.length || 0]].map(([label, count]) => (
              <View key={label} style={S.statItem}>
                <Text style={S.statCount}>{count}</Text>
                <Text style={S.statLabel}>{label}</Text>
              </View>
            ))}
          </View>

          {/* 편집 버튼 */}
          <TouchableOpacity style={S.editBtn} onPress={openEdit}>
            <Text style={S.editBtnText}>✏️ 프로필 편집</Text>
          </TouchableOpacity>
        </View>

        {/* 내 게시물 */}
        <Text style={S.sectionTitle}>내 게시물 ({posts.length})</Text>
        {posts.length === 0
          ? <Text style={S.empty}>아직 게시물이 없어요. 첫 여행 이야기를 올려보세요!</Text>
          : <View style={S.grid}>
              {posts.map(post => (
                <TouchableOpacity key={post.id} style={S.gridItem} activeOpacity={0.9}>
                  {post.images?.[0]
                    ? <Image source={{ uri: post.images[0] }} style={S.gridImage} />
                    : <View style={[S.gridImage, { backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ fontSize: 28 }}>✈️</Text>
                      </View>
                  }
                  <Text style={S.gridTitle} numberOfLines={1}>{post.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
        }
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* 프로필 편집 모달 */}
      <Modal visible={editing} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
          <View style={S.modalHeader}>
            <TouchableOpacity onPress={() => setEditing(false)}>
              <Text style={{ fontSize: 15, color: '#9ca3af' }}>취소</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#1a1a2e' }}>프로필 편집</Text>
            <TouchableOpacity onPress={saveProfile} disabled={saving}>
              {saving ? <ActivityIndicator color="#4f46e5" /> : <Text style={{ fontSize: 15, color: '#4f46e5', fontWeight: '700' }}>저장</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {/* 프로필 사진 */}
            <TouchableOpacity style={S.photoBtn} onPress={pickProfileImage}>
              {editForm.profileImage
                ? <Image source={{ uri: editForm.profileImage }} style={S.editAvatar} />
                : <View style={[S.editAvatar, { backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 24, color: 'white', fontWeight: '800' }}>
                      {userData?.nickname?.[0]?.toUpperCase()}
                    </Text>
                  </View>
              }
              <Text style={S.photoBtnText}>사진 변경</Text>
            </TouchableOpacity>

            <View>
              <Text style={S.editLabel}>닉네임</Text>
              <TextInput style={S.editInput} value={editForm.nickname}
                onChangeText={t => setEditForm(p => ({ ...p, nickname: t }))} />
            </View>

            <View>
              <Text style={S.editLabel}>소개</Text>
              <TextInput style={[S.editInput, { height: 80, textAlignVertical: 'top' }]}
                value={editForm.bio} onChangeText={t => setEditForm(p => ({ ...p, bio: t }))}
                multiline placeholder="여행에 대한 소개를 써주세요" placeholderTextColor="#9ca3af" />
            </View>

            <View>
              <Text style={S.editLabel}>여행 성향</Text>
              <View style={S.styleGrid}>
                {TRAVEL_STYLES.map(s => {
                  const active = editForm.preferredStyles.includes(s.key);
                  return (
                    <TouchableOpacity key={s.key} onPress={() => toggleStyle(s.key)}
                      style={[S.styleBtn, active && S.styleBtnActive]}>
                      <Text style={[S.styleBtnText, active && { color: '#4f46e5' }]}>
                        {s.icon} {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  header: { backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 20, fontWeight: '900', color: '#1a1a2e' },
  logoutBtn: { fontSize: 13, color: '#ef4444', fontWeight: '600' },
  profileCard: { backgroundColor: 'white', margin: 16, borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  avatarWrap: { marginBottom: 14 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  nickname: { fontSize: 20, fontWeight: '800', color: '#1a1a2e', marginBottom: 4 },
  bio: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 12, lineHeight: 18 },
  styleTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 14 },
  styleTag: { backgroundColor: '#eef2ff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  styleTagText: { fontSize: 11, color: '#4f46e5', fontWeight: '700' },
  statsRow: { flexDirection: 'row', width: '100%', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 16, marginTop: 8, marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statCount: { fontSize: 20, fontWeight: '800', color: '#1a1a2e' },
  statLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  editBtn: { backgroundColor: '#f3f4f6', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  editBtnText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a2e', marginHorizontal: 16, marginBottom: 10 },
  empty: { textAlign: 'center', color: '#9ca3af', fontSize: 13, paddingVertical: 30, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  gridItem: { width: '47%', backgroundColor: 'white', borderRadius: 12, overflow: 'hidden' },
  gridImage: { width: '100%', height: 120, resizeMode: 'cover' },
  gridTitle: { padding: 8, fontSize: 12, fontWeight: '600', color: '#1a1a2e' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  photoBtn: { alignItems: 'center', gap: 8 },
  editAvatar: { width: 80, height: 80, borderRadius: 40 },
  photoBtnText: { fontSize: 14, color: '#4f46e5', fontWeight: '600' },
  editLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  editInput: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 14, fontSize: 14, color: '#1a1a2e' },
  styleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  styleBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6' },
  styleBtnActive: { backgroundColor: '#eef2ff' },
  styleBtnText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
});
