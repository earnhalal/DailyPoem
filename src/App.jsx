import { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { POEMS, POETS, CATEGORIES, SCENES, poetOf, poemOfTheDay, POEMS_REMOTE_URL } from './data/poems.js';
import { DUAS, HADEES, noorOfTheDay } from './data/noor.js';
import { NOVEL_FALLBACK as LEGACY_NOVEL_FALLBACK, NOVEL_REMOTE_URL as LEGACY_NOVEL_REMOTE_URL } from './data/novel.js';
import { NOVELS_FALLBACK, NOVELS_REMOTE_URL } from './data/novels-data.js';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

const FAV_KEY = 'dailypoem_favs_v1';

/* ---------------- Reels — vertical video feed ---------------- */
const REELS_REMOTE_URL = 'https://raw.githubusercontent.com/earnhalal/DailyPoem/main/content/reels.json';
const MUSIC_REMOTE_BASE = 'https://raw.githubusercontent.com/earnhalal/DailyPoem/main/music/';
const REELS_CACHE_KEY = 'dailypoem_reels_cache';
const REELS_FALLBACK = [
  { id: 'reel-e1', poemId: 'e1', video: 'https://raw.githubusercontent.com/earnhalal/DailyPoem/main/videos/reel-e1.mp4', title: 'The Light I Chose', poet: 'DailyPoem Originals' },
  { id: 'reel-e2', poemId: 'e2', video: 'https://raw.githubusercontent.com/earnhalal/DailyPoem/main/videos/reel-e2.mp4', title: 'The Room I Kept', poet: 'DailyPoem Originals' },
  { id: 'reel-e3', poemId: 'e3', video: 'https://raw.githubusercontent.com/earnhalal/DailyPoem/main/videos/reel-e3.mp4', title: 'Unposted', poet: 'DailyPoem Originals' },
];

function loadFavs() {
  try { const v = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return new Set(Array.isArray(v) ? v.filter(x => typeof x === 'string') : []); } catch { return new Set(); }
}

/* Online/cache content kabhi kharab ho sakta hai — render se pehle shape lazmi check karo,
   warna ek invalid entry puri app ko white-screen kar deti hai. */
function sanitizePoems(list) {
  if (!Array.isArray(list)) return null;
  const seen = new Set();
  const out = [];
  for (const p of list) {
    if (!p || typeof p.id !== 'string' || seen.has(p.id)) continue;
    if (p.lang === 'ur') {
      if (!Array.isArray(p.urdu) || !p.urdu.length) continue;
      out.push({ ...p, roman: Array.isArray(p.roman) ? p.roman : [], hi: Array.isArray(p.hi) ? p.hi : [], english: Array.isArray(p.english) ? p.english : [] });
    } else if (p.lang === 'en') {
      if (!Array.isArray(p.lines) || !p.lines.length) continue;
      out.push(p);
    } else continue;
    seen.add(p.id);
  }
  return out.length ? out : null;
}

/* ---------------- Novels (multi-novel library) ----------------
   Data shape: { novels: [ { id, title, urduTitle, author, synopsis, plannedEpisodes, genre, episodes } ] }.
   Legacy single-novel shape { novel, episodes } bhi accept hota hai (purani novel.json aur
   purana cache, transition ke doran) — wo hamesha 'aakhri-sajda' ban kar wrap ho jata hai. */
const LEGACY_NOVEL_ID = 'aakhri-sajda';
const NOVELS_CACHE_KEY = 'dailypoem_novels_cache';
const LEGACY_NOVEL_CACHE_KEY = 'dailypoem_novel_cache';

function sanitizeNovelEntry(d) {
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.episodes)) return null;
  const eps = d.episodes.filter(e => e && typeof e.n === 'number' && Array.isArray(e.body) && e.body.length);
  if (!eps.length) return null;
  const id = typeof d.id === 'string' && d.id ? d.id : LEGACY_NOVEL_ID;
  const base = id === LEGACY_NOVEL_ID ? LEGACY_NOVEL_FALLBACK.novel : {};
  return { ...base, ...d, id, episodes: eps };
}

function sanitizeNovels(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (Array.isArray(raw.novels)) {
    const out = [];
    const seen = new Set();
    for (const n of raw.novels) {
      const clean = sanitizeNovelEntry(n);
      if (clean && !seen.has(clean.id)) { out.push(clean); seen.add(clean.id); }
    }
    return out.length ? { novels: out } : null;
  }
  if (raw.novel && Array.isArray(raw.episodes)) {
    const clean = sanitizeNovelEntry({ ...raw.novel, id: LEGACY_NOVEL_ID, episodes: raw.episodes });
    return clean ? { novels: [clean] } : null;
  }
  return null;
}

/* Pehle launch par novels data: naya cache -> purana (legacy shape) cache -> bundled fallback */
function loadNovelsInitial() {
  const clean = sanitizeNovels(lsJson(NOVELS_CACHE_KEY, null))
    || sanitizeNovels(lsJson(LEGACY_NOVEL_CACHE_KEY, null));
  return clean ? clean.novels : NOVELS_FALLBACK.novels;
}

/* Per-novel progress keys: 'aakhri-sajda' ke liye PURANI keys hi rehti hain taake maujooda
   users ki reading progress / bookmarks zaya na hon; baqi novels ke liye wohi keys + ':' + id. */
function novelKeySuffix(id) { return id === LEGACY_NOVEL_ID ? '' : ':' + id; }
const novelReadKey = id => 'dailypoem_novel_read' + novelKeySuffix(id);
const novelPosKey = id => 'dailypoem_novel_pos' + novelKeySuffix(id);
const novelBmKey = id => 'dailypoem_novel_bookmarks' + novelKeySuffix(id);
const novelFavKey = id => 'dailypoem_novel_fav' + novelKeySuffix(id);

/* Ek novel ke published episodes — publishAt ka ehtiram, n ke hisaab se sorted */
function publishedOf(nv) {
  const now = Date.now();
  return [...(nv.episodes || [])].sort((a, b) => a.n - b.n).filter(e => epPublishMs(e) <= now);
}

function linesOf(poem) {
  if (poem.lang === 'ur') return poem.urdu;
  return poem.lines;
}

/* ---------------- Poetry display language ----------------
   Sirf TEEN options: 'ur' Urdu script, 'hi' Hindi (Devanagari), 'en' English.
   Roman Urdu sirf data ke andar transliteration source hai — UI mein KABHI
   render nahi hota (owner ka hukum). Secondary line ka usool:
   ur -> koi secondary nahi (sirf Urdu, bara) · hi -> poem.hi (na ho to english)
   en -> poem.english (na ho to hi). English poems par secondary hamesha hidden. */
const LANG_KEY = 'dailypoem_lang';
const LANG_OPTIONS = [
  { id: 'ur', name: 'اردو', label: 'Urdu', sample: 'ہزاروں خواہشیں ایسی کہ ہر خواہش پہ دم نکلے' },
  { id: 'hi', name: 'हिन्दी', label: 'Hindi', sample: 'हज़ारों ख़्वाहिशें ऐसी कि हर ख़्वाहिश पे दम निकले' },
  { id: 'en', name: 'English', label: 'English', sample: 'A thousand desires, each one worth dying for' },
];
function loadLang() {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return LANG_OPTIONS.some(o => o.id === v) ? v : null;
  } catch { return null; }
}
/* Canvas wale hisay (share card) React state se bahir hain — unke liye module mirror */
let DISPLAY_LANG = loadLang() || 'ur';
function setDisplayLang(v) { DISPLAY_LANG = v; }

function secondaryOf(poem, lang) {
  if (!poem || poem.lang !== 'ur' || !lang || lang === 'ur') return null;
  const pick = a => (Array.isArray(a) && a.length ? a : null);
  let src = null, kind = null;
  if (lang === 'hi') { src = pick(poem.hi); kind = 'hindi'; if (!src) { src = pick(poem.english); kind = 'english'; } }
  else if (lang === 'en') { src = pick(poem.english); kind = 'english'; if (!src) { src = pick(poem.hi); kind = 'hindi'; } }
  return src ? { lines: src, kind } : null;
}
/* Secondary line ka JSX — roman class hi istemal hoti hai, hindi par font badal jata hai */
function SecLines({ sec, single = false }) {
  if (!sec) return null;
  const lines = single ? sec.lines.slice(0, 1) : sec.lines;
  return <div className={'roman' + (sec.kind === 'hindi' ? ' hindi' : '')}>{lines.map((l, i) => <div key={i}>{l}</div>)}</div>;
}

function speak(text, lang) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return false;
    const voices = synth.getVoices();
    const want = lang === 'ur' ? 'ur' : 'en';
    const v = voices.find(x => x.lang && x.lang.toLowerCase().startsWith(want));
    if (!v && voices.length) return false; // list loaded hai magar matching voice nahi
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (v) { u.voice = v; u.lang = v.lang; } // list abhi load nahi hui to default voice par koshish karo
    u.rate = 0.92;
    synth.speak(u);
    return true;
  } catch { return false; }
}

function stopSpeak() { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { /* noop */ } }

function synthHasVoice(lang) {
  try {
    const voices = (window.speechSynthesis && window.speechSynthesis.getVoices()) || [];
    if (!voices.length) return lang !== 'ur'; // list abhi load nahi hui — English default voice farz karo, Urdu ka guess nahi
    return voices.some(x => x.lang && x.lang.toLowerCase().startsWith(lang === 'ur' ? 'ur' : 'en'));
  } catch { return false; }
}


/* ------------- Card text layout: word-wrap + shrink-to-fit ------------- */
let _measureCtx = null;
function measureCtx() {
  if (!_measureCtx) _measureCtx = document.createElement('canvas').getContext('2d');
  return _measureCtx;
}

function wrapTextLines(ctx, lines, maxW) {
  const out = [];
  let widest = 0;
  for (const raw of lines) {
    const words = String(raw).split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (!cur || ctx.measureText(test).width <= maxW) { cur = test; continue; }
      out.push(cur); widest = Math.max(widest, ctx.measureText(cur).width);
      cur = w;
    }
    if (cur) { out.push(cur); widest = Math.max(widest, ctx.measureText(cur).width); }
  }
  return { lines: out, widest };
}

/* Poora sher/nazm card par fit karo: font size step by step kam karo jab tak saari
   lines (wrap ke baad) width mein bhi aur total height mein bhi jagah par na aa jayen.
   Canvas render aur editor preview dono yahi layout istemal karte hain. */
function fitPoemText({ poem, maxW, availH, scale = 1, fontStack = null, baseFs = null, stepF = null, weight = '', italic = false, letterSpacing = 0, secLines = null, secKind = null }) {
  const isUr = poem.lang === 'ur';
  const ctx = measureCtx();
  const src = linesOf(poem);
  /* secLines diya jaye to secondary wahi hoga (language system); warna purana roman.
     Share card hamesha secLines bhejta hai taake card par roman kabhi na aaye. */
  const romanSrc = secLines != null ? secLines : (isUr && Array.isArray(poem.roman) ? poem.roman : []);
  const hasTitle = !isUr && !!poem.title;
  const base = Math.round((baseFs || (isUr ? 64 : 58)) * scale);
  const floor = isUr ? 20 : 16;
  const useLS = !!letterSpacing;
  let best = null;
  for (let fs = base; fs >= floor; fs -= 2) {
    ctx.font = fontStack
      ? weight + (italic ? 'italic ' : '') + fs + 'px ' + fontStack
      : (isUr ? fs + 'px "Noto Nastaliq Urdu", serif' : '600 ' + fs + 'px "Playfair Display", serif');
    if (useLS) { try { ctx.letterSpacing = letterSpacing + 'px'; } catch { /* purani WebView */ } }
    const fontMain = ctx.font;
    const main = wrapTextLines(ctx, src, maxW);
    const step = fs * (stepF || (isUr ? 2.15 : 1.42));
    const rFs = Math.max(17, Math.round(fs * 0.54));
    ctx.font = secKind === 'hindi' ? rFs + 'px "Noto Sans Devanagari", Inter, sans-serif' : 'italic ' + rFs + 'px "Cormorant Garamond", serif';
    if (useLS) { try { ctx.letterSpacing = '0px'; } catch { /* noop */ } }
    const fontRoman = ctx.font;
    const rom = romanSrc.length ? wrapTextLines(ctx, romanSrc, maxW) : { lines: [], widest: 0 };
    const rStep = rFs * 1.45;
    const titleH = hasTitle ? fs * 1.5 : 0;
    const blockH = titleH + main.lines.length * step + (rom.lines.length ? 14 + rom.lines.length * rStep : 0);
    best = { isUr, hasTitle, titleH, fs, step, lines: main.lines, roman: rom.lines, rFs, rStep, blockH, fontMain, fontRoman, secKind };
    if (blockH <= availH && main.widest <= maxW + 6 && rom.widest <= maxW + 6) break;
  }
  return best;
}

const CARD_RATIOS = [
  { id: 'square', label: 'Square · 1:1', w: 1080, h: 1080 },
  { id: 'portrait', label: 'Portrait · 4:5', w: 1080, h: 1350 },
  { id: 'story', label: 'Story · 9:16', w: 1080, h: 1920 },
];

/* ---------------- Share card (canvas) ---------------- */
async function makeShareCard(poem, scene) {
  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#241b12'); grad.addColorStop(1, '#0c0a09');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  if (scene) {
    try {
      const img = new Image();
      img.src = scene.img;
      await img.decode();
      ctx.globalAlpha = 0.4;
      ctx.drawImage(img, 0, 0, W, H);
      ctx.globalAlpha = 1;
      const shade = ctx.createLinearGradient(0, 0, 0, H);
      shade.addColorStop(0, 'rgba(12,10,9,.35)'); shade.addColorStop(1, 'rgba(12,10,9,.92)');
      ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
    } catch { /* scene optional */ }
  }
  ctx.strokeStyle = 'rgba(212,175,55,.55)'; ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d4af37';
  ctx.font = '600 34px Inter, sans-serif';
  ctx.fillText('\u2014 POEM OF THE DAY \u2014', W / 2, 130);
  try {
    await document.fonts.load('44px "Noto Nastaliq Urdu"');
    await document.fonts.load('600 44px "Playfair Display"');
    await document.fonts.load('italic 30px "Cormorant Garamond"');
  } catch { /* fonts optional */ }
  const poet = poetOf(poem.poet);
  /* Share card ki secondary line bhi display language ke hisaab se — roman kabhi nahi.
     Urdu mode mein card sirf Urdu ka hoga (secLines = []). */
  const sec = secondaryOf(poem, DISPLAY_LANG);
  const L = fitPoemText({
    poem, maxW: W - 170, availH: H - 560, scale: 1,
    secLines: poem.lang === 'ur' ? (sec ? sec.lines : []) : undefined,
    secKind: sec ? sec.kind : null,
  });
  let y = 250 + Math.max(0, (H - 560 - L.blockH) / 2);
  if (L.hasTitle) {
    ctx.fillStyle = '#d4af37';
    ctx.font = 'italic 600 ' + Math.round(L.fs * 0.78) + 'px "Playfair Display", serif';
    ctx.fillText(poem.title, W / 2, y + L.fs * 1.02);
    y += L.titleH;
  }
  ctx.fillStyle = '#f3ead8';
  ctx.font = L.isUr ? L.fs + 'px "Noto Nastaliq Urdu", serif' : '600 ' + L.fs + 'px "Playfair Display", serif';
  L.lines.forEach((ln, i) => ctx.fillText(ln, W / 2, y + L.step * 0.72 + i * L.step));
  y += L.lines.length * L.step;
  if (L.roman.length) {
    ctx.fillStyle = '#d9cdb6';
    ctx.font = L.secKind === 'hindi' ? L.rFs + 'px "Noto Sans Devanagari", Inter, sans-serif' : 'italic ' + L.rFs + 'px "Cormorant Garamond", serif';
    L.roman.forEach((ln, i) => ctx.fillText(ln, W / 2, y + 14 + L.rStep * 0.72 + i * L.rStep));
  }
  ctx.fillStyle = '#d4af37';
  ctx.font = '600 36px Inter, sans-serif';
  ctx.fillText('\u2014 ' + (poem.customPoet || poet.name) + ' \u2014', W / 2, H - 190);
  ctx.fillStyle = '#a89c8a';
  ctx.font = '28px Inter, sans-serif';
  ctx.fillText('DailyPoem \u2014 Shayari & Poetry Reels', W / 2, H - 110);
  return canvas;
}

async function sharePoem(poem, scene, toast) {
  try {
    const canvas = await makeShareCard(poem, scene);
    if (Capacitor.isNativePlatform()) {
      const data = canvas.toDataURL('image/png').split(',')[1];
      const { uri } = await Filesystem.writeFile({ path: 'dailypoem-card.png', data, directory: Directory.Cache });
      await Share.share({ title: 'DailyPoem', files: [uri] });
      return;
    }
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], 'dailypoem.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'DailyPoem' });
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'dailypoem.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Card saved as an image');
  } catch (e) {
    if (e && /cancel/i.test(e.message || '')) return; // user ne share sheet band ki — error nahi
    toast('Sharing is not available on this device');
  }
}


async function shareCanvasFile(canvas, toast, filename) {
  try {
    if (Capacitor.isNativePlatform()) {
      const data = canvas.toDataURL('image/png').split(',')[1];
      const { uri } = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
      await Share.share({ title: 'DailyPoem', files: [uri] });
      return;
    }
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'DailyPoem' }); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Image saved');
  } catch (e) { if (e && /cancel/i.test(e.message || '')) return; toast('Sharing is not available on this device'); }
}

