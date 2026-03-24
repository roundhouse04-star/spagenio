#!/usr/bin/env bash
PROJECT="/Users/roundhouse04/프로젝트/spagenio"
BRANCH="main"
CHECK_INTERVAL=30
LAST_COMMIT=""

echo "🚀 spagenio 자동 배포 감지 시작"
echo "📁 프로젝트: $PROJECT"
echo "🔄 체크 간격: ${CHECK_INTERVAL}초"
echo "============================================"

cd "$PROJECT"
LAST_COMMIT=$(git rev-parse HEAD 2>/dev/null)

while true; do
  git fetch origin "$BRANCH" --quiet 2>/dev/null
  REMOTE_COMMIT=$(git rev-parse origin/"$BRANCH" 2>/dev/null)

  if [ "$LAST_COMMIT" != "$REMOTE_COMMIT" ]; then
    echo ""
    echo "📦 새 버전 감지! 배포 시작..."
    echo "  이전: ${LAST_COMMIT:0:7}"
    echo "  최신: ${REMOTE_COMMIT:0:7}"
    echo "  시각: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "  변경 파일:"
    git diff --name-only HEAD origin/"$BRANCH" | sed 's/^/    - /'

    git pull origin "$BRANCH" --quiet

    if git diff --name-only HEAD~1 HEAD | grep -q "package.json"; then
      echo "  📦 package.json 변경 → npm install 실행"
      cd "$PROJECT/ai-router-dashboard" && npm install --quiet
      cd "$PROJECT"
    fi

    echo "  🔄 서비스 재시작 중..."
    "$PROJECT/stop-all.sh"
    sleep 2
    "$PROJECT/start-all.sh"

    LAST_COMMIT=$REMOTE_COMMIT
    echo "  ✅ 배포 완료!"
    echo "============================================"
  fi

  sleep "$CHECK_INTERVAL"
done
