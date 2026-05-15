#!/usr/bin/env python3
"""
Triplive 인스타그램 포스트 9장 일괄 생성 스크립트

출력: ~/Downloads/triplive-instagram/01_cover.png ~ 09_launch.png (1080×1080)

폰트: 프로젝트에 이미 설치된 @expo-google-fonts 의 TTF 사용
  - 영문 타이틀: PlayfairDisplay_800ExtraBold (커버 슬라이드만)
  - 한글 타이틀: NotoSansKR_900Black
  - 부제: NotoSansKR_500Medium
  - 라벨: NotoSansKR_700Bold

색상: 앱과 동일한 톤
  - 배경: #F5EFE4 (베이지)
  - 텍스트: #1E2A3A (네이비)
  - 악센트: #B89968 (골드)

실행:
  python3 scripts/instagram-cards.py
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

# === 설정 ===
PROJECT_ROOT = Path(__file__).resolve().parent.parent
FONTS_DIR = PROJECT_ROOT / 'node_modules' / '@expo-google-fonts'
OUT_DIR = Path.home() / 'Downloads' / 'triplive-instagram'
OUT_DIR.mkdir(parents=True, exist_ok=True)

SIZE = 1080
BG = '#F5EFE4'        # 베이지
FG = '#1E2A3A'        # 네이비 (메인 텍스트)
ACCENT = '#B89968'    # 골드 (라벨, 구분선)
SUBTLE = '#7A7468'    # 부제 색

# 폰트 경로
FONT_PLAYFAIR = FONTS_DIR / 'playfair-display' / '800ExtraBold' / 'PlayfairDisplay_800ExtraBold.ttf'
FONT_NOTO_BLACK = FONTS_DIR / 'noto-sans-kr' / '900Black' / 'NotoSansKR_900Black.ttf'
FONT_NOTO_BOLD = FONTS_DIR / 'noto-sans-kr' / '700Bold' / 'NotoSansKR_700Bold.ttf'
FONT_NOTO_MEDIUM = FONTS_DIR / 'noto-sans-kr' / '500Medium' / 'NotoSansKR_500Medium.ttf'


def load(font_path: Path, size: int) -> ImageFont.FreeTypeFont:
    """폰트 로드."""
    return ImageFont.truetype(str(font_path), size=size)


def text_w(draw: ImageDraw.ImageDraw, txt: str, font: ImageFont.FreeTypeFont) -> int:
    """텍스트 가로 길이 측정."""
    bbox = draw.textbbox((0, 0), txt, font=font)
    return bbox[2] - bbox[0]


def draw_centered(draw: ImageDraw.ImageDraw, txt: str, font: ImageFont.FreeTypeFont, y: int, color: str = FG) -> None:
    """중앙 정렬 텍스트."""
    w = text_w(draw, txt, font)
    draw.text(((SIZE - w) // 2, y), txt, font=font, fill=color)


def make_card(
    filename: str,
    label: str,
    title: str,
    subtitle: str,
    title_font: ImageFont.FreeTypeFont,
    use_playfair: bool = False,
) -> Path:
    """단일 카드 생성."""
    img = Image.new('RGB', (SIZE, SIZE), BG)
    draw = ImageDraw.Draw(img)

    # 상단 라벨 (작은 골드)
    label_font = load(FONT_NOTO_BOLD, 28)
    label_text = f'  {label}  '
    label_w = text_w(draw, label_text, label_font)
    label_y = 140
    # 라벨 박스 (얇은 골드 outline)
    draw.rectangle(
        [(SIZE - label_w) // 2, label_y - 8, (SIZE + label_w) // 2, label_y + 40],
        outline=ACCENT, width=2,
    )
    draw_centered(draw, label_text, label_font, label_y, color=ACCENT)

    # 중앙 타이틀 (메인 텍스트, 큰 글씨)
    # 줄바꿈 처리 — 너무 길면 자동 분할
    title_lines = title.split('\n')
    line_height = 130 if use_playfair else 110
    total_h = line_height * len(title_lines)
    title_y = (SIZE - total_h) // 2 - 30
    for i, line in enumerate(title_lines):
        draw_centered(draw, line, title_font, title_y + i * line_height, color=FG)

    # 부제 (하단)
    sub_font = load(FONT_NOTO_MEDIUM, 38)
    sub_y = SIZE - 240
    sub_lines = subtitle.split('\n')
    for i, line in enumerate(sub_lines):
        draw_centered(draw, line, sub_font, sub_y + i * 55, color=SUBTLE)

    # 하단 핸들
    handle_font = load(FONT_NOTO_MEDIUM, 24)
    draw_centered(draw, '@spagenio.official', handle_font, SIZE - 90, color=ACCENT)

    # 저장
    path = OUT_DIR / filename
    img.save(path, 'PNG', quality=95)
    return path


def main() -> None:
    print(f'📁 출력: {OUT_DIR}\n')

    cards = [
        # (filename, label, title, subtitle, font_path, font_size, use_playfair)
        (
            '01_cover.png', 'OFFICIAL',
            'Triplive', '여행의 처음부터 끝까지',
            FONT_PLAYFAIR, 230, True,
        ),
        (
            '02_ai.png', '01',
            'AI 일정 생성', '채팅 한 번으로\n3박 4일 여행 일정 자동 완성',
            FONT_NOTO_BLACK, 130, False,
        ),
        (
            '03_subway.png', '02',
            '35개 도시\n지하철 노선도', '오프라인에서도 어디서나\n서울 · 도쿄 · 파리 · 뉴욕…',
            FONT_NOTO_BLACK, 100, False,
        ),
        (
            '04_ocr.png', '03',
            '영수증 자동 인식', '사진 한 장이면\n가계부에 즉시 정리',
            FONT_NOTO_BLACK, 120, False,
        ),
        (
            '05_wallet.png', '04',
            '환율 + 가계부', '실시간 환율로 카테고리별\n여행 지출 한눈에',
            FONT_NOTO_BLACK, 130, False,
        ),
        (
            '06_share.png', '05',
            'QR 로 친구와 공유', '계정 없이도\n일정 그대로 전송',
            FONT_NOTO_BLACK, 120, False,
        ),
        (
            '07_summary.png', '06',
            '여행 요약 · 회고', '다녀온 곳 · 지출 · 사진\n자동으로 한눈에',
            FONT_NOTO_BLACK, 120, False,
        ),
        (
            '08_tickets.png', '07',
            '티켓 보관함', '보딩패스 · 입장권 · 공연\n한 폴더에 깔끔하게',
            FONT_NOTO_BLACK, 130, False,
        ),
        (
            '09_launch.png', 'AVAILABLE NOW',
            'App Store ↗', '한 번 결제 ₩7,700 평생 사용\n구독 아닙니다',
            FONT_NOTO_BLACK, 120, False,
        ),
    ]

    for filename, label, title, subtitle, font_path, font_size, use_playfair in cards:
        title_font = load(font_path, font_size)
        path = make_card(filename, label, title, subtitle, title_font, use_playfair)
        print(f'✅ {filename}')

    print(f'\n🎉 {len(cards)} 장 생성 완료')
    print(f'📂 폴더 열기: open "{OUT_DIR}"')


if __name__ == '__main__':
    main()
