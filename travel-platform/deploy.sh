#!/bin/bash
# ==========================================
# Travellog 배포 스크립트
# 위치: ~/projects/spagenio/travel-platform/deploy.sh
# 사용: bash deploy.sh "커밋 메시지"
# ==========================================

TRAVEL="$(cd "$(dirname "$0")" && pwd)"   # 이 파일이 있는 폴더 = travel-platform
PROJECT="$(dirname "$TRAVEL")"            # 상위 = spagenio

cd "$PROJECT"

# ── .gitignore 확인 및 업데이트 ──────────────────────────
GITIGNORE="$PROJECT/.gitignore"

add_ignore() {
  grep -qxF "$1" "$GITIGNORE" 2>/dev/null || echo "$1" >> "$GITIGNORE"
}

add_ignore "*.bak"
add_ignore "*.log"
add_ignore ".DS_Store"
add_ignore "__MACOSX/"
add_ignore "*.zip"

# 빌드/의존성
add_ignore "travel-platform/frontend/node_modules/"
add_ignore "travel-platform/backend/build/"
add_ignore "travel-platform/backend/.gradle/"
add_ignore "travel-platform/backend/bin/"
add_ignore "travel-platform/backend/python-service/venv/"
add_ignore "travel-platform/backend/python-service/__pycache__/"

# 보안 - 절대 올리면 안 되는 것들
add_ignore "travel-platform/start-all.sh"
add_ignore "travel-platform/stop-all.sh"
add_ignore "travel-platform/backend/src/main/resources/application.yml"
add_ignore "travel-platform/frontend/vite.config.js"

# 런타임 데이터
add_ignore "travel-platform/backend/data/"
add_ignore "travel-platform/data/*.db"
add_ignore "travel-platform/data/*.db-shm"
add_ignore "travel-platform/data/*.db-wal"
add_ignore "travel-platform/logs/"
add_ignore "travel-platform/.run/"

# 레거시 파일
add_ignore "travel-platform/travel_*.sh"
add_ignore "travel-platform/travel_*.js"
add_ignore "travel-platform/travel_*.yml"
add_ignore "travel-platform/nginx.conf"

echo "✅ .gitignore 업데이트 완료"

# ── 커밋 메시지 ──────────────────────────────────────────
if [ -z "$1" ]; then
  MSG="🔄 travel-platform 업데이트 $(date '+%Y-%m-%d %H:%M')"
else
  MSG="$1"
fi

# ── 민감한 파일 포함 여부 체크 ───────────────────────────
STAGED=$(git ls-files --others --exclude-standard travel-platform/ 2>/dev/null)
if echo "$STAGED" | grep -qE "start-all\.sh|application\.yml|vite\.config\.js|/data/|/venv/|secret|password"; then
  echo ""
  echo "⚠️  경고: 민감한 파일이 포함될 수 있습니다!"
  echo "$STAGED" | grep -iE "start-all\.sh|application\.yml|vite\.config\.js|/data/|/venv/|secret|password"
  printf "계속 진행하시겠습니까? (y/N): "
  read confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "❌ 배포가 취소됐습니다."
    exit 1
  fi
fi

# ── 변경 파일 미리보기 ───────────────────────────────────
echo ""
echo "📋 변경된 파일 목록:"
git status --short travel-platform/
echo ""

# ── Git push ─────────────────────────────────────────────
echo "📦 배포 시작: $MSG"
git add travel-platform/
git add .gitignore
git commit -m "$MSG"
git push origin main

echo ""
echo "✅ GitHub push 완료!"
echo "🔄 자동 배포 감지 중... (최대 30초 소요)"