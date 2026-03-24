#!/usr/bin/env bash
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_DIR="$PROJECT_ROOT/.run"

stop() {
  local name=$1 pid_file="$PID_DIR/$1.pid"
  if [ -f "$pid_file" ]; then
    kill "$(cat "$pid_file")" 2>/dev/null && echo "[STOP]  $name 종료"
    rm -f "$pid_file"
  fi
}

stop travel-python
stop travel-backend
stop travel-frontend
stop ai-frontend

echo "모든 서비스 종료 완료"
