import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, SafeAreaView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const API_BASE = 'https://travel.spagenio.com';
const STYLES = [
  { key: 'food', icon: '🍜', label: '맛집' },
  { key: 'culture', icon: '🏛️', label: '문화' },
  { key: 'nature', icon: '🌿', label: '자연' },
  { key: 'photo', icon: '📸', label: '포토' },
  { key: 'activity', icon: '🏄', label: '액티비티' },
  { key: 'shopping', icon: '🛍️', label: '쇼핑' },
  { key: 'longstay', icon: '🏠', label: '장기체류' },
  { key: 'market', icon: '🏪', label: '시장' },
];

export default function WriteScreen({ user }) {
  const [form, setForm] = useState({ title: '', content: '', country: '', city: '', imageUrl: '' });
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const toggleStyle = (key) => {
    setSelectedStyles(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '갤러리 접근 권한이 필요해요.'); return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [16, 9], quality: 0.8,
    });
    if (!result.canceled) {
      setPreviewImage(result.assets[0].uri);
      setForm(p => ({ ...p, imageUrl: result.assets[0].uri }));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 권한이 필요해요.'); return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [16, 9], quality: 0.8,
    });
    if (!result.canceled) {
      setPreviewImage(result.assets[0].uri);
      setForm(p => ({ ...p, imageUrl: result.assets[0].uri }));
    }
  };

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      Alert.alert('알림', '제목과 내용을 입력해주세요.'); return;
    }
    setLoading(true);
    try {
      const body = {
        ...form,
        travelStyles: selectedStyles,
        userId: user?.id,
        images: form.imageUrl ? [form.imageUrl] : [],
        visibility: 'public',
      };
      const res = await fetch(`${API_BASE}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        Alert.alert('완료!', '게시물이 등록됐어요 ✈️', [{ text: '확인', onPress: () => {
          setForm({ title: '', content: '', country: '', city: '', imageUrl: '' });
          setSelectedStyles([]);
          setPreviewImage(null);
        }}]);
      } else {
        Alert.alert('오류', '등록에 실패했어요.');
      }
    } catch (e) {
      Alert.alert('오류', '서버 연결 오류');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <Text style={S.title}>✏️ 글쓰기</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>

        {/* 이미지 선택 */}
        <View style={S.imageSection}>
          {previewImage ? (
            <View>
              <Image source={{ uri: previewImage }} style={S.imagePreview} />
              <TouchableOpacity style={S.removeImg} onPress={() => { setPreviewImage(null); setForm(p => ({ ...p, imageUrl: '' })); }}>
                <Text style={{ color: 'white', fontSize: 13, fontWeight: '700' }}>✕ 제거</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={S.imageBtns}>
              <TouchableOpacity style={S.imageBtn} onPress={pickImage}>
                <Text style={S.imageBtnIcon}>🖼️</Text>
                <Text style={S.imageBtnText}>갤러리</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.imageBtn} onPress={takePhoto}>
                <Text style={S.imageBtnIcon}>📷</Text>
                <Text style={S.imageBtnText}>카메라</Text>
              </TouchableOpacity>
              <View style={S.imageDivider}><Text style={{ color: '#9ca3af', fontSize: 12 }}>또는</Text></View>
              <TextInput style={[S.input, { flex: 1, marginBottom: 0 }]} placeholder="이미지 URL 입력"
                placeholderTextColor="#9ca3af" value={form.imageUrl}
                onChangeText={t => { setForm(p => ({ ...p, imageUrl: t })); setPreviewImage(t); }} />
            </View>
          )}
        </View>

        <TextInput style={S.input} placeholder="제목 *" placeholderTextColor="#9ca3af"
          value={form.title} onChangeText={t => setForm(p => ({ ...p, title: t }))} />

        <TextInput style={[S.input, { height: 120, textAlignVertical: 'top' }]}
          placeholder="여행 이야기를 들려주세요..." placeholderTextColor="#9ca3af"
          value={form.content} onChangeText={t => setForm(p => ({ ...p, content: t }))}
          multiline numberOfLines={5} />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TextInput style={[S.input, { flex: 1 }]} placeholder="나라" placeholderTextColor="#9ca3af"
            value={form.country} onChangeText={t => setForm(p => ({ ...p, country: t }))} />
          <TextInput style={[S.input, { flex: 1 }]} placeholder="도시" placeholderTextColor="#9ca3af"
            value={form.city} onChangeText={t => setForm(p => ({ ...p, city: t }))} />
        </View>

        {/* 여행 스타일 */}
        <Text style={S.label}>✈️ 여행 스타일</Text>
        <View style={S.styleGrid}>
          {STYLES.map(s => {
            const active = selectedStyles.includes(s.key);
            return (
              <TouchableOpacity key={s.key} onPress={() => toggleStyle(s.key)}
                style={[S.styleBtn, active && S.styleBtnActive]}>
                <Text style={[S.styleBtnText, active && S.styleBtnTextActive]}>
                  {s.icon} {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={S.submitBtn} onPress={submit} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={S.submitText}>게시물 올리기 ✈️</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  header: { backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 20, fontWeight: '900', color: '#1a1a2e' },
  label: { fontSize: 13, fontWeight: '700', color: '#374151' },
  input: { backgroundColor: 'white', borderRadius: 12, padding: 14, fontSize: 14, color: '#1a1a2e', borderWidth: 1, borderColor: '#e5e7eb' },
  imageSection: { backgroundColor: 'white', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  imageBtns: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  imageBtn: { alignItems: 'center', gap: 4, backgroundColor: '#f3f4f6', borderRadius: 12, padding: 12, width: 72 },
  imageBtnIcon: { fontSize: 24 },
  imageBtnText: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  imageDivider: { alignItems: 'center' },
  imagePreview: { width: '100%', height: 180, resizeMode: 'cover' },
  removeImg: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  styleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  styleBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'white', borderWidth: 1.5, borderColor: '#eee' },
  styleBtnActive: { backgroundColor: '#eef2ff', borderColor: '#4f46e5' },
  styleBtnText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  styleBtnTextActive: { color: '#4f46e5' },
  submitBtn: { backgroundColor: '#4f46e5', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  submitText: { color: 'white', fontSize: 16, fontWeight: '800' },
});
