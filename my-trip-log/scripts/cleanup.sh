#!/bin/bash
# My Trip Log 프로젝트 정리 스크립트
# 사용: bash scripts/cleanup.sh
#
# 다음 파일들을 제거합니다:
# - *.bak, *.bak-* 백업 파일들
# - .DS_Store (macOS)
# - __MACOSX (zip 풀 때 생기는 찌꺼기)
# - 빈 ThemeProvider.tsx (Phase 1-B에서 새로 만들어질 예정)

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🧹 프로젝트 정리 중..."

# .bak 파일
BAK_COUNT=$(find . -type f \( -name "*.bak" -o -name "*.bak-*" \) -not -path "./node_modules/*" | wc -l | tr -d ' ')
if [ "$BAK_COUNT" -gt 0 ]; then
  echo "  → .bak 파일 $BAK_COUNT개 제거"
  find . -type f \( -name "*.bak" -o -name "*.bak-*" \) -not -path "./node_modules/*" -delete
fi

# .DS_Store
DS_COUNT=$(find . -name ".DS_Store" -not -path "./node_modules/*" | wc -l | tr -d ' ')
if [ "$DS_COUNT" -gt 0 ]; then
  echo "  → .DS_Store $DS_COUNT개 제거"
  find . -name ".DS_Store" -not -path "./node_modules/*" -delete
fi

# __MACOSX
if [ -d "__MACOSX" ]; then
  echo "  → __MACOSX 디렉토리 제거"
  rm -rf __MACOSX
fi

echo "✅ 정리 완료"
