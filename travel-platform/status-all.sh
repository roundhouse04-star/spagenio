#!/usr/bin/env bash
set -u

for p in 5173 8080 8001 5432; do
  if lsof -nP -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[OPEN] port $p"
  else
    echo "[CLOSED] port $p"
  fi
done
