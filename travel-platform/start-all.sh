#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
PID_DIR="$PROJECT_ROOT/.run"

mkdir -p "$LOG_DIR" "$PID_DIR"

info()  { echo "[INFO]  $1"; }
die()   { echo "[ERROR] $1"; exit 1; }

kill_port() {
  lsof -ti:"$1" | xargs kill -9 2>/dev/null || true
}

wait_port() {
  local port=$1 name=$2 tries=${3:-30}
  for _ in $(seq 1 $tries); do
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 && { info "$name 준비됨 (port $port)"; return 0; }
    sleep 1
  done
  echo "===== $name 로그 =====" && tail -30 "$LOG_DIR/${name}.log" 2>/dev/null || true
  die "$name 시작 실패 (port $port)"
}

find_java17() {
  # 1) JAVA_HOME 이미 설정된 경우
  if [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/java" ]; then
    local v; v=$("$JAVA_HOME/bin/java" -version 2>&1 | grep -Eo '[0-9]+' | head -1)
    [ "${v:-0}" -ge 17 ] && { echo "$JAVA_HOME"; return; }
  fi
  # 2) macOS system java_home
  command -v /usr/libexec/java_home >/dev/null 2>&1 && {
    local h; h=$(/usr/libexec/java_home -v 17+ 2>/dev/null || true)
    [ -n "$h" ] && { echo "$h"; return; }
  }
  # 3) Homebrew (Apple Silicon / Intel)
  for p in /opt/homebrew/opt /usr/local/opt; do
    for d in "$p"/openjdk@*/libexec/openjdk.jdk/Contents/Home \
              "$p"/openjdk/libexec/openjdk.jdk/Contents/Home; do
      [ -x "$d/bin/java" ] || continue
      local v; v=$("$d/bin/java" -version 2>&1 | grep -Eo '[0-9]+' | head -1)
      [ "${v:-0}" -ge 17 ] && { echo "$d"; return; }
    done
  done
  # 4) Linux /usr/lib/jvm
  for d in /usr/lib/jvm/java-{17,21,23}-openjdk* /usr/lib/jvm/temurin-*; do
    [ -x "$d/bin/java" ] || continue
    echo "$d"; return
  done
  echo ""
}

# ── Python ──────────────────────────────────────────────
start_python() {
  local dir="$PROJECT_ROOT/backend/python-service"
  [ -d "$dir" ] || die "backend/python-service 폴더 없음"
  cd "$dir"

  # venv 없으면 자동 생성
  if [ ! -d venv ]; then
    info "venv 생성 중..."
    python3 -m venv venv || die "python3 -m venv 실패 — python3 설치 확인"
  fi

  source venv/bin/activate
  pip install -q -r requirements.txt

  kill_port 8001
  nohup uvicorn main:app --host 0.0.0.0 --port 8001 > "$LOG_DIR/python.log" 2>&1 &
  echo $! > "$PID_DIR/python.pid"
  wait_port 8001 python 20
}

# ── Java Backend ─────────────────────────────────────────
start_backend() {
  local dir="$PROJECT_ROOT/backend"
  [ -d "$dir" ] || die "backend 폴더 없음"
  cd "$dir"

  local jh; jh=$(find_java17)
  [ -n "$jh" ] || die "Java 17+ 를 찾지 못했습니다. brew install openjdk@17 후 재시도하세요."
  info "JAVA_HOME: $jh"

  local cmd
  [ -x "./gradlew" ] && cmd="./gradlew bootRun" || cmd="gradle bootRun"

  kill_port 8080
  nohup env JAVA_HOME="$jh" PATH="$jh/bin:$PATH" bash -c "$cmd" \
    > "$LOG_DIR/backend.log" 2>&1 &
  echo $! > "$PID_DIR/backend.pid"
  wait_port 8080 backend 60
}

# ── Frontend ─────────────────────────────────────────────
start_frontend() {
  local dir="$PROJECT_ROOT/frontend"
  [ -d "$dir" ] || die "frontend 폴더 없음"
  cd "$dir"

  command -v npm >/dev/null 2>&1 || die "npm 이 필요합니다."

  # node_modules 없으면 자동 설치
  [ -d node_modules ] || { info "npm install 중..."; npm install; }

  kill_port 5173
  nohup npm run dev -- --host 0.0.0.0 > "$LOG_DIR/frontend.log" 2>&1 &
  echo $! > "$PID_DIR/frontend.pid"
  wait_port 5173 frontend 30
}

# ── 실행 ─────────────────────────────────────────────────
info "Python 서비스 시작..."
start_python

info "Java 백엔드 시작..."
start_backend

info "프론트엔드 시작..."
start_frontend

cat <<EOF

========================================
  전체 서비스 실행 완료
----------------------------------------
  Frontend : http://localhost:5173
  Backend  : http://localhost:8080
  Python   : http://localhost:8001/docs
========================================
종료: ./stop-all.sh
EOF