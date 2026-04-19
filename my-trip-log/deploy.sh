#!/bin/bash
# ==========================================
# My Trip Log 배포 스크립트
# 위치: ~/projects/spagenio/my-trip-log/deploy.sh
# 사용: bash deploy.sh "커밋 메시지"
#
# ⚠️  패치 파일 적용 방법 (반드시 spagenio 폴더에서!)
#   cd ~/projects/spagenio          ← 여기서!
#   unzip -o ~/Downloads/my-trip-log-patch.zip
#   cd my-trip-log
#   bash deploy.sh "커밋 메시지"
#
# ❌ 절대 이렇게 하지 마세요:
#   cd ~/projects/spagenio/my-trip-log
#   unzip ...  ← my-trip-log 폴더 중첩 생김!
# ==========================================

set -e  # 에러 발생시 즉시 중단

# ── 색상 정의 ────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ── 경로 계산 ────────────────────────────────────────────
APP_DIR="$(cd "$(dirname "$0")" && pwd)"   # my-trip-log
PROJECT="$(dirname "$APP_DIR")"            # spagenio
APP_NAME="$(basename "$APP_DIR")"          # my-trip-log

# ── 커밋 메시지 ──────────────────────────────────────────
MSG="${1:-"update: $APP_NAME"}"

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  My Trip Log 배포${NC}"
echo -e "${BLUE}==========================================${NC}"
echo -e "📂 프로젝트: ${GREEN}$PROJECT${NC}"
echo -e "📦 앱 폴더:  ${GREEN}$APP_DIR${NC}"
echo -e "💬 메시지:   ${GREEN}$MSG${NC}"
echo ""

cd "$PROJECT"

# ── 중첩 폴더 자동 감지 및 제거 ──────────────────────────
if [ -d "$APP_DIR/my-trip-log" ]; then
  echo -e "${YELLOW}⚠️  my-trip-log 중첩 폴더 감지됨! 자동 제거합니다...${NC}"
  rm -rf "$APP_DIR/my-trip-log"
  echo -e "${GREEN}✅ 중첩 폴더 제거 완료${NC}"
fi

# ── __MACOSX 찌꺼기 제거 (zip 압축해제시 생김) ──────────
if [ -d "$PROJECT/__MACOSX" ]; then
  rm -rf "$PROJECT/__MACOSX"
  echo -e "${GREEN}✅ __MACOSX 제거${NC}"
fi
find "$APP_DIR" -name ".DS_Store" -delete 2>/dev/null || true

# ── git 상태 확인 ────────────────────────────────────────
echo ""
echo -e "${BLUE}📋 변경사항 확인...${NC}"
git add my-trip-log/

CHANGES=$(git status --porcelain my-trip-log/ | wc -l | tr -d ' ')

if [ "$CHANGES" = "0" ]; then
  echo -e "${YELLOW}⚠️  변경사항이 없습니다. 종료.${NC}"
  exit 0
fi

echo -e "${GREEN}✅ 변경 파일 ${CHANGES}개${NC}"
echo ""

# ── 민감 파일 경고 ───────────────────────────────────────
SENSITIVE=$(git status --porcelain my-trip-log/ | grep -E "\.(env|key|pem|p12)$|secret|password" || true)
if [ -n "$SENSITIVE" ]; then
  echo -e "${RED}⚠️  민감한 파일이 포함돼 있습니다:${NC}"
  echo "$SENSITIVE"
  read -p "계속하시겠습니까? (y/N): " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "취소됨"
    exit 1
  fi
fi

# ── 커밋 + 푸시 ──────────────────────────────────────────
echo -e "${BLUE}📝 커밋 중...${NC}"
git commit -m "$MSG"

echo -e "${BLUE}🚀 푸시 중...${NC}"
git push origin main

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  ✅ 배포 완료!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo -e "맥미니에서:"
echo -e "  ${YELLOW}cd ~/projects/spagenio && git stash && git pull${NC}"
echo ""
echo -e "Expo 앱 리로드:"
echo -e "  터미널에서 ${YELLOW}r${NC} 또는 폰에서 앱 흔들기 → Reload"
