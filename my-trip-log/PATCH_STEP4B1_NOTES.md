# 🌙 Step 4-B-1 — 새 여행 + 여행 상세 다크모드

## 변경 파일 (2개)
1. `app/trips/new.tsx` — 새 여행 만들기 (자식 컴포넌트 0개, 가장 단순)
2. `app/trip/[id]/index.tsx` — 여행 상세 (자식 3개: OverviewTab, StatCard, InfoRow)

## 기대 효과
- ✅ 홈 → "새 여행 계획하기" 또는 + 버튼 → 다크 화면
- ✅ 여행 카드 탭 → 상세 화면 다크
- ✅ 일정/기록/비용/체크 통계 카드 모두 다크

## 다음 (Step 4-B-2)
- log-new (일기 쓰기) + expense-new (가계부 입력)

## 위험 신호
- ❌ 새 여행 만들기 화면 흰 배경
- ❌ 여행 상세 통계 카드 안 보임
→ 즉시 롤백:
```bash
git checkout -- app/trips/new.tsx 'app/trip/[id]/index.tsx'
```
