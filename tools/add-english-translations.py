#!/usr/bin/env python3
"""
DailyPoem — inject ORIGINAL English translations for the 87 Urdu poems.

Translations written fresh for DailyPoem (2026-11-03) from the Urdu/Roman
text of public-domain classics (Ghalib, Mir, Iqbal, Dagh, Momin, Zafar,
Hasrat, Akbar). Not copied from any published translation.

- Adds/replaces the `english` field (array of lines, same length as `urdu`)
  in content/poems.json and src/data/poems.js.
- Idempotent: re-running replaces `english`, never duplicates.
- Touches nothing else (urdu/roman/hi and all other fields untouched).
"""
import json
import re
import sys

TRANSLATIONS = {
    # ---------------- Ghalib ----------------
    "g1": [
        "A thousand desires, every one of them worth dying for;",
        "So many longings were granted, yet they still seemed too few.",
    ],
    "g2": [
        "O innocent heart, what has come over you?",
        "After all, what cure can there be for this pain?",
    ],
    "g3": [
        "In love, there is no difference between living and dying;",
        "I live by gazing at the very one for whom I would die.",
    ],
    "g4": [
        "The world before me is nothing but a children's playground;",
        "Night and day, a spectacle keeps unfolding before my eyes.",
    ],
    "g5": [
        "The drop finds its joy in being lost within the river;",
        "Pain, once it passes every limit, becomes its own cure.",
    ],
    "g6": [
        "To whom can I say what the night of grief is — a dreadful calamity;",
        "What harm would dying do me, if only it happened once?",
    ],
    "g7": [
        "It was never my fate to be united with the beloved;",
        "Had I lived any longer, it would only have been this same waiting.",
    ],
    "g8": [
        "I hold no faith in blood merely running through the veins;",
        "If it never wells up and drips from the eyes, what blood is it?",
    ],
    "g9": [
        "Love has made Ghalib good for nothing;",
        "Otherwise, I too was once a man of some use.",
    ],
    "g10": [
        "When a glimpse of her brings a glow back to my face,",
        "She imagines that the patient is doing well.",
    ],
    "g11": [
        "Ages have passed since Ghalib died, yet he comes to mind —",
        "That habit of his, at every turn: 'What if it had been otherwise?'",
    ],
    "g12": [
        "The prison of life and the chains of grief are, in truth, one thing;",
        "Before death, how could a man ever win release from sorrow?",
    ],
    "g13": [
        "When nothing existed, God was; had nothing existed, God would still be;",
        "My own existence has drowned me — had I never been, what would I be?",
    ],
    "g14": [
        "Your glance sank from my heart down into my very soul;",
        "With a single gesture, it won the consent of both.",
    ],
    "g15": [
        "Come, let us go and live where there is no one at all;",
        "No one to talk to, no one who speaks our tongue.",
    ],
    "g16": [
        "I am neither the flower of a song nor the fret of an instrument;",
        "I am the voice of my own defeat.",
    ],
    "g17": [
        "My hand may no longer move, but there is life in my eyes yet;",
        "Leave the cup and the wine-flask before me a little longer.",
    ],
    "g18": [
        "Once a man grows used to grief, the grief itself wears away;",
        "So many hardships fell upon me that hardship grew easy.",
    ],
    "g19": [
        "How long shall I go on writing of this heart's pain? Let me go and show her instead —",
        "These fingers of mine, all wounded; this pen of mine, dripping blood.",
    ],
    "g20": [
        "Only a few of them reappeared among the tulips and the roses;",
        "Who knows what lovely faces lie hidden in the dust.",
    ],
    "g21": [
        "It has been long since I last had the beloved as my guest,",
        "Since the gathering blazed with lamps from the fervour of the cup.",
    ],
    "g22": [
        "A sigh needs a whole lifetime before it can take effect;",
        "Who could live long enough for your tangled tresses to be set right?",
    ],
    "g23": [
        "My pain never stood in debt to any medicine;",
        "I neither recovered, nor did I grow any worse.",
    ],
    "g24": [
        "We know full well what Paradise truly is, and yet —",
        "It is a pleasant thought, Ghalib, to keep the heart content.",
    ],
    "g25": [
        "I am at a loss — shall I weep for my heart, or beat my breast for my soul?",
        "If only I could, I would keep a hired mourner ever beside me.",
    ],
    "g26": [
        "She saw her own face in the mirror and stood there, transfixed;",
        "How proud she was of never giving her heart away!",
    ],
    # ---------------- Mir ----------------
    "m1": [
        "My existence is like a bubble on the water;",
        "This whole display is no more than a mirage.",
    ],
    "m2": [
        "Every leaf and every plant knows the state that I am in;",
        "The flower alone may not know — but the entire garden knows.",
    ],
    "m3": [
        "This is only the beginning of love — why do you weep?",
        "Wait, and see what is yet to come.",
    ],
    "m4": [
        "You appeared in such a way that I lost all awareness of myself;",
        "You separated me even from my own self, and walked away.",
    ],
    "m5": [
        "Speak softly by Mir's pillow-side;",
        "Only just now, weeping and weeping, has he fallen asleep.",
    ],
    "m6": [
        "For God's sake, O tyrant, do not lift the veil from the Kaaba;",
        "What if there, too, that same faithless idol is found?",
    ],
    "m7": [
        "When someone happened to utter your name before me,",
        "I clutched at my tormented heart and held it still.",
    ],
    "m8": [
        "Every remedy backfired; no medicine did any good;",
        "In the end, this sickness of the heart finished the matter altogether.",
    ],
    "m9": [
        "Death is merely a pause in the weariness;",
        "That is, we shall travel on, once we have caught our breath.",
    ],
    "m10": [
        "Where has this loss of self carried me off to?",
        "For a long time now, I have been waiting for myself.",
    ],
    "m11": [
        "Breathe gently, for the work is exceedingly delicate —",
        "The work of this glass-making workshop of the heavens.",
    ],
    "m12": [
        "I am no longer worthy of laying love's plea before anyone;",
        "The heart I once took such pride in is no longer mine.",
    ],
    "m13": [
        "What can I tell you of what the night of sorrow is?",
        "A dreadful calamity — know that it has claimed me.",
    ],
    "m14": [
        "Look — does it rise from the heart, or from the soul?",
        "This wisp of smoke, from where does it rise?",
    ],
    "m15": [
        "Whether it was I, or you, or Mir himself —",
        "Every one of us became a captive of her tresses.",
    ],
    "m16": [
        "Delhi — that city, the chosen jewel of the world;",
        "Only the elect of the age once lived within her.",
    ],
    "m17": [
        "Mir — in those half-open eyes of hers",
        "There is all the intoxication of wine.",
    ],
    "m18": [
        "The head that today swells with pride in its crown —",
        "Tomorrow, above that same head, the wailing of mourners will rise.",
    ],
    # ---------------- Iqbal ----------------
    "i1": [
        "Raise the self so high that before every decree of fate,",
        "God Himself turns to His servant and asks: what is your will?",
    ],
    "i2": [
        "Granted, I am not worthy of the sight of You;",
        "Yet look at my longing — look at how I wait.",
    ],
    "i3": [
        "You are a falcon, and flight is your true calling;",
        "There are still more skies spread out before you.",
    ],
    "i4": [
        "Your nest is not upon the dome of a sultan's palace;",
        "You are a falcon — make your dwelling among the mountain crags.",
    ],
    "i5": [
        "For a thousand years the narcissus weeps over its own sightlessness;",
        "Only with the greatest rarity is a true seer born in the garden.",
    ],
    "i6": [
        "Firm faith, unceasing action, a love that conquers the world —",
        "In the struggle of life, these are the swords of true men.",
    ],
    "i7": [
        "Do not be daunted by the fury of the headwind, O eagle;",
        "It blows only in order to carry you higher.",
    ],
    "i8": [
        "Dive deep into your own heart, and there find the clue to life;",
        "If you will not be mine, so be it — at least be your own.",
    ],
    "i9": [
        "At every moment the believer has a new majesty, a new splendour;",
        "In word and in deed, he is a living proof of God.",
    ],
    "i10": [
        "It is the being of woman that lends colour to the portrait of the universe;",
        "It is her music that holds the inner fire of life.",
    ],
    "i11": [
        "Beyond the stars, there are still more worlds;",
        "And love still has more trials yet to pass.",
    ],
    "i12": [
        "You are a falcon, and flight is your true calling;",
        "There are still more skies spread out before you.",
    ],
    "i13": [
        "Reason is a trickster — it can put on a hundred disguises;",
        "Poor love is neither a cleric, nor an ascetic, nor a sage.",
    ],
    "i14": [
        "I want the very utmost of Your love;",
        "Behold my simplicity — just see what it is I want.",
    ],
    "i15": [
        "Strange, simple, and deeply coloured is the story of the Sacred House;",
        "Its ending is Husain, and its beginning is Ismail.",
    ],
    "i16": [
        "My own people are cross with me, and strangers are displeased too;",
        "Never could I bring myself to call deadly poison 'sweet'.",
    ],
    "i17": [
        "The fate of nations rests in the hands of individuals;",
        "Every single person is a star in the destiny of the community.",
    ],
    "i18": [
        "For Your free servants, neither this world nor the next will do:",
        "Here, the restriction of death; there, the restriction of life.",
    ],
    "i19": [
        "You are still on the way — pass beyond the bondage of halting-places;",
        "Pass beyond Egypt and Hijaz, pass beyond Persia and Syria.",
    ],
    "i20": [
        "With the power of love, raise up everything that lies low;",
        "And fill this world with light by the name of Muhammad.",
    ],
    # ---------------- Dagh ----------------
    "d1": [
        "Urdu is its name — and we alone truly know it, says Dagh;",
        "All through Hindustan, our language is the talk of the land.",
    ],
    "d2": [
        "Urdu is its name — and we alone truly know it, says Dagh;",
        "Through all the world, our language is renowned.",
    ],
    "d3": [
        "Torment me if you will, be cruel if you will — but never glance at me with love;",
        "By my head I swear you: in my case, let there be no falling short.",
    ],
    "d4": [
        "Out of regard for you, or out of courtesy, I did at last give in;",
        "But by that false oath of yours, your faith itself was lost.",
    ],
    "d5": [
        "The whole world was listening with the keenest delight;",
        "It was I who fell asleep while telling the tale.",
    ],
    "d6": [
        "When the talk between us turned to sorrows,",
        "The formal 'aap' melted into 'tum', and 'tum' into 'tu'.",
    ],
    "d7": [
        "What a fine veil — she sits pressed close against the curtain;",
        "Neither properly hidden, nor willing to come into view.",
    ],
    # ---------------- Momin ----------------
    "mo1": [
        "You are beside me, so to speak,",
        "In just those moments when there is no one else.",
    ],
    "mo2": [
        "That understanding there once was between you and me — whether you remember it or not;",
        "That very promise, the pledge to remain true — whether you remember it or not.",
    ],
    "mo3": [
        "It makes not the slightest impression on that heart;",
        "Grief was never a thing that increases one's ease.",
    ],
    "mo4": [
        "In love, faithfulness and cruelty amount to the same;",
        "There is relish in everything, if only the heart has a taste for joy.",
    ],
    "mo5": [
        "The night Momin got himself trapped in the mosque,",
        "He got through the night taking God's name, over and over.",
    ],
    "mo6": [
        "With such captivating grace did she sit beside me today,",
        "That while she remained near me, I was no longer myself.",
    ],
    # ---------------- Zafar ----------------
    "z1": [
        "My heart finds no rest in this ruined land;",
        "Whose life has ever prospered in this transient world?",
    ],
    "z2": [
        "How ill-fated is Zafar — that even for his burial",
        "Two yards of earth were not to be had in the beloved's street.",
    ],
    "z3": [
        "I am the light of no one's eyes, nor the repose of anyone's heart;",
        "I am a mere handful of dust that could be of use to none.",
    ],
    "z4": [
        "I begged and brought back a long life — of four days in all;",
        "Two of them passed in yearning, and two in waiting.",
    ],
    "z5": [
        "Never before was speaking so difficult for me;",
        "And your assembly, as it is now, was never like this before.",
    ],
    "z6": [
        "Zafar — do not reckon that person a human being, whatever his condition,",
        "Who in his ease forgets God, and in his anger has no fear of Him.",
    ],
    # ---------------- Hasrat ----------------
    "hm1": [
        "Silently shedding tears, night and day — I still remember;",
        "Even now I remember those days of being in love.",
    ],
    "hm2": [
        "One whom her proud, enchanting glance admits into its secret —",
        "Why should he not take pride in the kindness of his fate?",
    ],
    # ---------------- Akbar ----------------
    "ak1": [
        "Why this whole uproar, just because I drank a little?",
        "I have committed no robbery, nor any theft.",
    ],
    "ak2": [
        "If I so much as heave a sigh, I am branded with disgrace;",
        "They may even commit murder, and no word of it is spoken.",
    ],
}


