#!/bin/bash
# ==========================================
# 수동 배포 스크립트
# 파일 수정 후 이 스크립트 실행하면 자동 push + 배포
# ==========================================
PROJECT="/Users/roundhouse04/projects/spagenio/ai-router-dashboard"
cd "$PROJECT"

# .bak 파일 gitignore에 추가
if ! grep -q "*.bak" .gitignore 2>/dev/null; then
  echo "*.bak" >> .gitignore
fi

# 커밋 메시지 입력
if [ -z "$1" ]; then
  MSG="🔄 업데이트 $(date '+%Y-%m-%d %H:%M')"
else
  MSG="$1"
fi

echo "📦 배포 시작: $MSG"

# Git push
git add .
git commit -m "$MSG"
git push origin main

echo "✅ GitHub push 완료!"
echo "🔄 자동 배포 감지 중... (최대 30초 소요)"
