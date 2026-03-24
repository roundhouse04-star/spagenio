# spagenio 모노레포

## 폴더 구조
```
spagenio/
├── travel-platform/          ← 기존 프로젝트 그대로 복사
│   ├── frontend/
│   │   └── vite.config.js    ← 이 파일로 교체 (base: '/travel/')
│   └── backend/
├── ai-router-dashboard/      ← 기존 프로젝트 그대로 복사
│   └── vite.config.js        ← 이 파일로 교체 (base: '/ai/')
├── nginx.conf
├── start-all.sh
├── stop-all.sh
└── README.md
```

## 설치 및 실행

### 1. 프로젝트 파일 배치
기존 두 프로젝트를 이 폴더 안에 복사합니다.
```bash
cp -r ~/프로젝트/travel-platform     ./travel-platform
cp -r ~/프로젝트/ai-router-dashboard ./ai-router-dashboard
```

### 2. vite.config.js 교체
```bash
# travel-platform 용
cp travel-platform/frontend/vite.config.js travel-platform/frontend/vite.config.js.bak
cp <이 폴더의 vite.config.js (travel)> travel-platform/frontend/vite.config.js

# ai-router-dashboard 용
cp ai-router-dashboard/vite.config.js ai-router-dashboard/vite.config.js.bak
cp <이 폴더의 vite.config.js (ai)> ai-router-dashboard/vite.config.js
```

### 3. 서버에서 실행
```bash
./start-all.sh   # 전체 시작
./stop-all.sh    # 전체 종료
```

### 4. Nginx 설정 (서버에서 1회)
```bash
sudo cp nginx.conf /etc/nginx/sites-available/spagenio
sudo ln -s /etc/nginx/sites-available/spagenio /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 5. SSL 인증서 (최초 1회)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d spagenio.com -d www.spagenio.com
```

## 포트 정리
| 서비스 | 포트 | URL |
|--------|------|-----|
| travel 프론트엔드 | 5173 | /travel |
| travel Java 백엔드 | 8080 | /travel/api |
| travel Python | 8001 | /travel/python |
| ai 프론트엔드 | 5174 | /ai |
| ai 백엔드 | 8002 | /ai/api |
