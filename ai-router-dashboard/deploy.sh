#!/bin/bash
# ==========================================
# ai-router-dashboard 배포 스크립트
# 위치: ~/projects/spagenio/ai-router-dashboard/deploy.sh
# ==========================================
PROJECT="/Users/roundhouse04/projects/spagenio"
AI_DIR="ai-router-dashboard"

cd "$PROJECT"

# .gitignore 업데이트
GITIGNORE="$PROJECT/.gitignore"
add_ignore() {
  grep -qxF "$1" "$GITIGNORE" 2>/dev/null || echo "$1" >> "$GITIGNORE"
}
add_ignore "*.bak"
add_ignore ".DS_Store"
add_ignore "*.zip"
add_ignore "ai-router-dashboard/node_modules/"
add_ignore "ai-router-dashboard/.env"
add_ignore "ai-router-dashboard/vite.config.js"

echo "✅ .gitignore 업데이트 완료"

# 커밋 메시지
if [ -z "$1" ]; then
  MSG="🔄 ai-router-dashboard 업데이트 $(date '+%Y-%m-%d %H:%M')"
else
  MSG="$1"
fi

# 변경 파일 미리보기
echo ""
echo "📋 변경된 파일 목록:"
git status --short "$AI_DIR"/
echo ""

echo "📦 배포 시작: $MSG"

# ai-router-dashboard 폴더만 올림 (travel-platform 건드리지 않음)
git add "$AI_DIR"/
git reset HEAD "$AI_DIR/ecosystem.config.cjs" 2>/dev/null || true
git add .gitignore
git commit -m "$MSG"
git push origin main

echo ""
echo "✅ GitHub push 완료!"
echo "🔄 자동 배포 감지 중... (최대 30초 소요)"