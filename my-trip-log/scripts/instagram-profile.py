#!/usr/bin/env python3
"""
Triplive 인스타그램 프로필 사진 생성

출력: ~/Downloads/triplive-instagram/profile_*.png

3가지 컨셉 만들어서 비교 선택:
  - profile_beige.png  : 베이지 배경 + 네이비 "T" (포스트와 통일)
  - profile_navy.png   : 네이비 배경 + 베이지 "T" (반전, 더 임팩트)
  - profile_round.png  : 원형 마스크 베이지 배경 (Instagram 원형 미리보기)
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FONTS_DIR = PROJECT_ROOT / 'node_modules' / '@expo-google-fonts'
OUT_DIR = Path.home() / 'Downloads' / 'triplive-instagram'
OUT_DIR.mkdir(parents=True, exist_ok=True)

SIZE = 1080
BEIGE = '#F5EFE4'
NAVY = '#1E2A3A'
GOLD = '#B89968'

FONT_PLAYFAIR = FONTS_DIR / 'playfair-display' / '800ExtraBold' / 'PlayfairDisplay_800ExtraBold.ttf'


def make_profile(bg: str, fg: str, accent: str, name: str) -> Path:
    img = Image.new('RGB', (SIZE, SIZE), bg)
    draw = ImageDraw.Draw(img)

    # 큰 "T" 글자 (Playfair Display, 모노그램)
    t_font = ImageFont.truetype(str(FONT_PLAYFAIR), size=720)
    bbox = draw.textbbox((0, 0), 'T', font=t_font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    # 가운데보다 살짝 위 (밸런스)
    tx = (SIZE - tw) // 2 - bbox[0]
    ty = (SIZE - th) // 2 - bbox[1] - 30
    draw.text((tx, ty), 'T', font=t_font, fill=fg)

    # 하단 "TRIPLIVE" 작은 워드마크
    wm_font = ImageFont.truetype(str(FONT_PLAYFAIR), size=52)
    wm_bbox = draw.textbbox((0, 0), 'TRIPLIVE', font=wm_font)
    wm_w = wm_bbox[2] - wm_bbox[0]
    wm_x = (SIZE - wm_w) // 2
    wm_y = SIZE - 180
    # 위에 얇은 골드 선
    line_w = 80
    draw.rectangle(
        [(SIZE - line_w) // 2, wm_y - 30, (SIZE + line_w) // 2, wm_y - 27],
        fill=accent,
    )
    draw.text((wm_x, wm_y), 'TRIPLIVE', font=wm_font, fill=accent)

    path = OUT_DIR / name
    img.save(path, 'PNG', quality=95)
    return path


def make_round_preview(source: Path, name: str) -> Path:
    """원형 마스크 미리보기 — 인스타에서 어떻게 보일지 확인용."""
    src = Image.open(source).convert('RGBA')
    mask = Image.new('L', (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, SIZE, SIZE), fill=255)
    result = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    result.paste(src, (0, 0), mask=mask)
    path = OUT_DIR / name
    result.save(path, 'PNG')
    return path


def main() -> None:
    print(f'📁 출력: {OUT_DIR}\n')

    # 1. 베이지 배경 (포스트와 통일)
    p1 = make_profile(BEIGE, NAVY, GOLD, 'profile_beige.png')
    print(f'✅ {p1.name}')

    # 2. 네이비 배경 (반전, 더 임팩트)
    p2 = make_profile(NAVY, BEIGE, GOLD, 'profile_navy.png')
    print(f'✅ {p2.name}')

    # 3. 원형 미리보기 (인스타 표시 시뮬레이션)
    p3 = make_round_preview(p1, 'profile_beige_circle_preview.png')
    p4 = make_round_preview(p2, 'profile_navy_circle_preview.png')
    print(f'✅ {p3.name}')
    print(f'✅ {p4.name}')

    print(f'\n🎉 4개 생성 완료')
    print(f'   업로드용: profile_beige.png 또는 profile_navy.png')
    print(f'   미리보기: profile_*_circle_preview.png')


if __name__ == '__main__':
    main()
