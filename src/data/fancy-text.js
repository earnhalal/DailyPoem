// DailyPoem — Fancy Text Maker data (Bio Studio, Part B).
// Pure Unicode mapping: har style sirf Latin letters + digits ko badalta hai,
// baqi har character (Urdu, spaces, punctuation jahan map na ho) bilkul waisa
// hi rehta hai — Urdu text har style mein untouched guzarta hai.
// Koi network call nahi, koi dependency nahi.

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const az = 'abcdefghijklmnopqrstuvwxyz';
const DG = '0123456789';

/* Ek base codepoint se range banata hai; exceptions map mein diye gaye
   characters apni khaas Unicode surat lete hain (jo math block mein maujud nahi). */
function rangeMap(chars, base, exceptions = {}) {
  const map = {};
  [...chars].forEach((c, i) => { map[c] = exceptions[c] || String.fromCodePoint(base + i); });
  return map;
}

function mergeMaps(...maps) { return Object.assign({}, ...maps); }

function applyMap(text, map) {
  return [...text].map(c => map[c] || c).join('');
}

function combining(text, mark) {
  // Har Latin/ASCII character ke baad combining mark — leher (strikethrough/underline) wali shaklein.
  // Spaces par mark nahi (line toti hui na lage), aur ghayr-Latin script (masalan Urdu)
  // bilkul untouched rehti hai — Arabic joining bhi combining marks se bigad sakti hai.
  return [...text].map(c => {
    const cp = c.codePointAt(0);
    return cp > 0x20 && cp < 0x7F ? c + mark : c;
  }).join('');
}

/* ---------------- Style maps ---------------- */

const BOLD = mergeMaps(
  rangeMap(AZ, 0x1D400), rangeMap(az, 0x1D41A), rangeMap(DG, 0x1D7CE),
);
const ITALIC = mergeMaps(
  rangeMap(AZ, 0x1D434),
  rangeMap(az, 0x1D44E, { h: '\u210E' }), // small italic h = Planck constant sign
);
const BOLD_ITALIC = mergeMaps(
  rangeMap(AZ, 0x1D468), rangeMap(az, 0x1D482),
);
const SCRIPT = mergeMaps(
  rangeMap(AZ, 0x1D49C, {
    B: '\u212C', E: '\u2130', F: '\u2131', H: '\u210B', I: '\u2110',
    L: '\u2112', M: '\u2133', R: '\u211B',
  }),
  rangeMap(az, 0x1D4B6, { e: '\u212F', g: '\u210A', o: '\u2134' }),
);
const BOLD_SCRIPT = mergeMaps(
  rangeMap(AZ, 0x1D4D0), rangeMap(az, 0x1D4EA),
);
const DOUBLE_STRUCK = mergeMaps(
  rangeMap(AZ, 0x1D538, {
    C: '\u2102', H: '\u210D', N: '\u2115', P: '\u2119', Q: '\u211A', R: '\u211D', Z: '\u2124',
  }),
  rangeMap(az, 0x1D552), rangeMap(DG, 0x1D7D8),
);
const MONOSPACE = mergeMaps(
  rangeMap(AZ, 0x1D670), rangeMap(az, 0x1D68A), rangeMap(DG, 0x1D7F6),
);
const SANS_BOLD = mergeMaps(
  rangeMap(AZ, 0x1D5D4), rangeMap(az, 0x1D5EE), rangeMap(DG, 0x1D7EC),
);

/* Small caps: dono cases (A aur a) chhoti capital surat lete hain */
const SMALL_CAPS_LETTERS = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ',
  k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 'ꜱ', t: 'ᴛ',
  u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
};
const SMALL_CAPS = {};
for (const [low, ch] of Object.entries(SMALL_CAPS_LETTERS)) {
  SMALL_CAPS[low] = ch;
  SMALL_CAPS[low.toUpperCase()] = ch;
}

/* Bubble (circled): digits 1-9 = U+2460.., 0 = U+24EA */
const BUBBLE = mergeMaps(
  rangeMap(AZ, 0x24B6), rangeMap(az, 0x24D0),
  rangeMap('123456789', 0x2460), { 0: '\u24EA' },
);

/* Squared: negative circled capitals (U+1F150..) — digits is block mein nahi, waisay hi rehte hain */
const SQUARED = rangeMap(AZ, 0x1F150);

/* Fullwidth: printable ASCII (0x21-0x7E) -> fullwidth forms, space -> ideographic space */
const FULLWIDTH = { ' ': '\u3000' };
for (let code = 0x21; code <= 0x7E; code++) {
  FULLWIDTH[String.fromCharCode(code)] = String.fromCodePoint(0xFF01 + (code - 0x21));
}

