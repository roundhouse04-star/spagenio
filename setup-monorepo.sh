#!/usr/bin/env bash
set -e

# ── 색상 설정 ────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}━━━ $1 ━━━${NC}"; }


# ── 루트 파일들 복사 섹션 ───────────────────────────────────────
header "📄  루트 파일 확인 및 복사"

# 복사할 파일 목록에 deploy.sh 추가
for f in nginx.conf start-all.sh stop-all.sh deploy.sh setup-monorepo.sh; do
  # 원본 소스 경로(PROJECT_BASE)에서 찾아서 복사
  if [ -f "$PROJECT_BASE/$f" ]; then
    cp "$PROJECT_BASE/$f" "$MONO_ROOT/$f"
    chmod +x "$MONO_ROOT/$f"
    info "복사 및 권한 부여 완료: $f"
  else
    warn "원본에 파일이 없습니다: $f (건너뜀)"
  fi
done

# ════════════════════════════════════════════════════════════
# ✏️  수정된 설정 (GitHub 계정명 및 경로 확인 필수)
# ════════════════════════════════════════════════════════════
# 이미지에 표시된 실제 계정명(roundhouse04)으로 수정함
GITHUB_REPO="git@github.com:roundhouse04-star/spagenio.git"
BRANCH="main"

# 소스 경로 (본인의 실제 경로가 맞는지 꼭 확인!)
PROJECT_BASE="/Users/roundhouse04/프로젝트/spagenio"
AI_SOURCE="$PROJECT_BASE/ai-router-dashboard"
TRAVEL_SOURCE="$PROJECT_BASE/travel-platform"
MONO_ROOT="$HOME/spagenio_deploy"

# rsync 제외 목록 (하위 .git을 반드시 제외해야 화살표 폴더 에러가 안 남)
RSYNC_EXCLUDES=(
  --exclude='.git/'
  --exclude='node_modules/'
  --exclude='venv/'
  --exclude='.venv/'
  --exclude='build/'
  --exclude='.gradle/'
  --exclude='__pycache__/'
  --exclude='logs/'
  --exclude='*.db'
  --exclude='*.sqlite'
  --exclude='.DS_Store'
  --exclude='.env'
  --exclude='*.log'
  --exclude='*.pid'
)
# ════════════════════════════════════════════════════════════

header "🔍 환경 및 포트 점유 확인"

# 3000번 포트(Node) 점유 확인 및 경고
if lsof -i :3000 >/dev/null 2>&1; then
  warn "현재 3000번 포트가 사용 중입니다. 나중에 서버 실행 시 에러가 날 수 있습니다."
fi

[ -d "$AI_SOURCE" ] || error "AI 소스를 찾을 수 없습니다: $AI_SOURCE"
[ -d "$TRAVEL_SOURCE" ] || error "Travel 소스를 찾을 수 없습니다: $TRAVEL_SOURCE"

# ── 모노레포 루트 준비 ─────────────────────────────────────
header "📁 모노레포 폴더 준비"
mkdir -p "$MONO_ROOT"
cd "$MONO_ROOT"

if [ ! -d ".git" ]; then
  git init -b main
  git remote add origin "$GITHUB_REPO"
else
  # 원격 주소가 다를 경우 업데이트
  git remote set-url origin "$GITHUB_REPO"
fi

# ── .gitignore 생성 ────────────────────────────────────────
header "📋 .gitignore 최적화 생성"
cat > "$MONO_ROOT/.gitignore" << 'GITIGNORE'
.env
.env.*.local
node_modules/
dist/
.venv/
venv/
__pycache__/
build/
.gradle/
*.db
*.sqlite
logs/
*.log
*.pid
.DS_Store
.idea/
.vscode/
GITIGNORE

# ── 소스 복사 (rsync 개선) ──────────────────────────────────
header "📦 프로젝트 복사 (Clean Copy)"

info "AI Router Dashboard 복사 중..."
mkdir -p "ai-router-dashboard"
rsync -av "${RSYNC_EXCLUDES[@]}" "$AI_SOURCE/" "ai-router-dashboard/"

info "Travel Platform 복사 중..."
mkdir -p "travel-platform"
rsync -av "${RSYNC_EXCLUDES[@]}" "$TRAVEL_SOURCE/" "travel-platform/"

# ── 스크립트 파일 복사 ─────────────────────────────────────
header "📄 실행 스크립트 복사"
SCRIPT_ORIGIN="$(cd "$(dirname "$0")" && pwd)"
for f in nginx.conf start-all.sh stop-all.sh setup-monorepo.sh; do
  if [ -f "$SCRIPT_ORIGIN/$f" ] && [ "$SCRIPT_ORIGIN" != "$MONO_ROOT" ]; then
    cp "$SCRIPT_ORIGIN/$f" "$MONO_ROOT/$f"
    chmod +x "$MONO_ROOT/$f"
  fi
done

# ── 민감 정보 검사 ────────────────────────────────────────
header "🔒 보안 검사"
if grep -q "PKNSYVAVTRCTHC" "ai-router-dashboard/stock_server.py" 2>/dev/null; then
  warn "⚠️ stock_server.py에 Alpaca API 키가 노출되어 있습니다! 추후 수정을 권장합니다."
fi

# ── Git Commit & Push ─────────────────────────────────────
header "🚀 GitHub 배포"
git add .

# 변경사항이 있는지 확인 후 커밋
if git diff --staged --quiet; then
  info "변경사항이 없습니다."
else
  read -p "커밋 메시지 (기본값: 'feat: 모노레포 구성'): " MSG
  git commit -m "${MSG:-"feat: 모노레포 구성"}"
  
  info "GitHub에 푸시 중..."
  # SSH 키 오류 대비를 위해 시도 후 실패 시 안내
  if ! git push -u origin "$BRANCH"; then
    error "Push 실패! GitHub SSH 키 등록 여부나 저장소 권한을 확인하세요."
  fi
fi

success "모든 작업이 완료되었습니다! https://github.com/roundhouse04/spagenio"