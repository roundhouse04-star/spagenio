# ☁️ iCloud / Google Drive 자동 백업 설정

## 🎯 핵심

**사용자가 따로 뭘 안 해도** OS가 알아서 데이터를 클라우드에 백업하도록 설정합니다.
- iOS → iCloud
- Android → Google Drive

## ✨ 변경 내용

### 1. `app.json` — 백업 설정 활성화
- `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` (App Store 심사 자동 통과)
- `android.allowBackup: true` (이미 기본값이지만 명시)
  - Android Auto Backup: 24시간마다 Wi-Fi+충전 중일 때 Google Drive에 자동 (앱당 25MB 무료)

### 2. `src/db/database.ts` — DB 위치 명확화
- `getDBPath()` 함수 추가 — DB 실제 경로 반환 (디버깅/검증용)
- expo-sqlite v16+는 기본적으로 Documents 폴더에 저장 → iCloud 백업 자동 대상
- 초기화 로그에 경로 출력

### 3. `app/settings/backup.tsx` — 백업 안내 화면 (신규)
- 사용자에게 "내 데이터가 어디에 저장되고 백업되는지" 명확히 안내
- 현재 데이터 통계 (여행/일기/지출/영수증 개수)
- 자동 백업 활성화 방법 안내 (OS별)
- 수동 내보내기/가져오기 버튼

### 4. `app/(tabs)/me.tsx` — 메뉴 추가
- "데이터" 섹션 맨 위에 "☁️ 자동 백업" 메뉴 추가
- 누르면 backup 화면으로 이동

### 5. `src/utils/backup.ts` — 영수증 필드 누락 버그 수정
- 기존 importData가 영수증 필드 4개를 INSERT에 빠뜨림 → JSON 백업/복원 시 영수증 사진 사라지는 버그
- → 4개 필드 모두 INSERT에 추가

## 📊 어떻게 작동하는가

### iOS (iCloud)
1. iOS는 매일 밤 (Wi-Fi 연결 시) 모든 앱 데이터를 iCloud에 자동 백업
2. Documents/ 폴더와 SQLite DB가 백업 대상에 자동 포함
3. 새 iPhone으로 옮길 때 iCloud 복원 시 모든 데이터 그대로

### Android (Auto Backup)
1. Android 6.0+ 의 Auto Backup 기능
2. 24시간마다 Wi-Fi + 충전 중일 때 Google Drive에 자동 (앱당 25MB)
3. 새 폰에 같은 Google 계정으로 앱 설치하면 자동 복원

### 사용자가 해야 할 것
- iOS: 설정 → Apple ID → iCloud → iCloud Drive 켜기 → 앱 목록에서 Spagenio 켜기
- Android: 설정 → 시스템 → 백업 → Google One으로 백업 켜기

대부분의 사용자는 이미 켜져 있어요.

## 🚀 적용

```bash
cd ~/projects/spagenio && \
unzip -o ~/Downloads/icloud-backup.zip && \
cd my-trip-log

# app.json 변경됐으니 prebuild 필요할 수 있음 (네이티브 빌드 시)
# 개발 중이면 그냥 expo start로 충분
pkill -f expo; pkill -f metro
npx expo start --clear
```

## ✅ 테스트

1. **앱 → 나 → 데이터 → 자동 백업** 메뉴 확인
2. 안내 화면 + 데이터 통계 표시 확인
3. 콘솔 로그에서 `[DB] Path: ...` 확인 (개발 모드)

## 📦 출시 시 EAS 빌드

iCloud 백업이 진짜 작동하는 건 **EAS 빌드 (또는 native 빌드)** 후에만:

```bash
eas build --profile preview --platform ios
# TestFlight 업로드 → 데이터 입력
# 앱 삭제 → 재설치 → iCloud에서 복원되는지 확인
```

## ⚠️ 주의

- 영수증 사진은 expo-image-picker가 file:// 경로로 저장 → 사진 자체도 백업되어야 함
  - iOS는 자동 (Documents 안에 있으면 백업)
  - Android는 사진은 외부 저장소에 있을 수 있어 별도 처리 필요할 수 있음
- 매우 큰 DB (100MB 초과 등)는 백업에서 제외될 수 있음 (현재 우리는 한참 못 미침)

## 💡 다음 단계 (선택)

- 사용자 계정 + 진짜 클라우드 동기화 (Supabase / Firebase) — 출시 후 v2.0 정도로
- 영수증 사진 별도 클라우드 업로드 (R2 / S3) — 사진이 많아지면 필요
