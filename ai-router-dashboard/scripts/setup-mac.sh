#!/bin/bash
set -e

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo ".env 파일을 생성했습니다. API 키와 webhook URL을 채워주세요."
fi

if [ ! -d node_modules ]; then
  npm install
fi

echo "대시보드를 시작합니다: http://localhost:3000"
npm start
