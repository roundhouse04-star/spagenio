#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
PID_DIR="$PROJECT_ROOT/.run"
mkdir -p "$LOG_DIR" "$PID_DIR"

info()     { echo "[INFO]  $1"; }
die()      { echo "[ERROR] $1"; exit 1; }
kill_port(){ lsof -ti:"$1" | xargs kill -9 2>/dev/null || true; }

wait_port() {
  local port=$1 name=$2 tries=${3:-30}
  for _ in $(seq 1 $tries); do
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 && { info "$name 준비됨 (port $port)"; return 0; }
    sleep 1
  done
  echo "===== $name 로그 =====" && tail -30 "$LOG_DIR/$name.log" 2>/dev/null
  die "$name 시작 실패 (port $port)"
}

find_java17() {
  command -v /usr/libexec/java_home >/dev/null 2>&1 && {
    local h; h=$(/usr/libexec/java_home -v 17+ 2>/dev/null || true)
    [ -n "$h" ] && { echo "$h"; return; }
  }
  for p in /opt/homebrew/opt /usr/local/opt; do
    for d in "$p"/openjdk@*/libexec/openjdk.jdk/Contents/Home "$p"/openjdk/libexec/openjdk.jdk/Contents/Home; do
      [ -x "$d/bin/java" ] || continue
      echo "$d"; return
    done
  done
  echo ""
}

start_travel_python() {
  local dir="$PROJECT_ROOT/travel-platform/backend/python-service"
  [ -d "$dir" ] || { info "travel python-service 없음 — 스킵"; return; }
  cd "$dir"
  [ -d venv ] || python3 -m venv venv
  source venv/bin/activate
  pip install -q -r requirements.txt
  kill_port 9001
  nohup uvicorn main:app --host 0.0.0.0 --port 9001 > "$LOG_DIR/travel-python.log" 2>&1 &
  echo $! > "$PID_DIR/travel-python.pid"
  wait_port 9001 travel-python 20
  deactivate
}

start_travel_backend() {
  local dir="$PROJECT_ROOT/travel-platform/backend"
  [ -d "$dir" ] || { info "travel backend 없음 — 스킵"; return; }
  cd "$dir"
  local jh; jh=$(find_java17)
  [ -n "$jh" ] || die "Java 17+ 를 찾지 못했습니다."
  local cmd; [ -x "./gradlew" ] && cmd="./gradlew bootRun" || cmd="gradle bootRun"
  kill_port 19080
  nohup env JAVA_HOME="$jh" PATH="$jh/bin:$PATH" bash -c "$cmd" > "$LOG_DIR/travel-backend.log" 2>&1 &
  echo $! > "$PID_DIR/travel-backend.pid"
  wait_port 19080 travel-backend 60
}

start_travel_frontend() {
  local dir="$PROJECT_ROOT/travel-platform/frontend"
  [ -d "$dir" ] || die "travel-platform/frontend 없음"
  cd "$dir"
  [ -d node_modules ] || npm install
  kill_port 4173
  nohup npm run dev -- --host 0.0.0.0 > "$LOG_DIR/travel-frontend.log" 2>&1 &
  echo $! > "$PID_DIR/travel-frontend.pid"
  wait_port 4173 travel-frontend 30
}

start_ai_server() {
  local dir="$PROJECT_ROOT/ai-router-dashboard"
  [ -d "$dir" ] || die "ai-router-dashboard 폴더 없음"
  [ -f "$dir/server.js" ] || { info "server.js 없음 — 스킵"; return; }
  cd "$dir"
  [ -d node_modules ] || npm install
  kill_port 3000
  nohup node server.js > "$LOG_DIR/ai-server.log" 2>&1 &
  echo $! > "$PID_DIR/ai-server.pid"
  wait_port 3000 ai-server 20
}

start_stock_server() {
  local dir="$PROJECT_ROOT/ai-router-dashboard"
  local script="$dir/stock_server.py"
  [ -f "$script" ] || { info "stock_server.py 없음 — 스킵"; return; }
  cd "$dir"
  [ -d "$dir/stock_venv" ] || python3 -m venv "$dir/stock_venv"
  source "$dir/stock_venv/bin/activate"
  pip install -q flask flask-cors yfinance alpaca-py 2>/dev/null || true
  kill_port 5001
  nohup python3 "$script" > "$LOG_DIR/stock-server.log" 2>&1 &
  echo $! > "$PID_DIR/stock-server.pid"
  wait_port 5001 stock-server 20
  deactivate
}

start_quant_server() {
  local dir="$PROJECT_ROOT/ai-router-dashboard"
  local script="$dir/quant_engine.py"
  [ -f "$script" ] || { info "quant_engine.py 없음 — 스킵"; return; }
  cd "$dir"
  [ -d "$dir/stock_venv" ] || python3 -m venv "$dir/stock_venv"
  source "$dir/stock_venv/bin/activate"
  pip install -q flask flask-cors yfinance requests beautifulsoup4 2>/dev/null || true
  kill_port 5002
  nohup python3 "$script" > "$LOG_DIR/quant-server.log" 2>&1 &
  echo $! > "$PID_DIR/quant-server.pid"
  wait_port 5002 quant-server 20
  deactivate
}

start_cloudflared() {
  pkill cloudflared 2>/dev/null || true
  sleep 1
  nohup /opt/homebrew/opt/cloudflared/bin/cloudflared --config ~/.cloudflared/config.yml tunnel run \
    > "$LOG_DIR/cloudflared.log" 2>&1 &
  echo $! > "$PID_DIR/cloudflared.pid"
  info "Cloudflare Tunnel 시작됨"
}

info "▶ travel Python 시작..."
start_travel_python

info "▶ travel Java 백엔드 시작..."
start_travel_backend

info "▶ travel 프론트엔드 시작..."
start_travel_frontend

info "▶ ai 서버 시작 (port 3000)..."
start_ai_server

info "▶ 주식 서버 시작 (port 5001)..."
start_stock_server

info "▶ 퀀트 엔진 시작 (port 5002)..."
start_quant_server

info "▶ Cloudflare Tunnel 시작..."
start_cloudflared

echo ""
echo "================================================"
echo "  전체 서비스 실행 완료"
echo "  travel  : https://travel.spagenio.com"
echo "  ai      : https://ai.spagenio.com"
echo "  lotto   : https://ai.spagenio.com/lotto"
echo "  spring  : http://localhost:19080"
echo "  fastapi : http://localhost:9001"
echo "  주식    : http://localhost:5001"
echo "  퀀트    : http://localhost:5002"
echo "  종료    : ./stop-all.sh"
echo "================================================"