async function shareBlobFile(blob, toast, filename) {
  try {
    if (Capacitor.isNativePlatform()) {
      const buf = await blob.arrayBuffer();
      let bin = ''; const bytes = new Uint8Array(buf); const CH = 0x8000;
      for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
      const { uri } = await Filesystem.writeFile({ path: filename, data: btoa(bin), directory: Directory.Cache });
      await Share.share({ title: 'DailyPoem Reel', files: [uri] });
      toast('Video ready — choose where to share');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('Video downloaded');
  } catch (e) { if (e && /cancel/i.test(e.message || '')) return; toast('Sharing is not available on this device'); }
}

/* ------------- Reel -> real MP4 video (WebCodecs) ------------- */
/* opts: { height: 1280|1920, watermark: bool, cancelRef: {current:bool} } */
async function exportReelVideo(poem, scene, toast, setProgress, opts = {}) {
  if (!('VideoEncoder' in window)) { toast('Video export is not supported on this device yet'); return; }
  try {
    const H = opts.height === 1920 ? 1920 : 1280, W = Math.round(H * 9 / 16), FPS = 24;
    const K = H / 1280; // 720p par 1, 1080p par 1.5 — font/bar sizes isi se scale hote hain
    const watermark = opts.watermark !== false;
    const lines = linesOf(poem);
    let audioBuf = null;
    if (poem.audio) {
      try {
        const resp = await fetch(poem.audio);
        const ab = await resp.arrayBuffer();
        const AC = window.AudioContext || window.webkitAudioContext;
        const ac = new AC();
        try { audioBuf = await ac.decodeAudioData(ab); } finally { ac.close().catch(() => {}); }
      } catch { audioBuf = null; }
    }
    let dur = lines.length * 2.2 + 1.6;
    if (audioBuf) dur = Math.min(40, audioBuf.duration + 0.6);
    /* Bundled voice nahi hai (Urdu / apni poetry) to mood ki background music lagao:
       reel ki poori duration tak loop, halki awaaz (gain 0.6), aakhir mein fade-out.
       Music na mile to video khamosh export hogi aur aakhir mein toast se bata denge. */
    let musicMissed = false;
    if (!audioBuf && poem.category) {
      try {
        const resp = await fetch(MUSIC_REMOTE_BASE + poem.category + '.mp3');
        if (!resp.ok) throw new Error('music http ' + resp.status);
        const ab = await resp.arrayBuffer();
        const AC2 = window.AudioContext || window.webkitAudioContext;
        const ac2 = new AC2();
        try {
          const mb = await ac2.decodeAudioData(ab);
          const sr = mb.sampleRate, ch = Math.min(2, mb.numberOfChannels);
          const frames = Math.max(1, Math.floor(dur * sr));
          const fade = Math.min(frames, Math.floor(sr * 0.8));
          const lb = ac2.createBuffer(ch, frames, sr);
          for (let c = 0; c < ch; c++) {
            const src = mb.getChannelData(Math.min(c, mb.numberOfChannels - 1));
            const dst = lb.getChannelData(c);
            for (let i = 0; i < frames; i++) {
              let v = src[i % src.length] * 0.6;
              if (fade > 0 && i >= frames - fade) v *= (frames - i) / fade;
              dst[i] = v;
            }
          }
          audioBuf = lb;
        } finally { ac2.close().catch(() => {}); }
      } catch { musicMissed = true; }
    }
    const per = dur / lines.length;
    /* User ki photo (template) pehle load karo — scene sirf tab load hota hai jab photo na ho */
    let photoImg = null;
    if (opts.photo && opts.photo.dataUrl) {
      const pim = new Image();
      pim.src = opts.photo.dataUrl;
      try { await pim.decode(); } catch { /* proceed */ }
      if (pim.naturalWidth) photoImg = pim;
    }
    const tpl = photoImg ? (['full', 'framed', 'split'].indexOf(opts.photo.template) >= 0 ? opts.photo.template : 'full') : 'scene';
    const darkness = photoImg ? Math.min(0.8, Math.max(0, Number(opts.photo.darkness) || 0)) : 0;
    const img = new Image();
    if (!photoImg) {
      img.src = scene.img;
      try { await img.decode(); } catch { /* proceed */ }
    }
    try { await document.fonts.load('40px "Noto Nastaliq Urdu"'); await document.fonts.load('33px "Playfair Display"'); } catch { /* fonts optional */ }
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    /* Photo templates ke liye cover-fit draw — har hissa isi hisaab se banta hai,
       taake export aur preview ki layout ek jaisi rahe */
    const drawCover = (im, x, y, w, h, zoom = 1) => {
      const base = Math.max(w / im.naturalWidth, h / im.naturalHeight) * zoom;
      const dw = im.naturalWidth * base, dh = im.naturalHeight * base;
      ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    };
    const rrPath = (x, y, w, h, r) => {
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
      else ctx.rect(x, y, w, h);
    };
    const drawFrame = (t) => {
      ctx.fillStyle = '#0b0908'; ctx.fillRect(0, 0, W, H);
      if (tpl === 'scene') {
        if (img && img.naturalWidth) {
          const sc = 1 + 0.09 * (t / dur);
          const base = Math.max(W / img.naturalWidth, H / img.naturalHeight);
          const w = img.naturalWidth * base * sc, h = img.naturalHeight * base * sc;
          ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
        }
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, 'rgba(10,8,7,.42)'); g.addColorStop(0.55, 'rgba(10,8,7,.30)'); g.addColorStop(1, 'rgba(10,8,7,.80)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      } else if (tpl === 'full') {
        drawCover(photoImg, 0, 0, W, H, 1 + 0.09 * (t / dur));
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, 'rgba(10,8,7,.42)'); g.addColorStop(0.55, 'rgba(10,8,7,.30)'); g.addColorStop(1, 'rgba(10,8,7,.80)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        if (darkness > 0) { ctx.fillStyle = 'rgba(0,0,0,' + (darkness * 0.85).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
      } else if (tpl === 'framed') {
        /* Dhundli (blurred) badi photo peeche, asli photo gold frame mein upar.
           ctx.filter har WebView mein nahi hota — pehle parakh lo; na ho to
           halki alpha wali badi copy + gehre saye ka fallback istemal karo. */
        let blurred = false;
        try {
          ctx.filter = 'blur(' + Math.round(22 * K) + 'px) brightness(' + (0.62 - darkness * 0.3).toFixed(2) + ')';
          blurred = String(ctx.filter).indexOf('blur') >= 0;
          if (blurred) drawCover(photoImg, 0, 0, W, H, 1.18);
          ctx.filter = 'none';
        } catch { try { ctx.filter = 'none'; } catch { /* noop */ } }
        if (!blurred) {
          ctx.globalAlpha = 0.55; drawCover(photoImg, 0, 0, W, H, 1.18); ctx.globalAlpha = 1;
          ctx.fillStyle = 'rgba(5,4,3,' + (0.35 + darkness * 0.3).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
        }
        const fx = W * 0.11, fw = W * 0.78, fy = H * 0.05, fh = H * 0.55;
        ctx.save(); rrPath(fx, fy, fw, fh, 14 * K); ctx.clip();
        drawCover(photoImg, fx, fy, fw, fh, 1);
        ctx.restore();
        ctx.strokeStyle = '#d4af37'; ctx.lineWidth = Math.max(2, 3 * K);
        rrPath(fx, fy, fw, fh, 14 * K); ctx.stroke();
        const g2 = ctx.createLinearGradient(0, H * 0.58, 0, H);
        g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,.5)');
        ctx.fillStyle = g2; ctx.fillRect(0, H * 0.58, W, H * 0.42);
      } else { /* split — photo upar 55%, gehra panel neeche */
        const ph = H * 0.55;
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, ph); ctx.clip();
        drawCover(photoImg, 0, 0, W, ph, 1);
        ctx.restore();
        if (darkness > 0) { ctx.fillStyle = 'rgba(0,0,0,' + (darkness * 0.5).toFixed(3) + ')'; ctx.fillRect(0, 0, W, ph); }
        ctx.fillStyle = '#0d0a08'; ctx.fillRect(0, ph, W, H - ph);
        ctx.fillStyle = '#d4af37'; ctx.fillRect(0, ph - K, W, 2 * K);
      }
      const barH = Math.max(3, Math.round(5 * K));
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(0, 0, W, barH);
      ctx.fillStyle = '#d4af37'; ctx.fillRect(0, 0, W * (t / dur), barH);
      ctx.textAlign = 'center';
      const isUr = poem.lang === 'ur';
      const fs = (isUr ? 40 : 33) * K;
      const step = (isUr ? 98 : 50) * K;
      ctx.font = isUr ? fs + 'px "Noto Nastaliq Urdu", serif' : '600 ' + fs + 'px "Playfair Display", serif';
      const totalH = lines.length * step;
      /* Lines ka region: scene/full mein poora frame (purani layout), framed mein
         frame ke neeche, split mein neeche wale panel mein — preview bhi yahi karti hai */
      const rg = tpl === 'framed' ? { top: H * 0.63, bottom: H * 0.955 }
        : tpl === 'split' ? { top: H * 0.565, bottom: H * 0.96 }
        : { top: 0, bottom: H };
      const y0 = rg.top + ((rg.bottom - rg.top) - totalH) / 2 + step * 0.72;
      lines.forEach((ln, i) => {
        const at = 0.4 + i * per;
        if (t < at) return;
        ctx.globalAlpha = Math.min(1, (t - at) / 0.45);
        ctx.fillStyle = '#fdf6e3';
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 10 * K;
        ctx.fillText(ln, W / 2, y0 + i * step);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      });
      ctx.fillStyle = '#d4af37'; ctx.font = '600 ' + Math.round(25 * K) + 'px Inter, sans-serif';
      const poetY = (tpl === 'framed' || tpl === 'split')
        ? Math.min(H - 36 * K, y0 + totalH + 30 * K)
        : H - 84 * K;
      ctx.fillText('\u2014 ' + (poem.customPoet || poetOf(poem.poet).name) + ' \u2014', W / 2, poetY);
      if (watermark) {
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(243,234,216,.75)'; ctx.font = Math.round(20 * K) + 'px Inter, sans-serif';
        ctx.fillText('\u2726 DailyPoem', W - 18 * K, H - 22 * K);
        ctx.textAlign = 'center';
      }
    };
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: W, height: H },
      audio: audioBuf ? { codec: 'aac', sampleRate: audioBuf.sampleRate, numberOfChannels: Math.min(2, audioBuf.numberOfChannels) } : undefined,
      fastStart: 'in-memory', firstTimestampBehavior: 'offset',
    });
    const venc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: () => {} });
    const vcfg = { codec: H >= 1920 ? 'avc1.64002a' : 'avc1.640028', width: W, height: H, bitrate: H >= 1920 ? 5000000 : 2400000, framerate: FPS };
    const sup = await VideoEncoder.isConfigSupported(vcfg);
    if (!sup.supported) { toast('Video format is not supported on this device'); return; }
    venc.configure(vcfg);
    if (audioBuf && 'AudioEncoder' in window) {
      try {
        const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: () => {} });
        const ch = Math.min(2, audioBuf.numberOfChannels);
        const acfg = { codec: 'mp4a.40.2', sampleRate: audioBuf.sampleRate, numberOfChannels: ch, bitrate: 128000 };
        const asup = await AudioEncoder.isConfigSupported(acfg);
        if (asup.supported) {
          aenc.configure(acfg);
          const chans = []; for (let c = 0; c < ch; c++) chans.push(audioBuf.getChannelData(c));
          const CF = 1024;
          for (let off = 0; off < audioBuf.length; off += CF) {
            const n = Math.min(CF, audioBuf.length - off);
            const buf = new ArrayBuffer(n * 4 * ch); const view = new Float32Array(buf);
            for (let c = 0; c < ch; c++) view.set(chans[c].subarray(off, off + n), c * n);
            const ad = new AudioData({ format: 'f32-planar', sampleRate: audioBuf.sampleRate, numberOfFrames: n, numberOfChannels: ch, timestamp: Math.round(off / audioBuf.sampleRate * 1e6), data: buf });
            aenc.encode(ad); ad.close();
          }
          await aenc.flush(); aenc.close();
        }
      } catch { /* silent video */ }
    }
    const total = Math.floor(dur * FPS);
    const cancelled = () => !!(opts.cancelRef && opts.cancelRef.current);
    for (let f = 0; f <= total; f++) {
      if (cancelled()) { try { venc.close(); } catch { /* noop */ } setProgress(0); toast('Export cancelled'); return; }
      drawFrame(f / FPS);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(f * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
      venc.encode(frame, { keyFrame: f % (FPS * 2) === 0 });
      frame.close();
      if (venc.encodeQueueSize > 5) await new Promise(r => setTimeout(r, 10));
      if (f % 12 === 0) { setProgress(Math.round((f / total) * 100)); await new Promise(r => setTimeout(r, 0)); }
    }
    if (cancelled()) { try { venc.close(); } catch { /* noop */ } setProgress(0); toast('Export cancelled'); return; }
    await venc.flush(); venc.close();
    muxer.finalize();
    setProgress(100);
    await shareBlobFile(new Blob([muxer.target.buffer], { type: 'video/mp4' }), toast, 'dailypoem-reel.mp4');
    if (musicMissed) toast('Exported without music (music unavailable)');
  } catch { toast('Video export failed on this device'); }
}

/* ------------- Photo card (editor state -> canvas) ------------- */
async function makePhotoCard(o) {
  const W = o.W || 1080, H = o.H || 1350;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  let bgImg = null;
  if (o.bgMode === 'photo') bgImg = o.img;
  else if (o.bgMode === 'scene') bgImg = await loadImg(o.scene.img);
  if (bgImg && bgImg.naturalWidth) {
    const base = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight);
    const w = bgImg.naturalWidth * base, h = bgImg.naturalHeight * base;
    ctx.drawImage(bgImg, (W - w) / 2, (H - h) / 2, w, h);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, o.color.from); g.addColorStop(1, o.color.to);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = 'rgba(0,0,0,' + (o.shade * 0.75).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
  const bg2 = ctx.createLinearGradient(0, H * 0.45, 0, H);
  bg2.addColorStop(0, 'rgba(0,0,0,0)'); bg2.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = bg2; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = o.color.light ? 'rgba(138,106,24,.5)' : 'rgba(212,175,55,.5)';
  ctx.lineWidth = 3; ctx.strokeRect(30, 30, W - 60, H - 60);
  ctx.textAlign = 'center';
  const poet = poetOf(o.poem.poet);
  const gold = o.color.light ? '#8a6a18' : '#d4af37';
  ctx.fillStyle = gold; ctx.font = '600 30px Inter, sans-serif';
  ctx.fillText('\u2726 DAILYPOEM \u2726', W / 2, 108);
  try {
    await document.fonts.load('60px "Noto Nastaliq Urdu"');
    await document.fonts.load('600 54px "Playfair Display"');
    await document.fonts.load('italic 34px "Cormorant Garamond"');
  } catch { /* fonts optional */ }
  const L = fitPoemText({ poem: o.poem, maxW: W - 150, availH: H - 376, scale: o.scale });
  let y = (o.posY / 100) * H - L.blockH / 2;
  y = Math.max(118, Math.min(y, H - 190 - L.blockH));
  const blockTop = y;
  if (L.hasTitle) {
    ctx.fillStyle = gold; ctx.font = 'italic 600 ' + Math.round(L.fs * 0.74) + 'px "Playfair Display", serif';
    ctx.fillText(o.poem.title, W / 2, y + L.fs * 0.98);
    y += L.titleH;
  }
  ctx.fillStyle = o.tcHex;
  ctx.font = L.isUr ? L.fs + 'px "Noto Nastaliq Urdu", serif' : '600 ' + L.fs + 'px "Playfair Display", serif';
  L.lines.forEach((ln, i) => ctx.fillText(ln, W / 2, y + L.step * 0.72 + i * L.step));
  y += L.lines.length * L.step;
  if (L.roman.length) {
    ctx.globalAlpha = 0.88; ctx.fillStyle = o.tcHex;
    ctx.font = 'italic ' + L.rFs + 'px "Cormorant Garamond", serif';
    L.roman.forEach((ln, i) => ctx.fillText(ln, W / 2, y + 14 + L.rStep * 0.72 + i * L.rStep));
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = gold; ctx.font = '600 38px Inter, sans-serif';
  ctx.fillText('\u2014 ' + (o.poem.customPoet || poet.name) + ' \u2014', W / 2, blockTop + L.blockH + 62);
  if (o.name) {
    ctx.textAlign = 'left'; ctx.globalAlpha = 0.92; ctx.fillStyle = o.tcHex;
    ctx.font = '30px Inter, sans-serif';
    ctx.fillText('\u270D ' + o.name, 56, H - 58);
    ctx.globalAlpha = 1; ctx.textAlign = 'center';
  }
  ctx.fillStyle = o.color.light ? 'rgba(42,31,16,.6)' : 'rgba(243,234,216,.55)';
  ctx.font = '24px Inter, sans-serif';
  ctx.fillText('DailyPoem \u2014 Shayari & Poetry Reels', W / 2, H - 58);
  return canvas;
}

async function copyPoem(poem, toast) {
  const poet = poetOf(poem.poet);
  const lines = linesOf(poem).join('\n');
  const head = poem.lang === 'en' && poem.title ? poem.title + '\n\n' : '';
  const text = `${head}${lines}\n— ${poem.customPoet || poet.name}`;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* noop */ }
    ta.remove();
  }
  toast('📋 Copied — paste it anywhere');
}

/* ---------------- Reel Player ---------------- */
const REEL_ANIMS = [
  { id: 'fade', label: 'Fade' },
  { id: 'rise', label: 'Rise' },
  { id: 'slide', label: 'Slide' },
];

/* Apni photo par reel banane ke templates — preview aur MP4 export dono yahi layout rakhte hain */
const PHOTO_TPLS = [
  { id: 'full', label: 'Full Photo' },
  { id: 'framed', label: 'Framed' },
  { id: 'split', label: 'Split' },
];

function ReelPlayer({ poem, scene, onClose, toast, anim = 'rise', onAnimChange, lang }) {
  const lines = linesOf(poem);
  const sec = secondaryOf(poem, lang);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [sc, setSc] = useState(scene);
  const hasAudio = !!poem.audio;
  const [voice, setVoice] = useState(hasAudio);
  const [pace, setPace] = useState(2100);
  const [exporting, setExporting] = useState(0);
  const [expQ, setExpQ] = useState(() => { try { return localStorage.getItem('dailypoem_export_q') || '720'; } catch { return '720'; } });
  const [wm, setWm] = useState(() => { try { return localStorage.getItem('dailypoem_export_wm') !== '0'; } catch { return true; } });
  const audioRef = useRef(null);
  const cancelRef = useRef(false);
  /* Apni photo wala background — photo sirf phone par rehti hai, kahin upload nahi hoti */
  const [photo, setPhoto] = useState(null);
  const [bgMode, setBgMode] = useState('scene'); // 'scene' | 'photo'
  const [tpl, setTpl] = useState('full');
  const [dark, setDark] = useState(35);
  const photoRef = useRef(null);
  const poet = poetOf(poem.poet);

  useEffect(() => { setSc(scene); }, [scene]);

  // bundled audio (English poems): pace the lines to the recording
  useEffect(() => {
    if (!hasAudio) return;
    const el = audioRef.current;
    if (!el) return;
    const onMeta = () => {
      if (el.duration && isFinite(el.duration)) {
        const per = (el.duration * 1000) / lines.length;
        setPace(Math.min(5200, Math.max(2000, per)));
      }
    };
    el.addEventListener('loadedmetadata', onMeta);
    return () => el.removeEventListener('loadedmetadata', onMeta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAudio]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (voice && playing) { el.play().catch(() => {}); } else { el.pause(); }
  }, [voice, playing, hasAudio]);

  // line progression
  useEffect(() => {
    if (!playing) return;
    if (shown >= lines.length) { setPlaying(false); return; }
    const t = setTimeout(() => setShown(s => s + 1), shown === 0 ? 500 : pace);
    return () => clearTimeout(t);
  }, [playing, shown, lines.length, pace]);

  // device-voice fallback (custom poems / Urdu where a voice exists)
  useEffect(() => {
    if (hasAudio || !voice || shown === 0 || shown > lines.length) return;
    const text = poem.lang === 'ur' ? (poem.roman && poem.roman[shown - 1]) || lines[shown - 1] : lines[shown - 1];
    speak(text, poem.lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, voice, hasAudio]);

  useEffect(() => () => { stopSpeak(); if (audioRef.current) audioRef.current.pause(); }, []);

  const toggleVoice = () => {
    if (voice) { setVoice(false); stopSpeak(); return; }
    if (!hasAudio && !synthHasVoice(poem.lang)) {
      toast(poem.lang === 'ur'
        ? 'Urdu voice is not available on this device yet'
        : 'Voice is not available on this device');
      return;
    }
    setVoice(true);
  };

  const restart = () => {
    setShown(0); setPlaying(true);
    if (audioRef.current) { audioRef.current.currentTime = 0; if (voice) audioRef.current.play().catch(() => {}); }
  };

  const pickQ = q => { setExpQ(q); try { localStorage.setItem('dailypoem_export_q', q); } catch { /* noop */ } };
  const toggleWm = () => setWm(w => { const n = !w; try { localStorage.setItem('dailypoem_export_wm', n ? '1' : '0'); } catch { /* noop */ } return n; });

  const onPickPhoto = e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      try {
        const MAX = 1440;
        const s = Math.min(1, MAX / Math.max(im.naturalWidth, im.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * s);
        c.height = Math.round(im.naturalHeight * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        setPhoto(c.toDataURL('image/jpeg', 0.86));
        setBgMode('photo');
        toast('Photo added — it stays on your device');
      } catch { toast('That photo could not be loaded'); }
      URL.revokeObjectURL(url);
    };
    im.onerror = () => { URL.revokeObjectURL(url); toast('That photo could not be loaded'); };
    im.src = url;
    e.target.value = '';
  };

  const startExport = async () => {
    if (exporting) return;
    cancelRef.current = false;
    setPlaying(false);
    setExporting(1);
    await exportReelVideo(poem, sc, toast, setExporting, {
      height: expQ === '1080' ? 1920 : 1280, watermark: wm, cancelRef,
      photo: bgMode === 'photo' && photo ? { dataUrl: photo, template: tpl, darkness: dark / 100 } : null,
    });
    setExporting(0);
  };

  return (
    <div className="reel">
      {bgMode === 'photo' && photo ? (
        tpl === 'full' ? (
          <>
            <div className="reel-bg"><img src={photo} alt="" /></div>
            <div className="reel-shade" />
            <div className="reel-darklayer" style={{ opacity: (dark / 100 * 0.85).toFixed(2) }} />
          </>
        ) : tpl === 'framed' ? (
          <div className="reel-tpl">
            <div className="tpl-back" style={{ backgroundImage: `url("${photo}")`, filter: `blur(16px) brightness(${(0.62 - (dark / 100) * 0.3).toFixed(2)})` }} />
            <div className="tpl-frame"><img src={photo} alt="" /></div>
            <div className="tpl-shadeb" />
          </div>
        ) : (
          <div className="reel-tpl">
            <div className="tpl-top"><img src={photo} alt="" /><span style={{ background: `rgba(0,0,0,${(dark / 100 * 0.5).toFixed(2)})` }} /></div>
            <div className="tpl-panel" />
          </div>
        )
      ) : (
        <>
          <div className="reel-bg"><img src={sc.img} alt="" /></div>
          <div className="reel-shade" />
        </>
      )}
      {hasAudio && <audio ref={audioRef} src={poem.audio} preload="auto" />}
      <div className="reel-top">
        <span className="reel-brand">✦ DailyPoem Reel</span>
        <button className="reel-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className={'reel-mid' + (bgMode === 'photo' && photo && tpl !== 'full' ? ' low' : '')}>
        {lines.map((ln, i) => (
          <div key={i} className={`reel-line ${poem.lang === 'ur' ? 'ur' : 'en'}${!sec && poem.lang === 'ur' ? ' big' : ''} anim-${anim} ${i < shown ? 'show' : ''}`}>{ln}</div>
        ))}
        {sec && (
          <div className={`reel-line rm${sec.kind === 'hindi' ? ' hindi' : ''} ${shown >= lines.length ? 'show' : ''}`}>{sec.lines.join(' · ')}</div>
        )}
      </div>
      <div className="reel-poet">— {poem.customPoet || poet.name}</div>
      <div className="progress"><i style={{ width: `${(shown / lines.length) * 100}%` }} /></div>
      {exporting > 0 && (
        <div className="reel-export">
          <div>Rendering video… {exporting}%</div>
          <div className="reel-export-bar"><span style={{ width: exporting + '%' }} /></div>
          <small>Keep the app open while it renders</small>
          <div style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => { cancelRef.current = true; }}>✕ Cancel export</button>
          </div>
        </div>
      )}
      <div className="reel-controls">
        {shown >= lines.length
          ? <button className="btn" onClick={restart}>↺ Replay</button>
          : <button className="btn" onClick={() => setPlaying(p => !p)}>{playing ? '⏸ Pause' : '▶ Play'}</button>}
        <button className="btn" onClick={toggleVoice}>{voice ? '🔊 Voice On' : '🔇 Voice'}</button>
        <button className="btn" onClick={() => sharePoem(poem, sc, toast)}>📤 Share</button>
        <button className="btn" onClick={startExport}>🎬 Video</button>
      </div>
      {exporting === 0 && (
        <div className="reel-opts">
          <div className="reel-opts-row">
            <span className="reel-opts-label">Animation</span>
            {REEL_ANIMS.map(a => (
              <button key={a.id} className={'reel-chip' + (anim === a.id ? ' on' : '')} onClick={() => onAnimChange && onAnimChange(a.id)}>{a.label}</button>
            ))}
          </div>
          <div className="reel-opts-row">
            <span className="reel-opts-label">Scene</span>
            {SCENES.map(s => (
              <button key={s.id} className={'reel-scene' + (bgMode === 'scene' && sc.id === s.id ? ' on' : '')} onClick={() => { setSc(s); setBgMode('scene'); }} title={s.label} aria-label={s.label}><img src={s.img} alt="" /></button>
            ))}
            <button className={'reel-chip' + (bgMode === 'photo' ? ' on' : '')}
              onClick={() => { if (photo) setBgMode('photo'); else if (photoRef.current) photoRef.current.click(); }}>
              {photo && <img className="thumb" src={photo} alt="" />}📷 My Photo
            </button>
            <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickPhoto} />
          </div>
          {bgMode === 'photo' && photo && (
            <>
              <div className="reel-opts-row">
                <span className="reel-opts-label">Template</span>
                {PHOTO_TPLS.map(t => (
                  <button key={t.id} className={'reel-chip' + (tpl === t.id ? ' on' : '')} onClick={() => setTpl(t.id)}>{t.label}</button>
                ))}
                <button className="reel-chip" onClick={() => { if (photoRef.current) photoRef.current.click(); }}>↺ Change</button>
                <button className="reel-chip" onClick={() => { setPhoto(null); setBgMode('scene'); }}>✕ Remove</button>
              </div>
              <div className="reel-opts-row">
                <span className="reel-opts-label">Darkness</span>
                <input className="reel-range" type="range" min="0" max="80" step="1" value={dark}
                  onChange={e => setDark(Number(e.target.value))} aria-label="Photo darkness" />
                <span className="reel-photonote">🔒 Your photo stays on your device</span>
              </div>
            </>
          )}
          <div className="reel-opts-row">
            <span className="reel-opts-label">Export</span>
            <button className={'reel-chip' + (expQ === '720' ? ' on' : '')} onClick={() => pickQ('720')}>720p</button>
            <button className={'reel-chip' + (expQ === '1080' ? ' on' : '')} onClick={() => pickQ('1080')}>1080p</button>
            <button className={'reel-chip' + (wm ? ' on' : '')} onClick={toggleWm}>✦ Watermark</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Poem card ---------------- */
function PoemCard({ poem, isFav, onFav, onReel, toast, lang }) {
  const poet = poetOf(poem.poet);
  const cat = CATEGORIES.find(c => c.id === poem.category);
  const sec = secondaryOf(poem, lang);
  return (
    <div className="pcard">
      {poem.lang === 'ur' ? (
        <>
          <div className={'urdu' + (!sec ? ' only' : '')}>{poem.urdu.map((l, i) => <div key={i}>{l}</div>)}</div>
          <SecLines sec={sec} />
        </>
      ) : (
        <div className="en-lines">{poem.lines.slice(0, 4).map((l, i) => <div key={i}>{l}</div>)}{poem.lines.length > 4 && <div>…</div>}</div>
      )}
      <footer>
        <span className="who">{poet.name} <span>· {cat ? cat.label : ''}</span></span>
        <span>
          <button className="icon-btn" onClick={() => copyPoem(poem, toast)} title="Copy">📋</button>
          <button className="icon-btn" onClick={() => sharePoem(poem, SCENES[0], toast)} title="Share card">📤</button>
          <button className={`icon-btn ${isFav ? 'on' : ''}`} onClick={() => onFav(poem.id)} title="Favourite">{isFav ? '❤️' : '🤍'}</button>
          <button className="icon-btn" onClick={() => onReel(poem)} title="Play reel">🎬</button>
        </span>
      </footer>
    </div>
  );
}

/* ---------------- App ---------------- */

/* ---------------- Novel helpers ---------------- */
/* Publisher note: kisi episode par "publishAt": "2026-11-04T20:00:00+05:00" lagane se wo
   episode us waqt (Asia/Karachi) se pehle app mein NAHI dikhega. publishAt na ho to episode
   foran live samjha jata hai — episodes 1-5 isi tarah hain. Unpublish = entry hata do. */
function epPublishMs(ep) {
  if (!ep || !ep.publishAt) return 0;
  let str = String(ep.publishAt).trim();
  if (!/[zZ]$|[+-]\d{2}:?\d{2}$/.test(str)) str = str.replace(' ', 'T') + '+05:00';
  const t = Date.parse(str);
  return isNaN(t) ? 0 : t;
}
function fmtPkDate(ms) {
  try {
    const d = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short' }).format(new Date(ms));
    const t = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ms));
    return d + ' at ' + t;
  } catch { return ''; }
}
function lsGet(key, fb) { try { const v = localStorage.getItem(key); return v == null ? fb : v; } catch { return fb; } }
function lsSet(key, val) { try { localStorage.setItem(key, val); } catch { /* noop */ } }
function lsJson(key, fb) { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fb : v; } catch { return fb; } }

