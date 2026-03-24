#!/usr/bin/env bash
set -u

kill -9 $(lsof -ti:8001) 2>/dev/null || true
kill -9 $(lsof -ti:8080) 2>/dev/null || true
kill -9 $(lsof -ti:5173) 2>/dev/null || true

echo "[INFO] stopped"
