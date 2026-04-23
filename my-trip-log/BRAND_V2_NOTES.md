# 🎨 홈 헤더 정리

## 변경
이전 brand.zip 에서 추가했던 "✈️ Spagenio / My Trip Log" 영역 제거.
대신 간결한 페이지 타이틀 "나의 여행기록" 추가.

## 적용 전후

### 변경 전 (brand.zip 적용 상태)
```
✈️ Spagenio          (큰 글씨)
   My Trip Log       (부제)
────────────
편안한 새벽이에요
이태호님
```

### 변경 후 (brand-v2.zip 적용 상태)
```
나의 여행기록        (28pt, bold)

편안한 새벽이에요
이태호님
```

## 스플래시는 유지
- `app/_layout.tsx`의 커스텀 스플래시 ("Spa / Trip Log") 는 그대로 유지
- 앱 시작 시 1-2초만 보이므로 부담 없음

## 적용
```bash
cd ~/projects/spagenio && \
unzip -o ~/Downloads/brand-v2.zip && \
cd my-trip-log && \
pkill -f expo; pkill -f metro && \
npx expo start --clear
```
