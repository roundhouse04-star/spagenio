#!/bin/bash
# ============================================================
# spagenio 프론트엔드 난독화 빌드 스크립트
# 사용법: ./build.sh
# ============================================================

PROJECT_DIR="$HOME/projects/spagenio/ai-router-dashboard"
JS_DIR="$PROJECT_DIR/public/js"
DIST_DIR="$PROJECT_DIR/public/js/dist"

echo ""
echo "🔐 spagenio 난독화 빌드 시작..."
echo ""

# ── 1. javascript-obfuscator 설치 확인 ──────────────────────
if ! command -v javascript-obfuscator &> /dev/null; then
  echo "📦 javascript-obfuscator 설치 중..."
  npm install -g javascript-obfuscator
fi

# ── 2. dist 폴더 생성 ────────────────────────────────────────
mkdir -p "$DIST_DIR"

# ── 3. 난독화 대상 JS 파일 목록 ─────────────────────────────
FILES=(
  "common.js"
  "ai-router.js"
  "stock.js"
  "news.js"
  "datacollect.js"
  "alpaca-keys.js"
  "chart.js"
  "quant-algo.js"
  "lotto.js"
  "backtest.js"
)

# ── 4. 각 파일 난독화 ────────────────────────────────────────
SUCCESS=0
FAIL=0

for FILE in "${FILES[@]}"; do
  SRC="$JS_DIR/$FILE"
  DEST="$JS_DIR/$FILE"  # 원본 덮어쓰기 (백업은 dist/에)

  if [ ! -f "$SRC" ]; then
    echo "  ⚠️  $FILE 없음 — 건너뜀"
    continue
  fi

  # 원본 백업 (dist/원본명.bak.js)
  cp "$SRC" "$DIST_DIR/${FILE%.js}.bak.js"

  # 난독화 실행
  javascript-obfuscator "$SRC" \
    --output "$DEST" \
    --compact true \
    --self-defending false \
    --identifier-names-generator hexadecimal \
    --string-array true \
    --string-array-encoding 'base64' \
    --string-array-threshold 0.75 \
    --rotate-string-array true \
    --shuffle-string-array true \
    --split-strings true \
    --split-strings-chunk-length 5 \
    --transform-object-keys true \
    --unicode-escape-sequence false \
    2>/dev/null

  if [ $? -eq 0 ]; then
    SIZE_BEFORE=$(wc -c < "$DIST_DIR/${FILE%.js}.bak.js")
    SIZE_AFTER=$(wc -c < "$DEST")
    echo "  ✅ $FILE ($SIZE_BEFORE bytes → $SIZE_AFTER bytes)"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "  ❌ $FILE 난독화 실패 — 원본 복구"
    cp "$DIST_DIR/${FILE%.js}.bak.js" "$DEST"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "────────────────────────────────────"
echo "  ✅ 성공: ${SUCCESS}개  ❌ 실패: ${FAIL}개"
echo "  📁 원본 백업: $DIST_DIR"
echo "────────────────────────────────────"
echo ""
echo "🚀 서버 재시작하려면:"
echo "   cd ~/projects/spagenio && ./stop-all.sh && ./start-all.sh"
echo ""
