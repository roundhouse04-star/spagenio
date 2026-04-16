import { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { RefreshCw, MapPin, Navigation } from 'lucide-react-native';
import { colors } from '../theme/colors';

const API_BASE = 'https://travel.spagenio.com';
const RADII = [0.5, 1, 2, 5, 10];

const toFullUrl = (url) => {
  if (!url) return url;
  if (url.startsWith('http')) return url;
  return API_BASE + url;
};

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
        setError('Location permission required');
        setLoading(false); return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setLocation(coords);
      await loadNearby(coords);
    } catch (e) {
      setError('Cannot get location');
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

  const distLabel = (km) => km < 1 ? `${Math.round(km * 1000)}M` : `${km.toFixed(1)}KM`;

  return (
    <SafeAreaView style={S.container}>
      <View style={S.header}>
        <View>
          <Text style={S.title}>Nearby</Text>
          <Text style={S.subtitle}>DISCOVER AROUND YOU</Text>
        </View>
        <TouchableOpacity onPress={getLocation}>
          <RefreshCw size={18} color={colors.primary} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={S.errorWrap}>
          <Text style={S.errorText}>{error.toUpperCase()}</Text>
          <TouchableOpacity onPress={getLocation}>
            <Text style={S.retryText}>RETRY</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {savedNearby.length > 0 && (
        <View style={S.savedBanner}>
          <Text style={S.savedBannerTitle}>SAVED PLACES NEARBY</Text>
          {savedNearby.slice(0, 2).map((p, i) => (
            <View key={i} style={S.savedItem}>
              <View style={{ flex: 1 }}>
                <Text style={S.savedName}>{p.placeName}</Text>
                <Text style={S.savedPost}>{p.postTitle}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={S.savedDist}>{distLabel(p.distKm)}</Text>
                <TouchableOpacity onPress={() => openMaps(p.lat, p.lng, p.placeName)} style={S.mapsBtn}>
                  <Text style={S.mapsBtnText}>DIRECTIONS</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={S.radii}>
        {RADII.map(r => (
          <TouchableOpacity key={r} onPress={() => { setRadius(r); if (location) loadNearby(location); }}
            style={[S.radiusBtn, radius === r && S.radiusBtnActive]}>
            <Text style={[S.radiusBtnText, radius === r && S.radiusBtnTextActive]}>
              {r < 1 ? `${r * 1000}M` : `${r}KM`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={S.tabs}>
        <TouchableOpacity style={[S.tab, tab === 'around' && S.tabActive]} onPress={() => setTab('around')}>
          <Text style={[S.tabText, tab === 'around' && S.tabTextActive]}>AROUND</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.tab, tab === 'saved' && S.tabActive]} onPress={() => setTab('saved')}>
          <Text style={[S.tabText, tab === 'saved' && S.tabTextActive]}>SAVED {savedNearby.length > 0 ? `(${savedNearby.length})` : ''}</Text>
        </TouchableOpacity>
      </View>

      {tab === 'around' && (
        loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> :
        !location ? (
          <View style={S.emptyWrap}>
            <MapPin size={36} color={colors.textTertiary} strokeWidth={1.5} />
            <Text style={S.emptyTitle}>LOCATION NEEDED</Text>
            <TouchableOpacity style={S.permBtn} onPress={getLocation}>
              <Text style={S.permBtnText}>ENABLE LOCATION</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList data={posts} keyExtractor={i => i.id}
            contentContainerStyle={{ padding: 20, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={S.postCard} activeOpacity={0.9}
                onPress={() => navigation.navigate('PostDetail', { post: item, user })}>
                {item.images?.[0] && <Image source={{ uri: toFullUrl(item.images[0]) }} style={S.postImage} />}
                <View style={S.postBody}>
                  {item._dist !== undefined && <Text style={S.postDist}>{distLabel(item._dist)} AWAY</Text>}
                  <Text style={S.postTitle}>{item.title}</Text>
                  <Text style={S.postUser}>{item.userNickname}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={S.emptyWrap}>
                <Text style={S.emptyTitle}>NO POSTS NEARBY</Text>
                <Text style={S.emptyDesc}>TRY EXPANDING YOUR RADIUS</Text>
              </View>
            }
          />
        )
      )}

      {tab === 'saved' && (
        savedNearby.length === 0 ? (
          <View style={S.emptyWrap}>
            <Navigation size={36} color={colors.textTertiary} strokeWidth={1.5} />
            <Text style={S.emptyTitle}>NO SAVED PLACES NEARBY</Text>
          </View>
        ) : (
          <FlatList data={savedNearby} keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ padding: 20 }}
            renderItem={({ item }) => (
              <View style={S.savedCard}>
                {item.image && <Image source={{ uri: toFullUrl(item.image) }} style={S.savedCardImage} />}
                <View style={{ flex: 1 }}>
                  <Text style={S.savedCardName}>{item.placeName}</Text>
                  <Text style={S.savedCardPost}>{item.postTitle}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={S.savedCardDist}>{distLabel(item.distKm)}</Text>
                  <TouchableOpacity onPress={() => openMaps(item.lat, item.lng, item.placeName)} style={S.mapsBtn}>
                    <Text style={S.mapsBtnText}>GO</Text>
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
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  title: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 26, color: colors.primary, letterSpacing: -0.8, marginBottom: 2 },
  subtitle: { fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 2, color: colors.textTertiary, textTransform: 'uppercase' },
  errorWrap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, marginHorizontal: 20, marginTop: 14, backgroundColor: colors.bgTertiary },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1.5, color: colors.primary },
  retryText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.5, color: colors.primary },
  savedBanner: { backgroundColor: colors.primary, marginHorizontal: 20, marginTop: 14, padding: 16 },
  savedBannerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 2, color: 'white', marginBottom: 10 },
  savedItem: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.2)' },
  savedName: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 14, color: 'white' },
  savedPost: { fontFamily: 'Inter_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  savedDist: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.5, color: 'white' },
  radii: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  radiusBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5, borderColor: colors.border },
  radiusBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  radiusBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.5, color: colors.textTertiary },
  radiusBtnTextActive: { color: 'white' },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 20, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  tab: { paddingBottom: 4 },
  tabActive: { borderBottomWidth: 1, borderBottomColor: colors.primary },
  tabText: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1.5, color: colors.textTertiary },
  tabTextActive: { fontFamily: 'Inter_600SemiBold', color: colors.primary },
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 2, color: colors.textSecondary, marginTop: 10 },
  emptyDesc: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textTertiary, textAlign: 'center' },
  permBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, marginTop: 14 },
  permBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 2, color: 'white' },
  postCard: { marginBottom: 24 },
  postImage: { width: '100%', height: 220, resizeMode: 'cover' },
  postBody: { paddingTop: 10 },
  postDist: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 2, color: colors.primary, marginBottom: 4 },
  postTitle: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 18, color: colors.primary, letterSpacing: -0.3, marginBottom: 4 },
  postUser: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1.5, color: colors.textTertiary, textTransform: 'uppercase' },
  savedCard: { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight, alignItems: 'center' },
  savedCardImage: { width: 60, height: 60 },
  savedCardName: { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 14, color: colors.primary, marginBottom: 2 },
  savedCardPost: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textTertiary },
  savedCardDist: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.5, color: colors.primary },
  mapsBtn: { backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 6 },
  mapsBtnText: { color: 'white', fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.5 },
});
