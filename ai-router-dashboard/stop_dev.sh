#!/bin/bash
echo "🛑 spagenio 개발 모드 종료"
echo "======================================"

PROJECT="/Users/roundhouse04/projects/spagenio/ai-router-dashboard"

# PM2 종료
echo "🔄 PM2 종료 중..."
pm2 stop all

# n8n 종료
echo "🔄 n8n 종료 중..."
pkill -f "n8n start" 2>/dev/null

# 자동 배포 감지 종료
echo "🔄 자동 배포 감지 종료 중..."
if [ -f /tmp/auto-deploy.pid ]; then
  kill $(cat /tmp/auto-deploy.pid) 2>/dev/null
  rm /tmp/auto-deploy.pid
fi

echo ""
echo "======================================"
echo "✅ 개발 서버 종료 완료!"
echo "======================================"