/* LocalNotifications sirf native app par kaam karta hai — dynamic import, har call guarded */
let _lnPromise = null;
function loadLN() {
  if (!_lnPromise) _lnPromise = import('@capacitor/local-notifications').then(m => m.LocalNotifications).catch(() => null);
  return _lnPromise;
}
/* Episode alert schedule — Novel tab aur Settings dono yahi istemal karte hain,
   taake ek hi notification (id 8001) aur ek hi pref key (dailypoem_ep_alerts) rahe. */
async function scheduleEpAlert(LN) {
  await LN.schedule({
    notifications: [{
      id: EP_ALERT_ID,
      title: 'DailyPoem — New Episode',
      body: 'A new episode is live — tap to read.',
      schedule: { every: 'day', on: { hour: 20, minute: 0 } },
      extra: { tab: 'novel' },
    }],
  });
}
/* ---------- Notifications: shared pref + toggle system ----------
   Pref format: JSON { on: bool, state: 'on'|'off'|'blocked' } — purani '1'/'0'
   values bhi read ho jati hain (readAlertPref). Toggle ka usool (owner ki
   shikayat par rework): switch FORAN on ho jata hai (optimistic), permission
   aur schedule background mein; permission denied ho to switch ON rehta hai
   magar state 'blocked' save hota hai aur warning line dikhti hai. */
const EP_ALERT_ID = 8001;
const POEM_ALERT_ID = 8002;
const NOTIF_BLOCKED_MSG = 'Notifications are blocked for DailyPoem — allow them in your phone Settings › Apps › DailyPoem › Notifications';
const ALERT_DEFS = {
  ep: { pref: 'dailypoem_ep_alerts', id: EP_ALERT_ID },
  poem: { pref: 'dailypoem_poem_alerts', id: POEM_ALERT_ID },
};
function readAlertPref(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return { on: false, state: 'off' };
    if (raw === '1') return { on: true, state: 'on' };
    if (raw === '0') return { on: false, state: 'off' };
    const v = JSON.parse(raw);
    if (v && typeof v === 'object') return { on: !!v.on, state: v.state || (v.on ? 'on' : 'off') };
  } catch { /* noop */ }
  return { on: false, state: 'off' };
}
function writeAlertPref(key, on, state) {
  try { localStorage.setItem(key, JSON.stringify({ on: !!on, state })); } catch { /* noop */ }
}
async function schedulePoemAlert(LN) {
  await LN.schedule({
    notifications: [{
      id: POEM_ALERT_ID,
      title: 'DailyPoem',
      body: 'Your Poem of the Day is waiting ✦',
      schedule: { every: 'day', on: { hour: 9, minute: 0 } },
      extra: { tab: 'home' },
    }],
  });
}
async function scheduleAlert(LN, kind) {
  if (kind === 'ep') await scheduleEpAlert(LN); else await schedulePoemAlert(LN);
}
/* Ek hi jagah se on/off — panel, Settings aur Novel tab teeno yahi istemal karte hain.
   Return: { on, state } jahan state = 'on' | 'off' | 'blocked' | 'unavailable' */
async function setAlert(kind, on) {
  const def = ALERT_DEFS[kind];
  if (!on) {
    writeAlertPref(def.pref, false, 'off');
    const LN = await loadLN();
    if (LN) { try { await LN.cancel({ notifications: [{ id: def.id }] }); } catch { /* noop */ } }
    return { on: false, state: 'off' };
  }
  writeAlertPref(def.pref, true, 'on'); // optimistic — switch pehle on, baqi baad mein
  const LN = await loadLN();
  if (!LN) return { on: true, state: 'unavailable' };
  try {
    const perm = await LN.requestPermissions();
    if (!perm || perm.display !== 'granted') {
      writeAlertPref(def.pref, true, 'blocked');
      return { on: true, state: 'blocked' };
    }
    await scheduleAlert(LN, kind);
    writeAlertPref(def.pref, true, 'on');
    return { on: true, state: 'on' };
  } catch { return { on: true, state: 'unavailable' }; }
}
/* App start par: jo prefs ON hain (aur blocked nahi) un ki schedule zinda rakho */
async function rescheduleAlerts() {
  const LN = await loadLN();
  if (!LN) return;
  try {
    const pending = await LN.getPending();
    const ids = new Set((((pending && pending.notifications) || [])).map(n => n.id));
    for (const kind of Object.keys(ALERT_DEFS)) {
      const def = ALERT_DEFS[kind];
      const p = readAlertPref(def.pref);
      if (p.on && p.state !== 'blocked' && !ids.has(def.id)) {
        const perm = await LN.checkPermissions();
        if (perm && perm.display === 'granted') await scheduleAlert(LN, kind);
      }
    }
  } catch { /* noop */ }
}
/* Teeno jagah (panel / Settings / Novel) ke liye ek hi toggle hook */
function useAlertToggle(kind, toast, labels) {
  // initializer hi pref parhta hai; teeno jagah (panel/Settings/Novel) mount par
  // render hoti hain, is liye har dafa fresh state milta hai — toggles sync rehte hain.
  const [st, setSt] = useState(() => readAlertPref(ALERT_DEFS[kind].pref));
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (busy) return;
    const target = !st.on;
    setSt({ on: target, state: target ? 'on' : 'off' }); // visual state foran
    setBusy(true);
    try {
      const r = await setAlert(kind, target);
      setSt({ on: r.on, state: r.state });
      if (!target) toast(labels.off);
      else if (r.state === 'on') toast(labels.on);
      else if (r.state === 'blocked') toast(NOTIF_BLOCKED_MSG);
      else toast('Notifications work in the installed app');
    } catch { toast('Notifications work in the installed app'); }
    finally { setBusy(false); }
  };
  return { on: st.on, state: st.state, busy, toggle };
}
/* Toggle wali row — blocked ho to neeche warning line bhi */
function AlertToggleRow({ icon, title, sub, ctl, toast }) {
  return (
    <div className="nd-row" style={{ alignItems: 'flex-start' }}>
      <span style={{ flex: 1 }}>{icon} {title}<span className="set-sub">{sub}</span>
        {ctl.on && ctl.state === 'blocked' && (
          <button className="alert-warn" onClick={() => toast(NOTIF_BLOCKED_MSG)}>⚠ Blocked by phone settings — tap to learn how</button>
        )}
      </span>
      <button className={'chip' + (ctl.on ? ' on' : '')} disabled={ctl.busy} onClick={ctl.toggle}>{ctl.on ? 'On' : 'Off'}</button>
    </div>
  );
}

/* Shayar ki lifespan — sirf woh 8 classical shayar jinki tareekhen verified hain.
   NOTE: data file (poems.js POETS) mein Hasrat Mohani 1875–1951 hai; yahi rakha hai
   taake app ke andar har jagah ek hi tareekh dikhe. English nazm par 'Original Poetry'. */
const POET_META = {
  ghalib: '1797–1869',
  mir: '1723–1810',
  iqbal: '1877–1938',
  dagh: '1831–1905',
  momin: '1800–1851',
  zafar: '1775–1862',
  hasrat: '1875–1951',
  akbar: '1846–1921',
};
function poetYears(poem) {
  if (!poem || poem.lang === 'en') return 'Original Poetry';
  return POET_META[poem.poet] || poetOf(poem.poet).years || '';
}

/* Mood ke hisaab se scene — openReel aur Home ke reel cards dono ke liye ek jagah */
const MOOD_SCENE = { mohabbat: 'gulab', udaasi: 'baarish', umeed: 'chaand', sufi: 'mehfil' };
function sceneForPoem(poem) {
  return SCENES.find(s => s.id === (poem && MOOD_SCENE[poem.category])) || SCENES[new Date().getDate() % SCENES.length];
}

/* Novel Continue Reading ka hisaab — NovelScreen aur Home dono ke liye:
   sab se taaza adhoori position (pct 1% se zyada, 98% se kam) dailypoem_novel_pos se. */
function novelLastPos(publishedEps, posMap) {
  let lastPos = null;
  for (const ep of publishedEps) {
    const p = posMap[ep.n];
    if (p && p.pct > 0.01 && p.pct < 0.98 && (!lastPos || (p.ts || 0) > (lastPos.ts || 0))) lastPos = { ep, pct: p.pct, ts: p.ts || 0 };
  }
  return lastPos;
}

/* Library card ki progress — kisi novel ki reading halat usi ki apni keys se:
   mukammal parhe episodes + sab se zyada adhoori position ka hissa */
function novelProgressOf(nv, published) {
  const readRaw = lsJson(novelReadKey(nv.id), []);
  const readArr = Array.isArray(readRaw) ? readRaw : [];
  const posRaw = lsJson(novelPosKey(nv.id), {});
  const posMap = posRaw && typeof posRaw === 'object' && !Array.isArray(posRaw) ? posRaw : {};
  let done = 0, partial = 0;
  for (const ep of published) {
    const p = posMap[ep.n];
    const pct = p ? p.pct || 0 : 0;
    if (readArr.includes(ep.n) || pct >= 0.85) done++;
    else if (pct > partial) partial = pct;
  }
  const lastPos = novelLastPos(published, posMap);
  return {
    frac: published.length ? (done + partial) / published.length : 0,
    has: done > 0 || partial > 0.01 || !!lastPos,
    lastPos,
  };
}

function NovelScreen({ toast, novels, openRequest, onConsumeOpenRequest }) {
  const notify = toast || (() => {});
  const [activeId, setActiveId] = useState(null);
  const [pendingOpen, setPendingOpen] = useState(null); // { novelId, n } — detail khulte hi episode kholna hai
  const epAlerts = useAlertToggle('ep', notify, { on: 'Episode alerts on — daily at 8:00 PM', off: 'Episode alerts turned off' });

  /* Bahar se (Home Continue Reading / search / Featured) kisi novel ya us ki episode ko
     seedha kholne ki request — active novel set karo, episode pending rakho, parent ki
     request consume kar do taake Novels tab dobara khulne par purani request na chale */
  useEffect(() => {
    if (!openRequest) return;
    const novelId = openRequest.novelId || LEGACY_NOVEL_ID;
    setActiveId(novelId);
    if (openRequest.n) setPendingOpen({ novelId, n: openRequest.n });
    if (onConsumeOpenRequest) onConsumeOpenRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest]);

  const active = novels.find(nv => nv.id === activeId) || null;

  if (active) {
    return (
      <NovelDetail
        key={active.id}
        toast={toast}
        novel={active}
        onBack={() => { setPendingOpen(null); setActiveId(null); }}
        openN={pendingOpen && pendingOpen.novelId === active.id ? pendingOpen.n : null}
        onConsumeOpen={() => setPendingOpen(null)}
      />
    );
  }

  return (
    <div>
      <div className="section-title" style={{ marginTop: 18 }}><h2>Novels</h2><small>{novels.length} stories</small></div>
      {novels.map(nv => {
        const published = publishedOf(nv);
        const prog = novelProgressOf(nv, published);
        return (
          <div key={nv.id} className="ncover ncover-tap lib-card" onClick={() => setActiveId(nv.id)}>
            {nv.id === 'qaidi-e-baras' && <span className="feat-badge">✦ New</span>}
            <div className="ncover-urdu" dir="rtl">{nv.urduTitle}</div>
            <div className="ncover-title">{nv.title}</div>
            <span className="tag">{nv.genre || 'Drama'}</span>
            <p className="ncover-syn clamp2">{nv.synopsis}</p>
            <div className="ncover-meta">{published.length} episodes · {nv.status || 'Ongoing'} · Tap to read ›</div>
            {prog.has && (
              <div className="lib-prog">
                <div className="cont-bar"><span style={{ width: Math.round(prog.frac * 100) + '%' }} /></div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{Math.round(prog.frac * 100)}% read{prog.lastPos ? ' — Continue Episode ' + prog.lastPos.ep.n : ''}</div>
              </div>
            )}
          </div>
        );
      })}

      <div className="alert-row">
        <div style={{ flex: 1 }}>
          <b style={{ fontSize: 14 }}>🔔 Episode alerts</b>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>A gentle daily reminder at 8:00 PM, when the new episode lands.</div>
          {epAlerts.on && epAlerts.state === 'blocked' && (
            <button className="alert-warn" onClick={() => notify(NOTIF_BLOCKED_MSG)}>⚠ Blocked by phone settings — tap to learn how</button>
          )}
        </div>
        <button className={'chip' + (epAlerts.on ? ' on' : '')} disabled={epAlerts.busy} onClick={epAlerts.toggle}>{epAlerts.on ? 'On' : 'Off'}</button>
      </div>

      <p className="muted" style={{ fontSize: 12.5, textAlign: 'center', marginTop: 14 }}>Episodes appear here automatically when published — no app update needed.<br />⬇ On device means the episode is saved inside the app and also opens offline.</p>
    </div>
  );
}

/* Ek novel ki tafseel + reader. Progress / bookmarks / favourite isi novel ki apni
   storage keys par rehte hain (aakhri-sajda = purani legacy keys, baqi = ':' + id suffix),
   aur component ko novel id se key kar ke mount kiya jata hai taake har novel ki
   reading state saaf taur par alag load ho. */
function NovelDetail({ toast, novel: nv, onBack, openN, onConsumeOpen }) {
  const notify = toast || (() => {});
  const [reading, setReading] = useState(null);
  const [readSet, setReadSet] = useState(() => { const v = lsJson(novelReadKey(nv.id), []); return Array.isArray(v) ? v : []; });
  const [posMap, setPosMap] = useState(() => { const v = lsJson(novelPosKey(nv.id), {}); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; });
  const [bookmarks, setBookmarks] = useState(() => { const v = lsJson(novelBmKey(nv.id), []); return Array.isArray(v) ? v : []; });
  const [novelFav, setNovelFav] = useState(() => lsGet(novelFavKey(nv.id), '') === '1');
  const [fs, setFs] = useState(() => { const v = parseInt(lsGet('dailypoem_novel_fs', '19'), 10); return isNaN(v) ? 19 : v; });
  const [ls, setLs] = useState(() => { const v = parseInt(lsGet('dailypoem_novel_ls', '2'), 10); return [1, 2, 3].includes(v) ? v : 2; });
  const [rTheme, setRTheme] = useState(() => lsGet('dailypoem_reader_theme', 'dark'));
  const [prog, setProg] = useState(0);
  const readerRef = useRef(null);
  const saveTimer = useRef(null);

  const allEps = [...nv.episodes].sort((a, b) => a.n - b.n);
  const nowMs = Date.now();
  const published = allEps.filter(e => epPublishMs(e) <= nowMs);
  const nextScheduled = allEps.find(e => epPublishMs(e) > nowMs) || null;
  const genre = nv.genre || 'Roohani Drama';
  const status = nv.status || 'Ongoing';
  const planned = nv.plannedEpisodes || published.length;

  /* Sab se taaza reading position — Continue Reading isi se banta hai (shared helper) */
  const lastPos = novelLastPos(published, posMap);

  const markRead = n => setReadSet(prev => {
    if (prev.includes(n)) return prev;
    const nr = [...prev, n];
    lsSet(novelReadKey(nv.id), JSON.stringify(nr));
    return nr;
  });

  const openEp = ep => {
    const p = posMap[ep.n];
    setProg(p ? p.pct || 0 : 0);
    setReading(ep);
  };

  /* Library / Home se seedha kisi episode ko kholne ki pending request */
  useEffect(() => {
    if (!openN) return;
    const ep = published.find(e => e.n === openN);
    if (ep) openEp(ep);
    if (onConsumeOpen) onConsumeOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openN]);

  const changeFs = d => {
    const v = Math.min(24, Math.max(16, fs + d));
    setFs(v); lsSet('dailypoem_novel_fs', String(v));
  };
  const cycleLs = () => setLs(v => { const n = v === 3 ? 1 : v + 1; lsSet('dailypoem_novel_ls', String(n)); return n; });
  const cycleTheme = () => setRTheme(t => {
    const n = t === 'dark' ? 'light' : t === 'light' ? 'sepia' : 'dark';
    lsSet('dailypoem_reader_theme', n);
    return n;
  });
  const toggleBookmark = n => setBookmarks(prev => {
    const nb = prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n];
    lsSet(novelBmKey(nv.id), JSON.stringify(nb));
    return nb;
  });
  const toggleNovelFav = () => setNovelFav(f => { lsSet(novelFavKey(nv.id), f ? '0' : '1'); return !f; });

  /* Reader khule to saved position par wapas — aur scroll par progress + position save (throttled) */
  useEffect(() => {
    if (!reading) return undefined;
    const el = readerRef.current;
    if (!el) return undefined;
    const saved = posMap[reading.n];
    const pct = saved ? saved.pct || 0 : 0;
    const apply = () => {
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTop = max > 0 && pct > 0 ? pct * max : 0;
    };
    const t1 = setTimeout(apply, 60);
    const t2 = setTimeout(apply, 420); // fonts late load hon to dobara align
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading]);

  const onReaderScroll = () => {
    const el = readerRef.current;
    if (!el || !reading) return;
    const max = el.scrollHeight - el.clientHeight;
    const pct = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
    const rp = Math.round(pct * 100) / 100;
    setProg(p => (Math.abs(p - rp) >= 0.01 ? rp : p));
    if (pct >= 0.85) markRead(reading.n);
    if (saveTimer.current) return;
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      setPosMap(prev => {
        const nm = { ...prev, [reading.n]: { pct, ts: Date.now() } };
        lsSet(novelPosKey(nv.id), JSON.stringify(nm));
        return nm;
      });
    }, 700);
  };

  const shareEpisode = async ep => {
    const text = ep.title + ' — ' + nv.title + ' (DailyPoem)\n\n' + ep.body.filter(p => p !== '✦').slice(0, 2).join('\n\n');
    try {
      if (Capacitor.isNativePlatform()) { await Share.share({ title: nv.title, text }); return; }
      if (navigator.share) { await navigator.share({ title: nv.title, text }); return; }
      throw new Error('noshare');
    } catch (e) {
      if (e && /cancel/i.test(e.message || '')) return;
      try { await navigator.clipboard.writeText(text); notify('📋 Episode text copied'); }
      catch { notify('Sharing is not available on this device'); }
    }
  };

  /* ---- Episode alerts: roz 8:00 PM local notification (device time) ----
     Toggle shared useAlertToggle se hota hai (panel/Settings/Library bhi wahi) —
     switch foran on hota hai, permission/schedule background mein, aur app
     start par App-level rescheduleAlerts() schedule zinda rakhta hai. */

  const epRow = ep => {
    const p = posMap[ep.n];
    const pct = p ? p.pct || 0 : 0;
    const isRead = readSet.includes(ep.n) || pct >= 0.85;
    const inProg = !isRead && pct > 0.01;
    return (
      <div key={ep.n} className="ep-row" onClick={() => openEp(ep)}>
        <div className="ep-num">{ep.n}</div>
        <div style={{ flex: 1 }}>
          <div className="ep-urdu" dir="rtl">{ep.urduTitle}</div>
          <div className="ep-sub">{ep.title} • {ep.mins} min read{isRead ? ' • ✓ Read' : inProg ? ' • ● ' + Math.round(pct * 100) + '% read' : ''} • ⬇ On device</div>
        </div>
        {bookmarks.includes(ep.n) && <span title="Bookmarked" style={{ fontSize: 15 }}>🔖</span>}
        <span style={{ color: 'var(--gold)', fontSize: 20 }}>›</span>
      </div>
    );
  };

  if (reading) {
    const idx = published.findIndex(e => e.n === reading.n);
    const prev = idx > 0 ? published[idx - 1] : null;
    const next = idx >= 0 && idx < published.length - 1 ? published[idx + 1] : null;
    const lineH = [2.05, 2.35, 2.65][ls - 1] || 2.35;
    const bm = bookmarks.includes(reading.n);
    return (
      <div className={'reader th-' + rTheme} ref={readerRef} onScroll={onReaderScroll}>
        <div className="reader-top">
          <button className="rbtn" onClick={() => setReading(null)} aria-label="Back to episodes">←</button>
          <span className="reader-title">Episode {reading.n} · {Math.round(prog * 100)}%</span>
          <span className="reader-tools">
            <button className="rbtn" onClick={() => changeFs(-1)}>A−</button>
            <button className="rbtn" onClick={() => changeFs(1)}>A+</button>
            <button className="rbtn" onClick={cycleLs} title="Line spacing">↕</button>
            <button className="rbtn" onClick={cycleTheme} title="Reading theme">{rTheme === 'dark' ? '🌙' : rTheme === 'light' ? '☀️' : '📜'}</button>
            <button className={'rbtn' + (bm ? ' on' : '')} onClick={() => toggleBookmark(reading.n)} title="Bookmark">🔖</button>
            <button className="rbtn" onClick={() => shareEpisode(reading)} title="Share episode">📤</button>
          </span>
        </div>
        <div className="reader-body">
          <div className="reader-ep-title" dir="rtl">{reading.urduTitle}</div>
          <div className="reader-ep-sub">{reading.title} • {reading.mins} min read</div>
          {reading.body.map((p, i) => p === '✦'
            ? <div key={i} className="novel-brk">✦ ✦ ✦</div>
            : <p key={i} className="novel-p" dir="rtl" style={{ fontSize: fs, lineHeight: lineH }}>{p}</p>)}
          <div className="reader-end">
            <div style={{ fontSize: 28 }}>📖</div>
            <b>End of Episode {reading.n}</b>
            {next
              ? <button className="btn btn-gold" onClick={() => { markRead(reading.n); openEp(next); }}>Next Episode →</button>
              : nextScheduled && nextScheduled.n === reading.n + 1
                ? <span className="muted" style={{ fontSize: 13 }}>Episode {nextScheduled.n} arrives {fmtPkDate(epPublishMs(nextScheduled))}.</span>
                : <span className="muted" style={{ fontSize: 13 }}>The next episode arrives tomorrow at 8:00 PM.</span>}
            {prev && <button className="btn" onClick={() => openEp(prev)}>← Previous Episode</button>}
            <button className="btn" onClick={() => setReading(null)}>← Back to episodes</button>
          </div>
        </div>
      </div>
    );
  }

  const firstUnread = published.find(e => !readSet.includes(e.n) && !(posMap[e.n] && posMap[e.n].pct >= 0.85)) || published[0];
  const latest = published[published.length - 1];
  const latestDate = latest ? (latest.publishAt ? fmtPkDate(epPublishMs(latest)) : (latest.date || '')) : '';
  return (
    <div>
      <div style={{ marginTop: 14 }}>
        <button className="btn" onClick={onBack}>← Novels</button>
      </div>
      <div className="ncover" style={{ marginTop: 12 }}>
        <div className="ncover-urdu" dir="rtl">{nv.urduTitle}</div>
        <div className="ncover-title">{nv.title}</div>
        <span className="tag">MintNest Studio Originals</span>
        <p className="ncover-syn">{nv.synopsis}</p>
        <button className={'btn' + (novelFav ? ' active-fav' : '')} onClick={toggleNovelFav}>{novelFav ? '❤️ Favourite' : '🤍 Add to Favourites'}</button>
      </div>
      <div className="nd-meta">
        <div className="nd-row"><span>Author</span><b>{nv.author}</b></div>
        <div className="nd-row"><span>Genre</span><b>{genre}</b></div>
        <div className="nd-row"><span>Status</span><b>{status}</b></div>
        <div className="nd-row"><span>Episodes</span><b>{published.length} of {planned} published</b></div>
        {latest && <div className="nd-row"><span>Latest</span><b>Episode {latest.n} — {latest.title}{latestDate ? ' · ' + latestDate : ''}</b></div>}
      </div>
      <div style={{ display: 'flex', gap: 9, marginTop: 14, flexWrap: 'wrap' }}>
        {firstUnread && <button className="btn btn-gold" style={{ flex: '0 1 auto' }} onClick={() => openEp(firstUnread)}>▶ Start Reading</button>}
        {lastPos && <button className="btn" onClick={() => openEp(lastPos.ep)}>Continue · Episode {lastPos.ep.n} ({Math.round(lastPos.pct * 100)}%)</button>}
      </div>
      {nextScheduled && (
        <div className="sched-card">🕗 <b>Episode {nextScheduled.n}</b>&nbsp;arrives {fmtPkDate(epPublishMs(nextScheduled))} — right here in the app, no update needed.</div>
      )}
      <div className="section-title"><h2>Episodes</h2><small>{published.length} live</small></div>
      {published.map(epRow)}
    </div>
  );
}


