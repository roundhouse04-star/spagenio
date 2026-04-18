# 🎁 D3 + D4 + D6 통합 패치

## 📦 들어있는 것

### D3 - 교통 데이터 마이그레이션
- `export-transit-data.sh` - spagenio DB → JSON export 스크립트
- `src/data/transit.json` - 초기 빈 데이터 (export 후 채워짐)
- `app/(tabs)/transit-list.tsx` - 도시 목록 화면 (참고용)
- `app/transit/[city]/index.tsx` - 도시별 노선/역 검색 화면

### D4 - 다크모드
- `src/theme/theme.ts` - Colors가 시스템 테마 자동 감지 (Proxy)
- `app/_layout.tsx` - StatusBar 자동 + useColorScheme 감지

### D6 - 화면 전환 애니메이션
- `app/_layout.tsx` - Stack 옵션에 `animation: 'slide_from_right'` 등 추가
- 카드: 오른쪽 슬라이드 (250ms)
- 모달: 아래에서 위로 슬라이드 (300ms)
- 탭/온보딩: 페이드 (200~300ms)

---

## 📥 적용 순서

### 1️⃣ 필요한 라이브러리

```bash
cd ~/projects/spagenio/my-trip-log
npx expo install expo-secure-store
```

### 2️⃣ zip 풀기

```bash
unzip -o ~/Downloads/d-rest.zip -d ~/projects/spagenio/my-trip-log/
```

### 3️⃣ 교통 데이터 export (있는 경우만)

```bash
cd ~/projects/spagenio/my-trip-log
chmod +x export-transit-data.sh
bash export-transit-data.sh
```

데이터가 spagenio DB에 있으면 `src/data/transit.json`에 채워집니다.
없으면 빈 JSON으로 유지 (앱은 폴백 도시 카드 표시).

⚠️ jq 필요:
```bash
brew install jq  # 없으면 설치
```

### 4️⃣ git 반영

```bash
cd ~/projects/spagenio
git add my-trip-log/
git commit -m "feat: my-trip-log D3+D4+D6 (교통 데이터 + 다크모드 + 화면 전환)"
git push
```

### 5️⃣ Expo 재시작

```bash
cd ~/projects/spagenio/my-trip-log
# Ctrl+C
npx expo start --clear
```

---

## 🎯 테스트

### 화면 전환 (D6) - 즉시 효과!
- 홈 → 여행 카드 클릭 → 오른쪽에서 슬라이드 ✨
- 여행 상세 → "+ 일정 추가" → 아래에서 모달 슬라이드 ✨
- 탭 전환 → 부드러운 페이드 ✨

### 다크모드 (D4)
1. 휴대폰 **설정** → **디스플레이 및 밝기** → **다크 모드**
2. 앱이 자동으로 다크 테마로 변경
3. 다시 라이트 → 자동 복귀

### 교통 (D3)
1. **도구** 탭 (또는 별도 탭) → 교통 → 도시 카드 클릭
2. 노선 목록 → 클릭하면 역 펼침
3. 상단 검색창에서 역 이름 검색

---

## 💡 알아둘 것

- **다크모드**: `Colors.primary` 같은 코드는 그대로 사용 가능. Proxy가 자동으로 라이트/다크 매핑.
- **화면 전환**: `Stack.Screen options`에 `animation` 추가만 하면 됨.
- **교통 데이터**: spagenio DB 구조에 따라 export 결과가 달라질 수 있음. 빈 JSON이면 폴백 도시 카드 표시.
