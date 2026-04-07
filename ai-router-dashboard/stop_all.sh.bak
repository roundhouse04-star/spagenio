#!/bin/bash

echo "⏹️  spagenio 종료 중..."

# 자동 배포 종료
if [ -f /tmp/auto-deploy.pid ]; then
  kill $(cat /tmp/auto-deploy.pid) 2>/dev/null
  rm /tmp/auto-deploy.pid
fi

# PM2 종료
pm2 stop all
pm2 delete all

# n8n, cloudflared 종료
pkill -f "n8n" 2>/dev/null
pkill -f "cloudflared" 2>/dev/null

echo "✅ 종료 완료"