/* Category cards ke liye scene thumbnails (sirf 4 scenes hain — tint se farq) */
const CAT_ART = {
  mohabbat: { img: 'scenes/gulab.jpg', tint: 'rgba(74,14,30,.52)' },
  udaasi: { img: 'scenes/baarish.jpg', tint: 'rgba(10,26,52,.52)' },
  zindagi: { img: 'scenes/chaand.jpg', tint: 'rgba(13,44,30,.50)' },
  umeed: { img: 'scenes/chaand.jpg', tint: 'rgba(92,56,6,.50)' },
  sufi: { img: 'scenes/mehfil.jpg', tint: 'rgba(48,30,10,.55)' },
  attitude: { img: null, tint: null },
};

/* ---------------- Photo Shayari Editor ---------------- */
const PHOTO_COLORS = [
  { id: 'maroon', name: 'Maroon', from: '#3d0f16', to: '#170608', css: 'linear-gradient(160deg,#3d0f16,#170608)' },
  { id: 'emerald', name: 'Emerald', from: '#0d2b21', to: '#04120d', css: 'linear-gradient(160deg,#0d2b21,#04120d)' },
  { id: 'royal', name: 'Royal', from: '#12294d', to: '#050d1d', css: 'linear-gradient(160deg,#12294d,#050d1d)' },
  { id: 'charcoal', name: 'Charcoal', from: '#262626', to: '#090909', css: 'linear-gradient(160deg,#262626,#090909)' },
  { id: 'sunset', name: 'Sunset', from: '#5c2a10', to: '#1d0d04', css: 'linear-gradient(160deg,#5c2a10,#1d0d04)' },
  { id: 'plum', name: 'Plum', from: '#351840', to: '#12061a', css: 'linear-gradient(160deg,#351840,#12061a)' },
  { id: 'paper', name: 'Paper', from: '#f7f0de', to: '#e7d9b8', css: 'linear-gradient(160deg,#f7f0de,#e7d9b8)', light: true },
];
const TEXT_COLORS = [
  { id: 'cream', hex: '#f3ead8', name: 'Cream' },
  { id: 'gold', hex: '#f0c95c', name: 'Gold' },
  { id: 'white', hex: '#ffffff', name: 'White' },
  { id: 'ink', hex: '#2a1f10', name: 'Ink' },
];

/* ================= Photo Studio Editor (v0.9) =================
   Ek hi design state -> preview aur export dono. Layout ka hisaab shared
   functions (edPoemLayout / edTextLayout) se hota hai taake jo screen par
   dikhe, bilkul wahi export ho. */

const ED_FONTS = [
  { id: 'nastaliq', name: 'Urdu Nastaliq', stack: '"Noto Nastaliq Urdu", serif', urdu: true, step: 2.15, defSize: 64 },
  { id: 'amiri', name: 'Urdu Naskh', stack: '"Amiri", serif', urdu: true, step: 1.95, defSize: 62 },
  { id: 'playfair', name: 'Playfair', stack: '"Playfair Display", serif', step: 1.45, defSize: 56, weight: '600 ' },
  { id: 'cormorant', name: 'Cormorant', stack: '"Cormorant Garamond", serif', step: 1.42, defSize: 60, weight: '600 ' },
  { id: 'inter', name: 'Modern', stack: 'Inter, sans-serif', step: 1.45, defSize: 48, weight: '600 ' },
  { id: 'hand', name: 'Handwritten', stack: '"Segoe Script", "Bradley Hand", cursive', step: 1.6, defSize: 54 },
];
const edFont = (id) => ED_FONTS.find(f => f.id === id) || ED_FONTS[0];

const ED_GRADIENTS = [
  { id: 'rain', name: 'Rain', from: '#182a44', to: '#060b16', css: 'linear-gradient(165deg,#182a44,#060b16)' },
  { id: 'moon', name: 'Moon', from: '#232a4d', to: '#070814', css: 'linear-gradient(165deg,#232a4d,#070814)' },
  { id: 'sunset', name: 'Sunset', from: '#71360f', to: '#1e0b02', css: 'linear-gradient(165deg,#71360f,#1e0b02)' },
  { id: 'ocean', name: 'Ocean', from: '#0c3a4a', to: '#031319', css: 'linear-gradient(165deg,#0c3a4a,#031319)' },
  { id: 'night', name: 'Night', from: '#1b1b28', to: '#050508', css: 'linear-gradient(165deg,#1b1b28,#050508)' },
  { id: 'love', name: 'Love', from: '#5c1a2e', to: '#1a050c', css: 'linear-gradient(165deg,#5c1a2e,#1a050c)' },
  { id: 'sadness', name: 'Sadness', from: '#2e3644', to: '#0a0d12', css: 'linear-gradient(165deg,#2e3644,#0a0d12)' },
  { id: 'minimal', name: 'Minimal', from: '#f2ead6', to: '#ddcdaa', css: 'linear-gradient(165deg,#f2ead6,#ddcdaa)', light: true },
  { id: 'islamic', name: 'Islamic', from: '#0e4030', to: '#03130c', css: 'linear-gradient(165deg,#0e4030,#03130c)' },
  { id: 'mehfil', name: 'Mehfil Gold', from: '#3d2c10', to: '#110a02', css: 'linear-gradient(165deg,#3d2c10,#110a02)' },
];
const ED_COLORS = [
  ...PHOTO_COLORS,
  { id: 'ivory', name: 'Ivory', from: '#fbf7ec', to: '#eee2c4', css: 'linear-gradient(160deg,#fbf7ec,#eee2c4)', light: true },
  { id: 'forest', name: 'Forest', from: '#14301c', to: '#050f08', css: 'linear-gradient(160deg,#14301c,#050f08)' },
];
const edColorOf = (d) => (d.bg.type === 'gradient'
  ? (ED_GRADIENTS.find(g => g.id === d.bg.gradientId) || ED_GRADIENTS[9])
  : (ED_COLORS.find(c => c.id === d.bg.colorId) || ED_COLORS[0]));

const ED_RATIOS = [
  { id: '1:1', label: 'Square · 1:1', w: 1080, h: 1080 },
  { id: '4:5', label: 'Portrait · 4:5', w: 1080, h: 1350 },
  { id: '9:16', label: 'Story · 9:16', w: 1080, h: 1920 },
  { id: 'custom', label: 'Custom', w: 0, h: 0 },
];
const edClamp = (v, a, b) => Math.max(a, Math.min(b, v));
function edDims(d) {
  if (d.ratio === 'custom') return { w: edClamp(Math.round(d.customW || 1080), 600, 2160), h: edClamp(Math.round(d.customH || 1350), 600, 2160) };
  return ED_RATIOS.find(r => r.id === d.ratio) || ED_RATIOS[1];
}

const ED_HAS_URDU = /[\u0600-\u06FF]/;
let _edLid = 0;
const edNewId = () => 'L' + (++_edLid) + Date.now().toString(36);

function edPoemLayer() {
  return { id: edNewId(), kind: 'poem', name: 'Poem', text: '', x: 0.5, y: 0.46, w: 0.88, size: 1, color: '#f3ead8', font: 'auto', align: 'center', opacity: 1, lineHeight: 1, letterSpacing: 0, bold: false, italic: false, shadow: true, shadowStr: 0.55, outline: false, outlineW: 2, chip: 'none', hidden: false, locked: false };
}
function edTextLayer(kind, text) {
  return { id: edNewId(), kind, name: kind === 'name' ? 'Your name' : 'Text', text, x: 0.5, y: kind === 'name' ? 0.88 : 0.7, w: 0.8, size: kind === 'name' ? 34 : 44, color: '#f0c95c', font: 'playfair', align: 'center', opacity: 1, lineHeight: 1, letterSpacing: 0, bold: false, italic: false, shadow: true, shadowStr: 0.5, outline: false, outlineW: 2, chip: 'none', hidden: false, locked: false };
}
function edDefaultDesign() {
  return {
    ratio: '4:5', customW: 1080, customH: 1350,
    bg: { type: 'color', colorId: 'maroon', sceneId: 'baarish', gradientId: 'mehfil', photoData: null, offX: 0.5, offY: 0.5, blur: 0, bright: 100, contrast: 100, sat: 100, opacity: 1, darkness: 55 },
    poemId: '', useCustom: false, customText: '',
    layers: [edPoemLayer()],
    frame: 'thin', ornament: true, watermark: true,
  };
}

/* Template = design par patch; sab kuch badalne ke baad bhi editable rehta hai */
function edTplPatch(bgPatch, poemPatch, extra) {
  return (d) => {
    Object.assign(d.bg, bgPatch);
    const pl = d.layers.find(l => l.kind === 'poem');
    if (pl) Object.assign(pl, poemPatch);
    if (extra) Object.assign(d, extra);
  };
}
const ED_TEMPLATES = [
  { id: 'romantic', name: 'Romantic', css: 'linear-gradient(160deg,#5c1a2e,#2a0d18)', apply: edTplPatch({ type: 'scene', sceneId: 'gulab', darkness: 58 }, { color: '#f3ead8', font: 'auto', y: 0.46, size: 1, chip: 'none' }, { frame: 'thin', ornament: true }) },
  { id: 'sad', name: 'Sad', css: 'linear-gradient(160deg,#2e3644,#0a0d12)', apply: edTplPatch({ type: 'gradient', gradientId: 'sadness', darkness: 40 }, { color: '#e8ecf4', font: 'auto', y: 0.44, chip: 'none' }, { frame: 'none', ornament: false }) },
  { id: 'love', name: 'Love', css: 'linear-gradient(160deg,#5c1a2e,#1a050c)', apply: edTplPatch({ type: 'gradient', gradientId: 'love', darkness: 42 }, { color: '#ffd9a0', font: 'auto', y: 0.46 }, { frame: 'double', ornament: true }) },
  { id: 'broken', name: 'Broken Heart', css: 'linear-gradient(160deg,#182a44,#060b16)', apply: edTplPatch({ type: 'scene', sceneId: 'baarish', darkness: 72 }, { color: '#ffffff', font: 'auto', y: 0.42 }, { frame: 'none', ornament: false }) },
  { id: 'attitude', name: 'Attitude', css: 'linear-gradient(160deg,#262626,#090909)', apply: edTplPatch({ type: 'color', colorId: 'charcoal', darkness: 30 }, { color: '#f0c95c', font: 'auto', y: 0.48, size: 1.08, chip: 'dark' }, { frame: 'thin', ornament: false }) },
  { id: 'life', name: 'Life', css: 'linear-gradient(160deg,#232a4d,#070814)', apply: edTplPatch({ type: 'gradient', gradientId: 'moon', darkness: 44 }, { color: '#f3ead8', font: 'auto', y: 0.46 }, { frame: 'thin', ornament: true }) },
  { id: 'motivation', name: 'Motivation', css: 'linear-gradient(160deg,#71360f,#1e0b02)', apply: edTplPatch({ type: 'gradient', gradientId: 'sunset', darkness: 46 }, { color: '#ffffff', font: 'auto', y: 0.46, size: 1.14 }, { frame: 'none', ornament: true }) },
  { id: 'sufi', name: 'Sufi', css: 'linear-gradient(160deg,#3d2c10,#110a02)', apply: edTplPatch({ type: 'scene', sceneId: 'mehfil', darkness: 55 }, { color: '#f0c95c', font: 'nastaliq', y: 0.46 }, { frame: 'double', ornament: true }) },
  { id: 'islamic', name: 'Islamic', css: 'linear-gradient(160deg,#0e4030,#03130c)', apply: edTplPatch({ type: 'gradient', gradientId: 'islamic', darkness: 40 }, { color: '#f3ead8', font: 'auto', y: 0.46 }, { frame: 'double', ornament: true }) },
  { id: 'english', name: 'English Poetry', css: 'linear-gradient(160deg,#f2ead6,#ddcdaa)', apply: edTplPatch({ type: 'gradient', gradientId: 'minimal', darkness: 6 }, { color: '#2a1f10', font: 'playfair', y: 0.46, shadow: false }, { frame: 'thin', ornament: true }) },
];

function edPoemOf(design, poems) {
  if (design.useCustom) {
    const txt = design.customText || '';
    const lines = txt.split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) return null;
    const isUr = ED_HAS_URDU.test(txt);
    return { id: 'custom', lang: isUr ? 'ur' : 'en', urdu: isUr ? lines : undefined, lines: isUr ? undefined : lines, roman: [], poet: null, customPoet: '', title: '', _custom: true };
  }
  return poems.find(p => p.id === design.poemId) || poems[0] || null;
}
function edLayerFont(layer, poem) {
  if (layer.font && layer.font !== 'auto') return edFont(layer.font);
  return poem && poem.lang === 'ur' ? edFont('nastaliq') : edFont('playfair');
}
function edContrast(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#1c1503';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.55 ? '#1c1503' : '#f3ead8';
}

/* ---------- shared layout (preview + export) ---------- */
function edPoemLayout(design, poem, layer, W, H) {
  const f = edLayerFont(layer, poem);
  const maxW = Math.max(200, Math.round(layer.w * W) - 40);
  const L = fitPoemText({
    poem, maxW, availH: Math.round(H * 0.94), scale: layer.size,
    fontStack: f.stack, baseFs: f.defSize, stepF: f.step * (layer.lineHeight || 1),
    weight: layer.bold ? '700 ' : (f.weight || ''), italic: layer.italic && !f.urdu,
    letterSpacing: f.urdu ? 0 : (layer.letterSpacing || 0),
  });
  const pad = layer.chip !== 'none' ? 16 : 0;
  const ornH = design.ornament ? 46 : 0;
  const poetH = poem._custom ? 0 : Math.round(L.fs * 1.0) + 16;
  const totalH = pad * 2 + ornH + L.blockH + poetH;
  const boxW = Math.round(layer.w * W);
  let top = Math.round(layer.y * H - totalH / 2);
  top = edClamp(top, 8, Math.max(8, H - 8 - totalH));
  const left = edClamp(Math.round(layer.x * W - boxW / 2), 0, Math.max(0, W - boxW));
  return { L, f, pad, ornH, poetH, totalH, boxW, top, left, textTop: top + pad + ornH, textLeft: left + pad, textW: boxW - pad * 2 };
}
function edTextLayout(layer, W, H) {
  const f = edFont(layer.font === 'auto' ? 'playfair' : layer.font);
  const isUrduText = ED_HAS_URDU.test(layer.text || '');
  const fs = layer.size;
  const ctx = measureCtx();
  ctx.font = (layer.bold ? '700 ' : (f.weight || '')) + (layer.italic && !f.urdu ? 'italic ' : '') + fs + 'px ' + f.stack;
  const fontStr = ctx.font;
  const useLS = !f.urdu && !isUrduText && layer.letterSpacing;
  if (useLS) { try { ctx.letterSpacing = layer.letterSpacing + 'px'; } catch { /* noop */ } }
  const boxW = Math.round(layer.w * W);
  const wrapped = wrapTextLines(ctx, (layer.text || '').split('\n'), Math.max(80, boxW - 32));
  if (useLS) { try { ctx.letterSpacing = '0px'; } catch { /* noop */ } }
  const step = fs * f.step * (layer.lineHeight || 1);
  const blockH = Math.max(step, wrapped.lines.length * step);
  const pad = layer.chip !== 'none' ? 14 : 0;
  const totalH = blockH + pad * 2;
  let top = Math.round(layer.y * H - totalH / 2);
  top = edClamp(top, 6, Math.max(6, H - 6 - totalH));
  const left = edClamp(Math.round(layer.x * W - boxW / 2), 0, Math.max(0, W - boxW));
  return { lines: wrapped.lines, fs, step, blockH, totalH, pad, top, left, boxW, textTop: top + pad, textLeft: left + pad, font: fontStr, f, isUrduText };
}

/* ---------- canvas rendering ---------- */
function edLoadImg(src) {
  return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
}
function edCoverRect(img, W, H, offX, offY, bleed) {
  const W2 = W + bleed * 2, H2 = H + bleed * 2;
  const s = Math.max(W2 / img.naturalWidth, H2 / img.naturalHeight);
  const w = img.naturalWidth * s, h = img.naturalHeight * s;
  return { x: -bleed + (W2 - w) * offX, y: -bleed + (H2 - h) * offY, w, h };
}
function edRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function edChipDraw(ctx, left, top, boxW, totalH, chip) {
  if (chip === 'dark') { ctx.fillStyle = 'rgba(8,6,5,.48)'; edRoundRect(ctx, left, top, boxW, totalH, 18); ctx.fill(); }
  else if (chip === 'gold') { const g = ctx.createLinearGradient(left, top, left + boxW, top + totalH); g.addColorStop(0, 'rgba(212,175,55,.92)'); g.addColorStop(1, 'rgba(160,120,30,.92)'); ctx.fillStyle = g; edRoundRect(ctx, left, top, boxW, totalH, 18); ctx.fill(); }
}
function edTextStyle(ctx, layer, fs) {
  if (layer.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,' + (layer.shadowStr || 0.5).toFixed(2) + ')';
    ctx.shadowBlur = Math.max(4, fs * 0.32);
    ctx.shadowOffsetY = Math.max(1, fs * 0.05);
  }
}
function edClearShadow(ctx) { ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
function edFillLine(ctx, ln, x, y, layer) {
  if (layer.outline) {
    ctx.save();
    ctx.lineWidth = Math.max(1, (layer.outlineW || 2)) * 1.6;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = edContrast(layer.color);
    ctx.strokeText(ln, x, y);
    ctx.restore();
  }
  ctx.fillText(ln, x, y);
}
function edAlignX(align, left, w) { return align === 'left' ? left : align === 'right' ? left + w : left + w / 2; }

async function edDrawBg(ctx, design, W, H) {
  const bg = design.bg;
  let img = null;
  if (bg.type === 'photo' && bg.photoData) img = await edLoadImg(bg.photoData);
  else if (bg.type === 'scene') { const sc = SCENES.find(x => x.id === bg.sceneId) || SCENES[0]; img = await edLoadImg(sc.img); }
  if (img && img.naturalWidth) {
    const bleed = bg.blur ? Math.ceil(bg.blur * 2.2) : 0;
    const r = edCoverRect(img, W, H, bg.offX, bg.offY, bleed);
    ctx.save();
    const filt = 'blur(' + (bg.blur || 0) + 'px) brightness(' + (bg.bright || 100) + '%) contrast(' + (bg.contrast || 100) + '%) saturate(' + (bg.sat || 100) + '%)';
    try { ctx.filter = filt; } catch { /* purani WebView */ }
    ctx.globalAlpha = bg.opacity == null ? 1 : bg.opacity;
    ctx.drawImage(img, r.x, r.y, r.w, r.h);
    ctx.restore();
    if ((bg.opacity == null ? 1 : bg.opacity) < 1) {
      const e = edColorOf({ bg: { type: 'color', colorId: 'charcoal' } });
      ctx.fillStyle = e.to; ctx.globalAlpha = 1 - (bg.opacity == null ? 1 : bg.opacity); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    }
  } else {
    const e = edColorOf(design);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, e.from); g.addColorStop(1, e.to);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const dark = (bg.darkness || 0) / 100;
  if (dark > 0) { ctx.fillStyle = 'rgba(0,0,0,' + (dark * 0.75).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
  const vg = ctx.createLinearGradient(0, H * 0.45, 0, H);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.30)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}
function edDrawFrame(ctx, design, W, H, lightBg) {
  if (design.frame === 'none') return;
  const col = lightBg ? 'rgba(138,106,24,.55)' : 'rgba(212,175,55,.5)';
  ctx.strokeStyle = col; ctx.lineWidth = 3;
  ctx.strokeRect(30, 30, W - 60, H - 60);
  if (design.frame === 'double') { ctx.lineWidth = 1.6; ctx.strokeRect(44, 44, W - 88, H - 88); }
}
function edDrawPoemLayer(ctx, design, poem, layer, W, H, goldInk) {
  const lay = edPoemLayout(design, poem, layer, W, H);
  const { L } = lay;
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  edChipDraw(ctx, lay.left, lay.top, lay.boxW, lay.totalH, layer.chip);
  let y = lay.top + lay.pad;
  if (design.ornament) {
    const cy = y + 20;
    ctx.strokeStyle = goldInk; ctx.globalAlpha = layer.opacity * 0.85; ctx.lineWidth = 1.6;
    const cxm = lay.left + lay.boxW / 2;
    ctx.beginPath(); ctx.moveTo(cxm - 92, cy); ctx.lineTo(cxm - 20, cy); ctx.moveTo(cxm + 20, cy); ctx.lineTo(cxm + 92, cy); ctx.stroke();
    ctx.fillStyle = goldInk; ctx.font = '26px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('✦', cxm, cy + 9);
    ctx.globalAlpha = layer.opacity;
    y += lay.ornH;
  }
  const cx = edAlignX(layer.align, lay.textLeft, lay.textW);
  ctx.textAlign = layer.align;
  if (L.hasTitle) {
    ctx.fillStyle = goldInk;
    ctx.font = 'italic 600 ' + Math.round(L.fs * 0.74) + 'px "Playfair Display", serif';
    ctx.fillText(poem.title, cx, y + L.fs * 0.98);
    y += L.titleH;
  }
  edTextStyle(ctx, layer, L.fs);
  ctx.fillStyle = layer.color;
  ctx.font = L.fontMain;
  L.lines.forEach((ln, i) => edFillLine(ctx, ln, cx, y + L.step * 0.72 + i * L.step, layer));
  y += L.lines.length * L.step;
  if (L.roman.length) {
    ctx.font = L.fontRoman;
    ctx.globalAlpha = layer.opacity * 0.88;
    L.roman.forEach((ln, i) => ctx.fillText(ln, cx, y + 14 + L.rStep * 0.72 + i * L.rStep));
    ctx.globalAlpha = layer.opacity;
  }
  edClearShadow(ctx);
  if (!poem._custom) {
    ctx.fillStyle = goldInk;
    ctx.font = '600 ' + Math.round(L.fs * 0.58) + 'px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('— ' + (poem.customPoet || poetOf(poem.poet).name) + ' —', lay.left + lay.boxW / 2, lay.textTop + L.blockH + Math.round(L.fs * 0.72));
  }
  ctx.restore();
}
function edDrawTextLayer(ctx, layer, W, H) {
  const lay = edTextLayout(layer, W, H);
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  edChipDraw(ctx, lay.left, lay.top, lay.boxW, lay.totalH, layer.chip);
  const cx = edAlignX(layer.align, lay.textLeft, lay.boxW - lay.pad * 2);
  ctx.textAlign = layer.align;
  edTextStyle(ctx, layer, lay.fs);
  ctx.fillStyle = layer.color;
  ctx.font = lay.font;
  lay.lines.forEach((ln, i) => edFillLine(ctx, ln, cx, lay.textTop + lay.step * 0.72 + i * lay.step, layer));
  edClearShadow(ctx);
  ctx.restore();
}
async function edRenderCanvas(design, poems) {
  const { w: W, h: H } = edDims(design);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  await edDrawBg(ctx, design, W, H);
  try {
    await Promise.all([
      document.fonts.load('64px "Noto Nastaliq Urdu"'),
      document.fonts.load('62px "Amiri"'),
      document.fonts.load('600 56px "Playfair Display"'),
      document.fonts.load('italic 30px "Cormorant Garamond"'),
      document.fonts.load('600 40px Inter'),
    ]);
  } catch { /* fonts optional */ }
  const entry = edColorOf(design);
  const lightBg = !!entry.light && design.bg.type !== 'photo' && design.bg.type !== 'scene';
  const goldInk = lightBg ? '#8a6a18' : '#d4af37';
  edDrawFrame(ctx, design, W, H, lightBg);
  const poem = edPoemOf(design, poems);
  for (const layer of design.layers) {
    if (layer.hidden) continue;
    if (layer.kind === 'poem') { if (poem) edDrawPoemLayer(ctx, design, poem, layer, W, H, goldInk); }
    else edDrawTextLayer(ctx, layer, W, H);
  }
  if (design.watermark) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = lightBg ? '#5c4a1c' : '#f3ead8';
    ctx.font = '600 25px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('✦ DailyPoem', W - 42, H - 34);
    ctx.restore();
  }
  return canvas;
}
function edSaveCanvas(canvas, mime, filename, toast) {
  if (Capacitor.isNativePlatform()) {
    const data = canvas.toDataURL(mime, 0.92).split(',')[1];
    return Filesystem.writeFile({ path: filename, data, directory: Directory.Cache })
      .then(({ uri }) => Share.share({ title: 'DailyPoem', files: [uri] }))
      .then(() => toast('Ready — saved, pick where to send it'))
      .catch((e) => { if (e && /cancel/i.test(e.message || '')) return; toast('Could not save the image'); });
  }
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { toast('Could not create the image'); resolve(); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('Image saved');
      resolve();
    }, mime, 0.92);
  });
}

