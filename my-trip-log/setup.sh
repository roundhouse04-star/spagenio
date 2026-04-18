#!/usr/bin/env bash
set -e

# My Trip Log - Setup Script
# Usage: bash setup.sh

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

echo "============================================"
echo "  My Trip Log - Setup"
echo "============================================"
echo ""

# Node 체크
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js가 설치되지 않았습니다."
  echo "   https://nodejs.org 에서 LTS 버전을 설치해주세요."
  exit 1
fi
echo "✓ Node.js $(node --version)"

# npm 체크
if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm이 설치되지 않았습니다."
  exit 1
fi
echo "✓ npm $(npm --version)"

# 의존성 설치
echo ""
echo "📦 의존성 설치 중..."
npm install

# 임시 에셋 생성
echo ""
echo "🎨 임시 에셋 생성 중..."
mkdir -p assets

# 빈 placeholder 이미지가 없으면 안내
if [ ! -f "assets/icon.png" ]; then
  echo "⚠️  assets/icon.png 파일이 없습니다."
  echo "   임시로 아무 PNG 이미지(1024x1024)를 넣어두세요."
  echo "   예: https://placehold.co/1024.png 에서 다운로드 가능"
fi

if [ ! -f "assets/splash.png" ]; then
  echo "⚠️  assets/splash.png 파일이 없습니다."
fi

# EAS CLI 체크
echo ""
if ! command -v eas >/dev/null 2>&1; then
  echo "ℹ️  EAS CLI가 설치되지 않았습니다. 빌드가 필요할 때 설치하세요:"
  echo "    npm install -g eas-cli"
else
  echo "✓ EAS CLI $(eas --version)"
fi

echo ""
echo "============================================"
echo "  Setup 완료!"
echo "============================================"
echo ""
echo "다음 명령으로 앱을 시작하세요:"
echo ""
echo "  npm start          # Expo Dev Server"
echo "  npm run ios        # iOS 시뮬레이터"
echo "  npm run android    # Android 에뮬레이터"
echo ""
echo "Expo Go 앱이 있으면 QR 코드 스캔만 하면 됩니다!"
echo ""
