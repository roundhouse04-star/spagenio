import { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';

const API_BASE = 'https://travel.spagenio.com';
const RADII = [0.5, 1, 2, 5, 10];

export default function NearbyScreen({ user }) {
  const navigation = useNavigation();
  const [location, setLocation] = useState(null);
  const [posts, setPosts] = useState([]);
  const [savedNearby, setSavedNearby] = useState([]);
  const [radius, setRadius] = useState(2);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('around');
  const [error, setError] = useState('');

  const getLocation = async () => {
    setLoading(true); setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('위치 권한이 필요해요. 설정에서 허용해주세요.');
        setLoading(false); return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setLocation(coords);
      await loadNearby(coords);
    } catch (e) {
      setError('위치를 가져올 수 없어요.');
    }
    setLoading(false);
  };

  const loadNearby = async (loc) => {
    try {
      const [postsRes, savedRes] = await Promise.all([
        fetch(`${API_BASE}/api/posts/nearby?lat=${loc.lat}&lng=${loc.lng}&radius=${radius}`),
        user ? fetch(`${API_BASE}/api/users/${user.id}/saved-nearby?lat=${loc.lat}&lng=${loc.lng}&radius=1`) : Promise.resolve(null),
      ]);
      if (postsRes.ok) setPosts(await postsRes.json());
      if (savedRes?.ok) setSavedNearby(await savedRes.json());
    } catch (e) {}
  };

  useEffect(() => { getLocation(); }, []);

  const openMaps = (lat, lng, name) => {
    Linking.openURL(`maps://app?daddr=${lat},${lng}&q=${encodeURIComponent(name)}`);
  };

  const distLabel = (km) => km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;

  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <Text style={S.title}>📍 내 주변</Text>
        <TouchableOpacity onPress={getLocation} style={S.refreshBtn}>
          <Text style={S.refreshText}>🔄 새로고침</Text>
        </TouchableOpacity>
      </View>

      {/* 위치 오류 */}
      {error ? (
        <View style={S.errorWrap}>
          <Text style={S.errorText}>⚠️ {error}</Text>
          <TouchableOpacity onPress={getLocation}>
            <Text style={S.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 저장 장소 근처 배너 */}
      {savedNearby.length > 0 && (
        <View style={S.savedBanner}>
          <Text style={S.savedBannerTitle}>🔔 저장한 장소가 근처에 있어요!</Text>
          {savedNearby.slice(0, 2).map((p, i) => (
            <View key={i} style={S.savedItem}>
              <View style={{ flex: 1 }}>
                <Text style={S.savedName}>{p.placeName}</Text>
                <Text style={S.savedPost}>{p.postTitle}</Text>
              </View>
              <View style={S.savedRight}>
                <Text style={S.savedDist}>{distLabel(p.distKm)}</Text>
                <TouchableOpacity onPress={() => openMaps(p.lat, p.lng, p.placeName)} style={S.mapsBtn}>
                  <Text style={S.mapsBtnText}>길안내</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 반경 선택 */}
      <View style={S.radii}>
        {RADII.map(r => (
          <TouchableOpacity key={r} onPress={() => { setRadius(r); if (location) loadNearby(location); }}
            style={[S.radiusBtn, radius === r && S.radiusBtnActive]}>
            <Text style={[S.radiusBtnText, radius === r && S.radiusBtnTextActive]}>
              {r < 1 ? `${r * 1000}m` : `${r}km`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 탭 */}
      <View style={S.tabs}>
        {[['around', '🗺️ 주변 게시물'], ['saved', `🔖 저장 장소 근처${savedNearby.length > 0 ? ` (${savedNearby.length})` : ''}`]].map(([key, label]) => (
          <TouchableOpacity key={key} style={[S.tab, tab === key && S.tabActive]} onPress={() => setTab(key)}>
            <Text style={[S.tabText, tab === key && S.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 주변 게시물 */}
      {tab === 'around' && (
        loading ? <ActivityIndicator color="#4f46e5" style={{ marginTop: 40 }} /> :
        !location ? (
          <View style={S.emptyWrap}>
            <Text style={S.emptyIcon}>📍</Text>
            <Text style={S.emptyTitle}>위치 권한이 필요해요</Text>
            <TouchableOpacity style={S.permBtn} onPress={getLocation}>
              <Text style={S.permBtnText}>위치 허용하기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList data={posts} keyExtractor={i => i.id}
            contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={S.postCard} activeOpacity={0.9}
                onPress={() => navigation.navigate('PostDetail', { post: item, user })}>
                {item.images?.[0] && <Image source={{ uri: item.images[0] }} style={S.postImage} />}
                <View style={S.postBody}>
                  <Text style={S.postTitle}>{item.title}</Text>
                  <View style={S.postMeta}>
                    <Text style={S.postUser}>@{item.userNickname}</Text>
                    {item._dist && <Text style={S.postDist}>📍 {distLabel(item._dist)}</Text>}
                  </View>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={S.emptyWrap}>
                <Text style={S.emptyIcon}>🔍</Text>
                <Text style={S.emptyTitle}>근처에 게시물이 없어요</Text>
                <Text style={S.emptyDesc}>반경을 늘려보거나 여행 후기를 올려보세요!</Text>
              </View>
            }
          />
        )
      )}

      {/* 저장 장소 탭 */}
      {tab === 'saved' && (
        savedNearby.length === 0 ? (
          <View style={S.emptyWrap}>
            <Text style={S.emptyIcon}>🔖</Text>
            <Text style={S.emptyTitle}>근처에 저장한 장소가 없어요</Text>
            <Text style={S.emptyDesc}>게시물에서 🔖 버튼으로 저장해보세요!</Text>
          </View>
        ) : (
          <FlatList data={savedNearby} keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 20 }}
            renderItem={({ item }) => (
              <View style={S.savedCard}>
                {item.image && <Image source={{ uri: item.image }} style={S.savedCardImage} />}
                <View style={{ flex: 1 }}>
                  <Text style={S.savedCardName}>{item.placeName}</Text>
                  <Text style={S.savedCardPost}>{item.postTitle}</Text>
                  {item.address && <Text style={S.savedCardAddr}>{item.address}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={S.savedCardDist}>{distLabel(item.distKm)}</Text>
                  <TouchableOpacity onPress={() => openMaps(item.lat, item.lng, item.placeName)} style={S.mapsBtn}>
                    <Text style={S.mapsBtnText}>길안내</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  header: { backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 20, fontWeight: '900', color: '#1a1a2e' },
  refreshBtn: { backgroundColor: '#eef2ff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  refreshText: { fontSize: 13, color: '#4f46e5', fontWeight: '700' },
  errorWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fef2f2', padding: 12, marginHorizontal: 12, marginTop: 10, borderRadius: 10 },
  errorText: { fontSize: 13, color: '#dc2626', flex: 1 },
  retryText: { fontSize: 13, color: '#4f46e5', fontWeight: '700' },
  savedBanner: { backgroundColor: '#4f46e5', margin: 12, borderRadius: 16, padding: 14, gap: 10 },
  savedBannerTitle: { fontSize: 13, fontWeight: '800', color: 'white', marginBottom: 4 },
  savedItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 10 },
  savedName: { fontSize: 13, fontWeight: '700', color: 'white' },
  savedPost: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  savedRight: { alignItems: 'flex-end', gap: 4 },
  savedDist: { fontSize: 13, fontWeight: '800', color: 'white' },
  radii: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  radiusBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: '#eee' },
  radiusBtnActive: { backgroundColor: '#eef2ff', borderColor: '#4f46e5' },
  radiusBtnText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  radiusBtnTextActive: { color: '#4f46e5' },
  tabs: { flexDirection: 'row', margin: 12, backgroundColor: '#f3f4f6', borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: 'white' },
  tabText: { fontSize: 12, color: '#9ca3af', fontWeight: '600' },
  tabTextActive: { color: '#4f46e5', fontWeight: '700' },
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#374151' },
  emptyDesc: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
  permBtn: { backgroundColor: '#4f46e5', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10, marginTop: 6 },
  permBtnText: { color: 'white', fontSize: 14, fontWeight: '700' },
  postCard: { backgroundColor: 'white', borderRadius: 16, overflow: 'hidden' },
  postImage: { width: '100%', height: 160, resizeMode: 'cover' },
  postBody: { padding: 12 },
  postTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', marginBottom: 6 },
  postMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  postUser: { fontSize: 12, color: '#9ca3af' },
  postDist: { fontSize: 12, fontWeight: '700', color: '#4f46e5' },
  savedCard: { backgroundColor: 'white', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  savedCardImage: { width: 56, height: 56, borderRadius: 10, resizeMode: 'cover' },
  savedCardName: { fontSize: 14, fontWeight: '700', color: '#1a1a2e', marginBottom: 2 },
  savedCardPost: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  savedCardAddr: { fontSize: 11, color: '#9ca3af' },
  savedCardDist: { fontSize: 14, fontWeight: '800', color: '#4f46e5' },
  mapsBtn: { backgroundColor: '#4f46e5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  mapsBtnText: { color: 'white', fontSize: 11, fontWeight: '700' },
});