const ED_PROJ_KEY = 'dailypoem_projects_v1';
function edLoadProjects() {
  try { const v = JSON.parse(localStorage.getItem(ED_PROJ_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function EdSlider({ label, min, max, step, value, unit, onChange }) {
  return (
    <label className="ph-label" style={{ marginTop: 10 }}>{label}: {value}{unit || ''}
      <input type="range" className="slider" min={min} max={max} step={step || 1} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

function PhotoCardMaker({ poems, toast }) {
  const [design, setDesign] = useState(edDefaultDesign);
  const [selId, setSelId] = useState(null);
  const [panel, setPanel] = useState('design');
  const [busy, setBusy] = useState('');
  const [zoom, setZoom] = useState(1);
  const [guides, setGuides] = useState(false);
  const [bgMove, setBgMove] = useState(false);
  const [snapGuide, setSnapGuide] = useState({ v: false, h: false });
  const [projects, setProjects] = useState(edLoadProjects);
  const [projName, setProjName] = useState('');
  const stageRef = useRef(null);
  const fileRef = useRef(null);
  const dragRef = useRef(null);
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const lastKeyRef = useRef({ key: null, t: 0 });
  const [pvW, setPvW] = useState(360);
  const [, setTick] = useState(0);
  const [, setFontsReady] = useState(false);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const update = () => setPvW(el.clientWidth || 360);
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    let on = true;
    try {
      Promise.all([
        document.fonts.load('40px "Noto Nastaliq Urdu"'),
        document.fonts.load('40px "Amiri"'),
        document.fonts.load('600 40px "Playfair Display"'),
        document.fonts.load('italic 28px "Cormorant Garamond"'),
      ]).then(() => { if (on) setFontsReady(true); }).catch(() => { if (on) setFontsReady(true); });
    } catch { setFontsReady(true); }
    return () => { on = false; };
  }, []);

  const { w: W, h: H } = edDims(design);
  const pv = pvW / W;
  const poem = edPoemOf(design, poems);
  const sel = design.layers.find(l => l.id === selId) || design.layers.find(l => l.kind === 'poem') || design.layers[0];
  const entry = edColorOf(design);
  const lightBg = !!entry.light && design.bg.type !== 'photo' && design.bg.type !== 'scene';
  const goldInk = lightBg ? '#8a6a18' : '#d4af37';

  /* ---------- history ---------- */
  const edClone = (o) => JSON.parse(JSON.stringify(o));
  const applyDesign = (next, key) => {
    const now = Date.now();
    const coalesce = key && lastKeyRef.current.key === key && now - lastKeyRef.current.t < 900;
    if (!coalesce) {
      pastRef.current.push(edClone(design));
      if (pastRef.current.length > 60) pastRef.current.shift();
      futureRef.current = [];
    }
    lastKeyRef.current = { key: key || null, t: now };
    setDesign(next);
    setTick(t => t + 1);
  };
  const updateDesign = (fn, key) => { const next = edClone(design); fn(next); applyDesign(next, key); };
  const updLayer = (id, patch, key) => updateDesign((d) => {
    const l = d.layers.find(x => x.id === id);
    if (l) Object.assign(l, patch);
  }, key || ('layer:' + id + ':' + Object.keys(patch).join(',')));
  const beginHistory = () => {
    pastRef.current.push(edClone(design));
    if (pastRef.current.length > 60) pastRef.current.shift();
    futureRef.current = [];
    lastKeyRef.current = { key: null, t: 0 };
    setTick(t => t + 1);
  };
  const undo = () => {
    if (!pastRef.current.length) return;
    futureRef.current.push(edClone(design));
    setDesign(pastRef.current.pop());
    lastKeyRef.current = { key: null, t: 0 };
    setTick(t => t + 1);
  };
  const redo = () => {
    if (!futureRef.current.length) return;
    pastRef.current.push(edClone(design));
    setDesign(futureRef.current.pop());
    lastKeyRef.current = { key: null, t: 0 };
    setTick(t => t + 1);
  };
  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  /* ---------- photo ---------- */
  const onPickPhoto = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      try {
        const MAX = 1440;
        const sc = Math.min(1, MAX / Math.max(im.naturalWidth, im.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * sc);
        c.height = Math.round(im.naturalHeight * sc);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        const dataUrl = c.toDataURL('image/jpeg', 0.86);
        updateDesign((d) => { d.bg.type = 'photo'; d.bg.photoData = dataUrl; d.bg.offX = 0.5; d.bg.offY = 0.5; });
        toast('Photo added');
      } catch { toast('That photo could not be loaded'); }
      URL.revokeObjectURL(url);
    };
    im.onerror = () => { URL.revokeObjectURL(url); toast('That photo could not be loaded'); };
    im.src = url;
    e.target.value = '';
  };

  /* ---------- drag (layers + background) ---------- */
  const startLayerDrag = (e, layer) => {
    e.preventDefault();
    setSelId(layer.id);
    if (layer.locked) return;
    const stage = stageRef.current;
    if (!stage) return;
    try { stage.setPointerCapture(e.pointerId); } catch { /* noop */ }
    beginHistory();
    dragRef.current = { kind: 'layer', id: layer.id, sx: e.clientX, sy: e.clientY, x: layer.x, y: layer.y };
  };
  const onStagePointerDown = (e) => {
    if (bgMove && (design.bg.type === 'photo' || design.bg.type === 'scene')) {
      const stage = stageRef.current;
      if (!stage) return;
      try { stage.setPointerCapture(e.pointerId); } catch { /* noop */ }
      beginHistory();
      dragRef.current = { kind: 'bg', sx: e.clientX, sy: e.clientY, x: design.bg.offX, y: design.bg.offY };
      return;
    }
    if (e.target === e.currentTarget || (e.target.classList && (e.target.classList.contains('ed-bgimg') || e.target.classList.contains('ed-shade')))) setSelId(null);
  };
  const onStagePointerMove = (e) => {
    const dr = dragRef.current;
    if (!dr) return;
    const stage = stageRef.current;
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const dx = (e.clientX - dr.sx) / r.width;
    const dy = (e.clientY - dr.sy) / r.height;
    if (dr.kind === 'bg') {
      setDesign((prev) => {
        const next = edClone(prev);
        next.bg.offX = edClamp(dr.x - dx, 0, 1);
        next.bg.offY = edClamp(dr.y - dy, 0, 1);
        return next;
      });
      return;
    }
    let nx = edClamp(dr.x + dx, 0.04, 0.96);
    let ny = edClamp(dr.y + dy, 0.03, 0.97);
    const sv = Math.abs(nx - 0.5) < 0.02;
    const sh = Math.abs(ny - 0.5) < 0.02;
    if (sv) nx = 0.5;
    if (sh) ny = 0.5;
    setSnapGuide({ v: sv, h: sh });
    setDesign((prev) => {
      const next = edClone(prev);
      const l = next.layers.find(x => x.id === dr.id);
      if (l) { l.x = nx; l.y = ny; }
      return next;
    });
  };
  const endDrag = () => { dragRef.current = null; setSnapGuide({ v: false, h: false }); };

  /* ---------- projects ---------- */
  const saveProject = () => {
    const name = projName.trim() || ('Design — ' + new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const list = [{ id: edNewId(), name, at: Date.now(), design: edClone(design) }, ...projects].slice(0, 24);
    try {
      localStorage.setItem(ED_PROJ_KEY, JSON.stringify(list));
      setProjects(list);
      setProjName('');
      toast('Project saved on this device');
    } catch { toast('Storage is full — delete a saved project first'); }
  };
  const openProject = (p) => {
    applyDesign(edClone(p.design));
    setSelId(null);
    toast('Project opened');
  };
  const deleteProject = (id) => {
    const list = projects.filter(p => p.id !== id);
    setProjects(list);
    try { localStorage.setItem(ED_PROJ_KEY, JSON.stringify(list)); } catch { /* noop */ }
  };

  /* ---------- layers ---------- */
  const addLayer = (kind) => {
    const l = edTextLayer(kind, kind === 'name' ? 'Your Name' : 'New text');
    updateDesign((d) => { d.layers.push(l); });
    setSelId(l.id);
    setPanel('text');
  };
  const moveLayer = (id, dir) => updateDesign((d) => {
    const i = d.layers.findIndex(l => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= d.layers.length) return;
    const tmp = d.layers[i]; d.layers[i] = d.layers[j]; d.layers[j] = tmp;
  });
  const dupLayer = (id) => {
    const src = design.layers.find(l => l.id === id);
    if (!src || src.kind === 'poem') return;
    const c = edClone(src);
    c.id = edNewId();
    c.name = src.name + ' copy';
    c.y = edClamp(src.y + 0.04, 0.05, 0.95);
    updateDesign((d) => { d.layers.push(c); });
    setSelId(c.id);
  };
  const delLayer = (id) => {
    const l = design.layers.find(x => x.id === id);
    if (!l || l.kind === 'poem') return;
    updateDesign((d) => { d.layers = d.layers.filter(x => x.id !== id); });
    if (selId === id) setSelId(null);
  };

  /* ---------- export ---------- */
  const doExport = async (kind) => {
    if (busy) return;
    setBusy(kind);
    try {
      const canvas = await edRenderCanvas(design, poems);
      if (kind === 'share') await shareCanvasFile(canvas, toast, 'dailypoem-design.png');
      else if (kind === 'jpg') await edSaveCanvas(canvas, 'image/jpeg', 'dailypoem-design.jpg', toast);
      else await edSaveCanvas(canvas, 'image/png', 'dailypoem-design.png', toast);
    } catch { toast('Export failed on this device'); }
    setBusy('');
  };

  /* ---------- preview pieces ---------- */
  const bgFilterCss = 'blur(' + design.bg.blur + 'px) brightness(' + design.bg.bright + '%) contrast(' + design.bg.contrast + '%) saturate(' + design.bg.sat + '%)';
  const renderBg = () => {
    const bg = design.bg;
    if (bg.type === 'photo' && bg.photoData) {
      return <img className="ed-bgimg" src={bg.photoData} alt="" style={{ filter: bgFilterCss, opacity: bg.opacity, objectPosition: (bg.offX * 100) + '% ' + (bg.offY * 100) + '%' }} />;
    }
    if (bg.type === 'scene') {
      const sc = SCENES.find(x => x.id === bg.sceneId) || SCENES[0];
      return <img className="ed-bgimg" src={sc.img} alt="" style={{ filter: bgFilterCss, opacity: bg.opacity, objectPosition: (bg.offX * 100) + '% ' + (bg.offY * 100) + '%' }} />;
    }
    return <div className="ed-bgimg" style={{ background: entry.css }} />;
  };
  const chipStyle = (layer) => layer.chip === 'dark'
    ? { background: 'rgba(8,6,5,.48)', borderRadius: 14 }
    : layer.chip === 'gold'
      ? { background: 'linear-gradient(145deg, rgba(212,175,55,.92), rgba(160,120,30,.92))', borderRadius: 14 }
      : {};
  const layerTextFx = (layer, fsPx) => ({
    textShadow: layer.shadow ? '0 ' + Math.max(1, fsPx * 0.05) + 'px ' + Math.max(3, fsPx * 0.32) + 'px rgba(0,0,0,' + layer.shadowStr + ')' : 'none',
    WebkitTextStroke: layer.outline ? (Math.max(0.6, layer.outlineW * 1.6 * pv) + 'px ' + edContrast(layer.color)) : undefined,
  });
  const renderPoemPreview = (layer) => {
    if (!poem) return <div style={{ padding: 16, textAlign: 'center', color: '#f3ead8', fontSize: 13 }}>Pick a poem or write your own in the Text tab</div>;
    const lay = edPoemLayout(design, poem, layer, W, H);
    const { L } = lay;
    return (
      <div style={{ padding: lay.pad * pv, ...chipStyle(layer) }}>
        {design.ornament && <div style={{ height: lay.ornH * pv, display: 'flex', alignItems: 'center', justifyContent: 'center', color: goldInk, fontSize: Math.max(9, 24 * pv), letterSpacing: 4 }}>— ✦ —</div>}
        {L.hasTitle && <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 600, fontSize: Math.max(10, L.fs * 0.74 * pv), color: goldInk, textAlign: layer.align, height: L.titleH * pv, display: 'flex', alignItems: 'center', justifyContent: layer.align === 'center' ? 'center' : layer.align === 'left' ? 'flex-start' : 'flex-end' }}>{poem.title}</div>}
        <div dir={L.isUr ? 'rtl' : 'ltr'} style={{ fontFamily: lay.f.stack, fontWeight: layer.bold ? 700 : (lay.f.weight ? 600 : 400), fontStyle: layer.italic && !lay.f.urdu ? 'italic' : 'normal', fontSize: L.fs * pv, lineHeight: L.step / L.fs, color: layer.color, textAlign: layer.align, letterSpacing: lay.f.urdu ? 0 : (layer.letterSpacing * pv) + 'px', ...layerTextFx(layer, L.fs * pv) }}>
          {L.lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
        {L.roman.length > 0 && (
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: L.rFs * pv, lineHeight: L.rStep / L.rFs, color: layer.color, opacity: 0.88, textAlign: 'center', marginTop: 14 * pv }}>
            {L.roman.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}
        {!poem._custom && <div style={{ textAlign: 'center', color: goldInk, fontWeight: 600, fontSize: Math.max(9, L.fs * 0.58 * pv), marginTop: 10 * pv }}>— {poem.customPoet || poetOf(poem.poet).name} —</div>}
      </div>
    );
  };
  const renderTextPreview = (layer) => {
    const lay = edTextLayout(layer, W, H);
    return (
      <div style={{ padding: lay.pad * pv, ...chipStyle(layer) }}>
        <div dir={lay.isUrduText ? 'rtl' : 'ltr'} style={{ fontFamily: lay.f.stack, fontWeight: layer.bold ? 700 : (lay.f.weight ? 600 : 400), fontStyle: layer.italic && !lay.f.urdu ? 'italic' : 'normal', fontSize: lay.fs * pv, lineHeight: lay.step / lay.fs, color: layer.color, textAlign: layer.align, letterSpacing: lay.f.urdu || lay.isUrduText ? 0 : (layer.letterSpacing * pv) + 'px', whiteSpace: 'pre-wrap', ...layerTextFx(layer, lay.fs * pv) }}>
          {lay.lines.map((l, i) => <div key={i}>{l || ' '}</div>)}
        </div>
      </div>
    );
  };
  const layerBox = (layer) => {
    if (layer.kind === 'poem') {
      if (!poem) return { left: '6%', top: '30%', width: '88%' };
      const lay = edPoemLayout(design, poem, layer, W, H);
      return { left: lay.left * pv, top: lay.top * pv, width: lay.boxW * pv };
    }
    const lay = edTextLayout(layer, W, H);
    return { left: lay.left * pv, top: lay.top * pv, width: lay.boxW * pv };
  };

  const selF = sel ? edLayerFont(sel, poem) : edFont('playfair');
  const selIsUrduFont = !!selF.urdu;

  return (
    <div style={{ marginTop: 26 }}>
      <div className="section-title"><h2>🖼️ Poetry Photo Studio</h2><small>Design studio</small></div>
      <p className="muted" style={{ fontSize: 13, margin: '0 0 10px' }}>A full design studio for poetry cards — your photo, layered text, templates and pro export.</p>

      {/* ---------- top bar ---------- */}
      <div className="ed-topbar">
        <button className="btn ed-mini" onClick={undo} disabled={!canUndo} title="Undo">↩ Undo</button>
        <button className="btn ed-mini" onClick={redo} disabled={!canRedo} title="Redo">↪ Redo</button>
        <button className="btn ed-mini" onClick={() => { applyDesign(edDefaultDesign()); setSelId(null); }} title="Reset design">⟲ Reset</button>
        <button className="btn ed-mini" onClick={saveProject} title="Save project on this device">💾 Save</button>
        <span style={{ flex: 1 }} />
        <button className="btn ed-mini" onClick={() => doExport('png')} disabled={!!busy}>{busy === 'png' ? 'Rendering…' : 'PNG'}</button>
        <button className="btn ed-mini" onClick={() => doExport('jpg')} disabled={!!busy}>{busy === 'jpg' ? 'Rendering…' : 'JPG'}</button>
        <button className="btn btn-gold ed-mini" style={{ flex: '0 0 auto' }} onClick={() => doExport('share')} disabled={!!busy}>{busy === 'share' ? 'Rendering…' : '📤 Share'}</button>
      </div>

      {/* ---------- stage ---------- */}
      <div style={{ overflowX: 'auto', marginTop: 10 }}>
        <div style={{ width: (zoom * 100) + '%', margin: '0 auto', minWidth: '60%' }}>
          <div className="ed-stage" ref={stageRef} style={{ aspectRatio: W + ' / ' + H, cursor: bgMove ? 'move' : 'default' }}
            onPointerDown={onStagePointerDown} onPointerMove={onStagePointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
            {renderBg()}
            <div className="ed-shade" style={{ opacity: (design.bg.darkness / 100) * 0.75 }} />
            {design.frame !== 'none' && <div className={'ed-frame' + (design.frame === 'double' ? ' dbl' : '')} style={{ borderColor: goldInk }} />}
            {design.layers.map((layer) => layer.hidden ? null : (
              <div key={layer.id} className={'ed-layer' + (sel && sel.id === layer.id ? ' sel' : '')}
                style={{ ...layerBox(layer), opacity: layer.opacity }}
                onPointerDown={(e) => startLayerDrag(e, layer)}>
                {layer.kind === 'poem' ? renderPoemPreview(layer) : renderTextPreview(layer)}
              </div>
            ))}
            {guides && <><div className="ed-safe" /><div className="ed-gh" style={{ opacity: 0.3 }} /><div className="ed-gv" style={{ opacity: 0.3 }} /></>}
            {snapGuide.v && <div className="ed-gv" />}
            {snapGuide.h && <div className="ed-gh" />}
            {design.watermark && <div className="ed-wm" style={{ color: lightBg ? '#5c4a1c' : '#f3ead8' }}>✦ DailyPoem</div>}
          </div>
        </div>
      </div>
      <div className="ed-row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <span className="muted" style={{ fontSize: 12 }}>{W} × {H}px{sel ? ' · ' + sel.name : ''}</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn ed-mini" onClick={() => setZoom(z => edClamp(Math.round((z - 0.15) * 100) / 100, 0.6, 1.8))}>−</button>
          <span className="muted" style={{ fontSize: 12, minWidth: 38, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button className="btn ed-mini" onClick={() => setZoom(z => edClamp(Math.round((z + 0.15) * 100) / 100, 0.6, 1.8))}>+</button>
          <button className={'btn ed-mini' + (guides ? ' btn-gold' : '')} style={{ flex: '0 0 auto' }} onClick={() => setGuides(g => !g)}>Guides</button>
        </span>
      </div>
      <p className="muted" style={{ fontSize: 12, textAlign: 'center', margin: '6px 0 0' }}>Drag any text on the canvas to move it — it snaps to the centre.</p>

      {/* ---------- panel tabs ---------- */}
      <div className="ed-tabs">
        {[['design', '🎨 Design'], ['bg', '🌆 Background'], ['text', '✍️ Text'], ['fx', '✨ Effects'], ['layers', '🗂 Layers']].map(([id, label]) => (
          <button key={id} className={'ed-tab' + (panel === id ? ' on' : '')} onClick={() => setPanel(id)}>{label}</button>
        ))}
      </div>

      <div className="ed-panel">
        {panel === 'design' && (
          <div>
            <div className="ed-sec">Canvas size</div>
            <div className="ed-row">
              {ED_RATIOS.map(r => (
                <button key={r.id} className={'chip' + (design.ratio === r.id ? ' on' : '')} onClick={() => updateDesign((d) => { d.ratio = r.id; })}>{r.label}</button>
              ))}
              <span className="muted" style={{ fontSize: 12 }}>{W} × {H}px</span>
            </div>
            {design.ratio === 'custom' && (
              <div className="ed-row" style={{ marginTop: 10 }}>
                <label className="muted" style={{ fontSize: 12.5 }}>Width <input className="field ed-num" type="number" min={600} max={2160} value={design.customW} onChange={(e) => updateDesign((d) => { d.customW = parseInt(e.target.value || '1080', 10); }, 'customW')} /></label>
                <label className="muted" style={{ fontSize: 12.5 }}>Height <input className="field ed-num" type="number" min={600} max={2160} value={design.customH} onChange={(e) => updateDesign((d) => { d.customH = parseInt(e.target.value || '1350', 10); }, 'customH')} /></label>
                <span className="muted" style={{ fontSize: 11.5 }}>600–2160 px each side</span>
              </div>
            )}
            <div className="ed-sec">Templates — one tap, fully editable</div>
            <div className="ed-tplgrid">
              {ED_TEMPLATES.map(t => (
                <button key={t.id} className="ed-tpl" style={{ background: t.css }} onClick={() => updateDesign((d) => { t.apply(d); })}>{t.name}</button>
              ))}
            </div>
            <div className="ed-sec">Saved projects (on this device)</div>
            <div className="ed-row">
              <input className="field" style={{ flex: 1, minWidth: 150 }} placeholder="Project name (optional)" value={projName} maxLength={40} onChange={(e) => setProjName(e.target.value)} />
              <button className="btn btn-gold" style={{ flex: '0 0 auto' }} onClick={saveProject}>💾 Save project</button>
            </div>
            {projects.length === 0 && <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>No saved projects yet — your full design (layers, photo, styles) is kept, not just a picture.</p>}
            {projects.map(p => (
              <div key={p.id} className="ed-projrow">
                <span style={{ flex: 1, fontSize: 13.5 }}><b>{p.name}</b> <span className="muted" style={{ fontSize: 11.5 }}>{new Date(p.at).toLocaleDateString()}</span></span>
                <button className="btn ed-mini" onClick={() => openProject(p)}>Open</button>
                <button className="btn ed-mini" onClick={() => deleteProject(p.id)}>🗑</button>
              </div>
            ))}
          </div>
        )}

        {panel === 'bg' && (
          <div>
            <div className="ed-sec">Background type</div>
            <div className="ed-row">
              <button className={'chip' + (design.bg.type === 'photo' ? ' on' : '')} onClick={() => { if (design.bg.photoData) updateDesign((d) => { d.bg.type = 'photo'; }); else fileRef.current && fileRef.current.click(); }}>📷 My Photo</button>
              <button className={'chip' + (design.bg.type === 'scene' ? ' on' : '')} onClick={() => updateDesign((d) => { d.bg.type = 'scene'; })}>🌆 Scenes</button>
              <button className={'chip' + (design.bg.type === 'color' ? ' on' : '')} onClick={() => updateDesign((d) => { d.bg.type = 'color'; })}>🎨 Colours</button>
              <button className={'chip' + (design.bg.type === 'gradient' ? ' on' : '')} onClick={() => updateDesign((d) => { d.bg.type = 'gradient'; })}>🌈 Gradients</button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickPhoto} />
            </div>
            {design.bg.type === 'photo' && (
              <div style={{ marginTop: 10 }}>
                <button className="btn" onClick={() => fileRef.current && fileRef.current.click()}>📷 Choose a photo</button>
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Large photos are shrunk automatically so the editor stays fast.</p>
              </div>
            )}
            {design.bg.type === 'scene' && (
              <div className="ed-row" style={{ marginTop: 10 }}>
                {SCENES.map(sc => (
                  <button key={sc.id} className={'ed-swatch' + (design.bg.sceneId === sc.id ? ' on' : '')} style={{ backgroundImage: 'url(' + sc.img + ')', backgroundSize: 'cover' }} title={sc.label} onClick={() => updateDesign((d) => { d.bg.sceneId = sc.id; })}><span>{sc.label}</span></button>
                ))}
              </div>
            )}
            {design.bg.type === 'color' && (
              <div className="ed-row" style={{ marginTop: 10 }}>
                {ED_COLORS.map(c => (
                  <button key={c.id} className={'swatch' + (design.bg.colorId === c.id ? ' on' : '')} style={{ background: c.css }} title={c.name} onClick={() => updateDesign((d) => { d.bg.colorId = c.id; })} />
                ))}
                <span className="muted" style={{ fontSize: 12.5 }}>{(ED_COLORS.find(c => c.id === design.bg.colorId) || ED_COLORS[0]).name}</span>
              </div>
            )}
            {design.bg.type === 'gradient' && (
              <div className="ed-row" style={{ marginTop: 10 }}>
                {ED_GRADIENTS.map(g => (
                  <button key={g.id} className={'ed-swatch' + (design.bg.gradientId === g.id ? ' on' : '')} style={{ background: g.css }} title={g.name} onClick={() => updateDesign((d) => { d.bg.gradientId = g.id; })}><span>{g.name}</span></button>
                ))}
              </div>
            )}
            {(design.bg.type === 'photo' || design.bg.type === 'scene') && (
              <>
                <div className="ed-sec">Photo adjustments</div>
                <EdSlider label="Blur" min={0} max={12} value={design.bg.blur} onChange={(v) => updateDesign((d) => { d.bg.blur = v; }, 'bg:blur')} />
                <EdSlider label="Brightness" min={40} max={140} value={design.bg.bright} unit="%" onChange={(v) => updateDesign((d) => { d.bg.bright = v; }, 'bg:bright')} />
                <EdSlider label="Contrast" min={40} max={140} value={design.bg.contrast} unit="%" onChange={(v) => updateDesign((d) => { d.bg.contrast = v; }, 'bg:contrast')} />
                <EdSlider label="Saturation" min={0} max={200} value={design.bg.sat} unit="%" onChange={(v) => updateDesign((d) => { d.bg.sat = v; }, 'bg:sat')} />
                <EdSlider label="Image opacity" min={20} max={100} value={Math.round(design.bg.opacity * 100)} unit="%" onChange={(v) => updateDesign((d) => { d.bg.opacity = v / 100; }, 'bg:opacity')} />
                <div className="ed-row" style={{ marginTop: 12 }}>
                  <button className={'chip' + (bgMove ? ' on' : '')} onClick={() => setBgMove(m => !m)}>✥ Move background: {bgMove ? 'On' : 'Off'}</button>
                  <span className="muted" style={{ fontSize: 12 }}>Drag the canvas to reposition the photo</span>
                </div>
              </>
            )}
            <EdSlider label="Dark overlay (text readability)" min={0} max={95} value={design.bg.darkness} unit="%" onChange={(v) => updateDesign((d) => { d.bg.darkness = v; }, 'bg:darkness')} />
          </div>
        )}

        {panel === 'text' && sel && (
          <div>
            <div className="ed-sec">Poem source</div>
            <div className="ed-row">
              <button className={'chip' + (!design.useCustom ? ' on' : '')} onClick={() => updateDesign((d) => { d.useCustom = false; })}>From library</button>
              <button className={'chip' + (design.useCustom ? ' on' : '')} onClick={() => updateDesign((d) => { d.useCustom = true; })}>Write my own</button>
            </div>
            {!design.useCustom && (
              <select className="field" style={{ marginTop: 10 }} value={poem && !poem._custom ? poem.id : ''} onChange={(e) => updateDesign((d) => { d.poemId = e.target.value; })}>
                {poems.map(p => <option key={p.id} value={p.id}>{p.lang === 'en' ? p.title : (p.roman ? p.roman[0] : p.id)} — {poetOf(p.poet).name}</option>)}
              </select>
            )}
            {design.useCustom && (
              <div style={{ marginTop: 10 }}>
                <textarea className="field" rows={5} placeholder={'Write or paste your poetry — one line per line…'} value={design.customText} onChange={(e) => updateDesign((d) => { d.customText = e.target.value; }, 'customText')} />
                <button className="btn ed-mini" style={{ marginTop: 8 }} onClick={async () => {
                  try { const t = await navigator.clipboard.readText(); if (t) updateDesign((d) => { d.customText = t; }); else toast('Clipboard is empty'); }
                  catch { toast('Paste is not allowed here — long-press the box and tap Paste'); }
                }}>📋 Paste from clipboard</button>
              </div>
            )}
            <div className="ed-sec">Layer: {sel.name}</div>
            {sel.kind !== 'poem' && (
              <textarea className="field" rows={3} value={sel.text} onChange={(e) => updLayer(sel.id, { text: e.target.value }, 'text:' + sel.id)} />
            )}
            <div className="ed-sec">Font</div>
            <div className="ed-row">
              {sel.kind === 'poem' && <button className={'chip' + (sel.font === 'auto' ? ' on' : '')} onClick={() => updLayer(sel.id, { font: 'auto' })}>Auto</button>}
              {ED_FONTS.map(f => (
                <button key={f.id} className={'chip' + (sel.font === f.id ? ' on' : '')} style={{ fontFamily: f.stack }} onClick={() => updLayer(sel.id, { font: f.id })}>{f.name}</button>
              ))}
            </div>
            <EdSlider label={sel.kind === 'poem' ? 'Text size' : 'Font size (px)'} min={sel.kind === 'poem' ? 60 : 22} max={sel.kind === 'poem' ? 155 : 120} step={sel.kind === 'poem' ? 1 : 1} value={sel.kind === 'poem' ? Math.round(sel.size * 100) : sel.size} unit={sel.kind === 'poem' ? '%' : 'px'} onChange={(v) => updLayer(sel.id, { size: sel.kind === 'poem' ? v / 100 : v }, 'size:' + sel.id)} />
            <EdSlider label="Block width" min={50} max={100} value={Math.round(sel.w * 100)} unit="%" onChange={(v) => updLayer(sel.id, { w: v / 100 }, 'w:' + sel.id)} />
            <EdSlider label="Opacity" min={15} max={100} value={Math.round(sel.opacity * 100)} unit="%" onChange={(v) => updLayer(sel.id, { opacity: v / 100 }, 'op:' + sel.id)} />
            <EdSlider label="Line spacing" min={80} max={160} value={Math.round(sel.lineHeight * 100)} unit="%" onChange={(v) => updLayer(sel.id, { lineHeight: v / 100 }, 'lh:' + sel.id)} />
            {!selIsUrduFont && <EdSlider label="Letter spacing" min={0} max={12} value={sel.letterSpacing} unit="px" onChange={(v) => updLayer(sel.id, { letterSpacing: v }, 'ls:' + sel.id)} />}
            {selIsUrduFont && <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Letter spacing is off for Urdu fonts — it would break the joined letters.</p>}
            <div className="ed-sec">Colour & alignment</div>
            <div className="ed-row">
              {TEXT_COLORS.map(t => (
                <button key={t.id} className={'btn ed-mini' + (sel.color === t.hex ? ' btn-gold' : '')} style={{ flex: '0 0 auto' }} onClick={() => updLayer(sel.id, { color: t.hex })}><span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', background: t.hex, border: '1px solid rgba(128,128,128,.5)' }} />{t.name}</button>
              ))}
              <input type="color" className="ed-colorpick" value={sel.color} onChange={(e) => updLayer(sel.id, { color: e.target.value }, 'color:' + sel.id)} />
              <span style={{ flex: 1 }} />
              {[['left', '⬅ Left'], ['center', '↔ Centre'], ['right', 'Right ➡']].map(([a, label]) => (
                <button key={a} className={'btn ed-mini' + (sel.align === a ? ' btn-gold' : '')} style={{ flex: '0 0 auto' }} onClick={() => updLayer(sel.id, { align: a })}>{label}</button>
              ))}
            </div>
            <div className="ed-row" style={{ marginTop: 10 }}>
              <button className={'chip' + (sel.bold ? ' on' : '')} onClick={() => updLayer(sel.id, { bold: !sel.bold })}><b>Bold</b></button>
              <button className={'chip' + (sel.italic ? ' on' : '')} disabled={selIsUrduFont} onClick={() => updLayer(sel.id, { italic: !sel.italic })}><i>Italic</i></button>
              {selIsUrduFont && <span className="muted" style={{ fontSize: 12 }}>Italic is not available for Urdu fonts</span>}
            </div>
            <div className="ed-sec">Shadow, outline & backing</div>
            <div className="ed-row">
              <button className={'chip' + (sel.shadow ? ' on' : '')} onClick={() => updLayer(sel.id, { shadow: !sel.shadow })}>Shadow</button>
              <button className={'chip' + (sel.outline ? ' on' : '')} onClick={() => updLayer(sel.id, { outline: !sel.outline })}>Outline</button>
              {[['none', 'No backing'], ['dark', 'Dark pill'], ['gold', 'Gold pill']].map(([c, label]) => (
                <button key={c} className={'chip' + (sel.chip === c ? ' on' : '')} onClick={() => updLayer(sel.id, { chip: c })}>{label}</button>
              ))}
            </div>
            {sel.shadow && <EdSlider label="Shadow strength" min={0} max={100} value={Math.round(sel.shadowStr * 100)} unit="%" onChange={(v) => updLayer(sel.id, { shadowStr: v / 100 }, 'sh:' + sel.id)} />}
            {sel.outline && <EdSlider label="Outline width" min={1} max={6} value={sel.outlineW} unit="px" onChange={(v) => updLayer(sel.id, { outlineW: v }, 'ow:' + sel.id)} />}
            <div className="ed-sec">Position</div>
            <EdSlider label="Vertical position" min={4} max={96} value={Math.round(sel.y * 100)} unit="%" onChange={(v) => updLayer(sel.id, { y: v / 100 }, 'y:' + sel.id)} />
            <EdSlider label="Horizontal position" min={4} max={96} value={Math.round(sel.x * 100)} unit="%" onChange={(v) => updLayer(sel.id, { x: v / 100 }, 'x:' + sel.id)} />
          </div>
        )}

        {panel === 'fx' && (
          <div>
            <div className="ed-sec">Frame</div>
            <div className="ed-row">
              {[['none', 'No frame'], ['thin', 'Thin gold'], ['double', 'Double']].map(([f, label]) => (
                <button key={f} className={'chip' + (design.frame === f ? ' on' : '')} onClick={() => updateDesign((d) => { d.frame = f; })}>{label}</button>
              ))}
            </div>
            <div className="ed-sec">Decorations</div>
            <div className="ed-row">
              <button className={'chip' + (design.ornament ? ' on' : '')} onClick={() => updateDesign((d) => { d.ornament = !d.ornament; })}>— ✦ — ornament above poem</button>
              <button className={'chip' + (design.watermark ? ' on' : '')} onClick={() => updateDesign((d) => { d.watermark = !d.watermark; })}>DailyPoem watermark</button>
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.6 }}>The watermark is a small “✦ DailyPoem” in the bottom corner of the exported image. Turn it off any time. Text glow, shadow and outline live in the Text tab, per layer.</p>
          </div>
        )}

        {panel === 'layers' && (
          <div>
            <div className="ed-row">
              <button className="btn" onClick={() => addLayer('text')}>＋ Add text</button>
              <button className="btn" onClick={() => addLayer('name')}>✍ Add your name</button>
            </div>
            <div style={{ marginTop: 12 }}>
              {[...design.layers].reverse().map((layer) => (
                <div key={layer.id} className={'ed-layerrow' + (sel && sel.id === layer.id ? ' sel' : '')} onClick={() => setSelId(layer.id)}>
                  <span style={{ fontSize: 15 }}>{layer.kind === 'poem' ? '📜' : layer.kind === 'name' ? '✍' : '🔤'}</span>
                  <input className="field ed-layername" value={layer.name} maxLength={24} onClick={(e) => e.stopPropagation()} onChange={(e) => updLayer(layer.id, { name: e.target.value }, 'name:' + layer.id)} />
                  <button className="btn ed-mini" title="Move up (on top)" onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 1); }}>⬆</button>
                  <button className="btn ed-mini" title="Move down" onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, -1); }}>⬇</button>
                  <button className="btn ed-mini" title={layer.hidden ? 'Show' : 'Hide'} onClick={(e) => { e.stopPropagation(); updLayer(layer.id, { hidden: !layer.hidden }); }}>{layer.hidden ? '🙈' : '👁'}</button>
                  <button className="btn ed-mini" title={layer.locked ? 'Unlock' : 'Lock'} onClick={(e) => { e.stopPropagation(); updLayer(layer.id, { locked: !layer.locked }); }}>{layer.locked ? '🔒' : '🔓'}</button>
                  {layer.kind !== 'poem' && <button className="btn ed-mini" title="Duplicate" onClick={(e) => { e.stopPropagation(); dupLayer(layer.id); }}>⧉</button>}
                  {layer.kind !== 'poem' && <button className="btn ed-mini" title="Delete" onClick={(e) => { e.stopPropagation(); delLayer(layer.id); }}>🗑</button>}
                </div>
              ))}
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Top row = front-most layer. The Poem layer can be hidden but not deleted. Locked layers cannot be dragged.</p>
          </div>
        )}
      </div>
    </div>
  );
}


