#!/bin/bash
echo "🚀 spagenio 시작"
echo "======================================"

export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use 22

PROJECT="/Users/roundhouse04/projects/spagenio/ai-router-dashboard"
cd "$PROJECT"

# better-sqlite3 재빌드
echo "🔄 better-sqlite3 재빌드 중..."
npm rebuild better-sqlite3

# PM2로 서버 시작
echo "🔄 PM2로 서버 시작 중..."
pm2 start ecosystem.config.cjs

# 자동 배포 감지 시작 (백그라운드)
echo "🔄 자동 배포 감지 시작..."
bash "$PROJECT/auto-deploy.sh" &
echo $! > /tmp/auto-deploy.pid

echo ""
echo "======================================"
echo "✅ 전체 시작 완료!"
echo "  외부: https://www.spagenio.com"
echo "  로컬: http://localhost:3000"
echo "======================================"

pm2 save
