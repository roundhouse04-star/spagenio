# 🩹 Hotfix — discover.tsx CategoryChip styles 누락 수정

## 문제
Step 4-A-2 적용 후 탐색 탭 진입 시 에러:
```
TypeError: Cannot read property 'chip' of undefined
```

## 원인
`CategoryChip` 자식 컴포넌트 호출 4곳이 모두 멀티라인 self-closing 태그였는데,
이전 패치의 정규식이 lambda의 `=>` 때문에 매치 실패.

## 수정
4곳 모두 `styles={styles}` props 추가:
- 탐색 탭의 카테고리 칩 (전체 + 6개)
- 탐색 탭의 팁 카테고리 칩 (전체 + 6개)

## 적용 방법
```bash
cd ~/projects/spagenio && unzip -o ~/Downloads/hotfix-discover.zip
```

다른 파일(index.tsx, me.tsx)은 검증 결과 문제없음.
