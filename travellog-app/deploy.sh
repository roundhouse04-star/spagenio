#!/bin/bash
# ==========================================
# Travellog 앱 배포 스크립트
# 위치: ~/projects/spagenio/travellog-app/deploy.sh
# 사용: bash deploy.sh "커밋 메시지"
# ==========================================

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$(dirname "$APP_DIR")"

cd "$PROJECT"

# .gitignore 업데이트
GITIGNORE="$PROJECT/.gitignore"
add_ignore() {
  grep -qxF "$1" "$GITIGNORE" 2>/dev/null || echo "$1" >> "$GITIGNORE"
}
add_ignore "travellog-app/node_modules/"
add_ignore "travellog-app/.expo/"
add_ignore "travellog-app/ios/"
add_ignore "travellog-app/android/"

echo "✅ .gitignore 업데이트 완료"

# 커밋 메시지
if [ -z "$1" ]; then
  MSG="🔄 travellog-app 업데이트 $(date '+%Y-%m-%d %H:%M')"
else
  MSG="$1"
fi

# 변경 파일 미리보기
echo ""
echo "📋 변경된 파일 목록:"
git status --short travellog-app/
echo ""

echo "📱 배포 시작: $MSG"
git add -f travellog-app/
git add .gitignore
git commit -m "$MSG"
git push origin main

echo ""
echo "✅ 앱 배포 완료!"
echo "맥미니에서: cd ~/projects/spagenio && git stash && git pull"
