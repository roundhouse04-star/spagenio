# 👤 Step 4-A-3 — 내정보 탭 다크모드 마이그레이션 (메인 탭 5개 완성!)

## 변경 파일 (1개)
- `app/(tabs)/me.tsx`

## 자식 컴포넌트 5개에 props 전달
- `Stat`, `Divider`, `SectionTitle`, `MenuRow` → `styles` 받음
- `MenuRowSwitch` → `styles` + `colors` 받음 (Switch trackColor 인라인 사용)

## 메인 탭 다크모드 진행 (5/5 완성!)
| 탭 | Step | 상태 |
|---|---|---|
| 🏠 홈 | 4-A-2 | ✅ |
| ✈️ 여행 | 4-A-1 | ✅ |
| 🧰 도구 | 4-A-2 | ✅ |
| 🌍 탐색 | 4-A-2 | ✅ |
| 👤 내정보 | 4-A-3 | ✅ NEW |

## 적용 후 테스트

1. **앱 정상 실행**
2. **내정보 탭 들어가서**:
   - 라이트 모드: 평소처럼 보이는지
   - **다크 모드 토글 → 즉시 다크 #1A1F2B로 변환** ✨
   - 프로필 카드, 통계 박스, 메뉴 항목 모두 다크
   - **알림 토글 스위치 색상**: 다크 모드에서 골드 트랙
3. **5개 탭 모두 다크인지 확인**

## 위험 신호
- ❌ 통계 박스 안 보임
- ❌ 메뉴 항목 깨짐
- ❌ 다크/라이트 토글 안 됨
→ 즉시 롤백:
```bash
git checkout -- 'app/(tabs)/me.tsx'
```

## 다음 (Step 4-B / 4-C)
- 모달/디테일 화면 마이그레이션
  - trip/[id]/index, item-new, log-new, expense-new, receipt-scan, receipts
  - trips/new, ai-itinerary
  - expenses/index, [id]
  - explore/[cityId], tip/[tipId]
  - transit/[city]
  - 온보딩 nickname, terms
  - settings 화면들

총 ~15개 파일. Step 4-B (자주 보는 7개) + Step 4-C (나머지 8개)로 분할 예정.
