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

# Remove the template's stale vector foreground/background drawables — some
# launchers/splash screens resolve @drawable/ic_launcher_foreground and would
# show the OLD default icon at startup even with correct mipmaps.
for stale in (
    os.path.join(RES, "drawable", "ic_launcher_background.xml"),
    os.path.join(RES, "drawable-v24", "ic_launcher_foreground.xml"),
    os.path.join(RES, "drawable-v24", "$ic_launcher_foreground__0.xml"),
):
    if os.path.exists(stale):
        os.remove(stale)

# Branded launch splash: the template's launch theme shows res/drawable*/splash.png
# (the OLD default logo on white) full-screen at startup. Regenerate every
# splash.png at its own size: charcoal background + centered gold symbol.
splash_count = 0
for dirpath, _dirs, files in os.walk(RES):
    if "splash.png" not in files:
        continue
    p = os.path.join(dirpath, "splash.png")
    with Image.open(p) as old:
        w, h = old.size
    canvas = Image.new("RGBA", (w, h), CHARCOAL)
    s = int(min(w, h) * 0.42)
    fg = symbol.resize((s, int(s * symbol.height / symbol.width)), Image.LANCZOS)
    canvas.alpha_composite(fg, ((w - fg.width) // 2, (h - fg.height) // 2))
    canvas.convert("RGB").save(p)
    splash_count += 1
print("splash images regenerated:", splash_count)

print("launcher icons written to", RES)
