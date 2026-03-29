#!/bin/bash

# ==========================================
# spagenio 자동 배포 스크립트
# GitHub push 감지 → pull → PM2 재시작
# ==========================================

PROJECT="/Users/roundhouse04/projects/spagenio/ai-router-dashboard"
BRANCH="main"
CHECK_INTERVAL=30  # 30초마다 체크
LAST_COMMIT=""

echo "🚀 spagenio 자동 배포 시작"
echo "📁 프로젝트: $PROJECT"
echo "🔄 체크 간격: ${CHECK_INTERVAL}초"
echo "============================================"

cd "$PROJECT"

# 현재 커밋 저장
LAST_COMMIT=$(git rev-parse HEAD 2>/dev/null)

while true; do
  # GitHub에서 최신 정보 가져오기
  git fetch origin $BRANCH --quiet 2>/dev/null

  # 원격 최신 커밋
  REMOTE_COMMIT=$(git rev-parse origin/$BRANCH 2>/dev/null)

  if [ "$LAST_COMMIT" != "$REMOTE_COMMIT" ]; then
    echo ""
    echo "📦 새 버전 감지! 배포 시작..."
    echo "  이전: ${LAST_COMMIT:0:7}"
    echo "  최신: ${REMOTE_COMMIT:0:7}"
    echo "  시각: $(date '+%Y-%m-%d %H:%M:%S')"

    # 변경된 파일 목록
    echo "  변경 파일:"
    git diff --name-only HEAD origin/$BRANCH | sed 's/^/    - /'

    # pull
    git pull origin $BRANCH --quiet

    # node_modules 변경 시 npm install
    if git diff --name-only HEAD@{1} HEAD | grep -q "package.json"; then
      echo "  📦 package.json 변경 감지 → npm install 실행"
      npm install --quiet
    fi

    # PM2 재시작
    echo "  🔄 서버 재시작 중..."
    pm2 restart spagenio --silent
    sleep 2

    LAST_COMMIT=$REMOTE_COMMIT
    echo "  ✅ 배포 완료!"
    echo "============================================"
  fi

  sleep $CHECK_INTERVAL
done
