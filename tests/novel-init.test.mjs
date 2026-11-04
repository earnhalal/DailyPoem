// Release check: run the REAL loadNovelsInitial/sanitize functions extracted
// from src/App.jsx against empty, legacy and current stored states, and
// assert the consumer shape (a plain array of novels) every time.
import fs from 'fs';
import { NOVELS_FALLBACK } from '../src/data/novels-data.js';
import { NOVEL_FALLBACK as LEGACY_NOVEL_FALLBACK } from '../src/data/novel.js';
const src = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
function grab(name) {
  const i = src.indexOf('function ' + name);
  if (i < 0) throw new Error('not found: ' + name);
  let depth = 0, j = src.indexOf('{', i);
  do { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; } while (depth > 0);
  return src.slice(i, j);
}
const store = {};
globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const code = `
const LEGACY_NOVEL_ID='aakhri-sajda', NOVELS_CACHE_KEY='dailypoem_novels_cache', LEGACY_NOVEL_CACHE_KEY='dailypoem_novel_cache';
${grab('lsJson')}
${grab('sanitizeNovelEntry')}
${grab('sanitizeNovels')}
${grab('loadNovelsInitial')}
return loadNovelsInitial;`;
const loadNovelsInitial = new Function('NOVELS_FALLBACK', 'LEGACY_NOVEL_FALLBACK', code)(NOVELS_FALLBACK, LEGACY_NOVEL_FALLBACK);
function check(label) {
  const novels = loadNovelsInitial();
  if (!Array.isArray(novels)) throw new Error(label + ': not an array');
  novels.map(n => { if (!n.id || !Array.isArray(n.episodes)) throw new Error(label + ': bad novel shape'); });
  console.log(label + ':', novels.map(n => n.id + ':' + n.episodes.length).join(', '));
}
check('fresh');
store['dailypoem_novel_cache'] = JSON.stringify(LEGACY_NOVEL_FALLBACK);
check('upgrade-legacy-cache');
store['dailypoem_novels_cache'] = JSON.stringify(NOVELS_FALLBACK);
check('new-cache');
store['dailypoem_novels_cache'] = '{"garbage":true}';
check('corrupt-cache-falls-back');
console.log('NOVEL INIT: ALL STATES OK');
