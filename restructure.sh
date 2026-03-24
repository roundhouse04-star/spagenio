#!/usr/bin/env bash
# ============================================================
#  spagenio — GitHub 모노레포 재구성 스크립트
#
#  현재: spagenio/ 루트에 ai-router-dashboard 소스가 바로 있음
#  목표: spagenio/ai-router-dashboard/ 폴더로 이동 +
#        spagenio/travel-platform/ 추가
#
#  ▶ 사용법:
#    1. 이 스크립트를 로컬 spagenio 클론 폴더에 복사
#    2. 스크립트 상단 TRAVEL_SOURCE 경로 수정
#    3. chmod +x restructure.sh && ./restructure.sh
# ============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}━━━ $1 ━━━${NC}"; }

# ════════════════════════════════════════════════════════════
#  ✏️  여기만 수정하세요
# ════════════════════════════════════════════════════════════
# travel-platform 소스 경로 (로컬에 있는 원본 프로젝트)
TRAVEL_SOURCE="$HOME/프로젝트/travel-platform"

# GitHub 클론된 spagenio 폴더 (이 스크립트가 있는 곳)
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
BRANCH="main"
# ════════════════════════════════════════════════════════════

header "1️⃣   환경 확인"

cd "$REPO_DIR"

[ -d ".git" ] || error ".git 폴더가 없습니다. spagenio 클론 폴더 안에서 실행하세요.\n  git clone git@github.com:roundhouse04-star/spagenio.git\n  cd spagenio"
[ -d "$TRAVEL_SOURCE" ] || error "travel-platform 소스를 찾을 수 없습니다: $TRAVEL_SOURCE\n  스크립트 상단 TRAVEL_SOURCE 경로를 수정하세요."
command -v rsync >/dev/null || error "rsync가 필요합니다."

REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
[ -z "$REMOTE" ] && error "원격 저장소(origin)가 없습니다."

info "저장소: $REMOTE"
info "로컬 경로: $REPO_DIR"

# ── 최신 상태로 동기화 ─────────────────────────────────────
header "2️⃣   원격 저장소 동기화"
git pull origin "$BRANCH" || warn "pull 실패 (계속 진행)"
success "동기화 완료"

# ── 현재 루트에 뭐가 있는지 파악 ──────────────────────────
header "3️⃣   현재 루트 파일 분석"

# ai-router-dashboard 관련 파일들 (루트에 있는 것)
ROOT_FILES=$(git ls-files --error-unmatch package.json 2>/dev/null && echo "found" || echo "not_found")

if [ "$ROOT_FILES" = "found" ]; then
  info "루트에 ai-router-dashboard 파일 발견 — 폴더로 이동합니다"
  AI_IN_ROOT=true
else
  # 이미 폴더가 있는지 확인
  if [ -d "ai-router-dashboard" ]; then
    info "ai-router-dashboard 폴더 이미 존재"
    AI_IN_ROOT=false
  else
    error "루트에 ai-router-dashboard 파일도 없고, 폴더도 없습니다."
  fi
fi

# ── ai-router-dashboard → 폴더로 이동 (루트에 있는 경우) ──
if [ "$AI_IN_ROOT" = true ]; then
  header "4️⃣   루트 파일 → ai-router-dashboard/ 폴더로 이동"

  mkdir -p ai-router-dashboard

  # git이 추적하는 파일만 이동 (node_modules, .env 등 제외)
  TRACKED_FILES=$(git ls-files | grep -v "^ai-router-dashboard/" | grep -v "^travel-platform/" | grep -v "^\.gitignore$" | grep -v "^README\.md$" | grep -v "^restructure\.sh$" | grep -v "^deploy\.sh$" | grep -v "^nginx\.conf$" | grep -v "^start-all\.sh$" | grep -v "^stop-all\.sh$")

  if [ -z "$TRACKED_FILES" ]; then
    warn "이동할 추적 파일이 없습니다."
  else
    echo "$TRACKED_FILES" | while read -r f; do
      # 폴더 구조 유지하며 이동
      TARGET_DIR="ai-router-dashboard/$(dirname "$f")"
      mkdir -p "$TARGET_DIR"
      git mv "$f" "ai-router-dashboard/$f" 2>/dev/null && info "이동: $f → ai-router-dashboard/$f" || warn "이동 실패 (이미 있거나 삭제됨): $f"
    done
  fi

  success "ai-router-dashboard 폴더 이동 완료"
