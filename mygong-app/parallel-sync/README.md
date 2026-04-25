# ⚡ 병렬 동기화 + UI 개선

## 🎯 개선 내용

### Before (순차 처리)
```
아티스트 10명 동기화:
권진아 (70초) → 완료
아이유 (70초) → 완료
에스파 (70초) → 완료
...
⏱️ 총 700초 (11분 40초) 😱
```

### After (병렬 처리)
```
아티스트 10명 동기화:
[권진아, 아이유, 에스파, BTS, 뉴진스, 아이브, 트와이스, 블랙핑크] (동시 8명!)
→ 70초 완료 ✅

[세븐틴, 르세라핌] (나머지 2명)
→ 70초 완료 ✅

⏱️ 총 140초 (2분 20초) 🚀
5배 빠름!
```

---

## 📦 설치 파일

1. **syncManager-parallel.ts** - 병렬 처리 로직
2. **SyncProgressOverlay.tsx** - 진행 상황 UI
3. **USAGE_EXAMPLE.tsx** - 사용 예시

---

## 🚀 적용 방법

### 1️⃣ syncManager 교체

```bash
cd ~/projects/spagenio/mygong-app

# 백업
cp src/services/syncManager.ts src/services/syncManager.ts.backup

# 적용
cp ~/Downloads/parallel-sync/syncManager-parallel.ts src/services/syncManager.ts
```

### 2️⃣ UI 컴포넌트 추가

```bash
# 컴포넌트 폴더 생성 (없으면)
mkdir -p src/components

# UI 컴포넌트 복사
cp ~/Downloads/parallel-sync/SyncProgressOverlay.tsx src/components/
```

### 3️⃣ 홈 화면 수정

**파일: `src/screens/HomeScreen.tsx` (또는 해당 파일)**

```typescript
import { useState } from 'react';
import { syncAllArtists, type SyncProgress } from '@/services/syncManager';
import { SyncProgressOverlay } from '@/components/SyncProgressOverlay';

export function HomeScreen() {
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncAll = async () => {
    setIsSyncing(true);
    setSyncProgress({ total: 0, completed: 0, current: [], failed: 0 });

    try {
      await syncAllArtists('future-only', (progress) => {
        setSyncProgress(progress);
      });

      setTimeout(() => {
        setIsSyncing(false);
        setSyncProgress(null);
      }, 3000);
    } catch (error) {
      console.error('Sync failed:', error);
      setIsSyncing(false);
    }
  };

  return (
    <View>
      <TouchableOpacity onPress={handleSyncAll} disabled={isSyncing}>
        <Text>{isSyncing ? '동기화 중...' : '⚡ 전체 동기화'}</Text>
      </TouchableOpacity>

      <SyncProgressOverlay progress={syncProgress} visible={isSyncing} />
    </View>
  );
}
```

---

## 🎨 UI 미리보기

### 동기화 시작
```
┌─────────────────────────┐
│   ⏳ 동기화 중...        │
│                         │
│  ▓▓▓▓▓░░░░░░░░░ 35%    │
│     3 / 10              │
│                         │
│  현재 진행 중:          │
│  ⏳ 권진아               │
│  ⏳ 아이유               │
│  ⏳ 에스파               │
│  ⏳ BTS                 │
│                         │
└─────────────────────────┘
```

### 동기화 완료
```
┌─────────────────────────┐
│   ✅ 동기화 완료!        │
│                         │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%  │
│     10 / 10             │
│                         │
│  모든 아티스트           │
│  동기화 완료!            │
└─────────────────────────┘
```

---

## ⚙️ 설정 조정

### 병렬 개수 변경

**파일: `syncManager.ts` 17번 줄**

```typescript
// 기본값: 8개
const PARALLEL_BATCH_SIZE = 8;

// 더 빠르게 (서버 부하 주의!)
const PARALLEL_BATCH_SIZE = 12;

// 안전하게
const PARALLEL_BATCH_SIZE = 4;
```

---

## 📊 성능 비교

| 아티스트 수 | 순차 (기존) | 병렬 8개 | 개선 |
|------------|------------|----------|------|
| 1명 | 70초 | 70초 | 동일 |
| 4명 | 280초 | 70초 | **4배** ⚡ |
| 8명 | 560초 | 70초 | **8배** ⚡⚡ |
| 10명 | 700초 | 140초 | **5배** ⚡ |
| 16명 | 1120초 | 140초 | **8배** ⚡⚡ |
| 20명 | 1400초 | 210초 | **6.6배** ⚡⚡ |

---

## 🧪 테스트

1. Metro 재시작
```bash
npx expo start -c
```

2. 앱에서 **전체 동기화** 실행

3. Metro 로그 확인:
```log
[sync] Total artists: 10 Batches: 2
[sync] Batch 1/2: [권진아, 아이유, 에스파, BTS, 뉴진스, 아이브, 트와이스, 블랙핑크]
[kopis] 권진아 mode=future-only ...
[kopis] 아이유 mode=future-only ...
...
[sync] ✅ 권진아 completed (5 events)
[sync] ✅ 아이유 completed (12 events)
...
[sync] Batch 2/2: [세븐틴, 르세라핌]
...
```

4. UI에서 진행 상황 확인!

---

## 💡 추가 기능

### 개별 동기화 버튼

**아티스트 목록 화면에서:**

```typescript
{artists.map(artist => (
  <View key={artist.id}>
    <Text>{artist.name}</Text>
    <TouchableOpacity 
      onPress={() => syncOneArtist(artist.id)}
    >
      <Text>🔄</Text>
    </TouchableOpacity>
  </View>
))}
```

---

## ⚠️ 주의사항

1. **네트워크 안정성**
   - WiFi 권장
   - 불안정하면 실패 가능성 ↑

2. **배터리 소모**
   - 병렬 처리 = 배터리 더 소모
   - 충전 중에 권장

3. **메모리**
   - 8개 동시 = 메모리 사용 ↑
   - 저사양 기기는 4개로 조정

---

## 🎉 완료!

**10명 동기화: 11분 → 2분** 

**5배 빠른 동기화를 즐기세요!** 🚀
