#!/bin/bash
echo "🛑 spagenio 개발 모드 종료"

lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5001 | xargs kill -9 2>/dev/null
lsof -ti:5002 | xargs kill -9 2>/dev/null
pkill -f "n8n start" 2>/dev/null

if [ -f /tmp/auto-deploy.pid ]; then
  kill $(cat /tmp/auto-deploy.pid) 2>/dev/null
  rm /tmp/auto-deploy.pid
fi

echo "✅ 종료 완료!"