/* ---------------- Intro splash ---------------- */
function IntroSplash({ onDone }) {
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 2150);
    const t2 = setTimeout(() => doneRef.current(), 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className={'intro' + (leaving ? ' leaving' : '')} onClick={() => doneRef.current()}>
      <div className="intro-glow" />
      <div className="intro-emblem"><img src="/brand/symbol.png" alt="DailyPoem" style={{ height: '1.15em', width: 'auto' }} /></div>
      <div className="intro-name">{'DailyPoem'.split('').map((c, i) => <span key={i} style={{ animationDelay: (0.15 + i * 0.055) + 's' }}>{c}</span>)}</div>
      <div className="intro-tag">SHAYARI • POETRY • REELS</div>
      <div className="intro-sher" dir="rtl">ستاروں سے آگے جہاں اور بھی ہیں</div>
      <div className="intro-bar"><span /></div>
    </div>
  );
}


/* ---------------- Home slider ---------------- */
function HomeSlider({ today, todayScene, poems, novelCount, isFav, onToggleFav, onOpenReel, onShare, onGo, onOpenPoem, lang }) {
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  const pauseUntil = useRef(0);
  const goTo = (i) => { const el = ref.current; if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' }); };
  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() < pauseUntil.current) return;
      const el = ref.current; if (!el) return;
      const n = el.children.length; if (!n) return;
      const cur = Math.round(el.scrollLeft / el.clientWidth);
      goTo((cur + 1) % n);
    }, 4600);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const hold = () => { pauseUntil.current = Date.now() + 12000; };
  const sceneImg = (id) => (SCENES.find(x => x.id === id) || todayScene).img;
  const poemSlide = (p, label, sceneId) => p && (
    <section className="slide hero slide-tap" onClick={() => onOpenPoem(p, SCENES.find(x => x.id === sceneId) || todayScene)}>
      <img className="hero-img" src={sceneImg(sceneId)} alt="" />
      <div className="hero-shade" />
      <div className="hero-body">
        <span className="kicker">{label}</span>
        {p.lang === 'ur' ? (
          <>
            <div className={'urdu' + (!secondaryOf(p, lang) ? ' only' : '')}>{p.urdu.map((l, i) => <div key={i}>{l}</div>)}</div>
            <SecLines sec={secondaryOf(p, lang)} />
          </>
        ) : (
          <>
            {p.title && <div className="slide-title" style={{ marginTop: 16 }}>{p.title}</div>}
            <div className="en-lines" style={{ marginTop: 12 }}>{p.lines.slice(0, 4).map((l, i) => <div key={i}>{l}</div>)}</div>
          </>
        )}
        <div className="poet-line">— {poetOf(p.poet).name} <span>· {poetYears(p)}</span></div>
        <span className="slide-chip">🎬 Play Reel</span>
      </div>
    </section>
  );
  return (
    <div>
      <div className="hslider" ref={ref} onScroll={() => { const el = ref.current; if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth)); }} onPointerDown={hold} onTouchStart={hold}>
        <section className="slide hero">
          <img className="hero-img" src={todayScene.img} alt="" />
          <div className="hero-shade" />
          <div className="hero-body">
            <span className="kicker">✦ Poem of the Day</span>
            {today.lang === 'ur' ? (
              <>
                <div className={'urdu' + (!secondaryOf(today, lang) ? ' only' : '')}>{today.urdu.map((l, i) => <div key={i}>{l}</div>)}</div>
                <SecLines sec={secondaryOf(today, lang)} />
              </>
            ) : (
              <div className="en-lines" style={{ marginTop: 18 }}>{today.lines.slice(0, 4).map((l, i) => <div key={i}>{l}</div>)}</div>
            )}
            <div className="poet-line">— {poetOf(today.poet).name} <span>· {poetYears(today)}</span></div>
            <div className="hero-actions">
              <button className="btn btn-gold" onClick={onOpenReel}>🎬 Play Reel</button>
              <button className={'btn' + (isFav ? ' active-fav' : '')} onClick={onToggleFav}>{isFav ? '❤️' : '🤍'}</button>
              <button className="btn" onClick={onShare}>📤</button>
            </div>
          </div>
        </section>

        <section className="slide hero slide-tap" onClick={() => onGo('novel')}>
          <img className="hero-img" src={sceneImg('chaand')} alt="" />
          <div className="hero-shade" />
          <div className="hero-body">
            <span className="kicker">📖 Original Novel</span>
            <div className="urdu" style={{ fontSize: 30 }}>آخری سجدہ</div>
            <div className="slide-title">Aakhri Sajda</div>
            <p className="slide-sub">{novelCount} episodes live — a new episode every day at 8:00 PM. A story of loss, search, and the long road back.</p>
            <span className="slide-chip">Read Now →</span>
          </div>
        </section>

        {poemSlide(poems.find(p => p.id === 'g1'), '🔥 Trending', 'mehfil')}

        {poemSlide(poems.find(p => p.id === 'i11'), '🔥 Trending', 'chaand')}

        {poemSlide(poems.find(p => p.id === 'e1'), '⭐ English Spotlight', 'baarish')}
      </div>
      <div className="slider-dots">
        {Array.from({ length: 2 + ['g1', 'i11', 'e1'].filter(id => poems.some(p => p.id === id)).length }).map((_, i) => (
          <button key={i} className={'dot' + (idx === i ? ' on' : '')} onClick={() => { hold(); goTo(i); }} aria-label={'Slide ' + (i + 1)} />
        ))}
      </div>
    </div>
  );
}