fi

# ── .gitignore 업데이트 ────────────────────────────────────
header "5️⃣   .gitignore 업데이트"

cat > "$REPO_DIR/.gitignore" << 'GITIGNORE'
# ── 환경 변수 (절대 커밋 금지!) ─────────────────────────────
.env
.env.local
.env.*.local
!.env.example

# ── Node.js ─────────────────────────────────────────────────
node_modules/
dist/
.vite/
.cache/
*.tsbuildinfo

# ── Python ──────────────────────────────────────────────────
__pycache__/
*.pyc
*.pyo
venv/
.venv/
*.egg-info/

# ── Java / Gradle ────────────────────────────────────────────
build/
.gradle/
*.class
!gradle/wrapper/gradle-wrapper.jar
out/

# ── DB 파일 (사용자 데이터 포함) ────────────────────────────
*.db
*.sqlite
*.sqlite3

# ── 로그 & 런타임 ────────────────────────────────────────────
logs/
*.log
.run/
*.pid

# ── 인증서 & 키 ──────────────────────────────────────────────
*.pem
*.key
*.p12
*.pfx

# ── macOS ────────────────────────────────────────────────────
.DS_Store
__MACOSX/
._*

# ── IDE ──────────────────────────────────────────────────────
.idea/
.vscode/
*.swp
GITIGNORE

success ".gitignore 업데이트 완료"

# ── 혹시 추적 중인 민감 파일 해제 ─────────────────────────
header "6️⃣   민감 파일 추적 해제"

# node_modules
NM=$(git ls-files | grep "node_modules/" | head -1 || true)
if [ -n "$NM" ]; then
  warn "node_modules 추적 해제 중..."
  git rm -r --cached --ignore-unmatch node_modules "*/node_modules" 2>/dev/null || true
fi

# venv
VE=$(git ls-files | grep "venv/" | head -1 || true)
if [ -n "$VE" ]; then
  warn "venv 추적 해제 중..."
  git rm -r --cached --ignore-unmatch venv "*/venv" 2>/dev/null || true
fi

# .env
ENV_F=$(git ls-files | grep -E "(^|/)\.env$" || true)
if [ -n "$ENV_F" ]; then
  warn ".env 추적 해제 중..."
  echo "$ENV_F" | xargs git rm --cached 2>/dev/null || true
fi

# *.db
DB_F=$(git ls-files | grep -E "\.db$" || true)
if [ -n "$DB_F" ]; then
  warn "DB 파일 추적 해제 중..."
  echo "$DB_F" | xargs git rm --cached 2>/dev/null || true
fi

# build/
BUILD_F=$(git ls-files | grep "^build/" | head -1 || true)
if [ -n "$BUILD_F" ]; then
  warn "build/ 추적 해제 중..."
  git rm -r --cached --ignore-unmatch build "*/build" 2>/dev/null || true
fi

success "민감 파일 정리 완료"

# ── travel-platform 추가 ───────────────────────────────────
header "7️⃣   travel-platform 추가"

mkdir -p "$REPO_DIR/travel-platform"

info "travel-platform 복사 중..."
info "(제외: node_modules, venv, build, .gradle, __pycache__, .env, *.db, logs, .run)"

