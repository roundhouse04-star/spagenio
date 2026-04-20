import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import WebView from 'react-native-webview';
import { Colors, Typography, Spacing, Shadows } from '@/theme/theme';
import { addTripItem } from '@/db/items';
import { TRIP_ITEM_CATEGORIES } from '@/db/schema';
import { showMapOptions } from '@/utils/maps';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  type?: string;
}

export default function ItemNewScreen() {
  const params = useLocalSearchParams<{ id: string; day: string }>();
  const tripId = Number(params.id);
  const defaultDay = Number(params.day) || 1;

  const [title, setTitle] = useState('');
  const [day, setDay] = useState(String(defaultDay));
  const [startTime, setStartTime] = useState('');
  const [category, setCategory] = useState(TRIP_ITEM_CATEGORIES[0].key);
  const [location, setLocation] = useState('');
  const [cost, setCost] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  // 지도 관련
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // 장소 자동완성 검색 (Nominatim - 무료, API 키 불필요)
  useEffect(() => {
    if (!location || location.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    // 좌표가 이미 선택된 상태면 재검색하지 않음
    if (lat !== 0 && lng !== 0) return;

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=5&accept-language=ko`,
          { headers: { 'User-Agent': 'my-trip-log-app/1.0' } }
        );
        const data: NominatimResult[] = await res.json();
        setSearchResults(data);
        setShowResults(true);
      } catch (err) {
        console.error('[Nominatim 검색 실패]', err);
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [location, lat, lng]);

  const handleSelectResult = (result: NominatimResult) => {
    setLocation(result.display_name.split(',')[0]);
    setLat(parseFloat(result.lat));
    setLng(parseFloat(result.lon));
    setShowResults(false);
    setSearchResults([]);
  };

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('알림', '일정 제목을 입력해주세요');
      return;
    }
    if (saving) return;
    setSaving(true);

    try {
      await addTripItem({
        tripId,
        title: title.trim(),
        day: Number(day) || 1,
        startTime: startTime.trim(),
        category,
        location: location.trim(),
        lat,
        lng,
        cost: Number(cost) || 0,
        currency: 'KRW',
        memo: memo.trim(),
      });
      router.back();
    } catch (err) {
      console.error('[일정 저장 실패]', err);
      Alert.alert('오류', '일정 저장에 실패했어요');
      setSaving(false);
    }
  }, [saving, title, tripId, day, startTime, category, location, lat, lng, cost, memo]);

  // OpenStreetMap 지도 HTML (무료, 키 불필요)
  const mapHtml = lat && lng ? `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
          html, body { margin: 0; padding: 0; height: 100%; }
          #map { height: 100%; width: 100%; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          const map = L.map('map', { zoomControl: true, attributionControl: false })
            .setView([${lat}, ${lng}], 15);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
          }).addTo(map);
          L.marker([${lat}, ${lng}]).addTo(map)
            .bindPopup(${JSON.stringify(location)}).openPopup();
        </script>
      </body>
    </html>
  ` : '';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Text style={styles.cancelText}>취소</Text>
        </Pressable>
        <Text style={styles.headerTitle}>일정 추가</Text>
        <Pressable
          onPress={handleSave}
          disabled={saving || !title.trim()}
          style={styles.headerBtn}
        >
          <Text
            style={[
              styles.saveText,
              (!title.trim() || saving) && styles.saveTextDisabled,
            ]}
          >
            {saving ? '저장 중...' : '저장'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* 일정 제목 */}
        <View style={styles.field}>
          <Text style={styles.label}>
            일정 제목 <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="예: 스카이트리 방문"
            placeholderTextColor={Colors.textTertiary}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Day + 시간 */}
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Day</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="number-pad"
              value={day}
              onChangeText={setDay}
            />
          </View>
          <View style={[styles.field, { flex: 2 }]}>
            <Text style={styles.label}>시간</Text>
            <TextInput
              style={styles.input}
              placeholder="14:00"
              placeholderTextColor={Colors.textTertiary}
              value={startTime}
              onChangeText={setStartTime}
            />
          </View>
        </View>

        {/* 카테고리 */}
        <View style={styles.field}>
          <Text style={styles.label}>카테고리</Text>
          <View style={styles.categoryGrid}>
            {TRIP_ITEM_CATEGORIES.map((cat) => (
              <Pressable
                key={cat.key}
                onPress={() => setCategory(cat.key)}
                style={[
                  styles.categoryChip,
                  category === cat.key && styles.categoryChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    category === cat.key && styles.categoryChipTextActive,
                  ]}
                >
                  {cat.icon} {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 장소 + 자동완성 + 지도 */}
        <View style={styles.field}>
          <Text style={styles.label}>장소</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 도쿄 스카이트리"
            placeholderTextColor={Colors.textTertiary}
            value={location}
            onChangeText={(text) => {
              setLocation(text);
              // 사용자가 편집 시 기존 좌표 리셋 → 재검색 유도
              if (lat !== 0 || lng !== 0) {
                setLat(0);
                setLng(0);
              }
            }}
          />

          {/* 검색 중 스피너 */}
          {searching && (
            <View style={styles.searchingBox}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.searchingText}>장소 검색 중...</Text>
            </View>
          )}

          {/* 검색 결과 자동완성 */}
          {showResults && searchResults.length > 0 && lat === 0 && (
            <View style={styles.resultsBox}>
              {searchResults.map((r) => (
                <Pressable
                  key={r.place_id}
                  onPress={() => handleSelectResult(r)}
                  style={styles.resultItem}
                >
                  <Text style={styles.resultName} numberOfLines={1}>
                    📍 {r.display_name.split(',')[0]}
                  </Text>
                  <Text style={styles.resultAddress} numberOfLines={1}>
                    {r.display_name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* 좌표 잡힘 → 지도 표시 */}
          {lat !== 0 && lng !== 0 && (
            <>
              <View style={styles.mapBox}>
                <WebView
                  source={{ html: mapHtml }}
                  style={styles.map}
                  scrollEnabled={false}
                  javaScriptEnabled
                  scalesPageToFit={Platform.OS === 'android'}
                />
              </View>
              <View style={styles.mapActions}>
                <Text style={styles.coordText}>
                  📌 {lat.toFixed(5)}, {lng.toFixed(5)}
                </Text>
                <Pressable
                  onPress={() =>
                    showMapOptions({ lat, lng, label: location })
                  }
                  style={styles.openMapBtn}
                >
                  <Text style={styles.openMapBtnText}>🗺️ 지도 앱 열기</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        {/* 비용 */}
        <View style={styles.field}>
          <Text style={styles.label}>비용</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="numeric"
            value={cost}
            onChangeText={setCost}
          />
        </View>

        {/* 메모 */}
        <View style={styles.field}>
          <Text style={styles.label}>메모</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="추가 정보나 주의사항을 적어두세요"
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={4}
            value={memo}
            onChangeText={setMemo}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  headerBtn: { minWidth: 50, paddingVertical: 4 },
  headerTitle: {
    fontSize: Typography.bodyLarge,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cancelText: {
    fontSize: Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  saveText: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'right',
  },
  saveTextDisabled: { color: Colors.textTertiary },
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  field: { gap: Spacing.xs },
  label: {
    fontSize: Typography.labelMedium,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  required: { color: '#EF4444' },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: Typography.bodyMedium,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: Spacing.md },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipText: {
    fontSize: Typography.labelMedium,
    color: Colors.textPrimary,
  },
  categoryChipTextActive: {
    color: Colors.textOnPrimary,
    fontWeight: '700',
  },
  searchingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
  },
  searchingText: {
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
  },
  resultsBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.soft,
  },
  resultItem: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultName: {
    fontSize: Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  resultAddress: {
    fontSize: Typography.labelSmall,
    color: Colors.textSecondary,
  },
  mapBox: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.sm,
  },
  map: { flex: 1 },
  mapActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  coordText: {
    fontSize: Typography.labelSmall,
    color: Colors.textTertiary,
  },
  openMapBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.primary + '15',
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  openMapBtnText: {
    fontSize: Typography.labelSmall,
    fontWeight: '700',
    color: Colors.primary,
  },
});