function ReelsFeed({ startIndex = 0, onCreate, favs, onFav, toast }) {
  const notify = toast || (() => {});
  const [reels, setReels] = useState(() => { try { return JSON.parse(localStorage.getItem(REELS_CACHE_KEY)) || REELS_FALLBACK; } catch { return REELS_FALLBACK; } });
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem('dailypoem_reels_muted') !== '0'; } catch { return true; } });
  const [active, setActive] = useState(() => Math.max(0, startIndex || 0));
  const [pausedId, setPausedId] = useState(null);
  const [errIds, setErrIds] = useState(() => new Set());
  const [retryMap, setRetryMap] = useState({});
  const videoRefs = useRef({});
  const itemRefs = useRef({});
  const progRefs = useRef({});
  const feedRef = useRef(null);
  const activeRef = useRef(Math.max(0, startIndex || 0));
  const startRef = useRef(Math.max(0, startIndex || 0));
  const didStartScroll = useRef(false);
  const pausedRef = useRef(null);
  const hiddenRef = useRef(false);
  /* Likes sirf isi phone par save hote hain (server nahi) — is liye koi global count nahi dikhate */
  const [likes, setLikes] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem('dailypoem_reel_likes') || '[]'); return new Set(Array.isArray(v) ? v.filter(x => typeof x === 'string') : []); }
    catch { return new Set(); }
  });
  const toggleLike = id => setLikes(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    try { localStorage.setItem('dailypoem_reel_likes', JSON.stringify([...n])); } catch { /* noop */ }
    return n;
  });
  const shareReel = async (e, r) => {
    e.stopPropagation();
    const text = (r.title || 'A DailyPoem reel') + (r.poet ? ' — ' + r.poet : '') + '\n' + r.video;
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: 'DailyPoem Reel', text, url: r.video, dialogTitle: 'Share this reel' });
        return;
      }
      if (navigator.share) { await navigator.share({ title: 'DailyPoem Reel', text, url: r.video }); return; }
      throw new Error('share unavailable');
    } catch (err) {
      if (err && /cancel/i.test(err.message || '')) return; // user ne sheet band ki — error nahi
      try { await navigator.clipboard.writeText(text); notify('🔗 Reel link copied'); }
      catch { notify('Sharing is not available on this device'); }
    }
  };

  useEffect(() => {
    let live = true;
    fetch(REELS_REMOTE_URL, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        const list = Array.isArray(j) ? j : (j && j.reels);
        const clean = Array.isArray(list) ? list.filter(x => x && x.video) : null;
        if (live && clean && clean.length) {
          setReels(clean);
          try { localStorage.setItem(REELS_CACHE_KEY, JSON.stringify(clean)); } catch { /* noop */ }
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const playOne = id => {
    const v = videoRefs.current[id];
    if (v) { const pr = v.play(); if (pr) pr.catch(() => {}); }
  };
  const pauseAll = () => { Object.values(videoRefs.current).forEach(v => { if (v) v.pause(); }); };

  /* Kaunsi reel screen par hai — sirf wahi chalegi, baqi ruki rahengi */
  useEffect(() => {
    if (!reels.length) return undefined;
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.intersectionRatio >= 0.6) {
          const i = Number(en.target.dataset.idx);
          if (!isNaN(i) && i !== activeRef.current) {
            activeRef.current = i;
            setActive(i);
            setPausedId(null);
            pausedRef.current = null;
          }
        }
      });
    }, { threshold: [0.6] });
    Object.values(itemRefs.current).forEach(el => { if (el) io.observe(el); });
    return () => io.disconnect();
  }, [reels]);

  /* Active reel chalao, baqi sab pause — kamzor phones par memory bachane ke liye
     sirf pichli + current + agli reel ka <video> mount hota hai (windowing neeche render mein) */
  useEffect(() => {
    reels.forEach((r, i) => {
      const v = videoRefs.current[r.id];
      if (!v) return;
      if (i === active && !hiddenRef.current && pausedRef.current !== r.id) {
        const pr = v.play(); if (pr) pr.catch(() => {});
      } else v.pause();
    });
  }, [active, reels]);

  /* Home ki Trending strip se kisi khaas reel par land karna ho to feed wahan se shuru karo —
     sirf pehli dafa (mount par), taake baad mein user ki scroll na khinch jaye */
  useEffect(() => {
    if (didStartScroll.current) return undefined;
    const idx = Math.min(startRef.current, reels.length - 1);
    if (idx <= 0) { didStartScroll.current = true; return undefined; }
    const t = setTimeout(() => {
      didStartScroll.current = true;
      const el = feedRef.current;
      if (el) el.scrollTo({ top: idx * el.clientHeight, behavior: 'auto' });
    }, 60);
    return () => clearTimeout(t);
  }, [reels]);

  /* App background mein jaye to videos band — wapas aaye to active reel dobara chale */
  useEffect(() => {
    const onVis = () => {
      hiddenRef.current = document.hidden;
      if (document.hidden) pauseAll();
      else {
        const r = reels[activeRef.current];
        if (r && pausedRef.current !== r.id) playOne(r.id);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [reels]);

  /* Unmount par saare video resources release */
  useEffect(() => () => {
    Object.values(videoRefs.current).forEach(v => {
      if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch { /* noop */ } }
    });
  }, []);

  const toggleMute = () => setMuted(m => {
    const n = !m;
    try { localStorage.setItem('dailypoem_reels_muted', n ? '1' : '0'); } catch { /* noop */ }
    return n;
  });

  const togglePlay = id => {
    const v = videoRefs.current[id];
    if (!v) return;
    if (v.paused) { playOne(id); setPausedId(null); pausedRef.current = null; }
    else { v.pause(); setPausedId(id); pausedRef.current = id; }
  };

  const restart = (e, id) => {
    e.stopPropagation();
    const v = videoRefs.current[id];
    if (!v) return;
    try { v.currentTime = 0; } catch { /* noop */ }
    playOne(id);
    setPausedId(null); pausedRef.current = null;
  };

  const onTime = id => {
    const v = videoRefs.current[id];
    const bar = progRefs.current[id];
    if (v && bar && v.duration && isFinite(v.duration)) bar.style.width = (v.currentTime / v.duration * 100) + '%';
  };

  const onErr = id => setErrIds(prev => {
    if (prev.has(id)) return prev;
    const n = new Set(prev); n.add(id); return n;
  });

  const retry = (e, id) => {
    e.stopPropagation();
    setErrIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    setRetryMap(m => ({ ...m, [id]: (m[id] || 0) + 1 }));
    /* Nayi copy mount hogi — ▶ dikha do taake user tap karke chala sake */
    setPausedId(id); pausedRef.current = id;
  };

  const createBtn = onCreate ? (
    <button className="vfeed-create" onClick={e => { e.stopPropagation(); onCreate(); }}>+ Create Reel</button>
  ) : null;

  if (!reels.length) {
    return (
      <div className="vfeed" ref={feedRef}>
        {createBtn}
        <div className="vfeed-empty">
          <span><span className="big">🎬</span>Reels are coming soon.<br />Poetry videos are on their way — check back in a little while.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="vfeed" ref={feedRef}>
      {createBtn}
      {reels.map((r, i) => {
        const mounted = Math.abs(i - active) <= 1;
        const failed = errIds.has(r.id);
        return (
          <div className="vfeed-item" key={r.id} data-idx={i}
            ref={el => { itemRefs.current[r.id] = el; }}
            onClick={() => togglePlay(r.id)}>
            {mounted && !failed ? (
              <video
                key={r.id + ':' + (retryMap[r.id] || 0)}
                ref={el => { videoRefs.current[r.id] = el; if (el) el.muted = muted; }}
                src={r.video} loop playsInline muted={muted}
                preload={i === active || i === active + 1 ? 'auto' : 'metadata'}
                onTimeUpdate={() => onTime(r.id)}
                onError={() => onErr(r.id)}
              />
            ) : (
              <div className="vfeed-ph"><span>{r.title}</span></div>
            )}
            <div className="vfeed-shade" />
            {failed && (
              <div className="vfeed-err" onClick={e => e.stopPropagation()}>
                <span>⚠️ This video could not load.<br />Check your connection and try again.</span>
                <button className="btn btn-gold" style={{ flex: '0 1 auto' }} onClick={e => retry(e, r.id)}>↻ Retry</button>
              </div>
            )}
            {!failed && pausedId === r.id && <div className="vfeed-play">▶</div>}
            <div className="vfeed-progress"><span ref={el => { progRefs.current[r.id] = el; }} /></div>
            <button className="vfeed-act vfeed-replay" onClick={e => restart(e, r.id)} aria-label="Replay">↻</button>
            <button className="vfeed-act vfeed-mute" onClick={e => { e.stopPropagation(); toggleMute(); }} aria-label="Mute or unmute">{muted ? '🔇' : '🔊'}</button>
            <button className={'vfeed-act vfeed-like' + (likes.has(r.id) ? ' on' : '')}
              onClick={e => { e.stopPropagation(); toggleLike(r.id); }} aria-label="Like">{likes.has(r.id) ? '❤️' : '🤍'}</button>
            {r.poemId && favs && (
              <button className={'vfeed-act vfeed-save' + (favs.has(r.poemId) ? ' on' : '')}
                onClick={e => {
                  e.stopPropagation();
                  const was = favs.has(r.poemId);
                  if (onFav) onFav(r.poemId);
                  notify(was ? 'Removed from Saved' : 'Saved to your favourites');
                }} aria-label="Save poem">🔖</button>
            )}
            <button className="vfeed-act vfeed-share" onClick={e => shareReel(e, r)} aria-label="Share reel">📤</button>
            <div className="vfeed-meta">
              <div className="vfeed-title">{r.title}</div>
              <div className="vfeed-poet">{r.poet}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- More menu + Settings ---------------- */
function MoreMenu({ onOpen }) {
  const rows = [
    { id: 'noor', icon: '☪️', title: 'Noor', desc: 'Duas, Hadith & Daily Noor' },
    { id: 'create', icon: '✍️', title: 'Create / Studio', desc: 'Photo studio & your own reels' },
    { id: 'saved', icon: '❤️', title: 'Saved', desc: 'Your favourite poetry' },
    { id: 'settings', icon: '⚙️', title: 'Settings', desc: 'App preferences' },
  ];
  return (
    <div>
      <div className="section-title" style={{ marginTop: 18 }}><h2>More</h2><small>Explore</small></div>
      {rows.map(r => (
        <button key={r.id} className="more-row" onClick={() => onOpen(r.id)}>
          <span className="more-ic">{r.icon}</span>
          <span style={{ flex: 1, textAlign: 'left' }}>
            <span className="more-title">{r.title}</span>
            <span className="more-desc">{r.desc}</span>
          </span>
          <span className="more-chev">›</span>
        </button>
      ))}
      <p className="muted" style={{ fontSize: 12.5, textAlign: 'center', marginTop: 16 }}>DailyPoem · MintNest Studio</p>
    </div>
  );
}

function SettingsScreen({ theme, onToggleTheme, reelAnim, onReelAnim, toast, poemsCount, novelCount, lang, onLang }) {
  const notify = toast || (() => {});
  const epAlerts = useAlertToggle('ep', notify, { on: 'Episode alerts on — daily at 8:00 PM', off: 'Episode alerts turned off' });
  return (
    <div>
      <div className="section-title" style={{ marginTop: 18 }}><h2>Settings</h2><small>Preferences</small></div>
      <div className="nd-meta" style={{ marginTop: 2 }}>
        <div className="nd-row">
          <span>Theme</span>
          <button className="btn" style={{ padding: '7px 13px', fontSize: 12.5 }} onClick={onToggleTheme}>{theme === 'dark' ? '🌙 Dark' : '☀️ Light'}</button>
        </div>
        <div className="nd-row" style={{ alignItems: 'flex-start' }}>
          <span>Poetry Language<span className="set-sub">The script your poetry is shown in</span></span>
          <span className="chips" style={{ paddingBottom: 0 }}>
            {LANG_OPTIONS.map(o => (
              <button key={o.id} className={`chip ${lang === o.id ? 'on' : ''}`} onClick={() => onLang(o.id)}>{o.name}</button>
            ))}
          </span>
        </div>
        <AlertToggleRow icon="🔔" title="Episode alerts" sub="Daily reminder at 8:00 PM" ctl={epAlerts} toast={notify} />
        <div className="nd-row" style={{ alignItems: 'flex-start' }}>
          <span>Reel animation<span className="set-sub">How poetry lines appear</span></span>
          <span className="chips" style={{ paddingBottom: 0 }}>
            {REEL_ANIMS.map(a => (
              <button key={a.id} className={`chip ${reelAnim === a.id ? 'on' : ''}`} onClick={() => onReelAnim(a.id)}>{a.label}</button>
            ))}
          </span>
        </div>
      </div>

      <div className="section-title"><h2>About</h2></div>
      <div className="nd-meta" style={{ marginTop: 2 }}>
        <div className="nd-row"><span>App</span><b>DailyPoem</b></div>
        <div className="nd-row"><span>Version</span><b>0.13</b></div>
        <div className="nd-row"><span>Content</span><b>{poemsCount} poems · {novelCount} novel episodes</b></div>
        <div className="nd-row"><span>Studio</span><b>MintNest Studio</b></div>
        <div className="nd-row"><span>Reel music</span><b style={{ fontSize: 11.5, textAlign: 'right' }}>Kevin MacLeod · incompetech.com · CC BY 4.0</b></div>
      </div>
    </div>
  );
}

/* Pehli dafa app khulne par zaban ka intekhab — ek hi bar dikhta hai,
   dailypoem_lang save hone ke baad kabhi nahi. */
function LangChooser({ onPick }) {
  return (
    <div className="lang-pick">
      <div className="intro-emblem"><img src="/brand/symbol.png" alt="DailyPoem" style={{ height: '1.15em', width: 'auto' }} /></div>
      <h2 className="lang-title">Choose your language</h2>
      <div className="lang-title-ur" dir="rtl">اپنی زبان منتخب کریں</div>
      <p className="lang-sub">Poetry will be shown in this script. You can change it anytime in Settings.</p>
      <div className="lang-opts">
        {LANG_OPTIONS.map(o => (
          <button key={o.id} className="lang-opt" onClick={() => onPick(o.id)}>
            <span className="lang-name">{o.name}</span>
            <span className="lang-label">{o.label}</span>
            <span className={'lang-sample' + (o.id === 'ur' ? ' ur' : o.id === 'hi' ? ' hi' : '')} dir={o.id === 'ur' ? 'rtl' : 'ltr'}>{o.sample}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* Bell icon se khulne wala Notifications panel — dono reminders ek jagah */
function NotifPanel({ toast, nextEpText, onClose }) {
  const epAlerts = useAlertToggle('ep', toast, { on: 'Episode alerts on — daily at 8:00 PM', off: 'Episode alerts turned off' });
  const poemAlerts = useAlertToggle('poem', toast, { on: 'Daily poem reminder on — every morning at 9:00 AM', off: 'Daily poem reminder turned off' });
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <b>🔔 Notifications</b>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="nd-meta" style={{ marginTop: 4 }}>
          <AlertToggleRow icon="📖" title="Episode Alerts" sub="Daily 8:00 PM reminder when a new episode lands" ctl={epAlerts} toast={toast} />
          <AlertToggleRow icon="✦" title="Daily Poem Reminder" sub="Your Poem of the Day, every morning at 9:00 AM" ctl={poemAlerts} toast={toast} />
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>{nextEpText}</p>
        <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }} onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('home');
  const [favs, setFavs] = useState(loadFavs);
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [poetFilter, setPoetFilter] = useState(null);
  const [reel, setReel] = useState(null);
  const [reelAnim, setReelAnimState] = useState(() => { try { return localStorage.getItem('dailypoem_reel_anim') || 'rise'; } catch { return 'rise'; } });
  const [ownText, setOwnText] = useState('');
  const [ownName, setOwnName] = useState('');
  const [ownScene, setOwnScene] = useState(SCENES[0]);
  const [noorTab, setNoorTab] = useState('dua');
  const [moreView, setMoreView] = useState('menu'); // More ke andar: 'menu' | 'noor' | 'create' | 'saved' | 'settings'
  const [homeQuery, setHomeQuery] = useState('');
  const [reelsJump, setReelsJump] = useState({ index: 0, nonce: 0 });
  const [novelOpenReq, setNovelOpenReq] = useState(null);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('dailypoem_theme') || 'dark'; } catch { return 'dark'; } });
  const [intro, setIntro] = useState(true);
  /* Poetry display language — null matlab abhi tak choose nahi hui (chooser dikhao) */
  const [lang, setLang] = useState(loadLang);
  const [notifOpen, setNotifOpen] = useState(false);
  const pickLang = v => { lsSet(LANG_KEY, v); setDisplayLang(v); setLang(v); };
  useEffect(() => { rescheduleAlerts(); }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('dailypoem_theme', theme); } catch { /* noop */ }
  }, [theme]);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(null);

  const toast = msg => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2400);
  };

  const [poems, setPoems] = useState(() => { try { return sanitizePoems(JSON.parse(localStorage.getItem('dailypoem_poems_cache'))) || POEMS; } catch { return POEMS; } });
  useEffect(() => {
    let live = true;
    fetch(POEMS_REMOTE_URL, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { const clean = j && sanitizePoems(j.poems); if (live && clean) { setPoems(clean); try { localStorage.setItem('dailypoem_poems_cache', JSON.stringify(clean)); } catch { /* noop */ } } })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  const today = useMemo(() => poemOfTheDay(poems), [poems]);
  const noorToday = useMemo(() => noorOfTheDay(), []);
  const todayScene = SCENES[new Date().getDate() % SCENES.length];

  /* Novels data App level par — Home ke Continue Reading / Featured Novel / search aur
     Novels tab (library) dono ke liye ek hi source. Pehle novels.json try hota hai;
     na mile to legacy novel.json ko sanitizeNovels wrap kar leta hai (transition). */
  const [novels, setNovels] = useState(loadNovelsInitial);
  useEffect(() => {
    let live = true;
    (async () => {
      const get = async url => { try { const r = await fetch(url, { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch { return null; } };
      const clean = sanitizeNovels(await get(NOVELS_REMOTE_URL)) || sanitizeNovels(await get(LEGACY_NOVEL_REMOTE_URL));
      if (live && clean) { setNovels(clean.novels); lsSet(NOVELS_CACHE_KEY, JSON.stringify(clean)); }
    })();
    return () => { live = false; };
  }, []);
  const novelsPub = useMemo(
    () => novels.map(nv => ({ nv, published: publishedOf(nv) })),
    [novels],
  );
  const aakhriPub = (novelsPub.find(x => x.nv.id === LEGACY_NOVEL_ID) || novelsPub[0] || { published: [] }).published;
  const totalEpCount = novelsPub.reduce((s, x) => s + x.published.length, 0);

  /* Home ki Trending Reels strip ke liye reels list — ReelsFeed wali hi cache/remote */
  const [homeReels, setHomeReels] = useState(() => { try { return JSON.parse(localStorage.getItem(REELS_CACHE_KEY)) || REELS_FALLBACK; } catch { return REELS_FALLBACK; } });
  useEffect(() => {
    let live = true;
    fetch(REELS_REMOTE_URL, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        const list = Array.isArray(j) ? j : (j && j.reels);
        const clean = Array.isArray(list) ? list.filter(x => x && x.video) : null;
        if (live && clean && clean.length) {
          setHomeReels(clean);
          try { localStorage.setItem(REELS_CACHE_KEY, JSON.stringify(clean)); } catch { /* noop */ }
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const copyText = async text => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      ta.remove();
    }
    toast('📋 Copied — paste it anywhere');
  };

  useEffect(() => {
    try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs])); } catch { /* noop */ }
  }, [favs]);

  const toggleFav = id => setFavs(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  /* Mood ke hisaab se scene (shared sceneForPoem): mohabbat -> gulab, udaasi -> baarish,
     umeed -> chaand, sufi -> mehfil; baqi din ke hisaab se ghoomti hain (random nahi) */
  const openReel = poem => setReel({ poem, scene: sceneForPoem(poem) });

  const setReelAnim = a => {
    setReelAnimState(a);
    try { localStorage.setItem('dailypoem_reel_anim', a); } catch { /* noop */ }
  };

  /* More tab ke andar kisi section ko kholo */
  const goMore = view => { setMoreView(view); setTab('more'); };

  /* Novels tab khol kar seedha kisi novel ki episode ke reader mein jao (saved position khud lag jati hai) */
  const openNovelEpisode = (novelId, n) => { setNovelOpenReq({ novelId, n, ts: Date.now() }); setTab('novel'); };
  /* Novels tab mein seedha kisi novel ki detail kholo (bina episode khole) */
  const openNovelDetail = novelId => { setNovelOpenReq({ novelId, n: null, ts: Date.now() }); setTab('novel'); };

  /* Episode alert notification par tap -> seedha Novel tab */
  useEffect(() => {
    let sub = null;
    let live = true;
    (async () => {
      try {
        const m = await import('@capacitor/local-notifications');
        if (!live) return;
        sub = await m.LocalNotifications.addListener('localNotificationActionPerformed', action => {
          const dest = (action && action.notification && action.notification.extra && action.notification.extra.tab) || 'novel';
          if (dest === 'home') { setTab('home'); } else setTab('novel');
        });
      } catch { /* web/dev par plugin nahi — khamoshi se skip */ }
    })();
    return () => { live = false; if (sub && sub.remove) { try { const r = sub.remove(); if (r && r.catch) r.catch(() => {}); } catch { /* noop */ } } };
  }, []);

  const filtered = useMemo(() => {
    let list = poems;
    if (catFilter !== 'all') list = list.filter(p => p.category === catFilter);
    if (poetFilter) list = list.filter(p => p.poet === poetFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(p => {
        const poet = poetOf(p.poet).name.toLowerCase();
        const text = [...(p.urdu || []), ...(p.roman || []), ...(p.lines || []), p.title || ''].join(' ').toLowerCase();
        return poet.includes(q) || text.includes(q);
      });
    }
    return list;
  }, [catFilter, poetFilter, query, poems]);

  const favPoems = poems.filter(p => favs.has(p.id));

  /* ---------- Home: search + novel sections ka data ---------- */
  const hqRaw = homeQuery.trim();
  const hq = hqRaw.toLowerCase();
  const homePoemHits = hq ? poems.filter(p => {
    const poet = poetOf(p.poet).name.toLowerCase();
    const text = [...(p.urdu || []), ...(p.hi || []), ...(p.english || []), ...(p.lines || []), p.title || ''].join(' ').toLowerCase();
    return poet.includes(hq) || text.includes(hq) || (p.urdu || []).join(' ').includes(hqRaw) || (p.hi || []).join(' ').includes(hqRaw);
  }).slice(0, 6) : [];
  const homeMoodHits = hq ? CATEGORIES.filter(c => c.label.toLowerCase().includes(hq) || c.id.includes(hq) || (c.urdu || '').includes(hqRaw)) : [];
  const homeEpHits = hq ? novelsPub.flatMap(({ nv, published }) => published
    .filter(e => (e.title || '').toLowerCase().includes(hq) || (e.urduTitle || '').includes(hqRaw))
    .map(e => ({ nv, e }))).slice(0, 4) : [];
  const homeNovelHits = hq ? novels.filter(nv => (nv.title || '').toLowerCase().includes(hq) || (nv.urduTitle || '').includes(hqRaw)) : [];
  const homeHasHits = homePoemHits.length > 0 || homeMoodHits.length > 0 || homeEpHits.length > 0 || homeNovelHits.length > 0;

  /* Continue Reading — har novel ki apni pos key + shared helper; jis novel mein
     adhoori reading hai, us ki ek row banti hai */
  const homeContRows = novelsPub
    .map(({ nv, published }) => ({ nv, lastPos: novelLastPos(published, lsJson(novelPosKey(nv.id), {})) }))
    .filter(x => x.lastPos);

  /* Featured Novel = sab se taaza episode wala novel (sab se bari latest publishAt);
     kisi episode par date na ho to novels ki list mein sab se aakhir wala (jo novel sab
     se naya shamil hua) featured rehta hai. */
  const featuredEntry = novelsPub.reduce((best, x) => {
    const latestMs = x.published.length ? epPublishMs(x.published[x.published.length - 1]) : -1;
    return !best || latestMs >= best.latestMs ? { ...x, latestMs } : best;
  }, null);
  const featuredNv = featuredEntry ? featuredEntry.nv : null;
  const featuredPub = featuredEntry ? featuredEntry.published : [];
  const featuredLatest = featuredPub[featuredPub.length - 1] || null;
  const featuredLastPos = featuredNv ? novelLastPos(featuredPub, lsJson(novelPosKey(featuredNv.id), {})) : null;
  /* "New Episode" badge sirf tab jab latest episode asal mein pichle 48 ghante mein publish hua ho
     (publishAt maujood ho tab hi pata chalta hai; warna koi badge nahi — andaza nahi lagate) */
  const latestAgeMs = featuredLatest && featuredLatest.publishAt ? Date.now() - epPublishMs(featuredLatest) : null;
  const latestIsNew = latestAgeMs != null && latestAgeMs >= 0 && latestAgeMs < 48 * 3600 * 1000;

  const ownPoem = () => {
    const lines = ownText.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length < 1) return null;
    const isUrdu = /[\u0600-\u06FF]/.test(ownText);
    return {
      id: 'own', lang: isUrdu ? 'ur' : 'en', poet: 'dailypoem', category: 'mohabbat',
      customPoet: ownName.trim() || 'Anonymous Poet',
      ...(isUrdu ? { urdu: lines, roman: [] } : { lines }),
    };
  };

  const startOwnReel = () => { const p = ownPoem(); if (p) setReel({ poem: p, scene: ownScene }); };

  return (
    <div className="app">
      {intro && <IntroSplash onDone={() => setIntro(false)} />}
      {!intro && lang === null && <LangChooser onPick={pickLang} />}
      {notifOpen && (
        <NotifPanel toast={toast} onClose={() => setNotifOpen(false)}
          nextEpText={(() => {
            let nxt = null;
            for (const nv of novels) {
              for (const e of nv.episodes) {
                const ms = epPublishMs(e);
                if (ms > Date.now() && (!nxt || ms < nxt.ms)) nxt = { nv, e, ms };
              }
            }
            if (nxt) return `🕗 ${nxt.nv.title} — Episode ${nxt.e.n} arrives ${fmtPkDate(nxt.ms)} — right here in the app.`;
            return featuredLatest ? `📖 ${featuredNv.title} — Episode ${featuredLatest.n} is the latest, live now. New episodes arrive daily at 8:00 PM.` : 'New episodes arrive daily at 8:00 PM.';
          })()} />
      )}
      <header className="topbar">
        <div className="logo">
          <div className="logo-mark">🌙</div>
          <div>
            <div className="logo-name">Daily<b>Poem</b></div>
            <div className="logo-sub">Shayari · Poetry · Reels</div>
          </div>
        </div>
        <span style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <span className="tag">{poems.length} poems</span>
          <button className="btn top-ic" onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))} aria-label="Toggle light or dark theme" title="Theme">{theme === 'dark' ? '☀️' : '🌙'}</button>
          <button className="btn top-ic" onClick={() => setNotifOpen(true)} aria-label="Notifications" title="Notifications">🔔</button>
        </span>
      </header>

      <div className="main">
        {tab === 'home' && (
          <>
            <HomeSlider
              today={today} todayScene={todayScene} poems={poems} lang={lang || 'ur'}
              novelCount={aakhriPub.length}
              isFav={favs.has(today.id)} onToggleFav={() => toggleFav(today.id)}
              onOpenReel={() => setReel({ poem: today, scene: todayScene })}
              onShare={() => sharePoem(today, todayScene, toast)}
              onGo={setTab} onOpenPoem={(p, sc) => setReel({ poem: p, scene: sc })}
            />

            <div className="search">
              <span>🔎</span>
              <input value={homeQuery} onChange={e => setHomeQuery(e.target.value)} placeholder="Search poems, poets, moods, episodes…" />
              {hqRaw && <button className="icon-btn" onClick={() => setHomeQuery('')} aria-label="Clear search">✕</button>}
            </div>
            {hqRaw && (
              <div className="sr-panel">
                {!homeHasHits && <div className="sr-empty">No poems found for &ldquo;{hqRaw}&rdquo; — try a poet name or mood.</div>}
                {homePoemHits.length > 0 && (
                  <>
                    <div className="sr-label">Poems</div>
                    {homePoemHits.map(p => {
                      const ssec = secondaryOf(p, lang || 'ur');
                      return (
                        <button key={p.id} className="sr-row" onClick={() => { setHomeQuery(''); openReel(p); }}>
                          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            {p.lang === 'ur'
                              ? <span className="sr-urdu" dir="rtl" style={{ textAlign: 'right' }}>{p.urdu[0]}</span>
                              : <span className="sr-main">{p.title || p.lines[0]}</span>}
                            {ssec && <span className={'sr-sec' + (ssec.kind === 'hindi' ? ' hindi' : '')}>{ssec.lines[0]}</span>}
                          </span>
                          <span className="sr-sub">{poetOf(p.poet).name} · Poem</span>
                        </button>
                      );
                    })}
                  </>
                )}
                {homeMoodHits.length > 0 && (
                  <>
                    <div className="sr-label">Moods</div>
                    {homeMoodHits.map(c => (
                      <button key={c.id} className="sr-row" onClick={() => { setHomeQuery(''); setCatFilter(c.id); setPoetFilter(null); setTab('library'); }}>
                        <span className="sr-main">{c.icon} {c.label}</span>
                        <span className="sr-sub">Mood</span>
                      </button>
                    ))}
                  </>
                )}
                {(homeNovelHits.length > 0 || homeEpHits.length > 0) && (
                  <>
                    <div className="sr-label">Novels</div>
                    {homeNovelHits.map(nv => {
                      const pub = (novelsPub.find(x => x.nv.id === nv.id) || {}).published || [];
                      return (
                        <button key={nv.id} className="sr-row" onClick={() => { setHomeQuery(''); openNovelDetail(nv.id); }}>
                          <span className="sr-main">📖 {nv.title}</span>
                          <span className="sr-sub">Novel · {pub.length} episodes</span>
                        </button>
                      );
                    })}
                    {homeEpHits.map(({ nv, e }) => (
                      <button key={nv.id + '-' + e.n} className="sr-row" onClick={() => { setHomeQuery(''); openNovelEpisode(nv.id, e.n); }}>
                        <span className="sr-main">Episode {e.n} — {e.title}</span>
                        <span className="sr-sub">{nv.title} · Episode</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            <div className="section-title"><h2>Browse by Mood</h2><button className="link-btn" onClick={() => { setCatFilter('all'); setPoetFilter(null); setTab('library'); }}>View All →</button></div>
            <div className="cat-grid">
              {CATEGORIES.map(c => {
                const art = CAT_ART[c.id] || {};
                return (
                  <button key={c.id} className={'cat-card' + (art.img ? ' has-art' : ' cat-grad')} onClick={() => { setCatFilter(c.id); setPoetFilter(null); setTab('library'); }}>
                    {art.img && <img className="cat-bg" src={art.img} alt="" loading="lazy" />}
                    {art.img && <div className="cat-shade" style={{ background: 'linear-gradient(155deg, ' + art.tint + ', rgba(10,8,7,.86) 82%)' }} />}
                    <span className="urdu-sm">{c.urdu}</span>
                    <span className="ic">{c.icon}</span>
                    <h3>{c.label}</h3>
                    <p>{poems.filter(p => p.category === c.id).length} poems</p>
                  </button>
                );
              })}
            </div>

            {homeContRows.length > 0 ? (
              <>
                <div className="section-title"><h2>Continue Reading</h2><small>{homeContRows.length === 1 ? homeContRows[0].nv.title : 'Your novels'}</small></div>
                {homeContRows.map(({ nv, lastPos }, i) => (
                  <div key={nv.id} className="cont-card" style={{ marginTop: i === 0 ? 0 : 10 }} onClick={() => openNovelEpisode(nv.id, lastPos.ep.n)}>
                    <div style={{ fontSize: 22 }}>📖</div>
                    <div style={{ flex: 1 }}>
                      <b style={{ fontSize: 14.5 }}>Episode {lastPos.ep.n} — {lastPos.ep.title}</b>
                      <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{nv.title} · {Math.round(lastPos.pct * 100)}% read</div>
                      <div className="cont-bar"><span style={{ width: (lastPos.pct * 100) + '%' }} /></div>
                    </div>
                    <span style={{ color: 'var(--gold)', fontSize: 20 }}>›</span>
                  </div>
                ))}
              </>
            ) : featuredPub.length > 0 && (
              <div className="cont-card" onClick={() => openNovelEpisode(featuredNv.id, featuredPub[0].n)}>
                <div style={{ fontSize: 22 }}>📖</div>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 14.5 }}>Start {featuredNv.title}</b>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>Episode 1 is ready — a new episode arrives daily at 8:00 PM.</div>
                </div>
                <span style={{ color: 'var(--gold)', fontSize: 20 }}>›</span>
              </div>
            )}

            {featuredNv && (
              <>
                <div className="section-title"><h2>Featured Novel</h2><small>Original</small></div>
                <div className="ncover ncover-tap" onClick={() => (featuredLastPos ? openNovelEpisode(featuredNv.id, featuredLastPos.ep.n) : openNovelDetail(featuredNv.id))}>
                  {latestIsNew && <span className="feat-badge">✦ New Episode</span>}
                  <div className="ncover-urdu" dir="rtl">{featuredNv.urduTitle}</div>
                  <div className="ncover-title">{featuredNv.title}</div>
                  <span className="tag">{featuredNv.genre || 'Drama'}</span>
                  <p className="ncover-syn">{featuredNv.synopsis}</p>
                  <div className="ncover-meta">Episodes {featuredPub.length} of {featuredNv.plannedEpisodes || featuredPub.length} · {featuredNv.status || 'Ongoing'}</div>
                  <span className="slide-chip">{featuredLastPos ? 'Continue Reading →' : 'Read Now →'}</span>
                </div>
              </>
            )}

            <div className="section-title"><h2>Trending Reels</h2><button className="link-btn" onClick={() => { setReelsJump({ index: 0, nonce: Date.now() }); setTab('reels'); }}>View All →</button></div>
            <div className="hstrip">
              {homeReels.map((r, i) => {
                const rp = poems.find(p => p.id === r.poemId);
                const sc = rp ? sceneForPoem(rp) : SCENES[0];
                return (
                  <button key={r.id} className="reel-card" onClick={() => { setReelsJump({ index: i, nonce: Date.now() }); setTab('reels'); }}>
                    <img src={sc.img} alt="" loading="lazy" />
                    <span className="reel-card-shade" />
                    <span className="reel-card-play">▶</span>
                    <span className="reel-card-meta"><b>{r.title}</b><small>{r.poet}</small></span>
                  </button>
                );
              })}
            </div>

            <div className="section-title"><h2>Daily Noor</h2><small>Today</small></div>
            <div className="pcard" style={{ marginTop: 0 }}>
              <span className="tag">🤲 Dua of the Day · {noorToday.dua.source}</span>
              <div className="arabic" style={{ marginTop: 10 }}>{noorToday.dua.arabic}</div>
              <div className="en-lines" style={{ fontSize: 15.5, marginTop: 6 }}>{noorToday.dua.english}</div>
              <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 12 }}>
                <span className="tag">📜 Hadith of the Day · {noorToday.hadees.source}</span>
                <div className="en-lines" style={{ fontSize: 15.5, marginTop: 8 }}>{noorToday.hadees.english}</div>
              </div>
              <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} onClick={() => goMore('noor')}>Open Noor →</button>
            </div>

            <div className="section-title"><h2>Recently Added</h2><button className="link-btn" onClick={() => { setCatFilter('all'); setPoetFilter(null); setTab('library'); }}>View All →</button></div>
            <div className="hstrip">
              {[...poems].slice(-8).reverse().map(p => {
                const cat = CATEGORIES.find(c => c.id === p.category);
                const rsec = secondaryOf(p, lang || 'ur');
                return (
                  <button key={p.id} className="recent-card" onClick={() => openReel(p)}>
                    {p.lang === 'ur'
                      ? <span className="recent-urdu" dir="rtl">{p.urdu[0]}</span>
                      : <span className="recent-en">{p.title || p.lines[0]}</span>}
                    {rsec && <span className={'recent-sec' + (rsec.kind === 'hindi' ? ' hindi' : '')}>{rsec.lines[0]}</span>}
                    <span className="recent-meta">{poetOf(p.poet).name}</span>
                    {cat && <span className="tag" style={{ alignSelf: 'flex-start' }}>{cat.icon} {cat.label}</span>}
                  </button>
                );
              })}
            </div>

            <div className="create-hero">
              <h3>✍️ Create Your Own</h3>
              <p>Write your own poetry and turn it into a beautiful image card or a reel — with your name on it.</p>
              <button className="btn btn-gold" style={{ flex: '0 1 auto', marginTop: 12 }} onClick={() => goMore('create')}>Open Studio →</button>
            </div>

            <div className="section-title"><h2>Poets</h2><small>The masters</small></div>
            <div className="poet-row">
              {POETS.map(p => (
                <button key={p.id} className="poet" onClick={() => { setPoetFilter(p.id); setCatFilter('all'); setTab('library'); }}>
                  <span className="face">{p.urdu}</span>
                  <h4>{p.name}</h4>
                  <p>{p.years}</p>
                </button>
              ))}
            </div>

          </>
        )}

        {tab === 'library' && (
          <>
            <div className="search"><span>🔎</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search poems, poets or words…" /></div>
            <div className="chips" style={{ marginTop: 14 }}>
              <button className={`chip ${catFilter === 'all' && !poetFilter ? 'on' : ''}`} onClick={() => { setCatFilter('all'); setPoetFilter(null); }}>All</button>
              {CATEGORIES.map(c => (
                <button key={c.id} className={`chip ${catFilter === c.id ? 'on' : ''}`} onClick={() => { setCatFilter(c.id); setPoetFilter(null); }}>{c.icon} {c.label}</button>
              ))}
            </div>
            {poetFilter && (
              <div style={{ marginTop: 10 }}>
                <span className="tag">Poet: {poetOf(poetFilter).name}</span>{' '}
                <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setPoetFilter(null)}>✕ Clear</button>
              </div>
            )}
            {filtered.length === 0 && (
              <div className="empty"><span className="big">🌙</span>Nothing found for that search.<br />Try a poet's name — or browse the whole library.
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
                  <button className="btn btn-gold" style={{ flex: '0 1 auto' }} onClick={() => { setQuery(''); setCatFilter('all'); setPoetFilter(null); }}>Browse all poems</button>
                </div>
              </div>
            )}
            {filtered.map(p => (
              <PoemCard key={p.id} poem={p} isFav={favs.has(p.id)} onFav={toggleFav} onReel={openReel} toast={toast} lang={lang || 'ur'} />
            ))}
          </>
        )}

        {tab === 'reels' && <ReelsFeed key={reelsJump.nonce} startIndex={reelsJump.index} onCreate={() => goMore('create')} favs={favs} onFav={toggleFav} toast={toast} />}

        {tab === 'more' && moreView === 'menu' && <MoreMenu onOpen={setMoreView} />}

        {tab === 'more' && moreView === 'settings' && (
          <>
            <div style={{ marginTop: 14 }}><button className="btn" onClick={() => setMoreView('menu')}>← More</button></div>
            <SettingsScreen theme={theme} onToggleTheme={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
              reelAnim={reelAnim} onReelAnim={setReelAnim} toast={toast}
              poemsCount={poems.length} novelCount={totalEpCount}
              lang={lang || 'ur'} onLang={pickLang} />
          </>
        )}

        {tab === 'more' && moreView === 'create' && (
          <>
            <div style={{ marginTop: 14 }}><button className="btn" onClick={() => setMoreView('menu')}>← More</button></div>
            <div className="create-hero">
              <h3>✍️ Your Poetry, Your Reel</h3>
              <p>Type your own poem below — one line per line, in Urdu or English. Choose a scene, and your reel is ready with your name on it.</p>
            </div>
            <div className="form-card">
              <label>Your Poem</label>
              <textarea rows={6} value={ownText} onChange={e => setOwnText(e.target.value)}
                placeholder={'Write your poem here, one line per line…'} />
              <label>Your Name (shown as the poet)</label>
              <input type="text" value={ownName} onChange={e => setOwnName(e.target.value)} placeholder="e.g. Ahmed Raza" />
              <label>Reel Scene</label>
              <div className="scene-row">
                {SCENES.map(s => (
                  <button key={s.id} className={`scene-pick ${ownScene.id === s.id ? 'on' : ''}`} onClick={() => setOwnScene(s)}>
                    <img src={s.img} alt={s.label} /><span>{s.label}</span>
                  </button>
                ))}
              </div>
              <label>Line Animation</label>
              <div className="chips">
                {REEL_ANIMS.map(a => (
                  <button key={a.id} className={`chip ${reelAnim === a.id ? 'on' : ''}`} onClick={() => setReelAnim(a.id)}>{a.label}</button>
                ))}
              </div>
              <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', marginTop: 18, padding: '13px 16px' }}
                onClick={startOwnReel} disabled={!ownText.trim()}>
                🎬 Play My Reel
              </button>
              <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 9 }}
                disabled={!ownText.trim()}
                onClick={() => { const p = ownPoem(); if (p) sharePoem(p, ownScene, toast); }}>
                📤 Create Share Card
              </button>
            </div>
          </>
        )}

        {tab === 'more' && moreView === 'create' && <PhotoCardMaker poems={poems} toast={toast} />}

      {tab === 'novel' && <NovelScreen toast={toast} novels={novels} openRequest={novelOpenReq} onConsumeOpenRequest={() => setNovelOpenReq(null)} />}

        {tab === 'more' && moreView === 'noor' && (
          <>
            <div style={{ marginTop: 14 }}><button className="btn" onClick={() => setMoreView('menu')}>← More</button></div>
            <div className="create-hero">
              <h3>☪️ Noor — Daily Light</h3>
              <p>Authentic duas and ahadees for every day — each one shown with its source, so you can trust and verify what you read.</p>
            </div>

            <div className="pcard">
              <span className="tag">Dua of the Day · {noorToday.dua.source}</span>
              <div className="arabic" style={{ marginTop: 10 }}>{noorToday.dua.arabic}</div>
              <div className="roman">{noorToday.dua.roman}</div>
              <div className="en-lines" style={{ fontSize: 16.5, marginTop: 6 }}>{noorToday.dua.english}</div>
            </div>
            <div className="pcard">
              <span className="tag">Hadees of the Day · {noorToday.hadees.source}</span>
              <div className="arabic" style={{ marginTop: 10 }}>{noorToday.hadees.arabic}</div>
              <div className="en-lines" style={{ fontSize: 16.5, marginTop: 6 }}>{noorToday.hadees.english}</div>
            </div>

            <div className="chips" style={{ marginTop: 18 }}>
              <button className={`chip ${noorTab === 'dua' ? 'on' : ''}`} onClick={() => setNoorTab('dua')}>🤲 Duas ({DUAS.length})</button>
              <button className={`chip ${noorTab === 'hadees' ? 'on' : ''}`} onClick={() => setNoorTab('hadees')}>📜 Ahadees ({HADEES.length})</button>
            </div>

            {noorTab === 'dua' && DUAS.map(d => (
              <div className="pcard" key={d.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: 14.5 }}>{d.title}</b><span className="tag">{d.when}</span>
                </div>
                <div className="arabic" style={{ marginTop: 8 }}>{d.arabic}</div>
                <div className="roman">{d.roman}</div>
                <div className="en-lines" style={{ fontSize: 16, marginTop: 6 }}>{d.english}</div>
                <footer>
                  <span className="tag">{d.source}</span>
                  <button className="icon-btn" title="Copy" onClick={() => copyText(`${d.arabic}\n${d.english}\n(${d.source}) — via DailyPoem Noor`)}>📋</button>
                </footer>
              </div>
            ))}

            {noorTab === 'hadees' && HADEES.map(h => (
              <div className="pcard" key={h.id}>
                <div className="arabic">{h.arabic}</div>
                <div className="en-lines" style={{ fontSize: 16, marginTop: 6 }}>{h.english}</div>
                <footer>
                  <span className="tag">{h.source}</span>
                  <button className="icon-btn" title="Copy" onClick={() => copyText(`${h.arabic}\n${h.english}\n(${h.source}) — via DailyPoem Noor`)}>📋</button>
                </footer>
              </div>
            ))}

            <div className="empty" style={{ padding: '26px 24px' }}>Quran reading with recitation is coming in the next phase of Noor, in shaa Allah.</div>
          </>
        )}

        {tab === 'more' && moreView === 'saved' && (
          <>
            <div style={{ marginTop: 14 }}><button className="btn" onClick={() => setMoreView('menu')}>← More</button></div>
            <div className="section-title"><h2>Saved</h2><small>{favPoems.length} poems</small></div>
            {favPoems.length === 0 && (
              <div className="empty"><span className="big">🤍</span>Nothing saved yet.<br />Tap the heart on any poem and it will be saved here.
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
                  <button className="btn btn-gold" style={{ flex: '0 1 auto' }} onClick={() => setTab('library')}>Browse the Library</button>
                </div>
              </div>
            )}
            {favPoems.map(p => (
              <PoemCard key={p.id} poem={p} isFav onFav={toggleFav} onReel={openReel} toast={toast} lang={lang || 'ur'} />
            ))}
          </>
        )}
      </div>

      <nav className="nav">
        <button className={tab === 'home' ? 'on' : ''} onClick={() => setTab('home')}><span className="ni">🏠</span>Home</button>
        <button className={tab === 'library' ? 'on' : ''} onClick={() => setTab('library')}><span className="ni">📚</span>Library</button>
        <button className={tab === 'reels' ? 'on' : ''} onClick={() => { setReelsJump({ index: 0, nonce: Date.now() }); setTab('reels'); }}><span className="ni">🎬</span>Reels</button>
        <button className={tab === 'novel' ? 'on' : ''} onClick={() => setTab('novel')}><span className="ni">📖</span>Novels</button>
        <button className={tab === 'more' ? 'on' : ''} onClick={() => { if (tab === 'more') setMoreView('menu'); else setTab('more'); }}><span className="ni">☰</span>More</button>
      </nav>

      {toastMsg && <div className="toast">{toastMsg}</div>}
      {reel && <ReelPlayer poem={reel.poem} scene={reel.scene} onClose={() => { setReel(null); stopSpeak(); }} toast={toast} anim={reelAnim} onAnimChange={setReelAnim} lang={lang || 'ur'} />}
    </div>
  );
}