def js_str(s: str) -> str:
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def update_json(path: str) -> int:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    n = 0
    for p in data["poems"]:
        pid = p["id"]
        if pid in TRANSLATIONS:
            assert len(TRANSLATIONS[pid]) == len(p["urdu"]), f"line count mismatch {pid}"
            p["english"] = TRANSLATIONS[pid]
            n += 1
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    trailing_nl = raw.endswith("\n")
    out = json.dumps(data, ensure_ascii=False, indent=1)
    if trailing_nl:
        out += "\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(out)
    return n


def update_js(path: str) -> int:
    with open(path, encoding="utf-8") as f:
        lines = f.read().split("\n")
    out = []
    current_id = None
    count = 0
    i = 0
    id_re = re.compile(r"^    id: '([^']+)',")
    hi_re = re.compile(r"^    hi: \[.*\],?$")
    eng_re = re.compile(r"^    english: \[.*\],?$")
    while i < len(lines):
        line = lines[i]
        m = id_re.match(line)
        if m:
            current_id = m.group(1)
        if current_id in TRANSLATIONS and hi_re.match(line):
            eng_line = (
                "    english: ["
                + ", ".join(js_str(s) for s in TRANSLATIONS[current_id])
                + "],"
            )
            out.append(line)
            # idempotent: drop an existing english line right after hi
            if i + 1 < len(lines) and eng_re.match(lines[i + 1]):
                i += 1
            out.append(eng_line)
            count += 1
            current_id = None
            i += 1
            continue
        out.append(line)
        i += 1
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    return count


def main() -> None:
    base = sys.argv[1] if len(sys.argv) > 1 else "."
    n_json = update_json(f"{base}/content/poems.json")
    n_js = update_js(f"{base}/src/data/poems.js")
    print(f"poems.json: english set on {n_json} poems")
    print(f"poems.js:   english set on {n_js} poems")
    assert n_json == len(TRANSLATIONS) == 87, (n_json, len(TRANSLATIONS))
    # poems.js is the bundled seed: it holds a subset of the Urdu poems
    # (the rest live only in content/poems.json). Every Urdu poem present
    # in poems.js must have received its translation.
    with open(f"{base}/src/data/poems.js", encoding="utf-8") as f:
        js_ids = set(re.findall(r"^    id: '([^']+)',", f.read(), flags=re.M))
    js_urdu = {i for i in js_ids if i in TRANSLATIONS}
    assert n_js == len(js_urdu), (n_js, len(js_urdu))


if __name__ == "__main__":
    main()
