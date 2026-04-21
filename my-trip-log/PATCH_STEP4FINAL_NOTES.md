# 🌙 Step 4-Final v4 — 전체 앱 다크모드 완성

## v4 변경 (이전 zip들 모두 폐기)
- v1 ~ v3에서 자동 마이그레이션 누락된 케이스들 모두 잡음
- ✅ **자식 함수 본문 styles 사용 검사 추가**
- ✅ **open tag (`<X>...</X>`) 호출부도 검사 추가** (이전엔 `/>`만 봤음)

## v4에서 추가 수정된 것
- `app/settings/terms.tsx` - Section 자식 컴포넌트 styles props 추가 + 호출부 6곳
- `app/settings/privacy.tsx` - Section 동일
- `app/trip/[id]/receipts.tsx` - InfoRow 자식 + 호출부 5곳

## 검증 통과 (정밀)
- ✅ 21/21 문법 OK
- ✅ Colors 직접 참조: 0
- ✅ rgba(250,248,243) 잔존: 0
- ✅ 자식 컴포넌트 본문 styles 사용 vs props: 0건 누락
- ✅ 자식 컴포넌트 호출부 styles 전달: 0건 누락 (self-closing + open tag 모두)
- ✅ 모든 function 시그니처 props 누락: 0
- ✅ useMemo import 누락: 0

## 적용
```bash
cd ~/projects/spagenio && unzip -o ~/Downloads/step4final.zip
pkill -f expo; pkill -f metro
cd my-trip-log
npx expo start --clear
```

## 위험 시 롤백
```bash
cd ~/projects/spagenio/my-trip-log
git checkout -- app src
pkill -f expo; pkill -f metro
npx expo start --clear
```
