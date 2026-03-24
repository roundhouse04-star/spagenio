#!/bin/bash

# ==========================================
# spagenio 업데이트 스크립트
# 다운로드 파일 복사 → 배포 → 서버 재시작
# 사용법: bash update.sh "수정 내용 설명"
# ==========================================

PROJECT="/Users/roundhouse04/프로젝트/spagenio/ai-router-dashboard"
DOWNLOADS="$HOME/Downloads"
MSG="${1:-업데이트 $(date '+%Y-%m-%d %H:%M')}"

echo "🚀 spagenio 업데이트 시작"
echo "======================================"
echo "📝 커밋 메시지: $MSG"
echo ""

# ===== 파일 복사 =====
echo "📁 파일 복사 중..."

# 서버 파일
[ -f "$DOWNLOADS/server.js" ]           && cp "$DOWNLOADS/server.js"           "$PROJECT/server.js"           && echo "  ✅ server.js"
[ -f "$DOWNLOADS/quant_engine.py" ]     && cp "$DOWNLOADS/quant_engine.py"     "$PROJECT/quant_engine.py"     && echo "  ✅ quant_engine.py"
[ -f "$DOWNLOADS/stock_server.py" ]     && cp "$DOWNLOADS/stock_server.py"     "$PROJECT/stock_server.py"     && echo "  ✅ stock_server.py"
[ -f "$DOWNLOADS/ecosystem.config.cjs" ] && cp "$DOWNLOADS/ecosystem.config.cjs" "$PROJECT/ecosystem.config.cjs" && echo "  ✅ ecosystem.config.cjs"

# public 폴더
[ -f "$DOWNLOADS/app.js" ]              && cp "$DOWNLOADS/app.js"              "$PROJECT/public/app.js"       && echo "  ✅ public/app.js"
[ -f "$DOWNLOADS/index.html" ]          && cp "$DOWNLOADS/index.html"          "$PROJECT/public/index.html"   && echo "  ✅ public/index.html"
[ -f "$DOWNLOADS/style.css" ]           && cp "$DOWNLOADS/style.css"           "$PROJECT/public/style.css"    && echo "  ✅ public/style.css"

# HTML 페이지
[ -f "$DOWNLOADS/login.html" ]          && cp "$DOWNLOADS/login.html"          "$PROJECT/login.html"          && echo "  ✅ login.html"
[ -f "$DOWNLOADS/register.html" ]       && cp "$DOWNLOADS/register.html"       "$PROJECT/register.html"       && echo "  ✅ register.html"
[ -f "$DOWNLOADS/register-complete.html" ] && cp "$DOWNLOADS/register-complete.html" "$PROJECT/register-complete.html" && echo "  ✅ register-complete.html"
[ -f "$DOWNLOADS/terms.html" ]          && cp "$DOWNLOADS/terms.html"          "$PROJECT/terms.html"          && echo "  ✅ terms.html"
[ -f "$DOWNLOADS/admin.html" ]          && cp "$DOWNLOADS/admin.html"          "$PROJECT/admin.html"          && echo "  ✅ admin.html"
[ -f "$DOWNLOADS/admin-login.html" ]    && cp "$DOWNLOADS/admin-login.html"    "$PROJECT/admin-login.html"    && echo "  ✅ admin-login.html"
[ -f "$DOWNLOADS/change-password.html" ] && cp "$DOWNLOADS/change-password.html" "$PROJECT/change-password.html" && echo "  ✅ change-password.html"
[ -f "$DOWNLOADS/forgot-password.html" ] && cp "$DOWNLOADS/forgot-password.html" "$PROJECT/forgot-password.html" && echo "  ✅ forgot-password.html"
[ -f "$DOWNLOADS/withdraw.html" ]       && cp "$DOWNLOADS/withdraw.html"       "$PROJECT/withdraw.html"       && echo "  ✅ withdraw.html"

echo ""

# ===== 프로젝트 폴더로 이동 =====
cd "$PROJECT"

# ===== Git 배포 =====
echo "📦 GitHub 배포 중..."
git add .
git commit -m "$MSG"
git push origin main
echo "  ✅ GitHub push 완료"
echo ""

# ===== PM2 재시작 =====
echo "🔄 서버 재시작 중..."
pm2 restart all
echo "  ✅ 서버 재시작 완료"
echo ""

# ===== 다운로드 폴더 정리 =====
echo "🗑️  다운로드 파일 정리 중..."
for f in server.js app.js index.html style.css quant_engine.py stock_server.py \
          login.html register.html register-complete.html terms.html admin.html \
          admin-login.html change-password.html forgot-password.html withdraw.html \
          ecosystem.config.cjs; do
    [ -f "$DOWNLOADS/$f" ] && rm "$DOWNLOADS/$f" && echo "  🗑️  $f 삭제"
done
echo ""

echo "======================================"
echo "✅ 업데이트 완료!"
echo "🌐 https://www.spagenio.com"
echo "⏱️  30초 후 자동 배포 반영"
echo "======================================"
