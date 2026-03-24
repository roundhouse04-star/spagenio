#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
PID_DIR="$PROJECT_ROOT/.run"
mkdir -p "$LOG_DIR" "$PID_DIR"

info()  { echo "[INFO]  $1"; }
die()   { echo "[ERROR] $1"; exit 1; }

kill_port() { lsof -ti:"$1" | xargs kill -9 2>/dev/null || true; }

wait_port() {
  local port=$1 name=$2 tries=${3:-30}
  for _ in $(seq 1 $tries); do
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 \
      && { info "$name 준비됨 (port $port)"; return 0; }
    sleep 1
  done
  echo "===== $name 로그 =====" && tail -30 "$LOG_DIR/$name.log" 2>/dev/null
  die "$name 시작 실패 (port $port)"
}

find_java17() {
  [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/java" ] && {
    v=$("$JAVA_HOME/bin/java" -version 2>&1 | grep -Eo '[0-9]+' | head -1)
    [ "${v:-0}" -ge 17 ] && { echo "$JAVA_HOME"; return; }
  }
  command -v /usr/libexec/java_home >/dev/null 2>&1 && {
    h=$(/usr/libexec/java_home -v 17+ 2>/dev/null || true)
    [ -n "$h" ] && { echo "$h"; return; }
  }
  for p in /opt/homebrew/opt /usr/local/opt; do
    for d in "$p"/openjdk@*/libexec/openjdk.jdk/Contents/Home \
              "$p"/openjdk/libexec/openjdk.jdk/Contents/Home; do
      [ -x "$d/bin/java" ] || continue
      v=$("$d/bin/java" -version 2>&1 | grep -Eo '[0-9]+' | head -1)
      [ "${v:-0}" -ge 17 ] && { echo "$d"; return; }
    done
  done
  echo ""
}

# ── travel-platform Python ──────────────────────────────
start_travel_python() {
  local dir="$PROJECT_ROOT/travel-platform/backend/python-service"
  [ -d "$dir" ] || { info "travel python-service 없음 — 스킵"; return; }
  cd "$dir"
  [ -d venv ] || { info "venv 생성..."; python3 -m venv venv; }
  source venv/bin/activate
  "/Users/roundhouse04/프로젝트/spagenio/travel-platform/backend/python-service/venv/bin/pip" install -q -r requirements.txt
  kill_port 8001
  nohup "/Users/roundhouse04/프로젝트/spagenio/travel-platform/backend/python-service/venv/bin/uvicorn" main:app --host 0.0.0.0 --port 8001 \
    > "$LOG_DIR/travel-python.log" 2>&1 &
  echo $! > "$PID_DIR/travel-python.pid"
  wait_port 8001 travel-python 20
}

# ── travel-platform Java backend ────────────────────────
start_travel_backend() {
  local dir="$PROJECT_ROOT/travel-platform/backend"
  [ -d "$dir" ] || { info "travel backend 없음 — 스킵"; return; }
  cd "$dir"
  local jh; jh=$(find_java17)
  [ -n "$jh" ] || die "Java 17+ 를 찾지 못했습니다."
  local cmd; [ -x "./gradlew" ] && cmd="./gradlew bootRun" || cmd="gradle bootRun"
  kill_port 8080
  nohup env JAVA_HOME="$jh" PATH="$jh/bin:$PATH" bash -c "$cmd" \
    > "$LOG_DIR/travel-backend.log" 2>&1 &
  echo $! > "$PID_DIR/travel-backend.pid"
  wait_port 8080 travel-backend 60
}

# ── travel-platform Frontend (port 5173) ────────────────
start_travel_frontend() {
  local dir="$PROJECT_ROOT/travel-platform/frontend"
  [ -d "$dir" ] || die "travel-platform/frontend 없음"
  cd "$dir"
  command -v npm >/dev/null 2>&1 || die "npm 필요"
  [ -d node_modules ] || npm install
  kill_port 5173
  nohup npm run dev -- --host 0.0.0.0 \
    > "$LOG_DIR/travel-frontend.log" 2>&1 &
  echo $! > "$PID_DIR/travel-frontend.pid"
  wait_port 5173 travel-frontend 30
}

# ── ai-router-dashboard Frontend (port 5174) ────────────
start_ai_frontend() {
  local dir="$PROJECT_ROOT/ai-router-dashboard"
  [ -d "$dir" ] || die "ai-router-dashboard 폴더 없음"
  cd "$dir"
  command -v npm >/dev/null 2>&1 || die "npm 필요"
  [ -d node_modules ] || npm install
  kill_port 5174
  nohup npm run dev -- --host 0.0.0.0 \
    > "$LOG_DIR/ai-frontend.log" 2>&1 &
  echo $! > "$PID_DIR/ai-frontend.pid"
  wait_port 5174 ai-frontend 30
}

# ── 실행 순서 ───────────────────────────────────────────
info "▶ travel Python 시작..."
start_travel_python

info "▶ travel Java 백엔드 시작..."
start_travel_backend

info "▶ travel 프론트엔드 시작..."
start_travel_frontend

info "▶ ai-router 프론트엔드 시작..."
start_ai_frontend

cat <<EOF

================================================
  전체 서비스 실행 완료
------------------------------------------------
  [로컬 개발]
  Travel  : http://localhost:5173/travel
  AI      : http://localhost:5174/ai

  [프로덕션 — Nginx 통해]
  Travel  : https://spagenio.com/travel
  AI      : https://spagenio.com/ai

  [API]
  Spring  : http://localhost:8080
  FastAPI : http://localhost:8001/docs
------------------------------------------------
  로그  : ./logs/
  종료  : ./stop-all.sh
================================================
EOF
