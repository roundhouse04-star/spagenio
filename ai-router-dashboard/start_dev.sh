#!/bin/bash
echo "🚀 spagenio 개발 모드 시작"
echo "======================================"

PROJECT="/Users/roundhouse04/projects/spagenio/ai-router-dashboard"
cd "$PROJECT"

# PM2로 서버 시작
echo "🔄 PM2로 서버 시작 중..."
pm2 start ecosystem.config.cjs

# n8n 시작
echo "🔄 n8n 시작 중... (포트 5678)"
n8n start &
sleep 2

# 자동 배포 감지 시작 (백그라운드)
echo "🔄 자동 배포 감지 시작..."
bash "$PROJECT/auto-deploy.sh" &
echo $! > /tmp/auto-deploy.pid

echo ""
echo "======================================"
echo "✅ 개발 서버 시작 완료!"
echo ""
echo "📌 접속 주소:"
echo "  로컬: http://localhost:3000"
echo ""
echo "📋 PM2 상태 확인: pm2 status"
echo "📋 PM2 로그 확인: pm2 logs"
echo "🛑 전체 종료:     bash stop_all.sh"
echo "======================================"

pm2 save
