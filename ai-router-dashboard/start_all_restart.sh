#!/bin/bash
set -u

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

PROJECT="/Users/roundhouse04/projects/spagenio/ai-router-dashboard"
START_SCRIPT="$PROJECT/start_all.sh"
LOG_DIR="$PROJECT/logs"
BOOT_LOG="$LOG_DIR/boot-restart.log"

mkdir -p "$LOG_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$BOOT_LOG"
}

wait_for_network() {
  for i in {1..30}; do
    if /sbin/ping -c 1 1.1.1.1 >/dev/null 2>&1 || /usr/bin/nc -zw2 1.1.1.1 443 >/dev/null 2>&1; then
      log "network ready"
      return 0
    fi
    log "waiting for network... ($i/30)"
    /bin/sleep 2
  done
  log "network check timed out, continuing anyway"
  return 0
}

log "===== boot restart begin ====="
wait_for_network

if ! command -v pm2 >/dev/null 2>&1; then
  log "ERROR: pm2 not found in PATH=$PATH"
  exit 1
fi

if [ ! -f "$START_SCRIPT" ]; then
  log "ERROR: start script not found: $START_SCRIPT"
  exit 1
fi

cd "$PROJECT" || {
  log "ERROR: cannot cd to $PROJECT"
  exit 1
}

log "pm2 kill"
pm2 kill >> "$BOOT_LOG" 2>&1 || true
/bin/sleep 2

log "running $START_SCRIPT"
/bin/bash "$START_SCRIPT" >> "$BOOT_LOG" 2>&1
STATUS=$?

log "pm2 save"
pm2 save >> "$BOOT_LOG" 2>&1 || true

log "===== boot restart end (status=$STATUS) ====="
exit $STATUS
