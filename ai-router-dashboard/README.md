# AI Router Dashboard Turbo (Mac Ready)

맥에서 바로 실행할 수 있도록 만든 **고성능형 선택 AI 자동화 대시보드**입니다.

## 이번 버전에서 강화한 점
- **속도 우선 / 균형형 / 품질 우선** 프로필 추가
- **실시간 상태 카드** 추가
- **프리셋 버튼**으로 바로 작업 전환 가능
- `GET /api/health`, `GET /api/presets` 추가
- 외부 webhook 호출에 **timeout 보호** 추가
- 시뮬레이션 모드에서도 **예상 비용대 / 추천 이유** 확인 가능
- 맥미니 로컬 운용 기준 **turbo-local** 프로필 적용

## 포함된 기능
- n8n / OpenClaw / Hybrid 자동 추천 선택
- ChatGPT / Gemini / Claude 선택
- 3번 방식(하이브리드 자동 추천) 포함
- 속도 / 비용 / 품질 기준 동시 제어
- 실서버 URL이 없을 때도 시뮬레이션 모드로 테스트 가능
- Mac 로컬 실행 또는 Docker 실행 가능

## 폴더 구조
```text
ai-router-dashboard/
├─ config/
│  └─ n8n-workflows/
├─ public/
│  ├─ index.html
│  ├─ style.css
│  ├─ app.js
│  └─ architecture.svg
├─ scripts/
├─ .env.example
├─ docker-compose.yml
├─ package.json
├─ server.js
├─ start.command
└─ README.md
```

## 1) Mac에서 바로 실행
### Node.js 방식
1. Node.js 20 이상 설치
2. 터미널에서 프로젝트 폴더 이동
3. `.env.example`를 `.env`로 복사
4. 아래 명령 실행

```bash
cp .env.example .env
npm install
npm start
```

브라우저에서 `http://localhost:3000` 접속

### 한 번에 실행
Finder에서 `start.command`를 더블클릭하면 됩니다.

처음 실행 시 macOS에서 실행 권한 경고가 나면 한 번만 아래를 실행하세요.

```bash
chmod +x start.command scripts/setup-mac.sh
```

## 2) Docker 방식
```bash
cp .env.example .env
docker compose up
```

## 3) .env 설정 예시
```env
PORT=3000
N8N_WEBHOOK_URL=http://localhost:5678/webhook/ai-router
OPENCLAW_WEBHOOK_URL=http://localhost:8080/webhook/agent
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_anthropic_key
DEFAULT_ENGINE=hybrid
DEFAULT_MODEL=gemini
DEFAULT_PRIORITY_MODE=balanced
REQUEST_TIMEOUT_MS=20000
PERF_PROFILE=turbo-local
```

## 4) 추천 성능 설정
### 가장 빠르게
- 엔진: `Hybrid 자동 추천`
- 모델: `Gemini`
- 최적화 모드: `균형형` 또는 `비용 우선`
- 우선순위 프로필: `속도 우선`

### 가장 안정적으로
- 엔진: `n8n`
- 모델: `Gemini`
- 우선순위 프로필: `균형형`

### 가장 품질 좋게
- 엔진: `Hybrid 자동 추천` 또는 `OpenClaw`
- 모델: `GPT` 또는 `Claude`
- 우선순위 프로필: `품질 우선`

## 5) API 엔드포인트
- `GET /api/config` : 현재 설정, provider 상태, 프리셋
- `GET /api/health` : 서버 상태, uptime, 요청 통계
- `GET /api/presets` : 빠른 프리셋 목록
- `POST /api/route-decision` : 라우팅 미리보기
- `POST /api/run` : 실제 실행 또는 시뮬레이션 실행

## 6) 하이브리드 자동 추천 규칙
- 반복형/연동형 업무 → n8n 추천
- 복합 판단/에이전트 업무 → OpenClaw 추천
- 비용 우선 → Gemini 추천
- 문서 작업 → Claude 추천
- 복잡한 추론 → GPT 추천
- 속도 우선 → 가능하면 n8n + Gemini 추천

## 7) n8n import용 예시 워크플로
`config/n8n-workflows/` 폴더에 import 가능한 예시 JSON이 들어 있습니다.

- `ai-router-webhook.json`
- `telegram-ai-router.json`

### n8n에서 가져오기
1. n8n 접속
2. Workflows → Import from File
3. `config/n8n-workflows/*.json` 선택
4. Webhook path와 credential 확인 후 Activate

## 8) 권장 연결 방식
### n8n 쪽
- Webhook 노드를 하나 만들고 POST 입력 받기
- `N8N_WEBHOOK_URL`에 연결
- 반복 업무, 알림, 이메일, 뉴스 요약 연결

### OpenClaw 쪽
- 외부 요청을 받을 webhook endpoint 준비
- `OPENCLAW_WEBHOOK_URL`에 연결
- 복합 판단형, 비서형, 데스크톱 제어 작업 연결

## 9) 맥에서 같이 쓰기 좋은 구성
- 맥미니
- Docker Desktop
- n8n
- 이 대시보드
- 필요 시 OpenClaw

## 10) 보안 주의
- API 키는 `.env`에만 넣기
- `.env`는 Git에 올리지 않기
- 실서비스 전에는 localhost 또는 내부망에서 먼저 테스트
- webhook endpoint는 가능하면 내부망 또는 reverse proxy 뒤에 두기

## 11) 추천 흐름
- 텔레그램 명령 → 이 대시보드 → n8n/OpenClaw
- 뉴스 요약 → Gemini
- 중요 보고서 → Claude
- 복합 분석 → GPT 또는 OpenClaw
