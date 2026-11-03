#!/usr/bin/env python3
"""Generate Android launcher icons (legacy + adaptive) from the brand masters.

Run from the repo root AFTER `npx cap sync android`:
    python3 tools/make_launcher_icons.py
Reads:  public/brand/app-icon-1024.png  (full icon: symbol on charcoal)
        public/brand/symbol.png        (transparent symbol for the foreground)
Writes: android/app/src/main/res/mipmap-*/ic_launcher*.png,
        mipmap-anydpi-v26/ic_launcher(_round).xml,
        values/ic_launcher_background.xml
Requires: pillow (CI installs it: python3 -m pip install -q pillow)
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
CHARCOAL = (18, 15, 12, 255)

icon = Image.open(os.path.join(ROOT, "public", "brand", "app-icon-1024.png")).convert("RGBA")
symbol = Image.open(os.path.join(ROOT, "public", "brand", "symbol.png")).convert("RGBA")

LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
ADAPTIVE = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}

for density, size in LEGACY.items():
    d = os.path.join(RES, f"mipmap-{density}")
    os.makedirs(d, exist_ok=True)
    icon.resize((size, size), Image.LANCZOS).save(os.path.join(d, "ic_launcher.png"))
    icon.resize((size, size), Image.LANCZOS).save(os.path.join(d, "ic_launcher_round.png"))

for density, size in ADAPTIVE.items():
    d = os.path.join(RES, f"mipmap-{density}")
    os.makedirs(d, exist_ok=True)
    canvas = Image.new("RGBA", (size, size), CHARCOAL)
    fg_size = int(size * 0.60)
    fg = symbol.resize((fg_size, int(fg_size * symbol.height / symbol.width)), Image.LANCZOS)
    canvas.alpha_composite(fg, ((size - fg.width) // 2, (size - fg.height) // 2))
    canvas.save(os.path.join(d, "ic_launcher_foreground.png"))

anydpi = os.path.join(RES, "mipmap-anydpi-v26")
os.makedirs(anydpi, exist_ok=True)
ADAPTIVE_XML = (
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
    '    <background android:drawable="@color/ic_launcher_background"/>\n'
    '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
    "</adaptive-icon>\n"
)
for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
    with open(os.path.join(anydpi, name), "w", encoding="utf-8") as f:
        f.write(ADAPTIVE_XML)

values = os.path.join(RES, "values")
os.makedirs(values, exist_ok=True)
with open(os.path.join(values, "ic_launcher_background.xml"), "w", encoding="utf-8") as f:
    f.write(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<resources><color name="ic_launcher_background">#120F0C</color></resources>\n'
    )

print("launcher icons written to", RES)
