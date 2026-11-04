// Acceptance test — DailyPoem v0.15 Bio Studio.
// Asal fancyStyles / BIO_LINES ko source files se import karke test karta hai
// (rewritten copy nahi). Chalana: node tests/bio-studio.test.mjs
import assert from 'node:assert';
import { fancyStyles, BIO_FRAMES, framed } from '../src/data/fancy-text.js';
import { BIO_LINES, BIO_CATEGORIES } from '../src/data/bio-lines.js';

let passed = 0;
const ok = (cond, label) => { assert.ok(cond, label); passed++; console.log('  ✓', label); };

console.log('— fancyStyles: shape —');
const styles = fancyStyles('Wasi 123');
ok(Array.isArray(styles) && styles.length === 15, `15 styles returned (got ${styles.length})`);
const byName = Object.fromEntries(styles.map(s => [s.name, s.out]));

console.log('— Bold uses U+1D400 range —');
const boldFirst = byName['Bold'].codePointAt(0);
ok(boldFirst >= 0x1D400 && boldFirst <= 0x1D7FF, `Bold 'W' -> U+${boldFirst.toString(16).toUpperCase()} in math alphanumeric range`);
ok(byName['Bold'] !== 'Wasi 123', 'Bold output differs from plain input');

console.log('— Bubble uses circled chars —');
const bubble = byName['Bubble'];
ok([...bubble].some(c => { const cp = c.codePointAt(0); return (cp >= 0x24B6 && cp <= 0x24E9) || (cp >= 0x2460 && cp <= 0x24EA); }),
  `Bubble output has circled chars: ${bubble}`);

console.log('— Urdu passes through unchanged in EVERY style —');
for (const s of fancyStyles('محبت')) {
  ok(s.out === 'محبت', `${s.name}: 'محبت' unchanged`);
}

console.log('— Digits mapped (Bold) —');
ok(byName['Bold'].includes('\u{1D7CF}') && byName['Bold'].includes('\u{1D7D0}'), 'Bold digits 1 and 3 mapped to math bold digits');

console.log('— Empty / invalid input never throws —');
assert.deepEqual(fancyStyles(''), []); passed++; console.log('  ✓ empty string -> []');
assert.deepEqual(fancyStyles('   '), []); passed++; console.log('  ✓ whitespace -> []');
assert.deepEqual(fancyStyles(undefined), []); passed++; console.log('  ✓ undefined -> []');
assert.deepEqual(fancyStyles(null), []); passed++; console.log('  ✓ null -> []');

console.log('— Combining styles attach marks, spaces stay clean —');
ok(byName['Strikethrough'].includes('\u0336'), 'Strikethrough uses U+0336');
ok(byName['Underline'].includes('\u0332'), 'Underline uses U+0332');
ok(!byName['Strikethrough'].includes(' \u0336'), 'No mark glued onto spaces');

console.log('— Upside Down reverses —');
const ud = byName['Upside Down'];
ok(ud.startsWith('ƐՇƖ'), `Upside Down of 'Wasi 123' starts with flipped digits (got ${ud.slice(0, 6)}…)`);

console.log('— Frames —');
ok(BIO_FRAMES.length === 12, `12 bio frames (got ${BIO_FRAMES.length})`);
ok(framed('Wasi', 0).includes('꧁༺') && framed('Wasi', 0).includes('Wasi'), 'framed() wraps with Royal frame');
ok(framed('Wasi', -1) === 'Wasi', 'framed() with -1 returns text unchanged');

console.log('— BIO_LINES data —');
ok(BIO_LINES.length >= 50, `${BIO_LINES.length} bio lines total (>= 50)`);
const cats = {};
for (const l of BIO_LINES) {
  cats[l.cat] = (cats[l.cat] || 0) + 1;
  assert.ok(l.id && l.text && ['ur', 'en'].includes(l.lang), `line ${l.id} has id/text/lang`);
  assert.ok(BIO_CATEGORIES.some(c => c.id === l.cat), `line ${l.id} cat '${l.cat}' is a valid chip`);
}
passed++; console.log('  ✓ every line has valid id/text/lang/cat');
console.log('  counts per category:', JSON.stringify(cats));
const withPoet = BIO_LINES.filter(l => l.poet);
ok(withPoet.length === 24, `24 seeded classic couplets carry poet attribution (got ${withPoet.length})`);
ok(new Set(BIO_LINES.map(l => l.id)).size === BIO_LINES.length, 'all ids unique');

console.log(`\nALL ${passed} CHECKS PASSED`);