/* Upside down: flip map (string ulta karke har char ka ulta roop) */
const FLIP = {
  a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ə', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ı', j: 'ɾ',
  k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ',
  u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z',
  A: '∀', B: 'ꓭ', C: 'Ɔ', D: 'ᗡ', E: 'Ǝ', F: 'Ⅎ', G: '⅁', H: 'H', I: 'I', J: 'ſ',
  K: 'ꓘ', L: '˥', M: 'W', N: 'N', O: 'O', P: 'Ԁ', Q: 'Ό', R: 'ᴚ', S: 'S', T: '⊥',
  U: '∩', V: 'Λ', W: 'M', X: 'X', Y: '⅄', Z: 'Z',
  0: '0', 1: 'Ɩ', 2: 'Շ', 3: 'Ɛ', 4: 'h', 5: 'ϛ', 6: '9', 7: 'ㄥ', 8: '8', 9: '6',
  '.': '˙', ',': "'", '?': '¿', '!': '¡', "'": ',', '"': ',,', '(': ')', ')': '(',
  '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<', '&': '⅋', '_': '‾',
};

function upsideDown(text) {
  // Sirf ASCII (Latin) hisse ulta hote hain: har ASCII run apni jagah ulta + flip hota hai.
  // Ghayr-Latin script (masalan Urdu) bilkul untouched rehti hai — na tartib badalti hai,
  // na shaklein; warna RTL text toot jata hai.
  const chars = [...text];
  let out = '';
  let i = 0;
  while (i < chars.length) {
    const isAscii = chars[i].codePointAt(0) <= 0x7F;
    let j = i;
    while (j < chars.length && (chars[j].codePointAt(0) <= 0x7F) === isAscii) j++;
    const run = chars.slice(i, j);
    out += isAscii ? run.reverse().map(c => FLIP[c] || c).join('') : run.join('');
    i = j;
  }
  return out;
}

/* ---------------- Public API ---------------- */

/**
 * fancyStyles(text) -> [{ name, out }]
 * Khali/whitespace input par [] deta hai (caller placeholder dikhata hai); kabhi throw nahi karta.
 */
export function fancyStyles(text) {
  const t = typeof text === 'string' ? text : '';
  if (!t.trim()) return [];
  return [
    { name: 'Bold', out: applyMap(t, BOLD) },
    { name: 'Italic', out: applyMap(t, ITALIC) },
    { name: 'Bold Italic', out: applyMap(t, BOLD_ITALIC) },
    { name: 'Script', out: applyMap(t, SCRIPT) },
    { name: 'Bold Script', out: applyMap(t, BOLD_SCRIPT) },
    { name: 'Double-Struck', out: applyMap(t, DOUBLE_STRUCK) },
    { name: 'Monospace', out: applyMap(t, MONOSPACE) },
    { name: 'Sans Bold', out: applyMap(t, SANS_BOLD) },
    { name: 'Small Caps', out: applyMap(t, SMALL_CAPS) },
    { name: 'Bubble', out: applyMap(t, BUBBLE) },
    { name: 'Squared', out: applyMap(t, SQUARED) },
    { name: 'Fullwidth', out: applyMap(t, FULLWIDTH) },
    { name: 'Strikethrough', out: combining(t, '\u0336') },
    { name: 'Underline', out: combining(t, '\u0332') },
    { name: 'Upside Down', out: upsideDown(t) },
  ];
}

/* ---------------- Bio frames ----------------
   Har frame input text ko ghair kar sajata hai. Yehi set Part A (Bio Lines)
   ke "✦ Frame" button mein bhi istemal hota hai. */
export const BIO_FRAMES = [
  { name: 'Royal', wrap: t => `꧁༺ ${t} ༻꧂` },
  { name: 'Star', wrap: t => `★彡 ${t} 彡★` },
  { name: 'Dots', wrap: t => `•|• ${t} •|•` },
  { name: 'Brackets', wrap: t => `『 ${t} 』` },
  { name: 'Arrows', wrap: t => `⫷ ${t} ⫸` },
  { name: 'Crown', wrap: t => `♛ ${t} ♛` },
  { name: 'Sparkle', wrap: t => `✧･ﾟ: *✧･ﾟ:* ${t} *:･ﾟ✧*:･ﾟ✧` },
  { name: 'Wings', wrap: t => `꧁𓆩 ${t} 𓆪꧂` },
  { name: 'Music', wrap: t => `♪ ${t} ♪` },
  { name: 'Heart', wrap: t => `♥ ${t} ♥` },
  { name: 'Lightning', wrap: t => `⚡ ${t} ⚡` },
  { name: 'Diamond', wrap: t => `◆─ ${t} ─◆` },
];

/** framed(text, frameIndex) — index -1 ya invalid ho to text waisa hi wapas. */
export function framed(text, frameIndex) {
  const f = BIO_FRAMES[frameIndex];
  return f ? f.wrap(text) : text;
}
