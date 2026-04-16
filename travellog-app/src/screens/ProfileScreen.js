import { useState, useEffect } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, TextInput, Modal, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { Settings, LogOut, Edit2, X } from 'lucide-react-native';
import { colors } from '../theme/colors';

const API_BASE = 'https://travel.spagenio.com';

const toFullUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('data:')) return null;
  return API_BASE + url;
};

export default function ProfileScreen({ user, onLogout }) {
  const navigation = useNavigation();
  const [profile, setProfile] = useState(user);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ nickname: '', bio: '', profileImage: '' });
  const [followModal, setFollowModal] = useState(null);
  const [followUsers, setFollowUsers] = useState([]);
  const [pushConsent, setPushConsent] = useState(user?.pushConsent !== false);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [userRes, postsRes] = await Promise.all([
        fetch(`${API_BASE}/api/users/${user.id}`),
        fetch(`${API_BASE}/api/users/${user.id}/posts`),
      ]);
      if (userRes.ok) {
        const u = await userRes.json();
        setProfile(u);
        setPushConsent(u.pushConsent !== false);
      }
      if (postsRes.ok) setPosts(await postsRes.json());
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openEdit = () => {
    setEditForm({
      nickname: profile.nickname || '',
      bio: profile.bio || '',
      profileImage: profile.profileImage || '',
    });
    setEditing(true);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '갤러리 접근 권한이 필요해요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      try {
        const formData = new FormData();
        const uri = asset.uri;
        const name = uri.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(name);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('file', { uri, name, type });
        const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          setEditForm(f => ({ ...f, profileImage: data.url }));
        }
      } catch (e) {
        Alert.alert('오류', '이미지 업로드 실패');
      }
    }
  };

  const saveProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditing(false);
        loadData();
      }
    } catch (e) {
      Alert.alert('오류', '저장 실패');
    }
  };

  const openFollowModal = async (type) => {
    try {
      const ids = type === 'followers' ? profile.followerIds : profile.followingIds;
      if (!ids?.length) {
        setFollowUsers([]);
        setFollowModal(type);
        return;
      }
      const users = await Promise.all(ids.map(id => fetch(`${API_BASE}/api/users/${id}`).then(r => r.ok ? r.json() : null)));
      setFollowUsers(users.filter(Boolean));
      setFollowModal(type);
    } catch (e) {}
  };

  const togglePushConsent = async () => {
    const newVal = !pushConsent;
    setPushConsent(newVal);
    try {
      await fetch(`${API_BASE}/api/push/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, consent: newVal }),
      });
    } catch (e) {}
  };

  if (loading) return (
    <SafeAreaView style={S.container}>
      <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={S.container}>
      <View style={S.topBar}>
        <Text style={S.topTitle}>PROFILE</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <TouchableOpacity onPress={openEdit}>
            <Edit2 size={18} color={colors.primary} strokeWidth={1.5} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onLogout}>
            <LogOut size={18} color={colors.primary} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView>
        <View style={S.profileWrap}>
          <View style={S.avatarBig}>
            {toFullUrl(profile.profileImage) ? (
              <Image source={{ uri: toFullUrl(profile.profileImage) }} style={S.avatarImg} />
            ) : (
              <Text style={S.avatarBigText}>{profile.nickname?.[0]?.toUpperCase()}</Text>
            )}
          </View>
          <Text style={S.nickname}>{profile.nickname}</Text>
          {profile.bio ? (
            <Text style={S.bio}>{profile.bio}</Text>
          ) : (
            <Text style={S.bioEmpty}>TRAVELER</Text>
          )}

          <View style={S.stats}>
            <View style={S.statItem}>
              <Text style={S.statNum}>{posts.length}</Text>
              <Text style={S.statLabel}>POSTS</Text>
            </View>
            <View style={S.statDivider} />
            <TouchableOpacity style={S.statItem} onPress={() => openFollowModal('followers')}>
              <Text style={S.statNum}>{profile.followerIds?.length || 0}</Text>
              <Text style={S.statLabel}>FOLLOWERS</Text>
            </TouchableOpacity>
            <View style={S.statDivider} />
            <TouchableOpacity style={S.statItem} onPress={() => openFollowModal('following')}>
              <Text style={S.statNum}>{profile.followingIds?.length || 0}</Text>
              <Text style={S.statLabel}>FOLLOWING</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={S.pushToggle} onPress={togglePushConsent}>
            <Text style={S.pushLabel}>PUSH NOTIFICATIONS</Text>
            <View style={[S.switch, pushConsent && S.switchOn]}>
              <View style={[S.switchDot, pushConsent && S.switchDotOn]} />
            </View>
          </TouchableOpacity>
        </View>

        <Text style={S.sectionLabel}>POSTS</Text>

        {posts.length === 0 ? (
          <Text style={S.empty}>NO POSTS YET</Text>
        ) : (
          <View style={S.grid}>
            {posts.map(item => (
              <TouchableOpacity key={item.id} style={S.gridCell} activeOpacity={0.9}
                onPress={() => navigation.navigate('PostDetail', { post: item, user })}>
                {item.images?.[0]
                  ? <Image source={{ uri: toFullUrl(item.images[0].endsWith('.mp4') ? item.images[0].replace('_video.mp4', '_thumb.jpg') : item.images[0]) }} style={S.gridImg} />
                  : <View style={[S.gridImg, { backgroundColor: colors.bgTertiary, justifyContent: 'center', alignItems: 'center' }]}><Text>✈</Text></View>
                }
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editing} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
          <View style={S.modalHeader}>
            <TouchableOpacity onPress={() => setEditing(false)}>
              <Text style={S.modalCancel}>CANCEL</Text>
            </TouchableOpacity>
            <Text style={S.modalTitle}>EDIT PROFILE</Text>
            <TouchableOpacity onPress={saveProfile}>
              <Text style={S.modalSave}>SAVE</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 24 }}>
            <TouchableOpacity onPress={pickImage} style={S.editAvatarWrap}>
              {toFullUrl(editForm.profileImage) ? (
                <Image source={{ uri: toFullUrl(editForm.profileImage) }} style={S.editAvatar} />
              ) : (
                <View style={[S.editAvatar, { backgroundColor: colors.bgTertiary, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={S.avatarBigText}>{editForm.nickname?.[0]?.toUpperCase()}</Text>
                </View>
              )}
              <Text style={S.changePhoto}>CHANGE PHOTO</Text>
            </TouchableOpacity>

            <View style={{ marginTop: 24 }}>
              <Text style={S.inputLabel}>NICKNAME</Text>
              <TextInput style={S.input} value={editForm.nickname}
                onChangeText={t => setEditForm(f => ({ ...f, nickname: t }))}
                placeholderTextColor={colors.textMuted} />
            </View>

            <View style={{ marginTop: 18 }}>
              <Text style={S.inputLabel}>BIO</Text>
              <TextInput style={[S.input, { height: 80, textAlignVertical: 'top' }]} value={editForm.bio}
                onChangeText={t => setEditForm(f => ({ ...f, bio: t }))}
                placeholder="Tell us about yourself..."
                placeholderTextColor={colors.textMuted}
                multiline />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Followers/Following Modal */}
      <Modal visible={!!followModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFollowModal(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
          <View style={S.modalHeader}>
            <View style={{ width: 60 }} />
            <Text style={S.modalTitle}>{followModal === 'followers' ? 'FOLLOWERS' : 'FOLLOWING'}</Text>
            <TouchableOpacity onPress={() => setFollowModal(null)}>
              <X size={20} color={colors.primary} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
          {followUsers.length === 0 ? (
            <Text style={S.empty}>NO USERS</Text>
          ) : (
            <FlatList data={followUsers} keyExtractor={u => u.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <View style={S.userRow}>
                  {toFullUrl(item.profileImage) ? (
                    <Image source={{ uri: toFullUrl(item.profileImage) }} style={S.userAvatar} />
                  ) : (
                    <View style={[S.userAvatar, { backgroundColor: colors.bgTertiary, justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.primary }}>{item.nickname?.[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={S.userName}>{item.nickname}</Text>
                    {item.bio && <Text style={S.userBio} numberOfLines={1}>{item.bio}</Text>}
                  </View>
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  topTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 2.5, color: colors.primary },
  profileWrap: { alignItems: 'center', padding: 24, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  avatarBig: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.bgTertiary, justifyContent: 'center', alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: colors.primary, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarBigText: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 32, color: colors.primary },
  nickname: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 22, color: colors.primary, letterSpacing: -0.5, marginBottom: 4 },
  bio: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18, maxWidth: 280 },
  bioEmpty: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 2, color: colors.textTertiary },
  stats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingTop: 20, borderTopWidth: 0.5, borderTopColor: colors.borderLight, width: '100%' },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 0.5, height: 32, backgroundColor: colors.borderLight },
  statNum: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 20, color: colors.primary, marginBottom: 2 },
  statLabel: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 1.5, color: colors.textTertiary },
  pushToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, marginTop: 20, borderTopWidth: 0.5, borderTopColor: colors.borderLight, width: '100%' },
  pushLabel: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1.5, color: colors.textSecondary },
  switch: { width: 36, height: 20, borderRadius: 10, backgroundColor: colors.border, padding: 2 },
  switchOn: { backgroundColor: colors.primary },
  switchDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'white' },
  switchDotOn: { marginLeft: 16 },
  sectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 2, color: colors.primary, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  gridCell: { width: '33.2%', aspectRatio: 1 },
  gridImg: { width: '100%', height: '100%' },
  empty: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 2, color: colors.textTertiary, textAlign: 'center', marginTop: 60 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  modalTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 2.5, color: colors.primary },
  modalCancel: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1.5, color: colors.textTertiary },
  modalSave: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.5, color: colors.primary },
  editAvatarWrap: { alignItems: 'center' },
  editAvatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 10, overflow: 'hidden' },
  changePhoto: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 2, color: colors.primary },
  inputLabel: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 2, color: colors.textTertiary, marginBottom: 6 },
  input: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textPrimary, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  userAvatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  userName: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.primary },
  userBio: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textTertiary, marginTop: 2 },
});
