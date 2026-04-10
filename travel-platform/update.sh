#!/bin/bash
# ==========================================
# Travellog 맥미니 업데이트 스크립트
# 위치: ~/projects/spagenio/travel-platform/update.sh
# 사용: bash update.sh
# ==========================================

TRAVEL="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$(dirname "$TRAVEL")"

echo "🔄 Travellog 업데이트 시작..."

cd "$PROJECT"

# ── DB 파일 변경사항 보존 (git pull 충돌 방지) ───────────
git stash 2>/dev/null

# ── 최신 코드 받기 ───────────────────────────────────────
git pull origin main

# ── stash 복원 (없어도 오류 안 남) ───────────────────────
git stash pop 2>/dev/null

# ── 중첩 폴더 자동 감지 및 제거 ──────────────────────────
if [ -d "$TRAVEL/travel-platform" ]; then
  echo "⚠️  중첩 폴더 감지됨! 자동 제거합니다..."
  rm -rf "$TRAVEL/travel-platform"
  echo "✅ 중첩 폴더 제거 완료"
fi

# ── DB 초기화 (처음 한 번만 필요) ────────────────────────
if [ ! -f "$TRAVEL/backend/data/travellog.db" ]; then
  echo "📦 DB가 없습니다. 초기화합니다..."
  mkdir -p "$TRAVEL/backend/data"
  sqlite3 "$TRAVEL/backend/data/travellog.db" < "$TRAVEL/init_db.sql"
  echo "✅ DB 초기화 완료"
else
  echo "✅ DB 이미 존재함 (스킵)"
fi

# ── 서버 재시작 ───────────────────────────────────────────
echo "🔄 서버 재시작..."
bash "$TRAVEL/stop-all.sh" 2>/dev/null
sleep 2
bash "$TRAVEL/start-all.sh"

echo ""
echo "✅ 업데이트 완료!"
echo "🌐 https://travel.spagenio.com"
