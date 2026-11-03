#!/usr/bin/env python3
"""
DailyPoem — Roman Urdu -> Devanagari (Hindi) transliteration tool.

Source of truth is each poem's `roman` field (kept in the data as the
transliteration source; it is NOT shown in the app UI). This script
generates the `hi` field (array of Devanagari lines mirroring `roman`)
and writes it into BOTH:
  - src/data/poems.js   (inserted textually after each poem's roman array)
  - content/poems.json  (same ids)

Approach: phoneme-greedy tokenizer + matra/halant state machine,
plus a hand-checked word-fix dictionary and full-line overrides for
the most famous lines (g1, i11, m1) so they read exactly right.

Run:  python3 tools/roman-to-devanagari.py
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POEMS_JS = ROOT / "src" / "data" / "poems.js"
POEMS_JSON = ROOT / "content" / "poems.json"

# ---------------------------------------------------------------- fixes
# Whole-line overrides (hand-checked) — key: (poem_id, line_index)
LINE_OVERRIDES = {
    ("g1", 0): "हज़ारों ख़्वाहिशें ऐसी कि हर ख़्वाहिश पे दम निकले",
    ("g1", 1): "बहुत निकले मेरे अरमाँ लेकिन फिर भी कम निकले",
    ("i11", 0): "सितारों से आगे जहाँ और भी हैं",
    ("i11", 1): "अभी इश्क़ के इम्तिहाँ और भी हैं",
    ("m1", 0): "हस्ती अपनी हुबाब की सी है",
    ("m1", 1): "ये नुमाइश सराब की सी है",
}

# Word fixes — key is the diacritic-folded lowercase roman word.
WORD_FIX = {
    "mein": "में", "main": "मैं", "hain": "हैं", "hai": "है",
    "ke": "के", "ka": "का", "ki": "की", "ko": "को", "se": "से",
    "ne": "ने", "pe": "पे", "par": "पर", "bhi": "भी", "aur": "और",
    "ek": "एक", "ye": "ये", "yeh": "ये", "wo": "वो", "woh": "वो",
    "jo": "जो", "kya": "क्या", "nahin": "नहीं", "nahi": "नहीं",
    "mera": "मेरा", "mere": "मेरे", "meri": "मेरी",
    "tera": "तेरा", "tere": "तेरे", "teri": "तेरी",
    "apna": "अपना", "apni": "अपनी", "apne": "अपने",
    "uska": "उसका", "uski": "उसकी", "iska": "इसका", "iski": "इसकी",
    "si": "सी", "sa": "सा", "thi": "थी", "tha": "था", "the": "थे",
    "sitaaron": "सितारों", "jahaan": "जहाँ", "jahan": "जहाँ",
    "imtihaan": "इम्तिहाँ", "ishq": "इश्क़",
    "khuda": "ख़ुदा", "khwahish": "ख़्वाहिश", "khwahishen": "ख़्वाहिशें",
    "khabar": "ख़बर", "khwaab": "ख़्वाब", "khaak": "ख़ाक",
    "khamosh": "ख़ामोश", "khair": "ख़ैर", "khud": "ख़ुद",
    "dil": "दिल", "duniya": "दुनिया", "mohabbat": "मोहब्बत",
    "zindagi": "ज़िंदगी", "armaan": "अरमाँ", "lekin": "लेकिन",
    "phir": "फिर", "bahut": "बहुत", "aisi": "ऐसी", "aisa": "ऐसा",
    "hasti": "हस्ती", "hubaab": "हुबाब", "numaish": "नुमाइश",
    "saraab": "सराब", "ghalib": "ग़ालिब", "gham": "ग़म",
    "zamaana": "ज़माना", "zamana": "ज़माना", "zamaane": "ज़माने",
    "muhabbat": "मुहब्बत", "nigaah": "निगाह", "nigaahen": "निगाहें",
}

# ------------------------------------------------------- normalization
_FOLD = {
    "ā": "aa", "ī": "ii", "ū": "uu", "ē": "e", "é": "e",
    "ñ": "~", "ṅ": "~", "ṃ": "~",
    "ṭ": "T", "ḍ": "D", "ṛ": "R", "ṣ": "sh", "ḥ": "h",
    "ẓ": "z", "ġ": "g", "ž": "z",
}


def fold(text: str) -> str:
    out = []
    for ch in text.lower():
        out.append(_FOLD.get(ch, ch))
    return "".join(out).replace("'", "").replace("’", "").replace("ʼ", "")


# -------------------------------------------------------- phoneme maps
CONS = {
    "kh": "ख", "gh": "घ", "ch": "च", "chh": "छ", "jh": "झ",
    "th": "थ", "dh": "ध", "ph": "फ", "bh": "भ", "sh": "श", "zh": "झ",
    "Th": "ठ", "Dh": "ढ",
    "k": "क", "q": "क़", "g": "ग", "j": "ज", "T": "ट", "D": "ड",
    "t": "त", "d": "द", "n": "न", "p": "प", "b": "ब", "m": "म",
    "y": "य", "r": "र", "R": "ड़", "l": "ल", "w": "व", "v": "व",
    "s": "स", "z": "ज़", "f": "फ़", "x": "ख़", "h": "ह",
}
IND = {  # independent vowels
    "a": "अ", "aa": "आ", "i": "इ", "ii": "ई", "ee": "ई",
    "u": "उ", "uu": "ऊ", "oo": "ऊ", "e": "ए", "ai": "ऐ",
    "au": "औ", "o": "ओ",
}
MATRA = {  # dependent vowels (after a consonant)
    "a": "", "aa": "ा", "i": "ि", "ii": "ी", "ee": "ी",
    "u": "ु", "uu": "ू", "oo": "ू", "e": "े", "ai": "ै",
    "au": "ौ", "o": "ो",
}
DIGRAPHS = ["chh", "kh", "gh", "ch", "jh", "th", "dh", "ph", "bh",
            "sh", "zh", "Th", "Dh", "aa", "ai", "au", "ee", "ii", "oo", "uu"]


def tokenize(word: str):
    toks, i = [], 0
    while i < len(word):
        hit = None
        for d in DIGRAPHS:
            if word.startswith(d, i):
                hit = d
                break
        if hit:
            toks.append(hit)
            i += len(hit)
        else:
            toks.append(word[i])
            i += 1
    return toks


def convert_word(raw: str) -> str:
    w = fold(raw)
    if not w:
        return raw
    if w in WORD_FIX:
        return WORD_FIX[w]
    toks = tokenize(w)
    out = ""
    open_cons = False  # last emitted consonant has no vowel yet
    prev_vowel = None
    for idx, tok in enumerate(toks):
        nxt = toks[idx + 1] if idx + 1 < len(toks) else None
        if tok == "~":  # nasalization marker (ñ/ṅ)
            out += "ं"
            open_cons = False
            prev_vowel = None
            continue
        if tok == "n" and (nxt in CONS or (nxt is None and prev_vowel in ("e", "ai", "ee", "ii"))):
            # n before a consonant, or line-final n after e/ai -> anusvara
            out += "ं"
            open_cons = False
            prev_vowel = None
            continue
        if tok in CONS:
            # Urdu tadbhav alfaz mein l/n/r se pehle halant aam tor par nahi
            # likhte jab aage vowel ho: nikle -> निकले, marne -> मरने, ikraar -> इकरार
            soft = tok in ("l", "n", "r") and nxt in IND
            if open_cons and not soft:
                out += "्"
            out += CONS[tok]
            open_cons = True
            prev_vowel = None
            continue
        if tok in IND:  # vowel
            if open_cons:
                out += MATRA[tok]
            else:
                out += IND[tok]
            open_cons = False
            prev_vowel = tok
            continue
        out += tok  # unknown char — pass through
        prev_vowel = None
    return out


_PUNCT = ",.;:!?…—–"


def convert_line(line: str) -> str:
    parts = []
    for word in line.split(" "):
        if not word:
            continue
        lead = ""
        trail = ""
        w = word
        while w and w[0] in "«\"“”(":
            lead += w[0]
            w = w[1:]
        while w and w[-1] in _PUNCT:
            trail = w[-1] + trail
            w = w[:-1]
        if "-" in w:
            core = "-".join(convert_word(p) for p in w.split("-"))
        else:
            core = convert_word(w)
        parts.append(lead + core + trail)
    return " ".join(parts)


# ---------------------------------------------------------------- main
def load_poems():
    js = (
        "import(%s).then(m=>process.stdout.write(JSON.stringify(m.POEMS)))"
        % json.dumps(POEMS_JS.as_uri())
    )
    r = subprocess.run(
        ["node", "--input-type=module", "-e", js],
        capture_output=True, text=True, cwd=str(ROOT),
    )
    if r.returncode != 0:
        sys.exit("node failed to load poems.js:\n" + r.stderr)
    return json.loads(r.stdout)


def js_str(s: str) -> str:
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def _bracket_end(src, bstart):
    depth, i, in_str, esc = 0, bstart, False, False
    while i < len(src):
        ch = src[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == "'":
                in_str = False
        else:
            if ch == "'":
                in_str = True
            elif ch == "[":
                depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0:
                    return i
        i += 1
    return i


def insert_into_js(hi_by_id):
    src = POEMS_JS.read_text(encoding="utf-8")
    edits = []  # (start, end, replacement) — peeche se apply honge
    for pid, hi_lines in hi_by_id.items():
        m = re.search(r"id: '%s'," % re.escape(pid), src)
        if not m:
            sys.exit("poem id not found in poems.js: " + pid)
        rstart = src.index("roman:", m.end())
        bstart = src.index("[", rstart)
        bend = _bracket_end(src, bstart)
        hi_arr = "[" + ", ".join(js_str(x) for x in hi_lines) + "]"
        m2 = re.match(r",\s*\n(\s*)hi:\s*\[", src[bend + 1:bend + 60])
        if m2:
            # purani hi maujood hai — usi jagah nayi values replace karo
            hb = src.index("[", bend + 1)
            hend = _bracket_end(src, hb)
            edits.append((hb, hend + 1, hi_arr))
        else:
            edits.append((bend + 1, bend + 1, ",\n    hi: " + hi_arr))
    for start, end, txt in sorted(edits, reverse=True):
        src = src[:start] + txt + src[end:]
    POEMS_JS.write_text(src, encoding="utf-8")


def gen_hi(p):
    roman = p.get("roman") or []
    hi = []
    for li, line in enumerate(roman):
        ov = LINE_OVERRIDES.get((p["id"], li))
        hi.append(ov if ov else convert_line(line))
    return hi


def main():
    poems = load_poems()
    data = json.loads(POEMS_JSON.read_text(encoding="utf-8"))

    # Union: poems.js seed + online content/poems.json (JSON mein zyada poems hain)
    hi_by_id = {}
    for p in poems:
        if p.get("lang") == "ur" and (p.get("roman") or []):
            hi_by_id[p["id"]] = gen_hi(p)
    js_ids = set(hi_by_id)
    for p in data["poems"]:
        if p.get("lang") == "ur" and (p.get("roman") or []) and p["id"] not in hi_by_id:
            hi_by_id[p["id"]] = gen_hi(p)

    insert_into_js({pid: hi_by_id[pid] for pid in js_ids})

    for p in data["poems"]:
        if p["id"] in hi_by_id:
            # rebuild dict so `hi` sits right after `roman`
            newp = {}
            for k, v in p.items():
                if k == "hi":
                    continue
                newp[k] = v
                if k == "roman":
                    newp["hi"] = hi_by_id[p["id"]]
            p.clear()
            p.update(newp)
    # original file 1-space indent par thi — wahi format rakho
    POEMS_JSON.write_text(
        json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )

    print("poems with hi:", len(hi_by_id))
    for pid in ("g1", "i11", "m1", "g3", "i2"):
        if pid in hi_by_id:
            print(pid, "->", " / ".join(hi_by_id[pid]))


if __name__ == "__main__":
    main()
