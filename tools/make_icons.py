"""Generate the app icons and the social preview image (assets/icons, assets/og-image.png).

Usage: python tools/make_icons.py
Needs Pillow. The preview text uses Segoe UI Black (Windows); change FONT for other systems.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'icons')
os.makedirs(OUT, exist_ok=True)
NAVY, WHITE, GOLD = (26, 33, 64), (241, 243, 250), (255, 210, 63)
FONT = r'C:\Windows\Fonts\seguibl.ttf'
SS = 4  # supersampling


def logo(draw, cx, cy, r):
    """Ring with a bar through it and a gold centre, like the site header logo."""
    w = r * 0.22
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=WHITE, width=round(w))
    draw.rectangle((cx - r, cy - w / 2, cx - r * 0.33, cy + w / 2), fill=WHITE)
    draw.rectangle((cx + r * 0.33, cy - w / 2, cx + r, cy + w / 2), fill=WHITE)
    rc = r * 0.33
    draw.ellipse((cx - rc, cy - rc, cx + rc, cy + rc), fill=GOLD, outline=WHITE, width=round(w))


def icon(size, name, scale, rounded):
    big = size * SS
    im = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if rounded:
        d.rounded_rectangle((0, 0, big - 1, big - 1), radius=big * 0.22, fill=NAVY)
    else:
        d.rectangle((0, 0, big, big), fill=NAVY)
    logo(d, big / 2, big / 2, big * scale / 2)
    im.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name), optimize=True)


icon(192, 'icon-192.png', 0.62, True)
icon(512, 'icon-512.png', 0.62, True)
icon(512, 'maskable-512.png', 0.5, False)   # full-bleed, logo inside the safe zone
icon(180, 'apple-touch-icon.png', 0.6, False)
icon(32, 'favicon-32.png', 0.8, True)

# Social preview 1200x630
W, H = 1200, 630
im = Image.new('RGB', (W * 2, H * 2), NAVY)
d = ImageDraw.Draw(im)
logo(d, 2 * 150, 2 * 170, 2 * 70)
title = ImageFont.truetype(FONT, 2 * 84)
sub = ImageFont.truetype(FONT.replace('seguibl', 'segoeui'), 2 * 40)
d.text((2 * 90, 2 * 280), 'Champions', font=title, fill=WHITE)
d.text((2 * 90, 2 * 370), 'Battle Helper', font=title, fill=WHITE)
d.text((2 * 90, 2 * 500), 'Type any Pokémon. See what beats it.', font=sub, fill=(180, 186, 216))
d.rectangle((0, 2 * H - 2 * 14, 2 * W, 2 * H), fill=GOLD)
im.resize((W, H), Image.LANCZOS).save(os.path.join(ROOT, 'assets', 'og-image.png'), optimize=True)
print('icons written to', OUT)
