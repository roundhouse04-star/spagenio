#!/bin/bash
echo "🚀 spagenio 개발 모드 시작"
echo "======================================"

PROJECT="/Users/roundhouse04/projects/spagenio/ai-router-dashboard"
cd "$PROJECT"

# better-sqlite3 재빌드
echo "🔄 better-sqlite3 재빌드 중..."
npm rebuild better-sqlite3

# PM2로 서버 시작
echo "🔄 PM2로 서버 시작 중..."
pm2 start ecosystem.config.cjs

# n8n 시작 (중복 방지)
echo "🔄 n8n 시작 중... (포트 5678)"
pkill -f "n8n" 2>/dev/null
sleep 1
n8n start &
sleep 2

# 자동 배포 감지 시작 (백그라운드)
echo "🔄 자동 배포 감지 시작..."
bash "$PROJECT/auto-deploy.sh" &
echo $! > /tmp/auto-deploy.pid

echo ""
echo "======================================"
echo "✅ 개발 서버 시작 완료!"
echo "📌 접속 주소:"
echo "  로컬: http://localhost:3000"
echo "📋 PM2 상태 확인: pm2 status"
echo "📋 PM2 로그 확인: pm2 logs"
echo "🛑 전체 종료:     bash stop_dev.sh"
echo "======================================"

pm2 save
