#!/bin/bash
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use 22

PROJECT="/Users/roundhouse04/projects/spagenio/ai-router-dashboard"
cd "$PROJECT"

echo "🚀 spagenio 개발 모드 시작"
echo "======================================"

# 포트 정리
echo "🔄 포트 정리 중..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5001 | xargs kill -9 2>/dev/null
lsof -ti:5002 | xargs kill -9 2>/dev/null
sleep 1

# Python 서버 시작
echo "🔄 stock_server 시작 중... (포트 5001)"
source stock_venv/bin/activate
python3 stock_server.py &
sleep 1

echo "🔄 quant_engine 시작 중... (포트 5002)"
python3 quant_engine.py &
sleep 1

# Node.js 서버 시작
echo "🔄 spagenio 서버 시작 중... (포트 3000)"
node server.js &
sleep 2

# n8n 시작
echo "🔄 n8n 시작 중... (포트 5678)"
pkill -f "n8n" 2>/dev/null
sleep 1
n8n start &
sleep 2

# 자동 배포 감지
echo "🔄 자동 배포 감지 시작..."
bash "$PROJECT/auto-deploy.sh" &
echo $! > /tmp/auto-deploy.pid

echo ""
echo "======================================"
echo "✅ 개발 서버 시작 완료!"
echo "📌 로컬: http://localhost:3000"
echo "🛑 종료: bash stop_dev.sh"
echo "======================================"
