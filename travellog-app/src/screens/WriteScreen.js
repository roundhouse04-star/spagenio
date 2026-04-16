import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, SafeAreaView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image as ImageIcon, Camera, X } from 'lucide-react-native';
import { colors } from '../theme/colors';

const API_BASE = 'https://travel.spagenio.com';

const STYLES = [
  { key: 'food', label: 'FOOD' },
  { key: 'culture', label: 'CULTURE' },
  { key: 'nature', label: 'NATURE' },
  { key: 'photo', label: 'PHOTO' },
  { key: 'activity', label: 'ACTIVITY' },
  { key: 'shopping', label: 'SHOPPING' },
  { key: 'longstay', label: 'LONG STAY' },
  { key: 'market', label: 'MARKET' },
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
        Alert.alert('Published', 'Your story has been shared.', [{ text: 'OK', onPress: () => {
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
        <Text style={S.title}>Write</Text>
        <Text style={S.subtitle}>SHARE YOUR JOURNEY</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Image */}
        {previewImage ? (
          <View style={S.imagePreviewWrap}>
            <Image source={{ uri: previewImage }} style={S.imagePreview} />
            <TouchableOpacity style={S.removeImg} onPress={() => { setPreviewImage(null); setForm(p => ({ ...p, imageUrl: '' })); }}>
              <X size={16} color="white" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={S.imageBtns}>
            <TouchableOpacity style={S.imageBtn} onPress={pickImage}>
              <ImageIcon size={24} color={colors.primary} strokeWidth={1.5} />
              <Text style={S.imageBtnText}>GALLERY</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.imageBtn} onPress={takePhoto}>
              <Camera size={24} color={colors.primary} strokeWidth={1.5} />
              <Text style={S.imageBtnText}>CAMERA</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Title */}
        <Text style={S.label}>TITLE</Text>
        <TextInput style={S.titleInput} placeholder="Your story title..."
          placeholderTextColor={colors.textMuted} value={form.title}
          onChangeText={t => setForm(p => ({ ...p, title: t }))} />

        {/* Location */}
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 24 }}>
          <View style={{ flex: 1 }}>
            <Text style={S.label}>COUNTRY</Text>
            <TextInput style={S.input} placeholder="USA" placeholderTextColor={colors.textMuted}
              value={form.country} onChangeText={t => setForm(p => ({ ...p, country: t }))} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.label}>CITY</Text>
            <TextInput style={S.input} placeholder="New York" placeholderTextColor={colors.textMuted}
              value={form.city} onChangeText={t => setForm(p => ({ ...p, city: t }))} />
          </View>
        </View>

        {/* Content */}
        <Text style={[S.label, { marginTop: 24 }]}>STORY</Text>
        <TextInput style={S.contentInput}
          placeholder="Tell us about your journey..." placeholderTextColor={colors.textMuted}
          value={form.content} onChangeText={t => setForm(p => ({ ...p, content: t }))}
          multiline numberOfLines={8} textAlignVertical="top" />

        {/* Travel Styles */}
        <Text style={[S.label, { marginTop: 24 }]}>TRAVEL STYLE</Text>
        <View style={S.styleGrid}>
          {STYLES.map(s => {
            const active = selectedStyles.includes(s.key);
            return (
              <TouchableOpacity key={s.key} onPress={() => toggleStyle(s.key)}
                style={[S.styleBtn, active && S.styleBtnActive]}>
                <Text style={[S.styleBtnText, active && S.styleBtnTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={S.submitBtn} onPress={submit} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={S.submitText}>PUBLISH</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  title: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 26, color: colors.primary, letterSpacing: -0.8, marginBottom: 2 },
  subtitle: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 2, color: colors.textTertiary, textTransform: 'uppercase' },
  imagePreviewWrap: { position: 'relative', marginBottom: 24 },
  imagePreview: { width: '100%', height: 200, resizeMode: 'cover' },
  removeImg: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(30,42,58,0.85)', justifyContent: 'center', alignItems: 'center' },
  imageBtns: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  imageBtn: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 24, borderWidth: 0.5, borderColor: colors.border, borderStyle: 'dashed' },
  imageBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 2, color: colors.primary },
  label: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 2, color: colors.textTertiary, marginBottom: 6 },
  titleInput: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 20, color: colors.primary, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border, letterSpacing: -0.3 },
  input: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textPrimary, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  contentInput: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textPrimary, minHeight: 140, lineHeight: 22, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  styleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  styleBtn: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 0.5, borderColor: colors.border },
  styleBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  styleBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.5, color: colors.textTertiary },
  styleBtnTextActive: { color: 'white' },
  submitBtn: { backgroundColor: colors.primary, paddingVertical: 16, alignItems: 'center', marginTop: 32, borderRadius: 3 },
  submitText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 3, color: 'white' },
});