rsync -a \
  --exclude='node_modules/' \
  --exclude='venv/' \
  --exclude='.venv/' \
  --exclude='__pycache__/' \
  --exclude='*.pyc' \
  --exclude='build/' \
  --exclude='.gradle/' \
  --exclude='*.class' \
  --exclude='.env' \
  --exclude='*.env.*' \
  --exclude='*.db' \
  --exclude='*.sqlite' \
  --exclude='logs/' \
  --exclude='.run/' \
  --exclude='*.pid' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='__MACOSX/' \
  --exclude='*.pem' \
  --exclude='*.key' \
  "$TRAVEL_SOURCE/" "$REPO_DIR/travel-platform/"

success "travel-platform 복사 완료"

# ── .env.example 생성 ─────────────────────────────────────
if [ ! -f "$REPO_DIR/ai-router-dashboard/.env.example" ]; then
  cat > "$REPO_DIR/ai-router-dashboard/.env.example" << 'EOF'
# ── Anthropic ────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx

# ── 서버 설정 ────────────────────────────────────────────────
PORT=3000

# ── JWT ──────────────────────────────────────────────────────
JWT_SECRET=랜덤하고_긴_문자열_입력

# ── 이메일 (Nodemailer) ──────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password

# ── Alpaca 주식 API ──────────────────────────────────────────
ALPACA_API_KEY=your_alpaca_api_key
ALPACA_SECRET_KEY=your_alpaca_secret_key
ALPACA_PAPER=true
EOF
  info ".env.example 생성됨"
fi

# ── README 생성/업데이트 ───────────────────────────────────
cat > "$REPO_DIR/README.md" << 'EOF'
# spagenio 모노레포

spagenio.com 서비스를 구성하는 두 프로젝트의 모노레포입니다.

## 프로젝트 구조

```
spagenio/
├── travel-platform/          ← 여행 플랫폼
│   ├── frontend/             ← React + Vite (port 5173)
│   └── backend/
│       ├── src/              ← Spring Boot (port 8080)
│       └── python-service/   ← FastAPI (port 8001)
├── ai-router-dashboard/      ← AI 라우터 대시보드
│   ├── server.js             ← Express (port 3000)
│   └── stock_server.py       ← Flask 주식 API (port 5001)
├── nginx.conf
├── start-all.sh
└── stop-all.sh
```

## 맥미니에서 클론 후 실행

```bash
git clone git@github.com:roundhouse04-star/spagenio.git
cd spagenio
cp ai-router-dashboard/.env.example ai-router-dashboard/.env
# .env 편집 후
./start-all.sh
```
EOF

success "README.md 업데이트 완료"

# ── 변경사항 확인 + 커밋 + push ───────────────────────────
header "8️⃣   GitHub에 push"

CHANGES=$(git status --porcelain)
if [ -z "$CHANGES" ]; then
  success "변경사항 없음"
  exit 0
fi

echo ""
echo -e "${CYAN}변경 내용 요약:${NC}"
git status --short | head -30
TOTAL=$(git status --short | wc -l | tr -d ' ')
[ "$TOTAL" -gt 30 ] && echo "  ... 외 $((TOTAL-30))개"
echo ""

read -p "위 내용을 GitHub에 push하시겠습니까? (y/N): " CONFIRM
[[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]] && { info "취소됨"; exit 0; }

git add -A
git commit -m "refactor: 모노레포 구조 재편성 - ai-router-dashboard 폴더화 + travel-platform 추가"
git push origin "$BRANCH"

# ── 완료 ───────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║  ✅  모노레포 재구성 + GitHub 배포 완료!    ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  📍  ${CYAN}https://github.com/roundhouse04-star/spagenio${NC}"
echo ""
echo -e "  ${BOLD}GitHub 최종 구조:${NC}"
echo -e "  spagenio/"
echo -e "  ├── ${CYAN}ai-router-dashboard/${NC}"
echo -e "  ├── ${CYAN}travel-platform/${NC}"
echo -e "  ├── nginx.conf"
echo -e "  ├── start-all.sh"
echo -e "  └── stop-all.sh"
echo ""
echo -e "  ${BOLD}이후 배포는:${NC}"
echo -e "  ${YELLOW}./deploy.sh \"커밋 메시지\"${NC}"
echo ""
