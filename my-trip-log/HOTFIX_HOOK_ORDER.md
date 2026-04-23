# 🩹 Hot Fix: CategoryPieChart Hook Order

## 문제
CategoryPieChart.tsx 에서 React Hooks 규칙 위반.
early return (if stats.length === 0 return null) 뒤에 useMemo 호출하면 
렌더 간 hook 순서가 달라져서 크래시.

## 에러 메시지
```
Rendered more hooks than during the previous render.
CategoryPieChart (src/components/CategoryPieChart.tsx:55:26)
```

## 수정
useMemo를 early return 위로 이동:

```tsx
// Before (❌)
if (stats.length === 0 || total <= 0) {
  return null;
}
const pieHtml = useMemo(...);

// After (✅)
const pieHtml = useMemo(...);
if (stats.length === 0 || total <= 0) {
  return null;
}
```

## 적용
```bash
cd ~/projects/spagenio && \
unzip -o ~/Downloads/chart-fix.zip && \
cd my-trip-log && \
pkill -f expo; pkill -f metro && \
npx expo start --clear
```
