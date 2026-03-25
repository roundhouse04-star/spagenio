#!/usr/bin/env bash
# ============================================================
#  spagenio — 일상 배포 스크립트 (초기 setup 이후 사용)
#  사용법: ./deploy.sh [커밋메시지]
#  예시:   ./deploy.sh "feat: 뉴스 API 수정"
# ============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}━━━ $1 ━━━${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMMIT_MSG="${1:-"chore: update $(date '+%Y-%m-%d %H:%M')"}"
BRANCH="main"

cd "$SCRIPT_DIR"

# ── 저장소 확인 ────────────────────────────────────────────
[ -d ".git" ] || error "git 저장소가 아닙니다. setup-monorepo.sh 를 먼저 실행하세요."

# ── 두 프로젝트 폴더 존재 확인 ────────────────────────────
header "🔍  프로젝트 구조 확인"
[ -d "ai-router-dashboard" ] || error "ai-router-dashboard 폴더가 없습니다."
[ -d "travel-platform" ]     || error "travel-platform 폴더가 없습니다."
success "두 프로젝트 폴더 확인됨"

# ── 민감 파일 자동 제거 ────────────────────────────────────
header "🔒  민감 파일 검사"

# .env 추적 해제 (강화)
git rm --cached --ignore-unmatch "**/.env" 2>/dev/null || true
git rm --cached --ignore-unmatch ".env" 2>/dev/null || true
git rm --cached --ignore-unmatch "ai-router-dashboard/.env" 2>/dev/null || true
git rm --cached --ignore-unmatch "*.zip" 2>/dev/null || true
ENV_FILES=$(git ls-files | grep -E "^[^/]*\.env$|/\.env$" | grep -v ".env.example" || true)
if [ -n "$ENV_FILES" ]; then
  warn ".env 파일 추적 해제 중..."
  echo "$ENV_FILES" | xargs git rm --cached 2>/dev/null || true
fi

# *.db 추적 해제
DB_FILES=$(git ls-files "*.db" "*.sqlite" "*.sqlite3" 2>/dev/null || true)
if [ -n "$DB_FILES" ]; then
  warn "DB 파일 추적 해제 중: $DB_FILES"
  echo "$DB_FILES" | xargs git rm --cached 2>/dev/null || true
fi

# node_modules 혹시 추적됐으면 해제
NM=$(git ls-files | grep "node_modules/" | head -1 || true)
if [ -n "$NM" ]; then
  warn "node_modules 추적 해제 중..."
  git rm -r --cached --ignore-unmatch "**/node_modules" 2>/dev/null || true
fi

# venv 혹시 추적됐으면 해제
VE=$(git ls-files | grep "venv/" | head -1 || true)
if [ -n "$VE" ]; then
  warn "venv 추적 해제 중..."
  git rm -r --cached --ignore-unmatch "**/venv" 2>/dev/null || true
fi

success "민감 파일 검사 완료"

# ── 변경사항 확인 ──────────────────────────────────────────
header "📝  변경사항"

CHANGES=$(git status --porcelain)
if [ -z "$CHANGES" ]; then
  success "변경사항 없음 — 배포할 내용이 없습니다."
  exit 0
fi

echo ""
echo -e "${CYAN}변경 파일:${NC}"
git status --short | head -20
TOTAL=$(git status --short | wc -l | tr -d ' ')
[ "$TOTAL" -gt 20 ] && echo "  ... 외 $((TOTAL-20))개"
echo ""
echo -e "커밋 메시지: ${BOLD}$COMMIT_MSG${NC}"
echo ""

read -p "배포하시겠습니까? (y/N): " CONFIRM
[[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]] && { info "취소됨"; exit 0; }

# ── 배포 ───────────────────────────────────────────────────
header "🚀  배포"

git add -A
git commit -m "$COMMIT_MSG"
git push origin "$BRANCH"

echo ""
echo -e "${GREEN}${BOLD}✅  배포 완료!${NC}"
echo -e "  ${CYAN}https://github.com/roundhouse04-star/spagenio${NC}"
echo ""
echo -e "  맥미니 업데이트:"
echo -e "  ${YELLOW}cd ~/spagenio && git pull && ./stop-all.sh && ./start-all.sh${NC}"
echo ""
