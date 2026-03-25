#!/usr/bin/env bash
set -u

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_DIR="$PROJECT_ROOT/.run"

stop() {
  local name=$1
  local pid_file="$PID_DIR/$name.pid"
  if [ -f "$pid_file" ]; then
    local pid; pid=$(cat "$pid_file")
    kill "$pid" 2>/dev/null && echo "[STOP]  $name (pid $pid)" || echo "[SKIP]  $name (이미 종료됨)"
    rm -f "$pid_file"
  fi
}

stop python
stop backend
stop frontend

# 포트 강제 정리
for port in 4173 19080 9001; do
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null || true
done

echo "[INFO] travel-platform 종료 완료"
